import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Token } from '../../infrastructure/Token';
import { FeedQueryDto } from './dto/feed-query.dto';
import { FeedService } from './feed.service';

@ApiTags('Feed')
@Controller('feed')
export class FeedController {
  constructor(private readonly feedService: FeedService) {}

  @Get()
  @ApiOperation({
    summary: 'Get main discovery feed (supports public and personalized)',
  })
  async getFeed(@Query() query: FeedQueryDto, @Req() req: Request) {
    const viewerId = await this.extractViewerId(req);
    return this.feedService.getFeed(query, viewerId);
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

