import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Token } from '../../infrastructure/Token';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search posts, users, and tags',
  })
  async search(@Query() query: SearchQueryDto, @Req() req: Request) {
    const viewerId = await this.extractViewerId(req);
    return this.searchService.search(query, viewerId);
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

