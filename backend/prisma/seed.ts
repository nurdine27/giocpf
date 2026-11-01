import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { areas } from '../src/catalog';
import { SYSTEM_ROLES } from '../src/constants';
const db = new PrismaClient();
function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function main() {
  const adminEmail = 'admin@gmail.com';
  const courseSlugs = [...new Set(areas.flatMap((area) => area.courses.map(slugify)))];
  const [admin, roleCount, courseCount] = await Promise.all([
    db.adminUser.findUnique({ where: { email: adminEmail }, select: { id: true } }),
    db.role.count({ where: { name: { in: SYSTEM_ROLES.map((role) => role.name) } } }),
    db.course.count({ where: { slug: { in: courseSlugs } } }),
  ]);

  // Render may invoke this command on every build. Once the initial data is
  // complete, exit without resetting credentials or rewriting seed records.
  if (admin && roleCount === SYSTEM_ROLES.length && courseCount === courseSlugs.length) {
    console.log('Seed inicial já aplicado; sem alterações.');
    return;
  }

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
      const slug = slugify(name);
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
main()
  .catch((error) => {
    console.error('Falha ao aplicar seed inicial.', error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
