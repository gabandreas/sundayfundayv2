import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ReportsModule } from '../reports/reports.module';
import { CreditModule } from '../credit/credit.module';
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  imports: [PrismaModule, AuditModule, ReportsModule, CreditModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
