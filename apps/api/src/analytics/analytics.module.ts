import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsSelectors } from './analytics.selectors';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsSelectors],
  exports: [AnalyticsSelectors],
})
export class AnalyticsModule {}
