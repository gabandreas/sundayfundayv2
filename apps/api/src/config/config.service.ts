import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { AuditCategory, AuditSeverity, SnapshotStatus } from '@prisma/client';
import { UpsertGlobalConfigDto } from './dto/upsert-global-config.dto';
import { SimulateRulesDto } from './dto/simulate-rules.dto';
import { CreateCustomRequestDto } from './dto/create-custom-request.dto';
import { UpdateCustomRequestDto } from './dto/update-custom-request.dto';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { getPayrollPeriodForDate } from '../calculator/pacing';
import {
  validateModularRules,
  evaluateModularEngine,
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../calculator/modular-engine';
import {
  buildDefaultSandboxState,
  SandboxState,
  RoutineCategoryConfig,
} from './sandbox.defaults';

@Injectable()
export class ConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly snapshotsService: SnapshotsService,
  ) {}

  /**
   * Upserts the singleton GlobalConfig row (id = 1).
   * All writable fields are replaced with the provided values.
   */
  async upsertConfig(dto: UpsertGlobalConfigDto, userId: number = 1) {
    if (
      dto.payrollRulesJson !== undefined ||
      dto.allocationBucketsJson !== undefined ||
      dto.surplusSplitRulesJson !== undefined ||
      dto.financialPolicyJson !== undefined
    ) {
      const validation = validateModularRules(
        dto.payrollRulesJson,
        dto.allocationBucketsJson,
        dto.surplusSplitRulesJson,
        dto.financialPolicyJson,
      );
      if (!validation.isValid) {
        throw new BadRequestException(
          `Configuration validation failed: ${validation.errors.join('; ')}`,
        );
      }
    }

    const { recalculateDrafts, fromMonth, fromYear, ...configFields } = dto;

    const updated = await this.prisma.globalConfig.upsert({
      where: { userId },
      update: { ...configFields },
      create: {
        userId,
        baseSalary: 0,
        dailyAllowance: 0,
        laptopAllowance: 250000,
        dailyOperational: 0,
        transport: 0,
        internet: 0,
        vape: 0,
        haircut: 0,
        baseSavings: 0,
        creditLimit: 7000000,
        creditStatementDay: 20,
        creditDueDay: 11,
        ...configFields,
      } as any,
    });

    if (dto.lifeStagePreset !== undefined || dto.uiDensityMode !== undefined) {
      await this.prisma.user
        .update({
          where: { id: userId },
          data: {
            ...(dto.lifeStagePreset !== undefined
              ? { lifeStagePreset: dto.lifeStagePreset }
              : {}),
            ...(dto.uiDensityMode !== undefined
              ? { uiDensityMode: dto.uiDensityMode }
              : {}),
          },
        })
        .catch(() => {});
    }

    if (recalculateDrafts) {
      const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
        where: {
          userId,
          status: SnapshotStatus.DRAFT,
          ...(fromYear !== undefined && fromMonth !== undefined
            ? {
                OR: [
                  { year: { gt: fromYear } },
                  { year: fromYear, month: { gte: fromMonth } },
                ],
              }
            : {}),
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });

      for (const draft of draftSnapshots) {
        await this.snapshotsService.recalculateSnapshot(draft.id);
      }
    }

    await this.auditLogService.record({
      action: 'UPDATE_SETTINGS',
      category: AuditCategory.SETTINGS,
      summary: 'Updated global financial configuration baseline',
      details: JSON.stringify(dto),
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  /**
   * Simulates modular formula evaluation for a hypothetical paycheck, debts, and cycle days.
   */
  async simulateModularRules(dto: SimulateRulesDto) {
    const config = await this.prisma.globalConfig.findFirst();
    const baseSalary =
      dto.baseSalary ??
      dto.income ??
      config?.baseSalary ??
      6000000;

    const payrollRules =
      dto.payrollRules ??
      config?.payrollRulesJson ??
      buildDefaultPayrollRules(config?.dailyAllowance ?? 20000, config?.laptopAllowance ?? 250000);

    const allocationBuckets =
      dto.allocationBuckets ??
      config?.allocationBucketsJson ??
      buildDefaultAllocationBuckets({
        transport: config?.transport ?? 0,
        internet: config?.internet ?? 0,
        vape: config?.vape ?? 0,
        haircut: config?.haircut ?? 0,
        dailyOperational: config?.dailyOperational ?? 0,
        savings: config?.baseSavings ?? 0,
        bufferPocket: 0,
      });

    const surplusSplitRules =
      dto.surplusSplitRules ??
      config?.surplusSplitRulesJson ??
      buildDefaultSurplusSplitRules();

    const financialPolicy =
      dto.financialPolicy ??
      config?.financialPolicyJson ??
      buildDefaultFinancialPolicy();

    const debts = dto.debts ?? 0;
    const cycleDays = dto.cycleDays ?? 30;

    return evaluateModularEngine({
      baseSalary,
      salaryAdjustment: 0,
      totalWorkingDays: dto.totalWorkingDays ?? 20,
      dailyAllowance: config?.dailyAllowance ?? 20000,
      cafeteriaDeduction: 0,
      thrAmount: 0,
      bonusAmount: 0,
      extraIncome: 0,
      month: 10,
      year: 2026,
      cycleDays,
      totalCreditBills: debts,
      totalDeductions: debts,
      payrollRules: payrollRules as any,
      allocationBuckets: allocationBuckets as any,
      surplusSplitRules: surplusSplitRules as any,
      financialPolicy: financialPolicy as any,
    });
  }

  /**
   * Restores modular formula rules to canonical factory defaults.
   */
  async restoreDefaultRules() {
    const config = await this.prisma.globalConfig.findFirst();
    const dailyAllowance = config?.dailyAllowance ?? 20000;
    const laptopAllowance = config?.laptopAllowance ?? 250000;

    const payrollRulesJson = buildDefaultPayrollRules(dailyAllowance, laptopAllowance);
    const allocationBucketsJson = buildDefaultAllocationBuckets({
      transport: config?.transport ?? 0,
      internet: config?.internet ?? 0,
      vape: config?.vape ?? 0,
      haircut: config?.haircut ?? 0,
      dailyOperational: config?.dailyOperational ?? 0,
      savings: config?.baseSavings ?? 0,
      bufferPocket: 0,
    });
    const surplusSplitRulesJson = buildDefaultSurplusSplitRules();
    const financialPolicyJson = buildDefaultFinancialPolicy();

    const updated = await this.prisma.globalConfig.update({
      where: { userId: 1 },
      data: {
        payrollRulesJson: payrollRulesJson as any,
        allocationBucketsJson: allocationBucketsJson as any,
        surplusSplitRulesJson: surplusSplitRulesJson as any,
        financialPolicyJson: financialPolicyJson as any,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_SETTINGS',
      category: AuditCategory.SETTINGS,
      summary: 'Restored modular financial rules to canonical factory defaults',
      details: 'payrollRulesJson, allocationBucketsJson, surplusSplitRulesJson, financialPolicyJson reset',
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  /**
   * Overwrites the frozen baseline targets on the active period's DRAFT snapshot
   * with the latest GlobalConfig values, and triggers snapshot recalculation.
   * Rejects if the snapshot is LOCKED.
   */
  async syncToCurrentPeriod(targetMonth?: number, targetYear?: number, userId: number = 1) {
    const activePeriod = getPayrollPeriodForDate();
    const month = targetMonth ?? activePeriod.month;
    const year = targetYear ?? activePeriod.year;

    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      throw new NotFoundException(
        `No snapshot exists for active period ${month}/${year}`,
      );
    }

    if (snapshot.status === SnapshotStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot sync configuration to period ${month}/${year}: period is locked and frozen history cannot be modified.`,
      );
    }

    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst());
    if (!config) {
      throw new BadRequestException(
        'Global configuration has not been initialized',
      );
    }

    const frozenRulesJson = {
      payrollRules:
        config.payrollRulesJson ??
        buildDefaultPayrollRules(config.dailyAllowance, config.laptopAllowance),
      allocationBuckets:
        config.allocationBucketsJson ??
        buildDefaultAllocationBuckets({
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          dailyOperational: config.dailyOperational,
          savings: config.baseSavings,
          bufferPocket: 0,
        }),
      surplusSplitRules:
        config.surplusSplitRulesJson ?? buildDefaultSurplusSplitRules(),
      financialPolicy:
        config.financialPolicyJson ?? buildDefaultFinancialPolicy(),
    };

    // Overwrite frozen baseline targets
    await this.prisma.monthlySnapshot.update({
      where: { id: snapshot.id },
      data: {
        dailyOperational: config.dailyOperational,
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
        savings: config.baseSavings,
        ccUsageLimit: config.ccUsageLimit,
        paylaterUsageLimit: config.paylaterUsageLimit,
        frozenRulesJson: frozenRulesJson as any,
      },
    });

    // Recalculate stored fields
    const recalculated = await this.snapshotsService.recalculateSnapshot(
      snapshot.id,
    );

    await this.auditLogService.record({
      action: 'RESYNC_CONFIG_TARGETS',
      category: AuditCategory.SETTINGS,
      summary: `Resynced baseline targets for period ${month}/${year} from GlobalConfig`,
      details: `Updated dailyOperational=${config.dailyOperational}, transport=${config.transport}, internet=${config.internet}, vape=${config.vape}, haircut=${config.haircut}, savings=${config.baseSavings}, ccUsageLimit=${config.ccUsageLimit}, paylaterUsageLimit=${config.paylaterUsageLimit}`,
      month,
      year,
      severity: AuditSeverity.INFO,
    });

    return {
      success: true,
      period: { month, year },
      snapshot: recalculated,
    };
  }

  /**
   * Restores a Full ERP JSON Backup inside an atomic transaction.
   * Requires explicit confirmPhrase === 'RESTORE_ALL_DATA'.
   */
  async restoreFullBackup(payload: {
    confirmPhrase?: string;
    backup?: {
      schemaVersion?: string;
      data?: Record<string, any[]>;
    };
  }) {
    if (payload?.confirmPhrase !== 'RESTORE_ALL_DATA') {
      throw new BadRequestException(
        'Confirmation phrase "RESTORE_ALL_DATA" is required to execute a full database restore',
      );
    }

    const data = payload?.backup?.data;
    if (!data || typeof data !== 'object') {
      throw new BadRequestException(
        'Invalid backup payload: missing "backup.data" object',
      );
    }

    const requiredArrays = [
      'globalConfig',
      'monthlySnapshots',
      'transactions',
      'creditContracts',
      'creditCardTransactions',
      'monthlyBulkBills',
      'savingsManualTransactions',
    ];
    for (const key of requiredArrays) {
      if (!Array.isArray(data[key])) {
        throw new BadRequestException(
          `Invalid backup payload: "backup.data.${key}" must be an array`,
        );
      }
    }

    const restoredCounts = await this.prisma.$transaction(async (tx) => {
      // 1. Delete existing rows in child-first FK order
      await tx.transaction.deleteMany();
      await tx.budgetRevision.deleteMany();
      await tx.auditLog.deleteMany();
      await tx.wishlistItem.deleteMany();
      await tx.savingsManualTransaction.deleteMany();
      await tx.monthlyBulkBill.deleteMany();
      await tx.creditCardTransaction.deleteMany();
      await tx.scheduledBill.deleteMany();
      await tx.creditContract.deleteMany();
      await tx.monthlySnapshot.deleteMany();
      await tx.globalConfig.deleteMany();

      // 2. Re-insert rows in parent-first FK order
      if (data.globalConfig.length > 0) {
        await tx.globalConfig.createMany({ data: data.globalConfig });
      }
      if (data.monthlySnapshots.length > 0) {
        await tx.monthlySnapshot.createMany({ data: data.monthlySnapshots });
      }
      if (data.transactions.length > 0) {
        await tx.transaction.createMany({ data: data.transactions });
      }
      if (Array.isArray(data.budgetRevisions) && data.budgetRevisions.length > 0) {
        await tx.budgetRevision.createMany({ data: data.budgetRevisions });
      }
      if (data.creditContracts.length > 0) {
        await tx.creditContract.createMany({ data: data.creditContracts });
      }
      if (Array.isArray(data.scheduledBills) && data.scheduledBills.length > 0) {
        await tx.scheduledBill.createMany({ data: data.scheduledBills });
      }
      if (data.creditCardTransactions.length > 0) {
        await tx.creditCardTransaction.createMany({
          data: data.creditCardTransactions,
        });
      }
      if (data.monthlyBulkBills.length > 0) {
        await tx.monthlyBulkBill.createMany({ data: data.monthlyBulkBills });
      }
      if (data.savingsManualTransactions.length > 0) {
        await tx.savingsManualTransaction.createMany({
          data: data.savingsManualTransactions,
        });
      }
      if (Array.isArray(data.wishlistItems) && data.wishlistItems.length > 0) {
        await tx.wishlistItem.createMany({ data: data.wishlistItems });
      }
      if (Array.isArray(data.auditLogs) && data.auditLogs.length > 0) {
        await tx.auditLog.createMany({ data: data.auditLogs });
      }

      // 3. Reset PostgreSQL sequences so subsequent inserts never collide on ID
      const tables = [
        'GlobalConfig',
        'MonthlySnapshot',
        'Transaction',
        'BudgetRevision',
        'CreditContract',
        'ScheduledBill',
        'CreditCardTransaction',
        'MonthlyBulkBill',
        'SavingsManualTransaction',
        'WishlistItem',
        'AuditLog',
      ];
      for (const tbl of tables) {
        await tx.$executeRawUnsafe(
          `SELECT setval(pg_get_serial_sequence('"${tbl}"', 'id'), COALESCE((SELECT MAX(id) FROM "${tbl}"), 1), (SELECT COUNT(*) > 0 FROM "${tbl}"));`,
        );
      }

      return {
        globalConfig: data.globalConfig.length,
        monthlySnapshots: data.monthlySnapshots.length,
        transactions: data.transactions.length,
        budgetRevisions: (data.budgetRevisions ?? []).length,
        creditContracts: data.creditContracts.length,
        scheduledBills: (data.scheduledBills ?? []).length,
        creditCardTransactions: data.creditCardTransactions.length,
        monthlyBulkBills: data.monthlyBulkBills.length,
        savingsManualTransactions: data.savingsManualTransactions.length,
        wishlistItems: (data.wishlistItems ?? []).length,
        auditLogs: (data.auditLogs ?? []).length,
      };
    });

    await this.auditLogService.record({
      action: 'RESTORE_DATABASE_BACKUP',
      category: AuditCategory.SETTINGS,
      summary: `Restored full ERP database snapshot (${restoredCounts.monthlySnapshots} periods, ${restoredCounts.transactions} transactions)`,
      details: JSON.stringify(restoredCounts),
      severity: AuditSeverity.ADJUSTMENT,
    });

    return {
      success: true,
      restoredAt: new Date().toISOString(),
      restoredCounts,
    };
  }

  /**
   * Lists all submitted custom ERP module & rule requests.
   */
  async listCustomRequests() {
    return this.prisma.customFeatureRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Submits a new custom ERP module or formula rule request.
   */
  async createCustomRequest(dto: CreateCustomRequestDto) {
    const request = await this.prisma.customFeatureRequest.create({
      data: {
        title: dto.title.trim(),
        category: dto.category,
        currentWorkflowDescription: dto.currentWorkflowDescription.trim(),
        desiredBehavior: dto.desiredBehavior.trim(),
        priority: dto.priority ?? 'NORMAL',
        status: 'SUBMITTED',
      },
    });

    await this.auditLogService.record({
      action: 'CUSTOM_REQUEST_SUBMITTED',
      category: AuditCategory.SETTINGS,
      summary: `Submitted custom feature request: "${request.title}" (${request.category})`,
      details: JSON.stringify({ id: request.id, priority: request.priority }),
      severity: AuditSeverity.INFO,
    });

    return request;
  }

  /**
   * Updates status, setup fee, and admin notes on a custom feature request.
   */
  async updateCustomRequest(id: number, dto: UpdateCustomRequestDto) {
    const existing = await this.prisma.customFeatureRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Custom feature request #${id} not found`);
    }

    const updated = await this.prisma.customFeatureRequest.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
        ...(dto.currentWorkflowDescription !== undefined
          ? { currentWorkflowDescription: dto.currentWorkflowDescription.trim() }
          : {}),
        ...(dto.desiredBehavior !== undefined
          ? { desiredBehavior: dto.desiredBehavior.trim() }
          : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.adminNotes !== undefined ? { adminNotes: dto.adminNotes?.trim() } : {}),
        ...(dto.estimatedSetupFee !== undefined
          ? { estimatedSetupFee: dto.estimatedSetupFee }
          : {}),
      },
    });

    await this.auditLogService.record({
      action: 'CUSTOM_REQUEST_UPDATED',
      category: AuditCategory.SETTINGS,
      summary: `Updated custom feature request #${id} status: ${updated.status}`,
      details: JSON.stringify({
        id,
        status: updated.status,
        estimatedSetupFee: updated.estimatedSetupFee,
      }),
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  /**
   * Deletes a custom feature request.
   */
  async deleteCustomRequest(id: number) {
    const existing = await this.prisma.customFeatureRequest.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Custom feature request #${id} not found`);
    }

    await this.prisma.customFeatureRequest.delete({
      where: { id },
    });

    return existing;
  }

  // ─────────────────────────────────────────────
  // Phase 8.5 (Stage B): Commercial Sandbox & Dynamic Routine Categories
  // ─────────────────────────────────────────────

  /**
   * Resets the isolated commercial demo sandbox state to clean defaults.
   */
  async resetSandbox(): Promise<SandboxState> {
    const sandbox = buildDefaultSandboxState();
    await this.prisma.globalConfig.update({
      where: { userId: 1 },
      data: {
        sandboxStateJson: sandbox as any,
        customRoutineCategoriesJson: sandbox.routineCategories as any,
      },
    });
    return sandbox;
  }

  /**
   * Returns active routine categories.
   */
  async getRoutineCategories(userId: number = 1): Promise<RoutineCategoryConfig[]> {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst());
    if (!config) {
      return buildDefaultSandboxState().routineCategories;
    }

    if (userId === 1 || config.profileMode === 'SUPERADMIN_BESPOKE') {
      return [
        { id: 'transport', label: 'Transport', target: config.transport },
        { id: 'internet', label: 'Internet', target: config.internet },
        { id: 'vape', label: 'Vape', target: config.vape },
        { id: 'haircut', label: 'Haircut', target: config.haircut },
      ];
    }

    if (
      Array.isArray(config.customRoutineCategoriesJson) &&
      config.customRoutineCategoriesJson.length > 0
    ) {
      return (config.customRoutineCategoriesJson as any[]).filter((c) => !c.hidden);
    }

    return buildDefaultSandboxState().routineCategories;
  }

  /**
   * Adds a dynamic routine category in STANDARD_GENERAL mode.
   */
  async addRoutineCategory(
    label: string,
    target: number,
    userId: number = 1,
  ): Promise<RoutineCategoryConfig[]> {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));
    const current: RoutineCategoryConfig[] =
      Array.isArray(config?.customRoutineCategoriesJson) &&
      config!.customRoutineCategoriesJson.length > 0
        ? (config!.customRoutineCategoriesJson as any[])
        : buildDefaultSandboxState().routineCategories;

    const slug =
      label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 20) || 'custom';
    const id = `${slug}_${Date.now()}`;
    const newItem: RoutineCategoryConfig = {
      id,
      label: label.trim(),
      target: Math.max(0, target),
      isCustom: true,
      hidden: false,
    };

    const updated = [...current, newItem];
    await this.prisma.globalConfig.update({
      where: { userId },
      data: { customRoutineCategoriesJson: updated as any },
    });
    return updated.filter((c) => !c.hidden);
  }

  /**
   * Removes or hides a dynamic routine category.
   */
  async removeRoutineCategory(
    id: string,
    userId: number = 1,
  ): Promise<RoutineCategoryConfig[]> {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));
    const current: RoutineCategoryConfig[] =
      Array.isArray(config?.customRoutineCategoriesJson) &&
      config!.customRoutineCategoriesJson.length > 0
        ? (config!.customRoutineCategoriesJson as any[])
        : buildDefaultSandboxState().routineCategories;

    const updated = current.filter((c) => c.id !== id);
    await this.prisma.globalConfig.update({
      where: { userId },
      data: { customRoutineCategoriesJson: updated as any },
    });
    return updated.filter((c) => !c.hidden);
  }
}
