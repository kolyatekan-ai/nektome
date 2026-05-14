'use client';

import { useState } from 'react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';
import type { UserPublic } from '@burmalda/shared';

/**
 * Members popover — shown when user clicks the "members" button in the chat
 * header. Each member has a "📞 call" button that initiates a 1-to-1 voice call.
 */
export default function MembersDrawer({ onClose }: { onClose: () => void }) {
  const { activeServer, startDmCall } = useApp();
  const { user } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (!activeServer) return null;

  const members = activeServer.members
    .filter((m) => m.userId !== user?.id)
    .map((m) => m.user);

  async function call(target: UserPublic) {
    if (!user) return;
    setBusy(target.id);
    try {
      await startDmCall(target, user.id);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="absolute right-0 top-14 z-30 w-72 overflow-hidden rounded-xl border border-border bg-bgPanel shadow-panel">
      <div className="border-b border-border px-3 py-2 text-xs font-bold uppercase tracking-wider text-textSoft">
        Members ({members.length})
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-1.5">
        {members.length === 0 && (
          <div className="px-3 py-4 text-center text-sm text-textMuted">
            No other members yet — invite someone!
          </div>
        )}
        {members.map((m) => (
          <div
            key={m.id}
            className="group flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-bgPanelHi"
          >
            <div className="relative">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark text-xs font-bold text-bgDeep">
                {m.displayName[0]?.toUpperCase() ?? '?'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-textMain">
                {m.displayName}
              </div>
              <div className="truncate text-xs text-textMuted">
                @{m.username}
              </div>
            </div>
            <button
              onClick={() => call(m)}
              disabled={busy === m.id}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-success/15 text-success opacity-0 transition-all hover:bg-success/25 group-hover:opacity-100 disabled:opacity-40"
              title={`Call ${m.displayName}`}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
