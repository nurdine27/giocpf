import dotenv from 'dotenv';
dotenv.config();
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
async function main() {
  const rl = createInterface({ input, output });
  const email = (await rl.question('E-mail do administrador: ')).trim().toLowerCase();
  const password = await rl.question('Palavra-passe (mínimo 12 caracteres): ');
  rl.close();
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 12)
    throw new Error('E-mail inválido ou palavra-passe inferior a 12 caracteres.');
  const db = new PrismaClient();
  try {
    await db.adminUser.create({ data: { email, passwordHash: await bcrypt.hash(password, 12) } });
    console.log('Administrador criado.');
  } finally {
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
