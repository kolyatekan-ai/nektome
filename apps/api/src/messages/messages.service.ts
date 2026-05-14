import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelsService } from '../channels/channels.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly channels: ChannelsService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async list(userId: string, channelId: string, before?: string, limit = 50) {
    await this.channels.assertCanRead(userId, channelId);

    const take = Math.min(Math.max(limit, 1), 100);
    const cursor = before ? { id: before } : undefined;

    const messages = await this.prisma.message.findMany({
      where: { channelId },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor, skip: 1 } : {}),
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    // return chronological order (oldest first) for convenient UI rendering
    return messages.reverse();
  }

  async create(userId: string, channelId: string, dto: CreateMessageDto) {
    await this.channels.assertCanRead(userId, channelId);

    const message = await this.prisma.message.create({
      data: {
        channelId,
        authorId: userId,
        content: dto.content,
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    this.gateway.broadcastNewMessage(channelId, message);
    return message;
  }

  async update(userId: string, messageId: string, content: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException();
    if (msg.authorId !== userId) {
      throw new ForbiddenException('Cannot edit another user message');
    }

    const updated = await this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            status: true,
          },
        },
      },
    });

    this.gateway.broadcastEditMessage(updated.channelId, updated);
    return updated;
  }

  async remove(userId: string, messageId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException();
    if (msg.authorId !== userId) {
      throw new ForbiddenException('Cannot delete another user message');
    }

    await this.prisma.message.delete({ where: { id: messageId } });
    this.gateway.broadcastDeleteMessage(msg.channelId, messageId);
    return { ok: true };
  }
}
