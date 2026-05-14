'use client';

import { create } from 'zustand';
import type { ChannelDto, MessageDto, ServerDto, UserPublic } from '@burmalda/shared';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';

interface ServerWithDetails extends ServerDto {
  channels: ChannelDto[];
  members: { userId: string; user: UserPublic }[];
}

interface AppState {
  servers: ServerDto[];
  activeServerId: string | null;
  activeServer: ServerWithDetails | null;
  activeChannelId: string | null;
  messages: Record<string, MessageDto[]>; // by channelId
  typing: Record<string, { userId: string; username: string; ts: number }[]>;

  loadServers: () => Promise<void>;
  selectServer: (serverId: string) => Promise<void>;
  selectChannel: (channelId: string) => Promise<void>;
  sendMessage: (channelId: string, content: string) => Promise<void>;
  createServer: (name: string) => Promise<void>;
  joinServer: (inviteCode: string) => Promise<void>;
  createChannel: (serverId: string, name: string) => Promise<void>;
  initSocket: () => void;
  notifyTyping: (channelId: string) => void;
}

export const useApp = create<AppState>((set, get) => ({
  servers: [],
  activeServerId: null,
  activeServer: null,
  activeChannelId: null,
  messages: {},
  typing: {},

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
      activeChannelId: server.channels[0]?.id ?? null,
    });
    if (server.channels[0]) {
      await get().selectChannel(server.channels[0].id);
    }
  },

  async selectChannel(channelId) {
    set({ activeChannelId: channelId });
    if (!get().messages[channelId]) {
      const messages = await api.listMessages(channelId);
      set((state) => ({
        messages: { ...state.messages, [channelId]: messages },
      }));
    }
    // ensure socket joined this channel room (auto-join already covers existing channels;
    // emit explicit join to handle channels created after WS connect)
    getSocket().emit('channel:join', { channelId });
  },

  async sendMessage(channelId, content) {
    // optimistic UI: server will broadcast via socket; we just call REST
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

  async createChannel(serverId, name) {
    await api.createChannel(serverId, name);
    if (get().activeServerId === serverId) {
      await get().selectServer(serverId);
    }
  },

  initSocket() {
    const socket = getSocket();

    socket.off('message:new');
    socket.off('message:edit');
    socket.off('message:delete');
    socket.off('channel:typing');

    socket.on('message:new', ({ message }: { message: MessageDto }) => {
      set((state) => {
        const list = state.messages[message.channelId] ?? [];
        // de-dupe
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
  },

  notifyTyping(channelId) {
    getSocket().emit('channel:typing:start', { channelId });
  },
}));
