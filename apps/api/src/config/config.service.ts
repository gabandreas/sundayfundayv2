import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  AuditCategory,
  AuditSeverity,
  CreditCardChargeType,
  CreditCardStatus,
  LiabilityCategory,
  SnapshotStatus,
} from '@prisma/client';
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
import { resolveStudioConfig } from './studio.defaults';

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

    const { recalculateDrafts, fromMonth, fromYear, studioConfig, ...configFields } = dto;

    if (studioConfig !== undefined) {
      const existing = await this.prisma.globalConfig.findFirst({ where: { userId } });
      const baseFormula =
        existing?.formulaParamsJson && typeof existing.formulaParamsJson === 'object'
          ? { ...(existing.formulaParamsJson as any) }
          : {};
      const mergedStudio = resolveStudioConfig(
        userId,
        { studioConfig },
        existing ?? undefined,
      );
      configFields.formulaParamsJson = {
        ...baseFormula,
        ...(dto.formulaParamsJson && typeof dto.formulaParamsJson === 'object'
          ? dto.formulaParamsJson
          : {}),
        studioConfig: mergedStudio,
      };
    }

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
   * Updates Modular Preferences Studio tables (stored cleanly under GlobalConfig.formulaParamsJson.studioConfig).
   */
  async updateStudioConfig(patch: any, userId: number = 1) {
    const existing =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));

    if (!existing) {
      throw new NotFoundException('GlobalConfig not found for user');
    }

    const curStudio = resolveStudioConfig(userId, existing.formulaParamsJson, existing);
    const nextStudio = resolveStudioConfig(
      userId,
      {
        studioConfig: {
          enableExternalAssetPortfolio:
            typeof patch?.enableExternalAssetPortfolio === 'boolean'
              ? patch.enableExternalAssetPortfolio
              : curStudio.enableExternalAssetPortfolio,
          actualP1VaultBalanceRp:
            patch && Object.prototype.hasOwnProperty.call(patch, 'actualP1VaultBalanceRp')
              ? patch.actualP1VaultBalanceRp === null
                ? null
                : Math.max(0, Math.round(Number(patch.actualP1VaultBalanceRp) || 0))
              : curStudio.actualP1VaultBalanceRp,
          paycycleFormulaConfig: patch?.paycycleFormulaConfig
            ? {
                ...curStudio.paycycleFormulaConfig,
                ...patch.paycycleFormulaConfig,
                formulas: patch.paycycleFormulaConfig.formulas
                  ? {
                      ...curStudio.paycycleFormulaConfig.formulas,
                      ...patch.paycycleFormulaConfig.formulas,
                    }
                  : curStudio.paycycleFormulaConfig.formulas,
                periodOverrides: patch.paycycleFormulaConfig.periodOverrides
                  ? patch.paycycleFormulaConfig.periodOverrides
                  : curStudio.paycycleFormulaConfig.periodOverrides,
              }
            : curStudio.paycycleFormulaConfig,
          instrumentsTable: Array.isArray(patch?.instrumentsTable)
            ? patch.instrumentsTable
            : curStudio.instrumentsTable,
          assetAccountsTable: Array.isArray(patch?.assetAccountsTable)
            ? patch.assetAccountsTable
            : curStudio.assetAccountsTable,
          routineTemplatesTable: Array.isArray(patch?.routineTemplatesTable)
            ? patch.routineTemplatesTable
            : curStudio.routineTemplatesTable,
          sidebarNavigationConfig: patch?.sidebarNavigationConfig
            ? {
                ...curStudio.sidebarNavigationConfig,
                ...patch.sidebarNavigationConfig,
              }
            : curStudio.sidebarNavigationConfig,
          priorityTiers: Array.isArray(patch?.priorityTiers)
            ? patch.priorityTiers
            : curStudio.priorityTiers,
          savingsPockets: Array.isArray(patch?.savingsPockets)
            ? patch.savingsPockets
            : curStudio.savingsPockets,
          displayPreferences: patch?.displayPreferences
            ? {
                ...curStudio.displayPreferences,
                ...patch.displayPreferences,
              }
            : curStudio.displayPreferences,
          privacyPreferences: patch?.privacyPreferences
            ? {
                ...curStudio.privacyPreferences,
                ...patch.privacyPreferences,
              }
            : curStudio.privacyPreferences,
        },
      },
      existing,
    );

    const baseFormula =
      existing.formulaParamsJson && typeof existing.formulaParamsJson === 'object'
        ? { ...(existing.formulaParamsJson as any) }
        : {};

    const syncTopFields: Record<string, any> = {};
    if (patch?.paycycleFormulaConfig?.paydayAnchorDay) {
      syncTopFields.payrollPayoutDay = Math.max(
        1,
        Math.min(31, Number(patch.paycycleFormulaConfig.paydayAnchorDay) || 27),
      );
    }
    if (patch?.paycycleFormulaConfig?.p1TargetFloorRp !== undefined) {
      syncTopFields.baseSavings = Math.max(
        0,
        Math.round(Number(patch.paycycleFormulaConfig.p1TargetFloorRp) || 0),
      );
    }
    if (patch?.paycycleFormulaConfig?.laptopAllowanceRp !== undefined) {
      syncTopFields.laptopAllowance = Math.max(
        0,
        Math.round(Number(patch.paycycleFormulaConfig.laptopAllowanceRp) || 0),
      );
    }
    if (patch?.paycycleFormulaConfig?.defaultDailyAllowanceRp !== undefined) {
      syncTopFields.dailyAllowance = Math.max(
        0,
        Math.round(Number(patch.paycycleFormulaConfig.defaultDailyAllowanceRp) || 0),
      );
    }
    if (
      patch?.paycycleFormulaConfig?.optimalDebtRatioPercent !== undefined ||
      patch?.paycycleFormulaConfig?.maxSafeDebtRatioPercent !== undefined
    ) {
      const prevPolicy =
        existing.financialPolicyJson && typeof existing.financialPolicyJson === 'object'
          ? (existing.financialPolicyJson as any)
          : buildDefaultFinancialPolicy();
      syncTopFields.financialPolicyJson = {
        ...prevPolicy,
        optimalDebtRatioPercent:
          nextStudio.paycycleFormulaConfig.optimalDebtRatioPercent ??
          prevPolicy.optimalDebtRatioPercent ??
          20,
        maxSafeDebtRatioPercent:
          nextStudio.paycycleFormulaConfig.maxSafeDebtRatioPercent ??
          prevPolicy.maxSafeDebtRatioPercent ??
          35,
      };
    }
    if (Array.isArray(patch?.instrumentsTable)) {
      const ccInst = nextStudio.instrumentsTable.find(
        (i) => i.type === 'CREDIT_CARD',
      );
      const spInst = nextStudio.instrumentsTable.find(
        (i) => i.type === 'PAYLATER',
      );
      if (ccInst) {
        if (ccInst.cutoffDay > 0) syncTopFields.creditStatementDay = ccInst.cutoffDay;
        if (ccInst.dueDay > 0) syncTopFields.creditDueDay = ccInst.dueDay;
        if (ccInst.creditLimitRp > 0) syncTopFields.creditLimit = ccInst.creditLimitRp;
      }
      if (spInst && spInst.creditLimitRp > 0) {
        syncTopFields.paylaterUsageLimit = spInst.creditLimitRp;
      }
    }

    const updated = await this.prisma.globalConfig.update({
      where: { id: existing.id },
      data: {
        ...syncTopFields,
        formulaParamsJson: {
          ...baseFormula,
          studioConfig: nextStudio,
        } as any,
      },
    });

    await this.auditLogService.record({
      action: 'UPDATE_STUDIO_CONFIG',
      category: AuditCategory.SETTINGS,
      summary: 'Updated Modular Preferences Studio configuration tables',
      details: JSON.stringify(Object.keys(patch || {})),
      severity: AuditSeverity.INFO,
    });

    return {
      studioConfig: nextStudio,
      globalConfigId: updated.id,
    };
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
   * Restores modular formula rules to canonical factory defaults for the caller's userId.
   */
  async restoreDefaultRules(userId: number = 1) {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));
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
      where: { userId },
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
   * Resets the isolated Demo Sandbox (`userId = 2`) onto clean, deterministic PostgreSQL rows
   * while strictly protecting User #1's production records from ever being touched.
   */
  async resetSandbox(userId: number = 2): Promise<SandboxState & { initializedPeriods: number }> {
    if (userId !== 2) {
      throw new ForbiddenException(
        'Reset Sandbox is strictly restricted to the Demo Sandbox workspace (userId = 2)',
      );
    }

    const sandbox = buildDefaultSandboxState(10, 2026);
    const sandboxPayrollRules = [
      {
        id: 'net_fixed',
        label: 'Flat Net Salary',
        direction: 'ADDITION',
        formulaType: 'FIXED_AMOUNT',
        value: 0,
        isActive: false,
      },
    ];
    const sandboxBuckets = buildDefaultAllocationBuckets({
      transport: 600_000,
      internet: 450_000,
      vape: 300_000,
      haircut: 0,
      dailyOperational: 3_000_000,
      savings: 1_500_000,
      bufferPocket: 0,
    });
    const sandboxSurplusSplit = buildDefaultSurplusSplitRules();
    const sandboxPolicy = buildDefaultFinancialPolicy();
    const sandboxRoutineCategories: RoutineCategoryConfig[] = [
      { id: 'transport', label: 'Transport & Fuel', target: 600_000, isCustom: false },
      { id: 'internet', label: 'Internet & Utilities', target: 450_000, isCustom: false },
      { id: 'vape', label: 'Subscriptions & Lifestyle', target: 300_000, isCustom: false },
    ];
    sandbox.routineCategories = sandboxRoutineCategories;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.transaction.deleteMany({
          where: { snapshot: { userId: 2 } },
        });
        await tx.budgetRevision.deleteMany({
          where: { snapshot: { userId: 2 } },
        });
        await tx.monthlySnapshot.deleteMany({
          where: { userId: 2 },
        });
        await tx.liabilityLineItem.deleteMany({
          where: { userId: 2 },
        });
        await tx.monthlyBulkBill.deleteMany({
          where: { userId: 2 },
        });
        await tx.creditCardTransaction.deleteMany({
          where: { userId: 2 },
        });
        await tx.savingsManualTransaction.deleteMany({
          where: { userId: 2 },
        });
        await tx.savingsGoal.deleteMany({
          where: { userId: 2 },
        });
        await tx.wishlistItem.deleteMany({
          where: { userId: 2 },
        });

        await tx.globalConfig.upsert({
          where: { userId: 2 },
          update: {
            baseSalary: 10_000_000,
            dailyAllowance: 0,
            laptopAllowance: 0,
            dailyOperational: 3_000_000,
            transport: 600_000,
            internet: 450_000,
            vape: 300_000,
            haircut: 0,
            baseSavings: 1_500_000,
            creditLimit: 20_000_000,
            creditStatementDay: 20,
            creditDueDay: 11,
            payrollPayoutDay: 25,
            ccUsageLimit: 3_000_000,
            paylaterUsageLimit: 1_500_000,
            activeTrackingStartMonth: 10,
            activeTrackingStartYear: 2026,
            profileMode: 'STANDARD_GENERAL',
            lifeStagePreset: 'CORPORATE_PROFESSIONAL',
            uiDensityMode: 'COMMAND_COCKPIT',
            payrollMode: 'FIXED_SALARY',
            formulaEngineType: 'DEBT_FIRST_WATERFALL',
            payrollRulesJson: sandboxPayrollRules as any,
            allocationBucketsJson: sandboxBuckets as any,
            surplusSplitRulesJson: sandboxSurplusSplit as any,
            financialPolicyJson: sandboxPolicy as any,
            customRoutineCategoriesJson: sandboxRoutineCategories as any,
            sandboxStateJson: sandbox as any,
          },
          create: {
            userId: 2,
            baseSalary: 10_000_000,
            dailyAllowance: 0,
            laptopAllowance: 0,
            dailyOperational: 3_000_000,
            transport: 600_000,
            internet: 450_000,
            vape: 300_000,
            haircut: 0,
            baseSavings: 1_500_000,
            creditLimit: 20_000_000,
            creditStatementDay: 20,
            creditDueDay: 11,
            payrollPayoutDay: 25,
            ccUsageLimit: 3_000_000,
            paylaterUsageLimit: 1_500_000,
            activeTrackingStartMonth: 10,
            activeTrackingStartYear: 2026,
            profileMode: 'STANDARD_GENERAL',
            lifeStagePreset: 'CORPORATE_PROFESSIONAL',
            uiDensityMode: 'COMMAND_COCKPIT',
            payrollMode: 'FIXED_SALARY',
            formulaEngineType: 'DEBT_FIRST_WATERFALL',
            payrollRulesJson: sandboxPayrollRules as any,
            allocationBucketsJson: sandboxBuckets as any,
            surplusSplitRulesJson: sandboxSurplusSplit as any,
            financialPolicyJson: sandboxPolicy as any,
            customRoutineCategoriesJson: sandboxRoutineCategories as any,
            sandboxStateJson: sandbox as any,
          },
        });

        await tx.creditCardTransaction.createMany({
          data: [
            {
              userId: 2,
              label: 'MacBook Air M3 (Installment)',
              amount: 15_000_000,
              totalAmount: 15_000_000,
              monthlyAmount: 1_250_000,
              chargeType: CreditCardChargeType.INSTALLMENT,
              tenor: 12,
              category: 'Workstation',
              transactionDate: new Date('2026-10-01T00:00:00.000Z'),
              billingMonth: 10,
              billingYear: 2026,
              isRecurring: false,
              isActive: true,
              status: CreditCardStatus.ACTIVE,
              notes: 'Demo Sandbox workstation installment',
            },
            {
              userId: 2,
              label: 'Spotify Premium Family',
              amount: 55_000,
              totalAmount: 55_000,
              monthlyAmount: 55_000,
              chargeType: CreditCardChargeType.RECURRING,
              tenor: 1,
              category: 'Subscription',
              transactionDate: new Date('2026-10-01T00:00:00.000Z'),
              billingMonth: 10,
              billingYear: 2026,
              isRecurring: true,
              isActive: true,
              status: CreditCardStatus.ACTIVE,
              notes: 'Demo Sandbox recurring subscription',
            },
          ],
        });

        await tx.liabilityLineItem.createMany({
          data: [
            {
              userId: 2,
              month: 10,
              year: 2026,
              category: LiabilityCategory.PAYLATER,
              title: 'Shopee PayLater Gadget Accessory (1/3)',
              merchantOrPlatform: 'SPayLater',
              principalAmount: 900_000,
              monthlyAmount: 300_000,
              tenorMonths: 3,
              installmentIndex: 1,
              cutoffDay: 15,
              dueDay: 25,
              isSettled: false,
              parentContractId: 'DEMO-PL-01',
            },
            {
              userId: 2,
              month: 11,
              year: 2026,
              category: LiabilityCategory.PAYLATER,
              title: 'Shopee PayLater Gadget Accessory (2/3)',
              merchantOrPlatform: 'SPayLater',
              principalAmount: 900_000,
              monthlyAmount: 300_000,
              tenorMonths: 3,
              installmentIndex: 2,
              cutoffDay: 15,
              dueDay: 25,
              isSettled: false,
              parentContractId: 'DEMO-PL-01',
            },
            {
              userId: 2,
              month: 12,
              year: 2026,
              category: LiabilityCategory.PAYLATER,
              title: 'Shopee PayLater Gadget Accessory (3/3)',
              merchantOrPlatform: 'SPayLater',
              principalAmount: 900_000,
              monthlyAmount: 300_000,
              tenorMonths: 3,
              installmentIndex: 3,
              cutoffDay: 15,
              dueDay: 25,
              isSettled: false,
              parentContractId: 'DEMO-PL-01',
            },
            {
              userId: 2,
              month: 11,
              year: 2026,
              category: LiabilityCategory.PERSONAL_DEBT,
              title: 'Family Bridge Advance',
              merchantOrPlatform: 'Personal / Peer',
              principalAmount: 200_000,
              monthlyAmount: 200_000,
              tenorMonths: 1,
              installmentIndex: 1,
              cutoffDay: 1,
              dueDay: 25,
              isSettled: false,
              parentContractId: 'DEMO-PD-01',
            },
          ],
        });

        await tx.monthlyBulkBill.createMany({
          data: [
            {
              userId: 2,
              label: 'Monthly Bulk Bill',
              paylaterAmount: 300_000,
              personalDebtAmount: 0,
              creditCardAmount: 0,
              amount: 300_000,
              month: 10,
              year: 2026,
            },
            {
              userId: 2,
              label: 'Monthly Bulk Bill',
              paylaterAmount: 300_000,
              personalDebtAmount: 200_000,
              creditCardAmount: 0,
              amount: 500_000,
              month: 11,
              year: 2026,
            },
            {
              userId: 2,
              label: 'Monthly Bulk Bill',
              paylaterAmount: 300_000,
              personalDebtAmount: 0,
              creditCardAmount: 0,
              amount: 300_000,
              month: 12,
              year: 2026,
            },
          ],
        });

        await tx.savingsManualTransaction.createMany({
          data: [
            {
              userId: 2,
              label: 'Liquid Emergency Reserve Deposit',
              amount: 15_000_000,
              instrumentType: 'LIQUID_CASH',
              date: new Date('2026-10-01T00:00:00.000Z'),
            },
            {
              userId: 2,
              label: 'Core Investment Fund Allocation',
              amount: 10_000_000,
              instrumentType: 'INVESTMENT_RDPU',
              date: new Date('2026-10-01T00:00:00.000Z'),
            },
          ],
        });

        await tx.savingsGoal.create({
          data: {
            userId: 2,
            name: 'Emergency Fund Buffer',
            targetAmount: 30_000_000,
            currentAllocatedAmount: 25_000_000,
            targetMonth: 12,
            targetYear: 2026,
            category: 'EMERGENCY_FUND',
          },
        });
      },
      { maxWait: 15000, timeout: 30000 },
    );

    const demoPeriods = [
      { month: 10, year: 2026 },
      { month: 11, year: 2026 },
      { month: 12, year: 2026 },
      { month: 1, year: 2027 },
      { month: 2, year: 2027 },
    ];
    for (const p of demoPeriods) {
      await this.snapshotsService.initializePeriod(p.month, p.year, 2);
    }

    return {
      ...sandbox,
      initializedPeriods: demoPeriods.length,
    };
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
