import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  ParseIntPipe,
  BadRequestException,
  UseInterceptors,
} from '@nestjs/common';
import { SnapshotsSelectors } from './snapshots.selectors';
import { IdempotencyInterceptor } from '../common/idempotency/idempotency.interceptor';
import { getUserIdOrThrow } from '../auth/auth.utils';
import { SnapshotsService } from './snapshots.service';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { CreateBudgetRevisionDto } from './dto/create-budget-revision.dto';
import { PreviewBudgetRevisionDto } from './dto/preview-budget-revision.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { BorrowFromP1Dto } from './dto/borrow-p1.dto';

import { getPayrollPeriodForDate } from '../calculator/pacing';

@Controller('api/snapshots')
export class SnapshotsController {
  constructor(
    private readonly selectors: SnapshotsSelectors,
    private readonly service: SnapshotsService,
  ) {}

  @Get('default-period')
  async getDefaultActivePeriod(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.selectors.getDefaultActivePeriod(userId);
  }

  @Get('horizon')
  async getHorizon(
    @Query('startMonth') startMonthStr?: string,
    @Query('startYear') startYearStr?: string,
    @Query('count') countStr?: string,
    @Req() req?: any,
  ) {
    const startMonth = startMonthStr ? parseInt(startMonthStr, 10) : undefined;
    const startYear = startYearStr ? parseInt(startYearStr, 10) : undefined;
    const count = countStr ? parseInt(countStr, 10) : 12;
    const userId = getUserIdOrThrow(req);
    return this.selectors.listHorizonSnapshots(startMonth, startYear, count, userId);
  }

  @Get()
  async getSnapshot(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const defaultPeriod = getPayrollPeriodForDate();
    const month = monthStr ? parseInt(monthStr, 10) : defaultPeriod.month;
    const year = yearStr ? parseInt(yearStr, 10) : defaultPeriod.year;
    const userId = getUserIdOrThrow(req);

    return this.selectors.getOrCreateDraftSnapshot(month, year, userId);
  }

  @Post()
  async createSnapshot(
    @Body() body: { month: number; year: number },
    @Req() req?: any,
  ) {
    if (!body?.month || !body?.year) {
      throw new BadRequestException('Both month and year are required');
    }
    const userId = getUserIdOrThrow(req);
    return this.service.initializePeriod(body.month, body.year, userId);
  }

  @Post('evaluate-auto-close')
  async evaluateAutoClose(@Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.evaluateAutoClosePeriods(new Date(), userId);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSnapshotDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.updateSnapshot(id, dto, userId);
  }

  @Post(':id/recalculate')
  async recalculate(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.recalculateSnapshot(id, undefined, userId);
  }

  @Post(':id/reopen')
  async reopen(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.reopenSnapshot(id, userId);
  }

  @Post(':id/close')
  @UseInterceptors(IdempotencyInterceptor)
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: ClosePeriodDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.closePeriod(id, dto, userId);
  }

  @Post(':id/budget-revision')
  async createBudgetRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBudgetRevisionDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.createBudgetRevision(id, dto, userId);
  }

  @Post(':id/budget-revision/preview')
  async previewBudgetRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PreviewBudgetRevisionDto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.previewBudgetRevision(id, dto, userId);
  }

  @Post(':id/resync-rules')
  async resyncRules(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.resyncSnapshotRules(id, userId);
  }

  @Post(':id/resync-config')
  async resyncConfig(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.service.resyncSnapshotRules(id, userId);
  }

  @Get(':id/budget-revisions')
  async getBudgetRevisions(@Param('id', ParseIntPipe) id: number, @Req() req?: any) {
    const userId = getUserIdOrThrow(req);
    return this.selectors.listBudgetRevisions(id, userId);
  }

  @Post(':id/borrow-p1')
  @UseInterceptors(IdempotencyInterceptor)
  async borrowFromP1Vault(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BorrowFromP1Dto,
    @Req() req?: any,
  ) {
    const userId = getUserIdOrThrow(req);
    return this.service.borrowFromP1Vault(id, dto, userId);
  }
}
