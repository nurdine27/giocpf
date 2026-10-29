import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { AuthController, AdminController } from './controllers';
import { PublicCoursesController, RegistrationController } from './registration.controller';
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])],
  controllers: [AuthController, AdminController, RegistrationController, PublicCoursesController],
  providers: [PrismaService],
})
export class AppModule {}
