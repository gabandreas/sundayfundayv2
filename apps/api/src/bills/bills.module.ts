import { Module } from '@nestjs/common';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { BillsSelectors } from './bills.selectors';

@Module({
  controllers: [BillsController],
  providers: [BillsService, BillsSelectors],
  exports: [BillsService, BillsSelectors],
})
export class BillsModule {}
