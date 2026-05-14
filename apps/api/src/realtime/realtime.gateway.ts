import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../auth/jwt.strategy';

interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
    username?: string;
    displayName?: string;
    avatarUrl?: string | null;
    voiceChannelId?: string | null;
    muted?: boolean;
  };
}

interface VoiceParticipant {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  socketId: string;
  muted: boolean;
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
  // Allow both transports for stability behind Render's proxy
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

  // In-memory voice room registry: channelId -> Map<socketId, VoiceParticipant>
  // (acceptable for single-instance free-tier; for HA migrate to Redis)
  private voiceRooms = new Map<string, Map<string, VoiceParticipant>>();

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // ===== connection lifecycle =====

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.query?.token as string | undefined);

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? 'dev_access_secret',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
        },
      });
      if (!user) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.username = user.username;
      client.data.displayName = user.displayName;
      client.data.avatarUrl = user.avatarUrl;
      client.data.muted = false;
      client.data.voiceChannelId = null;

      // Auto-join all channel rooms the user is a member of
      const memberships = await this.prisma.member.findMany({
        where: { userId: user.id },
        include: { server: { include: { channels: true } } },
      });

      for (const m of memberships) {
        await client.join(`server:${m.serverId}`);
        for (const ch of m.server.channels) {
          await client.join(`channel:${ch.id}`);
        }
      }
      await client.join(`user:${user.id}`);

      this.logger.log(
        `Connected ${user.username} (${user.id}) — joined ${memberships.length} servers`,
      );
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.userId) {
      // remove from voice room if was in one
      this.removeFromVoice(client);
      this.logger.log(`Disconnected ${client.data.username}`);
    }
  }

  // ===== text chat events =====

  @SubscribeMessage('channel:join')
  async onJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data.userId) return;
    const channel = await this.prisma.channel.findUnique({
      where: { id: data.channelId },
    });
    if (!channel) return;
    const member = await this.prisma.member.findUnique({
      where: {
        userId_serverId: {
          userId: client.data.userId,
          serverId: channel.serverId,
        },
      },
    });
    if (!member) return;
    await client.join(`channel:${data.channelId}`);
  }

  @SubscribeMessage('channel:leave')
  async onLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    await client.leave(`channel:${data.channelId}`);
  }

  @SubscribeMessage('channel:typing:start')
  async onTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data.userId) return;
    client.to(`channel:${data.channelId}`).emit('channel:typing', {
      channelId: data.channelId,
      userId: client.data.userId,
      username: client.data.displayName ?? client.data.username,
    });
  }

  // ===== text broadcast helpers =====

  broadcastNewMessage(channelId: string, message: unknown) {
    this.server.to(`channel:${channelId}`).emit('message:new', { message });
  }
  broadcastEditMessage(channelId: string, message: unknown) {
    this.server.to(`channel:${channelId}`).emit('message:edit', { message });
  }
  broadcastDeleteMessage(channelId: string, messageId: string) {
    this.server
      .to(`channel:${channelId}`)
      .emit('message:delete', { channelId, messageId });
  }

  // ===== DM CALLS (1-to-1, ringing flow) =====

  @SubscribeMessage('call:invite')
  async onCallInvite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { toUserId: string; channelId: string },
  ) {
    if (!client.data.userId) return;
    // forward an incoming-call notification to all sockets of that user
    this.server.to(`user:${data.toUserId}`).emit('call:incoming', {
      fromUserId: client.data.userId,
      fromUsername: client.data.username,
      fromDisplayName: client.data.displayName,
      fromAvatarUrl: client.data.avatarUrl ?? null,
      channelId: data.channelId,
      // a unique call id for the toast (we just reuse channelId in MVP)
      callId: data.channelId,
    });
  }

  @SubscribeMessage('call:cancel')
  async onCallCancel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { toUserId: string; channelId: string },
  ) {
    if (!client.data.userId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:cancelled', {
      fromUserId: client.data.userId,
      channelId: data.channelId,
    });
  }

  @SubscribeMessage('call:decline')
  async onCallDecline(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { toUserId: string; channelId: string },
  ) {
    if (!client.data.userId) return;
    this.server.to(`user:${data.toUserId}`).emit('call:declined', {
      fromUserId: client.data.userId,
      channelId: data.channelId,
    });
  }

  // ===== VOICE =====

  @SubscribeMessage('voice:join')
  async onVoiceJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string; isDM?: boolean },
  ) {
    if (!client.data.userId) return;

    // DM call rooms have a synthetic id like "dm:userA:userB" (sorted).
    // No DB membership check — we authorize by the fact that the inviter sent
    // call:invite and the invitee accepted. For server channels we still check.
    const isDM =
      !!data.isDM || data.channelId.startsWith('dm:');

    if (!isDM) {
      const channel = await this.prisma.channel.findUnique({
        where: { id: data.channelId },
      });
      if (!channel) return;
      const member = await this.prisma.member.findUnique({
        where: {
          userId_serverId: {
            userId: client.data.userId,
            serverId: channel.serverId,
          },
        },
      });
      if (!member) return;
    }

    // leave previous voice channel if any
    if (client.data.voiceChannelId && client.data.voiceChannelId !== data.channelId) {
      this.removeFromVoice(client);
    }

    client.data.voiceChannelId = data.channelId;
    client.data.muted = false;

    const participant: VoiceParticipant = {
      userId: client.data.userId,
      username: client.data.username ?? 'unknown',
      displayName: client.data.displayName ?? client.data.username ?? 'unknown',
      avatarUrl: client.data.avatarUrl ?? null,
      socketId: client.id,
      muted: false,
    };

    let room = this.voiceRooms.get(data.channelId);
    if (!room) {
      room = new Map();
      this.voiceRooms.set(data.channelId, room);
    }
    room.set(client.id, participant);

    await client.join(`voice:${data.channelId}`);

    // send list of EXISTING peers to the joiner (so they create offers)
    const existingPeers = Array.from(room.values()).filter(
      (p) => p.socketId !== client.id,
    );
    client.emit('voice:peers', {
      channelId: data.channelId,
      participants: existingPeers,
    });

    // notify others that a new peer joined
    client.to(`voice:${data.channelId}`).emit('voice:peer-joined', {
      channelId: data.channelId,
      participant,
    });

    // also broadcast to the server room so UI can show count beside the channel
    if (!isDM) {
      const ch = await this.prisma.channel.findUnique({
        where: { id: data.channelId },
        select: { serverId: true },
      });
      if (ch) {
        this.server.to(`server:${ch.serverId}`).emit('voice:state', {
          channelId: data.channelId,
          participants: Array.from(room.values()),
        });
      }
    }
  }

  @SubscribeMessage('voice:leave')
  async onVoiceLeave(@ConnectedSocket() client: AuthenticatedSocket) {
    this.removeFromVoice(client);
  }

  @SubscribeMessage('voice:mute')
  async onVoiceMute(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { muted: boolean },
  ) {
    if (!client.data.voiceChannelId) return;
    const room = this.voiceRooms.get(client.data.voiceChannelId);
    if (!room) return;
    const me = room.get(client.id);
    if (!me) return;
    me.muted = !!data.muted;
    client.data.muted = me.muted;
    client
      .to(`voice:${client.data.voiceChannelId}`)
      .emit('voice:peer-muted', {
        channelId: client.data.voiceChannelId,
        socketId: client.id,
        muted: me.muted,
      });
  }

  @SubscribeMessage('voice:signal')
  async onVoiceSignal(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      channelId: string;
      toSocketId: string;
      signal: unknown;
    },
  ) {
    if (!client.data.voiceChannelId) return;
    if (client.data.voiceChannelId !== data.channelId) return;
    // forward signal to the target socket
    this.server.to(data.toSocketId).emit('voice:signal', {
      channelId: data.channelId,
      fromSocketId: client.id,
      toSocketId: data.toSocketId,
      signal: data.signal,
    });
  }

  @SubscribeMessage('voice:speaking')
  async onVoiceSpeaking(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { speaking: boolean },
  ) {
    if (!client.data.voiceChannelId) return;
    client
      .to(`voice:${client.data.voiceChannelId}`)
      .emit('voice:speaking', {
        channelId: client.data.voiceChannelId,
        socketId: client.id,
        speaking: !!data.speaking,
      });
  }

  private removeFromVoice(client: AuthenticatedSocket) {
    const channelId = client.data.voiceChannelId;
    if (!channelId) return;

    const room = this.voiceRooms.get(channelId);
    if (room) {
      room.delete(client.id);
      if (room.size === 0) {
        this.voiceRooms.delete(channelId);
      }
    }

    client.to(`voice:${channelId}`).emit('voice:peer-left', {
      channelId,
      socketId: client.id,
    });
    client.leave(`voice:${channelId}`);

    // broadcast updated count to server room
    this.prisma.channel
      .findUnique({ where: { id: channelId } })
      .then((ch) => {
        if (ch) {
          this.server.to(`server:${ch.serverId}`).emit('voice:state', {
            channelId,
            participants: room ? Array.from(room.values()) : [],
          });
        }
      })
      .catch(() => undefined);

    client.data.voiceChannelId = null;
    client.data.muted = false;
  }
}
