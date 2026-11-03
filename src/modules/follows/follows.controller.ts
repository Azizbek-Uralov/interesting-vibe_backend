import {
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
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { FollowPaginationDto } from './dto/follow-pagination.dto';
import { FollowsService } from './follows.service';

@ApiTags('Follows')
@Controller('users')
export class FollowsController {
  constructor(private readonly followsService: FollowsService) {}

  @Get('me/follow-requests')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'List pending follow requests for the current private user' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  getPendingRequests(
    @Req() req: AuthenticatedRequest,
    @Query() query: FollowPaginationDto,
  ) {
    return this.followsService.getPendingRequests(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  @Patch('follow-requests/:id/accept')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Accept a pending follow request' })
  @ApiParam({ name: 'id', description: 'Follow request ID', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  acceptRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) followId: string,
  ) {
    return this.followsService.acceptFollowRequest(req.user.id, followId);
  }

  @Patch('follow-requests/:id/reject')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Reject a pending follow request' })
  @ApiParam({ name: 'id', description: 'Follow request ID', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  rejectRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) followId: string,
  ) {
    return this.followsService.rejectFollowRequest(req.user.id, followId);
  }

  @Post(':id/follow')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Follow a user or send a follow request if private' })
  @ApiParam({ name: 'id', description: 'User ID to follow', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  follow(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) followingId: string,
  ) {
    return this.followsService.follow(req.user.id, followingId);
  }

  @Delete(':id/follow')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unfollow a user or cancel a pending follow request' })
  @ApiParam({ name: 'id', description: 'User ID to unfollow', format: 'uuid' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  unfollow(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) followingId: string,
  ) {
    return this.followsService.unfollow(req.user.id, followingId);
  }

  @Get(':id/followers')
  @ApiOperation({ summary: 'Get followers of a user' })
  @ApiParam({ name: 'id', description: 'User ID', format: 'uuid' })
  getFollowers(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: FollowPaginationDto,
  ) {
    return this.followsService.getFollowers(
      userId,
      query.page,
      query.limit,
    );
  }

  @Get(':id/following')
  @ApiOperation({ summary: 'Get users followed by a user' })
  @ApiParam({ name: 'id', description: 'User ID', format: 'uuid' })
  getFollowing(
    @Param('id', ParseUUIDPipe) userId: string,
    @Query() query: FollowPaginationDto,
  ) {
    return this.followsService.getFollowing(
      userId,
      query.page,
      query.limit,
    );
  }
}

