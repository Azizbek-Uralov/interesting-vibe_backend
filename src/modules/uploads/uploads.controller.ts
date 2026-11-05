import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import * as fs from 'fs';
import { AccessTokenGuard } from '../../common/guards/access-token.guard';
import type { AuthenticatedRequest } from '../../common/guards/access-token.guard';
import { UploadedMulterFile, UploadsService } from './uploads.service';

@ApiTags('Media')
@Controller('media')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('upload')
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload an image or video file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  async upload(@UploadedFile() file: any) {
    return this.uploadsService.uploadFile(file as UploadedMulterFile);
  }

  @Post('upload-multiple')
  @UseGuards(AccessTokenGuard)
  @UseInterceptors(FilesInterceptor('files', 8))
  @ApiOperation({ summary: 'Upload up to 8 images or videos in one request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  async uploadMultiple(@UploadedFiles() files: any[]) {
    return this.uploadsService.uploadMultipleFiles(files as UploadedMulterFile[]);
  }

  @Get('file/:key')
  @ApiOperation({ summary: 'Stream / view uploaded media file' })
  @ApiParam({ name: 'key', description: 'Storage key (filename)' })
  streamFile(@Param('key') key: string, @Res() res: Response) {
    const { filePath, mimeType } = this.uploadsService.getFilePath(key);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media metadata by ID' })
  @ApiParam({ name: 'id', format: 'uuid' })
  getMetadata(@Param('id') id: string) {
    return this.uploadsService.getMediaMetadata(id);
  }

  @Delete(':id')
  @UseGuards(AccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete media record and stored file' })
  @ApiBearerAuth()
  @ApiCookieAuth('accessToken')
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.uploadsService.deleteMedia(request.user.id, id);
  }
}
