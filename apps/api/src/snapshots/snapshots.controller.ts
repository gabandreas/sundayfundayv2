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
} from '@nestjs/common';
import { SnapshotsSelectors } from './snapshots.selectors';
import { SnapshotsService } from './snapshots.service';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { CreateBudgetRevisionDto } from './dto/create-budget-revision.dto';
import { PreviewBudgetRevisionDto } from './dto/preview-budget-revision.dto';
import { ClosePeriodDto } from './dto/close-period.dto';

import { getPayrollPeriodForDate } from '../calculator/pacing';

@Controller('api/snapshots')
export class SnapshotsController {
  constructor(
    private readonly selectors: SnapshotsSelectors,
    private readonly service: SnapshotsService,
  ) {}

  @Get()
  async getSnapshot(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Req() req?: any,
  ) {
    const defaultPeriod = getPayrollPeriodForDate();
    const month = monthStr ? parseInt(monthStr, 10) : defaultPeriod.month;
    const year = yearStr ? parseInt(yearStr, 10) : defaultPeriod.year;
    const userId = req?.userId || 1;

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
    const userId = req?.userId || 1;
    return this.service.initializePeriod(body.month, body.year, userId);
  }

  @Post('evaluate-auto-close')
  async evaluateAutoClose() {
    return this.service.evaluateAutoClosePeriods();
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSnapshotDto,
  ) {
    return this.service.updateSnapshot(id, dto);
  }

  @Post(':id/recalculate')
  async recalculate(@Param('id', ParseIntPipe) id: number) {
    return this.service.recalculateSnapshot(id);
  }

  @Post(':id/reopen')
  async reopen(@Param('id', ParseIntPipe) id: number) {
    return this.service.reopenSnapshot(id);
  }

  @Post(':id/close')
  async close(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: ClosePeriodDto,
  ) {
    return this.service.closePeriod(id, dto);
  }

  @Post(':id/budget-revision')
  async createBudgetRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateBudgetRevisionDto,
  ) {
    return this.service.createBudgetRevision(id, dto);
  }

  @Post(':id/budget-revision/preview')
  async previewBudgetRevision(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: PreviewBudgetRevisionDto,
  ) {
    return this.service.previewBudgetRevision(id, dto);
  }

  @Post(':id/resync-rules')
  async resyncRules(@Param('id', ParseIntPipe) id: number) {
    return this.service.resyncSnapshotRules(id);
  }

  @Post(':id/resync-config')
  async resyncConfig(@Param('id', ParseIntPipe) id: number) {
    return this.service.resyncSnapshotRules(id);
  }

  @Get(':id/budget-revisions')
  async getBudgetRevisions(@Param('id', ParseIntPipe) id: number) {
    return this.selectors.listBudgetRevisions(id);
  }
}
