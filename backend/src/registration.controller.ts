import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
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
import { Transform, Type } from 'class-transformer';
import { PrismaService } from './prisma.service';
import { areas, provinces } from './catalog';
import rules from './registration-rules.cjs';
import { institutionEmail, sendEmailInBackground } from './email';
import { registrationNotificationEmail, registrationReceivedEmail } from './email-templates';
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
      const created = await this.db.registration.create({
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
      });
      void this.notify(created);
      return { reference: created.reference, status: created.status, createdAt: created.createdAt };
    } catch {
      throw new BadRequestException('Não foi possível guardar a inscrição. Tente novamente.');
    }
  }

  /** Confirmation to the candidate (when an e-mail was given) and an alert to the institution inbox. */
  private async notify(r: Parameters<typeof registrationNotificationEmail>[0]) {
    if (r.email)
      sendEmailInBackground(
        {
          to: r.email,
          ...registrationReceivedEmail(r),
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
          ...registrationNotificationEmail(r),
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
        imageUrl: true,
      },
    });
  }
}
