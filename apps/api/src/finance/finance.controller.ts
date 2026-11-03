import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
  Inject,
  forwardRef,
  Req,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceSelectors } from './finance.selectors';
import { CreditService } from '../credit/credit.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import {
  PreviewReconcileBalanceDto,
  ExecuteReconcileBalanceDto,
} from './dto/reconcile-balance.dto';

@Controller('api/finance')
export class FinanceController {
  constructor(
    private readonly financeService: FinanceService,
    private readonly financeSelectors: FinanceSelectors,
    @Inject(forwardRef(() => CreditService))
    private readonly creditService: CreditService,
  ) {}

  @Get('transactions')
  async listTransactions(
    @Query('month') monthStr: string,
    @Query('year') yearStr: string,
    @Req() req?: any,
  ) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const userId = req?.userId || 1;
    return this.financeSelectors.listTransactions(month, year, userId);
  }

  @Post('transactions')
  async createTransaction(@Body() dto: CreateTransactionDto) {
    return this.financeService.createTransaction(dto);
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.financeService.updateTransaction(id, dto);
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.financeService.deleteTransaction(id);
  }

  @Get('payroll')
  async getPayroll(
    @Query('month') monthStr: string,
    @Query('year') yearStr: string,
    @Req() req?: any,
  ) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const userId = req?.userId || 1;
    return this.financeSelectors.getPayroll(month, year, userId);
  }

  @Get('pacing')
  async getPacing(
    @Query('month') monthStr: string,
    @Query('year') yearStr: string,
    @Query('referenceDate') referenceDateStr?: string,
    @Query('weekendMultiplier') weekendMultiplierStr?: string,
    @Req() req?: any,
  ) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const referenceDate = referenceDateStr
      ? new Date(referenceDateStr)
      : undefined;
    const weekendMultiplier = weekendMultiplierStr
      ? parseFloat(weekendMultiplierStr)
      : undefined;

    const userId = req?.userId || 1;
    return this.financeSelectors.getPacing(
      month,
      year,
      referenceDate,
      weekendMultiplier,
      userId,
    );
  }

  @Post('reconcile/preview')
  async previewReconcile(@Body() dto: PreviewReconcileBalanceDto, @Req() req?: any) {
    const userId = req?.userId || 1;
    return this.financeSelectors.previewCashReconciliation({ ...dto, userId });
  }

  @Post('reconcile-balance/preview')
  async previewReconcileBalance(@Body() dto: PreviewReconcileBalanceDto, @Req() req?: any) {
    const userId = req?.userId || 1;
    return this.financeSelectors.previewCashReconciliation({ ...dto, userId });
  }

  @Post('reconcile')
  async executeReconcile(@Body() dto: ExecuteReconcileBalanceDto) {
    return this.financeService.executeCashReconciliation(dto);
  }

  @Post('reconcile-balance')
  async executeReconcileBalance(@Body() dto: ExecuteReconcileBalanceDto) {
    return this.financeService.executeCashReconciliation(dto);
  }

  @Get('search')
  async searchTransactions(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('sourceType') sourceType?: string,
    @Query('fixedEssentialCategory') fixedEssentialCategory?: string,
    @Query('limit') limitStr?: string,
    @Req() req?: any,
  ) {
    const limit = limitStr ? parseInt(limitStr, 10) : 50;
    const userId = req?.userId || 1;
    return this.financeSelectors.searchTransactions({
      q,
      type,
      sourceType,
      fixedEssentialCategory,
      limit: Number.isNaN(limit) ? 50 : limit,
      userId,
    });
  }

  @Patch('credit-card/:id/stop-recurring')
  async stopRecurringSubscription(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { stopFromMonth: number; stopFromYear: number },
  ) {
    return this.creditService.stopRecurringSubscription(
      id,
      dto.stopFromMonth,
      dto.stopFromYear,
    );
  }

  @Patch('credit-card/:id/resume-recurring')
  async resumeRecurringSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.creditService.resumeRecurringSubscription(id);
  }
}
