import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { Roles } from '../../../../generated/prisma/enums';

export class UpdateUserRoleDto {
  @ApiProperty({ enum: Roles })
  @IsEnum(Roles)
  role!: Roles;
}

