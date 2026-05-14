import type {
  AuthResponse,
  ChannelDto,
  MessageDto,
  ServerDto,
  UserPublic,
} from '@burmalda/shared';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

const TOKEN_KEY = 'burmalda_access_token';
const REFRESH_KEY = 'burmalda_refresh_token';

export const tokenStore = {
  getAccess(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  },
  getRefresh(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string) {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = tokenStore.getAccess();
  const res = await fetch(`${API_URL}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // ---- auth ----
  register(body: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  login(body: { email: string; password: string }) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  me() {
    return request<UserPublic>('/auth/me');
  },

  // ---- servers ----
  myServers() {
    return request<ServerDto[]>('/servers/me');
  },
  createServer(name: string) {
    return request<ServerDto>('/servers', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },
  getServer(id: string) {
    return request<
      ServerDto & {
        channels: ChannelDto[];
        members: { userId: string; user: UserPublic }[];
      }
    >(`/servers/${id}`);
  },
  joinServer(inviteCode: string) {
    return request<ServerDto>(`/servers/join/${inviteCode}`, {
      method: 'POST',
    });
  },

  // ---- channels ----
  createChannel(
    serverId: string,
    name: string,
    type: 'TEXT' | 'VOICE' = 'TEXT',
  ) {
    return request<ChannelDto>(`/servers/${serverId}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name, type }),
    });
  },

  // ---- messages ----
  listMessages(channelId: string, before?: string) {
    const qs = before ? `?before=${encodeURIComponent(before)}` : '';
    return request<MessageDto[]>(`/channels/${channelId}/messages${qs}`);
  },
  sendMessage(channelId: string, content: string) {
    return request<MessageDto>(`/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
};

export { API_URL };
