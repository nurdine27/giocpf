import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { v2 as cloudinary } from 'cloudinary';
import { memoryStorage } from 'multer';
import { IsBoolean, IsDateString, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { PrismaService } from './prisma.service';
import { requireAdmin, requirePermission, requireAnyPermission } from './registration.controller';

class ContentDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(180) title?: string;
  @IsOptional() @IsString() @MaxLength(300) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(500) summary?: string;
  @IsOptional() @IsString() @MaxLength(30000) content?: string;
  @IsOptional() @IsString() @MaxLength(30000) description?: string;
  @IsOptional() @IsString() @MaxLength(500) location?: string;
  @IsOptional() @IsString() @MaxLength(2000) coverUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) coverPublicId?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @Transform(({value})=>value===''?undefined:value) @IsDateString() endsAt?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() featured?: boolean;
  @IsOptional() @IsString() photos?: string;
  @IsOptional() @IsString() photoAssets?: string;
  @IsOptional() @IsString() newsId?: string;
  @IsOptional() @IsString() eventId?: string;
}

function slugify(s: string) { return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36); }
function safeUrl(value?: string) { if (!value) return null; try { const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) throw new Error(); return value; } catch { throw new BadRequestException('URL de imagem inválido.'); } }
function configureCloudinary() { cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET, secure: true }); }
async function deleteCloudImage(publicId?:string|null){if(!publicId)return;if(!process.env.CLOUDINARY_CLOUD_NAME||!process.env.CLOUDINARY_API_KEY||!process.env.CLOUDINARY_API_SECRET)throw new BadRequestException('O armazenamento de imagens não está disponível.');configureCloudinary();const result=await cloudinary.uploader.destroy(publicId,{resource_type:'image'});if(result.result!=='ok'&&result.result!=='not found')throw new BadRequestException('Não foi possível remover a fotografia.');}
function photoRows(d:ContentDto){let assets:{url:string;publicId?:string;alt?:string}[]=[];try{assets=d.photoAssets?JSON.parse(d.photoAssets):[]}catch{throw new BadRequestException('Fotografias inválidas.');}if(assets.length>100)throw new BadRequestException('O limite é 100 fotografias por publicação.');const urls=(d.photos??'').split(/\r?\n/).filter(Boolean);return assets.length?assets.map((p,sortOrder)=>({url:safeUrl(p.url)!,publicId:p.publicId?.slice(0,300),alt:p.alt?.slice(0,300)??'',sortOrder})):urls.slice(0,100).map((url,sortOrder)=>({url:safeUrl(url)!,sortOrder}));}

@Controller('content')
export class PublicContentController {
  constructor(private db: PrismaService) {}
  @Get('news') async news(@Query('q') q?: string, @Query('category') category?: string, @Query('page') page = '1') {
    const take = 9, p = Math.max(1, Math.min(10000, Number(page) || 1));
    const where = { published: true, ...(q ? { title: { contains: q.slice(0, 100), mode: 'insensitive' as const } } : {}), ...(category ? { category: { slug: category } } : {}) };
    const [items, total] = await Promise.all([this.db.news.findMany({ where, include: { category: true }, orderBy: { publishedAt: 'desc' }, skip: (p - 1) * take, take }), this.db.news.count({ where })]);
    return { items, total, page: p, pages: Math.ceil(total / take) };
  }
  @Get('news/:slug') newsOne(@Param('slug') slug: string) { return this.db.news.findFirst({ where: { slug, published: true }, include: { category: true, photos: { orderBy: { sortOrder: 'asc' } } } }); }
  @Get('events') async events(@Query('page') page='1') { const p=Math.max(1,Math.min(10000,Number(page)||1)),take=9; const where={published:true}; const [items,total]=await Promise.all([this.db.event.findMany({where,orderBy:{startsAt:'asc'},skip:(p-1)*take,take}),this.db.event.count({where})]); return {items,page:p,pages:Math.ceil(total/take),total}; }
  @Get('events/:slug') eventOne(@Param('slug') slug: string) { return this.db.event.findFirst({ where: { slug, published: true }, include: { photos: { orderBy: { sortOrder: 'asc' }, take:100 } } }); }
  @Get('albums') async albums(@Query('page') page='1') { const p=Math.max(1,Math.min(10000,Number(page)||1)),take=12; const where={published:true}; const [items,total]=await Promise.all([this.db.album.findMany({where,select:{id:true,slug:true,title:true,description:true,coverUrl:true,createdAt:true,_count:{select:{photos:true}}},orderBy:{createdAt:'desc'},skip:(p-1)*take,take}),this.db.album.count({where})]); return {items,page:p,pages:Math.ceil(total/take),total}; }
  @Get('albums/:slug') albumOne(@Param('slug') slug: string) { return this.db.album.findFirst({ where: { slug, published: true }, include: { photos: { orderBy: { sortOrder: 'asc' }, take:100 } } }); }
  @Get('home') home() { return Promise.all([this.db.news.findMany({ where: { published: true }, orderBy: [{ featured: 'desc' }, { publishedAt: 'desc' }], take: 3 }), this.db.event.findMany({ where: { published: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' }, take: 3 }), this.db.album.findMany({ where: { published: true }, orderBy: { createdAt: 'desc' }, take: 3 })]).then(([news, events, albums]) => ({ news, events, albums })); }
}

@Controller('admin/content')
export class AdminContentController {
  constructor(private db: PrismaService) {}
  @Post('upload') @UseInterceptors(FilesInterceptor('images', 20, { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 20 }, fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) }))
  async upload(@Req() req: Request, @UploadedFiles() files: Express.Multer.File[]) {
    await requireAnyPermission(this.db, req, ['news.manage','events.manage','gallery.manage']);
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) throw new BadRequestException('Cloudinary não está configurado no backend.');
    if (!files?.length) throw new BadRequestException('Seleccione pelo menos uma imagem (JPEG, PNG, WEBP ou GIF, máximo 10 MB cada).');
    configureCloudinary();
    return Promise.all(files.map(async (file) => {
      const result = await new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'gio-cpf/conteudos', resource_type: 'image', allowed_formats: ['jpg','jpeg','png','webp','gif'] }, (error, uploaded) => error || !uploaded ? reject(error ?? new Error('Falha no upload')) : resolve({ secure_url: uploaded.secure_url, public_id: uploaded.public_id }));
        stream.end(file.buffer);
      });
      return { url: result.secure_url, publicId: result.public_id, name: file.originalname };
    }));
  }
  @Get() async list(@Req() req: Request) { const actor=await requireAnyPermission(this.db, req, ['news.manage','events.manage','gallery.manage']); const can=(permission:string)=>actor.isSuperAdmin||actor.permissions.includes(permission); const [news,events,albums,categories]=await Promise.all([can('news.manage')?this.db.news.findMany({include:{category:true,author:{select:{email:true}}},orderBy:{updatedAt:'desc'},take:50}):Promise.resolve([]),can('events.manage')?this.db.event.findMany({include:{author:{select:{email:true}}},orderBy:{startsAt:'desc'},take:50}):Promise.resolve([]),can('gallery.manage')?this.db.album.findMany({include:{author:{select:{email:true}}},orderBy:{updatedAt:'desc'},take:50}):Promise.resolve([]),can('news.manage')?this.db.newsCategory.findMany({orderBy:{name:'asc'},take:100}):Promise.resolve([])]); return {news,events,albums,categories}; }
  @Post('categories') async category(@Req() req: Request, @Body() d: ContentDto) { await requirePermission(this.db, req, 'news.manage'); if (!d.title) throw new BadRequestException('Indique o nome da categoria.'); return this.db.newsCategory.create({ data: { name: d.title, slug: slugify(d.title) } }); }
  @Post('news') async createNews(@Req() req: Request, @Body() d: ContentDto) { const a = await requirePermission(this.db, req, 'news.manage'); if (!d.title || !d.content) throw new BadRequestException('Título e conteúdo são obrigatórios.'); const category = d.category ? await this.db.newsCategory.findUnique({ where: { id: d.category } }) : null; const row = await this.db.news.create({ data: { title: d.title, slug: slugify(d.title), subtitle: d.subtitle ?? '', summary: d.summary ?? '', content: d.content, coverUrl: safeUrl(d.coverUrl), coverPublicId:d.coverPublicId, published: d.published ?? false, featured: d.featured ?? false, publishedAt: d.published ? new Date() : null, authorId: a.id, categoryId: category?.id, photos: { create: photoRows(d) } } }); await this.db.auditLog.create({data:{adminId:a.id,action:d.published?'NEWS_PUBLISHED':'NEWS_CREATED',targetId:row.id,module:'content'}}); return row; }
  @Post('events') async createEvent(@Req() req: Request, @Body() d: ContentDto) { const a = await requirePermission(this.db, req, 'events.manage'); if (!d.title || !d.startsAt) throw new BadRequestException('Nome e data de início são obrigatórios.'); if (d.status && !['AGENDADO','EM_CURSO','REALIZADO','CANCELADO'].includes(d.status)) throw new BadRequestException('Estado inválido.'); const row = await this.db.event.create({ data: { title: d.title, slug: slugify(d.title), description: d.description ?? '', location: d.location ?? '', startsAt: new Date(d.startsAt), endsAt: d.endsAt ? new Date(d.endsAt) : null, status: d.status ?? 'AGENDADO', coverUrl: safeUrl(d.coverUrl), coverPublicId:d.coverPublicId, published: d.published ?? false, featured: d.featured ?? false, authorId: a.id, photos:{create:photoRows(d)} } }); await this.db.auditLog.create({data:{adminId:a.id,action:d.published?'EVENT_PUBLISHED':'EVENT_CREATED',targetId:row.id,module:'content'}}); return row; }
  @Post('albums') async createAlbum(@Req() req: Request, @Body() d: ContentDto) { const a = await requirePermission(this.db, req, 'gallery.manage'); if (!d.title) throw new BadRequestException('Indique o título do álbum.'); const urls = photoRows(d); return this.db.album.create({ data: { title: d.title, slug:slugify(d.title), description: d.description ?? '', coverUrl: safeUrl(d.coverUrl), coverPublicId:d.coverPublicId, published: d.published ?? false, authorId: a.id, newsId: d.newsId || null, eventId: d.eventId || null, photos: { create: urls } }, include: { photos: true } }); }
  @Patch(':kind/:id') async update(@Req() req: Request, @Param('kind') kind: string, @Param('id') id: string, @Body() d: ContentDto) { const actor=await requirePermission(this.db, req, kind === 'news' ? 'news.manage' : kind === 'events' ? 'events.manage' : 'gallery.manage'); if (!['news','events','albums'].includes(kind)) throw new BadRequestException('Tipo inválido.'); const data: Record<string, unknown> = { ...d }; delete data.photos; delete data.photoAssets; delete data.category; if (d.coverUrl !== undefined) data.coverUrl = safeUrl(d.coverUrl); if (kind === 'news' && d.published === true) data.publishedAt = new Date(); if (kind === 'news' && d.category) data.categoryId = d.category; if (kind === 'events' && d.startsAt) data.startsAt = new Date(d.startsAt); if (kind === 'events' && d.endsAt) data.endsAt = new Date(d.endsAt); const row=await (this.db as any)[kind === 'news' ? 'news' : kind === 'events' ? 'event' : 'album'].update({ where: { id }, data }); await this.db.auditLog.create({data:{adminId:actor.id,action:'CONTENT_UPDATED',targetId:id,module:kind,metadata:{fields:Object.keys(d)}}}); return row; }
  @Delete(':kind/:id') async remove(@Req() req: Request, @Param('kind') kind: string, @Param('id') id: string) { const actor=await requirePermission(this.db, req, kind === 'news' ? 'news.manage' : kind === 'events' ? 'events.manage' : 'gallery.manage'); if (!['news','events','albums'].includes(kind)) throw new BadRequestException('Tipo inválido.'); const model=kind==='news'?'news':kind==='events'?'event':'album';const item=await (this.db as any)[model].findUnique({where:{id},include:{photos:true}});if(!item)throw new BadRequestException('Conteúdo não encontrado.');await Promise.all([deleteCloudImage(item.coverPublicId),...item.photos.map((p:{publicId:string|null})=>deleteCloudImage(p.publicId))]);const removed=await (this.db as any)[model].delete({ where: { id } });await this.db.auditLog.create({data:{adminId:actor.id,action:'CONTENT_DELETED',targetId:id,module:kind}});return removed; }
  @Post('photos') async addPhotos(@Req() req: Request, @Body() d: ContentDto) { await requireAnyPermission(this.db, req, ['news.manage','events.manage']); if (!d.photos || (!d.newsId && !d.eventId)) throw new BadRequestException('Indique fotografias e notícia ou evento.'); const urls = d.photos.split(/\r?\n/).filter(Boolean).slice(0, 100); return Promise.all(urls.map((url, sortOrder) => this.db.photo.create({ data: { url: safeUrl(url)!, sortOrder, newsId: d.newsId, eventId: d.eventId } }))); }
  @Delete('photos/:id') async removePhoto(@Req() req: Request, @Param('id') id: string) { await requireAnyPermission(this.db, req, ['news.manage','events.manage','gallery.manage']); const photo=await this.db.photo.findUnique({where:{id}});if(!photo)throw new BadRequestException('Fotografia não encontrada.');await deleteCloudImage(photo.publicId);return this.db.photo.delete({ where: { id } }); }
}










