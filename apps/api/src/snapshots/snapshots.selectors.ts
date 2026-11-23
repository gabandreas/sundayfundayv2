import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotStatus } from '@prisma/client';
import { CreditService } from '../credit/credit.service';
import {
  calculateWorkingDaysForConsumptionPeriod,
  mergeStudioHolidayMap,
} from '../calculator/payroll';
import { computePaycycleHorizonTs } from '../calculator/erp-engines';
import {
  DEFAULT_PAYOUT_DAY,
  DefaultPeriodStrategy,
  getPayrollPeriodForDate,
  resolveDefaultActivePeriod,
} from '../calculator/pacing';
import { resolveStudioConfig } from '../config/studio.defaults';
import { calculateCardDueAmountForMonth } from '../credit/credit.utils';
import { calculateTotalDeductions } from '../calculator/waterfall';
import {
  buildDefaultSandboxState,
  SandboxState,
} from '../config/sandbox.defaults';
import {
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
  evaluateModularEngine,
} from '../calculator/modular-engine';

@Injectable()
export class SnapshotsSelectors {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => CreditService))
    private readonly creditService?: CreditService,
  ) {}

  buildSandboxSnapshot(sandbox: any, month: number, year: number): any {
    const routineCategories = sandbox.routineCategories || [
      { id: 'housing', label: 'Housing & Rent', target: 2000000, isCustom: true },
      { id: 'transport', label: 'Transport & Fuel', target: 600000 },
      { id: 'internet', label: 'Internet & Utilities', target: 450000 },
      { id: 'vape', label: 'Subscriptions & Lifestyle', target: 300000 },
    ];
    const routineTotal = routineCategories.reduce(
      (sum: number, c: any) => sum + (c.target || 0),
      0,
    );
    const creditTotal = (sandbox.creditItems || []).reduce(
      (sum: number, c: any) => sum + (c.monthlyAmount || c.amount || 0),
      0,
    );

    const netSalary = sandbox.persona?.netSalary ?? 10_000_000;
    const dailyLiving = sandbox.persona?.dailyLivingBudget ?? 3_000_000;
    const savingsP1 = sandbox.persona?.coreSavingsTarget ?? 1_500_000;
    const selfRewardP2 = Math.max(
      0,
      netSalary - (routineTotal + creditTotal + dailyLiving + savingsP1),
    );

    const totalDeductions = routineTotal + creditTotal;

    const transportCat = routineCategories.find((c: any) => c.id === 'transport');
    const internetCat = routineCategories.find((c: any) => c.id === 'internet');
    const vapeCat = routineCategories.find(
      (c: any) => c.id === 'vape' || c.id === 'subscriptions',
    );
    const haircutCat = routineCategories.find((c: any) => c.id === 'haircut');

    return {
      id: 999999,
      userId: 2,
      isSandbox: true,
      month,
      year,
      status: 'DRAFT',
      salaryAdjustment: 0,
      totalWorkingDays: 21,
      cafeteriaDeduction: 0,
      bonusAmount: 0,
      thrAmount: 0,
      payrollPayoutDate: new Date(
        Date.UTC(year, month - 1, sandbox.persona?.paydayAnchor ?? 25),
      ),
      isPayoutDateConfirmed: false,
      dailyOperational: dailyLiving,
      actualDailyOperational: dailyLiving,
      transport: transportCat?.target ?? 600000,
      internet: internetCat?.target ?? 450000,
      vape: vapeCat?.target ?? 300000,
      haircut: haircutCat?.target ?? 0,
      savings: savingsP1,
      actualSavings: savingsP1,
      selfReward: selfRewardP2,
      selfRewardTarget: selfRewardP2,
      deficitUncovered: 0,
      finalTotalIncome: netSalary,
      netSalaryIncome: netSalary,
      totalIncome: netSalary,
      totalDeductions,
      paylaterBills: 0,
      personalDebtBills: 0,
      contractInstallments: 0,
      creditCardBills: creditTotal,
      extraIncome: 0,
      ccUsageLimit: 0,
      paylaterUsageLimit: 0,
      bufferPocket: 0,
      frozenRulesJson: null,
      bucketRealizationsJson: null,
      pacingRealizationJson: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transactions: (sandbox.transactions || []).map((t: any) => ({
        ...t,
        snapshotId: 999999,
        createdAt: new Date().toISOString(),
      })),
      budgetRevisions: [],
    };
  }

  /**
   * Retrieves an existing snapshot for (month, year) or initializes a new DRAFT snapshot
   * by copying baseline targets from GlobalConfig and idempotently provisioning liabilities.
   *
   * ARCHITECTURE.md §3 & §4:
   * This read path MUST NEVER mutate CreditContract.remainingTenor or cross-period state.
   * Initial provisioning triggers syncLiabilitiesToSnapshot and recalculateSnapshot which
   * are idempotent and scoped strictly to the newly created snapshot.
   */
  async getOrCreateDraftSnapshot(month: number, year: number, userId: number = 1) {
    const existing = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId,
          month,
          year,
        },
      },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        budgetRevisions: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (existing) {
      return existing;
    }

    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

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

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;
    const periodKey = `${String(month).padStart(2, '0')}/${year}`;
    const override = pcCfg.periodOverrides?.[periodKey];
    const resolvedHorizon = computePaycycleHorizonTs({
      month,
      year,
      anchorDay: pcCfg.paydayAnchorDay ?? config.payrollPayoutDay ?? DEFAULT_PAYOUT_DAY,
      payslipAnchorDay: pcCfg.payslipAnchorDay,
      payslipShiftRule: pcCfg.payslipShiftRule,
      reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
      holidaysIso: pcCfg.holidayDatesIso,
      explicitPayslipIso: override?.payslipDateIso,
      explicitStartIso: override?.paydayDateIso,
      shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
      weekendMultiplier: pcCfg.weekendWeightMultiplier,
      remainingBudgetRp: 0,
    });

    let createdNew = true;
    const snapshot = await this.prisma.monthlySnapshot
      .create({
        data: {
          userId,
          month,
          year,
          status: SnapshotStatus.DRAFT,
          dailyOperational: config.dailyOperational,
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          savings: config.baseSavings,
          ccUsageLimit: config.ccUsageLimit ?? 0,
          paylaterUsageLimit: config.paylaterUsageLimit ?? 0,
          totalWorkingDays: calculateWorkingDaysForConsumptionPeriod(
            month,
            year,
            mergeStudioHolidayMap(pcCfg.holidayDatesIso),
            {
              startDay: pcCfg.attendanceCutoffStartDay,
              endDay: pcCfg.attendanceCutoffEndDay,
            },
          ),
          salaryAdjustment: 0,
          cafeteriaDeduction: 0,
          thrAmount: 0,
          bonusAmount: 0,
          selfRewardTarget: 0,
          bufferPocket: 0,
          payrollPayoutDate: new Date(`${resolvedHorizon.paydayIso}T00:00:00.000Z`),
          isPayoutDateConfirmed: Boolean(override?.paydayDateIso),
          frozenRulesJson: frozenRulesJson as any,
        },
        include: {
          transactions: true,
          budgetRevisions: true,
        },
      })
      .catch(async (err: any) => {
        if (err?.code === 'P2002') {
          createdNew = false;
          return this.prisma.monthlySnapshot.findUniqueOrThrow({
            where: { userId_month_year: { userId, month, year } },
            include: {
              transactions: true,
              budgetRevisions: true,
            },
          });
        }
        throw err;
      });

    // Idempotent first-view provisioning exception (ARCHITECTURE.md §4):
    // Sync due liabilities and recalculate initial snapshot figures ONLY on the creator request
    if (createdNew && this.creditService) {
      await this.creditService.syncLiabilitiesToSnapshot(month, year, undefined, userId);
      return this.prisma.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshot.id },
        include: {
          transactions: {
            orderBy: { date: 'desc' },
          },
          budgetRevisions: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    }

    return snapshot;
  }

  async getSnapshotById(id: number, userId?: number) {
    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
        },
        budgetRevisions: {
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${id} not found`);
    }
    if (userId !== undefined && snapshot.userId !== userId) {
      throw new ForbiddenException(`Access denied to snapshot #${id}`);
    }

    return snapshot;
  }

  /**
   * Retrieves budget revisions for a snapshot ordered chronologically.
   */
  async listBudgetRevisions(snapshotId: number, userId?: number) {
    if (userId !== undefined) {
      await this.getSnapshotById(snapshotId, userId);
    }
    return this.prisma.budgetRevision.findMany({
      where: { snapshotId },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Read-only 12-month horizon loader for instant frontend period switching.
   * Returns materialized MonthlySnapshot records verbatim where present, and
   * synthesizes non-persisted read-only forecast snapshots for unmaterialized
   * future periods via evaluateModularEngine without mutating the database.
   */
  async getDefaultActivePeriod(
    userId: number = 1,
    referenceDate: Date = new Date(),
  ): Promise<{
    month: number;
    year: number;
    strategy: DefaultPeriodStrategy;
    skippedLockedPeriod: boolean;
  }> {
    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const strategy: DefaultPeriodStrategy =
      studioConfig.paycycleFormulaConfig.defaultPeriodStrategy === 'CALENDAR_WINDOW'
        ? 'CALENDAR_WINDOW'
        : 'EARLIEST_OPEN_ACTIVE';
    const cycleTransitionDay =
      studioConfig.paycycleFormulaConfig.paydayAnchorDay || 27;

    const snapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId },
      select: { month: true, year: true, status: true },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const resolved = resolveDefaultActivePeriod({
      referenceDate,
      cycleTransitionDay,
      strategy,
      snapshots,
    });

    return {
      month: resolved.month,
      year: resolved.year,
      strategy,
      skippedLockedPeriod: resolved.skippedLockedPeriod,
    };
  }

  async listHorizonSnapshots(
    startMonth?: number,
    startYear?: number,
    count: number = 12,
    userId: number = 1,
  ) {
    const activePeriod = getPayrollPeriodForDate();
    const sMonth = startMonth && startMonth >= 1 && startMonth <= 12 ? startMonth : activePeriod.month;
    const sYear = startYear && startYear >= 2020 ? startYear : activePeriod.year;
    const safeCount = Math.min(24, Math.max(1, Math.round(count || 12)));

    const periods: Array<{ month: number; year: number }> = [];
    for (let i = 0; i < safeCount; i++) {
      const idx = sMonth - 1 + i;
      const month = (idx % 12) + 1;
      const year = sYear + Math.floor(idx / 12);
      periods.push({ month, year });
    }

    const periodOr = periods.map((p) => ({ month: p.month, year: p.year }));
    const [config, existingSnapshots, bulkBills, cardTxs, contracts] = await Promise.all([
      (async () =>
        (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })))(),
      this.prisma.monthlySnapshot.findMany({
        where: { userId, OR: periodOr },
        include: {
          transactions: { orderBy: { date: 'desc' } },
          budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
        },
      }),
      this.prisma.monthlyBulkBill.findMany({
        where: { userId, OR: periodOr },
      }),
      this.prisma.creditCardTransaction.findMany({
        where: { userId },
      }),
      this.prisma.creditContract.findMany({
        where: { userId, isActive: true, remainingTenor: { gt: 0 } },
      }),
    ]);

    if (!config) {
      throw new BadRequestException('Global configuration has not been initialized');
    }

    const snapMap = new Map(
      existingSnapshots.map((s) => [`${s.year}-${s.month}`, s]),
    );
    const bulkMap = new Map(
      bulkBills.map((b) => [`${b.year}-${b.month}`, b]),
    );

    const payrollRules =
      (config.payrollRulesJson as any) ??
      buildDefaultPayrollRules(config.dailyAllowance, config.laptopAllowance);
    const allocationBuckets =
      (config.allocationBucketsJson as any) ??
      buildDefaultAllocationBuckets({
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
        dailyOperational: config.dailyOperational,
        savings: config.baseSavings,
        bufferPocket: 0,
      });
    const surplusSplitRules =
      (config.surplusSplitRulesJson as any) ?? buildDefaultSurplusSplitRules();
    const financialPolicy =
      (config.financialPolicyJson as any) ?? buildDefaultFinancialPolicy();
    const formulaEngineType =
      userId === 1 && !config.formulaEngineType
        ? 'DEBT_FIRST_WATERFALL'
        : ((config.formulaEngineType as any) || 'DEBT_FIRST_WATERFALL');
    const formulaParams = (config.formulaParamsJson as any) || null;
    const frozenRulesJson = {
      payrollRules,
      allocationBuckets,
      surplusSplitRules,
      financialPolicy,
    };

    const items = periods.map(({ month, year }) => {
      const existing = snapMap.get(`${year}-${month}`);
      if (existing) {
        return { ...existing, isForecast: false };
      }

      const studioCfg = resolveStudioConfig(userId, config?.formulaParamsJson, config);
      const pcCfg = studioCfg.paycycleFormulaConfig;
      const periodKey = `${String(month).padStart(2, '0')}/${year}`;
      const override = pcCfg.periodOverrides?.[periodKey];
      const horizon = computePaycycleHorizonTs({
        month,
        year,
        anchorDay: pcCfg.paydayAnchorDay ?? config.payrollPayoutDay ?? DEFAULT_PAYOUT_DAY,
        payslipAnchorDay: pcCfg.payslipAnchorDay,
        payslipShiftRule: pcCfg.payslipShiftRule,
        reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
        holidaysIso: pcCfg.holidayDatesIso,
        explicitPayslipIso: override?.payslipDateIso,
        explicitStartIso: override?.paydayDateIso,
        shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
        weekendMultiplier: pcCfg.weekendWeightMultiplier,
        remainingBudgetRp: 0,
      });

      const totalWorkingDays = calculateWorkingDaysForConsumptionPeriod(
        month,
        year,
        mergeStudioHolidayMap(pcCfg.holidayDatesIso),
        {
          startDay: pcCfg.attendanceCutoffStartDay,
          endDay: pcCfg.attendanceCutoffEndDay,
        },
      );
      const bulk = bulkMap.get(`${year}-${month}`);
      const paylaterBills = Math.round(bulk?.paylaterAmount ?? 0);
      const personalDebtBills = Math.round(bulk?.personalDebtAmount ?? 0);
      const creditCardBills = Math.round(
        cardTxs.reduce(
          (sum, c) => sum + calculateCardDueAmountForMonth(c as any, month, year),
          0,
        ),
      );
      const targetIdx = year * 12 + (month - 1);
      const contractInstallments = Math.round(
        contracts.reduce((sum, c) => {
          const startIdx = c.startYear * 12 + (c.startMonth - 1);
          const elapsed = targetIdx - startIdx;
          if (elapsed >= 0 && elapsed < c.totalTenor) {
            return sum + c.monthlyInstallment;
          }
          return sum;
        }, 0),
      );
      const totalCreditBills =
        paylaterBills + personalDebtBills + creditCardBills + contractInstallments;

      const fixedTargets = {
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
      };
      const totalDeductions = calculateTotalDeductions(
        [{ type: 'CREDIT_BILL', amount: totalCreditBills }],
        fixedTargets,
        config.dailyOperational,
      );

      const modular = evaluateModularEngine({
        baseSalary: config.baseSalary,
        salaryAdjustment: 0,
        totalWorkingDays,
        dailyAllowance: config.dailyAllowance,
        cafeteriaDeduction: 0,
        thrAmount: 0,
        bonusAmount: 0,
        extraIncome: 0,
        bridgeInflowAmount: 0,
        month,
        year,
        cycleDays: 30,
        totalCreditBills,
        totalDeductions,
        payrollRules,
        allocationBuckets,
        surplusSplitRules,
        financialPolicy,
        formulaEngineType,
        formulaParams,
        budgetRevisions: [],
        transactions: [],
      });

      const payoutIso = new Date(`${horizon.paydayIso}T00:00:00.000Z`).toISOString();

      return {
        id: -(year * 100 + month),
        userId,
        isForecast: true,
        month,
        year,
        status: SnapshotStatus.DRAFT,
        salaryAdjustment: 0,
        totalWorkingDays,
        cafeteriaDeduction: 0,
        thrAmount: 0,
        bonusAmount: 0,
        dailyOperational: modular.canonicalSnapshotColumns.dailyOperational,
        transport: modular.canonicalSnapshotColumns.transport,
        internet: modular.canonicalSnapshotColumns.internet,
        vape: modular.canonicalSnapshotColumns.vape,
        haircut: modular.canonicalSnapshotColumns.haircut,
        savings: modular.canonicalSnapshotColumns.savings,
        selfRewardTarget: modular.canonicalSnapshotColumns.selfRewardTarget,
        bufferPocket: modular.canonicalSnapshotColumns.bufferPocket,
        ccUsageLimit: config.ccUsageLimit ?? 0,
        paylaterUsageLimit: config.paylaterUsageLimit ?? 0,
        netSalaryIncome: modular.payroll.netSalaryIncome,
        extraIncome: 0,
        finalTotalIncome: modular.payroll.finalTotalIncome,
        totalDeductions,
        paylaterBills,
        personalDebtBills,
        contractInstallments,
        creditCardBills,
        actualDailyOperational: modular.waterfall.actualDailyOperational,
        actualSavings: modular.waterfall.actualSavings,
        selfReward: modular.waterfall.actualSelfReward,
        deficitUncovered: modular.waterfall.deficitUncovered,
        survivalPocket: modular.waterfall.survivalPocket,
        payrollPayoutDate: payoutIso,
        isPayoutDateConfirmed: false,
        frozenRulesJson,
        bucketRealizationsJson: modular.bucketRealizations,
        isManualOverride: false,
        lockedP1: null,
        lockedP2: null,
        bridgeInflowAmount: 0,
        oneOffBillsJson: null,
        createdAt: payoutIso,
        updatedAt: payoutIso,
        transactions: [],
        budgetRevisions: [],
      };
    });

    return {
      startMonth: sMonth,
      startYear: sYear,
      count: safeCount,
      periods: items,
    };
  }
}
