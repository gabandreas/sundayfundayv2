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
import { SavingsService } from './savings.service';
import { SavingsSelectors } from './savings.selectors';
import {
  CreateSavingsTransactionDto,
  RebalanceSavingsDto,
} from './dto/create-savings-transaction.dto';
import {
  CreateSavingsGoalDto,
  UpdateSavingsGoalDto,
  ConfirmPeriodDepositDto,
} from './dto/savings-goal.dto';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/savings')
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
    private readonly savingsSelectors: SavingsSelectors,
  ) {}

  @Get()
  getVault(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const month = monthStr ? parseInt(monthStr, 10) : undefined;
    const year = yearStr ? parseInt(yearStr, 10) : undefined;
    const userId = getUserIdOrThrow(req);
    return this.savingsSelectors.getVault(month, year, userId);
  }

  @Get('overview')
  getOverview(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.savingsSelectors.getOverview(new Date(), userId);
  }

  @Post('confirm-period-deposit')
  confirmPeriodDeposit(@Body() dto: ConfirmPeriodDepositDto) {
    return this.savingsService.confirmPeriodDeposit(dto);
  }

  @Post('wealth-target')
  saveWealthTarget(
    @Body()
    dto: {
      targetAmount: number;
      targetMonth: number;
      targetYear: number;
      targetBase?: string;
    },
  ) {
    return this.savingsService.saveWealthTarget(dto);
  }

  @Get('goals')
  listGoals(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.savingsSelectors.getGoals(undefined, userId);
  }

  @Post('goals')
  createGoal(@Body() dto: CreateSavingsGoalDto) {
    return this.savingsService.createGoal(dto);
  }

  @Patch('goals/:id')
  updateGoal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSavingsGoalDto,
  ) {
    return this.savingsService.updateGoal(id, dto);
  }

  @Delete('goals/:id')
  deleteGoal(@Param('id', ParseIntPipe) id: number) {
    return this.savingsService.deleteGoal(id);
  }

  @Post()
  createTransaction(@Body() dto: CreateSavingsTransactionDto) {
    return this.savingsService.createTransaction(dto);
  }

  @Post('rebalance')
  rebalanceInstrument(@Body() dto: RebalanceSavingsDto) {
    return this.savingsService.rebalanceInstrument(dto);
  }

  @Delete(':id')
  deleteTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.savingsService.deleteTransaction(id);
  }
}
