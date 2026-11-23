import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../email/email.module';
import { SqlStudioModule } from './sql-studio/sql-studio.module';

@Module({
  imports: [PrismaModule, AuthModule, EmailModule, SqlStudioModule],
  providers: [AdminService],
  controllers: [AdminController],
  exports: [AdminService, SqlStudioModule],
})
export class AdminModule {}

