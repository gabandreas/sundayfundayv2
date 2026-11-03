import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { CreditModule } from '../credit/credit.module';
import { ReportsController } from './reports.controller';
import { ReportsSelectors } from './reports.selectors';

@Module({
  imports: [PrismaModule, AuditModule, CreditModule],
  controllers: [ReportsController],
  providers: [ReportsSelectors],
  exports: [ReportsSelectors],
})
export class ReportsModule {}
