import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { AuthController, AdminController } from './controllers';
import { PublicCoursesController, RegistrationController } from './registration.controller';
import { AdminContentController, PublicContentController } from './content.controller';
import { AdminContactController, AdminProfileController, InstitutionSettingsController, PublicContactController } from './communications.controller';
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
  controllers: [AuthController, AdminController, RegistrationController, PublicCoursesController, AdminContentController, PublicContentController, PublicContactController, AdminContactController, AdminProfileController, InstitutionSettingsController],
  providers: [PrismaService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
