import {
  Controller,
  Get,
  Query,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ReportsSelectors } from './reports.selectors';
import { ReportScope } from '../calculator/reports';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/reports')
export class ReportsController {
  constructor(private readonly reportsSelectors: ReportsSelectors) {}

  @Get()
  async getExecutiveReport(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Query('scope') scopeParam?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();

    if (
      Number.isNaN(month) ||
      Number.isNaN(year) ||
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const scope: ReportScope = scopeParam === 'locked' ? 'locked' : 'all';
    const userId = getUserIdOrThrow(req);
    return this.reportsSelectors.getExecutiveReport(month, year, scope, userId);
  }

  @Get('forecast')
  async getLiquidityForecast(
    @Query('month') monthStr?: string,
    @Query('year') yearStr?: string,
    @Query('horizon') horizonStr?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    const month = monthStr ? parseInt(monthStr, 10) : now.getMonth() + 1;
    const year = yearStr ? parseInt(yearStr, 10) : now.getFullYear();
    const horizon = horizonStr ? parseInt(horizonStr, 10) : 3;

    if (
      Number.isNaN(month) ||
      Number.isNaN(year) ||
      month < 1 ||
      month > 12 ||
      year < 2000 ||
      year > 2100
    ) {
      throw new BadRequestException('Valid month (1-12) and year are required');
    }

    const userId = getUserIdOrThrow(req);
    return this.reportsSelectors.getLiquidityForecast(
      month,
      year,
      Number.isNaN(horizon) ? 3 : Math.min(Math.max(1, horizon), 12),
      userId,
    );
  }
}
