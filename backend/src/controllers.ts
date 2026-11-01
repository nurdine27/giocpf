import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { randomBytes } from 'node:crypto';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { audit, can, hashToken, requireAdmin, requirePermission } from './auth';
import {
  OTP_TTL_MS,
  REGISTRATION_STATUSES,
  SEAT_STATUSES,
  SESSION_COOKIE,
  SESSION_TTL_MS,
  type RegistrationStatus,
} from './constants';
import { areas } from './catalog';
import { availableClasses, hasFreeSeat, promoteWaitlist, seatsTaken } from './class-allocation';
import { assertImageUrl, deleteImage } from './cloudinary';
import { sendEmail } from './email';
import { passwordResetEmail } from './email-templates';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);
const AREA_NAMES = areas.map((a) => a.name);

class LoginDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
}
class ForgotDto {
  @IsEmail() email!: string;
}
class ResetDto {
  @IsEmail() email!: string;
  @IsString() @Length(6, 6) code!: string;
  @IsString() @MinLength(8) @MaxLength(200) password!: string;
}
class StatusDto {
  @IsOptional() @IsIn(REGISTRATION_STATUSES) status?: RegistrationStatus;
  /** Move to another class; empty string sends the registration to the waiting list. */
  @IsOptional() @IsString() classId?: string;
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
class CourseDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(120) name?: string;
  @IsOptional()
  @IsIn(AREA_NAMES, { message: 'Seleccione uma área de formação válida.' })
  area?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsBoolean() published?: boolean;
  @IsOptional() @IsBoolean() enrollmentOpen?: boolean;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(120) duration?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500) requirements?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000) imageUrl?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(300) imagePublicId?: string | null;
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Returns the last `count` months as YYYY-MM keys, oldest first. */
function lastMonths(count: number) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
}

function fillMonths(months: string[], rows: { month: string; total: number }[]) {
  return months.map((month) => ({ month, total: rows.find((r) => r.month === month)?.total ?? 0 }));
}

@Controller('auth')
export class AuthController {
  constructor(private db: PrismaService) {}

  @Post('password/forgot') @Throttle({ default: { limit: 3, ttl: 60000 } }) async forgot(
    @Body() d: ForgotDto,
  ) {
    const reply = { ok: true, message: 'Se o endereço estiver registado, receberá um código.' };
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin || !admin.active) return reply;
    const code = String(randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
    await this.db.adminPasswordOtp.deleteMany({ where: { adminId: admin.id } });
    await this.db.adminPasswordOtp.create({
      data: {
        adminId: admin.id,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    try {
      await sendEmail({
        to: admin.email,
        ...passwordResetEmail(code),
        tags: { type: 'password_reset' },
      });
    } catch {
      throw new BadRequestException('O serviço de envio de e-mail não está disponível.');
    }
    return reply;
  }

  @Post('password/reset') @Throttle({ default: { limit: 5, ttl: 60000 } }) async resetPassword(
    @Body() d: ResetDto,
  ) {
    const invalid = new UnauthorizedException('Código inválido ou expirado.');
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin) throw invalid;
    const otp = await this.db.adminPasswordOtp.findFirst({
      where: { adminId: admin.id },
      orderBy: { createdAt: 'desc' },
    });
    if (
      !otp ||
      otp.expiresAt < new Date() ||
      otp.attempts >= 5 ||
      !(await bcrypt.compare(d.code, otp.codeHash))
    ) {
      if (otp)
        await this.db.adminPasswordOtp.update({
          where: { id: otp.id },
          data: { attempts: { increment: 1 } },
        });
      throw invalid;
    }
    await this.db.$transaction([
      this.db.adminUser.update({
        where: { id: admin.id },
        data: { passwordHash: await bcrypt.hash(d.password, 12) },
      }),
      this.db.adminPasswordOtp.deleteMany({ where: { adminId: admin.id } }),
      this.db.adminSession.deleteMany({ where: { adminId: admin.id } }),
    ]);
    return { ok: true, message: 'Palavra-passe actualizada. Já pode iniciar sessão.' };
  }

  @Post('login') @Throttle({ default: { limit: 5, ttl: 60000 } }) async login(
    @Body() d: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const admin = await this.db.adminUser.findUnique({ where: { email: d.email.toLowerCase() } });
    if (!admin || !(await bcrypt.compare(d.password, admin.passwordHash)))
      throw new UnauthorizedException('E-mail ou palavra-passe incorrectos.');
    if (!admin.active)
      throw new UnauthorizedException('Esta conta está desactivada. Contacte o administrador.');
    const token = randomBytes(32).toString('hex');
    await this.db.$transaction([
      this.db.adminSession.create({
        data: {
          id: hashToken(token),
          adminId: admin.id,
          expiresAt: new Date(Date.now() + SESSION_TTL_MS),
        },
      }),
      this.db.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } }),
      this.db.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    ]);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS,
    });
    return { email: admin.email };
  }

  @Post('logout') async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) await this.db.adminSession.deleteMany({ where: { id: hashToken(token) } });
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    return { ok: true };
  }

  @Get('me') async me(@Req() req: Request) {
    const a = await requireAdmin(this.db, req);
    return {
      id: a.id,
      email: a.email,
      displayName: a.displayName,
      profilePhotoUrl: a.profilePhotoUrl,
      isSuperAdmin: a.isSuperAdmin,
      role: a.role ? { id: a.role.id, name: a.role.name } : null,
      permissions: a.effectivePermissions,
    };
  }
}

@Controller('admin')
export class AdminController {
  constructor(private db: PrismaService) {}

  /** Lightweight counters used by the sidebar badges. */
  @Get('badges') async badges(@Req() req: Request) {
    const a = await requireAdmin(this.db, req);
    const [pendingRegistrations, unreadMessages, waitlisted] = await Promise.all([
      can(a, 'registrations.read')
        ? this.db.registration.count({ where: { status: 'PENDENTE' } })
        : 0,
      can(a, 'messages.read') ? this.db.contactMessage.count({ where: { status: 'NAO_LIDA' } }) : 0,
      can(a, 'classes.read')
        ? this.db.registration.count({ where: { waitlisted: true, status: { in: SEAT_STATUSES } } })
        : 0,
    ]);
    return { pendingRegistrations, unreadMessages, waitlisted };
  }

  @Get('dashboard') async dashboard(@Req() req: Request) {
    await requirePermission(this.db, req, 'dashboard.read');
    const months = lastMonths(6);
    const from = new Date(`${months[0]}-01T00:00:00`);
    const monthStart = new Date(`${months[months.length - 1]}-01T00:00:00`);
    const previousMonthStart = new Date(`${months[months.length - 2]}-01T00:00:00`);

    const [
      registrationsByStatus,
      registrationsTotal,
      registrationsThisMonth,
      registrationsLastMonth,
      registrationsTrend,
      messagesTrend,
      topCourses,
      courses,
      openCourses,
      newsPublished,
      newsDrafts,
      eventsUpcoming,
      albums,
      photos,
      messagesByStatus,
      recentRegistrations,
      recentMessages,
      nextEvents,
      openClasses,
      waitlisted,
    ] = await Promise.all([
      this.db.registration.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.registration.count(),
      this.db.registration.count({ where: { createdAt: { gte: monthStart } } }),
      this.db.registration.count({
        where: { createdAt: { gte: previousMonthStart, lt: monthStart } },
      }),
      this.db.$queryRaw<{ month: string; total: number }[]>(
        Prisma.sql`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*)::int AS total FROM "Registration" WHERE "createdAt" >= ${from} GROUP BY 1 ORDER BY 1`,
      ),
      this.db.$queryRaw<{ month: string; total: number }[]>(
        Prisma.sql`SELECT to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month, COUNT(*)::int AS total FROM "ContactMessage" WHERE "createdAt" >= ${from} GROUP BY 1 ORDER BY 1`,
      ),
      this.db.registration.groupBy({
        by: ['courseName'],
        _count: { _all: true },
        orderBy: { _count: { courseName: 'desc' } },
        take: 5,
      }),
      this.db.course.count(),
      this.db.course.count({ where: { published: true, enrollmentOpen: true } }),
      this.db.news.count({ where: { published: true } }),
      this.db.news.count({ where: { published: false } }),
      this.db.event.count({ where: { startsAt: { gte: new Date() }, published: true } }),
      this.db.album.count(),
      this.db.photo.count(),
      this.db.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
      this.db.registration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          reference: true,
          name: true,
          courseName: true,
          status: true,
          createdAt: true,
        },
      }),
      this.db.contactMessage.findMany({
        where: { status: { in: ['NAO_LIDA', 'EM_TRATAMENTO'] } },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, name: true, subject: true, status: true, createdAt: true },
      }),
      this.db.event.findMany({
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: 'asc' },
        take: 3,
        select: { id: true, title: true, startsAt: true, location: true, published: true },
      }),
      this.db.classGroup.findMany({
        where: { status: { in: ['ABERTA', 'EM_CURSO'] } },
        select: {
          id: true,
          code: true,
          name: true,
          capacity: true,
          campus: { select: { name: true } },
          period: { select: { startsAt: true } },
        },
        orderBy: { period: { startsAt: 'asc' } },
        take: 50,
      }),
      this.db.registration.count({ where: { waitlisted: true, status: { in: SEAT_STATUSES } } }),
    ]);
    const taken = await seatsTaken(
      this.db,
      openClasses.map((c) => c.id),
    );
    const classes = openClasses.map((c) => ({ ...c, seatsTaken: taken.get(c.id) ?? 0 }));

    const byStatus = Object.fromEntries(
      REGISTRATION_STATUSES.map((s) => [
        s,
        registrationsByStatus.find((r) => r.status === s)?._count._all ?? 0,
      ]),
    ) as Record<RegistrationStatus, number>;
    const messageCount = (status: string) =>
      messagesByStatus.find((m) => m.status === status)?._count._all ?? 0;

    return {
      registrations: {
        total: registrationsTotal,
        thisMonth: registrationsThisMonth,
        lastMonth: registrationsLastMonth,
        byStatus,
        trend: fillMonths(months, registrationsTrend),
        topCourses: topCourses.map((c) => ({ name: c.courseName, total: c._count._all })),
        recent: recentRegistrations,
      },
      messages: {
        total: messagesByStatus.reduce((sum, m) => sum + m._count._all, 0),
        unread: messageCount('NAO_LIDA'),
        inProgress: messageCount('EM_TRATAMENTO'),
        trend: fillMonths(months, messagesTrend),
        recent: recentMessages,
      },
      courses: { total: courses, open: openCourses },
      classes: {
        open: classes.length,
        capacity: classes.reduce((sum, c) => sum + c.capacity, 0),
        occupied: classes.reduce((sum, c) => sum + c.seatsTaken, 0),
        waitlisted,
        top: [...classes]
          .sort((x, y) => y.seatsTaken / y.capacity - x.seatsTaken / x.capacity)
          .slice(0, 6),
      },
      content: { newsPublished, newsDrafts, eventsUpcoming, albums, photos, nextEvents },
    };
  }

  @Get('registrations') async registrations(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '15',
    @Query('q') q = '',
    @Query('status') status = '',
    @Query('course') course = '',
    @Query('campusId') campusId = '',
    @Query('classId') classId = '',
    @Query('waitlisted') waitlisted = '',
  ) {
    await requirePermission(this.db, req, 'registrations.read');
    const p = Math.max(1, Number(page) || 1);
    const n = Math.max(1, Math.min(50, Number(limit) || 15));
    const search = q.trim().slice(0, 100);
    const where: Prisma.RegistrationWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { reference: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
      ...((REGISTRATION_STATUSES as readonly string[]).includes(status)
        ? { status: status as RegistrationStatus }
        : {}),
      ...(course ? { courseName: course } : {}),
      ...(campusId ? { campusId } : {}),
      ...(classId ? { classId } : {}),
      ...(waitlisted === 'true' ? { waitlisted: true } : {}),
    };
    const [data, total] = await Promise.all([
      this.db.registration.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * n,
        take: n,
        select: {
          id: true,
          reference: true,
          name: true,
          phone: true,
          courseName: true,
          province: true,
          status: true,
          waitlisted: true,
          createdAt: true,
          campus: { select: { name: true } },
          classGroup: { select: { id: true, code: true, name: true } },
        },
      }),
      this.db.registration.count({ where }),
    ]);
    return {
      data,
      meta: { page: p, limit: n, total, totalPages: Math.max(1, Math.ceil(total / n)) },
    };
  }

  @Get('registrations/:id') async registration(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'registrations.read');
    const row = await this.db.registration.findUnique({
      where: { id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        campus: { select: { id: true, name: true } },
        classGroup: {
          include: { period: { select: { name: true, startsAt: true, endsAt: true } } },
        },
      },
    });
    if (!row) throw new NotFoundException('Inscrição não encontrada.');
    // Classes the registration can be moved to: same course, any campus, with seats or current.
    const options = row.courseId ? await availableClasses(this.db, row.courseId) : [];
    const authors = await this.db.adminUser.findMany({
      where: { id: { in: [...new Set(row.notes.map((n) => n.adminId))] } },
      select: { id: true, email: true, displayName: true },
    });
    return {
      ...row,
      classOptions: options,
      notes: row.notes.map((n) => {
        const author = authors.find((a) => a.id === n.adminId);
        return { ...n, author: author?.displayName || author?.email || 'Administrador' };
      }),
    };
  }

  @Patch('registrations/:id') async changeRegistration(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: StatusDto,
  ) {
    const a = await requirePermission(this.db, req, 'registrations.manage');
    const current = await this.db.registration.findUnique({
      where: { id },
      select: { status: true, classId: true, courseId: true, campusId: true },
    });
    if (!current) throw new NotFoundException('Inscrição não encontrada.');
    const status = d.status ?? current.status;
    const occupiesSeat = SEAT_STATUSES.includes(status);
    const targetClass = d.classId === undefined ? current.classId : d.classId || null;

    const result = await this.db.$transaction(async (tx) => {
      if (targetClass) {
        const group = await tx.classGroup.findUnique({ where: { id: targetClass } });
        if (!group) throw new BadRequestException('Turma inexistente.');
        if (group.courseId !== current.courseId)
          throw new BadRequestException('A turma escolhida é de outro curso.');
        // Only check capacity when this registration starts occupying a seat in that class.
        const needsSeat =
          occupiesSeat &&
          (targetClass !== current.classId || !SEAT_STATUSES.includes(current.status));
        if (needsSeat && !(await hasFreeSeat(tx, targetClass, id)))
          throw new BadRequestException('A turma escolhida já não tem vagas disponíveis.');
      }
      const updated = await tx.registration.update({
        where: { id },
        data: {
          status,
          classId: targetClass,
          waitlisted: occupiesSeat && !targetClass,
          ...(targetClass && targetClass !== current.classId
            ? {
                campusId: (await tx.classGroup.findUnique({ where: { id: targetClass } }))!
                  .campusId,
              }
            : {}),
        },
      });
      // A seat was released (refused or moved away): offer it to the waiting list.
      const released =
        current.classId &&
        SEAT_STATUSES.includes(current.status) &&
        (!occupiesSeat || targetClass !== current.classId);
      const promoted = released ? await promoteWaitlist(tx, current.classId!) : [];
      return { updated, promoted };
    });

    if (d.note?.trim())
      await this.db.registrationNote.create({
        data: { registrationId: id, adminId: a.id, body: d.note.trim() },
      });
    if (current.status !== status || current.classId !== targetClass)
      await audit(this.db, a.id, `STATUS_${status}`, id, 'registrations', {
        from: current.status,
        fromClass: current.classId,
        toClass: targetClass,
        promoted: result.promoted,
      });
    return { ...result.updated, promoted: result.promoted.length };
  }

  @Get('courses') async courses(@Req() req: Request) {
    await requirePermission(this.db, req, 'courses.manage');
    return this.db.course.findMany({
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { registrations: true } } },
    });
  }

  @Get('courses/areas') async courseAreas(@Req() req: Request) {
    await requirePermission(this.db, req, 'courses.manage');
    return areas.map((a) => ({ name: a.name, icon: a.icon }));
  }

  @Get('courses/:id') async course(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'courses.manage');
    const row = await this.db.course.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Curso não encontrado.');
    return row;
  }

  @Post('courses') async createCourse(@Req() req: Request, @Body() d: CourseDto) {
    const a = await requirePermission(this.db, req, 'courses.manage');
    if (!d.name || !d.area) throw new BadRequestException('Indique o nome e a área do curso.');
    const slug = slugify(d.name);
    if (await this.db.course.findUnique({ where: { slug } }))
      throw new BadRequestException('Já existe um curso com este nome.');
    const row = await this.db.course.create({
      data: {
        name: d.name.trim(),
        area: d.area,
        slug,
        description: d.description?.trim() ?? '',
        published: d.published ?? false,
        enrollmentOpen: d.enrollmentOpen ?? false,
        duration: d.duration ?? null,
        requirements: d.requirements ?? null,
        imageUrl: assertImageUrl(d.imageUrl),
        imagePublicId: d.imagePublicId ?? null,
      },
    });
    await audit(this.db, a.id, 'COURSE_CREATED', row.id, 'courses');
    return row;
  }

  @Patch('courses/:id') async updateCourse(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: CourseDto,
  ) {
    const a = await requirePermission(this.db, req, 'courses.manage');
    const current = await this.db.course.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Curso não encontrado.');
    const imageChanged = d.imageUrl !== undefined && d.imageUrl !== current.imageUrl;
    const row = await this.db.course.update({
      where: { id },
      data: {
        ...d,
        name: d.name?.trim(),
        imageUrl: d.imageUrl === undefined ? undefined : assertImageUrl(d.imageUrl),
        imagePublicId: imageChanged ? (d.imagePublicId ?? null) : undefined,
      },
    });
    if (imageChanged && current.imagePublicId !== row.imagePublicId)
      await deleteImage(current.imagePublicId);
    await audit(this.db, a.id, 'COURSE_UPDATED', id, 'courses', { fields: Object.keys(d) });
    return row;
  }

  @Delete('courses/:id') async deleteCourse(@Req() req: Request, @Param('id') id: string) {
    const a = await requirePermission(this.db, req, 'courses.manage');
    const current = await this.db.course.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Curso não encontrado.');
    await this.db.course.delete({ where: { id } });
    await deleteImage(current.imagePublicId);
    await audit(this.db, a.id, 'COURSE_DELETED', id, 'courses', { name: current.name });
    return { ok: true };
  }
}
