import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { CreditService } from './credit.service';
import { CreditSelectors } from './credit.selectors';
import { CreateCreditContractDto } from './dto/create-credit-contract.dto';
import { UpdateCreditContractDto } from './dto/update-credit-contract.dto';
import { CreateCreditCardTransactionDto } from './dto/create-credit-card-transaction.dto';
import { UpdateCreditCardTransactionDto } from './dto/update-credit-card-transaction.dto';
import { SettleCardEarlyDto } from './dto/settle-card-early.dto';
import { CreateMonthlyBulkBillDto } from './dto/create-monthly-bulk-bill.dto';
import { UpdateMonthlyBulkBillDto } from './dto/update-monthly-bulk-bill.dto';
import { UpdateCreditUsageLimitDto } from './dto/update-credit-usage-limit.dto';
import { CreateKillSwitchDto } from './dto/create-kill-switch.dto';
import { UpdateKillSwitchDto } from './dto/update-kill-switch.dto';
import { UpdateKillSwitchNotificationConfigDto } from './dto/update-kill-switch-notification-config.dto';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/credit')
export class CreditController {
  constructor(
    private readonly creditService: CreditService,
    private readonly creditSelectors: CreditSelectors,
  ) {}

  // -------------------------------------------------------------------------
  // Contracts
  // -------------------------------------------------------------------------

  @Get('contracts')
  async listContracts(@Query('isActive') isActive?: string, @Req() req?: any) {
    const activeBool =
      isActive === undefined ? undefined : isActive === 'true';
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.listContracts(activeBool, userId);
  }

  @Post('contracts')
  async createContract(@Body() dto: CreateCreditContractDto) {
    return this.creditService.createContract(dto);
  }

  @Put('contracts/:id')
  async updateContract(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreditContractDto,
  ) {
    return this.creditService.updateContract(id, dto);
  }

  @Delete('contracts/:id')
  async deleteContract(@Param('id', ParseIntPipe) id: number) {
    return this.creditService.deleteContract(id);
  }

  // -------------------------------------------------------------------------
  // Liability Matrix (12-Month Rolling Projection)
  // -------------------------------------------------------------------------

  @Get('matrix')
  async getLiabilityMatrix(
    @Query('startMonth') startMonth?: string,
    @Query('startYear') startYear?: string,
    @Query('count') count?: string,
    @Req() req?: any,
  ) {
    const sm = startMonth ? parseInt(startMonth, 10) : 7;
    const sy = startYear ? parseInt(startYear, 10) : 2026;
    const c = count ? parseInt(count, 10) : 12;
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.getLiabilityMatrix(sm, sy, c, userId);
  }

  // -------------------------------------------------------------------------
  // Credit Cards
  // -------------------------------------------------------------------------

  @Get('cards/summary')
  async getCardSummary(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.getCardSummary(m, y, userId);
  }

  @Get('cards')
  async listCards(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('contextMonth') contextMonth?: string,
    @Query('contextYear') contextYear?: string,
    @Req() req?: any,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    const cm = contextMonth ? parseInt(contextMonth, 10) : undefined;
    const cy = contextYear ? parseInt(contextYear, 10) : undefined;
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.listCardTransactions(m, y, cm, cy, userId);
  }

  @Post('cards')
  async createCardTransaction(@Body() dto: CreateCreditCardTransactionDto) {
    return this.creditService.createCardTransaction(dto);
  }

  @Patch('cards/:id')
  async updateCardTransaction(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCreditCardTransactionDto,
  ) {
    return this.creditService.updateCardTransaction(id, dto);
  }

  @Post('cards/:id/settle-early')
  async settleCardInstallmentEarly(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SettleCardEarlyDto,
  ) {
    return this.creditService.settleCardInstallmentEarly(id, dto);
  }

  @Patch('cards/:id/stop-recurring')
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

  @Patch('cards/:id/resume-recurring')
  async resumeRecurringSubscription(@Param('id', ParseIntPipe) id: number) {
    return this.creditService.resumeRecurringSubscription(id);
  }

  @Delete('cards/:id')
  async deleteCardTransaction(@Param('id', ParseIntPipe) id: number) {
    return this.creditService.deleteCardTransaction(id);
  }

  // -------------------------------------------------------------------------
  // Monthly Bulk Bills
  // -------------------------------------------------------------------------

  @Get('bulk-bills')
  async listBulkBills(
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const m = month ? parseInt(month, 10) : undefined;
    const y = year ? parseInt(year, 10) : undefined;
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.listBulkBills(m, y, userId);
  }

  @Post('bulk-bills')
  async createBulkBill(@Body() dto: CreateMonthlyBulkBillDto) {
    return this.creditService.createBulkBill(dto);
  }

  @Put('bulk-bills/:id')
  async updateBulkBill(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMonthlyBulkBillDto,
  ) {
    return this.creditService.updateBulkBill(id, dto);
  }

  @Delete('bulk-bills/:id')
  async deleteBulkBill(@Param('id', ParseIntPipe) id: number) {
    return this.creditService.deleteBulkBill(id);
  }

  // -------------------------------------------------------------------------
  // Synchronization
  // -------------------------------------------------------------------------

  @Post('sync')
  async syncLiabilities(
    @Query('month') monthStr: string,
    @Query('year') yearStr: string,
  ) {
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException(
        'Query parameters month (1-12) and year are required',
      );
    }

    return this.creditService.syncLiabilitiesToSnapshot(month, year);
  }

  // -------------------------------------------------------------------------
  // Per-Period Credit Usage Limit & Safe Recommendation
  // -------------------------------------------------------------------------

  @Get('usage-limit')
  async getCreditUsageLimit(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (!month || !year || month < 1 || month > 12) {
      throw new BadRequestException(
        'Query parameters month (1-12) and year must be valid integers',
      );
    }

    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.getCreditUsageLimit(month, year, userId);
  }

  @Patch('usage-limit')
  async updateCreditUsageLimit(@Body() dto: UpdateCreditUsageLimitDto) {
    return this.creditService.updateCreditUsageLimit(dto);
  }

  // -------------------------------------------------------------------------
  // Subscription Kill-Switch Endpoints
  // -------------------------------------------------------------------------

  @Get('kill-switches/notification-config')
  async getKillSwitchNotificationConfig(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.getKillSwitchNotificationConfig(userId);
  }

  @Patch('kill-switches/notification-config')
  async updateKillSwitchNotificationConfig(
    @Body() dto: UpdateKillSwitchNotificationConfigDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.creditService.updateKillSwitchNotificationConfig(dto, userId);
  }

  @Post('kill-switches/:id/send-reminder')
  async sendKillSwitchReminder(
    @Param('id', ParseIntPipe) id: number,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.creditService.sendKillSwitchReminder(id, userId);
  }

  @Get('kill-switches')
  async getKillSwitches(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.creditSelectors.getKillSwitches(userId);
  }

  @Post('kill-switches')
  async createKillSwitch(@Body() dto: CreateKillSwitchDto, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.creditService.createKillSwitch(dto, userId);
  }

  @Patch('kill-switches/:id')
  async updateKillSwitch(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKillSwitchDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.creditService.updateKillSwitch(id, dto, userId);
  }
}
