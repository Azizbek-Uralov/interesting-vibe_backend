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
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@ApiTags('Collections')
@Controller('collections')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
@ApiCookieAuth('accessToken')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a private personal collection' })
  @ApiBody({ type: CreateCollectionDto })
  create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCollectionDto,
  ) {
    return this.collectionsService.create(req.user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List the current user’s collections' })
  findAll(@Req() req: AuthenticatedRequest) {
    return this.collectionsService.findAll(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get collection details with its posts' })
  @ApiParam({ name: 'id', description: 'Collection ID', format: 'uuid' })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collectionsService.findOne(req.user.id, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update collection title, description, or cover' })
  @ApiParam({ name: 'id', description: 'Collection ID', format: 'uuid' })
  @ApiBody({ type: UpdateCollectionDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.collectionsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a collection' })
  @ApiParam({ name: 'id', description: 'Collection ID', format: 'uuid' })
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.collectionsService.remove(req.user.id, id);
  }

  @Post(':id/posts/:postId')
  @ApiOperation({ summary: 'Add a post to a collection' })
  @ApiParam({ name: 'id', description: 'Collection ID', format: 'uuid' })
  @ApiParam({ name: 'postId', description: 'Post ID', format: 'uuid' })
  addPost(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.collectionsService.addPost(req.user.id, id, postId);
  }

  @Delete(':id/posts/:postId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a post from a collection' })
  @ApiParam({ name: 'id', description: 'Collection ID', format: 'uuid' })
  @ApiParam({ name: 'postId', description: 'Post ID', format: 'uuid' })
  removePost(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('postId', ParseUUIDPipe) postId: string,
  ) {
    return this.collectionsService.removePost(req.user.id, id, postId);
  }
}

