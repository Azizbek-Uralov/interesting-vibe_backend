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
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../../generated/prisma/enums';
import { RolesDecorator } from '../../common/decorators/roles.decorator';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AdminService } from './admin.service';
import { AdminUserQueryDto } from './dto/admin-user-query.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(AccessTokenGuard, RolesGuard)
@ApiBearerAuth()
@ApiCookieAuth('accessToken')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Platform statistics overview' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'List platform users with filtering and pagination' })
  getUsers(@Query() query: AdminUserQueryDto) {
    return this.adminService.getUsers(query);
  }

  @Get('users/:id')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Get full user details by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getUserById(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id/status')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Change user account status (ACTIVE, SUSPENDED, DELETION_PENDING)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateUserStatusDto })
  updateUserStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.adminService.updateUserStatus(id, dto.status, req.user.id);
  }

  @Patch('users/:id/role')
  @RolesDecorator(Roles.SUPERADMIN)
  @ApiOperation({ summary: 'Change user role (SUPERADMIN only)' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateUserRoleDto })
  updateUserRole(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.adminService.updateUserRole(id, dto.role, req.user.id);
  }

  @Post('categories')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Create a new category with translations' })
  @ApiBody({ type: CreateCategoryDto })
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.adminService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @ApiOperation({ summary: 'Update a category and its translations' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiBody({ type: UpdateCategoryDto })
  updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.adminService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RolesDecorator(Roles.SUPERADMIN, Roles.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', format: 'uuid' })
  deleteCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteCategory(id);
  }
}

