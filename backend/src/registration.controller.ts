import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from './prisma.service';
import { areas, provinces } from './catalog';
import rules from './registration-rules.cjs';
import { institutionEmail, sendEmailInBackground } from './email';
import { registrationNotificationEmail, registrationReceivedEmail } from './email-templates';
import { MAX_STUDENT_AGE, MIN_STUDENT_AGE, SHIFTS, STUDENT_OPTIONS } from './constants';
import { allocateClass, availableClasses } from './class-allocation';

const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

class RegistrationDto {
  @IsUUID() submissionKey!: string;
  @IsString() @MinLength(3) @MaxLength(120) name!: string;
  @IsDateString({}, { message: 'Indique uma data de nascimento válida.' }) birthDate!: string;
  @IsIn(STUDENT_OPTIONS.genders, { message: 'Seleccione o género.' }) gender!: string;
  @Transform(optional) @IsOptional() @IsIn(STUDENT_OPTIONS.documentTypes) documentType?: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(40) documentNumber?: string;
  @IsIn(STUDENT_OPTIONS.educationLevels, { message: 'Seleccione o nível de escolaridade.' })
  educationLevel!: string;
  @Transform(optional) @IsOptional() @IsIn(STUDENT_OPTIONS.occupations) occupation?: string;
  @IsString() @MinLength(8) @MaxLength(24) phone!: string;
  @Transform(optional) @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsString() province!: string;
  @IsString() district!: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(200) address?: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(120) emergencyName?: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(24) emergencyPhone?: string;
  @IsString() area!: string;
  @IsString() course!: string;
  @IsString({ message: 'Seleccione o pólo onde pretende estudar.' }) campusId!: string;
  @Transform(optional) @IsOptional() @IsString() preferredClassId?: string;
  @Transform(optional) @IsOptional() @IsIn(STUDENT_OPTIONS.referralSources) referralSource?: string;
  @Transform(optional) @IsOptional() @IsString() @MaxLength(1000) message?: string;
  @Transform(({ value }) => value === true || value === 'true' || value === 'on')
  @IsBoolean()
  consent!: boolean;
}

function ageOn(birth: Date, today = new Date()) {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

@Controller('registrations')
export class RegistrationController {
  constructor(private db: PrismaService) {}

  /** Everything the public form needs, so options are defined once in the API. */
  @Get('form-options') async formOptions() {
    const campuses = await this.db.campus.findMany({
      where: { active: true },
      select: { id: true, name: true, city: true, address: true },
      orderBy: { name: 'asc' },
    });
    return {
      campuses,
      ...STUDENT_OPTIONS,
      shifts: SHIFTS,
      minAge: MIN_STUDENT_AGE,
      maxAge: MAX_STUDENT_AGE,
    };
  }

  /** Open classes with free seats for a course (by name) at a campus. */
  @Get('availability') async availability(
    @Query('course') courseName = '',
    @Query('area') area = '',
    @Query('campusId') campusId = '',
  ) {
    const course = await this.db.course.findFirst({
      where: { name: courseName, area, published: true },
      select: { id: true },
    });
    if (!course || !campusId) return [];
    return availableClasses(this.db, course.id, campusId);
  }

  @Get(':reference/summary') async summary(@Param('reference') reference: string) {
    const r = await this.db.registration.findUnique({
      where: { reference },
      select: {
        reference: true,
        courseName: true,
        waitlisted: true,
        campus: { select: { name: true } },
        classGroup: {
          select: {
            name: true,
            shift: true,
            schedule: true,
            period: { select: { name: true, startsAt: true } },
          },
        },
      },
    });
    if (!r) throw new BadRequestException('Inscrição não encontrada.');
    return r;
  }

  @Post() @Throttle({ default: { limit: 4, ttl: 60000 } }) async create(
    @Body() d: RegistrationDto,
  ) {
    if (!d.consent)
      throw new BadRequestException('O consentimento é necessário para enviar a inscrição.');
    const previous = await this.db.registration.findUnique({
      where: { submissionKey: d.submissionKey },
      select: { reference: true, status: true, createdAt: true, waitlisted: true },
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
    const birthDate = new Date(d.birthDate);
    const age = ageOn(birthDate);
    if (Number.isNaN(age) || age < MIN_STUDENT_AGE || age > MAX_STUDENT_AGE)
      throw new BadRequestException(
        `A idade deve estar entre ${MIN_STUDENT_AGE} e ${MAX_STUDENT_AGE} anos.`,
      );
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
    const campus = await this.db.campus.findFirst({ where: { id: d.campusId, active: true } });
    if (!campus) throw new BadRequestException('Seleccione um pólo válido.');

    const reference = rules.createReference();
    let created;
    try {
      created = await this.db.$transaction(async (tx) => {
        const classId = await allocateClass(tx, match.id, campus.id, d.preferredClassId);
        return tx.registration.create({
          data: {
            reference,
            submissionKey: d.submissionKey,
            name: d.name.trim(),
            birthDate,
            age,
            gender: d.gender,
            documentType: d.documentType ?? null,
            documentNumber: d.documentNumber ?? null,
            educationLevel: d.educationLevel,
            occupation: d.occupation ?? null,
            phone: d.phone.trim(),
            email: d.email?.toLowerCase() ?? null,
            province: d.province,
            district: d.district,
            address: d.address ?? null,
            emergencyName: d.emergencyName ?? null,
            emergencyPhone: d.emergencyPhone ?? null,
            area: d.area,
            courseName: d.course,
            courseId: match.id,
            campusId: campus.id,
            classId,
            waitlisted: !classId,
            referralSource: d.referralSource ?? null,
            message: d.message ?? null,
            consentedAt: new Date(),
          },
          include: {
            campus: { select: { name: true } },
            classGroup: { select: { name: true, period: { select: { startsAt: true } } } },
          },
        });
      });
    } catch {
      throw new BadRequestException('Não foi possível guardar a inscrição. Tente novamente.');
    }
    void this.notify(created);
    return {
      reference: created.reference,
      status: created.status,
      createdAt: created.createdAt,
      waitlisted: created.waitlisted,
    };
  }

  /** Confirmation to the candidate (when an e-mail was given) and an alert to the institution inbox. */
  private async notify(
    r: Parameters<typeof registrationNotificationEmail>[0] & {
      campus: { name: string } | null;
      classGroup: { name: string; period: { startsAt: Date } } | null;
      waitlisted: boolean;
    },
  ) {
    const placement = {
      campusName: r.campus?.name,
      className: r.classGroup?.name,
      startsAt: r.classGroup?.period.startsAt,
      waitlisted: r.waitlisted,
    };
    if (r.email)
      sendEmailInBackground(
        {
          to: r.email,
          ...registrationReceivedEmail({ ...r, ...placement }),
          tags: { type: 'registration_received' },
          idempotencyKey: `registration-${r.id}`,
        },
        `Confirmação da inscrição ${r.reference}`,
      );
    const to = await institutionEmail(this.db);
    if (to)
      sendEmailInBackground(
        {
          to,
          ...registrationNotificationEmail({ ...r, ...placement }),
          replyTo: r.email ?? undefined,
          tags: { type: 'registration_notification' },
          idempotencyKey: `registration-admin-${r.id}`,
        },
        `Aviso da inscrição ${r.reference}`,
      );
  }
}

@Controller('courses')
export class PublicCoursesController {
  constructor(private db: PrismaService) {}

  @Get() async list() {
    const courses = await this.db.course.findMany({
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
        imageUrl: true,
      },
    });
    // Next start date per course, so the catalogue can show "Próxima turma".
    const upcoming = await this.db.classGroup.findMany({
      where: {
        courseId: { in: courses.map((c) => c.id) },
        status: 'ABERTA',
        period: { active: true, startsAt: { gte: new Date() } },
      },
      select: { courseId: true, period: { select: { startsAt: true } } },
      orderBy: { period: { startsAt: 'asc' } },
    });
    return courses.map((c) => ({
      ...c,
      nextStart: upcoming.find((u) => u.courseId === c.id)?.period.startsAt ?? null,
    }));
  }
}
