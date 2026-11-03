import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class QueryPostsDto {
  @ApiPropertyOptional({
    description: 'Bir so‘rovda qaytariladigan postlar soni',
    minimum: 1,
    maximum: 50,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Keyingi sahifani olish uchun oxirgi post ID si',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  cursor?: string;
}
