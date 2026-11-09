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
import { MobileLogoutDto, MobileRefreshDto } from './dto/mobile-auth.dto';

@Controller('auth')
@ApiTags('Authentication')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  // ==========================================
  // FRONTEND (WEB) AUTH ENDPOINTS
  // ==========================================

  @Post('signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web] Register request and send signup OTP',
  })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Signup OTP requested successfully.',
  })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('web/signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web Alias] Register request and send signup OTP',
  })
  webSignup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Web] Verify signup OTP, create account and set HttpOnly cookies',
  })
  @ApiBody({ type: VerifySignupOtpDto })
  @ApiCreatedResponse({
    description: 'Account created. Web receives authentication cookies.',
  })
  verifySignup(
    @Body() dto: VerifySignupOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.verifySignup(dto, req, res);
  }

  @Post('web/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Web Alias] Verify signup OTP, create account and set cookies',
  })
  webVerifySignup(
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
    summary: '[Web] Sign in using username and password',
  })
  @ApiBody({ type: SignInDto })
  @ApiOkResponse({
    description: 'Signed in successfully. Web receives authentication cookies.',
  })
  signin(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signin(dto, req, res);
  }

  @Post('web/signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web Alias] Sign in using username and password',
  })
  webSignin(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.authService.signin(dto, req, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web] Rotate refresh token via cookies',
  })
  @ApiOkResponse({
    description: 'Web uses its refresh cookie.',
  })
  refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.refresh(req, res, refreshToken);
  }

  @Post('web/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web Alias] Rotate refresh token via cookies',
  })
  webRefresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.refresh(req, res);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web] Revoke session and clear authentication cookies',
  })
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body('refreshToken') refreshToken?: string,
  ) {
    return this.authService.signOut(req, res, refreshToken);
  }

  @Post('web/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Web Alias] Revoke session and clear cookies',
  })
  webLogout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.authService.signOut(req, res);
  }

  // ==========================================
  // MOBILE AUTH ENDPOINTS (Bearer Tokens & JSON)
  // ==========================================

  @Post('mobile/signup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Mobile] Register request and send signup OTP for Mobile App',
  })
  @ApiBody({ type: SignupDto })
  @ApiOkResponse({
    description: 'Signup OTP requested successfully.',
  })
  mobileSignup(@Body() dto: SignupDto) {
    return this.authService.mobileSignup(dto);
  }

  @Post('mobile/verify')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '[Mobile] Verify OTP, create account and return Access + Refresh tokens in JSON body',
  })
  @ApiBody({ type: VerifySignupOtpDto })
  @ApiCreatedResponse({
    description: 'Account created. Returns accessToken, refreshToken, and user info.',
  })
  mobileVerify(
    @Body() dto: VerifySignupOtpDto,
    @Req() req: Request,
  ) {
    return this.authService.mobileVerifySignup(dto, req);
  }

  @Post('mobile/signin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Mobile] Sign in using username & password, returns tokens in JSON body',
  })
  @ApiBody({ type: SignInDto })
  @ApiOkResponse({
    description: 'Returns accessToken, refreshToken, and user object directly.',
  })
  mobileSignin(
    @Body() dto: SignInDto,
    @Req() req: Request,
  ) {
    return this.authService.mobileSignin(dto, req);
  }

  @Post('mobile/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Mobile] Rotate tokens using refreshToken passed in body',
  })
  @ApiBody({ type: MobileRefreshDto })
  @ApiOkResponse({
    description: 'Returns newly issued accessToken and refreshToken.',
  })
  mobileRefresh(@Body() dto: MobileRefreshDto) {
    return this.authService.mobileRefresh(dto.refreshToken);
  }

  @Post('mobile/logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[Mobile] Revoke session by passing refreshToken or Bearer token',
  })
  @ApiBody({ type: MobileLogoutDto })
  mobileLogout(
    @Body() dto: MobileLogoutDto,
    @Req() req: Request,
  ) {
    const bearer = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    return this.authService.mobileSignOut(dto.refreshToken, undefined);
  }

  @Get('mobile/telegram/status')
  @ApiOperation({ summary: '[Mobile] Check status of Telegram OTP session' })
  mobileTelegramStatus(@Query('token') token: string) {
    if (!token) {
      throw new BadRequestException('Session token talab qilinadi.');
    }
    return this.authService.getTelegramStatus(token);
  }

  // ==========================================
  // SHARED SESSION MANAGEMENT ENDPOINTS
  // ==========================================

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
