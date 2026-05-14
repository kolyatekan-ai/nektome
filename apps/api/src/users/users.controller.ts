import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List users that share at least one server with me — useful for the DM
   * "start a call" picker.
   */
  @Get()
  async list(
    @CurrentUser() me: AuthUser,
    @Query('q') q?: string,
  ) {
    const myMemberships = await this.prisma.member.findMany({
      where: { userId: me.userId },
      select: { serverId: true },
    });
    const serverIds = myMemberships.map((m) => m.serverId);

    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: me.userId } },
          { memberships: { some: { serverId: { in: serverIds } } } },
          q
            ? {
                OR: [
                  { username: { contains: q, mode: 'insensitive' } },
                  { displayName: { contains: q, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
      },
      take: 50,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        status: true,
      },
    });
  }
}
