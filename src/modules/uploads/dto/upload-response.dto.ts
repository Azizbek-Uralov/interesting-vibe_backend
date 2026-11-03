import { ApiProperty } from '@nestjs/swagger';
import { MediaType } from '../../../../generated/prisma/enums';

export class UploadResponseDto {
  @ApiProperty()
  storageKey!: string;

  @ApiProperty()
  url!: string;

  @ApiProperty({ enum: MediaType })
  type!: MediaType;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  fileSize!: number;

  @ApiProperty()
  originalName!: string;
}
