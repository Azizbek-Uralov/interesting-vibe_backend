import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SessionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  deviceName!: string | null;

  @ApiPropertyOptional()
  userAgent!: string | null;

  @ApiPropertyOptional()
  ipAddress!: string | null;

  @ApiProperty()
  expiresAt!: Date;

  @ApiPropertyOptional()
  lastUsedAt!: Date | null;

  @ApiProperty()
  createdAt!: Date;
}