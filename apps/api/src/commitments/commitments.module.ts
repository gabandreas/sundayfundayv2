import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { CommitmentsController } from './commitments.controller';
import { CommitmentsSelectors } from './commitments.selectors';
import { CommitmentsService } from './commitments.service';

@Module({
  imports: [AuditModule, SnapshotsModule],
  controllers: [CommitmentsController],
  providers: [CommitmentsSelectors, CommitmentsService],
  exports: [CommitmentsSelectors, CommitmentsService],
})
export class CommitmentsModule {}
