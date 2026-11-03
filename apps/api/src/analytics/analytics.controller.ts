import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsSelectors } from './analytics.selectors';
import { AnalyticsReportResult, AnalyticsScope } from '../calculator/analytics';

@Controller('api/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsSelectors: AnalyticsSelectors) {}

  @Get()
  async getAnalytics(
    @Query('scope') scope?: string,
  ): Promise<AnalyticsReportResult> {
    const normalizedScope: AnalyticsScope =
      scope === 'locked' ? 'locked' : 'all';
    return this.analyticsSelectors.getAnalyticsReport(normalizedScope);
  }
}
