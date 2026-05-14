// ============= Shared types between API and Web =============

export interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: UserStatus;
}

export type UserStatus = "ONLINE" | "IDLE" | "DND" | "OFFLINE";

export interface ServerDto {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  inviteCode: string;
  createdAt: string;
}

export type ChannelType = "TEXT" | "VOICE" | "CATEGORY" | "DM";

export interface ChannelDto {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  position: number;
  topic: string | null;
}

export interface MessageDto {
  id: string;
  channelId: string;
  authorId: string;
  author: UserPublic;
  content: string;
  editedAt: string | null;
  createdAt: string;
}

// ============= Voice =============

export interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  socketId: string;
  muted: boolean;
}

// ============= WebSocket events =============

export const WS_EVENTS = {
  // text chat
  MESSAGE_NEW: "message:new",
  MESSAGE_EDIT: "message:edit",
  MESSAGE_DELETE: "message:delete",
  TYPING: "channel:typing",
  PRESENCE_UPDATE: "presence:update",
  JOIN_CHANNEL: "channel:join",
  LEAVE_CHANNEL: "channel:leave",
  TYPING_START: "channel:typing:start",

  // voice
  VOICE_JOIN: "voice:join",
  VOICE_LEAVE: "voice:leave",
  VOICE_MUTE: "voice:mute",
  VOICE_PEERS: "voice:peers",
  VOICE_PEER_JOINED: "voice:peer-joined",
  VOICE_PEER_LEFT: "voice:peer-left",
  VOICE_PEER_MUTED: "voice:peer-muted",
  VOICE_SIGNAL: "voice:signal",
  VOICE_SPEAKING: "voice:speaking",
} as const;

export interface WsMessageNewPayload {
  message: MessageDto;
}

export interface WsTypingPayload {
  channelId: string;
  userId: string;
  username: string;
}

export interface VoiceSignalPayload {
  channelId: string;
  fromSocketId: string;
  toSocketId: string;
  signal:
    | { type: "offer" | "answer"; sdp: string }
    | { type: "ice"; candidate: RTCIceCandidateInit };
}

export interface VoicePeerJoinedPayload {
  channelId: string;
  participant: VoiceParticipant;
}

export interface VoicePeersPayload {
  channelId: string;
  participants: VoiceParticipant[];
}

// ============= Auth DTOs =============

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserPublic;
}
