import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServersService } from '../servers/servers.service';
import { CreateChannelDto } from './dto/create-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly servers: ServersService,
  ) {}

  async create(userId: string, serverId: string, dto: CreateChannelDto) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
    });
    if (!server) throw new NotFoundException('Server not found');
    if (server.ownerId !== userId) {
      throw new ForbiddenException('Only owner can create channels (MVP)');
    }

    const last = await this.prisma.channel.findFirst({
      where: { serverId },
      orderBy: { position: 'desc' },
    });
    const position = (last?.position ?? -1) + 1;

    return this.prisma.channel.create({
      data: {
        serverId,
        name: dto.name,
        type: dto.type ?? 'TEXT',
        topic: dto.topic,
        position,
      },
    });
  }

  async assertCanRead(userId: string, channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    await this.servers.assertMembership(userId, channel.serverId);
    return channel;
  }
}
