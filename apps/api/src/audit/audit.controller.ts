import { Controller, Get, Query } from '@nestjs/common';
import { AuditService, AuditSummary } from './audit.service';
import { AuditSelectors, PaginatedAuditLogs } from './audit.selectors';
import { QueryAuditLogDto } from './dto/query-audit-log.dto';
import { AuditEvaluationResult } from '../calculator/discipline';

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
  ): Promise<PaginatedAuditLogs> {
    return this.auditSelectors.listAuditLogs(query);
  }

  /**
   * GET /api/audit/summary
   * Aggregate discipline scorecard summary with overall score, health status, and flag counts.
   */
  @Get('summary')
  async getSummary(): Promise<AuditSummary> {
    return this.auditService.getSummary();
  }

  /**
   * GET /api/audit/report
   * Full multi-dimensional historical audit report breaking down operational budget,
   * self-reward streaks, debt burden ratio, and savings targets across all recorded months.
   */
  @Get('report')
  async getFullReport(): Promise<AuditEvaluationResult> {
    return this.auditService.getFullReport();
  }
}
