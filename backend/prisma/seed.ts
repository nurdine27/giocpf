import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import { areas } from '../src/catalog';
const db = new PrismaClient();
async function main() {
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
