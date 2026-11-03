import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { Token } from '../../infrastructure/Token';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UsersService } from './users.service';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

@Controller('users')
@ApiTags('Users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Get the current user profile' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  me(@Req() request: AuthenticatedRequest) {
    return this.users.me(request.user.id);
  }

  @Patch('me')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiBody({ type: UpdateProfileDto })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.users.update(request.user.id, dto);
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get a public profile by username' })
  async profile(@Param('username') username: string, @Req() req: Request) {
    const viewerId = await this.extractViewerId(req);
    return this.users.byUsername(username, viewerId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Request account deletion' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  deleteMe(@Req() request: AuthenticatedRequest) {
    return this.users.requestDeletion(request.user.id);
  }

  private async extractViewerId(req: Request): Promise<string | undefined> {
    try {
      const bearerToken =
        req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

      const cookie = req.headers.cookie
        ?.split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith('accessToken='))
        ?.slice('accessToken='.length);

      const token = bearerToken ?? (cookie ? decodeURIComponent(cookie) : undefined);
      if (!token) return undefined;

      const payload = await Token.verifyAccessToken(token);
      return payload.id;
    } catch {
      return undefined;
    }
  }
}
