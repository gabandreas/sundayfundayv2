import { Module } from '@nestjs/common';
import { ConfigController } from './config.controller';
import { ConfigService } from './config.service';
import { ConfigSelectors } from './config.selectors';
import { AuditModule } from '../audit/audit.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';

@Module({
  imports: [AuditModule, SnapshotsModule],
  controllers: [ConfigController],
  providers: [ConfigService, ConfigSelectors],
  exports: [ConfigService, ConfigSelectors],
})
export class ConfigModule {}
