import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { BillsService } from './bills.service';
import { BillsSelectors } from './bills.selectors';
import { CreateScheduledBillDto } from './dto/create-scheduled-bill.dto';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/bills')
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly billsSelectors: BillsSelectors,
  ) {}

  @Get()
  listBills(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.billsSelectors.listBills(userId);
  }

  @Post()
  createBill(@Body() dto: CreateScheduledBillDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.billsService.createBill(dto, userId);
  }

  @Delete(':id')
  deleteBill(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.billsService.deleteBill(id, userId);
  }
}
