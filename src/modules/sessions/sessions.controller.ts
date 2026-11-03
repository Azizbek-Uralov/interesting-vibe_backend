import {
  Controller,
  Get,
  Delete,
  Param,
  Req,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { SessionsService } from './sessions.service';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get all active sessions' })
  findAll(@Req() req: any) {
    return this.sessionsService.findAll(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke a session' })
  revoke(
    @Req() req: any,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ) {
    return this.sessionsService.revoke(
      req.user.id,
      sessionId,
    );
  }

  @Delete()
  @ApiOperation({ summary: 'Revoke all other sessions' })
  revokeAll(@Req() req: any) {
    return this.sessionsService.revokeAll(
      req.user.id,
      req.user.sid,
    );
  }
}