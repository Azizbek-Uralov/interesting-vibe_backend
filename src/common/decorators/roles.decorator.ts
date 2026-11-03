import { SetMetadata } from '@nestjs/common';
import { Roles } from '../../../generated/prisma/enums';

export const ROLES_KEY = 'roles';
export const RequireRoles = (...roles: Roles[]) =>
  SetMetadata(ROLES_KEY, roles);
export const RolesDecorator = RequireRoles;
