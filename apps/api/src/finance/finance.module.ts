import { Module, forwardRef } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { FinanceSelectors } from './finance.selectors';
import { PrismaModule } from '../prisma/prisma.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { AuditModule } from '../audit/audit.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [PrismaModule, SnapshotsModule, AuditModule, forwardRef(() => CreditModule)],
  controllers: [FinanceController],
  providers: [FinanceService, FinanceSelectors],
  exports: [FinanceService, FinanceSelectors],
})
export class FinanceModule {}
