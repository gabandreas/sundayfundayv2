import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreditContract,
  CreditCardTransaction,
  MonthlyBulkBill,
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
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
  CardInstallmentProgress,
} from './credit.utils';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';

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
  killSwitchNotifyEmail: string | null;
  killSwitchSmtpUser: string | null;
  hasSmtpPassword: boolean;
  killSwitchWebhookUrl: string | null;
  killSwitchWaPhone: string | null;
  hasWaApiKey: boolean;
  killSwitchCustomMessageTemplate: string | null;
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
    cells: Record<string, { bulkBillId?: number; amount: number }>;
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
    cells: Record<string, { bulkBillId?: number; amount: number }>;
  };
  contractRows: Array<{
    id: number;
    label: string;
    monthlyInstallment: number;
    cells: Record<string, { amount: number; sliceBadge?: string }>;
  }>;
  totalsPerMonth: Record<string, number>;
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
    if (userId === 2) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      const sandbox =
        (config?.sandboxStateJson as any) ||
        buildDefaultSandboxState(month, year);
      return (sandbox.creditItems || []).map((c: any) => ({
        id: c.id,
        label: c.label,
        amount: c.amount,
        monthlyAmount: c.monthlyAmount,
        totalAmount: c.amount,
        tenor: c.tenor ?? 1,
        remainingTenor: c.tenor ? Math.max(1, c.tenor - 3) : 1,
        billingMonth: month || 10,
        billingYear: year || 2026,
        transactionDate: new Date('2026-10-01'),
        chargeType: c.chargeType as any,
        status: c.status as any,
        cardName: c.cardName || 'Corporate Platinum Visa',
        bankName: c.bankName || 'BCA',
        note: 'Commercial sandbox demo item',
        createdAt: new Date(),
        updatedAt: new Date(),
        dueInPeriod: c.monthlyAmount,
        endedAtLabel: null,
        endedAtMonth: null,
        endedAtYear: null,
        isActive: true,
        stoppedAtMonth: null,
        stoppedAtYear: null,
        installmentProgress: {
          totalTenor: c.tenor ?? 1,
          currentTenor: c.tenor ? 4 : 1,
          monthsElapsed: c.tenor ? 3 : 0,
          monthsRemaining: c.tenor ? c.tenor - 4 : 0,
          monthlyInstallmentAmount: c.monthlyAmount,
          totalPrincipalAmount: c.amount,
          remainingPrincipal: c.tenor ? c.monthlyAmount * (c.tenor - 3) : 0,
          progressPercent: c.tenor ? 33 : 100,
          isCompleted: false,
        },
      }));
    }

    const rows = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        ...(month !== undefined ? { billingMonth: month } : {}),
        ...(year !== undefined ? { billingYear: year } : {}),
      },
      orderBy: { transactionDate: 'desc' },
    });

    const targetMonth = contextMonth ?? month ?? new Date().getMonth() + 1;
    const targetYear = contextYear ?? year ?? new Date().getFullYear();

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
    if (userId === 2) {
      return {
        creditLimit: 20_000_000,
        statementCutoffDay: 20,
        paymentDueDay: 11,
        currentCycleDue: 1_305_000,
        totalOutstandingBalance: 15_055_000,
        utilizationPercent: 6.5,
      };
    }

    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));

    const creditLimit = config?.creditLimit ?? 7_000_000;
    const statementCutoffDay = config?.creditStatementDay ?? 20;
    const paymentDueDay = config?.creditDueDay ?? 11;

    const cards = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
      },
    });

    const targetMonth = month ?? new Date().getMonth() + 1;
    const targetYear = year ?? new Date().getFullYear();

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
    if (userId !== 1) {
      const config = await this.prisma.globalConfig.findFirst({
        where: { userId },
      });
      if (userId === 2 || config?.profileMode === 'STANDARD_GENERAL') {
        return [];
      }
    }

    return this.prisma.monthlyBulkBill.findMany({
      where: {
        userId,
        ...(month !== undefined ? { month } : {}),
        ...(year !== undefined ? { year } : {}),
      },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
  }

  async getLiabilityMatrix(
    startMonth = 7,
    startYear = 2026,
    count = 12,
    userId = 1,
  ): Promise<LiabilityMatrixResponse> {
    // 1. Build 12 columns
    const columns: LiabilityMatrixColumn[] = [];
    for (let i = 0; i < count; i++) {
      const totalMonths = startYear * 12 + (startMonth - 1) + i;
      const colYear = Math.floor(totalMonths / 12);
      const colMonth = (totalMonths % 12) + 1;
      columns.push({
        month: colMonth,
        year: colYear,
        key: `${colYear}-${colMonth}`,
        label: `${MONTH_NAMES[colMonth - 1]} '${String(colYear).slice(2)}`,
      });
    }

    // 2. Fetch all bulk bills
    const allBulkBills = await this.prisma.monthlyBulkBill.findMany({
      where: { userId },
    });
    const bulkBillMap = new Map<string, MonthlyBulkBill>();
    for (const b of allBulkBills) {
      bulkBillMap.set(`${b.year}-${b.month}`, b);
    }

    // 3. Fetch all active credit contracts
    const activeContracts = await this.prisma.creditContract.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });

    // 4. Fetch all active or settled credit card transactions
    const activeCards = await this.prisma.creditCardTransaction.findMany({
      where: {
        userId,
        status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
      },
    });

    // 5. Build section rows
    const payLaterCells: Record<string, { bulkBillId?: number; amount: number }> = {};
    const personalDebtCells: Record<string, { bulkBillId?: number; amount: number }> = {};
    const creditCardCells: Record<
      string,
      { amount: number; items?: LiabilityMatrixCardItem[] }
    > = {};
    const totalsPerMonth: Record<string, number> = {};

    for (const col of columns) {
      totalsPerMonth[col.key] = 0;

      // PayLater & Personal Debt from MonthlyBulkBill
      const b = bulkBillMap.get(col.key);
      const paylaterAmt = b?.paylaterAmount ?? 0;
      const personalDebtAmt = b?.personalDebtAmount ?? 0;

      payLaterCells[col.key] = { bulkBillId: b?.id, amount: paylaterAmt };
      personalDebtCells[col.key] = { bulkBillId: b?.id, amount: personalDebtAmt };
      totalsPerMonth[col.key] += paylaterAmt + personalDebtAmt;

      // Credit Card due amount in col (month, year)
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
          ccItems.push({
            id: card.id,
            label: card.label,
            chargeType: card.chargeType,
            amount: Math.round(cardDue),
            sliceBadge: prog.isInstallment ? prog.badgeLabel : null,
            endedAtLabel,
          });
        }
      }

      creditCardCells[col.key] = { amount: Math.round(ccDue), items: ccItems };
      totalsPerMonth[col.key] += Math.round(ccDue);
    }

    // Contract rows
    const contractRows = activeContracts.map((c) => {
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
          sliceBadge: sliceNum !== undefined ? `${sliceNum}/${c.totalTenor}` : undefined,
        };
        totalsPerMonth[col.key] += amount;
      }

      return {
        id: c.id,
        label: c.label,
        monthlyInstallment: c.monthlyInstallment,
        cells,
      };
    });

    return {
      columns,
      payLaterRow: {
        label: 'PayLater Bills',
        dueDay: 25,
        cells: payLaterCells,
      },
      creditCardRow: {
        label: 'Credit Card Balance',
        dueDay: 11,
        cells: creditCardCells,
      },
      personalDebtRow: {
        label: 'Personal & Informal Debt',
        cells: personalDebtCells,
      },
      contractRows,
      totalsPerMonth,
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
          include: { transactions: true },
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
        this.prisma.creditContract.findMany({
          where: { isActive: true },
        }),
      ]);

    const bankCreditLimit = config?.creditLimit ?? 7_000_000;

    // 1. Resolve period income & waterfall targets without mutating DB
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
      dailyOperationalTarget = snapshot.dailyOperational;
      fixedExpenses =
        snapshot.transport +
        snapshot.internet +
        snapshot.vape +
        snapshot.haircut;
      bufferPocket = snapshot.bufferPocket;
      savingsTarget = snapshot.savings;
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

    return calculateCreditUsageLimit({
      month,
      year,
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
      optimalDebtRatioPercent: (config?.financialPolicyJson as any)?.optimalDebtRatioPercent,
      maxSafeDebtRatioPercent: (config?.financialPolicyJson as any)?.maxSafeDebtRatioPercent,
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

    const now = new Date();
    const utcNow = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

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
    const config = await this.prisma.globalConfig.findFirst({
      where: { userId },
    });

    return {
      killSwitchNotifyEmail: config?.killSwitchNotifyEmail ?? null,
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
