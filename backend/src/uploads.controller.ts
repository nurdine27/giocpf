import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { PrismaService } from './prisma.service';
import { can, requireAdmin } from './auth';
import { UPLOAD, UPLOAD_FOLDERS } from './constants';
import { uploadImage } from './cloudinary';

@Controller('admin/uploads')
export class UploadsController {
  constructor(private db: PrismaService) {}

  @Post()
  @UseInterceptors(
    FilesInterceptor('images', UPLOAD.maxFiles, {
      storage: memoryStorage(),
      limits: { fileSize: UPLOAD.maxFileSize, files: UPLOAD.maxFiles },
      fileFilter: (_req, file, cb) => cb(null, UPLOAD.mimePattern.test(file.mimetype)),
    }),
  )
  async upload(
    @Req() req: Request,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('folder') folder = 'conteudos',
  ) {
    const admin = await requireAdmin(this.db, req);
    if (!(folder in UPLOAD_FOLDERS)) throw new BadRequestException('Destino de upload inválido.');
    const required = UPLOAD_FOLDERS[folder];
    if (required && !required.some((p) => can(admin, p)))
      throw new ForbiddenException('Não tem permissão para enviar imagens para esta área.');
    if (!files?.length)
      throw new BadRequestException(
        'Seleccione pelo menos uma imagem JPEG, PNG, WEBP ou GIF até 10 MB.',
      );
    return Promise.all(files.map((file) => uploadImage(file, folder)));
  }
}
