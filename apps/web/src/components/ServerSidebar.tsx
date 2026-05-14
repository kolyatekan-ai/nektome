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
    <nav className="relative z-10 flex h-full w-[80px] flex-col items-center gap-2.5 bg-bgDeep py-4">
      {/* logo */}
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-grad text-bgDeep shadow-glow font-bold text-lg select-none">
        B
      </div>
      <div className="my-1 h-px w-8 bg-border" />

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
            className={`group relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-bgPanel font-semibold text-textSoft transition-all duration-200 hover:bg-bgPanelHi hover:text-white hover:shadow-glow-sm ${
              active
                ? 'bg-accent-grad text-bgDeep shadow-glow ring-1 ring-accent/50'
                : ''
            }`}
            style={
              active
                ? {}
                : {
                    backgroundImage:
                      'linear-gradient(135deg, rgba(255,255,255,0.04), transparent)',
                  }
            }
          >
            <span
              className={`absolute -left-1 w-1 rounded-r-full bg-accent transition-all ${
                active
                  ? 'h-8 shadow-[0_0_8px_rgba(125,211,252,0.6)]'
                  : 'h-0 group-hover:h-4'
              }`}
            />
            <span className="relative">{initials || '?'}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          className="flex h-12 w-12 items-center justify-center rounded-2xl border border-success/30 bg-bgPanel text-2xl text-success transition-all hover:border-success hover:bg-success/10 hover:shadow-[0_0_16px_rgba(52,211,153,0.3)]"
          title="Add a server"
        >
          +
        </button>
        {showMenu && (
          <div className="glass titanium-border absolute left-16 top-0 z-50 w-52 rounded-xl p-1.5">
            <button
              onClick={onCreate}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-textMain transition-colors hover:bg-accent/10 hover:text-accent"
            >
              ✨ Create server
            </button>
            <button
              onClick={onJoin}
              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-textMain transition-colors hover:bg-accent/10 hover:text-accent"
            >
              🎟 Join via invite
            </button>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={logout}
        className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bgPanel text-textMuted transition-all hover:bg-danger/10 hover:text-danger"
        title="Log out"
      >
        ⎋
      </button>
    </nav>
  );
}
