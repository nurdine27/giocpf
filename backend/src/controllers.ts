import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Req,
  Res,
  UnauthorizedException,
  Param,
  NotFoundException,
  Query,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { createHash, randomBytes } from 'node:crypto';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import { PrismaService } from './prisma.service';
import { requireAdmin, requirePermission, ADMIN_PERMISSIONS } from './registration.controller';
import { Prisma } from '@prisma/client';
class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
}
class ForgotDto { @IsEmail() email!: string; }
class ResetDto { @IsEmail() email!: string; @IsString() @MinLength(6) @MaxLength(6) code!: string; @IsString() @MinLength(8) @MaxLength(200) password!: string; }
class CreateAdminDto { @IsEmail() email!: string; @IsString() @MinLength(12) @MaxLength(200) password!: string; @IsOptional() @IsString({each:true}) permissions?: string[]; }
class StatusDto {
  @IsIn(['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA']) status!: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
class CourseDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() enrollmentOpen?: boolean;
  @IsOptional() @IsString() duration?: string;
  @IsOptional() @IsString() requirements?: string;
}
@Controller('auth')
export class AuthController {
  constructor(private db: PrismaService) {}
  private async sendOtp(to: string, code: string) {
    const from = process.env.MAIL_FROM;
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject: 'Código de recuperação — GIO CPF', html: `<p>O seu código de recuperação é <strong>${code}</strong>. Expira em 10 minutos.</p>` }) });
      if (!response.ok) throw new BadRequestException('Não foi possível enviar o e-mail de recuperação.');
      return;
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_PORT && from) {
      const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      await transport.sendMail({ from, to, subject: 'Código de recuperação — GIO CPF', text: `O seu código de recuperação é ${code}. Expira em 10 minutos.` }); return;
    }
    throw new BadRequestException('O serviço de envio de e-mail ainda não está configurado.');
  }
  @Post('password/forgot') @Throttle({ default: { limit: 3, ttl: 60000 } }) async forgot(@Body() d: ForgotDto) {
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin) return { ok: true, message: 'Se o endereço estiver registado, receberá um código.' };
    const code = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
    await this.db.adminPasswordOtp.deleteMany({ where: { adminId: admin.id } });
    await this.db.adminPasswordOtp.create({ data: { adminId: admin.id, codeHash: await bcrypt.hash(code, 10), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
    await this.sendOtp(admin.email, code); return { ok: true, message: 'Se o endereço estiver registado, receberá um código.' };
  }
  @Post('password/reset') @Throttle({ default: { limit: 5, ttl: 60000 } }) async resetPassword(@Body() d: ResetDto) {
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin) throw new UnauthorizedException('Código inválido ou expirado.');
    const otp = await this.db.adminPasswordOtp.findFirst({ where: { adminId: admin.id }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= 5 || !(await bcrypt.compare(d.code, otp.codeHash))) {
      if (otp) await this.db.adminPasswordOtp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('Código inválido ou expirado.');
    }
    await this.db.$transaction([this.db.adminUser.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(d.password, 12) } }), this.db.adminPasswordOtp.deleteMany({ where: { adminId: admin.id } }), this.db.adminSession.deleteMany({ where: { adminId: admin.id } })]);
    return { ok: true };
  }
  @Post('login') @Throttle({ default: { limit: 5, ttl: 60000 } }) async login(
    @Body() d: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin || !(await bcrypt.compare(d.password, admin.passwordHash)))
      throw new UnauthorizedException('E-mail ou palavra-passe incorrectos.');
    const token = randomBytes(32).toString('hex');
    const id = createHash('sha256').update(token).digest('hex');
    await this.db.adminSession.create({
      data: { id, adminId: admin.id, expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000) },
    });
    res.cookie('gio_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
    return { email: admin.email };
  }
  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.gio_session as string | undefined;
    if (token)
      await this.db.adminSession.deleteMany({
        where: { id: createHash('sha256').update(token).digest('hex') },
      });
    res.clearCookie('gio_session', { path: '/' });
    return { ok: true };
  }
  @Get('me') async me(@Req() req: Request) {
    const a = await requireAdmin(this.db, req);
    return { email: a.email, displayName: a.displayName, permissions: a.permissions, isSuperAdmin: a.isSuperAdmin };
  }
}
@Controller('admin')
export class AdminController {
  constructor(private db: PrismaService) {}
  @Get('admin-users') async adminUsers(@Req() req: Request,@Query('page') page='1',@Query('limit') limit='10') { await requirePermission(this.db, req, 'users.manage'); const p=Math.max(1,Number(page)||1),n=Math.max(1,Math.min(50,Number(limit)||10));const [data,total]=await Promise.all([this.db.adminUser.findMany({ select: { id:true,email:true,isSuperAdmin:true,permissions:true,createdAt:true }, orderBy: { createdAt:'asc' },skip:(p-1)*n,take:n }),this.db.adminUser.count()]);return {data,meta:{page:p,limit:n,total,totalPages:Math.ceil(total/n)}}; }
  @Post('admin-users') async createAdmin(@Req() req: Request, @Body() d: CreateAdminDto) { const actor = await requirePermission(this.db, req, 'users.manage'); const permissions = Array.isArray(d.permissions) ? [...new Set(d.permissions)].filter((p): p is typeof ADMIN_PERMISSIONS[number] => (ADMIN_PERMISSIONS as readonly string[]).includes(p)) : []; if (permissions.length !== (d.permissions ?? []).length) throw new BadRequestException('Lista de permissões inválida.'); const row = await this.db.adminUser.create({ data: { email:d.email.toLowerCase(),passwordHash:await bcrypt.hash(d.password,12),permissions }, select:{id:true,email:true,permissions:true,createdAt:true} }); await this.db.auditLog.create({data:{adminId:actor.id,action:'ADMIN_CREATED',targetId:row.id}}); return row; }
  @Get('dashboard') async dashboard(@Req() req: Request) {
    await requirePermission(this.db, req, 'dashboard.read');
    const [total, pending, review, accepted, rejected, courses,newsTotal,newsPublished,newsDrafts,eventsTotal,eventsUpcoming,eventsPast,albumsTotal,photosTotal,messagesTotal,messagesUnread] = await Promise.all([
      this.db.registration.count(),
      this.db.registration.count({ where: { status: 'PENDENTE' } }),
      this.db.registration.count({ where: { status: 'EM_ANALISE' } }),
      this.db.registration.count({ where: { status: 'ACEITE' } }),
      this.db.registration.count({ where: { status: 'RECUSADA' } }),
      this.db.course.count(),
      this.db.news.count(),this.db.news.count({where:{published:true}}),this.db.news.count({where:{published:false}}),
      this.db.event.count(),this.db.event.count({where:{startsAt:{gte:new Date()},published:true,status:'AGENDADO'}}),this.db.event.count({where:{status:'REALIZADO'}}),
      this.db.album.count(),this.db.photo.count(),this.db.contactMessage.count(),this.db.contactMessage.count({where:{status:'NAO_LIDA'}}),
    ]);
    return { total, pending, review, accepted, rejected, courses, newsTotal, newsPublished, newsDrafts, eventsTotal, eventsUpcoming, eventsPast, albumsTotal, photosTotal, messagesTotal, messagesUnread };
  }
  @Get('dashboard/trends') async dashboardTrends(@Req() req: Request) {
    await requirePermission(this.db, req, 'dashboard.read');
    const from = new Date(); from.setMonth(from.getMonth() - 5); from.setDate(1); from.setHours(0,0,0,0);
    const [publications,messages,categories] = await Promise.all([
      this.db.$queryRaw<{month:string;total:number}[]>(Prisma.sql`SELECT to_char(date_trunc('month', "publishedAt"), 'YYYY-MM') AS month, COUNT(*)::int AS total FROM "News" WHERE "published"=true AND "publishedAt">=${from} GROUP BY date_trunc('month', "publishedAt") ORDER BY month`),
      this.db.$queryRaw<{month:string;total:number}[]>(Prisma.sql`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*)::int AS total FROM "ContactMessage" WHERE "createdAt">=${from} GROUP BY date_trunc('month', "createdAt") ORDER BY month`),
      this.db.news.groupBy({by:['categoryId'],_count:{_all:true},where:{published:true}}),
    ]);
    const categoryIds=categories.map(x=>x.categoryId).filter((x):x is string=>Boolean(x));
    const names=categoryIds.length?await this.db.newsCategory.findMany({where:{id:{in:categoryIds}},select:{id:true,name:true}}):[];
    return {from:from.toISOString(),publications,messages,categories:categories.map(x=>({name:names.find(n=>n.id===x.categoryId)?.name??'Sem categoria',total:x._count._all}))};
  }
  @Get('courses') async courses(@Req() req: Request) {
    await requirePermission(this.db, req, 'courses.manage');
    return this.db.course.findMany({ orderBy: { updatedAt: 'desc' } });
  }
  @Get('courses/:id') async course(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'courses.manage');
    const row = await this.db.course.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Curso não encontrado.');
    return row;
  }
  @Get('registrations/:id') async registration(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'registrations.read');
    const row = await this.db.registration.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Inscrição não encontrada.');
    return row;
  }
  @Post('courses') async createCourse(@Req() req: Request, @Body() d: CourseDto) {
    const a = await requirePermission(this.db, req, 'courses.manage');
    if (!d.name || !d.area) throw new BadRequestException('Indique o nome e a área do curso.');
    const slug = d.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const row = await this.db.course.create({
      data: {
        name: d.name,
        area: d.area,
        description: d.description,
        slug,
        published: d.published ?? false,
        enrollmentOpen: d.enrollmentOpen ?? false,
        duration: d.duration,
        requirements: d.requirements,
      },
    });
    await this.db.auditLog.create({
      data: { adminId: a.id, action: 'COURSE_CREATED', targetId: row.id },
    });
    return row;
  }
  @Patch('courses/:id') async updateCourse(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: CourseDto,
  ) {
    await requirePermission(this.db, req, 'courses.manage');
    return this.db.course.update({ where: { id }, data: d });
  }
  @Patch('registrations/:id') async change(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: StatusDto,
  ) {
    const a = await requirePermission(this.db, req, 'registrations.manage');
    const result = await this.db.registration.update({
      where: { id },
      data: { status: d.status as never },
    });
    if (d.note?.trim())
      await this.db.registrationNote.create({
        data: { registrationId: id, adminId: a.id, body: d.note.trim() },
      });
    await this.db.auditLog.create({
      data: { adminId: a.id, action: `STATUS_${d.status}`, targetId: id },
    });
    return result;
  }
}
