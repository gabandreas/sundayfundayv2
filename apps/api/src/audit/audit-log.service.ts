import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditCategory, AuditSeverity, AuditLog } from '@prisma/client';

export interface RecordAuditLogParams {
  action: string;
  category: AuditCategory;
  summary: string;
  details?: string | null;
  month?: number | null;
  year?: number | null;
  severity?: AuditSeverity;
}

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an entry into the append-only AuditLog event journal.
   * Supports both object-style and positional parameter invocation.
   */
  async record(params: RecordAuditLogParams): Promise<AuditLog>;
  async record(
    action: string,
    category: AuditCategory,
    summary: string,
    details?: string | null,
    month?: number | null,
    year?: number | null,
    severity?: AuditSeverity,
  ): Promise<AuditLog>;
  async record(
    actionOrParams: string | RecordAuditLogParams,
    category?: AuditCategory,
    summary?: string,
    details?: string | null,
    month?: number | null,
    year?: number | null,
    severity: AuditSeverity = AuditSeverity.INFO,
  ): Promise<AuditLog> {
    if (typeof actionOrParams === 'object') {
      return this.prisma.auditLog.create({
        data: {
          action: actionOrParams.action,
          category: actionOrParams.category,
          summary: actionOrParams.summary,
          details: actionOrParams.details ?? null,
          month: actionOrParams.month ?? null,
          year: actionOrParams.year ?? null,
          severity: actionOrParams.severity ?? AuditSeverity.INFO,
        },
      });
    }

    return this.prisma.auditLog.create({
      data: {
        action: actionOrParams,
        category: category!,
        summary: summary!,
        details: details ?? null,
        month: month ?? null,
        year: year ?? null,
        severity: severity ?? AuditSeverity.INFO,
      },
    });
  }
}
