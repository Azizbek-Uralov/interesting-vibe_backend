import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../../../../generated/prisma/enums';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AddMediaDto {
  @ApiProperty({ enum: MediaType })
  @IsEnum(MediaType)
  type!: MediaType;

  @ApiProperty({ description: 'Object-storage key, never a local file path.' })
  @IsString()
  @MaxLength(1024)
  storageKey!: string;

  @ApiProperty({ example: 'image/jpeg' })
  @IsString()
  @MaxLength(100)
  mimeType!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  width?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @IsPositive()
  height?: number;

  @ApiProperty({ required: false, description: 'Required for video metadata when known.' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationSeconds?: number;

  @ApiProperty({ required: false, description: 'Bytes; serialised as a string in API responses.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  fileSize?: number;
}
