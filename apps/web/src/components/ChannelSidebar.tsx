'use client';

import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function ChannelSidebar() {
  const {
    activeServer,
    activeChannelId,
    selectChannel,
    createChannel,
    voice,
    voiceCounts,
  } = useApp();
  const { user } = useAuth();

  if (!activeServer) {
    return (
      <aside className="relative z-10 flex h-full w-64 flex-col bg-bgSidebar">
        <div className="flex h-14 items-center px-4 font-semibold text-white shadow-panel border-b border-border">
          <span className="bg-accent-grad bg-clip-text text-transparent">
            Burmalda
          </span>
        </div>
        <div className="flex-1 px-4 py-4 text-sm text-textMuted">
          Create or join a server to get started.
        </div>
      </aside>
    );
  }

  async function onAddChannel(type: 'TEXT' | 'VOICE') {
    if (!activeServer) return;
    const placeholder = type === 'TEXT' ? 'Channel name' : 'Voice channel name';
    const name = window.prompt(`${placeholder}:`);
    if (!name) return;
    const cleaned =
      type === 'TEXT'
        ? name.trim().replace(/\s+/g, '-').toLowerCase()
        : name.trim();
    await createChannel(activeServer.id, cleaned, type);
  }

  const textChannels = activeServer.channels.filter((c) => c.type === 'TEXT');
  const voiceChannels = activeServer.channels.filter((c) => c.type === 'VOICE');

  return (
    <aside className="relative z-10 flex h-full w-64 flex-col bg-bgSidebar">
      {/* server header */}
      <header className="relative flex h-14 items-center justify-between px-4 font-semibold text-white border-b border-border">
        <span className="truncate">{activeServer.name}</span>
        <button
          title="Copy invite code"
          onClick={() => {
            navigator.clipboard.writeText(activeServer.inviteCode);
          }}
          className="rounded-md p-1.5 text-textMuted transition-colors hover:bg-bgPanelHi hover:text-accent"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
      </header>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {/* Text channels */}
        <CategoryHeader
          label="Text Channels"
          onAdd={() => onAddChannel('TEXT')}
        />
        {textChannels.map((c) => (
          <ChannelButton
            key={c.id}
            active={c.id === activeChannelId}
            icon="#"
            name={c.name}
            onClick={() => selectChannel(c.id)}
          />
        ))}

        {/* Voice channels */}
        <div className="mt-4">
          <CategoryHeader
            label="Voice Channels"
            onAdd={() => onAddChannel('VOICE')}
          />
        </div>
        {voiceChannels.length === 0 && (
          <div className="px-2 py-1 text-xs text-textMuted/70">
            No voice channels yet
          </div>
        )}
        {voiceChannels.map((c) => {
          const count = voiceCounts[c.id] ?? 0;
          const inThis = voice?.channelId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => selectChannel(c.id)}
              className={`group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
                inThis
                  ? 'bg-success/10 text-success'
                  : 'text-textSoft hover:bg-bgPanelHi hover:text-textMain'
              }`}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="shrink-0"
              >
                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
              </svg>
              <span className="truncate flex-1">{c.name}</span>
              {count > 0 && (
                <span className="text-xs text-textMuted">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* user card */}
      <div className="relative">
        <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex items-center gap-2.5 bg-bgDeep px-2 py-2">
          <div className="relative">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-grad text-xs font-bold text-bgDeep">
              {user?.displayName?.[0]?.toUpperCase() ?? '?'}
            </div>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success ring-2 ring-bgDeep" />
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
      </div>
    </aside>
  );
}

function CategoryHeader({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => void;
}) {
  return (
    <div className="group mb-1 flex items-center justify-between px-2 text-[10px] font-bold uppercase tracking-wider text-textMuted">
      <span>{label}</span>
      <button
        onClick={onAdd}
        className="rounded p-0.5 opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
        title={`Add ${label.toLowerCase()}`}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  );
}

function ChannelButton({
  active,
  icon,
  name,
  onClick,
}: {
  active: boolean;
  icon: string;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors ${
        active
          ? 'bg-bgPanelHi text-white shadow-inner-shine'
          : 'text-textSoft hover:bg-bgPanelHi/60 hover:text-textMain'
      }`}
    >
      <span className="text-textMuted">{icon}</span>
      <span className="truncate">{name}</span>
    </button>
  );
}
