import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { IPayload } from '../common/interface/IPayload';
import { env } from '../db';
import { UnauthorizedException } from '@nestjs/common';

export class Token {
  private static readonly jwt = new JwtService();

  static async generateAccess(payload: IPayload) {
    return this.jwt.signAsync(payload, {
      secret: env.TOKEN.ACCESS_KEY,
      expiresIn: env.TOKEN.ACCESS_TIME as JwtSignOptions['expiresIn'],
    });
  }

  static async generateRefresh(payload: IPayload) {
    return this.jwt.signAsync(payload, {
      secret: env.TOKEN.REFRESH_KEY,
      expiresIn: env.TOKEN.REFRESH_TIME as JwtSignOptions['expiresIn'],
    });
  }

  static async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwt.verifyAsync<IPayload>(refreshToken, {
        secret: env.TOKEN.REFRESH_KEY,
      });
    } catch (error) {
      throw new UnauthorizedException('Tizimga kirishda nosozlik');
    }
  }

  static async verifyAccessToken(accessToken: string) {
    try {
      return await this.jwt.verifyAsync<IPayload>(accessToken, {
        secret: env.TOKEN.ACCESS_KEY,
      });
    } catch {
      throw new UnauthorizedException('Autentifikatsiya talab qilinadi.');
    }
  }
}
