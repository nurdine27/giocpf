import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
import type { AdminUser, Role } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PERMISSION_KEYS, SESSION_COOKIE, SYSTEM_ROLES, type Permission } from './constants';

export type AuthenticatedAdmin = AdminUser & {
  role: Role | null;
  effectivePermissions: Permission[];
};

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

/** Role permissions plus any extra permissions granted directly to the user. */
export function effectivePermissions(admin: {
  isSuperAdmin: boolean;
  permissions: string[];
  role?: { permissions: string[] } | null;
}): Permission[] {
  if (admin.isSuperAdmin) return [...PERMISSION_KEYS];
  const granted = new Set([...(admin.role?.permissions ?? []), ...admin.permissions]);
  return PERMISSION_KEYS.filter((p) => granted.has(p));
}

export async function requireAdmin(db: PrismaService, req: Request): Promise<AuthenticatedAdmin> {
  const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
  if (!token) throw new UnauthorizedException('Sessão expirada. Inicie sessão novamente.');
  const origin = req.get('origin');
  if (process.env.APP_URL && origin && origin !== process.env.APP_URL)
    throw new UnauthorizedException();
  const session = await db.adminSession.findUnique({
    where: { id: hashToken(token) },
    include: { admin: { include: { role: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.admin.active)
    throw new UnauthorizedException('Sessão expirada. Inicie sessão novamente.');
  return { ...session.admin, effectivePermissions: effectivePermissions(session.admin) };
}

export function can(admin: AuthenticatedAdmin, permission: Permission) {
  return admin.effectivePermissions.includes(permission);
}

export async function requirePermission(db: PrismaService, req: Request, permission: Permission) {
  const admin = await requireAdmin(db, req);
  if (!can(admin, permission)) throw new ForbiddenException('Não tem permissão para esta acção.');
  return admin;
}

export async function requireAnyPermission(
  db: PrismaService,
  req: Request,
  permissions: Permission[],
) {
  const admin = await requireAdmin(db, req);
  if (!permissions.some((p) => can(admin, p)))
    throw new ForbiddenException('Não tem permissão para esta acção.');
  return admin;
}

/** Creates the built-in roles and keeps their permission lists aligned with the code. */
export async function ensureSystemRoles(db: PrismaService) {
  for (const role of SYSTEM_ROLES)
    await db.role.upsert({
      where: { name: role.name },
      create: { ...role, isSystem: true },
      update: { description: role.description, permissions: role.permissions, isSystem: true },
    });
}

export function audit(
  db: PrismaService,
  adminId: string,
  action: string,
  targetId: string,
  module: string,
  metadata?: Record<string, unknown>,
) {
  return db.auditLog.create({
    data: { adminId, action, targetId, module, metadata: metadata as never },
  });
}
