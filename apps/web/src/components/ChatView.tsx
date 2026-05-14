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

  // tick to expire typing indicators
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [channelMessages.length]);

  if (!channel) {
    return (
      <main className="flex flex-1 items-center justify-center bg-bgChat text-textMuted">
        Select a channel to start chatting
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
    <main className="flex flex-1 flex-col bg-bgChat">
      <header className="flex h-12 items-center gap-2 border-b border-black/30 px-4 shadow-sm">
        <span className="text-textMuted">#</span>
        <span className="font-semibold text-white">{channel.name}</span>
        {channel.topic && (
          <>
            <span className="mx-2 text-textMuted">|</span>
            <span className="text-sm text-textMuted">{channel.topic}</span>
          </>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {channelMessages.length === 0 && (
          <div className="text-textMuted">No messages yet — be the first!</div>
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
              className={`flex gap-3 ${
                sameAuthorAsPrev ? 'mt-0.5' : 'mt-4'
              } hover:bg-black/10`}
            >
              <div className="w-10 shrink-0">
                {!sameAuthorAsPrev && (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
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
                    <span className="ml-1 text-xs text-textMuted">
                      (edited)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-1 text-xs text-textMuted">
        {activeTypers.length > 0 && (
          <span>
            {activeTypers.map((t) => t.username).join(', ')}{' '}
            {activeTypers.length === 1 ? 'is' : 'are'} typing…
          </span>
        )}
        &nbsp;
      </div>

      <form onSubmit={onSubmit} className="px-4 pb-4">
        <input
          value={input}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Message #${channel.name}`}
          className="w-full rounded-lg bg-bgInput px-4 py-3 text-textMain outline-none placeholder:text-textMuted"
        />
      </form>
    </main>
  );
}
