'use client';

import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function ChannelSidebar() {
  const {
    activeServer,
    activeChannelId,
    selectChannel,
    createChannel,
  } = useApp();
  const { user } = useAuth();

  if (!activeServer) {
    return (
      <aside className="flex h-full w-60 flex-col bg-bgSidebar">
        <div className="flex h-12 items-center px-4 font-semibold text-white shadow-md">
          Burmalda
        </div>
        <div className="flex-1 px-4 py-4 text-sm text-textMuted">
          Create or join a server to get started.
        </div>
      </aside>
    );
  }

  async function onAddChannel() {
    if (!activeServer) return;
    const name = window.prompt('Channel name (no spaces):');
    if (!name) return;
    await createChannel(activeServer.id, name.trim().replace(/\s+/g, '-').toLowerCase());
  }

  return (
    <aside className="flex h-full w-60 flex-col bg-bgSidebar">
      <header className="flex h-12 items-center justify-between px-4 font-semibold text-white shadow-md">
        <span className="truncate">{activeServer.name}</span>
        <button
          title="Copy invite"
          onClick={() => {
            navigator.clipboard.writeText(activeServer.inviteCode);
            alert(`Invite code copied: ${activeServer.inviteCode}`);
          }}
          className="text-textMuted hover:text-white"
        >
          ⌘
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-1 flex items-center justify-between px-2 text-xs font-bold uppercase text-textMuted">
          <span>Text channels</span>
          <button
            onClick={onAddChannel}
            className="hover:text-white"
            title="Create channel"
          >
            +
          </button>
        </div>

        {activeServer.channels.map((c) => (
          <button
            key={c.id}
            onClick={() => selectChannel(c.id)}
            className={`flex w-full items-center gap-1 rounded px-2 py-1.5 text-left text-textMuted hover:bg-bgInput hover:text-textMain ${
              c.id === activeChannelId ? 'bg-bgInput text-white' : ''
            }`}
          >
            <span className="text-textMuted">#</span>
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 bg-bgDeep px-2 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
          {user?.displayName?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="truncate text-sm font-medium text-white">
            {user?.displayName}
          </div>
          <div className="truncate text-xs text-textMuted">
            @{user?.username}
          </div>
        </div>
      </div>
    </aside>
  );
}
