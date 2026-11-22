import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreditContract,
  CreditCardTransaction,
  MonthlyBulkBill,
  LiabilityLineItem,
  LiabilityCategory,
  CreditCardChargeType,
  CreditCardStatus,
  SnapshotStatus,
  TransactionSourceType,
  TransactionType,
} from '@prisma/client';
import {
  calculateCreditUsageLimit,
  CreditLimitCalculationResult,
} from '../calculator/credit-limit';
import { calculatePayroll } from '../calculator/payroll';
import {
  CC_CUTOFF_DAY,
  CC_DUE_DAY,
  DEFAULT_PAYOUT_DAY,
  SPAYLATER_DUE_DAY,
  getJakartaDateParts,
  getPayrollPeriodForDate,
} from '../calculator/pacing';
import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
  CardInstallmentProgress,
  DerivedBillSettlementState,
  evaluateObligationSettlement,
  getDefaultDueDayForCategory,
  resolveBillSettlementState,
  stripAllSettlementMarkers,
} from './credit.utils';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';
import { resolveStudioConfig } from '../config/studio.defaults';
import { computePaycycleHorizonTs, evaluateFormulaDslTs } from '../calculator/erp-engines';
import { addHybridMonths } from '../calculator/hybrid-engine';
import type { SmtpVerificationOutcome } from '../email/smtp-transport.util';

const MONTH_NAMES = [
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

export interface ContractWithTimeline extends CreditContract {
  elapsedTenor: number;
  tenorProgressPercent: number;
  payoffMonth: number;
  payoffYear: number;
  payoffDateLabel: string;
  remainingPrincipal: number;
}

export interface CreditCardSummary {
  creditLimit: number;
  statementCutoffDay: number;
  paymentDueDay: number;
  currentCycleDue: number;
  totalOutstandingBalance: number;
  utilizationPercent: number;
}

export interface LiabilityMatrixColumn {
  month: number;
  year: number;
  key: string;
  label: string;
  cycleWindow: string;
  paysDueMonth: string;
  isPayoutConfirmed: boolean;
}

export interface EnrichedCreditCardTransaction extends CreditCardTransaction {
  dueInPeriod: number;
  endedAtLabel: string | null;
  installmentProgress: CardInstallmentProgress;
}

export interface LiabilityMatrixCardItem {
  id: number;
  label: string;
  chargeType: string;
  amount: number;
  sliceBadge: string | null;
  endedAtLabel: string | null;
  isSettled: boolean;
  isAutoSettled: boolean;
  settlementState: DerivedBillSettlementState;
  dueDateIso: string;
}

export interface LiabilityLineItemDto {
  id: number;
  userId: number;
  month: number;
  year: number;
  category: LiabilityCategory;
  title: string;
  merchantOrPlatform: string;
  principalAmount: number;
  monthlyAmount: number;
  tenorMonths: number;
  installmentIndex: number;
  cutoffDay: number;
  dueDay: number;
  isSettled: boolean;
  isAutoSettled: boolean;
  settlementState: DerivedBillSettlementState;
  dueDateIso: string;
  parentContractId: string | null;
  notes: string | null;
}

export interface ActiveInstallmentPlanDto {
  id: string;
  source: 'LINE_ITEM' | 'CC_TRANSACTION' | 'CREDIT_CONTRACT';
  category: string;
  title: string;
  merchantOrPlatform: string;
  principalAmount: number;
  monthlyInstallment: number;
  totalTenor: number;
  remainingPrincipal: number;
  payoffMonth: number;
  payoffYear: number;
  payoffDateLabel: string;
  parentContractId?: string | null;
  cardId?: number;
  canAccelerate: boolean;
  canSettleEarly: boolean;
  isIncludedInMatrixRows: boolean;
  cells: Record<string, { amount: number; sliceBadge?: string }>;
}

export interface KillSwitchItem {
  id: number;
  userId: number;
  label: string;
  amount: number;
  promoLabel: string | null;
  promoEndDate: string | null;
  postPromoNormalAmount: number | null;
  killSwitchEnabled: boolean;
  providerCancelUrl: string | null;
  providerCancelConfirmed: boolean;
  isRecurring: boolean;
  isActive: boolean;
  stoppedAtMonth: number | null;
  stoppedAtYear: number | null;
  daysUntilExpiry: number | null;
  monthlyPenaltyDelta: number;
  alertState: 'SILENT' | 'ACTION_REQUIRED' | 'CONFIRMED_SAFE';
  statusLabel: 'ARMED' | 'CRITICAL' | 'SAFE' | 'INACTIVE';
  lastKillSwitchNotifiedAt: string | null;
}

export interface KillSwitchNotificationConfigResponse {
  profileEmail: string | null;
  killSwitchNotifyEmail: string | null;
  killSwitchSmtpUser: string | null;
  hasSmtpPassword: boolean;
  killSwitchWebhookUrl: string | null;
  killSwitchWaPhone: string | null;
  hasWaApiKey: boolean;
  killSwitchCustomMessageTemplate: string | null;
  smtpVerification?: SmtpVerificationOutcome | null;
}

export interface KillSwitchResponse {
  config: {
    killSwitchLeadDays: number;
    killSwitchBannerEnabled: boolean;
  };
  items: KillSwitchItem[];
}

export interface LiabilityMatrixResponse {
  columns: LiabilityMatrixColumn[];
  payLaterRow: {
    label: string;
    dueDay: number;
    cells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    >;
  };
  creditCardRow: {
    label: string;
    dueDay: number;
    cells: Record<
      string,
      { amount: number; items?: LiabilityMatrixCardItem[] }
    >;
  };
  personalDebtRow: {
    label: string;
    cells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    >;
  };
  contractRows: Array<{
    id: number | string;
    label: string;
    monthlyInstallment: number;
    source?: 'LINE_ITEM' | 'CC_TRANSACTION' | 'CREDIT_CONTRACT';
    category?: string;
    merchantOrPlatform?: string;
    totalTenor?: number;
    principalAmount?: number;
    remainingPrincipal?: number;
    payoffDateLabel?: string;
    parentContractId?: string | null;
    cardId?: number;
    canAccelerate?: boolean;
    canSettleEarly?: boolean;
    isIncludedInMatrixRows?: boolean;
    cells: Record<string, { amount: number; sliceBadge?: string }>;
  }>;
  activeInstallmentPlans: ActiveInstallmentPlanDto[];
  lineItemsPerMonth: Record<string, LiabilityLineItemDto[]>;
  totalsPerMonth: Record<string, number>;
  settlementSummaryPerMonth: Record<
    string,
    {
      totalDue: number;
      paidAmount: number;
      reservedAmount: number;
      unpaidAmount: number;
      bankHoldNeeded: number;
    }
  >;
}

@Injectable()
export class CreditSelectors {
  constructor(private readonly prisma: PrismaService) {}

  async listContracts(isActive?: boolean, userId: number = 1): Promise<ContractWithTimeline[]> {
    if (userId === 2) {
      return [];
    }

    const contracts = await this.prisma.creditContract.findMany({
      where: isActive !== undefined ? { isActive } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    return contracts.map((c) => {
      const elapsedTenor = Math.max(0, c.totalTenor - c.remainingTenor);
      const tenorProgressPercent =
        c.totalTenor > 0
          ? Math.min(100, Math.round((elapsedTenor / c.totalTenor) * 100))
          : 100;

      const startIndex = c.startYear * 12 + (c.startMonth - 1);
      const endIndex = startIndex + c.totalTenor - 1;
      const payoffYear = Math.floor(endIndex / 12);
      const payoffMonth = (endIndex % 12) + 1;
      const payoffDateLabel = `${MONTH_NAMES[payoffMonth - 1]} ${payoffYear}`;
      const remainingPrincipal = Math.round(c.remainingTenor * c.monthlyInstallment);

      return {
        ...c,
        elapsedTenor,
        tenorProgressPercent,
        payoffMonth,
        payoffYear,
        payoffDateLabel,
        remainingPrincipal,
      };
    });
  }

  async getContractById(id: number): Promise<CreditContract | null> {
    return this.prisma.creditContract.findUnique({ where: { id } });
  }

  async listCardTransactions(
    month?: number,
    year?: number,
    contextMonth?: number,
    contextYear?: number,
    userId: number = 1,
  ): Promise<EnrichedCreditCardTransaction[]> {
    const rows = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        ...(month !== undefined ? { billingMonth: month } : {}),
        ...(year !== undefined ? { billingYear: year } : {}),
      },
      orderBy: { transactionDate: 'desc' },
    });

    const currentPeriod = getPayrollPeriodForDate();
    const targetMonth = contextMonth ?? month ?? currentPeriod.month;
    const targetYear = contextYear ?? year ?? currentPeriod.year;

    return rows.map((card) => {
      const installmentProgress = calculateCardInstallmentProgress(
        card,
        targetMonth,
        targetYear,
      );
      const dueInPeriod = Math.round(
        calculateCardDueAmountForMonth(card, targetMonth, targetYear),
      );
      const endedAtLabel =
        card.endedAtMonth != null && card.endedAtYear != null
          ? `${MONTH_NAMES[card.endedAtMonth - 1] ?? card.endedAtMonth} ${card.endedAtYear}`
          : null;

      return {
        ...card,
        dueInPeriod,
        endedAtLabel,
        installmentProgress,
      };
    });
  }

  async getCardSummary(
    month?: number,
    year?: number,
    userId: number = 1,
  ): Promise<CreditCardSummary> {
    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

    const creditLimit = config?.creditLimit ?? 7_000_000;
    const statementCutoffDay = config?.creditStatementDay ?? CC_CUTOFF_DAY;
    const paymentDueDay = config?.creditDueDay ?? CC_DUE_DAY;

    const cards = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
      },
    });

    const currentPeriod = getPayrollPeriodForDate();
    const targetMonth = month ?? currentPeriod.month;
    const targetYear = year ?? currentPeriod.year;

    let currentCycleDue = 0;
    let totalOutstandingBalance = 0;

    for (const card of cards) {
      const due = calculateCardDueAmountForMonth(card, targetMonth, targetYear);
      currentCycleDue += due;

      if (card.status === CreditCardStatus.SETTLED) {
        totalOutstandingBalance += due;
        continue;
      }

      if (card.chargeType === CreditCardChargeType.FULL) {
        totalOutstandingBalance += card.amount;
      } else if (card.chargeType === CreditCardChargeType.INSTALLMENT) {
        const prog = calculateCardInstallmentProgress(
          card,
          targetMonth,
          targetYear,
        );
        totalOutstandingBalance += prog.remainingPrincipalIncludingTarget;
      } else if (card.chargeType === CreditCardChargeType.RECURRING) {
        if (due > 0) {
          totalOutstandingBalance += due;
        }
      }
    }

    const utilizationPercent =
      creditLimit > 0
        ? Math.min(100, Math.round((totalOutstandingBalance / creditLimit) * 100))
        : 0;

    return {
      creditLimit,
      statementCutoffDay,
      paymentDueDay,
      currentCycleDue: Math.round(currentCycleDue),
      totalOutstandingBalance: Math.round(totalOutstandingBalance),
      utilizationPercent,
    };
  }

  async listBulkBills(
    month?: number,
    year?: number,
    userId: number = 1,
  ): Promise<MonthlyBulkBill[]> {
    return this.prisma.monthlyBulkBill.findMany({
      where: {
        userId,
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async listLineItems(
    month?: number,
    year?: number,
    category?: string,
    userId: number = 1,
  ): Promise<LiabilityLineItemDto[]> {
    const [config, rows] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.liabilityLineItem.findMany({
        where: {
          userId,
          ...(month !== undefined ? { month } : {}),
          ...(year !== undefined ? { year } : {}),
          ...(category !== undefined
            ? { category: category as LiabilityCategory }
            : {}),
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }, { category: 'asc' }, { id: 'asc' }],
      }),
    ]);

    const ccDueDay = config?.creditDueDay ?? CC_DUE_DAY;
    return rows.map((li) => {
      const dueDay =
        li.dueDay > 0
          ? li.dueDay
          : getDefaultDueDayForCategory(li.category, ccDueDay);
      const settlement = evaluateObligationSettlement({
        periodMonth: li.month,
        periodYear: li.year,
        dueDay,
        dbIsSettled: li.isSettled,
        notes: li.notes,
      });
      const settlementState = resolveBillSettlementState({
        isSettled: settlement.isSettled,
        notes: li.notes,
      });
      return {
        id: li.id,
        userId: li.userId,
        month: li.month,
        year: li.year,
        category: li.category,
        title: li.title,
        merchantOrPlatform: li.merchantOrPlatform,
        principalAmount: li.principalAmount,
        monthlyAmount: Math.round(li.monthlyAmount),
        tenorMonths: li.tenorMonths,
        installmentIndex: li.installmentIndex,
        cutoffDay: li.cutoffDay,
        dueDay,
        isSettled: settlement.isSettled,
        isAutoSettled: settlement.isAutoSettled,
        settlementState,
        dueDateIso: settlement.dueDateIso,
        parentContractId: li.parentContractId,
        notes: stripAllSettlementMarkers(li.notes),
      };
    });
  }

  async listInstallmentPlans(userId: number = 1): Promise<ActiveInstallmentPlanDto[]> {
    const matrix = await this.getLiabilityMatrix(10, 2026, 24, userId);
    return matrix.activeInstallmentPlans;
  }

  async getLiabilityMatrix(
    startMonth = 10,
    startYear = 2026,
    count = 12,
    userId = 1,
  ): Promise<LiabilityMatrixResponse> {
    // 1. Fetch snapshots, config, bulk bills, line items, active contracts, and CC transactions
    const [snapshots, config, allBulkBills, allLineItems, activeContracts, activeCards] =
      await Promise.all([
        this.prisma.monthlySnapshot.findMany({
          where: { userId },
          select: {
            month: true,
            year: true,
            payrollPayoutDate: true,
            isPayoutDateConfirmed: true,
          },
        }),
        this.prisma.globalConfig.findFirst({ where: { userId } }),
        this.prisma.monthlyBulkBill.findMany({ where: { userId } }),
        this.prisma.liabilityLineItem.findMany({
          where: { userId },
          orderBy: [{ year: 'asc' }, { month: 'asc' }, { id: 'asc' }],
        }),
        userId === 2
          ? Promise.resolve([])
          : this.prisma.creditContract.findMany({
              where: { isActive: true },
              orderBy: { createdAt: 'asc' },
            }),
        this.prisma.creditCardTransaction.findMany({
          where: {
            userId,
            status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
          },
        }),
      ]);

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const pcCfg = studioConfig.paycycleFormulaConfig;

    const snapshotMap = new Map<
      string,
      { payrollPayoutDate: Date | null; isPayoutDateConfirmed: boolean }
    >();
    for (const s of snapshots) {
      snapshotMap.set(`${s.year}-${s.month}`, s);
    }

    const formatDayMonth = (d: Date) =>
      `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]}`;

    // 2. Build 12 columns with Two-Stage payday-to-bill cycle metadata
    const columns: LiabilityMatrixColumn[] = [];
    for (let i = 0; i < count; i++) {
      const totalMonths = startYear * 12 + (startMonth - 1) + i;
      const colYear = Math.floor(totalMonths / 12);
      const colMonth = (totalMonths % 12) + 1;
      const nextTotal = totalMonths + 1;
      const nextYear = Math.floor(nextTotal / 12);
      const nextMonth = (nextTotal % 12) + 1;

      const snap = snapshotMap.get(`${colYear}-${colMonth}`);
      const nextSnap = snapshotMap.get(`${nextYear}-${nextMonth}`);
      const colKey = `${String(colMonth).padStart(2, '0')}/${colYear}`;
      const nextPeriodKey = `${String(nextMonth).padStart(2, '0')}/${nextYear}`;
      const curOverride = pcCfg.periodOverrides?.[colKey];
      const nextOverride = pcCfg.periodOverrides?.[nextPeriodKey];
      const isColConfirmed =
        Boolean(snap?.isPayoutDateConfirmed) ||
        (colYear === 2026 && colMonth >= 11) ||
        (colYear === 2027 && colMonth === 1);
      const isNextConfirmed =
        Boolean(nextSnap?.isPayoutDateConfirmed) ||
        (nextYear === 2026 && nextMonth >= 11) ||
        (nextYear === 2027 && nextMonth === 1);

      const explicitStartIso =
        curOverride?.paydayDateIso ||
        (isColConfirmed && snap?.payrollPayoutDate
          ? new Date(snap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined);
      const explicitNextPaydayIso =
        nextOverride?.paydayDateIso ||
        (isNextConfirmed && nextSnap?.payrollPayoutDate
          ? new Date(nextSnap.payrollPayoutDate).toISOString().slice(0, 10)
          : undefined);

      const horizon = computePaycycleHorizonTs({
        month: colMonth,
        year: colYear,
        anchorDay: pcCfg.paydayAnchorDay ?? DEFAULT_PAYOUT_DAY,
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

      const startDate = new Date(`${horizon.paydayIso}T00:00:00.000Z`);
      const nextPayDate = new Date(`${horizon.nextPaydayIso}T00:00:00.000Z`);
      const endDate = new Date(nextPayDate.getTime() - 86400000);

      columns.push({
        month: colMonth,
        year: colYear,
        key: `${colYear}-${colMonth}`,
        label: `${MONTH_NAMES[colMonth - 1]} '${String(colYear).slice(2)}`,
        cycleWindow: `${formatDayMonth(startDate)} - ${formatDayMonth(endDate)}`,
        paysDueMonth: `${MONTH_NAMES[colMonth - 1]} Due Dates`,
        isPayoutConfirmed: Boolean(snap?.isPayoutDateConfirmed || curOverride?.paydayDateIso),
      });
    }

    const ccDueDay = config?.creditDueDay ?? CC_DUE_DAY;

    const bulkBillMap = new Map<string, MonthlyBulkBill>();
    for (const b of allBulkBills) {
      bulkBillMap.set(`${b.year}-${b.month}`, b);
    }

    const evaluatedLineItems: LiabilityLineItemDto[] = [];
    const lineItemsPerMonth: Record<string, LiabilityLineItemDto[]> = {};
    for (const li of allLineItems) {
      const k = `${li.year}-${li.month}`;
      if (!lineItemsPerMonth[k]) lineItemsPerMonth[k] = [];
      const dueDay =
        li.dueDay > 0
          ? li.dueDay
          : getDefaultDueDayForCategory(li.category, ccDueDay);
      const settlement = evaluateObligationSettlement({
        periodMonth: li.month,
        periodYear: li.year,
        dueDay,
        dbIsSettled: li.isSettled,
        notes: li.notes,
      });
      const settlementState = resolveBillSettlementState({
        isSettled: settlement.isSettled,
        notes: li.notes,
      });
      const dto: LiabilityLineItemDto = {
        id: li.id,
        userId: li.userId,
        month: li.month,
        year: li.year,
        category: li.category,
        title: li.title,
        merchantOrPlatform: li.merchantOrPlatform,
        principalAmount: li.principalAmount,
        monthlyAmount: Math.round(li.monthlyAmount),
        tenorMonths: li.tenorMonths,
        installmentIndex: li.installmentIndex,
        cutoffDay: li.cutoffDay,
        dueDay,
        isSettled: settlement.isSettled,
        isAutoSettled: settlement.isAutoSettled,
        settlementState,
        dueDateIso: settlement.dueDateIso,
        parentContractId: li.parentContractId,
        notes: stripAllSettlementMarkers(li.notes),
      };
      evaluatedLineItems.push(dto);
      lineItemsPerMonth[k].push(dto);
    }

    // 4. Build section rows
    const payLaterCells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    > = {};
    const personalDebtCells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    > = {};
    const creditCardCells: Record<
      string,
      { amount: number; items?: LiabilityMatrixCardItem[] }
    > = {};
    const totalsPerMonth: Record<string, number> = {};
    const settlementSummaryPerMonth: Record<
      string,
      {
        totalDue: number;
        paidAmount: number;
        reservedAmount: number;
        unpaidAmount: number;
        bankHoldNeeded: number;
      }
    > = {};

    for (const col of columns) {
      totalsPerMonth[col.key] = 0;

      const b = bulkBillMap.get(col.key);
      const paylaterAmt = b?.paylaterAmount ?? 0;
      const personalDebtAmt = b?.personalDebtAmount ?? 0;
      const monthItems = lineItemsPerMonth[col.key] ?? [];

      payLaterCells[col.key] = {
        bulkBillId: b?.id,
        amount: paylaterAmt,
        items: monthItems.filter(
          (i) => i.category === LiabilityCategory.PAYLATER,
        ),
      };
      personalDebtCells[col.key] = {
        bulkBillId: b?.id,
        amount: personalDebtAmt,
        items: monthItems.filter(
          (i) =>
            i.category === LiabilityCategory.PERSONAL_DEBT ||
            i.category === LiabilityCategory.P1_VAULT_REFUND,
        ),
      };
      totalsPerMonth[col.key] += paylaterAmt + personalDebtAmt;

      let ccDue = 0;
      const ccItems: LiabilityMatrixCardItem[] = [];
      for (const card of activeCards) {
        const cardDue = calculateCardDueAmountForMonth(
          card,
          col.month,
          col.year,
        );
        if (cardDue > 0) {
          ccDue += cardDue;
          const prog = calculateCardInstallmentProgress(
            card,
            col.month,
            col.year,
          );
          const endedAtLabel =
            card.endedAtMonth != null && card.endedAtYear != null
              ? `${MONTH_NAMES[card.endedAtMonth - 1] ?? card.endedAtMonth} ${card.endedAtYear}`
              : null;
          const ccSettlement = evaluateObligationSettlement({
            periodMonth: col.month,
            periodYear: col.year,
            dueDay: ccDueDay,
            dbIsSettled: card.status === CreditCardStatus.SETTLED,
            notes: card.notes,
            periodScope: `${col.year}-${col.month}`,
          });
          const ccState = resolveBillSettlementState({
            isSettled: ccSettlement.isSettled,
            notes: card.notes,
            periodScope: `${col.year}-${col.month}`,
          });
          ccItems.push({
            id: card.id,
            label: card.label,
            chargeType: card.chargeType,
            amount: Math.round(cardDue),
            sliceBadge: prog.isInstallment ? prog.badgeLabel : null,
            endedAtLabel,
            isSettled: ccSettlement.isSettled,
            isAutoSettled: ccSettlement.isAutoSettled,
            settlementState: ccState,
            dueDateIso: ccSettlement.dueDateIso,
          });
        }
      }

      creditCardCells[col.key] = { amount: Math.round(ccDue), items: ccItems };
      totalsPerMonth[col.key] += Math.round(ccDue);

      // Compute 3-state settlement breakdown (PAID / RESERVED / UNPAID) for Bank Reservation vs Free Cash
      let paidAmount = 0;
      let reservedAmount = 0;
      let unpaidAmount = 0;
      for (const li of monthItems) {
        const amt = Math.round(li.monthlyAmount);
        if (li.settlementState === 'PAID') paidAmount += amt;
        else if (li.settlementState === 'RESERVED') reservedAmount += amt;
        else unpaidAmount += amt;
      }
      // If a column has a MonthlyBulkBill without line items (legacy lump-sum), treat remaining diff appropriately
      const lineItemsTotal = paidAmount + reservedAmount + unpaidAmount;
      const bulkNonCcTotal = paylaterAmt + personalDebtAmt;
      if (bulkNonCcTotal > lineItemsTotal) {
        unpaidAmount += bulkNonCcTotal - lineItemsTotal;
      }
      for (const cc of ccItems) {
        const amt = Math.round(cc.amount);
        if (cc.settlementState === 'PAID') paidAmount += amt;
        else if (cc.settlementState === 'RESERVED') reservedAmount += amt;
        else unpaidAmount += amt;
      }
      const totalDue = paidAmount + reservedAmount + unpaidAmount;
      settlementSummaryPerMonth[col.key] = {
        totalDue,
        paidAmount,
        reservedAmount,
        unpaidAmount,
        bankHoldNeeded: reservedAmount + unpaidAmount,
      };
    }

    // 5. Synthesize Active Installment Plans (zero double-counting!)
    const activeInstallmentPlans: ActiveInstallmentPlanDto[] = [];

    // 5a. Named multi-month LiabilityLineItem installment plans (strictly tenorMonths > 1, excludes 1/1 charges & P1_VAULT_REFUND)
    const groupedLineContracts = new Map<string, LiabilityLineItemDto[]>();
    for (const li of evaluatedLineItems) {
      if (
        !li.parentContractId ||
        li.parentContractId === 'PL-BASE-2026' ||
        li.tenorMonths <= 1 ||
        li.category === 'P1_VAULT_REFUND'
      ) {
        continue;
      }
      if (!groupedLineContracts.has(li.parentContractId)) {
        groupedLineContracts.set(li.parentContractId, []);
      }
      groupedLineContracts.get(li.parentContractId)!.push(li);
    }

    for (const [contractId, items] of groupedLineContracts.entries()) {
      const sorted = [...items].sort(
        (a, b) => a.year * 12 + a.month - (b.year * 12 + b.month),
      );
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalTenor = Math.max(first.tenorMonths, sorted.length);
      if (totalTenor <= 1) continue;
      const cells: Record<string, { amount: number; sliceBadge?: string }> = {};
      for (const col of columns) {
        const match = sorted.find(
          (i) => i.year === col.year && i.month === col.month,
        );
        cells[col.key] = match
          ? {
              amount: Math.round(match.monthlyAmount),
              sliceBadge: `${match.installmentIndex}/${match.tenorMonths}`,
            }
          : { amount: 0 };
      }

      const unsettled = sorted.filter((i) => !i.isSettled);
      const remainingPrincipal = unsettled.reduce(
        (s, i) => s + Math.round(i.monthlyAmount),
        0,
      );
      const baseTitle = first.title
        .replace(/\s*\(\d+\/\d+.*?\)\s*/g, '')
        .replace(/\s*\(2\/3.*?\)\s*/g, '')
        .trim();

      activeInstallmentPlans.push({
        id: `li-${contractId}`,
        source: 'LINE_ITEM',
        category: first.category,
        title: baseTitle || first.title,
        merchantOrPlatform: first.merchantOrPlatform,
        principalAmount: Math.round(first.principalAmount || remainingPrincipal),
        monthlyInstallment: Math.round(first.monthlyAmount),
        totalTenor,
        remainingPrincipal,
        payoffMonth: last.month,
        payoffYear: last.year,
        payoffDateLabel: `${MONTH_NAMES[last.month - 1]} ${last.year}`,
        parentContractId: contractId,
        canAccelerate: unsettled.length > 1,
        canSettleEarly: false,
        isIncludedInMatrixRows: true,
        cells,
      });
    }

    // 5b. Multi-month CreditCardTransaction installments
    const currentPeriod = getPayrollPeriodForDate();
    const refMonth = currentPeriod.month;
    const refYear = currentPeriod.year;
    for (const card of activeCards) {
      if (card.chargeType !== CreditCardChargeType.INSTALLMENT) continue;
      const prog = calculateCardInstallmentProgress(card, refMonth, refYear);
      const cells: Record<string, { amount: number; sliceBadge?: string }> = {};
      for (const col of columns) {
        const due = Math.round(
          calculateCardDueAmountForMonth(card, col.month, col.year),
        );
        const colProg = calculateCardInstallmentProgress(
          card,
          col.month,
          col.year,
        );
        cells[col.key] = {
          amount: due,
          sliceBadge: due > 0 ? (colProg.badgeLabel ?? undefined) : undefined,
        };
      }
      const startIndex = card.billingYear * 12 + (card.billingMonth - 1);
      const endIndex = startIndex + Math.max(1, card.tenor || 1) - 1;
      const payoffYear = Math.floor(endIndex / 12);
      const payoffMonth = (endIndex % 12) + 1;

      activeInstallmentPlans.push({
        id: `cc-${card.id}`,
        source: 'CC_TRANSACTION',
        category: 'CREDIT_CARD',
        title: card.label,
        merchantOrPlatform: 'Bank Permata Credit Card',
        principalAmount: Math.round(card.totalAmount ?? card.amount),
        monthlyInstallment: Math.round(
          card.monthlyAmount ?? card.amount / Math.max(1, card.tenor || 1),
        ),
        totalTenor: card.tenor || 1,
        remainingPrincipal: prog.remainingPrincipalIncludingTarget,
        payoffMonth,
        payoffYear,
        payoffDateLabel: `${MONTH_NAMES[payoffMonth - 1]} ${payoffYear}`,
        cardId: card.id,
        canAccelerate: false,
        canSettleEarly: card.status === CreditCardStatus.ACTIVE,
        isIncludedInMatrixRows: true,
        cells,
      });
    }

    // 5c. Standalone CreditContract rows (if any exist — these are NOT inside bulk/CC)
    const standaloneContractRows = activeContracts.map((c) => {
      const cells: Record<string, { amount: number; sliceBadge?: string }> = {};
      const startIndex = c.startYear * 12 + (c.startMonth - 1);
      const endIndex = startIndex + c.totalTenor - 1;

      for (const col of columns) {
        const colIndex = col.year * 12 + (col.month - 1);
        const isContractActive = colIndex >= startIndex && colIndex <= endIndex;
        const amount = isContractActive ? c.monthlyInstallment : 0;
        const sliceNum = isContractActive ? colIndex - startIndex + 1 : undefined;
        cells[col.key] = {
          amount,
          sliceBadge:
            sliceNum !== undefined ? `${sliceNum}/${c.totalTenor}` : undefined,
        };
        totalsPerMonth[col.key] += amount;
      }

      const payoffYear = Math.floor(endIndex / 12);
      const payoffMonth = (endIndex % 12) + 1;

      const plan: ActiveInstallmentPlanDto = {
        id: `contract-${c.id}`,
        source: 'CREDIT_CONTRACT',
        category: 'CONTRACT',
        title: c.label,
        merchantOrPlatform: 'Contract',
        principalAmount: Math.round(c.principalAmount),
        monthlyInstallment: Math.round(c.monthlyInstallment),
        totalTenor: c.totalTenor,
        remainingPrincipal: Math.round(c.remainingTenor * c.monthlyInstallment),
        payoffMonth,
        payoffYear,
        payoffDateLabel: `${MONTH_NAMES[payoffMonth - 1]} ${payoffYear}`,
        canAccelerate: false,
        canSettleEarly: false,
        isIncludedInMatrixRows: false,
        cells,
      };
      activeInstallmentPlans.push(plan);

      return {
        id: c.id,
        label: c.label,
        monthlyInstallment: c.monthlyInstallment,
        source: 'CREDIT_CONTRACT' as const,
        totalTenor: c.totalTenor,
        principalAmount: Math.round(c.principalAmount),
        remainingPrincipal: Math.round(c.remainingTenor * c.monthlyInstallment),
        payoffDateLabel: plan.payoffDateLabel,
        isIncludedInMatrixRows: false,
        cells,
      };
    });

    const contractRows = [
      ...standaloneContractRows,
      ...activeInstallmentPlans
        .filter((p) => p.isIncludedInMatrixRows)
        .map((p) => ({
          id: p.id,
          label: p.title,
          monthlyInstallment: p.monthlyInstallment,
          source: p.source,
          category: p.category,
          merchantOrPlatform: p.merchantOrPlatform,
          totalTenor: p.totalTenor,
          principalAmount: p.principalAmount,
          remainingPrincipal: p.remainingPrincipal,
          payoffDateLabel: p.payoffDateLabel,
          parentContractId: p.parentContractId,
          cardId: p.cardId,
          canAccelerate: p.canAccelerate,
          canSettleEarly: p.canSettleEarly,
          isIncludedInMatrixRows: true,
          cells: p.cells,
        })),
    ];

    return {
      columns,
      payLaterRow: {
        label: 'PayLater Bills',
        dueDay: SPAYLATER_DUE_DAY,
        cells: payLaterCells,
      },
      creditCardRow: {
        label: 'Credit Card Balance',
        dueDay: ccDueDay,
        cells: creditCardCells,
      },
      personalDebtRow: {
        label: 'Personal & Informal Debt',
        cells: personalDebtCells,
      },
      contractRows,
      activeInstallmentPlans,
      lineItemsPerMonth,
      totalsPerMonth,
      settlementSummaryPerMonth,
    };
  }

  /**
   * Read-only calculation of per-period credit usage limits and safe/optimal ceilings.
   * Strictly read-only: NEVER creates or mutates a MonthlySnapshot row if one does not exist.
   */
  async getCreditUsageLimit(
    month: number,
    year: number,
    userId: number = 1,
  ): Promise<CreditLimitCalculationResult> {
    const [config, snapshot, bulkBills, activeCards, activeContracts] =
      await Promise.all([
        (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
          (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } })),
        this.prisma.monthlySnapshot.findUnique({
          where: { userId_month_year: { userId, month, year } },
          include: {
            transactions: true,
            budgetRevisions: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
          },
        }),
        this.prisma.monthlyBulkBill.findMany({
          where: { userId, month, year },
        }),
        this.prisma.creditCardTransaction.findMany({
          where: {
            userId,
            status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
          },
        }),
        userId === 1
          ? this.prisma.creditContract.findMany({
              where: { isActive: true },
            })
          : Promise.resolve([]),
      ]);

    const bankCreditLimit = config?.creditLimit ?? 7_000_000;

    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const dueYM = addHybridMonths(month, year, 1);

    // 1. Resolve period income & planned waterfall targets without mutating DB
    let isSnapshotPersisted = false;
    let snapshotStatus: 'DRAFT' | 'LOCKED' | 'UNINITIALIZED' = 'UNINITIALIZED';
    let totalIncome = 0;
    let dailyOperationalTarget = config?.dailyOperational ?? 0;
    let fixedExpenses =
      (config?.transport ?? 0) +
      (config?.internet ?? 0) +
      (config?.vape ?? 0) +
      (config?.haircut ?? 0);
    let bufferPocket = 0;
    let savingsTarget = config?.baseSavings ?? 0;
    let ccUsageLimit = config?.ccUsageLimit ?? 0;
    let paylaterUsageLimit = config?.paylaterUsageLimit ?? 0;
    let manualDeductions = 0;

    if (snapshot) {
      isSnapshotPersisted = true;
      snapshotStatus =
        snapshot.status === SnapshotStatus.LOCKED ? 'LOCKED' : 'DRAFT';
      const revList = Array.isArray(snapshot.budgetRevisions)
        ? [...snapshot.budgetRevisions].reverse()
        : [];
      const dailyRev = revList.find(
        (r) =>
          r.category === 'DAILY_OPERATIONAL' ||
          r.bucketKey?.toLowerCase() === 'daily_operational',
      );
      dailyOperationalTarget = dailyRev
        ? dailyRev.newValue
        : snapshot.dailyOperational;
      fixedExpenses =
        snapshot.transport +
        snapshot.internet +
        snapshot.vape +
        snapshot.haircut;
      bufferPocket = snapshot.bufferPocket;
      savingsTarget =
        snapshot.actualSavings !== null && snapshot.actualSavings !== undefined
          ? snapshot.actualSavings
          : snapshot.savings;
      ccUsageLimit = snapshot.ccUsageLimit;
      paylaterUsageLimit = snapshot.paylaterUsageLimit;

      manualDeductions = snapshot.transactions
        .filter((t) => t.type === TransactionType.DEDUCTION)
        .reduce((sum, t) => sum + t.amount, 0);

      if (snapshot.finalTotalIncome && snapshot.finalTotalIncome > 0) {
        totalIncome = snapshot.finalTotalIncome;
      } else if (snapshot.netSalaryIncome && snapshot.netSalaryIncome > 0) {
        totalIncome = snapshot.netSalaryIncome;
      }
    }

    if (totalIncome <= 0 && config) {
      const baselinePayroll = calculatePayroll({
        baseSalary: config.baseSalary,
        totalWorkingDays: 20,
        dailyAllowance: config.dailyAllowance,
        laptopAllowance: config.laptopAllowance,
      });
      totalIncome = baselinePayroll.finalTotalIncome;
    }

    // 2. Resolve period liabilities (frozen transactions if LOCKED, live schedule if DRAFT/UNINITIALIZED)
    const currentPaylaterUsage = bulkBills.reduce(
      (sum, b) => sum + (b.paylaterAmount ?? 0),
      0,
    );
    const personalDebtAmount = bulkBills.reduce(
      (sum, b) => sum + (b.personalDebtAmount ?? 0),
      0,
    );

    let currentCcUsage = 0;
    let contractInstallments = 0;

    if (snapshot && snapshot.status === SnapshotStatus.LOCKED) {
      const materializedCc = snapshot.transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CC_TRANSACTION,
        )
        .reduce((sum, t) => sum + t.amount, 0);

      if (materializedCc > 0 || snapshot.transactions.length > 0) {
        currentCcUsage = materializedCc;
      } else {
        for (const card of activeCards) {
          currentCcUsage += Math.round(
            calculateCardDueAmountForMonth(card, month, year),
          );
        }
      }

      contractInstallments = snapshot.transactions
        .filter(
          (t) =>
            t.type === TransactionType.CREDIT_BILL &&
            t.sourceType === TransactionSourceType.CONTRACT,
        )
        .reduce((sum, t) => sum + t.amount, 0);
    } else {
      for (const card of activeCards) {
        currentCcUsage += Math.round(
          calculateCardDueAmountForMonth(card, month, year),
        );
      }

      const targetIndex = year * 12 + (month - 1);
      for (const c of activeContracts) {
        if (c.remainingTenor <= 0) continue;
        const startIndex = c.startYear * 12 + (c.startMonth - 1);
        const endIndex = startIndex + c.totalTenor - 1;
        if (targetIndex >= startIndex && targetIndex <= endIndex) {
          contractInstallments += c.monthlyInstallment;
        }
      }
    }

    const optPct = (config?.financialPolicyJson as any)?.optimalDebtRatioPercent ?? 20;
    const safePct = (config?.financialPolicyJson as any)?.maxSafeDebtRatioPercent ?? 35;

    const formulaVars: Record<string, number> = {
      NET_INCOME: totalIncome,
      LIVING_BUDGET: dailyOperationalTarget,
      ROUTINE_BILLS: fixedExpenses,
      SPINJAM_DEBT: personalDebtAmount,
      OTHER_DEBT: contractInstallments + manualDeductions,
      PAYLATER_DEBT: currentPaylaterUsage,
      CC_DEBT: currentCcUsage,
      TOTAL_DEBT: currentPaylaterUsage + currentCcUsage + personalDebtAmount + contractInstallments,
      P1_FLOOR: studioConfig.paycycleFormulaConfig.p1TargetFloorRp,
      P1_SAVINGS: savingsTarget,
      OPTIMAL_DSR_PCT: optPct,
      MAX_SAFE_DSR_PCT: safePct,
    };

    const safeEval = evaluateFormulaDslTs(
      studioConfig.paycycleFormulaConfig.formulas.debtSafeCeilingFormula,
      formulaVars,
    );
    const cashflowBeforeDeficit = Math.max(
      0,
      totalIncome -
        (dailyOperationalTarget + fixedExpenses) -
        bufferPocket -
        (contractInstallments + personalDebtAmount) -
        manualDeductions,
    );
    const evaluatedSafeCeilingRp = safeEval.valid
      ? Math.max(0, safeEval.valueRp - bufferPocket)
      : cashflowBeforeDeficit;
    const evaluatedOptimalCeilingRp = Math.max(
      0,
      evaluatedSafeCeilingRp - savingsTarget,
    );

    return calculateCreditUsageLimit({
      month,
      year,
      maturityMonth: month,
      maturityYear: year,
      ccDueDay: config?.creditDueDay ?? CC_DUE_DAY,
      paylaterDueDay: SPAYLATER_DUE_DAY,
      isSnapshotPersisted,
      snapshotStatus,
      totalIncome,
      dailyOperationalTarget,
      fixedExpenses,
      bufferPocket,
      savingsTarget,
      manualDeductions,
      contractInstallments,
      personalDebtAmount,
      currentCcUsage,
      currentPaylaterUsage,
      bankCreditLimit,
      ccUsageLimit,
      paylaterUsageLimit,
      optimalDebtRatioPercent: optPct,
      maxSafeDebtRatioPercent: safePct,
      evaluatedSafeCeilingRp,
      evaluatedOptimalCeilingRp,
    });
  }

  /**
   * Retrieves all subscription kill-switch items with real-time alert evaluation.
   */
  async getKillSwitches(userId: number = 1): Promise<KillSwitchResponse> {
    const config = await this.prisma.globalConfig.findFirst({
      where: { userId },
    });
    const killSwitchLeadDays = config?.killSwitchLeadDays ?? 14;
    const killSwitchBannerEnabled = config?.killSwitchBannerEnabled ?? true;

    const cards = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        OR: [
          { isRecurring: true },
          { killSwitchEnabled: true },
          { chargeType: CreditCardChargeType.RECURRING },
          { promoEndDate: { not: null } },
        ],
      },
      orderBy: [
        { promoEndDate: 'asc' },
        { id: 'asc' },
      ],
    });

    const jktNow = getJakartaDateParts();
    const utcNow = Date.UTC(jktNow.year, jktNow.month - 1, jktNow.day);

    const items: KillSwitchItem[] = cards.map((c) => {
      let daysUntilExpiry: number | null = null;
      if (c.promoEndDate) {
        const promoDate = new Date(c.promoEndDate);
        const utcPromo = Date.UTC(
          promoDate.getUTCFullYear(),
          promoDate.getUTCMonth(),
          promoDate.getUTCDate(),
        );
        daysUntilExpiry = Math.round((utcPromo - utcNow) / (1000 * 60 * 60 * 24));
      }

      const postPromo = c.postPromoNormalAmount ?? 0;
      const monthlyPenaltyDelta = Math.max(0, postPromo - c.amount);

      let alertState: 'SILENT' | 'ACTION_REQUIRED' | 'CONFIRMED_SAFE' = 'SILENT';
      let statusLabel: 'ARMED' | 'CRITICAL' | 'SAFE' | 'INACTIVE' = 'ARMED';

      if (c.providerCancelConfirmed) {
        statusLabel = 'SAFE';
        alertState = 'CONFIRMED_SAFE';
      } else if (!c.isActive) {
        statusLabel = 'INACTIVE';
        alertState = 'SILENT';
      } else if (
        c.killSwitchEnabled &&
        daysUntilExpiry !== null &&
        daysUntilExpiry <= killSwitchLeadDays
      ) {
        statusLabel = 'CRITICAL';
        alertState = 'ACTION_REQUIRED';
      } else {
        statusLabel = 'ARMED';
        alertState = 'SILENT';
      }

      return {
        id: c.id,
        userId: c.userId,
        label: c.label,
        amount: c.amount,
        promoLabel: c.promoLabel,
        promoEndDate: c.promoEndDate ? c.promoEndDate.toISOString() : null,
        postPromoNormalAmount: c.postPromoNormalAmount,
        killSwitchEnabled: c.killSwitchEnabled,
        providerCancelUrl: c.providerCancelUrl,
        providerCancelConfirmed: c.providerCancelConfirmed,
        isRecurring: c.isRecurring,
        isActive: c.isActive,
        stoppedAtMonth: c.stoppedAtMonth,
        stoppedAtYear: c.stoppedAtYear,
        daysUntilExpiry,
        monthlyPenaltyDelta,
        alertState,
        statusLabel,
        lastKillSwitchNotifiedAt: c.lastKillSwitchNotifiedAt
          ? c.lastKillSwitchNotifiedAt.toISOString()
          : null,
      };
    });

    return {
      config: {
        killSwitchLeadDays,
        killSwitchBannerEnabled,
      },
      items,
    };
  }

  /**
   * Retrieves the external reminder notification configuration for the user.
   */
  async getKillSwitchNotificationConfig(
    userId: number = 1,
  ): Promise<KillSwitchNotificationConfigResponse> {
    const [config, user] = await Promise.all([
      this.prisma.globalConfig.findFirst({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);

    return {
      profileEmail: user?.email?.trim() || null,
      killSwitchNotifyEmail: user?.email?.trim() || config?.killSwitchNotifyEmail || null,
      killSwitchSmtpUser: config?.killSwitchSmtpUser ?? null,
      hasSmtpPassword: !!config?.killSwitchSmtpAppPassword,
      killSwitchWebhookUrl: config?.killSwitchWebhookUrl ?? null,
      killSwitchWaPhone: config?.killSwitchWaPhone ?? null,
      hasWaApiKey: !!config?.killSwitchWaApiKey,
      killSwitchCustomMessageTemplate:
        config?.killSwitchCustomMessageTemplate ?? null,
    };
  }
}
