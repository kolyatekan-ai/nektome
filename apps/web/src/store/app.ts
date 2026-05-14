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
  serverId: string;
  channelName: string;
  peers: VoicePeerView[];
  muted: boolean;
}

// per-channel public participant counts (used to badge channel sidebar)
type VoiceCounts = Record<string, number>;

interface AppState {
  servers: ServerDto[];
  activeServerId: string | null;
  activeServer: ServerWithDetails | null;
  activeChannelId: string | null;
  messages: Record<string, MessageDto[]>;
  typing: Record<string, { userId: string; username: string; ts: number }[]>;
  voiceCounts: VoiceCounts;
  voice: VoiceState | null;

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
      // voice channel — join voice instead of swapping the chat pane
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
    } catch (e) {
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
        peers: [],
        muted: false,
      },
    });

    vc.onChange((peers) => {
      const v = get().voice;
      if (!v) return;
      set({ voice: { ...v, peers } });
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
}));
