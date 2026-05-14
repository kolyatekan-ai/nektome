'use client';

import { useEffect, useRef } from 'react';
import { useApp } from '@/store/app';
import { useAuth } from '@/store/auth';

export default function VoicePanel() {
  const {
    voice,
    leaveVoice,
    toggleMute,
    toggleCamera,
    toggleScreen,
  } = useApp();
  const { user } = useAuth();

  if (!voice) return null;

  // build list: self first, then peers
  const tiles: TileData[] = [
    {
      key: 'self',
      isSelf: true,
      socketId: 'self',
      displayName: user?.displayName ?? 'You',
      muted: voice.muted,
      speaking: false,
      cameraTrack: voice.localCameraTrack,
      screenTrack: voice.localScreenTrack,
      hasVideo: voice.cameraOn,
      hasScreen: voice.screenOn,
    },
    ...voice.peers.map((p) => {
      const cameraTrack =
        p.stream?.getVideoTracks().find((t) => t.contentHint !== 'screen') ??
        null;
      const screenTrack =
        p.stream?.getVideoTracks().find((t) => t.contentHint === 'screen') ??
        null;
      return {
        key: p.socketId,
        isSelf: false,
        socketId: p.socketId,
        displayName: p.displayName,
        muted: p.muted,
        speaking: p.speaking,
        cameraTrack,
        screenTrack,
        hasVideo: p.hasVideo,
        hasScreen: p.hasScreen,
      };
    }),
  ];

  // when someone is screen-sharing, show their screen as a big tile and rest as small
  const screenTile = tiles.find((t) => t.hasScreen && t.screenTrack);

  return (
    <aside
      className={`relative z-10 flex h-full flex-col border-l border-border bg-bgPanel ${
        voice.cameraOn || voice.screenOn || tiles.some((t) => t.hasVideo || t.hasScreen)
          ? 'w-[480px]'
          : 'w-72'
      }`}
    >
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
            {voice.isDM ? `Call: ${voice.channelName}` : voice.channelName}
          </div>
          <div className="text-[11px] text-success flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-soft" />
            Connected · {tiles.length}{' '}
            {tiles.length === 1 ? 'person' : 'people'}
          </div>
        </div>
        <span className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-success/30 to-transparent" />
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {screenTile ? (
          <div className="space-y-3">
            <ScreenTile tile={screenTile} />
            <div className="grid grid-cols-3 gap-2">
              {tiles.map((t) => (
                <ParticipantTile key={t.key} t={t} compact />
              ))}
            </div>
          </div>
        ) : (
          <div
            className={`grid gap-2.5 ${
              tiles.length <= 1
                ? 'grid-cols-1'
                : tiles.length <= 4
                ? 'grid-cols-2'
                : 'grid-cols-3'
            }`}
          >
            {tiles.map((t) => (
              <ParticipantTile key={t.key} t={t} />
            ))}
          </div>
        )}
      </div>

      {/* control bar */}
      <div className="relative border-t border-border bg-bgDeep p-3">
        <div className="flex items-center justify-center gap-2.5">
          <ControlButton
            active={!voice.muted}
            danger={voice.muted}
            onClick={toggleMute}
            title={voice.muted ? 'Unmute' : 'Mute'}
          >
            {voice.muted ? <IconMicOff /> : <IconMic />}
          </ControlButton>

          <ControlButton
            active={voice.cameraOn}
            onClick={toggleCamera}
            title={voice.cameraOn ? 'Stop camera' : 'Start camera'}
          >
            {voice.cameraOn ? <IconVideo /> : <IconVideoOff />}
          </ControlButton>

          <ControlButton
            active={voice.screenOn}
            onClick={toggleScreen}
            title={voice.screenOn ? 'Stop sharing' : 'Share screen'}
          >
            <IconScreen />
          </ControlButton>

          <button
            onClick={leaveVoice}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-danger text-white shadow-[0_0_16px_rgba(248,113,113,0.4)] transition-transform hover:scale-105"
            title="Disconnect"
          >
            <IconPhoneEnd />
          </button>
        </div>
      </div>
    </aside>
  );
}

interface TileData {
  key: string;
  isSelf: boolean;
  socketId: string;
  displayName: string;
  muted: boolean;
  speaking: boolean;
  cameraTrack: MediaStreamTrack | null;
  screenTrack: MediaStreamTrack | null;
  hasVideo: boolean;
  hasScreen: boolean;
}

function ParticipantTile({
  t,
  compact = false,
}: {
  t: TileData;
  compact?: boolean;
}) {
  return (
    <div
      className={`relative flex aspect-video flex-col items-center justify-center overflow-hidden rounded-xl border bg-gradient-to-br p-3 transition-all ${
        t.speaking
          ? 'border-success/60 from-success/10 to-bgPanel shadow-[0_0_20px_rgba(52,211,153,0.25)]'
          : 'border-border from-bgPanelHi to-bgPanel'
      }`}
    >
      {t.hasVideo && t.cameraTrack ? (
        <VideoTrackElement
          track={t.cameraTrack}
          muted={t.isSelf}
          mirror={t.isSelf}
        />
      ) : (
        <div
          className={`flex flex-col items-center justify-center ${
            compact ? 'gap-1' : 'gap-2'
          }`}
        >
          <div
            className={`relative ${t.speaking ? 'speaking' : ''} rounded-full`}
          >
            <div
              className={`flex items-center justify-center rounded-full bg-gradient-to-br from-accent to-accentDark font-bold text-bgDeep ring-1 ring-accent/20 ${
                compact ? 'h-9 w-9 text-sm' : 'h-14 w-14 text-base'
              }`}
            >
              {t.displayName[0]?.toUpperCase() ?? '?'}
            </div>
          </div>
        </div>
      )}

      {/* overlay name + mic */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center gap-1">
        {t.muted && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white">
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
            >
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            </svg>
          </span>
        )}
        <span className="rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white truncate max-w-full">
          {t.displayName}
          {t.isSelf && ' (you)'}
        </span>
      </div>
    </div>
  );
}

function ScreenTile({ tile }: { tile: TileData }) {
  if (!tile.screenTrack) return null;
  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-black shadow-glow-sm">
      <VideoTrackElement track={tile.screenTrack} muted={tile.isSelf} />
      <div className="absolute left-3 top-3 flex items-center gap-2 rounded-md bg-black/60 px-2 py-1 text-xs text-white">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse-soft" />
        Screen of {tile.displayName}
        {tile.isSelf && ' (you)'}
      </div>
    </div>
  );
}

function VideoTrackElement({
  track,
  muted,
  mirror,
}: {
  track: MediaStreamTrack;
  muted: boolean;
  mirror?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stream = new MediaStream([track]);
    el.srcObject = stream;
    el.play().catch(() => undefined);
  }, [track]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`absolute inset-0 h-full w-full object-cover ${
        mirror ? 'scale-x-[-1]' : ''
      }`}
    />
  );
}

function ControlButton({
  children,
  onClick,
  active,
  danger,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
        danger
          ? 'border-danger/40 bg-danger/15 text-danger hover:bg-danger/25'
          : active
          ? 'border-accent/40 bg-accent/15 text-accent hover:bg-accent/25'
          : 'border-border bg-bgPanelHi text-textMain hover:border-accent/40 hover:text-accent'
      }`}
    >
      {children}
    </button>
  );
}

function IconMic() {
  return (
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
  );
}
function IconMicOff() {
  return (
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
  );
}
function IconVideo() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}
function IconVideoOff() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
function IconScreen() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polyline points="9 10 12 7 15 10" />
      <line x1="12" y1="7" x2="12" y2="14" />
    </svg>
  );
}
function IconPhoneEnd() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path d="M16.92 12.06a8 8 0 0 0-9.84 0M22 8.5C16.5 3.5 7.5 3.5 2 8.5" />
    </svg>
  );
}
