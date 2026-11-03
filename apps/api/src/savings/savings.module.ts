import { Module } from '@nestjs/common';
import { SavingsController } from './savings.controller';
import { SavingsService } from './savings.service';
import { SavingsSelectors } from './savings.selectors';

import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SavingsController],
  providers: [SavingsService, SavingsSelectors],
  exports: [SavingsService, SavingsSelectors],
})
export class SavingsModule {}
