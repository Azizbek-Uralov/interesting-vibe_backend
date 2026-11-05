import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { Token } from '../../infrastructure/Token';
import { AddMediaDto } from './dto/add-media.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { QueryPostsDto } from './dto/query.posts.dto';
import { ReorderMediaDto } from './dto/reorder-media.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Get()
  @ApiOperation({ summary: 'List public published posts' })
  async list(@Query() query: QueryPostsDto, @Req() req: Request) {
    const viewerId = await this.extractViewerId(req);
    return this.posts.published(query, viewerId);
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'List the current user’s posts including drafts' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  mine(@Req() request: AuthenticatedRequest) {
    return this.posts.mine(request.user.id);
  }

  @Post()
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Create a draft post' })
  @ApiBody({ type: CreatePostDto })
  @ApiCreatedResponse({ description: 'Draft post created.' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    return this.posts.create(request.user.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public post or authorized view of private/draft post' })
  @ApiParam({ name: 'id', format: 'uuid' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const viewerId = await this.extractViewerId(req);
    return this.posts.findOne(id, viewerId);
  }

  @Patch(':id')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Update a post or change its status' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdatePostDto })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.posts.update(request.user.id, id, dto);
  }

  @Post(':id/archive')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Archive a post' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  archive(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.archive(request.user.id, id);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a post and its media records' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  remove(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.posts.remove(request.user.id, id);
  }

  @Post(':id/media')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Attach uploaded object-storage media metadata to a post' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: AddMediaDto })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  addMedia(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMediaDto,
  ) {
    return this.posts.addMedia(request.user.id, id, dto);
  }

  @Post(':id/media/batch')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Attach up to 8 uploaded media items to a post at once' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: [AddMediaDto] })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  addMediaBatch(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dtos: AddMediaDto[],
  ) {
    return this.posts.addMediaBatch(request.user.id, id, dtos);
  }

  @Patch(':id/media/order')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Set the complete display order of post media' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: ReorderMediaDto })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  reorderMedia(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderMediaDto,
  ) {
    return this.posts.reorderMedia(request.user.id, id, dto);
  }

  @Delete(':id/media/:mediaId')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove media metadata from a post' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiParam({ name: 'mediaId', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  removeMedia(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('mediaId', ParseUUIDPipe) mediaId: string,
  ) {
    return this.posts.removeMedia(request.user.id, id, mediaId);
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
