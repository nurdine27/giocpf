import { BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { UPLOAD } from './constants';

const logger = new Logger('Cloudinary');

export type UploadedImage = {
  url: string;
  publicId: string;
  name: string;
  width: number;
  height: number;
};

export function cloudinaryConfigured() {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET,
  );
}

function configure() {
  if (!cloudinaryConfigured())
    throw new BadRequestException(
      'O armazenamento de imagens (Cloudinary) não está configurado no servidor.',
    );
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export async function uploadImage(file: Express.Multer.File, folder: string) {
  configure();
  return new Promise<UploadedImage>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${UPLOAD.rootFolder}/${folder}`,
        resource_type: 'image',
        allowed_formats: [...UPLOAD.formats],
        transformation: [{ width: 2400, height: 2400, crop: 'limit', quality: 'auto' }],
      },
      (error, result) => {
        if (error || !result) {
          logger.error(error?.message ?? 'Upload sem resultado');
          return reject(new BadRequestException(`Falha ao enviar "${file.originalname}".`));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          name: file.originalname,
          width: result.width,
          height: result.height,
        });
      },
    );
    stream.end(file.buffer);
  });
}

/** Removes an image from Cloudinary. Failures are logged, never thrown, so data cleanup can proceed. */
export async function deleteImage(publicId?: string | null) {
  if (!publicId || !cloudinaryConfigured()) return;
  try {
    configure();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  } catch (error) {
    logger.warn(`Não foi possível remover ${publicId}: ${String(error)}`);
  }
}

/** Accepts only images hosted in our Cloudinary account (or any https URL when not configured). */
export function assertImageUrl(value?: string | null) {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Endereço de imagem inválido.');
  }
  if (url.protocol !== 'https:') throw new BadRequestException('A imagem deve usar HTTPS.');
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (cloud && !(url.hostname === 'res.cloudinary.com' && url.pathname.startsWith(`/${cloud}/`)))
    throw new BadRequestException('Envie a imagem através do formulário de upload.');
  return value;
}
