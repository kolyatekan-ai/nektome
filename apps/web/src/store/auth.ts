'use client';

import { create } from 'zustand';
import type { UserPublic } from '@burmalda/shared';
import { api, tokenStore } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface AuthState {
  user: UserPublic | null;
  loading: boolean;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,

  async hydrate() {
    const token = tokenStore.getAccess();
    if (!token) {
      set({ loading: false });
      return;
    }
    try {
      const user = await api.me();
      set({ user, loading: false });
    } catch {
      tokenStore.clear();
      set({ user: null, loading: false });
    }
  },

  async login(email, password) {
    const res = await api.login({ email, password });
    tokenStore.set(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  async register(email, username, displayName, password) {
    const res = await api.register({ email, username, displayName, password });
    tokenStore.set(res.accessToken, res.refreshToken);
    set({ user: res.user });
  },

  logout() {
    tokenStore.clear();
    disconnectSocket();
    set({ user: null });
  },
}));
