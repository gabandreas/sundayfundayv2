import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditSelectors } from './audit.selectors';
import { AuditLogService } from './audit-log.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService, AuditSelectors, AuditLogService],
  exports: [AuditService, AuditSelectors, AuditLogService],
})
export class AuditModule {}
