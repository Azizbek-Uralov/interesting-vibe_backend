import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { LikesService } from './likes.service';

@ApiTags('Likes')
@Controller('posts')
export class LikesController {
  constructor(private readonly likesService: LikesService) {}

  @Post(':id/like')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Like a post' })
  @ApiParam({ name: 'id', description: 'Post ID', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  like(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.likesService.like(req.user.id, postId);
  }

  @Delete(':id/like')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlike a post' })
  @ApiParam({ name: 'id', description: 'Post ID', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  unlike(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.likesService.unlike(req.user.id, postId);
  }

  @Get(':id/likes')
  @ApiOperation({ summary: 'Get list of users who liked the post' })
  @ApiParam({ name: 'id', description: 'Post ID', format: 'uuid' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getLikes(
    @Param('id', ParseUUIDPipe) postId: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.likesService.getPostLikes(postId, page ?? 1, limit ?? 20);
  }
}

