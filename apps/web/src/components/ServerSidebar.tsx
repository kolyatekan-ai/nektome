'use client';

import { useState } from 'react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function ServerSidebar() {
  const { servers, activeServerId, selectServer, createServer, joinServer } =
    useApp();
  const { logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  async function onCreate() {
    const name = window.prompt('Server name?');
    if (!name) return;
    await createServer(name);
    setShowMenu(false);
  }

  async function onJoin() {
    const code = window.prompt('Invite code?');
    if (!code) return;
    try {
      await joinServer(code.trim());
    } catch (e) {
      alert((e as Error).message);
    }
    setShowMenu(false);
  }

  return (
    <nav className="flex h-full w-[72px] flex-col items-center gap-2 bg-bgDeep py-3">
      {servers.map((s) => {
        const initials = s.name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? '')
          .join('');
        const active = s.id === activeServerId;
        return (
          <button
            key={s.id}
            onClick={() => selectServer(s.id)}
            title={s.name}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-3xl bg-bgSidebar font-semibold text-textMain transition-all hover:rounded-2xl hover:bg-accent hover:text-white ${
              active ? 'rounded-2xl bg-accent text-white' : ''
            }`}
          >
            <span
              className={`absolute -left-3 w-1 rounded-r bg-white transition-all ${
                active ? 'h-10' : 'h-0 group-hover:h-5'
              }`}
            />
            {initials || '?'}
          </button>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-3xl bg-bgSidebar text-2xl text-success transition-all hover:rounded-2xl hover:bg-success hover:text-white"
          title="Add a server"
        >
          +
        </button>
        {showMenu && (
          <div className="absolute left-16 top-0 z-50 w-48 rounded-md bg-bgInput p-2 shadow-xl">
            <button
              onClick={onCreate}
              className="block w-full rounded px-3 py-2 text-left text-sm text-textMain hover:bg-accent hover:text-white"
            >
              Create server
            </button>
            <button
              onClick={onJoin}
              className="block w-full rounded px-3 py-2 text-left text-sm text-textMain hover:bg-accent hover:text-white"
            >
              Join via invite
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={logout}
        className="flex h-12 w-12 items-center justify-center rounded-3xl bg-bgSidebar text-textMuted transition-all hover:rounded-2xl hover:bg-danger hover:text-white"
        title="Log out"
      >
        ⎋
      </button>
    </nav>
  );
}
