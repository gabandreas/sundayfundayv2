import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { FinanceModule } from '../finance/finance.module';
import { EventsController } from './events.controller';
import { EventsSelectors } from './events.selectors';
import { EventsService } from './events.service';

@Module({
  imports: [AuditModule, SnapshotsModule, FinanceModule],
  controllers: [EventsController],
  providers: [EventsSelectors, EventsService],
  exports: [EventsSelectors, EventsService],
})
export class EventsModule {}
