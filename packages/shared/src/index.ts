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

// ============= WebSocket events =============

export const WS_EVENTS = {
  // server -> client
  MESSAGE_NEW: "message:new",
  MESSAGE_EDIT: "message:edit",
  MESSAGE_DELETE: "message:delete",
  TYPING: "channel:typing",
  PRESENCE_UPDATE: "presence:update",

  // client -> server
  JOIN_CHANNEL: "channel:join",
  LEAVE_CHANNEL: "channel:leave",
  TYPING_START: "channel:typing:start",
} as const;

export interface WsMessageNewPayload {
  message: MessageDto;
}

export interface WsTypingPayload {
  channelId: string;
  userId: string;
  username: string;
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
