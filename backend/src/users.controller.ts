import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { audit, effectivePermissions, requirePermission } from './auth';
import { PERMISSION_KEYS, PERMISSIONS } from './constants';
import { deleteImage } from './cloudinary';

const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

class CreateAdminDto {
  @IsEmail() @MaxLength(254) email!: string;
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsString() @MinLength(12) @MaxLength(200) password!: string;
  @IsOptional() @Transform(emptyToNull) @IsString() roleId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: string[];
}

class UpdateAdminDto {
  @IsOptional() @IsString() @MaxLength(120) displayName?: string;
  @IsOptional() @Transform(emptyToNull) @IsString() roleId?: string | null;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

class RoleDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(60) name?: string;
  @IsOptional() @IsString() @MaxLength(240) description?: string;
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PERMISSION_KEYS, { each: true })
  permissions?: string[];
}

const adminSelect = {
  id: true,
  email: true,
  displayName: true,
  profilePhotoUrl: true,
  isSuperAdmin: true,
  active: true,
  permissions: true,
  lastLoginAt: true,
  createdAt: true,
  role: { select: { id: true, name: true, permissions: true } },
} satisfies Prisma.AdminUserSelect;

@Controller('admin')
export class AdminUsersController {
  constructor(private db: PrismaService) {}

  @Get('permissions') async permissions(@Req() req: Request) {
    await requirePermission(this.db, req, 'users.manage');
    return PERMISSIONS;
  }

  @Get('admin-users') async list(@Req() req: Request) {
    await requirePermission(this.db, req, 'users.manage');
    const rows = await this.db.adminUser.findMany({
      select: adminSelect,
      orderBy: [{ isSuperAdmin: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map((row) => ({
      ...row,
      effectivePermissions: effectivePermissions(row),
    }));
  }

  @Post('admin-users') async create(@Req() req: Request, @Body() d: CreateAdminDto) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    const email = d.email.toLowerCase().trim();
    if (await this.db.adminUser.findUnique({ where: { email } }))
      throw new ConflictException('Já existe um administrador com este e-mail.');
    if (d.roleId) await this.findRole(d.roleId);
    const row = await this.db.adminUser.create({
      data: {
        email,
        displayName: d.displayName?.trim() ?? '',
        passwordHash: await bcrypt.hash(d.password, 12),
        roleId: d.roleId ?? null,
        permissions: d.permissions ?? [],
      },
      select: adminSelect,
    });
    await audit(this.db, actor.id, 'ADMIN_CREATED', row.id, 'users');
    return row;
  }

  @Patch('admin-users/:id') async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: UpdateAdminDto,
  ) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    const target = await this.findAdmin(id);
    if (target.isSuperAdmin && !actor.isSuperAdmin)
      throw new BadRequestException('Só o administrador principal pode alterar esta conta.');
    if (id === actor.id && d.active === false)
      throw new BadRequestException('Não pode desactivar a sua própria conta.');
    if (d.roleId) await this.findRole(d.roleId);
    const row = await this.db.adminUser.update({
      where: { id },
      data: {
        displayName: d.displayName?.trim(),
        roleId: d.roleId === undefined ? undefined : d.roleId,
        permissions: d.permissions,
        active: d.active,
      },
      select: adminSelect,
    });
    if (d.active === false) await this.db.adminSession.deleteMany({ where: { adminId: id } });
    await audit(this.db, actor.id, 'ADMIN_UPDATED', id, 'users', { fields: Object.keys(d) });
    return row;
  }

  @Delete('admin-users/:id') async remove(@Req() req: Request, @Param('id') id: string) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    const target = await this.findAdmin(id);
    if (id === actor.id) throw new BadRequestException('Não pode eliminar a sua própria conta.');
    if (target.isSuperAdmin)
      throw new BadRequestException('O administrador principal não pode ser eliminado.');
    try {
      await this.db.adminUser.delete({ where: { id } });
    } catch {
      throw new ConflictException(
        'Esta conta tem conteúdos ou respostas associadas. Desactive-a em vez de a eliminar.',
      );
    }
    await deleteImage(target.profilePhotoPublicId);
    await audit(this.db, actor.id, 'ADMIN_DELETED', id, 'users', { email: target.email });
    return { ok: true };
  }

  @Get('roles') async roles(@Req() req: Request) {
    await requirePermission(this.db, req, 'users.manage');
    return this.db.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: { _count: { select: { users: true } } },
    });
  }

  @Post('roles') async createRole(@Req() req: Request, @Body() d: RoleDto) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    if (!d.name) throw new BadRequestException('Indique o nome da função.');
    try {
      const row = await this.db.role.create({
        data: {
          name: d.name.trim(),
          description: d.description?.trim() ?? '',
          permissions: d.permissions ?? [],
        },
      });
      await audit(this.db, actor.id, 'ROLE_CREATED', row.id, 'users');
      return row;
    } catch {
      throw new ConflictException('Já existe uma função com este nome.');
    }
  }

  @Patch('roles/:id') async updateRole(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() d: RoleDto,
  ) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    const role = await this.findRole(id);
    if (role.isSystem)
      throw new BadRequestException('As funções do sistema não podem ser alteradas.');
    try {
      const row = await this.db.role.update({
        where: { id },
        data: {
          name: d.name?.trim(),
          description: d.description?.trim(),
          permissions: d.permissions,
        },
      });
      await audit(this.db, actor.id, 'ROLE_UPDATED', id, 'users');
      return row;
    } catch {
      throw new ConflictException('Já existe uma função com este nome.');
    }
  }

  @Delete('roles/:id') async removeRole(@Req() req: Request, @Param('id') id: string) {
    const actor = await requirePermission(this.db, req, 'users.manage');
    const role = await this.findRole(id);
    if (role.isSystem)
      throw new BadRequestException('As funções do sistema não podem ser eliminadas.');
    await this.db.role.delete({ where: { id } });
    await audit(this.db, actor.id, 'ROLE_DELETED', id, 'users', { name: role.name });
    return { ok: true };
  }

  private async findAdmin(id: string) {
    const row = await this.db.adminUser.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Administrador não encontrado.');
    return row;
  }

  private async findRole(id: string) {
    const row = await this.db.role.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Função não encontrada.');
    return row;
  }
}
