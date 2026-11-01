import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { Transform, Type } from 'class-transformer';
import { PrismaService } from './prisma.service';
import { areas, provinces } from './catalog';
import rules from './registration-rules.cjs';
class RegistrationDto {
  @IsUUID() submissionKey!: string;
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsString() @MinLength(8) @MaxLength(24) phone!: string;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(14)
  @Max(99)
  age?: number;
  @IsString() province!: string;
  @IsString() district!: string;
  @IsString() area!: string;
  @IsString() course!: string;
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
  @Transform(({ value }) => value === true || value === 'true') @IsBoolean() consent!: boolean;
}
@Controller('registrations')
export class RegistrationController {
  constructor(private db: PrismaService) {}
  @Post() @Throttle({ default: { limit: 4, ttl: 60000 } }) async create(
    @Body() d: RegistrationDto,
  ) {
    if (!d.consent)
      throw new BadRequestException('O consentimento é necessário para enviar a inscrição.');
    const previous = await this.db.registration.findUnique({
      where: { submissionKey: d.submissionKey },
      select: { reference: true, status: true, createdAt: true },
    });
    if (previous) return previous;
    const validate = (fn: () => void) => {
      try {
        fn();
      } catch (e) {
        throw new BadRequestException(
          e instanceof Error ? e.message : 'Dados de inscrição inválidos.',
        );
      }
    };
    validate(() => rules.assertLocation(d.province, d.district, provinces));
    validate(() =>
      rules.assertArea(
        d.area,
        areas.map((a) => a.name),
      ),
    );
    const match = await this.db.course.findFirst({ where: { name: d.course, area: d.area } });
    validate(() => rules.assertCourseAvailable(match));
    if (!match) throw new BadRequestException('Este curso não está disponível para inscrição.');
    validate(() => rules.assertEnrollmentOpen(match));
    const reference = rules.createReference();
    try {
      return await this.db.registration.create({
        data: {
          reference,
          submissionKey: d.submissionKey,
          name: d.name.trim(),
          phone: d.phone.trim(),
          email: d.email?.trim() || null,
          age: d.age ?? null,
          province: d.province,
          district: d.district,
          area: d.area,
          courseName: d.course,
          courseId: match.id,
          message: d.message?.trim() || null,
          consentedAt: new Date(),
        },
        select: { reference: true, status: true, createdAt: true },
      });
    } catch {
      throw new BadRequestException('Não foi possível guardar a inscrição. Tente novamente.');
    }
  }
  @Get() async list(@Req() req: Request) {
    await requirePermission(this.db, req, 'registrations.read');
    const page = Math.max(1, Number(req.query.page) || 1);
    const q = String(req.query.q ?? '').slice(0, 100);
    const status = String(req.query.status ?? '');
    const where: Record<string, unknown> = {};
    if (q)
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { reference: { contains: q, mode: 'insensitive' } },
      ];
    if (['PENDENTE', 'EM_ANALISE', 'ACEITE', 'RECUSADA'].includes(status)) where.status = status;
    return {
      items: await this.db.registration.findMany({
        where: where as never,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * 20,
        take: 20,
        select: {
          id: true,
          reference: true,
          name: true,
          phone: true,
          courseName: true,
          status: true,
          createdAt: true,
        },
      }),
      page,
    };
  }
}
export async function requireAdmin(db: PrismaService, req: Request) {
  const token = req.cookies?.gio_session as string | undefined;
  if (!token) throw new UnauthorizedException();
  if (process.env.APP_URL && req.get('origin') && req.get('origin') !== process.env.APP_URL)
    throw new UnauthorizedException();
  const id = createHash('sha256').update(token).digest('hex');
  const session = await db.adminSession.findUnique({ where: { id }, include: { admin: true } });
  if (!session || session.expiresAt < new Date()) throw new UnauthorizedException();
  return session.admin;
}
export const ADMIN_PERMISSIONS = ['dashboard.read','registrations.read','registrations.manage','courses.manage','news.manage','events.manage','gallery.manage','users.manage','messages.read','messages.manage','messages.reply','settings.manage'] as const;
export async function requirePermission(db: PrismaService, req: Request, permission: typeof ADMIN_PERMISSIONS[number]) {
  const admin = await requireAdmin(db, req);
  if (!admin.isSuperAdmin && !admin.permissions.includes(permission)) {
    const { ForbiddenException } = await import('@nestjs/common');
    throw new ForbiddenException('Não tem permissão para esta acção.');
  }
  return admin;
}
export async function requireAnyPermission(db: PrismaService, req: Request, permissions: (typeof ADMIN_PERMISSIONS)[number][]) {
  const admin = await requireAdmin(db, req);
  if (!admin.isSuperAdmin && !permissions.some((p) => admin.permissions.includes(p))) {
    const { ForbiddenException } = await import('@nestjs/common');
    throw new ForbiddenException('Não tem permissão para esta acção.');
  }
  return admin;
}
@Controller('courses')
export class PublicCoursesController {
  constructor(private db: PrismaService) {}
  @Get() async list() {
    return this.db.course.findMany({
      where: { published: true },
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        area: true,
        description: true,
        duration: true,
        requirements: true,
        enrollmentOpen: true,
      },
    });
  }
}
