import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditSelectors } from '../audit/audit.selectors';
import { AuditService } from '../audit/audit.service';
import { CreditSelectors } from '../credit/credit.selectors';
import {
  SnapshotStatus,
  TransactionType,
  TransactionSourceType,
  CreditCardStatus,
} from '@prisma/client';
import {
  calculatePayroll,
  sumExtraIncome,
  calculateDecemberProratedThr,
  getWorkingDaysCutoffWindow,
  calculateWorkingDaysForPeriod,
} from '../calculator/payroll';
import {
  calculateFixedEssentialsRealization,
  calculateOperationalDailySpent,
  calculateTotalDeductions,
  calculateWaterfall,
  sumOperationalRefunds,
} from '../calculator/waterfall';
import {
  calculateLiquidityForecast,
  ExecutiveLiquidityForecastReport,
} from '../calculator/forecasting';
import {
  calculateDailyPacing,
  normalizeDate,
} from '../calculator/pacing';
import { calculateDisciplineScore } from '../calculator/discipline';
import {
  ExecutiveReportPayload,
  ReportScope,
  buildAllocationDiffRows,
  buildRoutineBillsRealizationRows,
  buildMoneyDriversAndSpikes,
  buildComparativeStatement,
  buildAmortizationSchedule,
  formatReportPeriodLabel,
  formatRevisionCategoryLabel,
  formatGovernanceActionLabel,
  formatGovernanceCategoryLabel,
  DossierRevisionItem,
  DossierPeriodAuditItem,
  DossierGovernanceLogItem,
  ItemizedReportCreditCardCharge,
  ItemizedReportDailyExpense,
  AmortizationSliceDetail,
  AmortizationSubscriptionDetail,
} from '../calculator/reports';
import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
} from '../credit/credit.utils';
import { extractPeriodTagFromLabel } from '../savings/savings.utils';

@Injectable()
export class ReportsSelectors {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditSelectors: AuditSelectors,
    private readonly auditService: AuditService,
    private readonly creditSelectors: CreditSelectors,
  ) {}

  /**
   * Read-only Executive Report generator for `/reports`.
   * Strictly read-only: NEVER creates or mutates a MonthlySnapshot row.
   */
  async getExecutiveReport(
    month: number,
    year: number,
    scope: ReportScope = 'all',
    userId: number = 1,
  ): Promise<ExecutiveReportPayload> {
    const [
      config,
      selectedSnapshot,
      allNonPhantomSnapshots,
      savingsTransactions,
      liabilityMatrix,
      recentLogs,
      bulkBillsForSelected,
      activeCards,
      activeContracts,
      fullAuditReport,
    ] = await Promise.all([
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })),
      this.prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId, month, year } },
        include: {
          transactions: { orderBy: { date: 'asc' } },
          budgetRevisions: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.auditSelectors.listHistoricalSnapshots(),
      this.prisma.savingsManualTransaction.findMany({
        where: { userId },
        orderBy: { date: 'asc' },
      }),
      this.creditSelectors.getLiabilityMatrix(month, year, userId),
      this.prisma.auditLog.findMany({
        where: {
          action: {
            in: [
              'BUDGET_TARGET_REVISED',
              'CREDIT_LIMIT_EXCEEDED',
              'CASH_RECONCILIATION',
              'CLOSE_PERIOD',
              'SAVINGS_TOPUP',
              'SETTLE_CC_INSTALLMENT_EARLY',
              'REBALANCE_SAVINGS_INSTRUMENT',
              'RESTORE_DATABASE_BACKUP',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      this.prisma.monthlyBulkBill.findMany({
        where: { userId, month, year },
      }),
      this.prisma.creditCardTransaction.findMany({
        where: {
          userId,
          status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.creditContract.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      }),
      this.auditService.getFullReport(),
    ]);

    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    const cardsById = new Map(activeCards.map((c) => [c.id, c]));

    // Map realized Vault deposits by period "(M/YYYY)" (amount > 0 represents a deposit)
    const vaultDepositsByPeriod = new Map<string, number>();
    const vaultLiquidDepositsByPeriod = new Map<string, number>();
    const vaultRdpuDepositsByPeriod = new Map<string, number>();
    for (const stx of savingsTransactions) {
      if (stx.amount <= 0) continue;
      const tag = extractPeriodTagFromLabel(stx.label);
      if (!tag) continue;
      const key = `${tag.month}/${tag.year}`;
      vaultDepositsByPeriod.set(
        key,
        (vaultDepositsByPeriod.get(key) ?? 0) + stx.amount,
      );
      if (stx.instrumentType === 'INVESTMENT_RDPU') {
        vaultRdpuDepositsByPeriod.set(
          key,
          (vaultRdpuDepositsByPeriod.get(key) ?? 0) + stx.amount,
        );
      } else {
        vaultLiquidDepositsByPeriod.set(
          key,
          (vaultLiquidDepositsByPeriod.get(key) ?? 0) + stx.amount,
        );
      }
    }

    const vaultTotalBalance = savingsTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const vaultLiquidCashBalance = savingsTransactions
      .filter((t) => (t.instrumentType ?? 'LIQUID_CASH') === 'LIQUID_CASH')
      .reduce((sum, t) => sum + t.amount, 0);
    const vaultInvestmentRdpuBalance = savingsTransactions
      .filter((t) => t.instrumentType === 'INVESTMENT_RDPU')
      .reduce((sum, t) => sum + t.amount, 0);

    const computePeriodAuditStats = (m: number, y: number) => {
      const periodFlags = fullAuditReport.flags.filter(
        (f) => f.month === m && f.year === y,
      );
      const greenCount = periodFlags.filter((f) => f.type === 'GREEN').length;
      const redCount = periodFlags.filter((f) => f.type === 'RED').length;
      const score = calculateDisciplineScore(greenCount, greenCount + redCount);
      return {
        disciplineScore: score,
        greenCount,
        redCount,
        flags: periodFlags,
      };
    };

    // ---------------------------------------------------------
    // 1. Build MonthlyClosingStatement for (month, year)
    // ---------------------------------------------------------
    const status: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED' = selectedSnapshot
      ? selectedSnapshot.status === SnapshotStatus.LOCKED
        ? 'LOCKED'
        : 'DRAFT'
      : 'UNINITIALIZED';

    const isStandardMode = config.profileMode === 'STANDARD_GENERAL';
    const cutoffWindow = getWorkingDaysCutoffWindow(month, year);
    const workingDaysWindowLabel = isStandardMode
      ? `Standard Monthly Cycle (${cutoffWindow.workingDays} working days)`
      : cutoffWindow.windowLabel;

    const routineCategoryLabels: Record<string, string> = isStandardMode
      ? {
          DAILY_OPERATIONAL: 'Daily Living Budget',
          TRANSPORT: 'Transport & Fuel',
          INTERNET: 'Internet & Utilities',
          VAPE: 'Subscriptions & Lifestyle',
          HAIRCUT: 'Personal Care & Health',
        }
      : {
          DAILY_OPERATIONAL: 'Daily Living & Food Budget',
          TRANSPORT: 'Transport & Fuel',
          INTERNET: 'Internet & Data Package',
          VAPE: 'Vape Supplies',
          HAIRCUT: 'Haircut & Grooming',
        };

    const transactions = selectedSnapshot?.transactions ?? [];
    const extraIncome = sumExtraIncome(transactions);
    const defaultThr =
      month === 12
        ? calculateDecemberProratedThr(
            config.baseSalary + (selectedSnapshot?.salaryAdjustment ?? 0),
          )
        : 0;

    const resolvedWorkingDays = selectedSnapshot
      ? selectedSnapshot.totalWorkingDays > 0
        ? selectedSnapshot.totalWorkingDays
        : calculateWorkingDaysForPeriod(month, year)
      : calculateWorkingDaysForPeriod(month, year);

    const payroll = calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: selectedSnapshot?.salaryAdjustment ?? 0,
      totalWorkingDays: resolvedWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: selectedSnapshot?.cafeteriaDeduction ?? 0,
      thrAmount: selectedSnapshot ? selectedSnapshot.thrAmount : defaultThr,
      bonusAmount: selectedSnapshot?.bonusAmount ?? 0,
      extraIncome,
      laptopAllowance: config.laptopAllowance,
    });

    const incomeTransactions = transactions
      .filter(
        (t) =>
          t.type === TransactionType.INCOME &&
          t.sourceType !== TransactionSourceType.OPERATIONAL_REFUND,
      )
      .map((t) => ({
        id: t.id,
        label: t.label,
        amount: t.amount,
        date: t.date.toISOString(),
      }));

    // Liabilities breakdown for selected period
    let paylaterBills = 0;
    let creditCardBills = 0;
    let personalDebtBills = 0;
    let contractInstallments = 0;
    let manualDeductions = 0;

    if (selectedSnapshot) {
      paylaterBills = transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.BULK_BILL,
        )
        .reduce((s, t) => s + t.amount, 0);
      creditCardBills = transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CC_TRANSACTION,
        )
        .reduce((s, t) => s + t.amount, 0);
      personalDebtBills = transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.PERSONAL_DEBT,
        )
        .reduce((s, t) => s + t.amount, 0);
      contractInstallments = transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CONTRACT,
        )
        .reduce((s, t) => s + t.amount, 0);
      manualDeductions = transactions
        .filter((t) => t.type === TransactionType.DEDUCTION)
        .reduce((s, t) => s + t.amount, 0);
    } else {
      paylaterBills = bulkBillsForSelected.reduce(
        (s, b) => s + (b.paylaterAmount ?? 0),
        0,
      );
      personalDebtBills = bulkBillsForSelected.reduce(
        (s, b) => s + (b.personalDebtAmount ?? 0),
        0,
      );
      creditCardBills = Math.round(
        activeCards.reduce(
          (s, c) => s + calculateCardDueAmountForMonth(c, month, year),
          0,
        ),
      );
      const colIdx = year * 12 + (month - 1);
      for (const c of activeContracts) {
        const startIdx = c.startYear * 12 + (c.startMonth - 1);
        const endIdx = startIdx + c.totalTenor - 1;
        if (colIdx >= startIdx && colIdx <= endIdx) {
          contractInstallments += c.monthlyInstallment;
        }
      }
    }

    const currentTargets = {
      dailyOperational:
        selectedSnapshot?.dailyOperational ?? config.dailyOperational,
      transport: selectedSnapshot?.transport ?? config.transport,
      internet: selectedSnapshot?.internet ?? config.internet,
      vape: selectedSnapshot?.vape ?? config.vape,
      haircut: selectedSnapshot?.haircut ?? config.haircut,
      bufferPocket: selectedSnapshot?.bufferPocket ?? 0,
      savings: selectedSnapshot?.savings ?? config.baseSavings,
      selfRewardTarget: selectedSnapshot?.selfRewardTarget ?? 0,
    };

    const fixedTargets = {
      transport: currentTargets.transport,
      internet: currentTargets.internet,
      vape: currentTargets.vape,
      haircut: currentTargets.haircut,
    };

    if (selectedSnapshot) {
      manualDeductions = calculateOperationalDailySpent(
        transactions,
        fixedTargets,
      );
    }

    const totalCreditBills =
      paylaterBills +
      creditCardBills +
      personalDebtBills +
      contractInstallments;
    const totalDeductions = selectedSnapshot
      ? calculateTotalDeductions(
          transactions,
          fixedTargets,
          currentTargets.dailyOperational,
        )
      : totalCreditBills +
        Math.max(0, manualDeductions - currentTargets.dailyOperational);

    const fixedEssentialsRevised =
      currentTargets.transport +
      currentTargets.internet +
      currentTargets.vape +
      currentTargets.haircut;

    const waterfall = calculateWaterfall({
      finalTotalIncome: payroll.finalTotalIncome,
      totalDeductions,
      savingsTarget: currentTargets.savings,
      selfRewardTarget: currentTargets.selfRewardTarget,
      dailyOperationalTarget: currentTargets.dailyOperational,
      fixedExpenses: fixedEssentialsRevised,
      bufferPocket: currentTargets.bufferPocket,
    });

    const allocationDiffRows = buildAllocationDiffRows({
      globalDefaults: {
        dailyOperational: config.dailyOperational,
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
        bufferPocket: 0,
        savings: config.baseSavings,
        selfRewardTarget: 0,
      },
      currentTargets,
      actuals: {
        actualDailyOperational: waterfall.actualDailyOperational,
        actualSavings: waterfall.actualSavings,
        actualSelfReward: waterfall.actualSelfReward,
        isDeficit: waterfall.isDeficit,
      },
      revisions: (selectedSnapshot?.budgetRevisions ?? []).map((r) => ({
        category: r.category ?? 'CUSTOM_BUCKET',
        previousValue: r.previousValue,
        newValue: r.newValue,
        createdAt: r.createdAt,
      })),
      customLabels: routineCategoryLabels,
    });

    const fixedEssentialsBaseline = allocationDiffRows
      .filter((r) => r.tier === 'UPFRONT_FIXED')
      .reduce((s, r) => s + r.baselineTarget, 0);
    const fixedEssentialsActual = allocationDiffRows
      .filter((r) => r.tier === 'UPFRONT_FIXED')
      .reduce((s, r) => s + r.actualOutcome, 0);

    const dailyOpRow = allocationDiffRows.find(
      (r) => r.categoryKey === 'DAILY_OPERATIONAL',
    )!;
    const bufferRow = allocationDiffRows.find(
      (r) => r.categoryKey === 'BUFFER',
    )!;
    const savingsRow = allocationDiffRows.find(
      (r) => r.categoryKey === 'SAVINGS',
    )!;
    const rewardRow = allocationDiffRows.find(
      (r) => r.categoryKey === 'SELF_REWARD',
    )!;

    // Pacing for selected period
    const defaultPayoutDay = config.payrollPayoutDay ?? 25;
    const cycleStartDate =
      selectedSnapshot?.payrollPayoutDate ??
      new Date(Date.UTC(year, month - 1, defaultPayoutDay));
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: 1, month: nextMonth, year: nextYear } },
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
      const candidateTs = Date.UTC(
        nextNorm.year,
        nextNorm.month - 1,
        nextNorm.day,
      );
      if (candidateTs > startTs) {
        nextPayoutDate = nextSnapshot.payrollPayoutDate;
        isEndDateConfirmed = true;
      } else {
        nextPayoutDate = new Date(
          Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay),
        );
      }
    } else {
      nextPayoutDate = new Date(
        Date.UTC(nextYear, nextMonth - 1, defaultPayoutDay),
      );
    }

    const nextNorm = normalizeDate(nextPayoutDate);
    let nextTs = Date.UTC(nextNorm.year, nextNorm.month - 1, nextNorm.day);
    if (nextTs <= startTs) {
      nextTs = startTs + 30 * 86400000;
    }
    const cycleEndDate = new Date(nextTs - 86400000);

    const fixedEssentialsRealization = calculateFixedEssentialsRealization(
      transactions,
      fixedTargets,
    );
    const operationalRefundsOffset = sumOperationalRefunds(transactions);
    const grossDailyExpensesLogged = transactions
      .filter(
        (t) =>
          t.type === TransactionType.DEDUCTION && !t.fixedEssentialCategory,
      )
      .reduce((s, t) => s + t.amount, 0);

    const totalDailySpent = calculateOperationalDailySpent(
      transactions,
      fixedTargets,
    );

    const pacing = calculateDailyPacing({
      periodMonth: month,
      periodYear: year,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      actualDailyOperational: waterfall.actualDailyOperational,
      dailyOperationalTarget: currentTargets.dailyOperational,
      totalDailySpent,
    });

    const selectedAuditStats = computePeriodAuditStats(month, year);

    const periodKey = `${month}/${year}`;
    const realizedVaultDeposit = vaultDepositsByPeriod.get(periodKey) ?? 0;
    const realizedInVaultLiquidCash =
      vaultLiquidDepositsByPeriod.get(periodKey) ?? 0;
    const realizedInVaultInvestmentRdpu =
      vaultRdpuDepositsByPeriod.get(periodKey) ?? 0;
    const untransferredP1Savings = Math.max(
      0,
      waterfall.actualSavings - realizedVaultDeposit,
    );

    // Itemized Credit Card Charges for the selected period
    const itemizedCreditCardCharges: ItemizedReportCreditCardCharge[] = [];
    if (selectedSnapshot) {
      const ccTxs = transactions.filter(
        (t) =>
          t.type === TransactionType.CREDIT_BILL &&
          t.sourceType === TransactionSourceType.CC_TRANSACTION,
      );
      for (const t of ccTxs) {
        const card = t.sourceId ? cardsById.get(t.sourceId) : undefined;
        const chargeType = (card?.chargeType ?? 'FULL') as
          | 'FULL'
          | 'INSTALLMENT'
          | 'RECURRING';
        const progress = card
          ? calculateCardInstallmentProgress(card, month, year)
          : null;
        const chargeTypeLabel =
          chargeType === 'INSTALLMENT'
            ? 'Installment Plan'
            : chargeType === 'RECURRING'
              ? 'Recurring Subscription'
              : 'One-Time Full Charge';
        const sliceBadge =
          chargeType === 'INSTALLMENT'
            ? (progress?.badgeLabel ?? '1/1')
            : chargeType === 'RECURRING'
              ? 'Monthly Recurring'
              : '1/1 Full';
        const billingMonth = card?.billingMonth ?? month;
        const billingYear = card?.billingYear ?? year;
        const endedAtLabel =
          card?.endedAtMonth && card?.endedAtYear
            ? formatReportPeriodLabel(card.endedAtMonth, card.endedAtYear)
            : null;
        itemizedCreditCardCharges.push({
          id: card?.id ?? t.id,
          label: card?.label ?? t.label,
          category: card?.category ?? 'GENERAL',
          chargeType,
          chargeTypeLabel,
          sliceBadge,
          totalAmount: card
            ? (progress?.totalPrincipalAmount ??
              card.totalAmount ??
              card.amount)
            : t.amount,
          dueAmount: t.amount,
          remainingPrincipalAfterPeriod:
            progress?.remainingPrincipalAfterTarget ?? 0,
          billingMonth,
          billingYear,
          isNewThisPeriod: billingMonth === month && billingYear === year,
          endedAtLabel,
          transactionDate: (card?.transactionDate ?? t.date).toISOString(),
        });
      }
    } else {
      for (const card of activeCards) {
        const due = Math.round(calculateCardDueAmountForMonth(card, month, year));
        if (due <= 0) continue;
        const chargeType = card.chargeType as
          | 'FULL'
          | 'INSTALLMENT'
          | 'RECURRING';
        const progress = calculateCardInstallmentProgress(card, month, year);
        const chargeTypeLabel =
          chargeType === 'INSTALLMENT'
            ? 'Installment Plan'
            : chargeType === 'RECURRING'
              ? 'Recurring Subscription'
              : 'One-Time Full Charge';
        const sliceBadge =
          chargeType === 'INSTALLMENT'
            ? (progress.badgeLabel ?? '1/1')
            : chargeType === 'RECURRING'
              ? 'Monthly Recurring'
              : '1/1 Full';
        const endedAtLabel =
          card.endedAtMonth && card.endedAtYear
            ? formatReportPeriodLabel(card.endedAtMonth, card.endedAtYear)
            : null;
        itemizedCreditCardCharges.push({
          id: card.id,
          label: card.label,
          category: card.category,
          chargeType,
          chargeTypeLabel,
          sliceBadge,
          totalAmount:
            progress.totalPrincipalAmount ?? card.totalAmount ?? card.amount,
          dueAmount: due,
          remainingPrincipalAfterPeriod: progress.remainingPrincipalAfterTarget,
          billingMonth: card.billingMonth,
          billingYear: card.billingYear,
          isNewThisPeriod:
            card.billingMonth === month && card.billingYear === year,
          endedAtLabel,
          transactionDate: card.transactionDate.toISOString(),
        });
      }
    }

    // Itemized manual daily expenses, routine bill logs, and refunds
    const fixedCategoryLabels: Record<string, string> = routineCategoryLabels;
    const itemizedDailyExpenses: ItemizedReportDailyExpense[] = transactions
      .filter(
        (t) =>
          t.type === TransactionType.DEDUCTION ||
          t.sourceType === TransactionSourceType.OPERATIONAL_REFUND,
      )
      .map((t) => {
        if (t.sourceType === TransactionSourceType.OPERATIONAL_REFUND) {
          return {
            id: t.id,
            label: t.label,
            amount: t.amount,
            signedAmount: -t.amount,
            date: t.date.toISOString(),
            kind: 'OPERATIONAL_REFUND' as const,
            kindLabel: 'Refund / Patungan Offset',
            fixedEssentialCategory: null,
            fixedEssentialCategoryLabel: null,
          };
        }
        if (t.fixedEssentialCategory) {
          return {
            id: t.id,
            label: t.label,
            amount: t.amount,
            signedAmount: t.amount,
            date: t.date.toISOString(),
            kind: 'FIXED_ESSENTIAL_EXPENSE' as const,
            kindLabel: 'Routine Bill Realization',
            fixedEssentialCategory: t.fixedEssentialCategory,
            fixedEssentialCategoryLabel:
              fixedCategoryLabels[t.fixedEssentialCategory] ??
              t.fixedEssentialCategory,
          };
        }
        return {
          id: t.id,
          label: t.label,
          amount: t.amount,
          signedAmount: t.amount,
          date: t.date.toISOString(),
          kind: 'OPERATIONAL_EXPENSE' as const,
          kindLabel: 'Daily Living Spend',
          fixedEssentialCategory: null,
          fixedEssentialCategoryLabel: null,
        };
      });

    const routineBillsRealization = buildRoutineBillsRealizationRows(
      allocationDiffRows,
      fixedEssentialsRealization,
      routineCategoryLabels,
    );

    // Resolve immediately preceding snapshot (M-1) for MoM spike analysis
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevSnap = allNonPhantomSnapshots.find(
      (s) => s.month === prevMonth && s.year === prevYear,
    );
    let previousPeriodForDrivers: Parameters<
      typeof buildMoneyDriversAndSpikes
    >[0]['previousPeriod'] = null;

    if (prevSnap) {
      const pTxs = prevSnap.transactions ?? [];
      const prevPaylater = pTxs
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.BULK_BILL,
        )
        .reduce((s, t) => s + t.amount, 0);
      const prevCc = pTxs
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CC_TRANSACTION,
        )
        .reduce((s, t) => s + t.amount, 0);
      const prevPersonalDebt = pTxs
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.PERSONAL_DEBT,
        )
        .reduce((s, t) => s + t.amount, 0);
      const prevContracts = pTxs
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CONTRACT,
        )
        .reduce((s, t) => s + t.amount, 0);
      const prevManualDed = calculateOperationalDailySpent(pTxs, {
        transport: prevSnap.transport,
        internet: prevSnap.internet,
        vape: prevSnap.vape,
        haircut: prevSnap.haircut,
      });

      previousPeriodForDrivers = {
        periodLabel: formatReportPeriodLabel(prevMonth, prevYear),
        finalTotalIncome: prevSnap.finalTotalIncome ?? 0,
        paylaterBills: prevPaylater,
        creditCardBills: prevCc,
        personalDebtBills: prevPersonalDebt,
        contractInstallments: prevContracts,
        totalCreditBills:
          prevPaylater + prevCc + prevPersonalDebt + prevContracts,
        dailyOperational: prevSnap.actualDailyOperational ?? 0,
        manualDeductions: prevManualDed,
        actualSavings: prevSnap.actualSavings ?? 0,
      };
    }

    const periodLabel = formatReportPeriodLabel(month, year);
    const driversAndSpikes = buildMoneyDriversAndSpikes({
      periodLabel,
      finalTotalIncome: payroll.finalTotalIncome,
      paylaterBills,
      creditCardBills,
      personalDebtBills,
      contractInstallments,
      totalCreditBills,
      fixedEssentialsRevised,
      dailyOperationalBaseline: dailyOpRow.baselineTarget,
      dailyOperationalRevised: dailyOpRow.revisedTarget,
      actualDailyOperational: waterfall.actualDailyOperational,
      manualDeductions,
      actualSavings: waterfall.actualSavings,
      savingsRevised: savingsRow.revisedTarget,
      isDeficit: waterfall.isDeficit,
      deficitUncovered: waterfall.deficitUncovered,
      newCreditCardChargesInPeriod: itemizedCreditCardCharges
        .filter((c) => c.isNewThisPeriod)
        .map((c) => ({ label: c.label, dueAmount: c.dueAmount })),
      allocationDiffRows,
      previousPeriod: previousPeriodForDrivers,
    });

    const livingAndRoutineSpend =
      fixedEssentialsActual +
      waterfall.actualDailyOperational +
      bufferRow.actualOutcome +
      manualDeductions;
    const netSavedAndLeftover =
      waterfall.actualSavings +
      waterfall.actualSelfReward -
      waterfall.deficitUncovered;
    const incomeDenom = Math.max(1, payroll.finalTotalIncome);

    let vaultTransferStatus:
      | 'TRANSFERRED'
      | 'PARTIAL'
      | 'PENDING'
      | 'NO_SAVINGS_FUNDED' = 'NO_SAVINGS_FUNDED';
    let vaultTransferLabel = 'No P1 Savings Funded';
    if (waterfall.actualSavings > 0) {
      if (realizedVaultDeposit >= waterfall.actualSavings) {
        vaultTransferStatus = 'TRANSFERRED';
        vaultTransferLabel = 'Transferred to Vault';
      } else if (realizedVaultDeposit > 0) {
        vaultTransferStatus = 'PARTIAL';
        vaultTransferLabel = 'Partially Transferred to Vault';
      } else {
        vaultTransferStatus = 'PENDING';
        vaultTransferLabel = 'Pending Vault Transfer';
      }
    }

    const formatShortUtc = (d: Date) => {
      const n = normalizeDate(d);
      const mNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      return `${n.day} ${mNames[Math.max(0, Math.min(11, n.month - 1))]} ${n.year}`;
    };

    const verdictStatus: 'SURPLUS' | 'BREAKEVEN' | 'DEFICIT' =
      waterfall.isDeficit
        ? 'DEFICIT'
        : netSavedAndLeftover > 0
          ? 'SURPLUS'
          : 'BREAKEVEN';
    const verdictHeadline =
      verdictStatus === 'DEFICIT'
        ? `Deficit Period: Uncovered Shortfall of Rp ${waterfall.deficitUncovered.toLocaleString('id-ID')}`
        : verdictStatus === 'SURPLUS'
          ? `Surplus Period: Net Saved & Leftover Rp ${netSavedAndLeftover.toLocaleString('id-ID')}`
          : 'Breakeven Period: All Upfront Bills & Living Costs Covered';
    const verdictDescription =
      verdictStatus === 'DEFICIT'
        ? 'Total upfront debt bills and living obligations exceeded your Money In this month. Core Savings (P1) and Self-Reward (P2) were paused at Rp 0.'
        : `All upfront debt bills and living pools were funded in full, leaving Rp ${waterfall.actualSavings.toLocaleString('id-ID')} for Core Savings (P1) and Rp ${waterfall.actualSelfReward.toLocaleString('id-ID')} for Self-Reward / Leftover (P2).`;

    const closingStatement = {
      month,
      year,
      periodLabel,
      workingDaysWindowLabel,
      status,
      generatedAtIso: new Date().toISOString(),
      payroll: {
        ...payroll,
        incomeTransactions,
      },
      upfrontAndWaterfall: {
        paylaterBills,
        creditCardBills,
        personalDebtBills,
        contractInstallments,
        totalCreditBills,
        manualDeductions,
        totalDeductions,
        fixedEssentialsBaseline,
        fixedEssentialsRevised,
        fixedEssentialsActual,
        dailyOperationalBaseline: dailyOpRow.baselineTarget,
        dailyOperationalRevised: dailyOpRow.revisedTarget,
        actualDailyOperational: waterfall.actualDailyOperational,
        bufferPocketBaseline: bufferRow.baselineTarget,
        bufferPocketRevised: bufferRow.revisedTarget,
        actualBufferPocket: bufferRow.actualOutcome,
        savingsBaseline: savingsRow.baselineTarget,
        savingsRevised: savingsRow.revisedTarget,
        actualSavings: waterfall.actualSavings,
        selfRewardBaseline: rewardRow.baselineTarget,
        selfRewardRevised: rewardRow.revisedTarget,
        actualSelfReward: waterfall.actualSelfReward,
        availableFunds: waterfall.availableFunds,
        deficitUncovered: waterfall.deficitUncovered,
        isDeficit: waterfall.isDeficit,
        netRetainedSurplus: netSavedAndLeftover,
        allocationDiffRows,
      },
      pacing,
      governance: {
        disciplineScore: selectedAuditStats.disciplineScore,
        greenCount: selectedAuditStats.greenCount,
        yellowCount: 0,
        redCount: selectedAuditStats.redCount,
        ccUsage: creditCardBills,
        ccUsageLimit: selectedSnapshot?.ccUsageLimit ?? config.ccUsageLimit ?? 0,
        paylaterUsage: paylaterBills,
        paylaterUsageLimit:
          selectedSnapshot?.paylaterUsageLimit ?? config.paylaterUsageLimit ?? 0,
        budgetRevisionCount: selectedSnapshot?.budgetRevisions.length ?? 0,
        realizedVaultDeposit,
        untransferredP1Savings,
      },
      moneyCycle: {
        kpis: {
          totalMoneyIn: payroll.finalTotalIncome,
          netPaycheck: payroll.netSalaryIncome,
          extraInflow: payroll.thrAmount + payroll.bonusAmount + extraIncome,
          totalDebtAndBillsPaid: totalCreditBills,
          debtShareOfIncomePercent:
            Math.round((totalCreditBills / incomeDenom) * 1000) / 10,
          livingAndRoutineSpend,
          livingShareOfIncomePercent:
            Math.round((livingAndRoutineSpend / incomeDenom) * 1000) / 10,
          netSavedAndLeftover,
        },
        driversAndSpikes,
        paydayChecklist: {
          creditDueDay: config.creditDueDay ?? 11,
          paylaterDueDay: config.payrollPayoutDay ?? 25,
          step1SetAsideForDebt: {
            totalAmount: totalCreditBills,
            paylaterAmount: paylaterBills,
            creditCardAmount: creditCardBills,
            personalDebtAmount: personalDebtBills,
            contractInstallmentsAmount: contractInstallments,
          },
          step2KeepInOperationalAccount: {
            totalAmount:
              fixedEssentialsActual +
              waterfall.actualDailyOperational +
              bufferRow.actualOutcome,
            fixedRoutinePoolAmount: fixedEssentialsActual,
            fundedDailyLivingAmount: waterfall.actualDailyOperational,
            bufferPocketAmount: bufferRow.actualOutcome,
          },
          step3TransferToSavingsVault: {
            fundedP1Savings: waterfall.actualSavings,
            realizedInVault: realizedVaultDeposit,
            pendingTransferAmount: untransferredP1Savings,
            transferStatus: vaultTransferStatus,
            statusLabel: vaultTransferLabel,
          },
          step4FreeSelfRewardAllowance: {
            fundedP2Allowance: waterfall.actualSelfReward,
          },
        },
        itemizedCreditCardCharges,
        routineBillsRealization,
        dailyLiving: {
          initialPlan: dailyOpRow.baselineTarget,
          currentMonthlyCap: dailyOpRow.revisedTarget,
          fundedAmount: waterfall.actualDailyOperational,
          grossDailyExpensesLogged,
          fixedEssentialOverage: fixedEssentialsRealization.totalOverage,
          operationalRefundsOffset,
          netDailySpendUsed: totalDailySpent,
          remainingOperationalCash: pacing.remainingBudget,
          safeToSpendToday: pacing.safeToSpendToday,
          baselineDailyRate: pacing.baselineDailyRate,
          daysInCycle: pacing.daysInCycle,
          daysPassed: pacing.daysPassed,
          daysRemaining: pacing.daysRemaining,
          cycleDateLabel: `${formatShortUtc(cycleStartDate)} – ${formatShortUtc(cycleEndDate)}`,
          isEndDateConfirmed,
          pacingStatus: pacing.pacingStatus,
          itemizedDailyExpenses,
        },
        savingsBottomLine: {
          p1Target: savingsRow.revisedTarget,
          p1Baseline: savingsRow.baselineTarget,
          p1Funded: waterfall.actualSavings,
          realizedInVaultTotal: realizedVaultDeposit,
          realizedInVaultLiquidCash,
          realizedInVaultInvestmentRdpu,
          untransferredP1Savings,
          vaultTotalBalance,
          vaultLiquidCashBalance,
          vaultInvestmentRdpuBalance,
          p2Target: rewardRow.revisedTarget,
          p2Funded: waterfall.actualSelfReward,
          netSavedAndLeftover,
          isDeficit: waterfall.isDeficit,
          deficitUncovered: waterfall.deficitUncovered,
          verdictStatus,
          verdictHeadline,
          verdictDescription,
        },
      },
    };

    // ---------------------------------------------------------
    // 2. Build MultiPeriodComparativeStatement & Dossier Audits
    // ---------------------------------------------------------
    const scopedSnapshots =
      scope === 'locked'
        ? allNonPhantomSnapshots.filter(
            (s) => s.status === SnapshotStatus.LOCKED,
          )
        : allNonPhantomSnapshots;

    const comparativeRawRows = scopedSnapshots.map((s) => {
      const txs = s.transactions ?? [];
      const creditBillsAmount = txs
        .filter((t) => t.type === TransactionType.CREDIT_BILL)
        .reduce((sum, t) => sum + t.amount, 0);
      const manualDeductionsAmount = calculateOperationalDailySpent(txs, {
        transport: s.transport,
        internet: s.internet,
        vape: s.vape,
        haircut: s.haircut,
      });
      const fixedTarget = s.transport + s.internet + s.vape + s.haircut;
      const deficit = s.deficitUncovered ?? 0;
      const actualDailyOp = s.actualDailyOperational ?? 0;
      const isDeficit = deficit > 0 && actualDailyOp === 0;
      const fixedEssentialsAmount = isDeficit ? 0 : fixedTarget;
      const bufferPocketAmount = isDeficit ? 0 : s.bufferPocket;
      const auditStats = computePeriodAuditStats(s.month, s.year);

      return {
        month: s.month,
        year: s.year,
        status: (s.status === SnapshotStatus.LOCKED ? 'LOCKED' : 'DRAFT') as
          | 'DRAFT'
          | 'LOCKED',
        finalTotalIncome: s.finalTotalIncome ?? 0,
        creditBillsAmount,
        manualDeductionsAmount,
        fixedEssentialsAmount,
        actualDailyOperational: actualDailyOp,
        bufferPocketAmount,
        actualSavings: s.actualSavings ?? 0,
        selfReward: s.selfReward ?? 0,
        deficitUncovered: deficit,
        disciplineScore: auditStats.disciplineScore,
        realizedVaultAmount:
          vaultDepositsByPeriod.get(`${s.month}/${s.year}`) ?? 0,
      };
    });

    const comparativeStatement = buildComparativeStatement(
      scope,
      comparativeRawRows,
    );

    // ---------------------------------------------------------
    // 3. Build LiabilityAmortizationSchedule from LiabilityMatrix
    // ---------------------------------------------------------
    const rawScheduleMonths = liabilityMatrix.columns.map((col) => {
      const paylaterAmount =
        liabilityMatrix.payLaterRow.cells[col.key]?.amount ?? 0;
      const creditCardAmount =
        liabilityMatrix.creditCardRow.cells[col.key]?.amount ?? 0;
      const personalDebtAmount =
        liabilityMatrix.personalDebtRow.cells[col.key]?.amount ?? 0;
      const contractInstallmentsAmount = liabilityMatrix.contractRows.reduce(
        (s, r) => s + (r.cells[col.key]?.amount ?? 0),
        0,
      );

      const activeInstallmentSlices: AmortizationSliceDetail[] = [];
      const activeSubscriptions: AmortizationSubscriptionDetail[] = [];

      for (const card of activeCards) {
        const due = Math.round(
          calculateCardDueAmountForMonth(card, col.month, col.year),
        );
        if (due <= 0) continue;

        if (card.chargeType === 'INSTALLMENT') {
          const prog = calculateCardInstallmentProgress(
            card,
            col.month,
            col.year,
          );
          activeInstallmentSlices.push({
            label: card.label,
            amount: due,
            sliceBadge:
              prog.badgeLabel ??
              `${prog.paidSlicesThroughTarget}/${prog.totalTenor}`,
            isFinalSlice: prog.remainingSlicesAfterTarget === 0,
            sourceKind: 'CC_INSTALLMENT',
          });
        } else if (card.chargeType === 'RECURRING') {
          const endedAtLabel =
            card.endedAtMonth && card.endedAtYear
              ? formatReportPeriodLabel(card.endedAtMonth, card.endedAtYear)
              : null;
          const isFinalMonth =
            card.endedAtMonth === col.month && card.endedAtYear === col.year;
          activeSubscriptions.push({
            label: card.label,
            amount: due,
            endedAtLabel,
            isFinalMonth,
          });
        }
      }

      const colSerial = col.year * 12 + (col.month - 1);
      for (const c of activeContracts) {
        const startSerial = c.startYear * 12 + (c.startMonth - 1);
        const endSerial = startSerial + c.totalTenor - 1;
        if (colSerial >= startSerial && colSerial <= endSerial) {
          const sliceNum = colSerial - startSerial + 1;
          activeInstallmentSlices.push({
            label: c.label,
            amount: c.monthlyInstallment,
            sliceBadge: `${sliceNum}/${c.totalTenor}`,
            isFinalSlice: sliceNum === c.totalTenor,
            sourceKind: 'CONTRACT',
          });
        }
      }

      return {
        month: col.month,
        year: col.year,
        paylaterAmount,
        creditCardAmount,
        personalDebtAmount,
        contractInstallmentsAmount,
        activeInstallmentSlices,
        activeSubscriptions,
      };
    });

    const amortizationSchedule = buildAmortizationSchedule(
      month,
      year,
      rawScheduleMonths,
    );

    // ---------------------------------------------------------
    // 4. Build BudgetRevisionAndDisciplineDossier
    // ---------------------------------------------------------
    const scopedPeriodSet = new Set(
      scopedSnapshots.map((s) => `${s.month}/${s.year}`),
    );
    const allRevisions = await this.prisma.budgetRevision.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const revisions: DossierRevisionItem[] = allRevisions
      .filter((r) => scopedPeriodSet.has(`${r.month}/${r.year}`))
      .map((r) => ({
        id: r.id,
        month: r.month,
        year: r.year,
        periodLabel: formatReportPeriodLabel(r.month, r.year),
        category: r.category ?? 'CUSTOM_BUCKET',
        categoryLabel: r.bucketLabel ?? formatRevisionCategoryLabel(r.category ?? 'CUSTOM_BUCKET'),
        previousValue: r.previousValue,
        newValue: r.newValue,
        difference: r.difference,
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      }));

    const periodAudits: DossierPeriodAuditItem[] = scopedSnapshots.map((s) => {
      const stats = computePeriodAuditStats(s.month, s.year);
      return {
        month: s.month,
        year: s.year,
        periodLabel: formatReportPeriodLabel(s.month, s.year),
        status: s.status === SnapshotStatus.LOCKED ? 'LOCKED' : 'DRAFT',
        disciplineScore: stats.disciplineScore,
        greenCount: stats.greenCount,
        redCount: stats.redCount,
        flags: stats.flags,
      };
    });

    const recentGovernanceLogs: DossierGovernanceLogItem[] = recentLogs.map(
      (l) => ({
        id: l.id,
        action: l.action,
        actionLabel: formatGovernanceActionLabel(l.action),
        category: l.category,
        categoryLabel: formatGovernanceCategoryLabel(l.category),
        severity: l.severity,
        summary: l.summary,
        details: l.details,
        month: l.month,
        year: l.year,
        createdAt: l.createdAt.toISOString(),
      }),
    );

    const liquidityForecast = await this.getLiquidityForecast(month, year, 3, userId);

    return {
      selectedMonth: month,
      selectedYear: year,
      scope,
      profileMode: (config.profileMode as any) ?? 'SUPERADMIN_BESPOKE',
      closingStatement,
      comparativeStatement,
      amortizationSchedule,
      dossier: {
        revisions,
        periodAudits,
        recentGovernanceLogs,
      },
      liquidityForecast,
    };
  }

  /**
   * Read-only 3-Month Forward Liquidity Projection (`GET /api/reports/forecast`).
   * Never mutates DB state.
   */
  async getLiquidityForecast(
    month: number,
    year: number,
    horizonMonths = 3,
    userId: number = 1,
  ): Promise<ExecutiveLiquidityForecastReport> {
    const [
      config,
      snapshots,
      contracts,
      scheduledBills,
      creditCards,
      bulkBills,
    ] = await Promise.all([
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
        (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })),
      this.prisma.monthlySnapshot.findMany({
        where: { userId },
        include: { transactions: true },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
      this.prisma.creditContract.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.scheduledBill.findMany({
        where: { isActive: true },
        orderBy: { id: 'asc' },
      }),
      this.prisma.creditCardTransaction.findMany({
        where: {
          userId,
          status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.monthlyBulkBill.findMany({
        where: { userId },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      }),
    ]);

    if (!config) {
      throw new NotFoundException('Global configuration not found');
    }

    return calculateLiquidityForecast({
      baseMonth: month,
      baseYear: year,
      horizonMonths,
      config: {
        baseSalary: config.baseSalary,
        dailyAllowance: config.dailyAllowance,
        laptopAllowance: config.laptopAllowance,
        dailyOperational: config.dailyOperational,
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
        baseSavings: config.baseSavings,
        payrollPayoutDay: config.payrollPayoutDay,
      },
      snapshots,
      contracts,
      scheduledBills,
      creditCards,
      bulkBills,
    });
  }
}
