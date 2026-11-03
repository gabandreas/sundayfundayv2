import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { BillsSelectors } from './bills.selectors';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';

@Controller('api/bills')
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly billsSelectors: BillsSelectors,
  ) {}

  @Get()
  listBills() {
    return this.billsSelectors.listBills();
  }

  @Post()
  createBill(@Body() dto: CreateScheduledBillDto) {
    return this.billsService.createBill(dto);
  }

  @Delete(':id')
  deleteBill(@Param('id', ParseIntPipe) id: number) {
    return this.billsService.deleteBill(id);
  }
}
