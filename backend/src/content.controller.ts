import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { audit, can, requireAnyPermission, requirePermission } from './auth';
import {
  CONTENT_KINDS,
  CONTENT_PERMISSIONS,
  EVENT_STATUSES,
  MAX_PHOTOS_PER_ITEM,
  PUBLIC_SETTING_KEYS,
  isContentKind,
  type ContentKind,
} from './constants';
import { assertImageUrl, deleteImage } from './cloudinary';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

class PhotoAssetDto {
  @IsString() @MaxLength(2000) url!: string;
  @IsOptional() @IsString() @MaxLength(300) publicId?: string;
  @IsOptional() @IsString() @MaxLength(300) alt?: string;
}

class ContentDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(30000) content?: string;
  @IsOptional() @IsString() @MaxLength(30000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000) coverUrl?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) coverPublicId?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() categoryId?: string | null;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @Transform(emptyToNull) @IsDateString() endsAt?: string | null;
  @IsOptional() @IsIn(EVENT_STATUSES) status?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @Transform(emptyToNull) @IsString() newsId?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() eventId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_PER_ITEM)
  @ValidateNested({ each: true })
  @Type(() => PhotoAssetDto)
  photos?: PhotoAssetDto[];
}

class PhotosDto {
  @IsArray()
  @ArrayMaxSize(MAX_PHOTOS_PER_ITEM)
  @ValidateNested({ each: true })
  @Type(() => PhotoAssetDto)
  photos!: PhotoAssetDto[];
}

class CategoryDto {
  @IsString() @MinLength(2) @MaxLength(60) name!: string;
}

function slugify(s: string) {
  const base = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
  return `${base}-${Date.now().toString(36)}`;
}

function photoRows(photos: PhotoAssetDto[] = [], offset = 0) {
  return photos.map((p, i) => ({
    url: assertImageUrl(p.url)!,
    publicId: p.publicId ?? null,
    alt: p.alt?.slice(0, 300) ?? '',
    sortOrder: offset + i,
  }));
}

/** Prisma delegates share the same surface for the three content models. */
type ContentDelegate = {
  findUnique: (args: unknown) => Promise<ContentRow | null>;
  update: (args: unknown) => Promise<ContentRow>;
  delete: (args: unknown) => Promise<ContentRow>;
};
type ContentRow = { id: string; coverPublicId: string | null; coverUrl: string | null };

function page(value: string) {
  return Math.max(1, Math.min(10000, Number(value) || 1));
}

@Controller('content')
export class PublicContentController {
  constructor(private db: PrismaService) {}

  @Get('settings') async settings() {
    const rows = await this.db.institutionSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  }

  @Get('news') async news(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('page') pageParam = '1',
  ) {
    const take = 9;
    const p = page(pageParam);
    const where: Prisma.NewsWhereInput = {
      published: true,
      ...(q ? { title: { contains: q.slice(0, 100), mode: 'insensitive' } } : {}),
      ...(category ? { category: { slug: category } } : {}),
    };
    const [items, total, categories] = await Promise.all([
      this.db.news.findMany({
        where,
        include: { category: true },
        orderBy: { publishedAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.db.news.count({ where }),
      this.db.newsCategory.findMany({
        where: { news: { some: { published: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    return { items, total, page: p, pages: Math.ceil(total / take), categories };
  }

  @Get('news/:slug') newsOne(@Param('slug') slug: string) {
    return this.db.news.findFirst({
      where: { slug, published: true },
      include: { category: true, photos: { orderBy: { sortOrder: 'asc' } } },
    });
  }

  @Get('events') async events(@Query('page') pageParam = '1') {
    const p = page(pageParam);
    const take = 9;
    const where = { published: true };
    const [items, total] = await Promise.all([
      this.db.event.findMany({ where, orderBy: { startsAt: 'desc' }, skip: (p - 1) * take, take }),
      this.db.event.count({ where }),
    ]);
    return { items, page: p, pages: Math.ceil(total / take), total };
  }

  @Get('events/:slug') eventOne(@Param('slug') slug: string) {
    return this.db.event.findFirst({
      where: { slug, published: true },
      include: { photos: { orderBy: { sortOrder: 'asc' }, take: MAX_PHOTOS_PER_ITEM } },
    });
  }

  @Get('albums') async albums(@Query('page') pageParam = '1') {
    const p = page(pageParam);
    const take = 12;
    const where = { published: true };
    const [items, total] = await Promise.all([
      this.db.album.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          coverUrl: true,
          createdAt: true,
          photos: { select: { url: true }, orderBy: { sortOrder: 'asc' }, take: 1 },
          _count: { select: { photos: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * take,
        take,
      }),
      this.db.album.count({ where }),
    ]);
    return { items, page: p, pages: Math.ceil(total / take), total };
  }

  @Get('albums/:slug') albumOne(@Param('slug') slug: string) {
    return this.db.album.findFirst({
      where: { slug, published: true },
      include: { photos: { orderBy: { sortOrder: 'asc' }, take: MAX_PHOTOS_PER_ITEM } },
    });
  }

  @Get('home') async home() {
    const [news, events, albums] = await Promise.all([
      this.db.news.findMany({
        where: { published: true },
        include: { category: true },
        orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }],
        take: 3,
      }),
      this.db.event.findMany({
        where: { published: true, startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 3,
      }),
      this.db.album.findMany({
        where: { published: true },
        orderBy: { createdAt: 'desc' },
        take: 4,
        include: { photos: { select: { url: true }, take: 1, orderBy: { sortOrder: 'asc' } } },
      }),
    ]);
    return { news, events, albums };
  }
}

@Controller('admin/content')
export class AdminContentController {
  constructor(private db: PrismaService) {}

  @Get() async list(@Req() req: Request) {
    const actor = await requireAnyPermission(this.db, req, CONTENT_PERMISSIONS);
    const author = { select: { email: true, displayName: true } };
    const photoCount = { select: { photos: true } };
    const [news, events, albums, categories] = await Promise.all([
      can(actor, 'news.manage')
        ? this.db.news.findMany({
            include: { category: true, author, _count: photoCount },
            orderBy: { updatedAt: 'desc' },
            take: 200,
          })
        : [],
      can(actor, 'events.manage')
        ? this.db.event.findMany({
            include: { author, _count: photoCount },
            orderBy: { startsAt: 'desc' },
            take: 200,
          })
        : [],
      can(actor, 'gallery.manage')
        ? this.db.album.findMany({
            include: { author, _count: photoCount },
            orderBy: { updatedAt: 'desc' },
            take: 200,
          })
        : [],
      can(actor, 'news.manage') || can(actor, 'gallery.manage')
        ? this.db.newsCategory.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { news: true } } },
          })
        : [],
    ]);
    return { news, events, albums, categories };
  }

  @Post('categories') async createCategory(@Req() req: Request, @Body() d: CategoryDto) {
    await requirePermission(this.db, req, 'news.manage');
    const name = d.name.trim();
    if (await this.db.newsCategory.findUnique({ where: { name } }))
      throw new BadRequestException('Já existe uma categoria com este nome.');
    return this.db.newsCategory.create({ data: { name, slug: slugify(name) } });
  }

  @Delete('categories/:id') async deleteCategory(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'news.manage');
    await this.db.newsCategory.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Categoria não encontrada.');
    });
    return { ok: true };
  }

  @Delete('photos/:id') async removePhoto(@Req() req: Request, @Param('id') id: string) {
    await requireAnyPermission(this.db, req, CONTENT_PERMISSIONS);
    const photo = await this.db.photo.findUnique({ where: { id } });
    if (!photo) throw new NotFoundException('Fotografia não encontrada.');
    await this.db.photo.delete({ where: { id } });
    await deleteImage(photo.publicId);
    return { ok: true };
  }

  @Get(':kind/:id') async detail(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    const { k } = await this.authorize(req, kind);
    const row = await this.delegate(k).findUnique({
      where: { id },
      include: { photos: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!row) throw new NotFoundException('Conteúdo não encontrado.');
    return row;
  }

  @Post(':kind') async create(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Body() d: ContentDto,
  ) {
    const { k, a } = await this.authorize(req, kind);
    if (!d.title) throw new BadRequestException('Indique o título.');
    const common = {
      title: d.title.trim(),
      slug: slugify(d.title),
      coverUrl: assertImageUrl(d.coverUrl),
      coverPublicId: d.coverPublicId ?? null,
      published: d.published ?? false,
      authorId: a.id,
      photos: { create: photoRows(d.photos) },
    };
    let row: { id: string };
    if (k === 'news') {
      if (!d.content?.trim()) throw new BadRequestException('Escreva o conteúdo da notícia.');
      row = await this.db.news.create({
        data: {
          ...common,
          subtitle: d.subtitle ?? '',
          summary: d.summary ?? '',
          content: d.content,
          featured: d.featured ?? false,
          publishedAt: d.published ? new Date() : null,
          categoryId: d.categoryId ?? null,
        },
      });
    } else if (k === 'events') {
      if (!d.startsAt) throw new BadRequestException('Indique a data de início do evento.');
      this.assertDates(d.startsAt, d.endsAt);
      row = await this.db.event.create({
        data: {
          ...common,
          description: d.description ?? '',
          location: d.location ?? '',
          startsAt: new Date(d.startsAt),
          endsAt: d.endsAt ? new Date(d.endsAt) : null,
          status: d.status ?? 'AGENDADO',
          featured: d.featured ?? false,
        },
      });
    } else {
      row = await this.db.album.create({
        data: {
          ...common,
          description: d.description ?? '',
          newsId: d.newsId ?? null,
          eventId: d.eventId ?? null,
        },
      });
    }
    await audit(this.db, a.id, `${k.toUpperCase()}_CREATED`, row.id, 'content');
    return row;
  }

  @Patch(':kind/:id') async update(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() d: ContentDto,
  ) {
    const { k, a } = await this.authorize(req, kind);
    const current = await this.delegate(k).findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Conteúdo não encontrado.');

    const data: Record<string, unknown> = { title: d.title?.trim(), published: d.published };
    if (d.coverUrl !== undefined) {
      data.coverUrl = assertImageUrl(d.coverUrl);
      data.coverPublicId = d.coverUrl ? (d.coverPublicId ?? null) : null;
    }
    if (k === 'news') {
      Object.assign(data, {
        subtitle: d.subtitle,
        summary: d.summary,
        content: d.content,
        featured: d.featured,
        categoryId: d.categoryId,
      });
      if (d.published === true) data.publishedAt = new Date();
    } else if (k === 'events') {
      if (d.startsAt || d.endsAt) this.assertDates(d.startsAt, d.endsAt);
      Object.assign(data, {
        description: d.description,
        location: d.location,
        status: d.status,
        featured: d.featured,
        startsAt: d.startsAt ? new Date(d.startsAt) : undefined,
        endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null,
      });
    } else {
      Object.assign(data, { description: d.description, newsId: d.newsId, eventId: d.eventId });
    }
    if (d.photos?.length) {
      const offset = await this.db.photo.count({ where: { [this.photoKey(k)]: id } });
      data.photos = { create: photoRows(d.photos, offset) };
    }
    const row = await this.delegate(k).update({ where: { id }, data });
    if (current.coverPublicId && current.coverPublicId !== row.coverPublicId)
      await deleteImage(current.coverPublicId);
    await audit(this.db, a.id, 'CONTENT_UPDATED', id, k, { fields: Object.keys(d) });
    return row;
  }

  @Delete(':kind/:id') async remove(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ) {
    const { k, a } = await this.authorize(req, kind);
    const item = (await this.delegate(k).findUnique({
      where: { id },
      include: { photos: true },
    })) as (ContentRow & { photos: { publicId: string | null }[] }) | null;
    if (!item) throw new NotFoundException('Conteúdo não encontrado.');
    await this.delegate(k).delete({ where: { id } });
    await Promise.all([
      deleteImage(item.coverPublicId),
      ...item.photos.map((p) => deleteImage(p.publicId)),
    ]);
    await audit(this.db, a.id, 'CONTENT_DELETED', id, k);
    return { ok: true };
  }

  @Post(':kind/:id/photos') async addPhotos(
    @Req() req: Request,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() d: PhotosDto,
  ) {
    const { k } = await this.authorize(req, kind);
    const key = this.photoKey(k);
    const offset = await this.db.photo.count({ where: { [key]: id } });
    if (offset + d.photos.length > MAX_PHOTOS_PER_ITEM)
      throw new BadRequestException(`O limite é ${MAX_PHOTOS_PER_ITEM} fotografias.`);
    await this.db.photo.createMany({
      data: photoRows(d.photos, offset).map((p) => ({ ...p, [key]: id })),
    });
    return this.db.photo.findMany({ where: { [key]: id }, orderBy: { sortOrder: 'asc' } });
  }

  private async authorize(req: Request, kind: string) {
    if (!isContentKind(kind)) throw new BadRequestException('Tipo de conteúdo inválido.');
    const admin = await requirePermission(this.db, req, CONTENT_KINDS[kind].permission);
    return { k: kind as ContentKind, a: admin };
  }

  private delegate(kind: ContentKind) {
    return this.db[CONTENT_KINDS[kind].model] as unknown as ContentDelegate;
  }

  private photoKey(kind: ContentKind) {
    return kind === 'news' ? 'newsId' : kind === 'events' ? 'eventId' : 'albumId';
  }

  private assertDates(startsAt?: string, endsAt?: string | null) {
    if (startsAt && endsAt && new Date(endsAt) < new Date(startsAt))
      throw new BadRequestException('A data de fim deve ser posterior à data de início.');
  }
}
