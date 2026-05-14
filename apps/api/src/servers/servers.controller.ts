import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { ServersService } from './servers.service';
import { CreateServerDto } from './dto/create-server.dto';

@UseGuards(JwtAuthGuard)
@Controller('servers')
export class ServersController {
  constructor(private readonly servers: ServersService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateServerDto) {
    return this.servers.create(user.userId, dto);
  }

  @Get('me')
  findMine(@CurrentUser() user: AuthUser) {
    return this.servers.findMine(user.userId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.servers.findOne(user.userId, id);
  }

  @Post('join/:inviteCode')
  join(
    @CurrentUser() user: AuthUser,
    @Param('inviteCode') inviteCode: string,
  ) {
    return this.servers.joinByInvite(user.userId, inviteCode);
  }
}
