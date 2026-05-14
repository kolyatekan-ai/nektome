'use client';

import { useEffect, useRef } from 'react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

/**
 * Renders incoming/outgoing call notifications in the bottom-right corner,
 * plus plays a synthetic ringtone via WebAudio (no asset file needed).
 */
export default function CallToasts() {
  const {
    incomingCall,
    outgoingCall,
    acceptIncomingCall,
    declineIncomingCall,
    cancelOutgoingCall,
  } = useApp();
  const { user } = useAuth();

  // ringtone audio context — only when there's an active toast
  useRingtone(!!incomingCall, 'ring');
  useRingtone(!!outgoingCall, 'tone');

  if (!incomingCall && !outgoingCall) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-end p-6">
      <div className="pointer-events-auto flex flex-col gap-3">
        {incomingCall && (
          <div className="glass titanium-border flex w-[340px] items-center gap-3 rounded-2xl p-3 shadow-glow">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark text-base font-bold text-bgDeep ring-1 ring-accent/30 speaking">
                {incomingCall.fromDisplayName[0]?.toUpperCase() ?? '?'}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-accent">
                Incoming call
              </div>
              <div className="truncate font-semibold text-white">
                {incomingCall.fromDisplayName}
              </div>
              <div className="truncate text-xs text-textMuted">
                @{incomingCall.fromUsername}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => user && acceptIncomingCall(user.id)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-success text-white shadow-[0_0_12px_rgba(52,211,153,0.4)] transition-transform hover:scale-105"
                title="Accept"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
              <button
                onClick={declineIncomingCall}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
                title="Decline"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M16.92 12.06a8 8 0 0 0-9.84 0M22 8.5C16.5 3.5 7.5 3.5 2 8.5" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {outgoingCall && (
          <div className="glass titanium-border flex w-[340px] items-center gap-3 rounded-2xl p-3">
            <div className="relative">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark text-base font-bold text-bgDeep ring-1 ring-accent/30">
                {outgoingCall.toDisplayName[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-bgPanel ring-2 ring-bgDeep">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs uppercase tracking-wider text-textMuted">
                Calling…
              </div>
              <div className="truncate font-semibold text-white">
                {outgoingCall.toDisplayName}
              </div>
            </div>
            <button
              onClick={cancelOutgoingCall}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-danger text-white transition-transform hover:scale-105"
              title="Cancel"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="6" y1="18" x2="18" y2="6" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Synthesise a simple ringtone via WebAudio: two-tone "ring ring" pattern.
 * Mode 'ring' = louder/dual-tone for incoming. Mode 'tone' = single dial-tone for outgoing.
 */
function useRingtone(active: boolean, mode: 'ring' | 'tone') {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) return;

    const startCtx = () => {
      try {
        const Ctx =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        ctxRef.current = new Ctx();
      } catch {
        return;
      }
    };
    startCtx();
    const ctx = ctxRef.current;
    if (!ctx) return;

    const playRing = () => {
      if (!ctx) return;
      const now = ctx.currentTime;
      const dur = mode === 'ring' ? 0.8 : 0.3;
      // dual oscillators for richer "telephone" sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.frequency.value = mode === 'ring' ? 480 : 440;
      osc2.frequency.value = mode === 'ring' ? 620 : 480;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
      gain.gain.linearRampToValueAtTime(0.12, now + dur - 0.04);
      gain.gain.linearRampToValueAtTime(0, now + dur);
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);
      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + dur);
      osc2.stop(now + dur);
    };

    playRing();
    intervalRef.current = setInterval(
      playRing,
      mode === 'ring' ? 2200 : 1600,
    );

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      try {
        ctxRef.current?.close();
      } catch {
        /* */
      }
      ctxRef.current = null;
    };
  }, [active, mode]);
}
