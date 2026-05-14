'use client';

import type { Socket } from 'socket.io-client';

/**
 * VoiceClient — manages WebRTC peer connections for a voice channel.
 *
 * Architecture: full mesh.
 *  - When you join a voice channel, the server tells you about existing peers.
 *  - You create an RTCPeerConnection per peer and SEND offer to each.
 *  - Existing peers receive 'voice:peer-joined' and wait for offer (perfect-negotiation lite).
 *
 * Free, no SFU — works for ~6-8 participants comfortably on a residential connection.
 */

const STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
];

export interface VoicePeerView {
  socketId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  muted: boolean;
  speaking: boolean;
  stream: MediaStream | null;
}

type Listener = (peers: VoicePeerView[]) => void;

export class VoiceClient {
  private socket: Socket;
  private channelId: string | null = null;
  private localStream: MediaStream | null = null;
  private peers = new Map<string, RTCPeerConnection>();
  private peerInfo = new Map<string, VoicePeerView>();
  private speakingDetector: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private localMuted = false;
  private localSpeaking = false;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;

  constructor(socket: Socket) {
    this.socket = socket;
    this.bindServerEvents();
  }

  private bindServerEvents() {
    // Existing peers list at join time → we are the offerer
    this.socket.on(
      'voice:peers',
      async (data: { channelId: string; participants: any[] }) => {
        if (data.channelId !== this.channelId) return;
        for (const p of data.participants) {
          await this.createPeer(p, /*isOfferer*/ true);
        }
      },
    );

    // New peer joined after us → they will offer us, we just register info
    this.socket.on(
      'voice:peer-joined',
      (data: { channelId: string; participant: any }) => {
        if (data.channelId !== this.channelId) return;
        const p = data.participant;
        this.peerInfo.set(p.socketId, {
          socketId: p.socketId,
          userId: p.userId,
          username: p.username,
          displayName: p.displayName,
          avatarUrl: p.avatarUrl,
          muted: !!p.muted,
          speaking: false,
          stream: null,
        });
        this.notify();
      },
    );

    this.socket.on(
      'voice:peer-left',
      (data: { channelId: string; socketId: string }) => {
        if (data.channelId !== this.channelId) return;
        this.cleanupPeer(data.socketId);
        this.notify();
      },
    );

    this.socket.on(
      'voice:peer-muted',
      (data: { socketId: string; muted: boolean }) => {
        const info = this.peerInfo.get(data.socketId);
        if (info) {
          info.muted = data.muted;
          this.notify();
        }
      },
    );

    this.socket.on(
      'voice:speaking',
      (data: { socketId: string; speaking: boolean }) => {
        const info = this.peerInfo.get(data.socketId);
        if (info) {
          info.speaking = data.speaking;
          this.notify();
        }
      },
    );

    this.socket.on('voice:signal', async (data: any) => {
      if (data.channelId !== this.channelId) return;
      const fromId = data.fromSocketId;
      let pc = this.peers.get(fromId);
      const signal = data.signal;

      // Inbound offer from a freshly joined peer → become answerer
      if (signal.type === 'offer') {
        if (!pc) {
          const info = this.peerInfo.get(fromId);
          if (info) {
            await this.createPeer(
              {
                socketId: fromId,
                userId: info.userId,
                username: info.username,
                displayName: info.displayName,
                avatarUrl: info.avatarUrl,
                muted: info.muted,
              },
              false,
            );
            pc = this.peers.get(fromId);
          }
        }
        if (!pc) return;
        await pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.socket.emit('voice:signal', {
          channelId: this.channelId,
          toSocketId: fromId,
          signal: { type: 'answer', sdp: answer.sdp },
        });
      } else if (signal.type === 'answer' && pc) {
        await pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
      } else if (signal.type === 'ice' && pc) {
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch {
          /* ignore late ICE */
        }
      }
    });
  }

  async join(channelId: string): Promise<void> {
    if (this.channelId) await this.leave();

    // request mic
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    this.channelId = channelId;
    this.startSpeakingDetector();
    this.socket.emit('voice:join', { channelId });
  }

  async leave(): Promise<void> {
    if (!this.channelId) return;
    this.socket.emit('voice:leave', {});

    this.stopSpeakingDetector();

    for (const [id] of this.peers) {
      this.cleanupPeer(id);
    }
    this.peers.clear();
    this.peerInfo.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.audioCtx) {
      try {
        await this.audioCtx.close();
      } catch {
        /* */
      }
      this.audioCtx = null;
      this.localAnalyser = null;
    }
    this.channelId = null;
    this.localMuted = false;
    this.notify();
  }

  setMuted(muted: boolean) {
    this.localMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    }
    this.socket.emit('voice:mute', { muted });
  }

  isMuted() {
    return this.localMuted;
  }

  getCurrentChannelId() {
    return this.channelId;
  }

  onChange(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot());
    return () => this.listeners.delete(listener);
  }

  snapshot(): VoicePeerView[] {
    return Array.from(this.peerInfo.values());
  }

  private notify() {
    const snap = this.snapshot();
    this.listeners.forEach((l) => l(snap));
  }

  private async createPeer(
    p: {
      socketId: string;
      userId: string;
      username: string;
      displayName: string;
      avatarUrl: string | null;
      muted: boolean;
    },
    isOfferer: boolean,
  ) {
    if (this.peers.has(p.socketId)) return;

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    this.peers.set(p.socketId, pc);

    const view: VoicePeerView = {
      socketId: p.socketId,
      userId: p.userId,
      username: p.username,
      displayName: p.displayName,
      avatarUrl: p.avatarUrl,
      muted: !!p.muted,
      speaking: false,
      stream: null,
    };
    this.peerInfo.set(p.socketId, view);

    // add local audio
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socket.emit('voice:signal', {
          channelId: this.channelId,
          toSocketId: p.socketId,
          signal: { type: 'ice', candidate: e.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      view.stream = stream;
      // play audio
      const audio = document.createElement('audio');
      audio.autoplay = true;
      audio.srcObject = stream;
      audio.dataset.peerId = p.socketId;
      audio.style.display = 'none';
      document.body.appendChild(audio);
      audio.play().catch(() => undefined);
      this.notify();
    };

    if (isOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('voice:signal', {
        channelId: this.channelId,
        toSocketId: p.socketId,
        signal: { type: 'offer', sdp: offer.sdp },
      });
    }

    this.notify();
  }

  private cleanupPeer(socketId: string) {
    const pc = this.peers.get(socketId);
    if (pc) {
      try {
        pc.close();
      } catch {
        /* */
      }
      this.peers.delete(socketId);
    }
    this.peerInfo.delete(socketId);

    // remove the audio element
    document
      .querySelectorAll(`audio[data-peer-id="${socketId}"]`)
      .forEach((el) => el.remove());
  }

  private startSpeakingDetector() {
    if (!this.localStream) return;
    try {
      this.audioCtx = new AudioContext();
      const src = this.audioCtx.createMediaStreamSource(this.localStream);
      this.localAnalyser = this.audioCtx.createAnalyser();
      this.localAnalyser.fftSize = 512;
      src.connect(this.localAnalyser);
    } catch {
      return;
    }

    const data = new Uint8Array(this.localAnalyser.frequencyBinCount);

    this.speakingDetector = setInterval(() => {
      if (!this.localAnalyser) return;
      this.localAnalyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const avg = sum / data.length;
      const speaking = !this.localMuted && avg > 16;
      if (speaking !== this.localSpeaking) {
        this.localSpeaking = speaking;
        this.socket.emit('voice:speaking', { speaking });
      }
    }, 250);
  }

  private stopSpeakingDetector() {
    if (this.speakingDetector) {
      clearInterval(this.speakingDetector);
      this.speakingDetector = null;
    }
    this.localSpeaking = false;
  }
}

let _client: VoiceClient | null = null;
export function getVoiceClient(socket: Socket): VoiceClient {
  if (!_client) _client = new VoiceClient(socket);
  return _client;
}
export function resetVoiceClient() {
  _client = null;
}
