import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto } from './dto/create-server.dto';

@Injectable()
export class ServersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a server with default channel #general and @everyone role.
   * Owner is automatically added as a Member.
   */
  async create(userId: string, dto: CreateServerDto) {
    return this.prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name: dto.name,
          ownerId: userId,
        },
      });

      await tx.channel.create({
        data: {
          serverId: server.id,
          name: 'general',
          type: 'TEXT',
          position: 0,
        },
      });

      await tx.role.create({
        data: {
          serverId: server.id,
          name: '@everyone',
          color: '#99AAB5',
          position: 0,
          permissions: BigInt(0b11), // VIEW_CHANNEL | SEND_MESSAGES
        },
      });

      await tx.member.create({
        data: { userId, serverId: server.id },
      });

      return server;
    });
  }

  async findMine(userId: string) {
    return this.prisma.server.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(userId: string, serverId: string) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: {
        channels: { orderBy: { position: 'asc' } },
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                status: true,
              },
            },
          },
        },
      },
    });
    if (!server) throw new NotFoundException('Server not found');

    const isMember = server.members.some((m) => m.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a member of this server');

    return server;
  }

  async joinByInvite(userId: string, inviteCode: string) {
    const server = await this.prisma.server.findUnique({
      where: { inviteCode },
    });
    if (!server) throw new NotFoundException('Invalid invite');

    await this.prisma.member.upsert({
      where: { userId_serverId: { userId, serverId: server.id } },
      create: { userId, serverId: server.id },
      update: {},
    });
    return server;
  }

  async assertMembership(userId: string, serverId: string) {
    const m = await this.prisma.member.findUnique({
      where: { userId_serverId: { userId, serverId } },
    });
    if (!m) throw new ForbiddenException('Not a member of this server');
    return m;
  }
}
