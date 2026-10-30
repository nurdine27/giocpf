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
import { PrismaService } from './prisma.service';
import { requireAdmin } from './registration.controller';
class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(12) @MaxLength(200) password!: string;
}
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
    return { email: a.email };
  }
}
@Controller('admin')
export class AdminController {
  constructor(private db: PrismaService) {}
  @Get('dashboard') async dashboard(@Req() req: Request) {
    await requireAdmin(this.db, req);
    const [total, pending, review, accepted, rejected, courses] = await Promise.all([
      this.db.registration.count(),
      this.db.registration.count({ where: { status: 'PENDENTE' } }),
      this.db.registration.count({ where: { status: 'EM_ANALISE' } }),
      this.db.registration.count({ where: { status: 'ACEITE' } }),
      this.db.registration.count({ where: { status: 'RECUSADA' } }),
      this.db.course.count(),
    ]);
    return { total, pending, review, accepted, rejected, courses };
  }
  @Get('courses') async courses(@Req() req: Request) {
    await requireAdmin(this.db, req);
    return this.db.course.findMany({ orderBy: { updatedAt: 'desc' } });
  }
  @Get('courses/:id') async course(@Req() req: Request, @Param('id') id: string) {
    await requireAdmin(this.db, req);
    const row = await this.db.course.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Curso não encontrado.');
    return row;
  }
  @Get('registrations/:id') async registration(@Req() req: Request, @Param('id') id: string) {
    await requireAdmin(this.db, req);
    const row = await this.db.registration.findUnique({
      where: { id },
      include: { notes: { orderBy: { createdAt: 'desc' } } },
    });
    if (!row) throw new NotFoundException('Inscrição não encontrada.');
    return row;
  }
  @Post('courses') async createCourse(@Req() req: Request, @Body() d: CourseDto) {
    const a = await requireAdmin(this.db, req);
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
    await requireAdmin(this.db, req);
    return this.db.course.update({ where: { id }, data: d });
  }
  @Patch('registrations/:id') async change(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: StatusDto,
  ) {
    const a = await requireAdmin(this.db, req);
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
