import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { audit, requirePermission } from './auth';
import { CLASS_STATUSES, SEAT_STATUSES, SHIFTS } from './constants';
import { promoteWaitlist, seatsTaken } from './class-allocation';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

class CampusDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(300) address?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

class PeriodDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(80) name?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @Transform(emptyToNull) @IsDateString() endsAt?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsDateString() enrollmentClosesAt?: string | null;
  @IsOptional() @IsBoolean() active?: boolean;
}

class ExtendPeriodDto {
  @IsOptional() @Transform(emptyToNull) @IsDateString() endsAt?: string | null;
  @IsOptional() @Transform(emptyToNull) @IsDateString() enrollmentClosesAt?: string | null;
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class ClassDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) name?: string;
  @IsOptional() @IsString() courseId?: string;
  @IsOptional() @IsString() campusId?: string;
  @IsOptional() @IsString() periodId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(500) capacity?: number;
  @IsOptional() @IsIn(Object.keys(SHIFTS)) shift?: string;
  @IsOptional() @IsString() @MaxLength(200) schedule?: string;
  @IsOptional() @IsIn(CLASS_STATUSES) status?: string;
}

function initials(value: string, size = 3) {
  const words = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 || /\d/.test(w));
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? 'X');
  return letters.slice(0, size).toUpperCase();
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

@Controller('admin')
export class ClassesController {
  constructor(private db: PrismaService) {}

  /* ---------- Options for forms and filters ---------- */
  @Get('classes/options') async options(@Req() req: Request) {
    await requirePermission(this.db, req, 'classes.read');
    const [courses, campuses, periods] = await Promise.all([
      this.db.course.findMany({
        select: { id: true, name: true, area: true },
        orderBy: { name: 'asc' },
      }),
      this.db.campus.findMany({ orderBy: { name: 'asc' } }),
      this.db.period.findMany({ orderBy: { startsAt: 'desc' } }),
    ]);
    return { courses, campuses, periods, shifts: SHIFTS, statuses: CLASS_STATUSES };
  }

  /* ---------- Classes ---------- */
  @Get('classes') async list(
    @Req() req: Request,
    @Query('campusId') campusId = '',
    @Query('periodId') periodId = '',
    @Query('courseId') courseId = '',
    @Query('status') status = '',
  ) {
    await requirePermission(this.db, req, 'classes.read');
    const where: Prisma.ClassGroupWhereInput = {
      ...(campusId ? { campusId } : {}),
      ...(periodId ? { periodId } : {}),
      ...(courseId ? { courseId } : {}),
      ...((CLASS_STATUSES as readonly string[]).includes(status) ? { status } : {}),
    };
    const rows = await this.db.classGroup.findMany({
      where,
      include: {
        course: { select: { id: true, name: true, area: true } },
        campus: { select: { id: true, name: true } },
        period: { select: { id: true, name: true, startsAt: true, endsAt: true } },
      },
      orderBy: [{ period: { startsAt: 'desc' } }, { name: 'asc' }],
    });
    const taken = await seatsTaken(
      this.db,
      rows.map((r) => r.id),
    );
    const waitlist = await this.db.registration.groupBy({
      by: ['courseId', 'campusId'],
      where: { waitlisted: true, status: { in: SEAT_STATUSES } },
      _count: { _all: true },
    });
    return rows.map((r) => ({
      ...r,
      seatsTaken: taken.get(r.id) ?? 0,
      waitlist:
        waitlist.find((w) => w.courseId === r.courseId && w.campusId === r.campusId)?._count._all ??
        0,
    }));
  }

  @Get('classes/:id') async detail(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'classes.read');
    const row = await this.db.classGroup.findUnique({
      where: { id },
      include: {
        course: { select: { id: true, name: true, area: true } },
        campus: true,
        period: true,
        registrations: {
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            reference: true,
            name: true,
            phone: true,
            email: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Turma não encontrada.');
    const occupied = row.registrations.filter((r) => SEAT_STATUSES.includes(r.status)).length;
    return { ...row, seatsTaken: occupied };
  }

  @Get('classes/:id/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async export(@Req() req: Request, @Param('id') id: string) {
    const a = await requirePermission(this.db, req, 'registrations.export');
    const row = await this.db.classGroup.findUnique({
      where: { id },
      include: {
        course: true,
        campus: true,
        period: true,
        registrations: { orderBy: { name: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException('Turma não encontrada.');
    const header = [
      'Referência',
      'Nome',
      'Estado',
      'Telefone',
      'E-mail',
      'Data de nascimento',
      'Género',
      'Documento',
      'Escolaridade',
      'Província',
      'Distrito',
      'Data de inscrição',
    ];
    const lines = row.registrations.map((r) =>
      [
        r.reference,
        r.name,
        r.status,
        r.phone,
        r.email,
        r.birthDate?.toISOString().slice(0, 10),
        r.gender,
        [r.documentType, r.documentNumber].filter(Boolean).join(' '),
        r.educationLevel,
        r.province,
        r.district,
        r.createdAt.toISOString().slice(0, 10),
      ]
        .map(csvCell)
        .join(';'),
    );
    await audit(this.db, a.id, 'CLASS_EXPORTED', id, 'classes', { rows: lines.length });
    const title = `${row.code} — ${row.course.name} — ${row.campus.name} — ${row.period.name}`;
    // BOM so Excel opens accents correctly; ';' is the separator Excel expects in pt locales.
    return `﻿${csvCell(title)}\n${header.join(';')}\n${lines.join('\n')}\n`;
  }

  @Post('classes') async create(@Req() req: Request, @Body() d: ClassDto) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    if (!d.courseId || !d.campusId || !d.periodId || !d.capacity)
      throw new BadRequestException('Indique o curso, o pólo, o período e o número de vagas.');
    const [course, campus, period] = await Promise.all([
      this.db.course.findUnique({ where: { id: d.courseId } }),
      this.db.campus.findUnique({ where: { id: d.campusId } }),
      this.db.period.findUnique({ where: { id: d.periodId } }),
    ]);
    if (!course || !campus || !period)
      throw new BadRequestException('Curso, pólo ou período inexistente.');
    const prefix = `${initials(course.name)}-${initials(campus.name)}-${period.startsAt.getFullYear()}`;
    const sequence =
      (await this.db.classGroup.count({ where: { code: { startsWith: prefix } } })) + 1;
    const shift = d.shift ?? 'MANHA';
    const row = await this.db.classGroup.create({
      data: {
        code: `${prefix}-${String(sequence).padStart(2, '0')}`,
        name: d.name?.trim() || `${course.name} · ${SHIFTS[shift as keyof typeof SHIFTS]}`,
        courseId: course.id,
        campusId: campus.id,
        periodId: period.id,
        capacity: d.capacity,
        shift,
        schedule: d.schedule?.trim() ?? '',
        status: d.status ?? 'ABERTA',
      },
    });
    // A new class may absorb people already waiting for this course and campus.
    const promoted = await this.db.$transaction((tx) => promoteWaitlist(tx, row.id));
    await audit(this.db, a.id, 'CLASS_CREATED', row.id, 'classes', { promoted: promoted.length });
    return { ...row, promoted: promoted.length };
  }

  @Patch('classes/:id') async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: ClassDto,
  ) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const current = await this.db.classGroup.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Turma não encontrada.');
    if (d.capacity !== undefined) {
      const occupied = (await seatsTaken(this.db, [id])).get(id) ?? 0;
      if (d.capacity < occupied)
        throw new BadRequestException(
          `A turma já tem ${occupied} estudantes. O número de vagas não pode ser inferior.`,
        );
    }
    if (d.courseId && d.courseId !== current.courseId) {
      const occupied = await this.db.registration.count({ where: { classId: id } });
      if (occupied)
        throw new BadRequestException('Não é possível mudar o curso de uma turma com inscrições.');
    }
    const row = await this.db.classGroup.update({
      where: { id },
      data: { ...d, name: d.name?.trim(), schedule: d.schedule?.trim() },
    });
    const promoted = await this.db.$transaction((tx) => promoteWaitlist(tx, id));
    await audit(this.db, a.id, 'CLASS_UPDATED', id, 'classes', {
      fields: Object.keys(d),
      promoted: promoted.length,
    });
    return { ...row, promoted: promoted.length };
  }

  @Delete('classes/:id') async remove(@Req() req: Request, @Param('id') id: string) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const registrations = await this.db.registration.count({ where: { classId: id } });
    if (registrations)
      throw new ConflictException(
        `A turma tem ${registrations} inscrições. Mude o estado para «Cancelada» em vez de eliminar.`,
      );
    await this.db.classGroup.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Turma não encontrada.');
    });
    await audit(this.db, a.id, 'CLASS_DELETED', id, 'classes');
    return { ok: true };
  }

  /* ---------- Periods ---------- */
  @Get('periods') async periods(@Req() req: Request) {
    await requirePermission(this.db, req, 'classes.read');
    return this.db.period.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        _count: { select: { classes: true, extensions: true } },
        extensions: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  @Post('periods') async createPeriod(@Req() req: Request, @Body() d: PeriodDto) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    if (!d.name || !d.startsAt) throw new BadRequestException('Indique o nome e a data de início.');
    this.assertPeriodDates(d);
    const row = await this.db.period.create({
      data: {
        name: d.name.trim(),
        startsAt: new Date(d.startsAt),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        enrollmentClosesAt: d.enrollmentClosesAt ? new Date(d.enrollmentClosesAt) : null,
        active: d.active ?? true,
      },
    });
    await audit(this.db, a.id, 'PERIOD_CREATED', row.id, 'classes');
    return row;
  }

  @Patch('periods/:id') async updatePeriod(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: PeriodDto,
  ) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const current = await this.db.period.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Período não encontrado.');
    this.assertPeriodDates({
      startsAt: d.startsAt ?? current.startsAt.toISOString(),
      endsAt: d.endsAt === undefined ? current.endsAt?.toISOString() : d.endsAt,
    });
    const row = await this.db.period.update({
      where: { id },
      data: {
        name: d.name?.trim(),
        active: d.active,
        startsAt: d.startsAt ? new Date(d.startsAt) : undefined,
        endsAt: d.endsAt === undefined ? undefined : d.endsAt ? new Date(d.endsAt) : null,
        enrollmentClosesAt:
          d.enrollmentClosesAt === undefined
            ? undefined
            : d.enrollmentClosesAt
              ? new Date(d.enrollmentClosesAt)
              : null,
      },
    });
    await audit(this.db, a.id, 'PERIOD_UPDATED', id, 'classes', { fields: Object.keys(d) });
    return row;
  }

  /**
   * Pushes back the end of lessons and/or the enrollment deadline. Dates may only move later;
   * every extension is kept in the history and open classes may absorb the waiting list again.
   */
  @Post('periods/:id/extend') async extendPeriod(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: ExtendPeriodDto,
  ) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const current = await this.db.period.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Período não encontrado.');
    if (!d.endsAt && !d.enrollmentClosesAt)
      throw new BadRequestException('Indique a nova data de fim ou o novo prazo de inscrições.');

    const newEnds = d.endsAt ? new Date(d.endsAt) : null;
    const newClose = d.enrollmentClosesAt ? new Date(d.enrollmentClosesAt) : null;
    if (newEnds && current.endsAt && newEnds <= current.endsAt)
      throw new BadRequestException('A nova data de fim deve ser posterior à actual.');
    if (newEnds && newEnds <= current.startsAt)
      throw new BadRequestException('A data de fim deve ser posterior ao início das aulas.');
    if (newClose && current.enrollmentClosesAt && newClose <= current.enrollmentClosesAt)
      throw new BadRequestException('O novo prazo de inscrições deve ser posterior ao actual.');
    const finalEnds = newEnds ?? current.endsAt;
    if (newClose && finalEnds && newClose > finalEnds)
      throw new BadRequestException('O prazo de inscrições não pode ultrapassar o fim das aulas.');

    const { period, promoted } = await this.db.$transaction(async (tx) => {
      const period = await tx.period.update({
        where: { id },
        data: {
          ...(newEnds ? { endsAt: newEnds } : {}),
          ...(newClose ? { enrollmentClosesAt: newClose } : {}),
          active: true,
        },
      });
      await tx.periodExtension.create({
        data: {
          periodId: id,
          adminId: a.id,
          reason: d.reason?.trim() ?? '',
          previousEndsAt: current.endsAt,
          newEndsAt: newEnds,
          previousEnrollmentClosesAt: current.enrollmentClosesAt,
          newEnrollmentClosesAt: newClose,
        },
      });
      // Classes of this period may be accepting again: give their seats to the waiting list.
      const classes = await tx.classGroup.findMany({
        where: { periodId: id, status: 'ABERTA' },
        select: { id: true },
      });
      let promoted = 0;
      for (const c of classes) promoted += (await promoteWaitlist(tx, c.id)).length;
      return { period, promoted };
    });
    await audit(this.db, a.id, 'PERIOD_EXTENDED', id, 'classes', {
      endsAt: newEnds,
      enrollmentClosesAt: newClose,
      promoted,
    });
    return { ...period, promoted };
  }

  @Delete('periods/:id') async removePeriod(@Req() req: Request, @Param('id') id: string) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const classes = await this.db.classGroup.count({ where: { periodId: id } });
    if (classes)
      throw new ConflictException(
        `Este período tem ${classes} turmas. Desactive-o em vez de o eliminar.`,
      );
    await this.db.period.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Período não encontrado.');
    });
    await audit(this.db, a.id, 'PERIOD_DELETED', id, 'classes');
    return { ok: true };
  }

  /* ---------- Campuses ---------- */
  @Get('campuses') async campuses(@Req() req: Request) {
    await requirePermission(this.db, req, 'classes.read');
    return this.db.campus.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { classes: true, registrations: true } } },
    });
  }

  @Post('campuses') async createCampus(@Req() req: Request, @Body() d: CampusDto) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    if (!d.name || !d.city) throw new BadRequestException('Indique o nome e a cidade do pólo.');
    try {
      const row = await this.db.campus.create({
        data: {
          name: d.name.trim(),
          city: d.city.trim(),
          address: d.address?.trim() ?? '',
          active: d.active ?? true,
        },
      });
      await audit(this.db, a.id, 'CAMPUS_CREATED', row.id, 'classes');
      return row;
    } catch {
      throw new ConflictException('Já existe um pólo com este nome.');
    }
  }

  @Patch('campuses/:id') async updateCampus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: CampusDto,
  ) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    try {
      const row = await this.db.campus.update({
        where: { id },
        data: {
          name: d.name?.trim(),
          city: d.city?.trim(),
          address: d.address?.trim(),
          active: d.active,
        },
      });
      await audit(this.db, a.id, 'CAMPUS_UPDATED', id, 'classes', { fields: Object.keys(d) });
      return row;
    } catch {
      throw new ConflictException('Não foi possível guardar. Verifique se o nome já existe.');
    }
  }

  @Delete('campuses/:id') async removeCampus(@Req() req: Request, @Param('id') id: string) {
    const a = await requirePermission(this.db, req, 'classes.manage');
    const [classes, registrations] = await Promise.all([
      this.db.classGroup.count({ where: { campusId: id } }),
      this.db.registration.count({ where: { campusId: id } }),
    ]);
    if (classes || registrations)
      throw new ConflictException(
        'Este pólo já tem turmas ou inscrições. Desactive-o em vez de o eliminar.',
      );
    await this.db.campus.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Pólo não encontrado.');
    });
    await audit(this.db, a.id, 'CAMPUS_DELETED', id, 'classes');
    return { ok: true };
  }

  private assertPeriodDates(d: { startsAt?: string; endsAt?: string | null }) {
    if (d.startsAt && d.endsAt && new Date(d.endsAt) <= new Date(d.startsAt))
      throw new BadRequestException('A data de fim deve ser posterior à data de início.');
  }
}
