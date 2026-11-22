import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { RateLimiterService } from './rate-limiter.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { ConfigModule } from '../config/config.module';
import { PlatformOwnerGuard } from './roles.guard';

@Module({
  imports: [PrismaModule, EmailModule, ConfigModule],
  providers: [AuthService, RateLimiterService, PlatformOwnerGuard],
  controllers: [AuthController],
  exports: [AuthService, RateLimiterService, PlatformOwnerGuard],
})
export class AuthModule {}

