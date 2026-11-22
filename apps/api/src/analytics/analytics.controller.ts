import { Controller, Get, Query, Req } from '@nestjs/common';
import { AnalyticsSelectors } from './analytics.selectors';
import { AnalyticsReportResult, AnalyticsScope } from '../calculator/analytics';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsSelectors: AnalyticsSelectors) {}

  @Get()
  async getAnalytics(
    @Query('scope') scope?: string,
    @Req() req?: any,
  ): Promise<AnalyticsReportResult> {
    const normalizedScope: AnalyticsScope =
      scope === 'locked' ? 'locked' : 'all';
    const userId = getUserIdOrThrow(req);
    return this.analyticsSelectors.getAnalyticsReport(normalizedScope, userId);
  }
}
