import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { FinanceModule } from '../finance/finance.module';
import { CreditModule } from '../credit/credit.module';
import { SavingsModule } from '../savings/savings.module';
import { MarqueeController } from './marquee.controller';
import { MarqueeService } from './marquee.service';
import { MarqueeToolsService } from './marquee-tools.service';
import { MarqueeLlmService } from './marquee-llm.service';

@Module({
  imports: [PrismaModule, SnapshotsModule, FinanceModule, CreditModule, SavingsModule],
  controllers: [MarqueeController],
  providers: [MarqueeService, MarqueeToolsService, MarqueeLlmService],
  exports: [MarqueeService, MarqueeToolsService],
})
export class MarqueeModule {}
