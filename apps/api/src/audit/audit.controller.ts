import { Controller, Get, Query, Req } from '@nestjs/common';
import { AuditService, AuditSummary } from './audit.service';
import { AuditSelectors, PaginatedAuditLogs } from './audit.selectors';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditEvaluationResult } from '../calculator/discipline';
import { getUserIdOrThrow } from '../auth/auth.utils';

@Controller('api/audit')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly auditSelectors: AuditSelectors,
  ) {}

  /**
   * GET /api/audit
   * Paginated list of AuditLog events, optionally filtered by month, year, category, severity.
   */
  @Get()
  async getAuditLogs(
    @Query() query: QueryAuditLogDto,
    @Req() req?: any,
  ): Promise<PaginatedAuditLogs> {
    const userId = getUserIdOrThrow(req);
    return this.auditSelectors.listAuditLogs(query, userId);
  }

  /**
   * GET /api/audit/summary
   * Aggregate discipline scorecard summary with overall score, health status, and flag counts.
   */
  @Get('summary')
  async getSummary(@Req() req?: any): Promise<AuditSummary> {
    const userId = getUserIdOrThrow(req);
    return this.auditService.getSummary(userId);
  }

  /**
   * GET /api/audit/report
   * Full multi-dimensional historical audit report breaking down operational budget,
   * self-reward streaks, debt burden ratio, and savings targets across all recorded months.
   */
  @Get('report')
  async getFullReport(@Req() req?: any): Promise<AuditEvaluationResult> {
    const userId = getUserIdOrThrow(req);
    return this.auditService.getFullReport(userId);
  }
}
