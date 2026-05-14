'use client';

import type { Socket } from 'socket.io-client';

/**
 * VoiceClient — manages WebRTC peer connections (audio + video + screen share).
 *
 * Architecture: full mesh, suitable for ~6-8 participants.
 *  - Each peer maintains an RTCPeerConnection per other peer.
 *  - When you join, server tells you about existing peers → you create OFFERS.
 *  - Existing peers receive 'voice:peer-joined' and respond with ANSWER.
 *
 * Tracks:
 *  - Always: 1 audio track (mic).
 *  - Optional: 1 camera video track.
 *  - Optional: 1 screen share video track (separate from camera).
 *  - We tag screen tracks via track.contentHint = 'screen' to distinguish them.
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
  /** mixed inbound stream containing remote audio + camera + screen tracks */
  stream: MediaStream | null;
  hasVideo: boolean;
  hasScreen: boolean;
}

type Listener = (peers: VoicePeerView[]) => void;

export class VoiceClient {
  private socket: Socket;
  private channelId: string | null = null;
  private localStream: MediaStream | null = null; // mic + camera (camera optional)
  private screenStream: MediaStream | null = null; // screen capture
  private peers = new Map<string, RTCPeerConnection>();
  private peerInfo = new Map<string, VoicePeerView>();
  private screenSenders = new Map<string, RTCRtpSender>();
  private speakingDetector: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<Listener>();
  private localMuted = false;
  private localSpeaking = false;
  private cameraEnabled = false;
  private screenEnabled = false;
  private audioCtx: AudioContext | null = null;
  private localAnalyser: AnalyserNode | null = null;
  private localVideoListeners = new Set<
    (track: MediaStreamTrack | null) => void
  >();
  private localScreenListeners = new Set<
    (track: MediaStreamTrack | null) => void
  >();

  constructor(socket: Socket) {
    this.socket = socket;
    this.bindServerEvents();
  }

  // ===== public state getters =====

  isMuted() {
    return this.localMuted;
  }
  isCameraOn() {
    return this.cameraEnabled;
  }
  isScreenOn() {
    return this.screenEnabled;
  }
  getCurrentChannelId() {
    return this.channelId;
  }
  getLocalCameraTrack(): MediaStreamTrack | null {
    return (
      this.localStream
        ?.getVideoTracks()
        .find((t) => t.contentHint !== 'screen') ?? null
    );
  }
  getLocalScreenTrack(): MediaStreamTrack | null {
    return this.screenStream?.getVideoTracks()[0] ?? null;
  }

  // ===== signaling event handlers =====

  private bindServerEvents() {
    this.socket.on(
      'voice:peers',
      async (data: { channelId: string; participants: any[] }) => {
        if (data.channelId !== this.channelId) return;
        for (const p of data.participants) {
          await this.createPeer(p, /*isOfferer*/ true);
        }
      },
    );

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
          hasVideo: false,
          hasScreen: false,
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
          /* late ICE */
        }
      }
    });
  }

  // ===== join / leave =====

  async join(channelId: string, opts?: { isDM?: boolean }): Promise<void> {
    if (this.channelId) await this.leave();

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
    this.socket.emit('voice:join', { channelId, isDM: !!opts?.isDM });
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
    this.screenSenders.clear();

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
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
    this.cameraEnabled = false;
    this.screenEnabled = false;
    this.notifyLocalCamera(null);
    this.notifyLocalScreen(null);
    this.notify();
  }

  // ===== mic =====

  setMuted(muted: boolean) {
    this.localMuted = muted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    }
    this.socket.emit('voice:mute', { muted });
  }

  // ===== camera =====

  async toggleCamera(): Promise<void> {
    if (this.cameraEnabled) {
      this.stopCamera();
    } else {
      await this.startCamera();
    }
  }

  async startCamera(): Promise<void> {
    if (!this.localStream || this.cameraEnabled) return;
    let camStream: MediaStream;
    try {
      camStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
        audio: false,
      });
    } catch {
      throw new Error('Camera access denied');
    }
    const track = camStream.getVideoTracks()[0];
    if (!track) return;
    track.contentHint = 'motion';
    this.localStream.addTrack(track);

    for (const [peerId, pc] of this.peers) {
      const sender = pc.addTrack(track, this.localStream);
      (sender as any).__kind = 'camera';
      await this.renegotiate(peerId, pc);
    }

    this.cameraEnabled = true;
    this.notifyLocalCamera(track);
    this.notify();
  }

  stopCamera() {
    if (!this.localStream) return;
    const track = this.localStream
      .getVideoTracks()
      .find((t) => t.contentHint !== 'screen');
    if (!track) return;
    track.stop();
    this.localStream.removeTrack(track);

    for (const [peerId, pc] of this.peers) {
      const senders = pc.getSenders();
      for (const s of senders) {
        if ((s as any).__kind === 'camera' || s.track === track) {
          try {
            pc.removeTrack(s);
          } catch {
            /* */
          }
        }
      }
      this.renegotiate(peerId, pc).catch(() => undefined);
    }

    this.cameraEnabled = false;
    this.notifyLocalCamera(null);
    this.notify();
  }

  // ===== screen share =====

  async toggleScreenShare(): Promise<void> {
    if (this.screenEnabled) {
      this.stopScreenShare();
    } else {
      await this.startScreenShare();
    }
  }

  async startScreenShare(): Promise<void> {
    if (this.screenEnabled) return;
    let stream: MediaStream;
    try {
      stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
        audio: false,
      });
    } catch {
      throw new Error('Screen share denied');
    }
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    track.contentHint = 'screen';
    this.screenStream = stream;
    track.onended = () => this.stopScreenShare();

    for (const [peerId, pc] of this.peers) {
      const sender = pc.addTrack(track, stream);
      (sender as any).__kind = 'screen';
      this.screenSenders.set(peerId, sender);
      await this.renegotiate(peerId, pc);
    }

    this.screenEnabled = true;
    this.notifyLocalScreen(track);
    this.notify();
  }

  stopScreenShare() {
    if (!this.screenEnabled && !this.screenStream) return;
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((t) => t.stop());
      this.screenStream = null;
    }
    for (const [peerId, pc] of this.peers) {
      const sender = this.screenSenders.get(peerId);
      if (sender) {
        try {
          pc.removeTrack(sender);
        } catch {
          /* */
        }
        this.screenSenders.delete(peerId);
        this.renegotiate(peerId, pc).catch(() => undefined);
      }
    }
    this.screenEnabled = false;
    this.notifyLocalScreen(null);
    this.notify();
  }

  // ===== local-video listeners (for self-preview tile) =====

  onLocalCameraChange(cb: (track: MediaStreamTrack | null) => void) {
    this.localVideoListeners.add(cb);
    cb(this.getLocalCameraTrack());
    return () => this.localVideoListeners.delete(cb);
  }
  onLocalScreenChange(cb: (track: MediaStreamTrack | null) => void) {
    this.localScreenListeners.add(cb);
    cb(this.getLocalScreenTrack());
    return () => this.localScreenListeners.delete(cb);
  }
  private notifyLocalCamera(t: MediaStreamTrack | null) {
    this.localVideoListeners.forEach((l) => l(t));
  }
  private notifyLocalScreen(t: MediaStreamTrack | null) {
    this.localScreenListeners.forEach((l) => l(t));
  }

  // ===== peer state =====

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
      hasVideo: false,
      hasScreen: false,
    };
    this.peerInfo.set(p.socketId, view);

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        const sender = pc.addTrack(track, this.localStream);
        if (track.kind === 'video') {
          (sender as any).__kind =
            track.contentHint === 'screen' ? 'screen' : 'camera';
        }
      }
    }
    if (this.screenStream) {
      for (const track of this.screenStream.getVideoTracks()) {
        const sender = pc.addTrack(track, this.screenStream);
        (sender as any).__kind = 'screen';
        this.screenSenders.set(p.socketId, sender);
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
      let stream = view.stream;
      if (!stream) {
        stream = new MediaStream();
        view.stream = stream;
      }
      if (!stream.getTracks().includes(e.track)) {
        stream.addTrack(e.track);
      }

      if (e.track.kind === 'audio') {
        const audio = document.createElement('audio');
        audio.autoplay = true;
        audio.srcObject = new MediaStream([e.track]);
        audio.dataset.peerId = p.socketId;
        audio.style.display = 'none';
        document.body.appendChild(audio);
        audio.play().catch(() => undefined);
      }

      this.recomputePeerVideoFlags(view, stream);

      e.track.onended = () => {
        try {
          stream!.removeTrack(e.track);
        } catch {
          /* */
        }
        this.recomputePeerVideoFlags(view, stream!);
        this.notify();
      };

      this.notify();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.cleanupPeer(p.socketId);
        this.notify();
      }
    };

    if (isOfferer) {
      await this.renegotiate(p.socketId, pc);
    }

    this.notify();
  }

  private recomputePeerVideoFlags(view: VoicePeerView, stream: MediaStream) {
    let hasVideo = false;
    let hasScreen = false;
    for (const t of stream.getVideoTracks()) {
      if (t.contentHint === 'screen') hasScreen = true;
      else hasVideo = true;
    }
    view.hasVideo = hasVideo;
    view.hasScreen = hasScreen;
  }

  private async renegotiate(peerId: string, pc: RTCPeerConnection) {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.emit('voice:signal', {
        channelId: this.channelId,
        toSocketId: peerId,
        signal: { type: 'offer', sdp: offer.sdp },
      });
    } catch {
      /* peer left or ICE racing */
    }
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
    this.screenSenders.delete(socketId);

    document
      .querySelectorAll(`audio[data-peer-id="${socketId}"]`)
      .forEach((el) => el.remove());
  }

  // ===== voice activity =====

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
