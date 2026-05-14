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
  };
}

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(RealtimeGateway.name);

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

      client.data.userId = payload.sub;
      client.data.username = payload.username;

      // Auto-join all channel rooms the user is a member of
      const memberships = await this.prisma.member.findMany({
        where: { userId: payload.sub },
        include: { server: { include: { channels: true } } },
      });

      for (const m of memberships) {
        await client.join(`server:${m.serverId}`);
        for (const ch of m.server.channels) {
          await client.join(`channel:${ch.id}`);
        }
      }
      await client.join(`user:${payload.sub}`);

      this.logger.log(
        `Connected ${payload.username} (${payload.sub}) — joined ${memberships.length} servers`,
      );
    } catch (err) {
      this.logger.warn(`WS auth failed: ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    if (client.data.userId) {
      this.logger.log(`Disconnected ${client.data.username}`);
    }
  }

  // ===== client -> server events =====

  @SubscribeMessage('channel:join')
  async onJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { channelId: string },
  ) {
    if (!client.data.userId) return;
    // Verify membership before joining the room
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
      username: client.data.username,
    });
  }

  // ===== server-side broadcast helpers (called from MessagesService) =====

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
}
