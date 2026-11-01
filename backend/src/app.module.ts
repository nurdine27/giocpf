import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { AdminController, AuthController } from './controllers';
import { PublicCoursesController, RegistrationController } from './registration.controller';
import { AdminContentController, PublicContentController } from './content.controller';
import {
  AdminContactController,
  AdminProfileController,
  InstitutionSettingsController,
  PublicContactController,
} from './communications.controller';
import { AdminUsersController } from './users.controller';
import { UploadsController } from './uploads.controller';
import { ClassesController } from './classes.controller';
import { ReportsController } from './reports.controller';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])],
  controllers: [
    AuthController,
    AdminController,
    AdminUsersController,
    UploadsController,
    ClassesController,
    ReportsController,
    RegistrationController,
    PublicCoursesController,
    AdminContentController,
    PublicContentController,
    PublicContactController,
    AdminContactController,
    AdminProfileController,
    InstitutionSettingsController,
  ],
  providers: [PrismaService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
