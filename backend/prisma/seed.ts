import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { areas } from '../src/catalog';
import { SYSTEM_ROLES } from '../src/constants';
const db = new PrismaClient();
async function main() {
  const adminEmail = 'admin@gmail.com';
  const adminPasswordHash = await bcrypt.hash('senha123', 12);
  await db.adminUser.upsert({
    where: { email: adminEmail },
    update: { isSuperAdmin: true },
    create: { email: adminEmail, passwordHash: adminPasswordHash, isSuperAdmin: true },
  });
  for (const role of SYSTEM_ROLES)
    await db.role.upsert({
      where: { name: role.name },
      create: { ...role, isSystem: true },
      update: { description: role.description, permissions: role.permissions, isSystem: true },
    });
  for (const a of areas)
    for (const name of a.courses) {
      const slug = name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await db.course.upsert({
        where: { slug },
        update: {},
        create: {
          name,
          slug,
          area: a.name,
          description: '',
          published: true,
          enrollmentOpen: true,
        },
      });
    }
}
main().finally(() => db.$disconnect());
