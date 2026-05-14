'use client';

import { create } from 'zustand';
import type {
  ChannelDto,
  MessageDto,
  ServerDto,
  UserPublic,
} from '@burmalda/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { getVoiceClient, type VoicePeerView } from '@/lib/voice';

interface ServerWithDetails extends ServerDto {
  channels: ChannelDto[];
  members: { userId: string; user: UserPublic }[];
}

export interface VoiceState {
  channelId: string;
  serverId: string | null; // null for DM call
  channelName: string;
  isDM: boolean;
  peers: VoicePeerView[];
  muted: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  /** local camera track for self-preview */
  localCameraTrack: MediaStreamTrack | null;
  localScreenTrack: MediaStreamTrack | null;
}

export interface IncomingCall {
  fromUserId: string;
  fromUsername: string;
  fromDisplayName: string;
  fromAvatarUrl: string | null;
  channelId: string; // synthetic dm:userA:userB id
}

type VoiceCounts = Record<string, number>;

function dmChannelId(a: string, b: string): string {
  return `dm:${[a, b].sort().join(':')}`;
}

interface AppState {
  servers: ServerDto[];
  activeServerId: string | null;
  activeServer: ServerWithDetails | null;
  activeChannelId: string | null;
  messages: Record<string, MessageDto[]>;
  typing: Record<string, { userId: string; username: string; ts: number }[]>;
  voiceCounts: VoiceCounts;
  voice: VoiceState | null;
  incomingCall: IncomingCall | null;
  outgoingCall: { toUserId: string; toDisplayName: string; channelId: string } | null;

  loadServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  joinServer: (inviteCode: string) => Promise<void>;
  createChannel: (
    serverId: string,
    name: string,
    type?: 'TEXT' | 'VOICE',
  ) => Promise<void>;
  initSocket: () => void;
  notifyTyping: (channelId: string) => void;

  // voice
  joinVoice: (channelId: string) => Promise<void>;
  leaveVoice: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreen: () => Promise<void>;

  // DM calls
  startDmCall: (toUser: UserPublic, ownUserId: string) => Promise<void>;
  acceptIncomingCall: (ownUserId: string) => Promise<void>;
  declineIncomingCall: () => void;
  cancelOutgoingCall: () => void;
  dismissIncoming: () => void;
}

export const useApp = create<AppState>((set, get) => ({
  servers: [],
  activeServerId: null,
  activeServer: null,
  activeChannelId: null,
  messages: {},
  typing: {},
  voiceCounts: {},
  voice: null,
  incomingCall: null,
  outgoingCall: null,

  async loadServers() {
    const servers = await api.myServers();
    set({ servers });
    if (servers.length && !get().activeServerId) {
      await get().selectServer(servers[0].id);
    }
  },

  async selectServer(serverId) {
    const server = await api.getServer(serverId);
    set({
      activeServerId: serverId,
      activeServer: server,
      activeChannelId:
        server.channels.find((c) => c.type === 'TEXT')?.id ??
        server.channels[0]?.id ??
        null,
    });
    const firstText = server.channels.find((c) => c.type === 'TEXT');
    if (firstText) {
      await get().selectChannel(firstText.id);
    }
  },

  async selectChannel(channelId) {
    const channel = get().activeServer?.channels.find((c) => c.id === channelId);
    if (channel?.type === 'VOICE') {
      await get().joinVoice(channelId);
      return;
    }
    set({ activeChannelId: channelId });
    if (!get().messages[channelId]) {
      const messages = await api.listMessages(channelId);
      set((state) => ({
        messages: { ...state.messages, [channelId]: messages },
      }));
    }
    getSocket().emit('channel:join', { channelId });
  },

  async sendMessage(channelId, content) {
    await api.sendMessage(channelId, content);
  },

  async createServer(name) {
    const server = await api.createServer(name);
    set((state) => ({ servers: [...state.servers, server] }));
    await get().selectServer(server.id);
  },

  async joinServer(inviteCode) {
    const server = await api.joinServer(inviteCode);
    if (!get().servers.find((s) => s.id === server.id)) {
      set((state) => ({ servers: [...state.servers, server] }));
    }
    await get().selectServer(server.id);
  },

  async createChannel(serverId, name, type = 'TEXT') {
    await api.createChannel(serverId, name, type);
    if (get().activeServerId === serverId) {
      const server = await api.getServer(serverId);
      set({ activeServer: server });
    }
  },

  initSocket() {
    const socket = getSocket();

    socket.off('message:new');
    socket.off('message:edit');
    socket.off('message:delete');
    socket.off('channel:typing');
    socket.off('voice:state');
    socket.off('call:incoming');
    socket.off('call:cancelled');
    socket.off('call:declined');

    socket.on('message:new', ({ message }: { message: MessageDto }) => {
      set((state) => {
        const list = state.messages[message.channelId] ?? [];
        if (list.some((m) => m.id === message.id)) return state;
        return {
          messages: {
            ...state.messages,
            [message.channelId]: [...list, message],
          },
        };
      });
    });

    socket.on('message:edit', ({ message }: { message: MessageDto }) => {
      set((state) => {
        const list = state.messages[message.channelId];
        if (!list) return state;
        return {
          messages: {
            ...state.messages,
            [message.channelId]: list.map((m) =>
              m.id === message.id ? message : m,
            ),
          },
        };
      });
    });

    socket.on(
      'message:delete',
      ({ channelId, messageId }: { channelId: string; messageId: string }) => {
        set((state) => {
          const list = state.messages[channelId];
          if (!list) return state;
          return {
            messages: {
              ...state.messages,
              [channelId]: list.filter((m) => m.id !== messageId),
            },
          };
        });
      },
    );

    socket.on(
      'channel:typing',
      (payload: { channelId: string; userId: string; username: string }) => {
        const now = Date.now();
        set((state) => {
          const list = (state.typing[payload.channelId] ?? []).filter(
            (t) => t.userId !== payload.userId && now - t.ts < 5000,
          );
          return {
            typing: {
              ...state.typing,
              [payload.channelId]: [
                ...list,
                { userId: payload.userId, username: payload.username, ts: now },
              ],
            },
          };
        });
      },
    );

    socket.on(
      'voice:state',
      (data: { channelId: string; participants: any[] }) => {
        set((state) => ({
          voiceCounts: {
            ...state.voiceCounts,
            [data.channelId]: data.participants.length,
          },
        }));
      },
    );

    socket.on('call:incoming', (data: IncomingCall) => {
      // ignore if I'm already in a call
      if (get().voice) return;
      set({ incomingCall: data });
    });
    socket.on('call:cancelled', (data: { fromUserId: string }) => {
      const inc = get().incomingCall;
      if (inc && inc.fromUserId === data.fromUserId) {
        set({ incomingCall: null });
      }
    });
    socket.on('call:declined', () => {
      // outgoing was rejected
      set({ outgoingCall: null });
      // also leave voice if we already joined waiting
      const v = get().voice;
      if (v && v.isDM) {
        get().leaveVoice();
      }
    });
  },

  notifyTyping(channelId) {
    getSocket().emit('channel:typing:start', { channelId });
  },

  // ===== voice =====

  async joinVoice(channelId) {
    const server = get().activeServer;
    const channel = server?.channels.find((c) => c.id === channelId);
    if (!server || !channel) return;

    if (get().voice?.channelId === channelId) return;

    const socket = getSocket();
    const vc = getVoiceClient(socket);
    try {
      await vc.join(channelId);
    } catch {
      alert(
        'Microphone access denied. Allow mic in your browser to join voice.',
      );
      return;
    }

    set({
      voice: {
        channelId,
        serverId: server.id,
        channelName: channel.name,
        isDM: false,
        peers: [],
        muted: false,
        cameraOn: false,
        screenOn: false,
        localCameraTrack: null,
        localScreenTrack: null,
      },
    });

    vc.onChange((peers) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, peers } });
    });
    vc.onLocalCameraChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({
        voice: { ...v, cameraOn: !!t, localCameraTrack: t },
      });
    });
    vc.onLocalScreenChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({
        voice: { ...v, screenOn: !!t, localScreenTrack: t },
      });
    });
  },

  async leaveVoice() {
    const socket = getSocket();
    const vc = getVoiceClient(socket);
    await vc.leave();
    set({ voice: null });
  },

  toggleMute() {
    const v = get().voice;
    if (!v) return;
    const socket = getSocket();
    const vc = getVoiceClient(socket);
    const next = !v.muted;
    vc.setMuted(next);
    set({ voice: { ...v, muted: next } });
  },

  async toggleCamera() {
    const v = get().voice;
    if (!v) return;
    const socket = getSocket();
    const vc = getVoiceClient(socket);
    try {
      await vc.toggleCamera();
    } catch (e) {
      alert((e as Error).message);
    }
  },

  async toggleScreen() {
    const v = get().voice;
    if (!v) return;
    const socket = getSocket();
    const vc = getVoiceClient(socket);
    try {
      await vc.toggleScreenShare();
    } catch (e) {
      // user cancelled the share dialog — ignore silently
    }
  },

  // ===== DM CALLS =====

  async startDmCall(toUser, ownUserId) {
    const channelId = dmChannelId(ownUserId, toUser.id);
    const socket = getSocket();
    const vc = getVoiceClient(socket);

    // join the voice room first so we are ready to receive offers
    try {
      await vc.join(channelId, { isDM: true });
    } catch {
      alert('Microphone access denied.');
      return;
    }
    set({
      voice: {
        channelId,
        serverId: null,
        channelName: toUser.displayName,
        isDM: true,
        peers: [],
        muted: false,
        cameraOn: false,
        screenOn: false,
        localCameraTrack: null,
        localScreenTrack: null,
      },
      outgoingCall: {
        toUserId: toUser.id,
        toDisplayName: toUser.displayName,
        channelId,
      },
    });
    vc.onChange((peers) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, peers } });
      // outgoing call answered → clear outgoing toast
      if (peers.length > 0 && get().outgoingCall) {
        set({ outgoingCall: null });
      }
    });
    vc.onLocalCameraChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, cameraOn: !!t, localCameraTrack: t } });
    });
    vc.onLocalScreenChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, screenOn: !!t, localScreenTrack: t } });
    });

    socket.emit('call:invite', { toUserId: toUser.id, channelId });
  },

  async acceptIncomingCall(ownUserId) {
    const inc = get().incomingCall;
    if (!inc) return;
    set({ incomingCall: null });

    const socket = getSocket();
    const vc = getVoiceClient(socket);
    try {
      await vc.join(inc.channelId, { isDM: true });
    } catch {
      alert('Microphone access denied.');
      return;
    }
    set({
      voice: {
        channelId: inc.channelId,
        serverId: null,
        channelName: inc.fromDisplayName,
        isDM: true,
        peers: [],
        muted: false,
        cameraOn: false,
        screenOn: false,
        localCameraTrack: null,
        localScreenTrack: null,
      },
    });
    vc.onChange((peers) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, peers } });
    });
    vc.onLocalCameraChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, cameraOn: !!t, localCameraTrack: t } });
    });
    vc.onLocalScreenChange((t) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, screenOn: !!t, localScreenTrack: t } });
    });
  },

  declineIncomingCall() {
    const inc = get().incomingCall;
    if (!inc) return;
    getSocket().emit('call:decline', {
      toUserId: inc.fromUserId,
      channelId: inc.channelId,
    });
    set({ incomingCall: null });
  },

  cancelOutgoingCall() {
    const out = get().outgoingCall;
    if (!out) return;
    getSocket().emit('call:cancel', {
      toUserId: out.toUserId,
      channelId: out.channelId,
    });
    set({ outgoingCall: null });
    get().leaveVoice();
  },

  dismissIncoming() {
    set({ incomingCall: null });
  },
}));
