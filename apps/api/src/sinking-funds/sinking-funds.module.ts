import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SinkingFundsController } from './sinking-funds.controller';
import { SinkingFundsSelectors } from './sinking-funds.selectors';
import { SinkingFundsService } from './sinking-funds.service';

@Module({
  imports: [AuditModule],
  controllers: [SinkingFundsController],
  providers: [SinkingFundsSelectors, SinkingFundsService],
  exports: [SinkingFundsSelectors, SinkingFundsService],
})
export class SinkingFundsModule {}
