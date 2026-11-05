import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../db/prisma/prisma.service';
import { UploadResponseDto } from './dto/upload-response.dto';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface UploadedMulterFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename?: string;
  path?: string;
}

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100 MB

@Injectable()
export class UploadsService {
  private readonly uploadDir = path.resolve(process.cwd(), 'uploads');

  constructor(private readonly prisma: PrismaService) {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(file: UploadedMulterFile): Promise<UploadResponseDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Fayl yuborilmadi.');
    }

    const mime = file.mimetype.toLowerCase();
    let mediaType: MediaType;

    if (ALLOWED_IMAGE_TYPES.includes(mime)) {
      mediaType = MediaType.IMAGE;
      if (file.size > MAX_IMAGE_SIZE) {
        throw new BadRequestException(
          'Rasm hajmi 20MB dan oshmasligi kerak.',
        );
      }
    } else if (ALLOWED_VIDEO_TYPES.includes(mime)) {
      mediaType = MediaType.VIDEO;
      if (file.size > MAX_VIDEO_SIZE) {
        throw new BadRequestException(
          'Video hajmi 100MB dan oshmasligi kerak.',
        );
      }
    } else {
      throw new BadRequestException(
        'Qo‘llab-quvvatlanmaydigan fayl formati. Faqat JPEG, PNG, WEBP, GIF, MP4, MOV, WEBM formatlari qabul qilinadi.',
      );
    }

    const ext = path.extname(file.originalname) || (mediaType === MediaType.IMAGE ? '.jpg' : '.mp4');
    const filename = `${randomUUID()}${ext}`;
    const targetPath = path.join(this.uploadDir, filename);

    await fs.promises.writeFile(targetPath, file.buffer);

    return {
      storageKey: filename,
      url: `/api/v1/media/file/${filename}`,
      type: mediaType,
      mimeType: mime,
      fileSize: file.size,
      originalName: file.originalname,
    };
  }

  async uploadMultipleFiles(files: UploadedMulterFile[]): Promise<UploadResponseDto[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('Hech qanday fayl yuborilmadi.');
    }
    if (files.length > 8) {
      throw new BadRequestException(
        'Bir vaqtning o‘zida ko‘pi bilan 8 ta fayl yuklash mumkin.',
      );
    }

    const results: UploadResponseDto[] = [];
    for (const file of files) {
      const res = await this.uploadFile(file);
      results.push(res);
    }
    return results;
  }

  getFilePath(storageKey: string): { filePath: string; mimeType: string } {
    // Path traversal oldini olish
    const safeKey = path.basename(storageKey);
    const fullPath = path.join(this.uploadDir, safeKey);

    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('Fayl topilmadi.');
    }

    const ext = path.extname(safeKey).toLowerCase();
    let mimeType = 'application/octet-stream';

    if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
    else if (ext === '.png') mimeType = 'image/png';
    else if (ext === '.webp') mimeType = 'image/webp';
    else if (ext === '.gif') mimeType = 'image/gif';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.mov') mimeType = 'video/quicktime';
    else if (ext === '.webm') mimeType = 'video/webm';

    return { filePath: fullPath, mimeType };
  }

  async getMediaMetadata(id: string) {
    const media = await this.prisma.postMedia.findUnique({
      where: { id },
      include: {
        post: {
          select: {
            id: true,
            userId: true,
            status: true,
          },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media topilmadi.');
    }

    return {
      id: media.id,
      postId: media.postId,
      type: media.type,
      storageKey: media.storageKey,
      url: `/api/v1/media/file/${media.storageKey}`,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      durationSeconds: media.durationSeconds,
      fileSize: media.fileSize ? media.fileSize.toString() : null,
      position: media.position,
      createdAt: media.createdAt,
    };
  }

  async deleteMedia(userId: string, mediaId: string) {
    const media = await this.prisma.postMedia.findUnique({
      where: { id: mediaId },
      include: {
        post: {
          select: { userId: true },
        },
      },
    });

    if (!media) {
      throw new NotFoundException('Media topilmadi.');
    }

    if (media.post.userId !== userId) {
      throw new BadRequestException('Bu mediani o‘chirish huquqingiz yo‘q.');
    }

    // Faylni diskdan o'chirish
    try {
      const safeKey = path.basename(media.storageKey);
      const fullPath = path.join(this.uploadDir, safeKey);
      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
      }
    } catch {
      // fayl o'chirishda xatolik bo'lsa ham bazani tozalaymiz
    }

    await this.prisma.postMedia.delete({
      where: { id: mediaId },
    });

    return { deleted: true };
  }
}

