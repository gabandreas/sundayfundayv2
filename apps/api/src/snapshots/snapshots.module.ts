import { Module, forwardRef } from '@nestjs/common';
import { SnapshotsController } from './snapshots.controller';
import { SnapshotsService } from './snapshots.service';
import { SnapshotsSelectors } from './snapshots.selectors';

import { AuditModule } from '../audit/audit.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [AuditModule, forwardRef(() => CreditModule)],
  controllers: [SnapshotsController],
  providers: [SnapshotsService, SnapshotsSelectors],
  exports: [SnapshotsService, SnapshotsSelectors],
})
export class SnapshotsModule {}
