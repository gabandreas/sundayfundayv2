import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { getUserIdOrThrow } from '../auth/auth.utils';
import { EventsSelectors } from './events.selectors';
import { EventsService } from './events.service';
import {
  CloseSweepTripEventDto,
  CreateTripEventDto,
  CreateTripExpenseDto,
  OptimizeTripEventDto,
  UpdateTripEventDto,
  UpdateTripExpenseDto,
} from './dto/event.dto';

@Controller('api/events')
export class EventsController {
  constructor(
    private readonly selectors: EventsSelectors,
    private readonly service: EventsService,
  ) {}

  @Get()
  list(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    return this.selectors.listForPeriod(userId, month, year);
  }

  @Post('optimize')
  optimize(@Body() dto: OptimizeTripEventDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.optimizeForPeriod(dto, userId);
  }

  @Post()
  create(@Body() dto: CreateTripEventDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTripEventDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.remove(id, userId);
  }

  @Post(':id/expenses')
  addExpense(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTripExpenseDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.addExpense(id, dto, userId);
  }

  @Patch(':id/expenses/:expenseId')
  updateExpense(
    @Param('id', ParseIntPipe) id: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Body() dto: UpdateTripExpenseDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.updateExpense(id, expenseId, dto, userId);
  }

  @Delete(':id/expenses/:expenseId')
  deleteExpense(
    @Param('id', ParseIntPipe) id: number,
    @Param('expenseId', ParseIntPipe) expenseId: number,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.deleteExpense(id, expenseId, userId);
  }

  @Post(':id/close-sweep')
  closeSweep(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CloseSweepTripEventDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.closeAndSweep(id, dto.destination, userId);
  }
}
