'use client';

import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function VoicePanel() {
  const { voice, leaveVoice, toggleMute } = useApp();
  const { user } = useAuth();

  if (!voice) return null;

  // build participant list (self + remote peers)
  const selfView = {
    socketId: 'self',
    userId: user?.id ?? '',
    displayName: user?.displayName ?? 'You',
    username: user?.username ?? '',
    avatarUrl: user?.avatarUrl ?? null,
    muted: voice.muted,
    speaking: false,
    isSelf: true,
  };
  const peers = [
    selfView,
    ...voice.peers.map((p) => ({
      socketId: p.socketId,
      userId: p.userId,
      displayName: p.displayName,
      username: p.username,
      avatarUrl: p.avatarUrl,
      muted: p.muted,
      speaking: p.speaking,
      isSelf: false,
    })),
  ];

  return (
    <aside className="relative z-10 flex h-full w-72 flex-col border-l border-border bg-bgPanel">
      {/* header */}
      <header className="relative flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-success/15 text-success">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-white">
            {voice.channelName}
          </div>
          <div className="text-[11px] text-success flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
            Voice connected · {peers.length}{' '}
            {peers.length === 1 ? 'person' : 'people'}
          </div>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-success/30 to-transparent" />
      </header>

      {/* participants */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-2 gap-2.5">
          {peers.map((p) => (
            <ParticipantTile key={p.socketId} p={p} />
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="relative border-t border-border bg-bgDeep p-3">
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={toggleMute}
            className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
              voice.muted
                ? 'border-danger/40 bg-danger/15 text-danger hover:bg-danger/25'
                : 'border-border bg-bgPanelHi text-textMain hover:border-accent/40 hover:text-accent'
            }`}
            title={voice.muted ? 'Unmute' : 'Mute'}
          >
            {voice.muted ? (
              // mic-off icon
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              // mic icon
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          <button
            onClick={leaveVoice}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-danger text-white shadow-[0_0_16px_rgba(248,113,113,0.4)] transition-transform hover:scale-105"
            title="Disconnect"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path
                d="M16.92 12.06a8 8 0 0 0-9.84 0M22 8.5C16.5 3.5 7.5 3.5 2 8.5"
                transform="rotate(135 12 12)"
              />
            </svg>
          </button>
        </div>
        <div className="mt-2 text-center text-[11px] text-textMuted">
          {voice.muted ? 'Microphone muted' : 'Microphone open'}
        </div>
      </div>
    </aside>
  );
}

function ParticipantTile({
  p,
}: {
  p: {
    socketId: string;
    displayName: string;
    avatarUrl: string | null;
    muted: boolean;
    speaking: boolean;
    isSelf: boolean;
  };
}) {
  return (
    <div
      className={`relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border bg-gradient-to-br p-3 transition-all ${
        p.speaking
          ? 'border-success/60 from-success/10 to-bgPanel shadow-[0_0_20px_rgba(52,211,153,0.25)]'
          : 'border-border from-bgPanelHi to-bgPanel'
      }`}
    >
      <div className={`relative ${p.speaking ? 'speaking' : ''} rounded-full`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark text-base font-bold text-bgDeep ring-1 ring-accent/20">
          {p.displayName[0]?.toUpperCase() ?? '?'}
        </div>
        {p.muted && (
          <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-danger text-white ring-2 ring-bgPanel">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            </svg>
          </div>
        )}
      </div>
      <div className="w-full truncate text-center text-xs font-medium text-white">
        {p.displayName}
        {p.isSelf && (
          <span className="ml-1 text-textMuted">(you)</span>
        )}
      </div>
    </div>
  );
}
