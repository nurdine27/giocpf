import 'reflect-metadata';
import { config as loadEnvironment } from 'dotenv';
loadEnvironment();
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { SafeHttpExceptionFilter } from './http-exception.filter';
import { PrismaService } from './prisma.service';
import { ensureSystemRoles } from './auth';
async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  app.useGlobalFilters(new SafeHttpExceptionFilter());
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: process.env.APP_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type'],
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  await ensureSystemRoles(app.get(PrismaService));
  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  console.log(`GIO API listening on ${port}`);
}
bootstrap();
