import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  IsEmail,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { audit, requireAdmin, requirePermission } from './auth';
import { emailProvider, institutionEmail, sendEmail, sendEmailInBackground } from './email';
import { contactNotificationEmail, contactReplyEmail, testEmail } from './email-templates';
import { assertImageUrl, deleteImage } from './cloudinary';
import {
  CONTACT_CATEGORIES,
  MESSAGE_STATUSES,
  SETTING_KEYS,
  type MessageStatus,
  type SettingKey,
} from './constants';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);
const logger = new Logger('Communications');

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(254) email!: string;
  @IsString() @MinLength(2) @MaxLength(180) subject!: string;
  @IsIn(CONTACT_CATEGORIES) category!: string;
  @IsString() @MinLength(10) @MaxLength(10000) body!: string;
}
class MessageStatusDto {
  @IsIn(MESSAGE_STATUSES) status!: MessageStatus;
}
class ReplyDto {
  @IsString() @MinLength(1) @MaxLength(10000) body!: string;
}
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(2000) profilePhotoUrl?:
    string | null;
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(300)
  profilePhotoPublicId?: string | null;
}
class PasswordDto {
  @IsString() @MinLength(8) @MaxLength(200) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(200) newPassword!: string;
}
class SettingsDto {
  @IsObject() values!: Record<string, string>;
}

@Controller('contact-messages')
export class PublicContactController {
  constructor(private db: PrismaService) {}

  @Post() @Throttle({ default: { limit: 4, ttl: 60000 } }) async create(@Body() d: ContactDto) {
    const row = await this.db.contactMessage.create({
      data: {
        name: d.name.trim(),
        email: d.email.toLowerCase(),
        subject: d.subject.trim(),
        category: d.category,
        body: d.body.trim(),
      },
    });
    const to = await institutionEmail(this.db);
    if (to)
      sendEmailInBackground(
        {
          to,
          ...contactNotificationEmail(row),
          // Replying from the institution inbox goes straight to the visitor.
          replyTo: row.email,
          tags: { type: 'contact_notification' },
          idempotencyKey: `contact-${row.id}`,
        },
        `Notificação da mensagem ${row.id}`,
      );
    return { ok: true, message: 'Mensagem recebida. A equipa do GIO CPF entrará em contacto.' };
  }
}

@Controller('admin/contact-messages')
export class AdminContactController {
  constructor(private db: PrismaService) {}

  @Get() async list(
    @Req() req: Request,
    @Query('page') page = '1',
    @Query('limit') limit = '15',
    @Query('q') q = '',
    @Query('status') status = '',
    @Query('category') category = '',
  ) {
    await requirePermission(this.db, req, 'messages.read');
    const p = Math.max(1, Number(page) || 1);
    const n = Math.max(1, Math.min(50, Number(limit) || 15));
    const search = q.trim().slice(0, 100);
    const where: Prisma.ContactMessageWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { subject: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...((MESSAGE_STATUSES as readonly string[]).includes(status)
        ? { status: status as MessageStatus }
        : { status: { not: 'ARQUIVADA' } }),
      ...(category ? { category } : {}),
    };
    const [data, total, counts] = await Promise.all([
      this.db.contactMessage.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          subject: true,
          category: true,
          status: true,
          createdAt: true,
          body: true,
          assignedAdmin: { select: { email: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (p - 1) * n,
        take: n,
      }),
      this.db.contactMessage.count({ where }),
      this.db.contactMessage.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    return {
      data: data.map(({ body, ...m }) => ({ ...m, preview: body.slice(0, 140) })),
      meta: { page: p, limit: n, total, totalPages: Math.max(1, Math.ceil(total / n)) },
      counts: Object.fromEntries(
        MESSAGE_STATUSES.map((s) => [s, counts.find((c) => c.status === s)?._count._all ?? 0]),
      ),
    };
  }

  @Get(':id') async detail(@Req() req: Request, @Param('id') id: string) {
    await requirePermission(this.db, req, 'messages.read');
    const row = await this.db.contactMessage.findUnique({
      where: { id },
      include: {
        replies: {
          include: { admin: { select: { email: true, displayName: true } } },
          orderBy: { createdAt: 'asc' },
        },
        assignedAdmin: { select: { email: true, displayName: true } },
      },
    });
    if (!row) throw new NotFoundException('Mensagem não encontrada.');
    if (row.status === 'NAO_LIDA') {
      await this.db.contactMessage.update({ where: { id }, data: { status: 'LIDA' } });
      row.status = 'LIDA';
    }
    return row;
  }

  @Patch(':id/status') async setStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: MessageStatusDto,
  ) {
    const admin = await requirePermission(this.db, req, 'messages.manage');
    const row = await this.db.contactMessage
      .update({ where: { id }, data: { status: d.status, assignedAdminId: admin.id } })
      .catch(() => {
        throw new NotFoundException('Mensagem não encontrada.');
      });
    await audit(this.db, admin.id, `MESSAGE_${d.status}`, id, 'communications');
    return row;
  }

  @Post(':id/replies') async reply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: ReplyDto,
  ) {
    const admin = await requirePermission(this.db, req, 'messages.reply');
    const message = await this.db.contactMessage.findUnique({ where: { id } });
    if (!message) throw new NotFoundException('Mensagem não encontrada.');
    const body = d.body.trim();
    const saved = await this.db.messageReply.create({
      data: { messageId: id, adminId: admin.id, body },
    });
    await this.db.contactMessage.update({
      where: { id },
      data: { status: 'RESPONDIDA', assignedAdminId: admin.id },
    });
    let emailSent = true;
    try {
      await sendEmail({
        to: message.email,
        ...contactReplyEmail(message, body, admin.displayName || 'Equipa GIO'),
        replyTo: (await institutionEmail(this.db)) ?? undefined,
        tags: { type: 'contact_reply' },
        idempotencyKey: `reply-${saved.id}`,
      });
    } catch (error) {
      logger.warn(`Resposta ${saved.id} não enviada: ${String(error)}`);
      emailSent = false;
    }
    await audit(this.db, admin.id, 'MESSAGE_REPLIED', id, 'communications', { emailSent });
    return { saved, emailSent };
  }

  @Delete(':id') async remove(@Req() req: Request, @Param('id') id: string) {
    const admin = await requirePermission(this.db, req, 'messages.manage');
    await this.db.contactMessage.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Mensagem não encontrada.');
    });
    await audit(this.db, admin.id, 'MESSAGE_DELETED', id, 'communications');
    return { ok: true };
  }
}

const profileSelect = {
  id: true,
  email: true,
  displayName: true,
  phone: true,
  profilePhotoUrl: true,
  createdAt: true,
  lastLoginAt: true,
  isSuperAdmin: true,
  role: { select: { name: true } },
} satisfies Prisma.AdminUserSelect;

@Controller('admin/profile')
export class AdminProfileController {
  constructor(private db: PrismaService) {}

  @Get() async get(@Req() req: Request) {
    const a = await requireAdmin(this.db, req);
    const row = await this.db.adminUser.findUnique({ where: { id: a.id }, select: profileSelect });
    return { ...row, permissions: a.effectivePermissions };
  }

  @Patch() async update(@Req() req: Request, @Body() d: ProfileDto) {
    const a = await requireAdmin(this.db, req);
    const photoChanged = d.profilePhotoUrl !== undefined && d.profilePhotoUrl !== a.profilePhotoUrl;
    const updated = await this.db.adminUser.update({
      where: { id: a.id },
      data: {
        displayName: d.displayName?.trim(),
        phone: d.phone === undefined ? undefined : d.phone.trim() || null,
        ...(photoChanged
          ? {
              profilePhotoUrl: assertImageUrl(d.profilePhotoUrl),
              profilePhotoPublicId: d.profilePhotoUrl ? (d.profilePhotoPublicId ?? null) : null,
            }
          : {}),
      },
      select: profileSelect,
    });
    if (photoChanged) await deleteImage(a.profilePhotoPublicId);
    await audit(this.db, a.id, 'PROFILE_UPDATED', a.id, 'users');
    return updated;
  }

  @Patch('password') @Throttle({ default: { limit: 5, ttl: 60000 } }) async password(
    @Req() req: Request,
    @Body() d: PasswordDto,
  ) {
    const a = await requireAdmin(this.db, req);
    if (!(await bcrypt.compare(d.currentPassword, a.passwordHash)))
      throw new BadRequestException('A palavra-passe actual está incorrecta.');
    if (d.currentPassword === d.newPassword)
      throw new BadRequestException('A nova palavra-passe deve ser diferente da actual.');
    await this.db.adminUser.update({
      where: { id: a.id },
      data: { passwordHash: await bcrypt.hash(d.newPassword, 12) },
    });
    await audit(this.db, a.id, 'PASSWORD_CHANGED', a.id, 'users');
    return { ok: true };
  }
}

@Controller('admin/institution-settings')
export class InstitutionSettingsController {
  constructor(private db: PrismaService) {}

  @Get('email') async emailStatus(@Req() req: Request) {
    await requirePermission(this.db, req, 'settings.manage');
    return {
      provider: emailProvider(),
      from: process.env.MAIL_FROM ?? null,
      replyTo: process.env.MAIL_REPLY_TO ?? null,
      notificationsTo: await institutionEmail(this.db),
    };
  }

  @Post('email/test') @Throttle({ default: { limit: 3, ttl: 60000 } }) async emailTest(
    @Req() req: Request,
  ) {
    const a = await requirePermission(this.db, req, 'settings.manage');
    try {
      const result = await sendEmail({
        to: a.email,
        ...testEmail(a.displayName || a.email),
        tags: { type: 'test' },
      });
      return { ok: true, ...result, to: a.email };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Não foi possível enviar o e-mail de teste.',
      );
    }
  }

  @Get() async list(@Req() req: Request) {
    await requirePermission(this.db, req, 'settings.manage');
    const rows = await this.db.institutionSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, typeof r.value === 'string' ? r.value : '']));
  }

  @Patch() async save(@Req() req: Request, @Body() d: SettingsDto) {
    const a = await requirePermission(this.db, req, 'settings.manage');
    const entries = Object.entries(d.values);
    for (const [key, value] of entries) {
      if (!(SETTING_KEYS as readonly string[]).includes(key))
        throw new BadRequestException(`Configuração desconhecida: ${key}.`);
      if (typeof value !== 'string' || value.length > 500)
        throw new BadRequestException('Cada valor deve ter no máximo 500 caracteres.');
    }
    const values = d.values as Partial<Record<SettingKey, string>>;
    if (values.institutionEmail && !/^\S+@\S+\.\S+$/.test(values.institutionEmail))
      throw new BadRequestException('O e-mail institucional não é válido.');
    if (values.logoUrl) assertImageUrl(values.logoUrl);

    const previousLogo = await this.db.institutionSetting.findUnique({
      where: { key: 'logoPublicId' },
    });
    await this.db.$transaction(
      entries.map(([key, value]) =>
        this.db.institutionSetting.upsert({
          where: { key },
          create: { key, value: value.trim(), updatedById: a.id },
          update: { value: value.trim(), updatedById: a.id },
        }),
      ),
    );
    const oldLogoId = typeof previousLogo?.value === 'string' ? previousLogo.value : null;
    if ('logoPublicId' in values && oldLogoId && oldLogoId !== values.logoPublicId)
      await deleteImage(oldLogoId);
    await audit(this.db, a.id, 'SETTINGS_UPDATED', 'institution', 'institution', {
      keys: entries.map(([k]) => k),
    });
    return this.list(req);
  }
}
