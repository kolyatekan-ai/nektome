'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function ChatView() {
  const {
    activeServer,
    activeChannelId,
    messages,
    typing,
    sendMessage,
    notifyTyping,
  } = useApp();
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastTypingSent = useRef(0);

  const channel = useMemo(
    () => activeServer?.channels.find((c) => c.id === activeChannelId),
    [activeServer, activeChannelId],
  );

  const channelMessages = activeChannelId
    ? messages[activeChannelId] ?? []
    : [];

  const channelTyping = activeChannelId ? typing[activeChannelId] ?? [] : [];
  const activeTypers = channelTyping.filter(
    (t) => now - t.ts < 5000 && t.userId !== user?.id,
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [channelMessages.length]);

  if (!channel) {
    return (
      <main className="relative z-10 flex flex-1 items-center justify-center bg-bgChat">
        <div className="text-center">
          <div className="mb-3 text-3xl">💬</div>
          <div className="text-textMuted">Select a channel to start chatting</div>
        </div>
      </main>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || !activeChannelId) return;
    setInput('');
    try {
      await sendMessage(activeChannelId, text);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function onChange(value: string) {
    setInput(value);
    if (!activeChannelId) return;
    const t = Date.now();
    if (t - lastTypingSent.current > 3000) {
      lastTypingSent.current = t;
      notifyTyping(activeChannelId);
    }
  }

  return (
    <main className="relative z-10 flex flex-1 flex-col bg-bgChat">
      <header className="relative flex h-14 items-center gap-2 border-b border-border px-5">
        <span className="text-textMuted text-lg">#</span>
        <span className="font-semibold text-white">{channel.name}</span>
        {channel.topic && (
          <>
            <span className="mx-2 h-4 w-px bg-border" />
            <span className="text-sm text-textMuted">{channel.topic}</span>
          </>
        )}
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/15 to-transparent" />
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {channelMessages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-2xl border border-border bg-bgPanel/40 px-6 py-4 text-center text-textMuted">
              <div className="text-3xl mb-2">✨</div>
              <div>No messages yet</div>
              <div className="text-xs mt-1">Be the first to write something!</div>
            </div>
          </div>
        )}
        {channelMessages.map((m, i) => {
          const prev = channelMessages[i - 1];
          const sameAuthorAsPrev =
            prev &&
            prev.authorId === m.authorId &&
            new Date(m.createdAt).getTime() -
              new Date(prev.createdAt).getTime() <
              5 * 60 * 1000;

          return (
            <div
              key={m.id}
              className={`group flex gap-3 rounded-md px-2 ${
                sameAuthorAsPrev ? 'mt-0.5' : 'mt-4'
              } hover:bg-bgPanel/40`}
            >
              <div className="w-10 shrink-0 pt-0.5">
                {!sameAuthorAsPrev && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark text-sm font-bold text-bgDeep ring-1 ring-accent/20">
                    {m.author.displayName[0]?.toUpperCase() ?? '?'}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {!sameAuthorAsPrev && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-medium text-white">
                      {m.author.displayName}
                    </span>
                    <span className="text-xs text-textMuted">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words text-textMain">
                  {m.content}
                  {m.editedAt && (
                    <span className="ml-1 text-[11px] text-textMuted">
                      (edited)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5 pb-1 text-xs text-textMuted h-5">
        {activeTypers.length > 0 && (
          <span className="flex items-center gap-1.5">
            <span className="flex gap-0.5">
              <span
                className="h-1 w-1 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: '0ms' }}
              />
              <span
                className="h-1 w-1 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: '200ms' }}
              />
              <span
                className="h-1 w-1 animate-pulse rounded-full bg-accent"
                style={{ animationDelay: '400ms' }}
              />
            </span>
            <span>
              {activeTypers.map((t) => t.username).join(', ')}{' '}
              {activeTypers.length === 1 ? 'is' : 'are'} typing…
            </span>
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} className="px-5 pb-5">
        <div className="relative">
          <input
            value={input}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Message #${channel.name}`}
            className="w-full rounded-xl border border-border bg-bgInput px-4 py-3.5 text-textMain shadow-panel outline-none transition-colors placeholder:text-textMuted focus:border-accent/40 focus:bg-bgPanel"
          />
        </div>
      </form>
    </main>
  );
}
