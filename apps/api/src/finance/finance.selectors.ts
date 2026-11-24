import { forwardRef, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { CreditSelectors } from '../credit/credit.selectors';
import { GoBridgeService, WithEngineMeta } from '../calculator/go-bridge.service';
import {
  CashRadarResult,
  CutoffSimulateResult,
  ExecutiveHorizonResult,
  TimelineSimulateResult,
  WalletGuardResult,
  addHybridMonths,
  formatHybridPeriodLabel,
  resolvePreviousBusinessDayIsoTs,
} from '../calculator/hybrid-engine';
import {
  Transaction,
  TransactionType,
  TransactionSourceType,
} from '@prisma/client';
import {
  calculatePayroll,
  calculateWorkingDaysForConsumptionPeriod,
  mergeStudioHolidayMap,
  sumExtraIncome,
  PayrollResult,
} from '../calculator/payroll';
import {
  calculateDailyPacing,
  PacingResult,
  normalizeDate,
  getPaydayCycleWindow,
  getPayrollPeriodForDate,
} from '../calculator/pacing';
import {
  calculateCashReconciliation,
  CashReconciliationPreview,
  SurplusResolutionMode,
} from '../calculator/reconciliation';
import {
  calculateFixedEssentialsRealization,
  calculateOperationalDailySpent,
  FixedEssentialsRealizationSummary,
  sumOperationalRefunds,
} from '../calculator/waterfall';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';
import { resolveStudioConfig } from '../config/studio.defaults';
import { computePaycycleHorizonTs } from '../calculator/erp-engines';
import { evaluateModularPayroll } from '../calculator/modular-engine';
import { SimulateScenarioDto, StressTestScenarioDto } from './dto/hybrid-finance.dto';
import { listConfiguredSsoProviders } from '../auth/sso.service';

export type EnrichedPacingResult = PacingResult & {
  fixedEssentialsRealization: FixedEssentialsRealizationSummary;
  operationalRefundsTotal: number;
};

@Injectable()
export class FinanceSelectors {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsSelectors: SnapshotsSelectors,
    private readonly goBridge: GoBridgeService,
    @Optional()
    @Inject(forwardRef(() => CreditSelectors))
    private readonly creditSelectors?: CreditSelectors,
  ) {}

  async listTransactions(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<Transaction[]> {
    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      return [];
    }

    return this.prisma.transaction.findMany({
      where: { snapshotId: snapshot.id },
      orderBy: { date: 'asc' },
    });
  }

  private computePayrollForSnapshot(params: {
    config: any;
    snapshot: any;
    month: number;
    totalWorkingDays: number;
    extraIncome: number;
    customAdjustments?: any[];
  }): PayrollResult {
    const { config, snapshot, month, totalWorkingDays, extraIncome } = params;
    const rawAdj = Array.isArray(params.customAdjustments)
      ? params.customAdjustments
      : Array.isArray(snapshot?.payrollPeriodAdjustments)
        ? snapshot.payrollPeriodAdjustments
        : [];
    const customAdjustments = rawAdj
      .map((adj: any) => ({
        id: adj.id,
        templateId: adj.templateId ?? null,
        label: String(adj.label || '').trim(),
        stage: adj.stage,
        amount: Math.max(0, Math.round(Number(adj.amount) || 0)),
        notes: adj.notes ?? null,
      }))
      .filter((adj: any) => adj.amount > 0 && adj.label.length > 0);
    const frozenPayrollRules = (snapshot?.frozenRulesJson as any)?.payrollRules;
    const payrollRules =
      Array.isArray(frozenPayrollRules) && frozenPayrollRules.length > 0
        ? frozenPayrollRules
        : Array.isArray(config?.payrollRulesJson) && config.payrollRulesJson.length > 0
          ? config.payrollRulesJson
          : null;

    if (payrollRules) {
      const frozenDailyRule = payrollRules.find((r: any) => r?.id === 'daily_attendance');
      const effectiveDailyAllowance =
        frozenPayrollRules && frozenDailyRule && frozenDailyRule.value !== undefined
          ? Number(frozenDailyRule.value)
          : config.dailyAllowance;
      const salaryAdjustment = snapshot?.salaryAdjustment ?? 0;
      const cafeteriaDeduction = snapshot?.cafeteriaDeduction ?? 0;
      const thrAmount = snapshot?.thrAmount ?? 0;
      const bonusAmount = snapshot?.bonusAmount ?? 0;
      const mod = evaluateModularPayroll({
        baseSalary: config.baseSalary,
        salaryAdjustment,
        totalWorkingDays,
        dailyAllowance: effectiveDailyAllowance,
        cafeteriaDeduction,
        thrAmount,
        bonusAmount,
        extraIncome,
        month,
        payrollRules,
        customPayrollRows: (config.formulaParamsJson as any)?.customPayrollRows,
        customAdjustments,
      });
      return {
        baseSalary: config.baseSalary,
        salaryAdjustment,
        adjustedBaseSalary: mod.adjustedBaseSalary,
        bpjsDeduction: mod.bpjsDeduction,
        laptopAllowance: mod.laptopAllowance,
        netBasePayroll: mod.netBasePayroll,
        totalWorkingDays,
        dailyAllowance: effectiveDailyAllowance,
        totalDailyAllowance: mod.totalDailyAllowance,
        netSalaryIncome: mod.netSalaryIncome,
        customPayrollAdditions: mod.customPayrollAdditions,
        customPayrollDeductions: mod.customPayrollDeductions,
        directPayrollDeductions: mod.directPayrollDeductions,
        bankTakeHomeSalary: mod.bankTakeHomeSalary,
        customAdjustments,
        extraIncome,
        finalTotalIncome: mod.finalTotalIncome,
        thrAmount: mod.thrAmount,
        bonusAmount: mod.bonusAmount,
        cafeteriaDeduction,
      };
    }

    const studioCfg = resolveStudioConfig(
      config?.userId ?? 1,
      config?.formulaParamsJson,
      config,
    );
    const pcCfg = studioCfg.paycycleFormulaConfig;

    return calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot?.salaryAdjustment ?? 0,
      totalWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot?.cafeteriaDeduction ?? 0,
      thrAmount: snapshot?.thrAmount ?? 0,
      bonusAmount: snapshot?.bonusAmount ?? 0,
      extraIncome,
      laptopAllowance: pcCfg.laptopAllowanceRp ?? config.laptopAllowance,
      bpjsRate: (pcCfg.bpjsRatePercent ?? 3) / 100,
      customAdjustments,
    });
  }

  async getPayroll(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<PayrollResult> {
    const config = await this.prisma.globalConfig.findFirst({ where: { userId } });

    let snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      );
    }

    if (!snapshot) {
      throw new NotFoundException(`Snapshot for ${month}/${year} not found`);
    }

    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const [transactions, periodAdjustments] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { snapshotId: snapshot.id },
      }),
      this.prisma.payrollPeriodAdjustment && !(snapshot as any).isSandbox
        ? this.prisma.payrollPeriodAdjustment.findMany({
            where: { snapshotId: snapshot.id },
            orderBy: { id: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const extraIncome = sumExtraIncome(transactions);

    return this.computePayrollForSnapshot({
      config,
      snapshot,
      month,
      totalWorkingDays: snapshot.totalWorkingDays,
      extraIncome,
      customAdjustments: periodAdjustments,
    });
  }

  async listHorizonPayrolls(
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
    const [config, snapshots] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId, OR: periodOr },
        include: { transactions: true },
      }),
    ]);

    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const snapIds = snapshots.map((s) => s.id);
    const periodAdjustmentsAll =
      snapIds.length > 0 && this.prisma.payrollPeriodAdjustment
        ? await this.prisma.payrollPeriodAdjustment.findMany({
            where: { userId, snapshotId: { in: snapIds } },
            orderBy: { id: 'asc' },
          })
        : [];
    const adjBySnapId = new Map<number, any[]>();
    for (const adj of periodAdjustmentsAll) {
      const list = adjBySnapId.get(adj.snapshotId) ?? [];
      list.push(adj);
      adjBySnapId.set(adj.snapshotId, list);
    }

    const studioCfg = resolveStudioConfig(
      userId,
      config.formulaParamsJson,
      config,
    );
    const pcCfg = studioCfg.paycycleFormulaConfig;
    const holidays = mergeStudioHolidayMap(pcCfg.holidayDatesIso);
    const attWindow = {
      startDay: pcCfg.attendanceCutoffStartDay,
      endDay: pcCfg.attendanceCutoffEndDay,
    };
    const snapMap = new Map(snapshots.map((s) => [`${s.year}-${s.month}`, s]));
    const items = periods.map(({ month, year }) => {
      const snap = snapMap.get(`${year}-${month}`);
      const payroll = this.computePayrollForSnapshot({
        config,
        snapshot: snap,
        month,
        totalWorkingDays:
          snap?.totalWorkingDays ??
          calculateWorkingDaysForConsumptionPeriod(month, year, holidays, attWindow),
        extraIncome: snap ? sumExtraIncome(snap.transactions) : 0,
        customAdjustments: snap ? adjBySnapId.get(snap.id) ?? [] : [],
      });
      return { month, year, payroll };
    });

    return { startMonth: sMonth, startYear: sYear, count: safeCount, periods: items };
  }

  async getPacing(
    month: number,
    year: number,
    referenceDate?: Date,
    weekendMultiplier?: number,
    userId: number = 1,
  ): Promise<EnrichedPacingResult> {
    const config = await this.prisma.globalConfig.findFirst({ where: { userId } });

    let snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    if (!snapshot) {
      snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      );
    }

    if (!snapshot) {
      throw new NotFoundException(`Snapshot for ${month}/${year} not found`);
    }

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;
    const defaultPayoutDay = pcCfg.paydayAnchorDay ?? config?.payrollPayoutDay ?? 27;

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;

    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: nextMonth, year: nextYear } },
    });

    const curPeriodKey = `${String(month).padStart(2, '0')}/${year}`;
    const nextPeriodKey = `${String(nextMonth).padStart(2, '0')}/${nextYear}`;
    const curOverride = pcCfg.periodOverrides?.[curPeriodKey];
    const nextOverride = pcCfg.periodOverrides?.[nextPeriodKey];
    const isCurConfirmed =
      Boolean(snapshot.isPayoutDateConfirmed) ||
      (year === 2026 && month >= 11) ||
      (year === 2027 && month === 1);
    const isNextConfirmed =
      Boolean(nextSnapshot?.isPayoutDateConfirmed) ||
      (nextYear === 2026 && nextMonth >= 11) ||
      (nextYear === 2027 && nextMonth === 1);

    const explicitStartIso =
      curOverride?.paydayDateIso ||
      (isCurConfirmed && snapshot.payrollPayoutDate
        ? new Date(snapshot.payrollPayoutDate).toISOString().slice(0, 10)
        : undefined);
    const explicitNextPaydayIso =
      nextOverride?.paydayDateIso ||
      (isNextConfirmed && nextSnapshot?.payrollPayoutDate
        ? new Date(nextSnapshot.payrollPayoutDate).toISOString().slice(0, 10)
        : undefined);

    const resolvedHorizon = computePaycycleHorizonTs({
      month,
      year,
      anchorDay: defaultPayoutDay,
      payslipAnchorDay: pcCfg.payslipAnchorDay,
      payslipShiftRule: pcCfg.payslipShiftRule,
      reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
      holidaysIso: pcCfg.holidayDatesIso,
      explicitPayslipIso: curOverride?.payslipDateIso,
      shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
      explicitStartIso,
      explicitNextPaydayIso,
      weekendMultiplier: pcCfg.weekendWeightMultiplier,
      remainingBudgetRp: 0,
    });

    const cycleStartDate = new Date(`${resolvedHorizon.paydayIso}T00:00:00.000Z`);
    const nextPayDate = new Date(`${resolvedHorizon.nextPaydayIso}T00:00:00.000Z`);
    const cycleEndDate = new Date(nextPayDate.getTime() - 86400000);
    const isEndDateConfirmed = Boolean(explicitNextPaydayIso);

    const transactions = await this.prisma.transaction.findMany({
      where: { snapshotId: snapshot.id },
    });

    const fixedTargets = {
      transport: snapshot.transport,
      internet: snapshot.internet,
      vape: snapshot.vape,
      haircut: snapshot.haircut,
    };

    const fixedEssentialsRealization = calculateFixedEssentialsRealization(
      transactions,
      fixedTargets,
    );
    const operationalRefundsTotal = sumOperationalRefunds(transactions);
    const totalDailySpent = calculateOperationalDailySpent(
      transactions,
      fixedTargets,
    );

    const actualDailyOperational =
      snapshot.actualDailyOperational ?? snapshot.dailyOperational;

    const pacing = calculateDailyPacing({
      periodMonth: month,
      periodYear: year,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      actualDailyOperational,
      dailyOperationalTarget: snapshot.dailyOperational,
      totalDailySpent,
      referenceDate,
      weekendMultiplier,
    });

    return {
      ...pacing,
      fixedEssentialsRealization,
      operationalRefundsTotal,
    };
  }

  /**
   * Read-only simulation of Cash Balance Reconciliation ("Cash Opname").
   * Never creates or modifies database rows.
   */
  async previewCashReconciliation(params: {
    month: number;
    year: number;
    actualRealBalance: number;
    surplusResolutionMode?: SurplusResolutionMode;
    referenceDate?: Date;
    includesUnspentRoutinePool?: boolean;
    userId?: number;
  }): Promise<CashReconciliationPreview & { snapshotStatus: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED' }> {
    const {
      month,
      year,
      actualRealBalance,
      surplusResolutionMode,
      referenceDate,
      includesUnspentRoutinePool,
      userId = 1,
    } = params;

    const config = await this.prisma.globalConfig.findFirst({ where: { userId } });
    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });

    const defaultPayoutDay = config.payrollPayoutDay ?? 25;
    const cycleStartDate =
      snapshot?.payrollPayoutDate ??
      new Date(Date.UTC(year, month - 1, defaultPayoutDay));

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: nextMonth, year: nextYear } },
    });

    const startNorm = normalizeDate(cycleStartDate);
    const startTs = Date.UTC(startNorm.year, startNorm.month - 1, startNorm.day);

    let nextPayoutDate: Date;
    let isEndDateConfirmed = false;

    if (
      nextSnapshot &&
      nextSnapshot.isPayoutDateConfirmed &&
      nextSnapshot.payrollPayoutDate
    ) {
      const nextNorm = normalizeDate(nextSnapshot.payrollPayoutDate);
      const candidateTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
      if (candidateTs > startTs) {
        nextPayoutDate = nextSnapshot.payrollPayoutDate;
        isEndDateConfirmed = true;
      } else {
        nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
      }
    } else {
      nextPayoutDate = new Date(Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay));
    }

    const nextNorm = normalizeDate(nextPayoutDate);
    let nextTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
    if (nextTs <= startTs) {
      nextTs = startTs + 30 * 86400000;
    }
    const cycleEndDate = new Date(nextTs - 86400000);

    const transactions = snapshot
      ? await this.prisma.transaction.findMany({
          where: { snapshotId: snapshot.id },
        })
      : [];

    const preview = calculateCashReconciliation({
      periodMonth: month,
      periodYear: year,
      actualRealBalance,
      surplusResolutionMode,
      includesUnspentRoutinePool,
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot?.salaryAdjustment ?? 0,
      totalWorkingDays: snapshot?.totalWorkingDays ?? 21,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot?.cafeteriaDeduction ?? 0,
      thrAmount: snapshot?.thrAmount ?? 0,
      bonusAmount: snapshot?.bonusAmount ?? 0,
      laptopAllowance: config.laptopAllowance,
      savingsTarget: snapshot?.savings ?? config.baseSavings,
      selfRewardTarget: snapshot?.selfRewardTarget ?? 0,
      dailyOperationalTarget:
        snapshot?.dailyOperational ?? config.dailyOperational,
      transportTarget: snapshot?.transport ?? config.transport,
      internetTarget: snapshot?.internet ?? config.internet,
      vapeTarget: snapshot?.vape ?? config.vape,
      haircutTarget: snapshot?.haircut ?? config.haircut,
      bufferPocketTarget: snapshot?.bufferPocket ?? 0,
      actualDailyOperational: snapshot?.actualDailyOperational,
      isManualOverride: snapshot?.isManualOverride ?? false,
      bridgeInflowAmount: snapshot?.bridgeInflowAmount ?? 0,
      actualSavings: snapshot?.actualSavings,
      selfReward: snapshot?.selfReward,
      deficitUncovered: snapshot?.deficitUncovered,
      netSalaryIncomeOverride: snapshot?.netSalaryIncome,
      transactions,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      referenceDate,
    });

    return {
      ...preview,
      snapshotStatus: snapshot
        ? (snapshot.status as 'DRAFT' | 'LOCKED')
        : 'UNINITIALIZED',
    };
  }

  /**
   * Cross-period Global Ledger Search (`Ctrl+K`).
   * Strictly read-only: searches across all historical and active snapshots.
   */
  async searchTransactions(params: {
    q?: string;
    type?: string;
    sourceType?: string;
    fixedEssentialCategory?: string;
    limit?: number;
    userId?: number;
  }) {
    const q = (params.q ?? '').trim();
    const limit = Math.min(Math.max(1, params.limit ?? 50), 200);
    const qLower = q.toLowerCase();
    const numericCandidate = Number(q.replace(/[^0-9]/g, ''));
    const hasNumericQuery =
      q.replace(/[^0-9]/g, '').length >= 3 && !Number.isNaN(numericCandidate);

    const userId = params.userId || 1;
    const allRows = await this.prisma.transaction.findMany({
      where: {
        snapshot: {
          userId,
        },
      },
      include: {
        snapshot: {
          select: {
            id: true,
            month: true,
            year: true,
            status: true,
          },
        },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    const filtered = allRows.filter((row) => {
      if (params.type && row.type !== params.type) {
        return false;
      }
      if (params.sourceType && row.sourceType !== params.sourceType) {
        return false;
      }
      if (
        params.fixedEssentialCategory &&
        row.fixedEssentialCategory !== params.fixedEssentialCategory
      ) {
        return false;
      }
      if (!q) {
        return true;
      }

      const labelMatch = row.label.toLowerCase().includes(qLower);
      const sourceMatch = row.sourceType.toLowerCase().includes(qLower);
      const typeMatch = row.type.toLowerCase().includes(qLower);
      const fixedMatch = (row.fixedEssentialCategory ?? '')
        .toLowerCase()
        .includes(qLower);
      const periodMatch = `${row.snapshot.month}/${row.snapshot.year}`.includes(
        qLower,
      );
      const amountMatch =
        hasNumericQuery &&
        (Math.round(row.amount) === numericCandidate ||
          String(Math.round(row.amount)).includes(q.replace(/[^0-9]/g, '')));

      return (
        labelMatch ||
        sourceMatch ||
        typeMatch ||
        fixedMatch ||
        periodMatch ||
        amountMatch
      );
    });

    const totalDeductionsMatched = filtered
      .filter((r) => r.type === TransactionType.DEDUCTION || r.type === TransactionType.CREDIT_BILL)
      .reduce((s, r) => s + r.amount, 0);
    const totalIncomeMatched = filtered
      .filter((r) => r.type === TransactionType.INCOME)
      .reduce((s, r) => s + r.amount, 0);

    return {
      query: q,
      totalMatches: filtered.length,
      totalDeductionsMatched,
      totalIncomeMatched,
      items: filtered.slice(0, limit).map((r) => ({
        id: r.id,
        snapshotId: r.snapshotId,
        month: r.snapshot.month,
        year: r.snapshot.year,
        snapshotStatus: r.snapshot.status,
        type: r.type,
        sourceType: r.sourceType,
        fixedEssentialCategory: r.fixedEssentialCategory,
        label: r.label,
        amount: r.amount,
        date: r.date.toISOString(),
      })),
    };
  }

  async simulateCutoffForUser(
    dto: {
      title?: string;
      instrument: 'SPAYLATER' | 'CREDIT_CARD' | 'SPINJAM' | 'PERSONAL_DEBT' | 'CASH';
      amountMode?: 'PRINCIPAL_SPLIT' | 'FIXED_MONTHLY';
      principalAmount: number;
      monthlyAmount?: number;
      tenorMonths?: number;
      purchaseDate?: string;
      dueDayOverride?: number;
      holdPastCutoff?: boolean;
      startMonthOverride?: number;
      startYearOverride?: number;
      cutoffFormula?: string;
      cutoffBoundaryInclusive?: boolean;
      preCutoffOffsetMonths?: number;
      postCutoffOffsetMonths?: number;
      dueShiftRule?: string;
      anchorDay?: number;
    },
    userId: number = 1,
  ): Promise<WithEngineMeta<CutoffSimulateResult>> {
    const cfgRow = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const studioConfig = resolveStudioConfig(userId, cfgRow?.formulaParamsJson, cfgRow);
    const targetInstType =
      dto.instrument === 'SPAYLATER'
        ? 'PAYLATER'
        : dto.instrument === 'SPINJAM' || dto.instrument === 'PERSONAL_DEBT'
          ? 'CASH_LOAN'
          : dto.instrument;
    const matchedInst = studioConfig.instrumentsTable.find(
      (r) => r.active && r.type.toUpperCase() === targetInstType,
    );

    const modularCutoffParams = {
      cutoffFormula: dto.cutoffFormula ?? matchedInst?.cutoffFormula,
      cutoffBoundaryInclusive:
        typeof dto.cutoffBoundaryInclusive === 'boolean'
          ? dto.cutoffBoundaryInclusive
          : matchedInst?.cutoffBoundaryInclusive,
      preCutoffOffsetMonths:
        typeof dto.preCutoffOffsetMonths === 'number'
          ? dto.preCutoffOffsetMonths
          : matchedInst?.preCutoffOffsetMonths,
      postCutoffOffsetMonths:
        typeof dto.postCutoffOffsetMonths === 'number'
          ? dto.postCutoffOffsetMonths
          : matchedInst?.postCutoffOffsetMonths,
      dueShiftRule: dto.dueShiftRule ?? matchedInst?.dueShiftRule,
      dueDayOverride: dto.dueDayOverride ?? (matchedInst?.dueDay && matchedInst.dueDay > 0 ? matchedInst.dueDay : undefined),
      anchorDay: dto.anchorDay ?? studioConfig.paycycleFormulaConfig.paydayAnchorDay,
    };

    const initial = await this.goBridge.simulateCutoff({
      title: dto.title,
      instrument: dto.instrument,
      amountMode: dto.amountMode,
      principalAmount: dto.principalAmount,
      monthlyAmount: dto.monthlyAmount,
      tenorMonths: dto.tenorMonths ?? 1,
      purchaseDate: dto.purchaseDate,
      holdPastCutoff: dto.holdPastCutoff,
      startMonthOverride: dto.startMonthOverride,
      startYearOverride: dto.startYearOverride,
      ...modularCutoffParams,
    });

    const startM = initial.startPeriodMonth;
    const startY = initial.startPeriodYear;
    const nextP = addHybridMonths(startM, startY, 1);

    const [startSnap, nextSnap, matrix] = await Promise.all([
      this.snapshotsSelectors.getOrCreateDraftSnapshot(startM, startY, userId),
      this.snapshotsSelectors.getOrCreateDraftSnapshot(nextP.month, nextP.year, userId),
      this.creditSelectors
        ? this.creditSelectors.getLiabilityMatrix(startM, startY, 4, userId)
        : Promise.resolve(null),
    ]);

    const startKey = `${startY}-${startM}`;
    const nextKey = `${nextP.year}-${nextP.month}`;
    const curObl =
      matrix?.totalsPerMonth[startKey] ?? Math.round(startSnap.totalDeductions ?? 0);
    const nextObl =
      matrix?.totalsPerMonth[nextKey] ?? Math.round(nextSnap.totalDeductions ?? 0);
    const netInc = Math.round(startSnap.finalTotalIncome ?? 0);
    const nextNetInc = Math.round(nextSnap.finalTotalIncome ?? netInc);
    const safeHeadroom = Math.max(
      0,
      Math.round(
        (startSnap.actualSavings ?? 0) +
          (startSnap.selfReward ?? 0) -
          (startSnap.deficitUncovered ?? 0),
      ),
    );

    return this.goBridge.simulateCutoff({
      title: dto.title,
      instrument: dto.instrument,
      amountMode: dto.amountMode,
      principalAmount: dto.principalAmount,
      monthlyAmount: dto.monthlyAmount,
      tenorMonths: dto.tenorMonths ?? 1,
      purchaseDate: dto.purchaseDate,
      holdPastCutoff: dto.holdPastCutoff,
      startMonthOverride: dto.startMonthOverride,
      startYearOverride: dto.startYearOverride,
      ...modularCutoffParams,
      periodNetIncome: netInc,
      currentPeriodObligations: curObl,
      nextPeriodObligations: nextObl,
      nextPeriodNetIncome: nextNetInc,
      safeHeadroom,
    });
  }

  async simulateTimelineForUser(
    dto: {
      month: number;
      year: number;
      spaylaterEarlyPayAmount?: number;
      thrAmountOverride?: number;
      thrDateIso?: string;
      paycheckAmountOverride?: number;
    },
    userId: number = 1,
  ): Promise<WithEngineMeta<TimelineSimulateResult> & {
    baseline: {
      periodLabel: string;
      paycheckAmount: number;
      thrAmount: number;
      paylaterDue: number;
      creditCardDue: number;
      personalDebtDue: number;
      dailyLivingPool: number;
      routineBillsPool: number;
      coreSavingsTarget: number;
    };
  }> {
    const nextP = addHybridMonths(dto.month, dto.year, 1);
    const [config, curSnap, nextSnap, matrix] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.snapshotsSelectors.getOrCreateDraftSnapshot(dto.month, dto.year, userId),
      this.snapshotsSelectors.getOrCreateDraftSnapshot(nextP.month, nextP.year, userId),
      this.creditSelectors
        ? this.creditSelectors.getLiabilityMatrix(dto.month, dto.year, 3, userId)
        : Promise.resolve(null),
    ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;
    const curPeriodKey = `${String(dto.month).padStart(2, '0')}/${dto.year}`;
    const nextPeriodKey = `${String(nextP.month).padStart(2, '0')}/${nextP.year}`;
    const curOverride = pcCfg.periodOverrides?.[curPeriodKey];
    const nextOverride = pcCfg.periodOverrides?.[nextPeriodKey];
    const isCurConfirmed =
      Boolean(curSnap.isPayoutDateConfirmed) ||
      (dto.year === 2026 && dto.month >= 11) ||
      (dto.year === 2027 && dto.month === 1);
    const isNextConfirmed =
      Boolean(nextSnap.isPayoutDateConfirmed) ||
      (nextP.year === 2026 && nextP.month >= 11) ||
      (nextP.year === 2027 && nextP.month === 1);

    const timelineHorizon = computePaycycleHorizonTs({
      month: dto.month,
      year: dto.year,
      anchorDay: pcCfg.paydayAnchorDay ?? 27,
      payslipAnchorDay: pcCfg.payslipAnchorDay,
      payslipShiftRule: pcCfg.payslipShiftRule,
      reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
      holidaysIso: pcCfg.holidayDatesIso,
      explicitPayslipIso: curOverride?.payslipDateIso,
      shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
      explicitStartIso:
        curOverride?.paydayDateIso ||
        (isCurConfirmed && curSnap.payrollPayoutDate
          ? new Date(curSnap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined),
      explicitNextPaydayIso:
        nextOverride?.paydayDateIso ||
        (isNextConfirmed && nextSnap.payrollPayoutDate
          ? new Date(nextSnap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined),
      weekendMultiplier: pcCfg.weekendWeightMultiplier,
      remainingBudgetRp: 0,
    });

    const curKey = `${dto.year}-${dto.month}`;
    const dueYM = { month: dto.month, year: dto.year };
    const payDate = timelineHorizon.paydayIso;
    const nextPayDate = timelineHorizon.nextPaydayIso;

    // Prevent cross-cycle THR double counting between Dec 2026 (which previews Dec 18 THR)
    // and Jan 2027 (whose finalTotalIncome already sums netSalaryIncome + thrAmount).
    const curThrRaw = Math.max(0, Math.round(curSnap.thrAmount ?? 0));
    const paycheckAmount =
      dto.paycheckAmountOverride !== undefined
        ? Math.round(dto.paycheckAmountOverride)
        : curThrRaw > 0
          ? Math.max(0, Math.round((curSnap.finalTotalIncome ?? 0) - curThrRaw))
          : Math.round(curSnap.finalTotalIncome ?? 0);
    const derivedThr =
      dto.thrAmountOverride !== undefined
        ? Math.round(dto.thrAmountOverride)
        : curThrRaw > 0
          ? curThrRaw
          : dto.month === 12
            ? Math.round(nextSnap.thrAmount ?? 0)
            : 0;
    const thrDateIso =
      dto.thrDateIso ||
      (derivedThr > 0
        ? dto.month === 12
          ? `${dto.year}-12-18`
          : `${payDate.slice(0, 4)}-12-18`
        : '');

    const paylaterDue = Math.round(matrix?.payLaterRow.cells[curKey]?.amount ?? 0);
    const creditCardDue = Math.round(matrix?.creditCardRow.cells[curKey]?.amount ?? 0);
    const personalDebtDue = Math.round(
      matrix?.personalDebtRow.cells[curKey]?.amount ?? 0,
    );
    const routineBillsPool = Math.round(
      (curSnap.transport ?? 0) +
        (curSnap.internet ?? 0) +
        (curSnap.vape ?? 0) +
        (curSnap.haircut ?? 0),
    );
    const dailyLivingPool = Math.round(
      curSnap.actualDailyOperational ?? curSnap.dailyOperational ?? 0,
    );
    const coreSavingsTarget = Math.round(curSnap.actualSavings ?? 0);

    const personalDebtItemsRaw = matrix?.personalDebtRow?.cells?.[curKey]?.items ?? [];
    const dueDaysInMonth = new Date(Date.UTC(dueYM.year, dueYM.month, 0)).getUTCDate();
    const personalDebtItems = personalDebtItemsRaw
      .filter((item: any) => Math.round(item.monthlyAmount ?? 0) > 0)
      .map((item: any) => {
        const d = Math.min(Math.max(1, Number(item.dueDay || 8)), dueDaysInMonth);
        return {
          dateIso: `${dueYM.year}-${String(dueYM.month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          label: String(item.title || 'Personal Debt Installment'),
          category: 'LIABILITY' as const,
          amount: -Math.round(item.monthlyAmount ?? 0),
        };
      });

    const sim = await this.goBridge.simulateTimeline({
      periodMonth: dto.month,
      periodYear: dto.year,
      paycheckDateIso: payDate,
      paycheckAmount,
      thrDateIso,
      thrAmount: derivedThr,
      nextPaycheckDateIso: nextPayDate,
      nextPaycheckAmount:
        nextSnap.thrAmount && nextSnap.thrAmount > 0
          ? Math.max(0, Math.round((nextSnap.finalTotalIncome ?? paycheckAmount) - nextSnap.thrAmount))
          : Math.round(nextSnap.finalTotalIncome ?? paycheckAmount),
      totalPaylaterDue: paylaterDue,
      paylaterDueDateIso: `${dueYM.year}-${String(dueYM.month).padStart(2, '0')}-25`,
      totalCreditCardDue: creditCardDue,
      creditCardDueDateIso: `${dueYM.year}-${String(dueYM.month).padStart(2, '0')}-11`,
      totalPersonalDebtDue: personalDebtDue,
      personalDebtDueDateIso: `${dueYM.year}-${String(dueYM.month).padStart(2, '0')}-08`,
      personalDebtItems,
      dailyLivingPool,
      routineBillsPool,
      coreSavingsTarget,
      spaylaterEarlyPayAmount: Math.round(dto.spaylaterEarlyPayAmount ?? 0),
    });

    return {
      ...sim,
      baseline: {
        periodLabel: formatHybridPeriodLabel(dto.month, dto.year),
        paycheckAmount,
        thrAmount: derivedThr,
        paylaterDue,
        creditCardDue,
        personalDebtDue,
        dailyLivingPool,
        routineBillsPool,
        coreSavingsTarget,
      },
    };
  }

  async getCashRadarProjection(
    month: number,
    year: number,
    userId: number = 1,
    referenceDate?: Date,
  ): Promise<WithEngineMeta<CashRadarResult>> {
    const nextP = addHybridMonths(month, year, 1);
    const [config, curSnap, nextSnap, matrix] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, userId),
      this.snapshotsSelectors.getOrCreateDraftSnapshot(nextP.month, nextP.year, userId),
      this.creditSelectors
        ? this.creditSelectors.getLiabilityMatrix(month, year, 3, userId)
        : Promise.resolve(null),
    ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;
    const curPeriodKey = `${String(month).padStart(2, '0')}/${year}`;
    const nextPeriodKey = `${String(nextP.month).padStart(2, '0')}/${nextP.year}`;
    const curOverride = pcCfg.periodOverrides?.[curPeriodKey];
    const nextOverride = pcCfg.periodOverrides?.[nextPeriodKey];
    const isCurConfirmed =
      Boolean(curSnap.isPayoutDateConfirmed) ||
      (year === 2026 && month >= 11) ||
      (year === 2027 && month === 1);
    const isNextConfirmed =
      Boolean(nextSnap.isPayoutDateConfirmed) ||
      (nextP.year === 2026 && nextP.month >= 11) ||
      (nextP.year === 2027 && nextP.month === 1);

    const radarHorizon = computePaycycleHorizonTs({
      month,
      year,
      anchorDay: pcCfg.paydayAnchorDay ?? 27,
      payslipAnchorDay: pcCfg.payslipAnchorDay,
      payslipShiftRule: pcCfg.payslipShiftRule,
      reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
      holidaysIso: pcCfg.holidayDatesIso,
      explicitPayslipIso: curOverride?.payslipDateIso,
      shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
      explicitStartIso:
        curOverride?.paydayDateIso ||
        (isCurConfirmed && curSnap.payrollPayoutDate
          ? new Date(curSnap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined),
      explicitNextPaydayIso:
        nextOverride?.paydayDateIso ||
        (isNextConfirmed && nextSnap.payrollPayoutDate
          ? new Date(nextSnap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined),
      weekendMultiplier: pcCfg.weekendWeightMultiplier,
      remainingBudgetRp: 0,
    });

    const curKey = `${year}-${month}`;
    const curThrRaw = Math.max(0, Math.round(curSnap.thrAmount ?? 0));
    const paycheckAmountRp =
      curThrRaw > 0
        ? Math.max(0, Math.round((curSnap.finalTotalIncome ?? 0) - curThrRaw))
        : Math.round(curSnap.finalTotalIncome ?? 0);
    const holidays = new Set<string>(pcCfg.holidayDatesIso ?? []);
    let thrDateIso = '';
    if (curThrRaw > 0) {
      if (month === 12) {
        const decThr = resolvePreviousBusinessDayIsoTs(year, 12, 18, holidays).earlyIso;
        thrDateIso =
          decThr >= radarHorizon.livingStartIso && decThr <= radarHorizon.livingEndIso
            ? decThr
            : radarHorizon.paydayIso;
      } else {
        thrDateIso = radarHorizon.paydayIso;
      }
    }

    const paylaterDueRp = Math.round(matrix?.payLaterRow.cells[curKey]?.amount ?? 0);
    const creditCardDueRp = Math.round(matrix?.creditCardRow.cells[curKey]?.amount ?? 0);
    const routineBillsPoolRp = Math.round(
      (curSnap.transport ?? 0) +
        (curSnap.internet ?? 0) +
        (curSnap.vape ?? 0) +
        (curSnap.haircut ?? 0),
    );
    const dailyLivingPoolRp = Math.round(
      curSnap.actualDailyOperational ?? curSnap.dailyOperational ?? 0,
    );
    const coreSavingsTargetRp = Math.round(curSnap.actualSavings ?? 0);

    const personalDebtItemsRaw = matrix?.personalDebtRow?.cells?.[curKey]?.items ?? [];
    const dueDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const personalDebtItems = personalDebtItemsRaw
      .filter((item: any) => Math.round(item.monthlyAmount ?? 0) > 0)
      .map((item: any) => {
        const d = Math.min(Math.max(1, Number(item.dueDay || 8)), dueDaysInMonth);
        const tenor = Math.max(1, Number(item.tenorMonths ?? 1));
        const idx = Math.max(1, Number(item.installmentIndex ?? 1));
        return {
          dateIso: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          title: String(item.title || 'Personal Debt Installment'),
          category: String(item.category || 'PERSONAL_DEBT'),
          amountRp: Math.round(item.monthlyAmount ?? 0),
          dueDay: d,
          sliceLabel: tenor > 1 ? `${idx}/${tenor}` : '',
          isFinalSlice: tenor > 1 && idx === tenor,
        };
      });

    const paylaterBreakdown = (matrix?.payLaterRow?.cells?.[curKey]?.items ?? [])
      .filter((item: any) => Math.round(item?.monthlyAmount ?? 0) > 0)
      .map((item: any) => {
        const tenor = Math.max(1, Number(item.tenorMonths ?? 1));
        const idx = Math.max(1, Number(item.installmentIndex ?? 1));
        return {
          title: String(item.title || 'SPayLater Item'),
          amountRp: Math.round(item.monthlyAmount ?? 0),
          sliceLabel: tenor > 1 ? `${idx}/${tenor}` : '1/1',
        };
      });

    const creditCardBreakdown = (matrix?.creditCardRow?.cells?.[curKey]?.items ?? [])
      .filter((item: any) => Math.round(item?.monthlyAmount ?? 0) > 0)
      .map((item: any) => {
        const tenor = Math.max(1, Number(item.tenorMonths ?? 1));
        const idx = Math.max(1, Number(item.installmentIndex ?? 1));
        return {
          title: String(item.title || 'Credit Card Charge'),
          amountRp: Math.round(item.monthlyAmount ?? 0),
          sliceLabel: tenor > 1 ? `${idx}/${tenor}` : '1/1',
        };
      });

    const rawTxs: any[] = Array.isArray((curSnap as any).transactions)
      ? (curSnap as any).transactions
      : await this.prisma.transaction.findMany({
          where: { snapshotId: curSnap.id },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        });

    const loggedTransactions = rawTxs
      .filter((tx: any) => {
        const tType = String(tx?.type ?? '').toUpperCase();
        const sType = String(tx?.sourceType ?? '').toUpperCase();
        if (tType === 'CREDIT_BILL') return false;
        if (sType === 'BULK_BILL' || sType === 'CREDIT_CARD' || sType === 'CC_TRANSACTION' || sType === 'PERSONAL_DEBT') {
          return false;
        }
        return Math.round(Number(tx?.amount) || 0) > 0;
      })
      .map((tx: any) => {
        const rawIso = tx?.date ? new Date(tx.date).toISOString().slice(0, 10) : radarHorizon.livingStartIso;
        const createdIso = tx?.createdAt ? new Date(tx.createdAt).toISOString().slice(0, 10) : rawIso;
        let resolvedIso = rawIso;
        if (resolvedIso < radarHorizon.livingStartIso) {
          if (createdIso >= radarHorizon.livingStartIso && createdIso <= radarHorizon.livingEndIso) {
            resolvedIso = createdIso;
          } else {
            resolvedIso = radarHorizon.livingStartIso;
          }
        }
        const tType = String(tx?.type ?? 'DEDUCTION').toUpperCase();
        const sType = String(tx?.sourceType ?? 'MANUAL').toUpperCase();
        const fixedCat = String(tx?.fixedEssentialCategory ?? '').trim();
        const insideAllocatedPool =
          tType === 'DEDUCTION' && (Boolean(fixedCat) || dailyLivingPoolRp > 0);
        return {
          id: Number(tx?.id ?? 0),
          dateIso: resolvedIso,
          label: String(tx?.label || 'Transaction'),
          type: tType,
          sourceType: sType,
          amountRp: Math.round(Number(tx?.amount) || 0),
          insideAllocatedPool,
        };
      });

    const refIso = referenceDate
      ? normalizeDate(referenceDate)
      : normalizeDate(new Date());
    const refIsoStr = `${refIso.year}-${String(refIso.month).padStart(2, '0')}-${String(refIso.day).padStart(2, '0')}`;

    return this.goBridge.buildCashRadar({
      periodMonth: month,
      periodYear: year,
      paydayDateIso: radarHorizon.paydayIso,
      livingEndDateIso: radarHorizon.livingEndIso,
      nextPaydayIso: radarHorizon.nextPaydayIso,
      paycheckAmountRp,
      thrDateIso,
      thrAmountRp: curThrRaw,
      dailyLivingPoolRp,
      routineBillsPoolRp,
      coreSavingsTargetRp,
      paylaterDueRp,
      creditCardDueRp,
      personalDebtItems,
      loggedTransactions,
      paylaterBreakdown,
      creditCardBreakdown,
      holidaysIso: pcCfg.holidayDatesIso ?? [],
      referenceDateIso: refIsoStr,
    });
  }

  async getContractsBurndown(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<{
    horizon: WithEngineMeta<ExecutiveHorizonResult>;
    plans: any[];
    contractRows: any[];
    totalMonthlyCommitmentRp: number;
    debtFreedomLabel: string;
  }> {
    const matrix = this.creditSelectors
      ? await this.creditSelectors.getLiabilityMatrix(7, 2026, 24, userId)
      : null;

    const snapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const periodInputs = snapshots.map((s) => ({
      month: s.month,
      year: s.year,
      periodLabel: formatHybridPeriodLabel(s.month, s.year),
      finalTotalIncome: Math.round(s.finalTotalIncome ?? 0),
      totalDebt: Math.round(
        matrix?.totalsPerMonth[`${s.year}-${s.month}`] ?? s.totalDeductions ?? 0,
      ),
      fixedEssentials: Math.round(
        (s.transport ?? 0) + (s.internet ?? 0) + (s.vape ?? 0) + (s.haircut ?? 0),
      ),
      actualDailyOperational: Math.round(s.actualDailyOperational ?? 0),
      bufferPocket: Math.round(s.bufferPocket ?? 0),
      actualSavings: Math.round(s.actualSavings ?? 0),
      selfReward: Math.round(s.selfReward ?? 0),
      deficitUncovered: Math.round(s.deficitUncovered ?? 0),
      daysInCycle: 30,
    }));

    const plans = matrix?.activeInstallmentPlans ?? [];
    const contractInputs = plans.map((p) => {
      const remainingSlices =
        p.monthlyInstallment > 0
          ? Math.max(1, Math.round(p.remainingPrincipal / p.monthlyInstallment))
          : 1;
      return {
        id: p.id,
        title: p.title,
        category: p.category,
        merchantOrPlatform: p.merchantOrPlatform,
        monthlyInstallment: Math.round(p.monthlyInstallment),
        principalAmount: Math.round(p.principalAmount),
        remainingPrincipal: Math.round(p.remainingPrincipal),
        remainingSlices,
        totalTenor: p.totalTenor,
        payoffMonth: p.payoffMonth,
        payoffYear: p.payoffYear,
        payoffDateLabel: p.payoffDateLabel,
      };
    });

    const horizon = await this.goBridge.buildExecutiveHorizon({
      selectedMonth: month,
      selectedYear: year,
      periods: periodInputs,
      contracts: contractInputs,
    });

    const totalMonthlyCommitmentRp = plans.reduce(
      (sum, p) => sum + Math.round(p.monthlyInstallment),
      0,
    );
    let latestPlan = plans[0];
    for (const p of plans) {
      if (
        !latestPlan ||
        p.payoffYear > latestPlan.payoffYear ||
        (p.payoffYear === latestPlan.payoffYear &&
          p.payoffMonth > latestPlan.payoffMonth)
      ) {
        latestPlan = p;
      }
    }

    return {
      horizon,
      plans,
      contractRows: matrix?.contractRows ?? [],
      totalMonthlyCommitmentRp,
      debtFreedomLabel: latestPlan?.payoffDateLabel ?? 'Debt Free',
    };
  }

  async getWalletGuardStatus(
    month: number,
    year: number,
    userId: number = 1,
    overrideActualWalletBalance?: number,
    overrideReservedBillsTotal?: number,
  ): Promise<{
    pacing: EnrichedPacingResult;
    settlementSummary: {
      totalDue: number;
      paidAmount: number;
      reservedAmount: number;
      unpaidAmount: number;
      bankHoldNeeded: number;
    };
    savedCheckin: {
      actualWalletBalance: number;
      reservedBillsTotal: number;
      freeSpendableCash: number;
      guardStatus: 'OPTIMAL' | 'WATCH' | 'SURVIVAL_GUARD';
      checkedInAt: string;
      note: string | null;
    } | null;
    guard: WithEngineMeta<WalletGuardResult> | null;
  }> {
    const [pacing, matrix, config] = await Promise.all([
      this.getPacing(month, year, undefined, undefined, userId),
      this.creditSelectors
        ? this.creditSelectors.getLiabilityMatrix(month, year, 1, userId)
        : Promise.resolve(null),
      this.prisma.globalConfig.findFirst({ where: { userId } }),
    ]);

    const key = `${year}-${month}`;
    const settlementSummary = matrix?.settlementSummaryPerMonth?.[key] ?? {
      totalDue: 0,
      paidAmount: 0,
      reservedAmount: 0,
      unpaidAmount: 0,
      bankHoldNeeded: 0,
    };

    const policyContainer = (config?.financialPolicyJson as any) ?? {};
    const saved = policyContainer?.walletCheckins?.[key] ?? null;

    const targetBalance =
      overrideActualWalletBalance !== undefined
        ? overrideActualWalletBalance
        : saved?.actualWalletBalance;
    const targetReserved =
      overrideReservedBillsTotal !== undefined
        ? overrideReservedBillsTotal
        : settlementSummary.bankHoldNeeded;

    let guard: WithEngineMeta<WalletGuardResult> | null = null;
    if (targetBalance !== undefined && targetBalance !== null) {
      guard = await this.goBridge.evaluateWalletGuard({
        remainingLivingCash: Math.round(pacing.remainingBudget),
        actualWalletBalance: Math.round(targetBalance),
        reservedBillsTotal: Math.round(targetReserved),
        daysRemaining: pacing.daysRemaining,
        remainingWeekdays: pacing.remainingWeekdays,
        remainingWeekendDays: pacing.remainingWeekendDays,
        weekendMultiplier: pacing.weekendMultiplier,
        isWeekendToday: pacing.isWeekendToday,
      });
    }

    return {
      pacing,
      settlementSummary,
      savedCheckin: saved,
      guard,
    };
  }

  async getIntelligenceBundle(
    month: number,
    year: number,
    userId: number = 1,
    extraLumpSumRp: number = 0,
  ) {
    const nextYm = addHybridMonths(month, year, 1);
    const [config, activeSnap, nextSnap, allSnaps, txs, matrix, cardTxs, pacing, manualSavingsTxs] =
      await Promise.all([
        this.prisma.globalConfig.findFirst({ where: { userId } }),
        this.snapshotsSelectors.getOrCreateDraftSnapshot(month, year, userId),
        this.snapshotsSelectors.getOrCreateDraftSnapshot(nextYm.month, nextYm.year, userId),
        this.prisma.monthlySnapshot.findMany({
          where: { userId },
          orderBy: [{ year: 'asc' }, { month: 'asc' }],
        }),
        this.listTransactions(month, year, userId),
        this.creditSelectors
          ? this.creditSelectors.getLiabilityMatrix(month, year, 12, userId)
          : Promise.resolve(null),
        this.prisma.creditCardTransaction.findMany({ where: { userId } }),
        this.getPacing(month, year, undefined, undefined, userId),
        this.prisma.savingsManualTransaction.findMany({ where: { userId } }),
      ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;

    const epochYm =
      (pcCfg.ledgerEpochYear ?? 2026) * 12 + (pcCfg.ledgerEpochMonth ?? 10);
    const scopedAllSnaps = allSnaps.filter(
      (s: any) => s.year * 12 + s.month >= epochYm,
    );
    const horizonPeriodsSource =
      scopedAllSnaps.length > 0 ? scopedAllSnaps : [activeSnap];

    // Upcoming periods starting from selected month/year
    const selectedYmVal = year * 12 + month;
    const upcomingSnaps = horizonPeriodsSource.filter(
      (s: any) => s.year * 12 + s.month >= selectedYmVal,
    );
    const upcomingList = upcomingSnaps.length > 0 ? upcomingSnaps : [activeSnap];

    const upcomingPeriodsForNw = upcomingList.slice(0, 12).map((s: any, idx: number) => {
      const k = `${s.year}-${s.month}`;
      const pl = Math.round(matrix?.payLaterRow?.cells?.[k]?.amount ?? 0);
      const ccCell = matrix?.creditCardRow?.cells?.[k];
      const ccRaw = Math.round(ccCell?.amount ?? 0);
      const ccInstallmentOnly = (ccCell?.items ?? [])
        .filter((i: any) => Boolean(i.sliceBadge))
        .reduce((sum: number, i: any) => sum + Math.round(i.amount ?? 0), 0);
      const cc = idx === 0 ? ccRaw : ccInstallmentOnly;

      const pdItems = matrix?.personalDebtRow?.cells?.[k]?.items ?? [];
      const pdHasItems = Array.isArray(pdItems) && pdItems.length > 0;
      const pdExternal = pdHasItems
        ? pdItems
            .filter((i: any) => i.category !== 'P1_VAULT_REFUND')
            .reduce((sum: number, i: any) => sum + Math.round(i.monthlyAmount ?? 0), 0)
        : Math.round(matrix?.personalDebtRow?.cells?.[k]?.amount ?? 0);

      const totalDebt = matrix ? pl + cc + pdExternal : Math.round(s.totalDeductions ?? pl + cc + pdExternal);
      return {
        month: s.month,
        year: s.year,
        label: formatHybridPeriodLabel(s.month, s.year),
        projectedSavingsP1Rp: Math.round(s.actualSavings ?? pcCfg.p1TargetFloorRp),
        projectedSurplusP2Rp: Math.round(s.selfReward ?? 0),
        totalDebtDueRp: totalDebt,
        payLaterDueRp: pl,
        creditCardDueRp: cc,
        personalDebtDueRp: pdExternal,
      };
    });

    const forecastPeriods = upcomingList.slice(0, 12).map((s: any) => {
      const k = `${s.year}-${s.month}`;
      const pd = Math.round(matrix?.personalDebtRow?.cells?.[k]?.amount ?? 0);
      const totalDebt =
        matrix?.totalsPerMonth?.[k] !== undefined
          ? Math.round(matrix.totalsPerMonth[k])
          : Math.round(s.totalDeductions ?? 0);
      const inc = Math.round(s.finalTotalIncome ?? 0);
      return {
        month: s.month,
        year: s.year,
        label: formatHybridPeriodLabel(s.month, s.year),
        totalIncomeRp: inc,
        totalDebtDueRp: totalDebt,
        personalDebtDueRp: pd,
        dailyLivingRp: Math.round(s.actualDailyOperational ?? pcCfg.defaultDailyFoodBaselineRp),
        routineBillsRp: Math.round(
          (s.transport ?? 0) + (s.internet ?? 0) + (s.vape ?? 0) + (s.haircut ?? 0),
        ),
        coreSavingsP1Rp: Math.round(s.actualSavings ?? 0),
        selfRewardP2Rp: Math.round(s.selfReward ?? 0),
        dsrPercent: inc > 0 ? Math.round((totalDebt / inc) * 1000) / 10 : 0,
      };
    });

    const cashDeductions = txs
      .filter((t: any) => t.type === 'DEDUCTION' && t.sourceType === 'MANUAL' && !t.fixedEssentialCategory)
      .map((t: any) => ({
        id: Number(t.id),
        label: String(t.label ?? 'Expense'),
        category: 'DAILY_LIVING',
        amountRp: Math.round(Number(t.amount ?? 0)),
        dateIso: new Date(t.date).toISOString().slice(0, 10),
      }));

    const postCutoffItems: Array<{
      title: string;
      instrument: string;
      purchaseDay: number;
      amountRp: number;
      nextPeriodLabel?: string;
    }> = [];

    if (matrix?.payLaterRow?.cells?.[`${year}-${month}`]?.items) {
      for (const li of matrix.payLaterRow.cells[`${year}-${month}`].items ?? []) {
        const titleLower = String(li.title || '').toLowerCase();
        if (titleLower.includes('nov 15') || titleLower.includes('nov 16') || titleLower.includes('nov 17') || titleLower.includes('post-cutoff')) {
          postCutoffItems.push({
            title: li.title,
            instrument: 'SPAYLATER',
            purchaseDay: 15,
            amountRp: Math.round(li.monthlyAmount ?? 0),
            nextPeriodLabel: formatHybridPeriodLabel(month, year),
          });
        }
      }
    }

    const recurringCharges = cardTxs
      .filter((c: any) => c.chargeType === 'RECURRING' && c.isActive !== false)
      .map((c: any) => ({
        label: String(c.label ?? 'Subscription'),
        category: String(c.category || 'ai').toLowerCase(),
        amountRp: Math.round(c.monthlyAmount ?? c.amount ?? 0),
      }));

    // Real-life ledger accounts derived directly from actual vault records + wallet check-ins
    // Isolates pre-October 2026 synthetic seed backfill (e.g. 08/2026 Rp 500k) from User #1 live balances.
    const manualP1Total = Math.max(
      0,
      manualSavingsTxs.reduce(
        (sum: number, tx: any) => sum + Math.round(Number(tx.amount ?? 0)),
        0,
      ),
    );
    const hasExplicitP1Override =
      studioConfig.actualP1VaultBalanceRp !== null &&
      studioConfig.actualP1VaultBalanceRp !== undefined &&
      !Number.isNaN(Number(studioConfig.actualP1VaultBalanceRp));
    const closedLockedP1Total = hasExplicitP1Override
      ? Math.max(0, Math.round(Number(studioConfig.actualP1VaultBalanceRp)))
      : userId === 1
        ? manualP1Total
        : horizonPeriodsSource
            .filter(
              (s: any) =>
                s.status === 'LOCKED' &&
                s.year * 12 + s.month <= selectedYmVal &&
                Math.round(s.actualSavings ?? 0) > 0,
            )
            .reduce((sum: number, s: any) => sum + Math.round(s.actualSavings ?? 0), 0);
    const activePeriodP1 =
      activeSnap.status === 'DRAFT' ? Math.max(0, Math.round(activeSnap.actualSavings ?? 0)) : 0;

    const policyContainer = (config?.financialPolicyJson as any) ?? {};
    const savedCheckin = policyContainer?.walletCheckins?.[`${year}-${month}`];
    const activeLiquidCash =
      savedCheckin?.freeSpendableCash !== undefined
        ? Math.max(0, Math.round(Number(savedCheckin.freeSpendableCash) || 0))
        : Math.max(0, Math.round(pacing.remainingBudget ?? 0));

    const ledgerAccounts = [
      ...(closedLockedP1Total > 0
        ? [
            {
              id: 'ledger_closed_p1',
              name: 'Core Savings P1 (Closed Cycles)',
              institution: 'Verified Snapshot Ledger',
              accountType: 'SAVINGS_VAULT',
              balanceRp: closedLockedP1Total,
              annualYieldPct: 0,
              includeInRunway: true,
              isPrimaryPayroll: false,
            },
          ]
        : []),
      ...(activePeriodP1 > 0
        ? [
            {
              id: 'ledger_active_p1',
              name: `Active Cycle Core Savings (${String(month).padStart(2, '0')}/${year})`,
              institution: 'Active Period Waterfall',
              accountType: 'SAVINGS_VAULT',
              balanceRp: activePeriodP1,
              annualYieldPct: 0,
              includeInRunway: true,
              isPrimaryPayroll: false,
            },
          ]
        : []),
      {
        id: 'ledger_liquid_cash',
        name: savedCheckin ? 'Verified Wallet Check-In Cash' : 'Active Living Cash Remaining',
        institution: 'Operational Living Pool',
        accountType: 'CASH_WALLET',
        balanceRp: activeLiquidCash,
        annualYieldPct: 0,
        includeInRunway: true,
        isPrimaryPayroll: true,
      },
    ];

    const effectiveAssetAccounts = studioConfig.enableExternalAssetPortfolio
      ? [...ledgerAccounts, ...studioConfig.assetAccountsTable]
      : ledgerAccounts;

    const p1VaultBalance = effectiveAssetAccounts
      .filter((a) => a.accountType === 'SAVINGS_VAULT')
      .reduce((s, a) => s + Math.round(a.balanceRp || 0), 0);

    const liquidAssetsStart = effectiveAssetAccounts
      .filter((a) => a.includeInRunway || a.accountType !== 'SAVINGS_VAULT')
      .reduce((s, a) => s + Math.round(a.balanceRp || 0), 0);

    // Exclude P1_VAULT_REFUND and already-matured contracts prior to selected (month, year)
    const activePlans = matrix?.activeInstallmentPlans ?? [];
    const optContracts = activePlans
      .filter((p: any) => {
        if (p.category === 'P1_VAULT_REFUND') return false;
        if (Math.round(p.remainingPrincipal ?? 0) <= 0) return false;
        return p.payoffYear * 12 + p.payoffMonth >= selectedYmVal;
      })
      .map((p: any) => {
        const titleLower = String(p.title || '').toLowerCase();
        const inst =
          p.category === 'PERSONAL_DEBT' || titleLower.includes('spinjam')
            ? 'SPINJAM'
            : p.category === 'CREDIT_CARD'
              ? 'CREDIT_CARD'
              : 'SPAYLATER';
        const instRule = studioConfig.instrumentsTable.find((r) =>
          inst === 'SPINJAM' ? r.type === 'CASH_LOAN' : r.type === inst,
        );
        const apr =
          instRule?.monthlyInterestPct ??
          (inst === 'SPINJAM' ? 3.95 : inst === 'CREDIT_CARD' ? 1.75 : 2.95);
        const remSlices = Math.max(
          1,
          p.payoffYear * 12 + p.payoffMonth - selectedYmVal + 1,
        );
        const remPrincipalFromPeriod = Math.round(p.monthlyInstallment * remSlices);
        return {
          id: String(p.id),
          name: String(p.title),
          instrument: inst,
          monthlyInstallmentRp: Math.round(p.monthlyInstallment),
          remainingMonths: remSlices,
          remainingBalanceRp: Math.min(Math.round(p.remainingPrincipal), remPrincipalFromPeriod),
          monthlyInterestPct: apr,
          payoffMonth: p.payoffMonth,
          payoffYear: p.payoffYear,
          payoffLabel: formatHybridPeriodLabel(p.payoffMonth, p.payoffYear),
        };
      });

    const feItems = pacing.fixedEssentialsRealization?.items ?? [];
    const spentByCat = (cat: string) => feItems.find((i) => i.category === cat)?.spent ?? 0;
    const slotSpentMap: Record<string, number> = {
      transport: spentByCat('TRANSPORT'),
      internet: spentByCat('INTERNET'),
      vape: spentByCat('VAPE'),
      haircut: spentByCat('HAIRCUT'),
    };
    const slotTargetMap: Record<string, number> = {
      transport: activeSnap.transport ?? 0,
      internet: activeSnap.internet ?? 0,
      vape: activeSnap.vape ?? 0,
      haircut: activeSnap.haircut ?? 0,
    };

    const envelopeInputs = studioConfig.routineTemplatesTable
      .filter((t) => t.active)
      .map((t) => ({
        id: t.id,
        name: t.name,
        allocatedRp: slotTargetMap[t.slotKey] ?? t.monthlyQuotaRp,
        spentRp: slotSpentMap[t.slotKey] ?? 0,
        rolloverPolicy: t.rolloverPolicy,
      }));

    const curPeriodKey = `${String(month).padStart(2, '0')}/${year}`;
    const nextPeriodKey = `${String(nextYm.month).padStart(2, '0')}/${nextYm.year}`;
    const curOverride = pcCfg.periodOverrides?.[curPeriodKey];
    const nextOverride = pcCfg.periodOverrides?.[nextPeriodKey];
    const isStartSnapConfirmed =
      Boolean(activeSnap.isPayoutDateConfirmed) ||
      (year === 2026 && month >= 11) ||
      (year === 2027 && month === 1);
    const isNextSnapConfirmed =
      Boolean(nextSnap.isPayoutDateConfirmed) ||
      (nextYm.year === 2026 && nextYm.month >= 11) ||
      (nextYm.year === 2027 && nextYm.month === 1);

    const explicitStart =
      curOverride?.paydayDateIso ||
      (isStartSnapConfirmed && activeSnap.payrollPayoutDate
        ? new Date(activeSnap.payrollPayoutDate).toISOString().slice(0, 10)
        : undefined);
    const explicitNext =
      nextOverride?.paydayDateIso ||
      (isNextSnapConfirmed && nextSnap.payrollPayoutDate
        ? new Date(nextSnap.payrollPayoutDate).toISOString().slice(0, 10)
        : undefined);
    const todayIso = new Date().toISOString().slice(0, 10);

    const effectiveRdpuYield = studioConfig.enableExternalAssetPortfolio
      ? pcCfg.rdpuAnnualYieldPct
      : 0;

    const isBespokeOwner = userId === 1;
    const formulaVariables = this.buildFormulaVariablesForSnapshot(
      month,
      year,
      activeSnap,
      config,
      matrix,
      pacing,
      studioConfig,
      userId,
    );

    const batchResult = await this.goBridge.runIntelligenceBatch({
      paycycle: {
        month,
        year,
        anchorDay: pcCfg.paydayAnchorDay,
        payslipAnchorDay: pcCfg.payslipAnchorDay,
        payslipShiftRule: pcCfg.payslipShiftRule,
        reviewLagWorkingDays: pcCfg.reviewLagWorkingDays,
        holidaysIso: pcCfg.holidayDatesIso,
        explicitPayslipIso: curOverride?.payslipDateIso,
        overrideNote: curOverride?.note,
        shiftWeekendToFriday: pcCfg.shiftWeekendToFriday,
        explicitStartIso: explicitStart,
        explicitNextPaydayIso: explicitNext,
        weekendMultiplier: pcCfg.weekendWeightMultiplier,
        remainingBudgetRp: Math.max(0, Math.round(pacing.remainingBudget ?? 0)),
        referenceDateIso: todayIso,
      },
      networth: {
        accounts: effectiveAssetAccounts,
        upcomingPeriods: upcomingPeriodsForNw,
      },
      forecaster: {
        startingLiquidAssetsRp: liquidAssetsStart,
        startingP1VaultRp: p1VaultBalance,
        emergencyFundTargetRp: pcCfg.emergencyFundTargetRp,
        baselineDailyBurnRp: Math.max(30000, Math.round(pacing.baselineDailyRate || 55000)),
        rdpuAnnualYieldPct: effectiveRdpuYield,
        variableShockPercent: pcCfg.variableShockPercent,
        periods: forecastPeriods,
      },
      anomaly: {
        periodLabel: formatHybridPeriodLabel(month, year),
        totalCycleDays: pacing.daysInCycle || 30,
        elapsedDays: Math.max(1, (pacing.daysInCycle || 30) - (pacing.daysRemaining || 0)),
        dailyLivingBudgetRp: Math.round(activeSnap.actualDailyOperational ?? activeSnap.dailyOperational ?? 0),
        dailyLivingSpentRp: Math.round(pacing.totalDailySpent ?? 0),
        baselineDailyRateRp: Math.round(pacing.baselineDailyRate ?? 50000),
        cashTransactions: cashDeductions,
        postCutoffItems,
        recurringCharges,
      },
      envelopes: {
        liquidCashTotalRp: liquidAssetsStart,
        dailyAverageBurnRp: Math.max(40000, Math.round(pacing.baselineDailyRate || 65000)),
        monthlyInflowRp: Math.round(activeSnap.finalTotalIncome ?? 0),
        cycleElapsedDays: Math.max(1, (pacing.daysInCycle || 30) - (pacing.daysRemaining || 0)),
        cycleTotalDays: pacing.daysInCycle || 30,
        envelopes: envelopeInputs,
        sinkingFunds: pcCfg.sinkingFunds,
      },
      debtopt: {
        contracts: optContracts,
        extraLumpSumRp: Math.max(0, Math.round(extraLumpSumRp || 0)),
      },
      lifeenergy: {
        netMonthlyIncomeRp: Math.round(
          activeSnap.netSalaryIncome ?? activeSnap.finalTotalIncome ?? (isBespokeOwner ? 5904000 : 0),
        ),
        workdaysPerMonth: Math.max(1, (pcCfg.workdaysPerWeek || 5) * 4),
        workHoursPerDay: pcCfg.workHoursPerDay || 8,
        dailyCommuteHours: pcCfg.dailyCommuteHours ?? (isBespokeOwner ? 2 : 1),
        monthlyWorkExpenseRp: Math.round(activeSnap.transport ?? (isBespokeOwner ? 300000 : 0)),
        sampleAmountsRp: [
          35000,
          150000,
          350000,
          1000000,
          Math.max(500000, Math.round(activeSnap.totalDeductions ?? 0)),
        ],
      },
      formula: {
        variables: formulaVariables,
        formulas: {
          takeHomeSalary: pcCfg.formulas.takeHomeSalaryFormula,
          proratedThr: pcCfg.formulas.proratedThrFormula,
          waterfallAllocation: pcCfg.formulas.waterfallAllocationFormula,
          debtSafeCeiling: pcCfg.formulas.debtSafeCeilingFormula,
          dailySafeToSpend: pcCfg.formulas.dailySafeToSpendFormula,
          trueHourlyWage: pcCfg.formulas.trueHourlyWageFormula,
          forecasterFreedDebtToP1: pcCfg.formulas.forecasterFreedDebtToP1Formula,
        },
      },
    });
    const engineMeta = { engineSource: batchResult.engineSource };
    const paycycle = { ...batchResult.paycycle, ...engineMeta };
    const networth = { ...batchResult.networth, ...engineMeta };
    const forecaster = { ...batchResult.forecaster, ...engineMeta };
    const anomaly = { ...batchResult.anomaly, ...engineMeta };
    const envelopes = { ...batchResult.envelopes, ...engineMeta };
    const debtopt = { ...batchResult.debtopt, ...engineMeta };
    const lifeenergy = { ...batchResult.lifeenergy, ...engineMeta };
    const formulaEvaluation = { ...batchResult.formula, ...engineMeta };

    const curKeyStr = `${year}-${month}`;
    const spinjamDebtAtPeriod = (matrix?.personalDebtRow?.cells?.[curKeyStr]?.items ?? [])
      .filter((i: any) => i.category !== 'P1_VAULT_REFUND')
      .reduce((s: number, i: any) => s + Math.round(i.monthlyAmount ?? 0), 0);
    const paylaterDebtAtPeriod = Math.round(matrix?.payLaterRow?.cells?.[curKeyStr]?.amount ?? 0);
    const firstPaylaterZero = upcomingPeriodsForNw.find((p) => p.payLaterDueRp === 0);
    const paylaterFreedomLabel = firstPaylaterZero
      ? firstPaylaterZero.label
      : 'Paid Off';

    let dynamicMilestone = {
      code: 'SAVINGS_RESERVE_FOCUS',
      targetDateLabel: 'Savings Reserve Focus',
      remainingAmountRp: 0,
      labelEn: 'Installment-Free · Savings Reserve Focus',
      labelId: 'Bebas Cicilan · Fokus Tabungan Inti',
      labelZh: '无分期负担 · 专注核心储蓄',
    };
    for (const rule of pcCfg.milestonePriorityOrder ?? [
      'SPINJAM_ZERO',
      'PAYLATER_INSTALLMENTS_ZERO',
      'SAVINGS_RESERVE_FOCUS',
    ]) {
      if (rule === 'SPINJAM_ZERO' && spinjamDebtAtPeriod > 0) {
        dynamicMilestone = {
          code: 'SPINJAM_ZERO',
          targetDateLabel:
            debtopt.spinjamFreedomLabel && debtopt.spinjamFreedomLabel !== 'Paid Off'
              ? debtopt.spinjamFreedomLabel
              : forecaster.spinjamFreedomDate,
          remainingAmountRp: spinjamDebtAtPeriod,
          labelEn: 'SPinjam Payoff Target',
          labelId: 'Target Lunas SPinjam',
          labelZh: 'SPinjam 清零目标',
        };
        break;
      }
      if (rule === 'PAYLATER_INSTALLMENTS_ZERO' && paylaterDebtAtPeriod > 0) {
        dynamicMilestone = {
          code: 'PAYLATER_INSTALLMENTS_ZERO',
          targetDateLabel: paylaterFreedomLabel,
          remainingAmountRp: paylaterDebtAtPeriod,
          labelEn: 'PayLater Payoff Target',
          labelId: 'Target Lunas Cicilan PayLater',
          labelZh: 'PayLater 分期清零目标',
        };
        break;
      }
    }

    return {
      month,
      year,
      periodCode: `${String(month).padStart(2, '0')}/${year}`,
      snapshotStatus: activeSnap.status,
      studioConfig,
      effectiveAssetAccounts,
      dynamicMilestone,
      formulaContext: {
        variables: formulaVariables,
        evaluation: formulaEvaluation,
      },
      paycycle,
      networth,
      forecaster,
      anomaly,
      envelopes,
      debtopt,
      lifeenergy,
      scenarioSeed: {
        startingLiquidAssetsRp: liquidAssetsStart,
        startingVaultRp: p1VaultBalance,
        emergencyTargetRp: pcCfg.emergencyFundTargetRp,
        baselineDailyBurnRp: Math.max(30000, Math.round(pacing.baselineDailyRate || 55000)),
        rdpuYieldPct: effectiveRdpuYield,
        variableShockPercent: pcCfg.variableShockPercent,
        periods: forecastPeriods,
        optContracts,
      },
      engineTelemetry: {
        engineSource: batchResult.engineSource,
        computeDurationUs: batchResult.computeDurationUs,
        workerGoroutines: batchResult.workerGoroutines,
      },
    };
  }

  async runStressTestForUser(
    dto: StressTestScenarioDto,
    userId: number = 1,
  ) {
    const def = getPayrollPeriodForDate();
    const month = dto.month ?? def.month;
    const year = dto.year ?? def.year;

    const [bundle, goalsRaw] = await Promise.all([
      this.getIntelligenceBundle(month, year, userId, 0),
      typeof (this.prisma as any)?.savingsGoal?.findMany === 'function'
        ? (this.prisma as any).savingsGoal
            .findMany({ where: { userId }, orderBy: { id: 'asc' } })
            .catch(() => [])
        : Promise.resolve([]),
    ]);

    const seed = (bundle as any).scenarioSeed ?? {};
    const rawPeriods: any[] = seed.periods ?? [];
    const mcPeriods = rawPeriods.map((p: any) => ({
      label: String(p.label || `${month}/${year}`),
      incomeRp: Math.max(0, Math.round(Number(p.totalIncomeRp ?? 0))),
      debtDueRp: Math.max(0, Math.round(Number(p.totalDebtDueRp ?? 0))),
      fixedBillsRp: Math.max(0, Math.round(Number(p.routineBillsRp ?? 0))),
      livingTargetRp: Math.max(0, Math.round(Number(p.dailyLivingRp ?? 0))),
      savingsTargetRp: Math.max(0, Math.round(Number(p.coreSavingsP1Rp ?? 0))),
    }));

    const startingLiquid = Math.max(0, Math.round(Number(seed.startingLiquidAssetsRp ?? 0)));
    const startingSavings = Math.max(0, Math.round(Number(seed.startingVaultRp ?? 0)));
    const emergencyTarget = Math.max(0, Math.round(Number(seed.emergencyTargetRp ?? 15_000_000)));
    const firstPeriod = mcPeriods[0];
    const defaultSurplus = firstPeriod
      ? Math.max(
          0,
          firstPeriod.incomeRp -
            firstPeriod.debtDueRp -
            firstPeriod.fixedBillsRp -
            firstPeriod.livingTargetRp,
        )
      : 0;
    const monthlySurplusRp =
      dto.monthlySurplusOverrideRp !== undefined
        ? Math.max(0, Math.round(dto.monthlySurplusOverrideRp))
        : Math.max(defaultSurplus, Math.round(Number(firstPeriod?.savingsTargetRp ?? 0)));

    const optContracts: any[] = seed.optContracts ?? [];
    const optDebts = optContracts.map((c: any) => ({
      title: String(c.name || 'Debt'),
      remainingRp: Math.max(0, Math.round(Number(c.remainingBalanceRp ?? 0))),
      monthlyInstallmentRp: Math.max(0, Math.round(Number(c.monthlyInstallmentRp ?? 0))),
      monthlyInterestPct: Math.max(0, Number(c.monthlyInterestPct ?? 0)),
      remainingMonths: Math.max(1, Math.round(Number(c.remainingMonths ?? 1))),
    }));

    const optGoals = (Array.isArray(goalsRaw) ? goalsRaw : []).map((g: any) => ({
      title: String(g.title || g.name || 'Goal'),
      targetRp: Math.max(0, Math.round(Number(g.targetAmount ?? 0))),
      allocatedRp: Math.max(0, Math.round(Number(g.currentAllocatedAmount ?? 0))),
    }));

    const [monteCarlo, optimizer] = await Promise.all([
      this.goBridge.runMonteCarlo({
        startingLiquidAssetsRp: startingLiquid,
        startingSavingsRp: startingSavings,
        emergencyFundTargetRp: emergencyTarget,
        incomeVolatilityPct: dto.incomeVolatilityPct ?? 12,
        expenseShockProbPct: dto.expenseShockProbPct ?? 20,
        expenseShockMagnitudePct: dto.expenseShockMagnitudePct ?? 25,
        unexpectedEmergencyProbPct: dto.unexpectedEmergencyProbPct ?? 10,
        unexpectedEmergencyCostRp: dto.unexpectedEmergencyCostRp ?? 1_500_000,
        trials: dto.trials ?? 2000,
        seed: 20261123,
        periods: mcPeriods,
      }),
      this.goBridge.optimizeAllocationFrontier({
        monthlySurplusRp,
        currentSavingsRp: startingSavings,
        emergencyFundTargetRp: emergencyTarget,
        monthlyEssentialsRp: Math.max(
          0,
          Math.round((firstPeriod?.fixedBillsRp ?? 0) + (firstPeriod?.livingTargetRp ?? 0)),
        ),
        debts: optDebts,
        goals: optGoals,
      }),
    ]);

    return {
      period: { month, year },
      monthlySurplusRp,
      monteCarlo,
      optimizer,
    };
  }

  private buildFormulaVariablesForSnapshot(
    month: number,
    year: number,
    snap: any,
    config: any,
    matrix: any,
    pacing: any,
    studioConfig: any,
    userId: number = 1,
  ): Record<string, number> {
    const isBespokeOwner = userId === 1;
    const pcCfg = studioConfig.paycycleFormulaConfig;
    const baseSalary = Math.round(config?.baseSalary ?? (isBespokeOwner ? 5300000 : 0));
    const workDays = Math.round(snap?.totalWorkingDays ?? 21);
    const dailyAllowance = Math.round(config?.dailyAllowance ?? (isBespokeOwner ? 25000 : 0));
    const transportAllowance = Math.round(config?.laptopAllowance ?? (isBespokeOwner ? 250000 : 0));
    const fixedAdditions = Math.round(snap?.salaryAdjustment ?? 0);
    const grossPay = baseSalary + workDays * dailyAllowance + transportAllowance + fixedAdditions;
    const netSalary = Math.round(snap?.netSalaryIncome ?? (isBespokeOwner ? 5904000 : baseSalary));
    const taxAndBpjs = Math.max(0, grossPay - netSalary);
    const tenureMonths =
      pcCfg.thrJoinDateIso
        ? month === 12 || month === 1
          ? 8.83
          : 12
        : 12;
    const thrAmount = Math.round(snap?.thrAmount ?? 0);
    const netIncome = Math.round(snap?.finalTotalIncome ?? netSalary);

    const k = `${year}-${month}`;
    const paylaterDebt = Math.round(matrix?.payLaterRow?.cells?.[k]?.amount ?? 0);
    const ccDebt = Math.round(matrix?.creditCardRow?.cells?.[k]?.amount ?? 0);
    const personalItems = matrix?.personalDebtRow?.cells?.[k]?.items ?? [];
    const spinjamDebt = personalItems
      .filter((i: any) => i.category !== 'P1_VAULT_REFUND')
      .reduce((s: number, i: any) => s + Math.round(i.monthlyAmount ?? 0), 0);
    const otherDebt = personalItems
      .filter((i: any) => i.category === 'P1_VAULT_REFUND')
      .reduce((s: number, i: any) => s + Math.round(i.monthlyAmount ?? 0), 0);
    const totalDebt = Math.round(
      matrix?.totalsPerMonth?.[k] ?? snap?.totalDeductions ?? paylaterDebt + ccDebt + spinjamDebt + otherDebt,
    );

    const routineBills = Math.round(
      (snap?.transport ?? 0) + (snap?.internet ?? 0) + (snap?.vape ?? 0) + (snap?.haircut ?? 0),
    );
    const livingBudget = Math.round(snap?.actualDailyOperational ?? snap?.dailyOperational ?? 0);
    const p1Floor = Math.round(pcCfg.p1TargetFloorRp ?? 1000000);
    const p1Savings = Math.round(snap?.actualSavings ?? 0);
    const p2Reward = Math.round(snap?.selfReward ?? 0);
    const cycleDays = pacing?.daysInCycle || 30;
    const remainingDays = pacing?.daysRemaining ?? cycleDays;
    const elapsedDays = Math.max(0, cycleDays - remainingDays);

    return {
      BASE_SALARY: baseSalary,
      WORK_DAYS: workDays,
      DAILY_ALLOWANCE: dailyAllowance,
      TRANSPORT_ALLOWANCE: transportAllowance,
      FIXED_ADDITIONS: fixedAdditions,
      GROSS_PAY: grossPay,
      TAX_AND_BPJS: taxAndBpjs,
      NET_SALARY: netSalary,
      TENURE_MONTHS: tenureMonths,
      THR_MULTIPLIER:
        month === 12 || month === 1 ? Math.round((tenureMonths / 12) * 1000) / 1000 : 0,
      THR_AMOUNT: thrAmount,
      NET_INCOME: netIncome,
      PAYLATER_DEBT: paylaterDebt,
      CC_DEBT: ccDebt,
      SPINJAM_DEBT: spinjamDebt,
      OTHER_DEBT: otherDebt,
      TOTAL_DEBT: totalDebt,
      ROUTINE_BILLS: routineBills,
      LIVING_BUDGET: livingBudget,
      P1_FLOOR: p1Floor,
      P1_SAVINGS: p1Savings,
      P2_REWARD: p2Reward,
      ELAPSED_DAYS: elapsedDays,
      CYCLE_DAYS: cycleDays,
      REMAINING_DAYS: remainingDays,
      WEEKEND_WEIGHT: pcCfg.weekendWeightMultiplier ?? 1.5,
      WORK_DAYS_PER_WEEK: pcCfg.workdaysPerWeek ?? 5,
      WORK_HOURS_PER_DAY: pcCfg.workHoursPerDay ?? 8,
      COMMUTE_HOURS_PER_DAY: pcCfg.dailyCommuteHours ?? 2,
      OPTIMAL_DSR_PCT:
        pcCfg.optimalDebtRatioPercent ??
        (config?.financialPolicyJson as any)?.optimalDebtRatioPercent ??
        20,
      MAX_SAFE_DSR_PCT:
        pcCfg.maxSafeDebtRatioPercent ??
        (config?.financialPolicyJson as any)?.maxSafeDebtRatioPercent ??
        35,
    };
  }

  async evaluateFormulaSuiteForUser(
    month: number,
    year: number,
    formulas: Record<string, string>,
    overrideVariables?: Record<string, number>,
    userId: number = 1,
  ) {
    const bundle = await this.getIntelligenceBundle(month, year, userId);
    const vars = {
      ...(bundle.formulaContext?.variables ?? {}),
      ...(overrideVariables ?? {}),
    };
    const evaluation = await this.goBridge.evaluateFormulaSuite({
      variables: vars,
      formulas,
    });
    return { variables: vars, evaluation };
  }

  async parseStatementForUser(
    dto: { rawText: string; defaultMethod?: string; defaultYear?: number },
    userId: number = 1,
  ) {
    const def = getPayrollPeriodForDate();
    const [config, existingTxs, lineItems, allSnaps] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.listTransactions(def.month, def.year, userId),
      this.prisma.liabilityLineItem.findMany({
        where: { userId },
        take: 100,
        orderBy: { id: 'desc' },
      }),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        select: { month: true, year: true, status: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ]);

    const lockedPeriodCodes: string[] = [];
    let latestLockedIdx = -1;
    let latestLockedMonth = def.month;
    let latestLockedYear = def.year;
    for (const s of allSnaps) {
      const code = `${String(s.month).padStart(2, '0')}/${s.year}`;
      if (s.status === 'LOCKED') {
        lockedPeriodCodes.push(code);
        const idx = s.year * 12 + s.month;
        if (idx > latestLockedIdx) {
          latestLockedIdx = idx;
          latestLockedMonth = s.month;
          latestLockedYear = s.year;
        }
      }
    }
    let earliestOpenMonth = def.month;
    let earliestOpenYear = def.year;
    let foundOpen = false;
    for (const s of allSnaps) {
      const idx = s.year * 12 + s.month;
      if (s.status !== 'LOCKED' && (latestLockedIdx < 0 || idx > latestLockedIdx)) {
        earliestOpenMonth = s.month;
        earliestOpenYear = s.year;
        foundOpen = true;
        break;
      }
    }
    if (!foundOpen && latestLockedIdx >= 0) {
      const nextOpen = addHybridMonths(latestLockedMonth, latestLockedYear, 1);
      earliestOpenMonth = nextOpen.month;
      earliestOpenYear = nextOpen.year;
    }

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const existingItems = [
      ...existingTxs.map((t: any) => ({
        id: Number(t.id),
        label: String(t.label ?? ''),
        amountRp: Math.round(Number(t.amount ?? 0)),
        dateIso: new Date(t.date).toISOString().slice(0, 10),
        instrument: 'CASH',
      })),
      ...lineItems.map((li: any) => ({
        id: li.id,
        label: li.title,
        amountRp: Math.round(li.monthlyAmount),
        dateIso: li.createdAt ? new Date(li.createdAt).toISOString().slice(0, 10) : '',
        instrument: li.category === 'PAYLATER' ? 'PAYLATER' : 'PERSONAL_DEBT',
      })),
    ];

    return this.goBridge.parseStatementBatch({
      rawText: dto.rawText,
      defaultMethod: dto.defaultMethod || 'CASH',
      anchorDay: studioConfig.paycycleFormulaConfig.paydayAnchorDay,
      cutoffRules: studioConfig.instrumentsTable.map((i) => ({
        id: i.id,
        name: i.name,
        type: i.type,
        cutoffDay: i.cutoffDay,
        cutoffFormula: i.cutoffFormula,
        cutoffBoundaryInclusive: i.cutoffBoundaryInclusive,
        preCutoffOffsetMonths: i.preCutoffOffsetMonths,
        postCutoffOffsetMonths: i.postCutoffOffsetMonths,
        dueDay: i.dueDay,
        dueRule: i.dueRule,
        dueShiftRule: i.dueShiftRule,
        monthlyInterestPct: i.monthlyInterestPct,
        adminFeePct: i.adminFeePct,
        active: i.active,
      })),
      existingItems,
      defaultYear: dto.defaultYear ?? def.year,
      lockedPeriodCodes,
      earliestOpenMonth,
      earliestOpenYear,
    });
  }

  async simulateScenarioForUser(
    dto: SimulateScenarioDto,
    userId: number = 1,
  ) {
    const def = getPayrollPeriodForDate();
    const month = dto.month ?? def.month;
    const year = dto.year ?? def.year;
    const extraMonthlySavingsRp = Math.round(dto.extraMonthlySavingsRp ?? 0);
    const oneTimeBonusRp = Math.max(0, Math.round(dto.oneTimeBonusRp ?? 0));
    const monthlyLivingDeltaRp = Math.round(dto.monthlyLivingDeltaRp ?? 0);
    const extraDebtPrepaymentRp = Math.max(
      0,
      Math.round(dto.extraDebtPrepaymentRp ?? 0),
    );

    const bundle: any = await this.getIntelligenceBundle(
      month,
      year,
      userId,
      extraDebtPrepaymentRp,
    );

    const seed = bundle.scenarioSeed ?? {};
    const periods = bundle._forecastInputPeriods ?? seed.periods ?? [];
    const startingLiquid = Math.round(
      bundle._startingLiquidAssetsRp ?? seed.startingLiquidAssetsRp ?? 0,
    );
    const startingVault = Math.round(
      bundle._startingVaultRp ?? seed.startingVaultRp ?? 0,
    );
    const emergencyTarget = Math.round(
      bundle._emergencyTargetRp ?? seed.emergencyTargetRp ?? 15_000_000,
    );
    const dailyBurn = Math.max(
      30000,
      Math.round(bundle._baselineDailyBurnRp ?? seed.baselineDailyBurnRp ?? 55000),
    );
    const rdpuYield = Number(bundle._rdpuYieldPct ?? seed.rdpuYieldPct ?? 0);
    const shockPct =
      dto.variableShockPercent !== undefined
        ? dto.variableShockPercent
        : Number(seed.variableShockPercent ?? 15);
    const optContracts = bundle._optContracts ?? seed.optContracts ?? [];

    const simPeriods = periods.map((p: any, idx: number) => {
      const bonusHere = idx === 0 ? oneTimeBonusRp : 0;
      const adjLiving = Math.max(
        0,
        Math.round((p.dailyLivingRp || 0) + monthlyLivingDeltaRp),
      );
      const debtPayHere = idx === 0 ? extraDebtPrepaymentRp : 0;
      const adjDebt = Math.max(0, Math.round((p.totalDebtDueRp || 0) - debtPayHere));
      const adjPersonalDebt = Math.max(
        0,
        Math.round((p.personalDebtDueRp || 0) - debtPayHere),
      );
      const savingsBoost = Math.round(extraMonthlySavingsRp - monthlyLivingDeltaRp);
      const adjSavings = Math.max(
        0,
        Math.round((p.coreSavingsP1Rp || 0) + savingsBoost),
      );
      const adjIncome = Math.max(0, Math.round((p.totalIncomeRp || 0) + bonusHere));
      return {
        ...p,
        totalIncomeRp: adjIncome,
        dailyLivingRp: adjLiving,
        totalDebtDueRp: adjDebt,
        personalDebtDueRp: adjPersonalDebt,
        coreSavingsP1Rp: adjSavings,
        dsrPercent:
          adjIncome > 0 ? Math.round((adjDebt / adjIncome) * 1000) / 10 : 0,
      };
    });

    const baseLiving0 = Math.max(1, periods[0]?.dailyLivingRp ?? 1_500_000);
    const burnMultiplier = Math.max(
      0.2,
      (baseLiving0 + monthlyLivingDeltaRp) / baseLiving0,
    );
    const simDailyBurn = Math.max(
      30000,
      Math.round(dailyBurn * burnMultiplier),
    );

    const [baselineForecast, simulatedForecast, debtStrategies] = await Promise.all([
      this.goBridge.runForecast({
        startingLiquidAssetsRp: startingLiquid,
        startingP1VaultRp: startingVault,
        emergencyFundTargetRp: emergencyTarget,
        baselineDailyBurnRp: dailyBurn,
        rdpuAnnualYieldPct: rdpuYield,
        variableShockPercent: shockPct,
        periods,
      }),
      this.goBridge.runForecast({
        startingLiquidAssetsRp: startingLiquid + oneTimeBonusRp,
        startingP1VaultRp: startingVault + Math.round(oneTimeBonusRp * 0.5),
        emergencyFundTargetRp: emergencyTarget,
        baselineDailyBurnRp: simDailyBurn,
        rdpuAnnualYieldPct: rdpuYield,
        variableShockPercent: shockPct,
        periods: simPeriods,
      }),
      this.goBridge.optimizeDebtPayoff({
        contracts: optContracts,
        extraLumpSumRp: Math.max(0, extraDebtPrepaymentRp + oneTimeBonusRp),
      }),
    ]);

    const series = (baselineForecast.series ?? []).map((bp: any, i: number) => {
      const sp = simulatedForecast.series?.[i] ?? bp;
      return {
        month: bp.month,
        year: bp.year,
        label: bp.label,
        baselineWealthRp: bp.baselineWealthRp,
        simulatedWealthRp: sp.baselineWealthRp,
        disciplinedWealthRp: sp.disciplinedWealthRp,
        shockWealthRp: sp.shockWealthRp,
        baselineDsrPercent: bp.dsrPercent,
        simulatedDsrPercent: sp.dsrPercent,
        remainingPersonalDebtRp: sp.remainingPersonalDebtRp,
      };
    });

    return {
      period: { month, year },
      inputs: {
        extraMonthlySavingsRp,
        oneTimeBonusRp,
        monthlyLivingDeltaRp,
        extraDebtPrepaymentRp,
        variableShockPercent: shockPct,
      },
      baseline: {
        projected6MWealthRp: baselineForecast.projected6MWealthBaselineRp,
        projected12MWealthRp: baselineForecast.projected12MWealthBaselineRp,
        freedomDate: baselineForecast.spinjamFreedomDate,
        lowDsrDate: baselineForecast.lowDsrMilestoneDate,
        emergencyCompletionDate: baselineForecast.emergencyFundCompletionDate,
        runwayDays: baselineForecast.pureSurvivalRunwayDays,
      },
      simulated: {
        projected6MWealthRp: simulatedForecast.projected6MWealthBaselineRp,
        projected12MWealthRp: simulatedForecast.projected12MWealthBaselineRp,
        freedomDate: simulatedForecast.spinjamFreedomDate,
        lowDsrDate: simulatedForecast.lowDsrMilestoneDate,
        emergencyCompletionDate: simulatedForecast.emergencyFundCompletionDate,
        runwayDays: simulatedForecast.pureSurvivalRunwayDays,
      },
      net12MDeltaRp:
        simulatedForecast.projected12MWealthBaselineRp -
        baselineForecast.projected12MWealthBaselineRp,
      runwayDeltaDays:
        simulatedForecast.pureSurvivalRunwayDays -
        baselineForecast.pureSurvivalRunwayDays,
      series,
      debtStrategies: debtStrategies?.strategies ?? [],
    };
  }

  /**
   * Read-only consolidated boot payload for native mobile clients (Android, Huawei, iOS).
   * Calls existing authoritative selectors strictly without duplicating calculation formulas.
   */
  async getMobileBoot(
    userId: number = 1,
    requestedMonth?: number,
    requestedYear?: number,
  ) {
    const resolvedDefault = await this.snapshotsSelectors.getDefaultActivePeriod(userId);
    const month =
      requestedMonth && requestedMonth >= 1 && requestedMonth <= 12
        ? requestedMonth
        : resolvedDefault.month;
    const year =
      requestedYear && requestedYear >= 2020 ? requestedYear : resolvedDefault.year;

    const [
      userRow,
      config,
      snapshotRow,
      pacing,
      walletGuard,
      cashRadar,
      lineItems,
      biometricDevicesCount,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          accountName: true,
          username: true,
          email: true,
          fullName: true,
          role: true,
          status: true,
          blueprintType: true,
          lifeStagePreset: true,
          uiDensityMode: true,
          securityPinHash: true,
          ipWhitelistEnforced: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId, month, year } },
      }),
      this.getPacing(month, year, undefined, undefined, userId),
      this.getWalletGuardStatus(month, year, userId),
      this.getCashRadarProjection(month, year, userId),
      this.creditSelectors
        ? this.creditSelectors.listLineItems(month, year, undefined, userId)
        : Promise.resolve([]),
      typeof (this.prisma as any)?.mobileDevice?.count === 'function'
        ? (this.prisma as any).mobileDevice.count({
            where: { userId, biometricEnabled: true, revokedAt: null },
          })
        : Promise.resolve(0),
    ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const routineBillsTotal = Math.round(
      (snapshotRow?.transport ?? config?.transport ?? 0) +
        (snapshotRow?.internet ?? config?.internet ?? 0) +
        (snapshotRow?.vape ?? config?.vape ?? 0) +
        (snapshotRow?.haircut ?? config?.haircut ?? 0),
    );

    const priorityTierMap = new Map(
      (studioConfig.priorityTiers ?? []).map((t) => [t.key, t]),
    );
    const coreSavingsLabel =
      priorityTierMap.get('SAVINGS')?.label || 'Core Savings Reserve';
    const flexibleSurplusLabel =
      priorityTierMap.get('DISCRETIONARY')?.label || 'Flexible Surplus';

    const billsList = Array.isArray(lineItems) ? lineItems : [];
    const unpaidItems = billsList.filter((item: any) => !item.isSettled);
    const paidItems = billsList.filter((item: any) => Boolean(item.isSettled));

    return {
      period: {
        month,
        year,
        status: snapshotRow?.status ?? 'DRAFT',
        strategy: resolvedDefault.strategy,
        skippedLockedPeriod: resolvedDefault.skippedLockedPeriod,
      },
      user: userRow
        ? {
            id: userRow.id,
            accountName: userRow.accountName,
            username: userRow.username,
            email: userRow.email,
            fullName: userRow.fullName,
            role: userRow.role,
            status: userRow.status,
            blueprintType: userRow.blueprintType,
            lifeStagePreset: userRow.lifeStagePreset,
            uiDensityMode: userRow.uiDensityMode,
            ipWhitelistEnforced: userRow.ipWhitelistEnforced,
          }
        : null,
      pacing,
      allocationSummary: {
        finalTotalIncome: Math.round(snapshotRow?.finalTotalIncome ?? 0),
        totalDeductions: Math.round(snapshotRow?.totalDeductions ?? 0),
        routineBillsTotal,
        dailyLivingTarget: Math.round(
          snapshotRow?.dailyOperational ?? config?.dailyOperational ?? 0,
        ),
        dailyLivingFunded: Math.round(snapshotRow?.actualDailyOperational ?? 0),
        coreSavingsTarget: Math.round(
          snapshotRow?.savings ?? config?.baseSavings ?? 0,
        ),
        coreSavingsActual: Math.round(snapshotRow?.actualSavings ?? 0),
        flexibleSurplusTarget: Math.round(snapshotRow?.selfRewardTarget ?? 0),
        flexibleSurplusActual: Math.round(snapshotRow?.selfReward ?? 0),
        deficitUncovered: Math.round(snapshotRow?.deficitUncovered ?? 0),
        tiers: [
          {
            key: 'SAVINGS',
            label: coreSavingsLabel,
            targetRp: Math.round(snapshotRow?.savings ?? config?.baseSavings ?? 0),
            actualRp: Math.round(snapshotRow?.actualSavings ?? 0),
            enabled: priorityTierMap.get('SAVINGS')?.enabled ?? true,
          },
          {
            key: 'DISCRETIONARY',
            label: flexibleSurplusLabel,
            targetRp: Math.round(snapshotRow?.selfRewardTarget ?? 0),
            actualRp: Math.round(snapshotRow?.selfReward ?? 0),
            enabled: priorityTierMap.get('DISCRETIONARY')?.enabled ?? true,
          },
        ],
      },
      walletGuard,
      bills: {
        totalCount: billsList.length,
        unpaidCount: unpaidItems.length,
        settledCount: paidItems.length,
        items: billsList.slice(0, 40),
      },
      cashRadarSummary: {
        lowestCashPointRp: cashRadar?.lowestCashPoint?.balanceRp ?? 0,
        lowestCashDateIso: cashRadar?.lowestCashPoint?.dateIso ?? null,
        lowestCashLabel: cashRadar?.lowestCashPoint?.contextLabel ?? null,
        isTightOrDeficit: Boolean(cashRadar?.lowestCashPoint?.isTightOrDeficit),
        endingCashBufferRp: cashRadar?.endingCashBufferRp ?? 0,
        eventCount: Array.isArray(cashRadar?.events) ? cashRadar.events.length : 0,
        upcomingEvents: Array.isArray(cashRadar?.events)
          ? cashRadar.events.slice(0, 12)
          : [],
      },
      displayPreferences: {
        defaultLanguage: studioConfig.displayPreferences?.defaultLanguage ?? 'en',
        numberFormat: studioConfig.displayPreferences?.numberFormat ?? 'id-ID',
        maskBalancesByDefault:
          studioConfig.privacyPreferences?.maskBalancesByDefault ?? false,
        weekendWeightMultiplier:
          studioConfig.paycycleFormulaConfig?.weekendWeightMultiplier ?? 1.5,
      },
      mobileCapabilities: {
        hasSecurityPin: Boolean(userRow?.securityPinHash),
        biometricDevicesCount: Number(biometricDevicesCount ?? 0),
        ssoProviders: listConfiguredSsoProviders(),
        offlineCacheTtlSeconds: 300,
        apiContractVersion: '2026-11-v1',
        serverTimeIso: new Date().toISOString(),
      },
    };
  }
}
