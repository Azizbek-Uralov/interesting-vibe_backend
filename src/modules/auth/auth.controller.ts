import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { AuthService } from './auth.service';
import { SignInDto } from './dto/sign-in.dto';
import { VerifySignupOtpDto } from './dto/verify-signup-otp.dto';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { PrismaService } from '../../db/prisma/prisma.service';
import { SignupDto } from './dto/sign-up.dto';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Register request and send signup OTP',
  })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Signup OTP requested successfully.',
  })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Verify signup OTP, create account and session',
  })
  @ApiBody({ type: VerifySignupOtpDto })
  @ApiCreatedResponse({
    description:
      'Account created. Web receives authentication cookies; mobile receives tokens in the response body.',
  })
  verifySignup(
    @Body() dto: VerifySignupOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifySignup(dto, req, res);
  }

  @Get('telegram/status')
  @ApiOperation({ summary: 'Check status of Telegram OTP session' })
  getTelegramStatus(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Session token talab qilinadi.');
    }
    return this.authService.getTelegramStatus(token);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in using username and password',
  })
  @ApiBody({ type: SignInDto })
  @ApiOkResponse({
    description:
      'Signed in successfully. Web receives authentication cookies; mobile receives tokens in the response body.',
  })
  signin(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signin(dto, req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token and issue a new access token',
  })
  @ApiOkResponse({
    description:
      'Web uses its refresh cookie; mobile sends refreshToken in the request body.',
  })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.refresh(req, res, refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke the current session and clear authentication cookies',
  })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.signOut(req, res, refreshToken);
  }

  @Delete('logout-all')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Revoke all active sessions' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  logoutAll(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signOutAll(req.user.id, res);
  }

  @Get('sessions')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'List the current user’s active sessions' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  listSessions(@Req() req: AuthenticatedRequest) {
    return this.prisma.session.findMany({
      where: {
        userId: req.user.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Delete('sessions/:id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({
    summary: 'Revoke one session belonging to the current user',
  })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  async revokeSession(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const result = await this.prisma.session.updateMany({
      where: {
        id,
        userId: req.user.id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return { revoked: result.count === 1 };
  }
}
