import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class MobileRefreshDto {
  @ApiProperty({
    example: 'eyJhbGciOi...',
    description: 'Yangi access token olish uchun refresh token',
  })
  @IsNotEmpty({ message: 'Refresh token talab qilinadi.' })
  @IsString()
  refreshToken!: string;
}

export class MobileLogoutDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOi...',
    description: 'Bekor qilinishi kerak bo‘lgan refresh token',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

