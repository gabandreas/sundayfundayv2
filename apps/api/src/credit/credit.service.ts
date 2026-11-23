import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import {
  Prisma,
  CreditContract,
  CreditCardTransaction,
  MonthlyBulkBill,
  LiabilityLineItem,
  LiabilityCategory,
  CreditCardChargeType,
  CreditCardStatus,
  SnapshotStatus,
  TransactionType,
  TransactionSourceType,
  AuditCategory,
  AuditSeverity,
  BudgetRevisionCategory,
} from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { CreateLiabilityLineItemDto } from './dto/create-liability-line-item.dto';
import { ShiftLiabilityLineItemDto } from './dto/shift-liability-line-item.dto';
import {
  CreateBridgeLoanDto,
  AccelerateBridgeLoanDto,
} from './dto/create-bridge-loan.dto';
import { CreateCreditContractDto } from './dto/create-credit-contract.dto';
import { UpdateCreditContractDto } from './dto/update-credit-contract.dto';
import { CreateCreditCardTransactionDto } from './dto/create-credit-card-transaction.dto';
import { UpdateCreditCardTransactionDto } from './dto/update-credit-card-transaction.dto';
import { SettleCardEarlyDto } from './dto/settle-card-early.dto';
import { CreateMonthlyBulkBillDto } from './dto/create-monthly-bulk-bill.dto';
import { UpdateMonthlyBulkBillDto } from './dto/update-monthly-bulk-bill.dto';
import { UpdateCreditUsageLimitDto } from './dto/update-credit-usage-limit.dto';
import { CreateKillSwitchDto } from './dto/create-kill-switch.dto';
import { UpdateKillSwitchDto } from './dto/update-kill-switch.dto';
import { UpdateKillSwitchNotificationConfigDto } from './dto/update-kill-switch-notification-config.dto';
import {
  buildKillSwitchEmailHtml,
  formatKillSwitchEmailSubject,
  formatKillSwitchReminderMessage,
} from './kill-switch-message';
import { ERP_NOTIFICATION_EMAIL } from '../calculator/pacing';
import {
  PLATFORM_EMAIL_FROM,
  PLATFORM_EMAIL_REPLY_TO,
  buildSmtpTransportConfig,
  normalizeSmtpAppPassword,
  sendSmtpMailWithFallback,
  verifySmtpConnection,
} from '../email/smtp-transport.util';
import { CreditSelectors } from './credit.selectors';
import { CreditLimitCalculationResult } from '../calculator/credit-limit';
import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
  DerivedBillSettlementState,
  evaluateObligationSettlement,
  getDefaultDueDayForCategory,
  setManualUnpaidMarker,
  setReservedMarker,
} from './credit.utils';
import {
  computeLosslessSlices,
  resolveCutoffDayForMonthTs,
  simulateCutoffTs,
} from '../calculator/hybrid-engine';
import { resolveStudioConfig } from '../config/studio.defaults';

export function formatBulkBillTransactionLabel(b: {
  label: string;
  paylaterAmount?: number;
  personalDebtAmount?: number;
  creditCardAmount?: number;
}): string {
  const baseLabel = b.label || 'Monthly Bulk Bill';
  const parts: string[] = [];
  if (b.paylaterAmount && b.paylaterAmount > 0) {
    parts.push(`PayLater Rp${b.paylaterAmount.toLocaleString('id-ID')}`);
  }
  if (b.personalDebtAmount && b.personalDebtAmount > 0) {
    parts.push(`Personal Rp${b.personalDebtAmount.toLocaleString('id-ID')}`);
  }
  if (b.creditCardAmount && b.creditCardAmount > 0) {
    parts.push(`CC Rp${b.creditCardAmount.toLocaleString('id-ID')}`);
  }

  if (parts.length > 1) {
    return `${baseLabel} (${parts.join(' + ')})`;
  } else if (parts.length === 1) {
    return `${baseLabel} (${parts[0]})`;
  }
  return baseLabel;
}

@Injectable()
export class CreditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SnapshotsSelectors))
    private readonly snapshotsSelectors: SnapshotsSelectors,
    @Inject(forwardRef(() => SnapshotsService))
    private readonly snapshotsService: SnapshotsService,
    private readonly auditLogService: AuditLogService,
    private readonly creditSelectors: CreditSelectors,
  ) {}

  // -------------------------------------------------------------------------
  // Billing Cycle Calculator (V1 §3.4 rule for CreditCardTransaction ONLY)
  // -------------------------------------------------------------------------

  calculateBillingCycle(
    transactionDate: Date | string,
    statementDay = 20,
  ): { billingMonth: number; billingYear: number } {
    const d =
      typeof transactionDate === 'string'
        ? new Date(transactionDate)
        : transactionDate;

    // Use UTC methods if ISO string with Z or parse parts to avoid timezone shift
    let txYear: number;
    let txMonth: number;
    let txDay: number;

    if (typeof transactionDate === 'string' && transactionDate.includes('-')) {
      const parts = transactionDate.split('T')[0].split('-');
      txYear = parseInt(parts[0], 10);
      txMonth = parseInt(parts[1], 10);
      txDay = parseInt(parts[2], 10);
    } else {
      txYear = d.getFullYear();
      txMonth = d.getMonth() + 1;
      txDay = d.getDate();
    }

    if (txDay <= statementDay) {
      // Paid from the SAME month's payroll
      return { billingMonth: txMonth, billingYear: txYear };
    } else {
      // Past cut-off: paid from the NEXT month's payroll
      if (txMonth === 12) {
        return { billingMonth: 1, billingYear: txYear + 1 };
      }
      return { billingMonth: txMonth + 1, billingYear: txYear };
    }
  }

  // -------------------------------------------------------------------------
  // CreditContract CRUD
  // -------------------------------------------------------------------------

  async createContract(
    dto: CreateCreditContractDto,
    userId: number = 1,
  ): Promise<CreditContract> {
    const created = await this.prisma.creditContract.create({
      data: {
        userId,
        label: dto.label,
        principalAmount: dto.principalAmount,
        monthlyInstallment: dto.monthlyInstallment,
        totalTenor: dto.totalTenor,
        remainingTenor: dto.totalTenor, // initialized to totalTenor, decremented only on closePeriod
        startMonth: dto.startMonth,
        startYear: dto.startYear,
        isActive: true,
      },
    });

    await this.auditLogService.record({
      userId,
      action: 'CREATE_CREDIT_CONTRACT',
      category: AuditCategory.LIABILITIES,
      summary: `Created credit contract "${created.label}"`,
      details: `Principal: Rp ${created.principalAmount}, Installment: Rp ${created.monthlyInstallment}, Tenor: ${created.totalTenor}`,
      month: created.startMonth,
      year: created.startYear,
      severity: AuditSeverity.INFO,
    });

    return created;
  }

  async updateContract(
    id: number,
    dto: UpdateCreditContractDto,
    userId: number = 1,
  ): Promise<CreditContract> {
    const existing = await this.prisma.creditContract.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`CreditContract #${id} not found`);
    }

    // remainingTenor is explicitly excluded from update payload
    const updated = await this.prisma.creditContract.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.principalAmount !== undefined
          ? { principalAmount: dto.principalAmount }
          : {}),
        ...(dto.monthlyInstallment !== undefined
          ? { monthlyInstallment: dto.monthlyInstallment }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditLogService.record({
      userId,
      action: 'UPDATE_CREDIT_CONTRACT',
      category: AuditCategory.LIABILITIES,
      summary: `Updated credit contract "${updated.label}" (#${id})`,
      details: JSON.stringify(dto),
      month: updated.startMonth,
      year: updated.startYear,
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  async deleteContract(
    id: number,
    userId: number = 1,
  ): Promise<CreditContract> {
    const existing = await this.prisma.creditContract.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      throw new NotFoundException(`CreditContract #${id} not found`);
    }
    const deleted = await this.prisma.creditContract.delete({ where: { id } });

    await this.auditLogService.record({
      userId,
      action: 'DELETE_CREDIT_CONTRACT',
      category: AuditCategory.LIABILITIES,
      summary: `Deleted credit contract "${existing.label}" (#${id})`,
      details: null,
      month: existing.startMonth,
      year: existing.startYear,
      severity: AuditSeverity.INFO,
    });

    return deleted;
  }

  // -------------------------------------------------------------------------
  // CreditCardTransaction CRUD
  // -------------------------------------------------------------------------
  // CreditCardTransaction CRUD
  // -------------------------------------------------------------------------

  async createCardTransaction(
    dto: CreateCreditCardTransactionDto,
    userId: number = 1,
  ): Promise<CreditCardTransaction> {
    const config = await this.prisma.globalConfig.findFirst({ where: { userId } });
    const studioConfig = resolveStudioConfig(userId, config?.formulaParamsJson, config);
    const ccInst = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type === 'CREDIT_CARD',
    );
    const parsedDate = String(dto.transactionDate || '').split('T')[0].split('-');
    const txY = Number(parsedDate[0]) || new Date().getFullYear();
    const txM = Number(parsedDate[1]) || new Date().getMonth() + 1;
    const txD = Number(parsedDate[2]) || new Date().getDate();
    const fallbackStatementDay = ccInst?.cutoffDay ?? config?.creditStatementDay ?? 25;
    const statementDay = resolveCutoffDayForMonthTs(
      ccInst?.cutoffFormula,
      fallbackStatementDay,
      txD,
      txM,
      txY,
      ccInst?.dueDay ?? config?.creditDueDay ?? 11,
      studioConfig.paycycleFormulaConfig.paydayAnchorDay,
    ).cutoffDay;

    const computedCycle = this.calculateBillingCycle(
      dto.transactionDate,
      statementDay,
    );
    const billingMonth = dto.billingMonth ?? computedCycle.billingMonth;
    const billingYear = dto.billingYear ?? computedCycle.billingYear;

    // Locked guard: check if the target billing period snapshot is locked
    const targetSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: billingMonth, year: billingYear } },
    });
    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target billing period (${billingMonth}/${billingYear}) is locked and cannot receive new credit card charges`,
      );
    }

    const chargeType = dto.chargeType ?? CreditCardChargeType.FULL;
    const tenor = dto.tenor ?? 1;

    let totalAmount = dto.totalAmount;
    let monthlyAmount = dto.monthlyAmount;

    if (chargeType === CreditCardChargeType.INSTALLMENT) {
      totalAmount = dto.totalAmount ?? dto.amount;
      monthlyAmount = dto.monthlyAmount ?? dto.amount / tenor;
    }

    const isRecurring =
      dto.isRecurring ?? (chargeType === CreditCardChargeType.RECURRING);

    const created = await this.prisma.creditCardTransaction.create({
      data: {
        userId,
        label: dto.label,
        amount: dto.amount,
        totalAmount,
        monthlyAmount,
        chargeType,
        tenor,
        category: dto.category ?? 'Subscription',
        transactionDate: new Date(dto.transactionDate),
        billingMonth,
        billingYear,
        endedAtMonth: dto.endedAtMonth ?? null,
        endedAtYear: dto.endedAtYear ?? null,
        isRecurring,
        status: CreditCardStatus.ACTIVE,
        notes: dto.notes,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREATE_CARD_TRANSACTION',
      severity: AuditSeverity.INFO,
      month: billingMonth,
      year: billingYear,
      summary: `Logged CC charge "${created.label}" for Rp ${created.amount.toLocaleString()} (Billing cycle: ${billingMonth}/${billingYear})`,
    });

    if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(billingMonth, billingYear, undefined, userId);
    }

    if (
      chargeType === CreditCardChargeType.INSTALLMENT ||
      chargeType === CreditCardChargeType.RECURRING
    ) {
      await this.syncAffectedDraftSnapshotsForCard(
        created,
        billingMonth,
        billingYear,
        userId,
      );
    }

    await this.checkAndLogCreditLimitBreach(billingMonth, billingYear, 'CC', userId);

    return created;
  }

  async updateCardTransaction(
    id: number,
    dto: UpdateCreditCardTransactionDto,
    userId?: number,
  ): Promise<CreditCardTransaction> {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`CreditCardTransaction #${id} not found`);
    }
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot modify credit card transaction belonging to another workspace`);
    }

    if (
      dto.endedAtMonth !== undefined &&
      dto.endedAtMonth !== null &&
      dto.endedAtYear !== undefined &&
      dto.endedAtYear !== null
    ) {
      const startSerial = existing.billingYear * 12 + existing.billingMonth;
      const endSerial = dto.endedAtYear * 12 + dto.endedAtMonth;
      if (endSerial < startSerial) {
        throw new BadRequestException(
          `Subscription end period (${dto.endedAtMonth}/${dto.endedAtYear}) cannot be earlier than its start billing period (${existing.billingMonth}/${existing.billingYear})`,
        );
      }
    }

    const updated = await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.endedAtMonth !== undefined
          ? { endedAtMonth: dto.endedAtMonth }
          : {}),
        ...(dto.endedAtYear !== undefined
          ? { endedAtYear: dto.endedAtYear }
          : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'UPDATE_CARD_TRANSACTION',
      severity: AuditSeverity.INFO,
      month: updated.endedAtMonth ?? updated.billingMonth,
      year: updated.endedAtYear ?? updated.billingYear,
      summary:
        updated.endedAtMonth && updated.endedAtYear
          ? `Set effective end period ${updated.endedAtMonth}/${updated.endedAtYear} on CC charge "${updated.label}"`
          : `Updated CC charge "${updated.label}" (#${id})`,
      details: JSON.stringify(dto),
    });

    await this.syncAllDraftSnapshots(existing.userId);

    return updated;
  }

  async settleCardInstallmentEarly(
    id: number,
    dto: SettleCardEarlyDto,
    userId?: number,
  ) {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`CreditCardTransaction #${id} not found`);
    }
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot settle credit card installment belonging to another workspace`);
    }

    if (existing.chargeType !== CreditCardChargeType.INSTALLMENT) {
      throw new BadRequestException(
        `Only INSTALLMENT credit card charges can be settled early (got ${existing.chargeType})`,
      );
    }

    if (existing.status === CreditCardStatus.SETTLED) {
      throw new BadRequestException(
        `Credit card installment "${existing.label}" is already settled`,
      );
    }

    const settlementMode = dto.settlementMode ?? 'LUMP_SUM_CURRENT_PERIOD';
    const progress = calculateCardInstallmentProgress(
      existing,
      dto.month,
      dto.year,
    );

    if (progress.remainingSlicesIncludingTarget <= 0) {
      throw new BadRequestException(
        `Installment "${existing.label}" has no remaining slices to settle as of ${dto.month}/${dto.year}`,
      );
    }

    if (settlementMode === 'LUMP_SUM_CURRENT_PERIOD') {
      const targetSnapshot =
        await this.snapshotsSelectors.getOrCreateDraftSnapshot(
          dto.month,
          dto.year,
          existing.userId,
        );
      await this.snapshotsService.assertSnapshotUnlocked(targetSnapshot.id);
    }

    const updatedCard = await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        status: CreditCardStatus.SETTLED,
        endedAtMonth:
          settlementMode === 'LUMP_SUM_CURRENT_PERIOD' ? dto.month : null,
        endedAtYear:
          settlementMode === 'LUMP_SUM_CURRENT_PERIOD' ? dto.year : null,
        notes: dto.note
          ? `${existing.notes ? existing.notes + ' · ' : ''}${dto.note}`
          : existing.notes,
      },
    });

    await this.syncAllDraftSnapshots(existing.userId);

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'SETTLE_CC_INSTALLMENT_EARLY',
      severity: AuditSeverity.ADJUSTMENT,
      month: dto.month,
      year: dto.year,
      summary: `Early settlement on CC installment "${existing.label}" (${progress.badgeLabel}): ${settlementMode === 'LUMP_SUM_CURRENT_PERIOD' ? `Lump-sum payoff Rp ${progress.remainingPrincipalIncludingTarget.toLocaleString('id-ID')} materialized in ${dto.month}/${dto.year}` : 'Marked remaining slices settled'}`,
      details: JSON.stringify({
        cardId: id,
        settlementMode,
        month: dto.month,
        year: dto.year,
        settledSlices: progress.remainingSlicesIncludingTarget,
        settledPrincipal: progress.remainingPrincipalIncludingTarget,
      }),
    });

    return {
      card: updatedCard,
      settlementMode,
      settledAtPeriod: { month: dto.month, year: dto.year },
      settledSlices: progress.remainingSlicesIncludingTarget,
      lumpSumMaterialized:
        settlementMode === 'LUMP_SUM_CURRENT_PERIOD'
          ? progress.remainingPrincipalIncludingTarget
          : 0,
    };
  }

  async deleteCardTransaction(
    id: number,
    userId?: number,
  ): Promise<CreditCardTransaction> {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`CreditCardTransaction #${id} not found`);
    }
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot delete credit card transaction belonging to another workspace`);
    }

    const targetSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId: existing.userId,
          month: existing.billingMonth,
          year: existing.billingYear,
        },
      },
    });
    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target billing period (${existing.billingMonth}/${existing.billingYear}) is locked and charges cannot be deleted`,
      );
    }

    const deleted = await this.prisma.creditCardTransaction.delete({
      where: { id },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'DELETE_CARD_TRANSACTION',
      severity: AuditSeverity.INFO,
      month: existing.billingMonth,
      year: existing.billingYear,
      summary: `Deleted CC charge "${deleted.label}" of Rp ${deleted.amount.toLocaleString()}`,
    });

    if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(existing.billingMonth, existing.billingYear, undefined, existing.userId);
    }

    if (
      existing.chargeType === CreditCardChargeType.INSTALLMENT ||
      existing.chargeType === CreditCardChargeType.RECURRING
    ) {
      await this.syncAffectedDraftSnapshotsForCard(
        existing,
        existing.billingMonth,
        existing.billingYear,
        existing.userId,
      );
    }

    return deleted;
  }

  async stopRecurringSubscription(
    id: number,
    stopFromMonth: number,
    stopFromYear: number,
    userId?: number,
  ): Promise<CreditCardTransaction> {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Credit card transaction #${id} not found`);
    }
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot modify recurring subscription belonging to another workspace`);
    }

    if (
      existing.chargeType !== CreditCardChargeType.RECURRING &&
      !existing.isRecurring
    ) {
      throw new BadRequestException(
        `Transaction #${id} is not a recurring subscription charge`,
      );
    }

    const updated = await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        stoppedAtMonth: stopFromMonth,
        stoppedAtYear: stopFromYear,
        isActive: false,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREDIT_CARD_STOP_RECURRING',
      severity: AuditSeverity.INFO,
      month: stopFromMonth,
      year: stopFromYear,
      summary: `Stopped recurring subscription "${updated.label}" from ${stopFromMonth}/${stopFromYear} onward`,
      details: JSON.stringify({ id, stopFromMonth, stopFromYear }),
    });

    // Re-sync all DRAFT snapshots for this user from (stopFromMonth, stopFromYear) onward
    const stopSerial = stopFromYear * 12 + stopFromMonth;
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId: existing.userId, status: SnapshotStatus.DRAFT },
      select: { month: true, year: true },
    });

    for (const s of draftSnapshots) {
      const sSerial = s.year * 12 + s.month;
      if (sSerial >= stopSerial) {
        await this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, existing.userId);
      }
    }

    return updated;
  }

  async resumeRecurringSubscription(
    id: number,
    userId?: number,
  ): Promise<CreditCardTransaction> {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Credit card transaction #${id} not found`);
    }
    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot modify recurring subscription belonging to another workspace`);
    }

    const updated = await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        stoppedAtMonth: null,
        stoppedAtYear: null,
        isActive: true,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREDIT_CARD_RESUME_RECURRING',
      severity: AuditSeverity.INFO,
      month: existing.billingMonth,
      year: existing.billingYear,
      summary: `Resumed recurring subscription "${updated.label}"`,
      details: JSON.stringify({ id }),
    });

    // Re-sync all DRAFT snapshots for this user
    await this.syncAllDraftSnapshots(existing.userId);

    return updated;
  }

  // -------------------------------------------------------------------------
  // MonthlyBulkBill CRUD (PayLater & Personal Debt — cutoff does NOT apply)
  // -------------------------------------------------------------------------

  async createBulkBill(
    dto: CreateMonthlyBulkBillDto,
    userId: number = 1,
  ): Promise<MonthlyBulkBill> {
    const [targetSnapshot, existing] = await Promise.all([
      this.prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId, month: dto.month, year: dto.year } },
      }),
      this.prisma.monthlyBulkBill.findFirst({
        where: { userId, month: dto.month, year: dto.year },
      }),
    ]);

    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target period (${dto.month}/${dto.year}) is locked and cannot receive bulk bill modifications`,
      );
    }

    if (existing) {
      return this.updateBulkBill(
        existing.id,
        {
          label: dto.label,
          amount: dto.amount,
          paylaterAmount: dto.paylaterAmount,
          personalDebtAmount: dto.personalDebtAmount,
          creditCardAmount: dto.creditCardAmount,
        },
        userId,
      );
    }

    const paylaterAmount = dto.paylaterAmount ?? 0;
    const personalDebtAmount = dto.personalDebtAmount ?? 0;
    const creditCardAmount = 0; // Legacy field, treated as always 0/deprecated
    const amount =
      dto.amount !== undefined &&
      dto.paylaterAmount === undefined &&
      dto.personalDebtAmount === undefined &&
      dto.creditCardAmount === undefined
        ? dto.amount
        : paylaterAmount + personalDebtAmount;

    const { created, syncResult } = await this.prisma.$transaction(
      async (tx) => {
        const createdBill = await tx.monthlyBulkBill.create({
          data: {
            userId,
            label: dto.label ?? 'Monthly Bulk Bill',
            amount,
            paylaterAmount,
            personalDebtAmount,
            creditCardAmount,
            month: dto.month,
            year: dto.year,
          },
        });

        await this.syncBaselineLineItemsWithBulkAmounts(
          tx,
          userId,
          dto.month,
          dto.year,
          Math.round(paylaterAmount),
          Math.round(personalDebtAmount),
        );

        let syncRes: { snapshotId: number; materializedCount: number } | null = null;
        if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
          syncRes = await this.syncLiabilitiesToSnapshotInternal(
            dto.month,
            dto.year,
            tx,
            userId,
          );
        }
        return { created: createdBill, syncResult: syncRes };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    const postTasks: Promise<any>[] = [
      this.auditLogService.record({
        category: AuditCategory.LIABILITIES,
        action: 'CREATE_BULK_BILL',
        severity: AuditSeverity.INFO,
        month: dto.month,
        year: dto.year,
        summary: `Created bulk bill for ${dto.month}/${dto.year}: PayLater=Rp ${paylaterAmount.toLocaleString()}, PersonalDebt=Rp ${personalDebtAmount.toLocaleString()} (Total: Rp ${amount.toLocaleString()})`,
      }),
    ];
    if (syncResult) {
      postTasks.push(
        this.auditLogService.record({
          action: 'SYNC_LIABILITIES',
          category: AuditCategory.LIABILITIES,
          summary: `Materialized ${syncResult.materializedCount} liabilities for period ${dto.month}/${dto.year}`,
          details: `Snapshot ID #${syncResult.snapshotId}`,
          month: dto.month,
          year: dto.year,
          severity: AuditSeverity.INFO,
        }),
      );
    }
    if ((targetSnapshot?.paylaterUsageLimit ?? 0) > 0) {
      postTasks.push(
        this.checkAndLogCreditLimitBreach(dto.month, dto.year, 'PAYLATER', userId),
      );
    }
    await Promise.all(postTasks);

    return created;
  }

  async updateBulkBill(
    id: number,
    dto: UpdateMonthlyBulkBillDto,
    userId?: number,
  ): Promise<MonthlyBulkBill> {
    const existing = await this.prisma.monthlyBulkBill.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`MonthlyBulkBill #${id} not found`);
    }

    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot modify bulk bill belonging to another workspace`);
    }

    const targetSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: existing.userId, month: existing.month, year: existing.year } },
    });
    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target period (${existing.month}/${existing.year}) is locked and bulk bills cannot be modified`,
      );
    }

    // Preserve sibling values unless explicitly provided in dto
    const paylaterAmount =
      dto.paylaterAmount !== undefined
        ? dto.paylaterAmount
        : existing.paylaterAmount;
    const personalDebtAmount =
      dto.personalDebtAmount !== undefined
        ? dto.personalDebtAmount
        : existing.personalDebtAmount;
    const creditCardAmount = 0; // Legacy field, treated as always 0/deprecated

    const amount =
      dto.amount !== undefined &&
      dto.paylaterAmount === undefined &&
      dto.personalDebtAmount === undefined &&
      dto.creditCardAmount === undefined
        ? dto.amount
        : paylaterAmount + personalDebtAmount;

    const { updated, syncResult } = await this.prisma.$transaction(
      async (tx) => {
        await this.syncBaselineLineItemsWithBulkAmounts(
          tx,
          existing.userId,
          existing.month,
          existing.year,
          Math.round(paylaterAmount),
          Math.round(personalDebtAmount),
        );

        const updatedBill = await tx.monthlyBulkBill.update({
          where: { id },
          data: {
            ...(dto.label !== undefined ? { label: dto.label } : {}),
            amount: Math.round(amount),
            paylaterAmount: Math.round(paylaterAmount),
            personalDebtAmount: Math.round(personalDebtAmount),
            creditCardAmount,
          },
        });

        let syncRes: { snapshotId: number; materializedCount: number } | null = null;
        if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
          syncRes = await this.syncLiabilitiesToSnapshotInternal(
            existing.month,
            existing.year,
            tx,
            existing.userId,
          );
        }

        return { updated: updatedBill, syncResult: syncRes };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    const postTasks: Promise<any>[] = [
      this.auditLogService.record({
        category: AuditCategory.LIABILITIES,
        action: 'UPDATE_BULK_BILL',
        severity: AuditSeverity.INFO,
        month: existing.month,
        year: existing.year,
        summary: `Updated bulk bill for ${existing.month}/${existing.year}: PayLater=Rp ${paylaterAmount.toLocaleString()}, PersonalDebt=Rp ${personalDebtAmount.toLocaleString()} (Total: Rp ${amount.toLocaleString()})`,
      }),
    ];
    if (syncResult) {
      postTasks.push(
        this.auditLogService.record({
          action: 'SYNC_LIABILITIES',
          category: AuditCategory.LIABILITIES,
          summary: `Materialized ${syncResult.materializedCount} liabilities for period ${existing.month}/${existing.year}`,
          details: `Snapshot ID #${syncResult.snapshotId}`,
          month: existing.month,
          year: existing.year,
          severity: AuditSeverity.INFO,
        }),
      );
    }
    if ((targetSnapshot?.paylaterUsageLimit ?? 0) > 0) {
      postTasks.push(
        this.checkAndLogCreditLimitBreach(
          existing.month,
          existing.year,
          'PAYLATER',
          existing.userId,
        ),
      );
    }
    await Promise.all(postTasks);

    return updated;
  }

  async deleteBulkBill(id: number, userId?: number): Promise<MonthlyBulkBill> {
    const existing = await this.prisma.monthlyBulkBill.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`MonthlyBulkBill #${id} not found`);
    }

    if (userId && existing.userId !== userId) {
      throw new ForbiddenException(`Cannot delete bulk bill belonging to another workspace`);
    }

    const targetSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: existing.userId, month: existing.month, year: existing.year } },
    });
    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target period (${existing.month}/${existing.year}) is locked and bulk bills cannot be deleted`,
      );
    }

    const deleted = await this.prisma.monthlyBulkBill.delete({ where: { id } });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'DELETE_BULK_BILL',
      severity: AuditSeverity.INFO,
      month: existing.month,
      year: existing.year,
      summary: `Deleted bulk bill for ${existing.month}/${existing.year} (amount: Rp ${deleted.amount.toLocaleString()})`,
    });

    if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(existing.month, existing.year, undefined, existing.userId);
    }

    return deleted;
  }

  // -------------------------------------------------------------------------
  // syncLiabilitiesToSnapshot (Idempotent Materialization)
  // -------------------------------------------------------------------------

  async syncLiabilitiesToSnapshot(
    month: number,
    year: number,
    txClient?: Prisma.TransactionClient,
    userId: number = 1,
  ): Promise<{ snapshotId: number; materializedCount: number }> {
    const result = txClient
      ? await this.syncLiabilitiesToSnapshotInternal(month, year, txClient, userId)
      : await this.prisma.$transaction(
          (tx) => this.syncLiabilitiesToSnapshotInternal(month, year, tx, userId),
          { maxWait: 15000, timeout: 30000 },
        );

    await this.auditLogService.record({
      action: 'SYNC_LIABILITIES',
      category: AuditCategory.LIABILITIES,
      summary: `Materialized ${result.materializedCount} liabilities for period ${month}/${year}`,
      details: `Snapshot ID #${result.snapshotId}`,
      month,
      year,
      severity: AuditSeverity.INFO,
    });

    return result;
  }

  private async syncLiabilitiesToSnapshotInternal(
    month: number,
    year: number,
    tx: Prisma.TransactionClient,
    userId: number = 1,
  ): Promise<{ snapshotId: number; materializedCount: number }> {
    const lockKey = userId * 100000 + year * 12 + month;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

    const snapshot =
      (await tx.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId, month, year } },
      })) ??
      (await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      ));
    if (!snapshot) {
      throw new NotFoundException(`Snapshot for ${month}/${year} could not be resolved`);
    }
    if (snapshot.status === SnapshotStatus.LOCKED) {
      await this.snapshotsService.assertSnapshotUnlocked(snapshot.id, tx);
    }

    const [contracts, bulkBills, cardTxs] = await Promise.all([
      tx.creditContract.findMany({
        where: {
          userId,
          isActive: true,
          remainingTenor: { gt: 0 },
        },
      }),
      tx.monthlyBulkBill.findMany({
        where: {
          userId,
          month,
          year,
        },
      }),
      tx.creditCardTransaction.findMany({
        where: {
          userId,
          status: { in: [CreditCardStatus.ACTIVE, CreditCardStatus.SETTLED] },
        },
      }),
    ]);

    const dueContracts = contracts.filter((c) => {
      if (c.startYear < year) return true;
      if (c.startYear === year && c.startMonth <= month) return true;
      return false;
    });

    const dueCardTxs: { tx: CreditCardTransaction; dueAmount: number }[] = [];
    for (const card of cardTxs) {
      const dueAmount = calculateCardDueAmountForMonth(card, month, year);
      if (dueAmount > 0) {
        dueCardTxs.push({ tx: card, dueAmount });
      }
    }

    await tx.transaction.deleteMany({
      where: {
        snapshotId: snapshot.id,
        sourceType: {
          in: [
            TransactionSourceType.CONTRACT,
            TransactionSourceType.CC_TRANSACTION,
            TransactionSourceType.BULK_BILL,
            TransactionSourceType.PERSONAL_DEBT,
          ],
        },
      },
    });

    const targetDate = new Date(Date.UTC(year, month - 1, 1));

    const bulkBillRecords: {
      snapshotId: number;
      type: TransactionType;
      sourceType: TransactionSourceType;
      sourceId: number;
      label: string;
      amount: number;
      date: Date;
    }[] = [];

    for (const b of bulkBills) {
      if ((b.paylaterAmount ?? 0) > 0) {
        bulkBillRecords.push({
          snapshotId: snapshot.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.BULK_BILL,
          sourceId: b.id,
          label: 'PayLater Bill',
          amount: b.paylaterAmount,
          date: targetDate,
        });
      }
      if ((b.personalDebtAmount ?? 0) > 0) {
        bulkBillRecords.push({
          snapshotId: snapshot.id,
          type: TransactionType.CREDIT_BILL,
          sourceType: TransactionSourceType.PERSONAL_DEBT,
          sourceId: b.id,
          label: 'Personal & Informal Debt',
          amount: b.personalDebtAmount,
          date: targetDate,
        });
      }
    }

    const recordsToCreate = [
      ...dueContracts.map((c) => ({
        snapshotId: snapshot.id,
        type: TransactionType.CREDIT_BILL,
        sourceType: TransactionSourceType.CONTRACT,
        sourceId: c.id,
        label: c.label,
        amount: c.monthlyInstallment,
        date: targetDate,
      })),
      ...bulkBillRecords,
      ...dueCardTxs.map(({ tx: card, dueAmount }) => ({
        snapshotId: snapshot.id,
        type: TransactionType.CREDIT_BILL,
        sourceType: TransactionSourceType.CC_TRANSACTION,
        sourceId: card.id,
        label:
          card.status === CreditCardStatus.SETTLED &&
          card.endedAtMonth === month &&
          card.endedAtYear === year
            ? `${card.label} (Early Settlement Payoff)`
            : card.label,
        amount: Math.round(dueAmount),
        date: targetDate,
      })),
    ];

    if (recordsToCreate.length > 0) {
      await tx.transaction.createMany({
        data: recordsToCreate,
      });
    }

    await this.snapshotsService.recalculateSnapshot(snapshot.id, tx);

    return {
      snapshotId: snapshot.id,
      materializedCount: recordsToCreate.length,
    };
  }

  // -------------------------------------------------------------------------
  // Per-Period Credit Usage Limit & Breach Guardrails
  // -------------------------------------------------------------------------

  async updateCreditUsageLimit(
    dto: UpdateCreditUsageLimitDto,
    userId: number = 1,
  ): Promise<CreditLimitCalculationResult> {
    const existingSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: dto.month,
          year: dto.year,
        },
      },
    });

    if (existingSnapshot?.status === SnapshotStatus.LOCKED) {
      throw new BadRequestException(
        `Target period (${dto.month}/${dto.year}) is locked and its frozen credit usage limits cannot be modified`,
      );
    }

    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } }));
    if (!config) {
      throw new BadRequestException(
        'Global configuration has not been initialized',
      );
    }

    const nextCcLimit =
      dto.ccUsageLimit !== undefined
        ? dto.ccUsageLimit
        : existingSnapshot
        ? existingSnapshot.ccUsageLimit
        : config.ccUsageLimit;

    const nextPaylaterLimit =
      dto.paylaterUsageLimit !== undefined
        ? dto.paylaterUsageLimit
        : existingSnapshot
        ? existingSnapshot.paylaterUsageLimit
        : config.paylaterUsageLimit;

    if (existingSnapshot) {
      await this.prisma.monthlySnapshot.update({
        where: { id: existingSnapshot.id },
        data: {
          ccUsageLimit: nextCcLimit,
          paylaterUsageLimit: nextPaylaterLimit,
        },
      });
    } else {
      // Create a forward planning DRAFT snapshot with totalWorkingDays = 0 and no materialized transactions
      // so AuditSelectors.listHistoricalSnapshots does not score it until real payroll/transaction activity exists.
      await this.prisma.monthlySnapshot.create({
        data: {
          userId,
          month: dto.month,
          year: dto.year,
          status: SnapshotStatus.DRAFT,
          dailyOperational: config.dailyOperational,
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          savings: config.baseSavings,
          ccUsageLimit: nextCcLimit,
          paylaterUsageLimit: nextPaylaterLimit,
          totalWorkingDays: 0,
          salaryAdjustment: 0,
          cafeteriaDeduction: 0,
          thrAmount: 0,
          bonusAmount: 0,
          selfRewardTarget: 0,
          bufferPocket: 0,
          payrollPayoutDate: new Date(
            Date.UTC(dto.year, dto.month - 1, config.payrollPayoutDay ?? 25),
          ),
          isPayoutDateConfirmed: false,
        },
      });
    }

    if (dto.saveAsGlobalDefault && config.userId === userId) {
      await this.prisma.globalConfig.update({
        where: { id: config.id },
        data: {
          ...(dto.ccUsageLimit !== undefined
            ? { ccUsageLimit: dto.ccUsageLimit }
            : {}),
          ...(dto.paylaterUsageLimit !== undefined
            ? { paylaterUsageLimit: dto.paylaterUsageLimit }
            : {}),
        },
      });
    }

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'UPDATE_CREDIT_USAGE_LIMIT',
      severity: AuditSeverity.ADJUSTMENT,
      month: dto.month,
      year: dto.year,
      summary: `Updated credit usage limits for ${dto.month}/${dto.year}: CC Limit=Rp ${nextCcLimit.toLocaleString('id-ID')}, PayLater Limit=Rp ${nextPaylaterLimit.toLocaleString('id-ID')}${dto.saveAsGlobalDefault ? ' (also saved as Global Default)' : ''}`,
      details: JSON.stringify({
        month: dto.month,
        year: dto.year,
        ccUsageLimit: nextCcLimit,
        paylaterUsageLimit: nextPaylaterLimit,
        saveAsGlobalDefault: Boolean(dto.saveAsGlobalDefault),
      }),
    });

    return this.creditSelectors.getCreditUsageLimit(dto.month, dto.year, userId);
  }

  private async syncAffectedDraftSnapshotsForCard(
    card: CreditCardTransaction,
    primaryMonth: number,
    primaryYear: number,
    userId: number = 1,
  ): Promise<void> {
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId, status: SnapshotStatus.DRAFT },
      select: { month: true, year: true },
    });

    await Promise.all(
      draftSnapshots
        .filter(
          (s) =>
            !(s.month === primaryMonth && s.year === primaryYear) &&
            calculateCardDueAmountForMonth(card, s.month, s.year) > 0,
        )
        .map((s) =>
          this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, userId),
        ),
    );
  }

  private async syncAllDraftSnapshots(userId: number = 1): Promise<void> {
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId, status: SnapshotStatus.DRAFT },
      select: { month: true, year: true },
    });

    await Promise.all(
      draftSnapshots.map((s) =>
        this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, userId),
      ),
    );
  }

  private async checkAndLogCreditLimitBreach(
    month: number,
    year: number,
    instrument: 'CC' | 'PAYLATER',
    userId: number = 1,
  ): Promise<void> {
    const limitReport = await this.creditSelectors.getCreditUsageLimit(
      month,
      year,
      userId,
    );

    if (
      instrument === 'CC' &&
      limitReport.ccEvaluation.status === 'EXCEEDED'
    ) {
      await this.auditLogService.record({
        category: AuditCategory.LIABILITIES,
        action: 'CREDIT_LIMIT_EXCEEDED',
        severity: AuditSeverity.WARNING,
        month,
        year,
        summary: `Credit Card usage (Rp ${limitReport.ccEvaluation.usage.toLocaleString('id-ID')}) exceeded configured period limit (Rp ${limitReport.ccEvaluation.limit.toLocaleString('id-ID')}) by Rp ${limitReport.ccEvaluation.exceededBy.toLocaleString('id-ID')} for ${month}/${year}`,
      });
    } else if (
      instrument === 'PAYLATER' &&
      limitReport.paylaterEvaluation.status === 'EXCEEDED'
    ) {
      await this.auditLogService.record({
        category: AuditCategory.LIABILITIES,
        action: 'CREDIT_LIMIT_EXCEEDED',
        severity: AuditSeverity.WARNING,
        month,
        year,
        summary: `PayLater usage (Rp ${limitReport.paylaterEvaluation.usage.toLocaleString('id-ID')}) exceeded configured period limit (Rp ${limitReport.paylaterEvaluation.limit.toLocaleString('id-ID')}) by Rp ${limitReport.paylaterEvaluation.exceededBy.toLocaleString('id-ID')} for ${month}/${year}`,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Subscription Kill-Switch Engine
  // -------------------------------------------------------------------------

  async createKillSwitch(
    dto: CreateKillSwitchDto,
    userId: number = 1,
  ): Promise<CreditCardTransaction> {
    const [config, user] = await Promise.all([
      this.prisma.globalConfig.findFirst({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);
    const statementDay = config?.creditStatementDay ?? 25;

    const promoEndDate = new Date(dto.promoEndDate);
    const now = new Date();
    const { billingMonth, billingYear } = this.calculateBillingCycle(
      now.toISOString().split('T')[0],
      statementDay,
    );

    const bMonth = dto.billingMonth ?? billingMonth;
    const bYear = dto.billingYear ?? billingYear;

    const created = await this.prisma.creditCardTransaction.create({
      data: {
        userId,
        label: dto.label,
        amount: dto.amount,
        chargeType: CreditCardChargeType.RECURRING,
        category: 'Subscription',
        transactionDate: now,
        billingMonth: bMonth,
        billingYear: bYear,
        isRecurring: true,
        isActive: true,
        status: CreditCardStatus.ACTIVE,
        promoLabel: dto.promoLabel ?? null,
        promoEndDate,
        postPromoNormalAmount: dto.postPromoNormalAmount,
        killSwitchEnabled: dto.killSwitchEnabled ?? true,
        providerCancelUrl: dto.providerCancelUrl ?? null,
        providerCancelConfirmed: false,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREATE_KILL_SWITCH',
      severity: AuditSeverity.INFO,
      month: bMonth,
      year: bYear,
      summary: `Created subscription kill-switch for "${created.label}" (Promo ends: ${promoEndDate.toISOString().split('T')[0]}, Normal: Rp ${dto.postPromoNormalAmount.toLocaleString('id-ID')})`,
    });

    // If amount > 0, sync affected draft snapshots
    if (created.amount > 0) {
      await this.syncAffectedDraftSnapshotsForCard(created, bMonth, bYear, userId);
    }

    return created;
  }

  async updateKillSwitch(
    id: number,
    dto: UpdateKillSwitchDto,
    userId: number = 1,
  ): Promise<CreditCardTransaction> {
    const existing = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`CreditCardTransaction #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied to subscription kill-switch');
    }

    // Determine if auto-stop needs to be triggered
    let stoppedAtMonth = existing.stoppedAtMonth;
    let stoppedAtYear = existing.stoppedAtYear;
    let isActive = existing.isActive;

    if (dto.providerCancelConfirmed === true && dto.autoStopAfterPromo === true) {
      const promoEndDate = dto.promoEndDate
        ? new Date(dto.promoEndDate)
        : existing.promoEndDate;

      if (promoEndDate) {
        const promoDate = new Date(promoEndDate);
        const endMonth = promoDate.getUTCMonth() + 1;
        const endYear = promoDate.getUTCFullYear();
        let stopM = endMonth + 1;
        let stopY = endYear;
        if (stopM > 12) {
          stopM = 1;
          stopY += 1;
        }
        stoppedAtMonth = stopM;
        stoppedAtYear = stopY;
        isActive = false;
      }
    }

    const updated = await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.promoLabel !== undefined ? { promoLabel: dto.promoLabel } : {}),
        ...(dto.promoEndDate !== undefined
          ? { promoEndDate: new Date(dto.promoEndDate) }
          : {}),
        ...(dto.postPromoNormalAmount !== undefined
          ? { postPromoNormalAmount: dto.postPromoNormalAmount }
          : {}),
        ...(dto.killSwitchEnabled !== undefined
          ? { killSwitchEnabled: dto.killSwitchEnabled }
          : {}),
        ...(dto.providerCancelUrl !== undefined
          ? { providerCancelUrl: dto.providerCancelUrl }
          : {}),
        ...(dto.providerCancelConfirmed !== undefined
          ? { providerCancelConfirmed: dto.providerCancelConfirmed }
          : {}),
        stoppedAtMonth,
        stoppedAtYear,
        isActive,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'UPDATE_KILL_SWITCH',
      severity: AuditSeverity.INFO,
      month: updated.billingMonth,
      year: updated.billingYear,
      summary: `Updated subscription kill-switch "${updated.label}" (#${id})${
        dto.providerCancelConfirmed ? ' [Confirmed Canceled]' : ''
      }${!isActive ? ` [Auto-Stop from ${stoppedAtMonth}/${stoppedAtYear}]` : ''}`,
      details: JSON.stringify(dto),
    });

    if (
      dto.providerCancelConfirmed === true &&
      dto.autoStopAfterPromo === true &&
      stoppedAtMonth &&
      stoppedAtYear
    ) {
      // Re-sync all DRAFT snapshots from (stoppedAtMonth, stoppedAtYear) onward
      const stopSerial = stoppedAtYear * 12 + stoppedAtMonth;
      const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
        where: { userId, status: SnapshotStatus.DRAFT },
        select: { month: true, year: true },
      });

      for (const s of draftSnapshots) {
        const sSerial = s.year * 12 + s.month;
        if (sSerial >= stopSerial) {
          await this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, existing.userId);
        }
      }
    }

    return updated;
  }

  /**
   * Updates external reminder notification settings for the user.
   */
  async updateKillSwitchNotificationConfig(
    dto: UpdateKillSwitchNotificationConfigDto,
    userId: number = 1,
  ) {
    const trimmedAppPass = normalizeSmtpAppPassword(dto.killSwitchSmtpAppPassword);
    const trimmedWaKey = dto.killSwitchWaApiKey?.trim();

    const smtpUserUpdate = dto.resetSmtpConfig
      ? { killSwitchSmtpUser: null }
      : dto.killSwitchSmtpUser !== undefined
        ? { killSwitchSmtpUser: dto.killSwitchSmtpUser.trim() || null }
        : {};

    const smtpPasswordUpdate =
      dto.resetSmtpConfig || dto.clearSmtpPassword
        ? { killSwitchSmtpAppPassword: null }
        : trimmedAppPass.length > 0
          ? { killSwitchSmtpAppPassword: trimmedAppPass }
          : {};

    const waApiKeyUpdate = dto.clearWaApiKey
      ? { killSwitchWaApiKey: null }
      : trimmedWaKey && trimmedWaKey.length > 0
        ? { killSwitchWaApiKey: trimmedWaKey }
        : {};

    const updateData = {
      ...(dto.killSwitchNotifyEmail !== undefined
        ? { killSwitchNotifyEmail: dto.killSwitchNotifyEmail.trim() || null }
        : {}),
      ...smtpUserUpdate,
      ...smtpPasswordUpdate,
      ...(dto.killSwitchWebhookUrl !== undefined
        ? { killSwitchWebhookUrl: dto.killSwitchWebhookUrl.trim() || null }
        : {}),
      ...(dto.killSwitchWaPhone !== undefined
        ? { killSwitchWaPhone: dto.killSwitchWaPhone.trim() || null }
        : {}),
      ...waApiKeyUpdate,
      ...(dto.killSwitchCustomMessageTemplate !== undefined
        ? {
            killSwitchCustomMessageTemplate:
              dto.killSwitchCustomMessageTemplate.trim() || null,
          }
        : {}),
    };

    const savedConfig = await this.prisma.globalConfig.upsert({
      where: { userId },
      update: updateData,
      create: {
        userId,
        baseSalary: 0,
        dailyAllowance: 0,
        ...updateData,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.SETTINGS,
      action: 'UPDATE_KILL_SWITCH_NOTIFICATION_CONFIG',
      severity: AuditSeverity.INFO,
      summary: `Updated subscription kill-switch external reminder channels for user #${userId}`,
      details: JSON.stringify({
        email: dto.killSwitchNotifyEmail,
        hasSmtpUser: !!savedConfig.killSwitchSmtpUser,
        hasSmtpPassword: !!savedConfig.killSwitchSmtpAppPassword,
        clearedSmtpPassword: Boolean(dto.clearSmtpPassword || dto.resetSmtpConfig),
        hasWebhook: !!dto.killSwitchWebhookUrl,
        hasWaPhone: !!dto.killSwitchWaPhone,
      }),
    });

    const baseResponse = await this.creditSelectors.getKillSwitchNotificationConfig(userId);
    const effectiveUser =
      savedConfig.killSwitchSmtpUser?.trim() ||
      process.env.SMTP_USER?.trim() ||
      ERP_NOTIFICATION_EMAIL;
    const effectivePass = normalizeSmtpAppPassword(
      savedConfig.killSwitchSmtpAppPassword ?? process.env.SMTP_PASS,
    );

    const smtpVerification = effectivePass
      ? await verifySmtpConnection(
          buildSmtpTransportConfig({
            user: effectiveUser,
            pass: effectivePass,
          }),
        )
      : null;

    return {
      ...baseResponse,
      smtpVerification,
    };
  }

  /**
   * Dispatches an external reminder (Gmail and/or WhatsApp webhook) for a subscription.
   */
  async sendKillSwitchReminder(id: number, userId: number = 1) {
    const item = await this.prisma.creditCardTransaction.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`CreditCardTransaction #${id} not found`);
    }
    if (item.userId !== userId) {
      throw new ForbiddenException('Access denied to credit card item reminder');
    }

    const [config, user] = await Promise.all([
      this.prisma.globalConfig.findFirst({
        where: { userId },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      }),
    ]);

    // Compute payload for message
    const now = new Date();
    const utcNow = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    );

    let deadline = now.toISOString().split('T')[0];
    let daysLeft = 0;

    if (item.promoEndDate) {
      const pDate = new Date(item.promoEndDate);
      deadline = pDate.toISOString().split('T')[0];
      const utcPromo = Date.UTC(
        pDate.getUTCFullYear(),
        pDate.getUTCMonth(),
        pDate.getUTCDate(),
      );
      daysLeft = Math.round((utcPromo - utcNow) / (1000 * 60 * 60 * 24));
    }

    const normalPrice = item.postPromoNormalAmount ?? item.amount;
    const name = item.promoLabel
      ? `${item.label} (${item.promoLabel})`
      : item.label;

    const message = formatKillSwitchReminderMessage(
      config?.killSwitchCustomMessageTemplate,
      {
        name,
        deadline,
        daysLeft,
        normalPrice,
        cancelUrl: item.providerCancelUrl,
        currentPrice: item.amount,
      },
    );

    const transportCfg = buildSmtpTransportConfig({
      user:
        config?.killSwitchSmtpUser?.trim() ||
        process.env.SMTP_USER?.trim() ||
        ERP_NOTIFICATION_EMAIL,
      pass: config?.killSwitchSmtpAppPassword ?? process.env.SMTP_PASS,
    });
    const smtpPass = transportCfg.pass.length > 0 ? transportCfg.pass : null;
    const recipientEmail =
      user?.email?.trim() ||
      config?.killSwitchNotifyEmail?.trim() ||
      process.env.ERP_NOTIFICATION_EMAIL?.trim() ||
      ERP_NOTIFICATION_EMAIL;

    const subject = formatKillSwitchEmailSubject(item.label, deadline);
    const htmlPreview = buildKillSwitchEmailHtml({
      name,
      deadline,
      daysLeft,
      currentPrice: item.amount,
      normalPrice,
      cancelUrl: item.providerCancelUrl,
      plainMessage: message,
      recipientEmail,
    });

    let emailSent = false;
    let emailError: string | undefined;
    let emailErrorCode: string | undefined;
    let emailGuidance: string | undefined;
    let fallbackUsed = false;
    let webhookSent = false;
    let webhookError: string | undefined;

    // 1. Direct Gmail SMTP Delivery (with STARTTLS fallback & structured error classification)
    if (transportCfg.user && smtpPass) {
      const outcome = await sendSmtpMailWithFallback(transportCfg, {
        from: PLATFORM_EMAIL_FROM,
        replyTo: PLATFORM_EMAIL_REPLY_TO,
        to: recipientEmail,
        subject,
        text: message,
        html: htmlPreview,
      });

      fallbackUsed = outcome.fallbackUsed;
      if (outcome.ok) {
        emailSent = true;
      } else {
        emailErrorCode = outcome.errorCode;
        emailGuidance = outcome.guidance;
        emailError = [outcome.summary, outcome.guidance].filter(Boolean).join(' ');
      }
    }

    // 2. WhatsApp / Gateway Webhook Delivery
    if (config?.killSwitchWebhookUrl) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (config.killSwitchWaApiKey) {
          headers['Authorization'] = config.killSwitchWaApiKey;
        }

        const bodyData: Record<string, any> = {
          target: config.killSwitchWaPhone,
          phone: config.killSwitchWaPhone,
          message,
          subscriptionName: name,
          deadline,
          daysLeft,
          normalPrice,
          cancelUrl: item.providerCancelUrl,
        };

        const response = await fetch(config.killSwitchWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyData),
        });

        if (response.ok) {
          webhookSent = true;
        } else {
          const errText = await response.text();
          webhookError = `Webhook responded ${response.status}: ${errText.slice(0, 100)}`;
        }
      } catch (err: any) {
        webhookError = err.message || 'Failed to trigger webhook';
      }
    }

    // Update timestamp on transaction
    const notifiedAt = new Date();
    await this.prisma.creditCardTransaction.update({
      where: { id },
      data: {
        lastKillSwitchNotifiedAt: notifiedAt,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'SEND_KILL_SWITCH_REMINDER',
      severity: AuditSeverity.INFO,
      summary: `Dispatched external kill-switch reminder for "${item.label}" (#${id})`,
      details: JSON.stringify({
        emailSent,
        webhookSent,
        emailError,
        webhookError,
      }),
    });

    const cleanWaPhone = config?.killSwitchWaPhone
      ? config.killSwitchWaPhone.replace(/[^0-9]/g, '')
      : null;

    const whatsappUrl = cleanWaPhone
      ? `https://wa.me/${cleanWaPhone}?text=${encodeURIComponent(message)}`
      : null;

    const overallSuccess =
      emailSent ||
      webhookSent ||
      (!smtpPass && !config?.killSwitchWebhookUrl);

    return {
      success: overallSuccess,
      mode: smtpPass ? (emailSent ? 'SENT' : 'ERROR') : 'DRY_RUN_PREVIEW',
      configured: Boolean(smtpPass),
      fallbackUsed,
      errorCode: !overallSuccess ? emailErrorCode : undefined,
      guidance: !overallSuccess ? emailGuidance : undefined,
      error: !overallSuccess ? emailError || webhookError : undefined,
      recipientEmail,
      subject,
      htmlPreview,
      channels: {
        email: emailSent,
        webhook: webhookSent,
        emailError,
        webhookError,
      },
      message,
      whatsappUrl,
      notifiedAt: notifiedAt.toISOString(),
    };
  }

  // -------------------------------------------------------------------------
  // Itemized Liability Sub-Ledger, Cutoff Shifter & Bridge Loan Engines
  // -------------------------------------------------------------------------

  private addMonthsToPeriod(
    month: number,
    year: number,
    offset: number,
  ): { month: number; year: number } {
    const total = year * 12 + (month - 1) + offset;
    return {
      year: Math.floor(total / 12),
      month: (((total % 12) + 12) % 12) + 1,
    };
  }

  private async syncBaselineLineItemsWithBulkAmounts(
    tx: Prisma.TransactionClient,
    userId: number,
    month: number,
    year: number,
    targetPaylater: number,
    targetPersonalDebt: number,
  ): Promise<void> {
    const existingItems = await tx.liabilityLineItem.findMany({
      where: { userId, month, year },
      orderBy: { id: 'asc' },
    });

    if (existingItems.length === 0) {
      if (targetPaylater > 0) {
        await tx.liabilityLineItem.create({
          data: {
            userId,
            month,
            year,
            category: LiabilityCategory.PAYLATER,
            title: 'SPayLater Baseline Cycle Schedule',
            merchantOrPlatform: 'SPayLater',
            principalAmount: targetPaylater,
            monthlyAmount: targetPaylater,
            tenorMonths: 1,
            installmentIndex: 1,
            cutoffDay: 15,
            dueDay: 25,
            isSettled: false,
            parentContractId: 'PL-BASE-2026',
          },
        });
      }
      if (targetPersonalDebt > 0) {
        await tx.liabilityLineItem.create({
          data: {
            userId,
            month,
            year,
            category: LiabilityCategory.PERSONAL_DEBT,
            title: 'Personal / Peer Obligation',
            merchantOrPlatform: 'Personal / Peer',
            principalAmount: targetPersonalDebt,
            monthlyAmount: targetPersonalDebt,
            tenorMonths: 1,
            installmentIndex: 1,
            cutoffDay: 1,
            dueDay: 25,
            isSettled: false,
          },
        });
      }
      return;
    }

    // Reconcile PAYLATER items
    await this.reconcileBucketLineItems(tx, {
      userId,
      month,
      year,
      category: LiabilityCategory.PAYLATER,
      items: existingItems.filter((i) => i.category === LiabilityCategory.PAYLATER),
      targetTotal: targetPaylater,
      isBaseline: (i) =>
        i.parentContractId === 'PL-BASE-2026' ||
        i.title === 'Unitemized Statement Balance' ||
        i.title.startsWith('SPayLater Baseline'),
      defaultBaseline: {
        title: 'Unitemized Statement Balance',
        merchantOrPlatform: 'SPayLater',
        cutoffDay: 15,
        dueDay: 25,
        parentContractId: 'PL-BASE-2026',
      },
      label: 'PayLater',
    });

    // Reconcile PERSONAL_DEBT (+ P1_VAULT_REFUND) items
    await this.reconcileBucketLineItems(tx, {
      userId,
      month,
      year,
      category: LiabilityCategory.PERSONAL_DEBT,
      items: existingItems.filter(
        (i) =>
          i.category === LiabilityCategory.PERSONAL_DEBT ||
          i.category === LiabilityCategory.P1_VAULT_REFUND,
      ),
      targetTotal: targetPersonalDebt,
      isBaseline: (i) =>
        i.category === LiabilityCategory.PERSONAL_DEBT &&
        (i.parentContractId === 'PD-BASE' ||
          i.title === 'Unitemized Personal Debt' ||
          i.title.startsWith('Personal Debt Baseline') ||
          i.title === 'Personal / Peer Obligation' ||
          !i.parentContractId),
      defaultBaseline: {
        title: 'Unitemized Personal Debt',
        merchantOrPlatform: 'Personal / Peer',
        cutoffDay: 1,
        dueDay: 25,
        parentContractId: 'PD-BASE',
      },
      label: 'Personal Debt',
    });
  }

  /**
   * Reconciles a single liability bucket's sub-ledger items against a lump-sum target total.
   * Updates or creates the baseline unitemized row, and trims single-month items if reducing.
   */
  private async reconcileBucketLineItems(
    tx: Prisma.TransactionClient,
    params: {
      userId: number;
      month: number;
      year: number;
      category: LiabilityCategory;
      items: LiabilityLineItem[];
      targetTotal: number;
      isBaseline: (item: LiabilityLineItem) => boolean;
      defaultBaseline: {
        title: string;
        merchantOrPlatform: string;
        cutoffDay: number;
        dueDay: number;
        parentContractId: string;
      };
      label: string;
    },
  ): Promise<void> {
    const { userId, month, year, category, items, targetTotal, isBaseline, defaultBaseline, label } = params;

    const baseline =
      items.find(isBaseline) ||
      (items.length === 1 && items[0].category === category && items[0].tenorMonths === 1
        ? items[0]
        : undefined);

    const nonBaseline = items.filter((i) => i.id !== baseline?.id);
    const nonBaselineSum = nonBaseline.reduce((s, i) => s + Math.round(i.monthlyAmount), 0);
    const baselineDelta = targetTotal - nonBaselineSum;

    if (baselineDelta >= 0) {
      if (baseline) {
        if (baselineDelta === 0) {
          await tx.liabilityLineItem.delete({ where: { id: baseline.id } });
        } else {
          await tx.liabilityLineItem.update({
            where: { id: baseline.id },
            data: {
              monthlyAmount: baselineDelta,
              principalAmount: baseline.tenorMonths === 1 ? baselineDelta : baseline.principalAmount,
            },
          });
        }
      } else if (baselineDelta > 0) {
        await tx.liabilityLineItem.create({
          data: {
            userId,
            month,
            year,
            category,
            title: defaultBaseline.title,
            merchantOrPlatform: defaultBaseline.merchantOrPlatform,
            principalAmount: baselineDelta,
            monthlyAmount: baselineDelta,
            tenorMonths: 1,
            installmentIndex: 1,
            cutoffDay: defaultBaseline.cutoffDay,
            dueDay: defaultBaseline.dueDay,
            isSettled: false,
            parentContractId: defaultBaseline.parentContractId,
          },
        });
      }
      return;
    }

    // Target is below non-baseline sum: remove baseline first, then trim 1x items before rejecting
    if (baseline) {
      await tx.liabilityLineItem.delete({ where: { id: baseline.id } });
    }

    let remainingExcess = nonBaselineSum - targetTotal;
    const singleMonthAdjustables = nonBaseline
      .filter((i) => i.category === category && i.tenorMonths === 1)
      .slice()
      .reverse();

    for (const item of singleMonthAdjustables) {
      if (remainingExcess <= 0) break;
      const amt = Math.round(item.monthlyAmount);
      if (amt <= remainingExcess) {
        await tx.liabilityLineItem.delete({ where: { id: item.id } });
        remainingExcess -= amt;
      } else {
        const nextAmt = amt - remainingExcess;
        await tx.liabilityLineItem.update({
          where: { id: item.id },
          data: { monthlyAmount: nextAmt, principalAmount: nextAmt },
        });
        remainingExcess = 0;
      }
    }

    if (remainingExcess > 0) {
      const fixedSum = nonBaselineSum - (nonBaselineSum - targetTotal - remainingExcess);
      throw new BadRequestException(
        `${label} total Rp ${targetTotal.toLocaleString('id-ID')} is below active multi-month installment schedules (Rp ${fixedSum.toLocaleString('id-ID')}). Adjust installment slices in the Matrix Drawer instead.`,
      );
    }
  }

  async recomputeBulkBillFromLineItems(
    tx: Prisma.TransactionClient,
    userId: number,
    month: number,
    year: number,
  ): Promise<MonthlyBulkBill> {
    const items = await tx.liabilityLineItem.findMany({
      where: { userId, month, year },
    });

    const paylaterAmount = items
      .filter((i) => i.category === LiabilityCategory.PAYLATER)
      .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);

    const personalDebtAmount = items
      .filter(
        (i) =>
          i.category === LiabilityCategory.PERSONAL_DEBT ||
          i.category === LiabilityCategory.P1_VAULT_REFUND,
      )
      .reduce((s, i) => s + Math.round(i.monthlyAmount), 0);

    const total = paylaterAmount + personalDebtAmount;

    const bulk = await tx.monthlyBulkBill.upsert({
      where: { userId_month_year: { userId, month, year } },
      update: {
        paylaterAmount,
        personalDebtAmount,
        amount: total,
      },
      create: {
        userId,
        month,
        year,
        label: 'Monthly Bulk Bill',
        paylaterAmount,
        personalDebtAmount,
        creditCardAmount: 0,
        amount: total,
      },
    });

    const snap = await tx.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month, year } },
    });
    if (snap && snap.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(month, year, tx, userId);
    }

    return bulk;
  }

  async createLineItemSchedule(
    dto: CreateLiabilityLineItemDto,
    userId: number = 1,
  ): Promise<{ items: LiabilityLineItem[]; affectedPeriods: Array<{ month: number; year: number }> }> {
    const tenorMonths = Math.max(1, Math.round(dto.tenorMonths ?? 1));
    const amountMode =
      dto.amountMode ??
      (dto.monthlyAmount !== undefined && dto.monthlyAmount > 0 && !dto.totalAmount
        ? 'FIXED_MONTHLY'
        : 'PRINCIPAL_SPLIT');

    const { slices: sliceAmounts, totalPrincipal: principalAmount } =
      computeLosslessSlices(
        dto.totalAmount ?? 0,
        dto.monthlyAmount ?? 0,
        tenorMonths,
        amountMode,
      );

    if ((sliceAmounts[0] ?? 0) <= 0) {
      throw new BadRequestException('Monthly amount or total amount must be greater than Rp 0');
    }

    const cfgRow = await this.prisma.globalConfig?.findFirst({ where: { userId } });
    const studioConfig = resolveStudioConfig(userId, cfgRow?.formulaParamsJson, cfgRow);
    const targetInstType =
      dto.category === LiabilityCategory.PAYLATER
        ? 'PAYLATER'
        : dto.category === LiabilityCategory.PERSONAL_DEBT
          ? 'CASH_LOAN'
          : 'CREDIT_CARD';
    const matchedInst = studioConfig.instrumentsTable.find(
      (i) => i.active && i.type.toUpperCase() === targetInstType,
    );

    let cutoffDay =
      dto.cutoffDay ??
      matchedInst?.cutoffDay ??
      (dto.category === LiabilityCategory.PAYLATER ? 15 : 1);
    let dueDay =
      dto.dueDay ??
      (matchedInst?.dueDay && matchedInst.dueDay > 0
        ? matchedInst.dueDay
        : dto.category === LiabilityCategory.PAYLATER
          ? 25
          : 8);

    let startMonth = dto.startMonth;
    let startYear = dto.startYear;

    if (dto.purchaseDate && (dto.autoRouteByCutoff !== false || !startMonth || !startYear)) {
      const sim = simulateCutoffTs({
        title: dto.title,
        instrument:
          dto.category === LiabilityCategory.PAYLATER
            ? 'SPAYLATER'
            : dto.category === LiabilityCategory.PERSONAL_DEBT
              ? 'PERSONAL_DEBT'
              : 'CREDIT_CARD',
        amountMode,
        principalAmount,
        monthlyAmount: dto.monthlyAmount ?? sliceAmounts[0],
        tenorMonths,
        purchaseDate: dto.purchaseDate,
        dueDayOverride: dto.dueDay ?? (matchedInst?.dueDay && matchedInst.dueDay > 0 ? matchedInst.dueDay : undefined),
        cutoffFormula: matchedInst?.cutoffFormula,
        cutoffBoundaryInclusive: matchedInst?.cutoffBoundaryInclusive,
        preCutoffOffsetMonths: matchedInst?.preCutoffOffsetMonths,
        postCutoffOffsetMonths: matchedInst?.postCutoffOffsetMonths,
        dueShiftRule: matchedInst?.dueShiftRule,
        anchorDay: studioConfig.paycycleFormulaConfig.paydayAnchorDay,
        holdPastCutoff: Boolean(dto.holdPastCutoff),
        startMonthOverride:
          dto.autoRouteByCutoff === false ? dto.startMonth : undefined,
        startYearOverride:
          dto.autoRouteByCutoff === false ? dto.startYear : undefined,
      });
      startMonth = sim.startPeriodMonth;
      startYear = sim.startPeriodYear;
      cutoffDay = dto.cutoffDay ?? sim.cutoffDay;
      dueDay = dto.dueDay ?? sim.dueDay;
    } else if (startMonth && startYear && dto.holdPastCutoff) {
      const shifted = this.addMonthsToPeriod(startMonth, startYear, 1);
      startMonth = shifted.month;
      startYear = shifted.year;
    }

    if (!startMonth || !startYear) {
      const now = new Date();
      startMonth = now.getMonth() + 1;
      startYear = now.getFullYear();
    }

    const monthlyAmount = sliceAmounts[0];
    const parentContractId =
      dto.parentContractId ||
      (tenorMonths > 1 || dto.category !== LiabilityCategory.PAYLATER
        ? `ITEM-${dto.category}-${Date.now()}`
        : undefined);

    const periodsToCheck: Array<{ month: number; year: number }> = [];
    for (let i = 0; i < tenorMonths; i++) {
      periodsToCheck.push(this.addMonthsToPeriod(startMonth, startYear, i));
    }

    const existingSnaps = await this.prisma.monthlySnapshot.findMany({
      where: {
        userId,
        OR: periodsToCheck.map((p) => ({ month: p.month, year: p.year })),
      },
      select: { month: true, year: true, status: true },
    });
    const lockedSet = new Set(
      existingSnaps
        .filter((s) => s.status === SnapshotStatus.LOCKED)
        .map((s) => `${s.year}-${s.month}`),
    );
    for (const p of periodsToCheck) {
      if (lockedSet.has(`${p.year}-${p.month}`)) {
        throw new BadRequestException(
          `Period ${p.month}/${p.year} is LOCKED and cannot receive new liabilities`,
        );
      }
    }

    const createdItems = await this.prisma.$transaction(
      async (tx) => {
        const list: LiabilityLineItem[] = [];
        for (let i = 0; i < tenorMonths; i++) {
          const p = periodsToCheck[i];
          const sliceAmt = sliceAmounts[i] ?? monthlyAmount;

          const row = await tx.liabilityLineItem.create({
            data: {
              userId,
              month: p.month,
              year: p.year,
              category: dto.category,
              title:
                tenorMonths > 1
                  ? `${dto.title.trim()} (${i + 1}/${tenorMonths})`
                  : dto.title.trim(),
              merchantOrPlatform:
                dto.merchantOrPlatform?.trim() ||
                (dto.category === LiabilityCategory.PAYLATER
                  ? 'SPayLater'
                  : dto.category === LiabilityCategory.P1_VAULT_REFUND
                    ? 'Internal P1 Vault'
                    : 'SPinjam'),
              principalAmount,
              monthlyAmount: sliceAmt,
              tenorMonths,
              installmentIndex: i + 1,
              cutoffDay,
              dueDay,
              isSettled: false,
              parentContractId,
              notes: dto.notes ?? null,
            },
          });
          list.push(row);
        }

        for (const p of periodsToCheck) {
          await this.recomputeBulkBillFromLineItems(tx, userId, p.month, p.year);
        }

        return list;
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREATE_LIABILITY_LINE_ITEM',
      severity: AuditSeverity.INFO,
      month: startMonth,
      year: startYear,
      summary: `Added ${tenorMonths}x ${dto.category} line item "${dto.title}" (Rp ${monthlyAmount.toLocaleString('id-ID')}/mo starting ${startMonth}/${startYear})`,
      details: JSON.stringify({ ...dto, parentContractId }),
    });

    return { items: createdItems, affectedPeriods: periodsToCheck };
  }

  async shiftLineItem(
    id: number,
    dto: ShiftLiabilityLineItemDto,
    userId: number = 1,
  ): Promise<{ shiftedCount: number; affectedPeriods: Array<{ month: number; year: number }> }> {
    const existing = await this.prisma.liabilityLineItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`LiabilityLineItem #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot modify liability belonging to another user');
    }

    const offset = dto.direction === 'EARLIER' ? -1 : 1;

    const result = await this.prisma.$transaction(
      async (tx) => {
        const periodKeys = new Set<string>();
        const addPeriod = (m: number, y: number) => periodKeys.add(`${y}-${m}`);

        const itemsToShift =
          dto.shiftAllRemainingInContract &&
          existing.parentContractId &&
          !dto.splitAmount
            ? await tx.liabilityLineItem.findMany({
                where: {
                  userId,
                  parentContractId: existing.parentContractId,
                  isSettled: false,
                  OR: [
                    { year: { gt: existing.year } },
                    { year: existing.year, month: { gte: existing.month } },
                  ],
                },
                orderBy: [{ year: 'asc' }, { month: 'asc' }],
              })
            : [existing];

        if (dto.splitAmount !== undefined) {
          const splitAmt = Math.round(dto.splitAmount);
          if (splitAmt <= 0 || splitAmt >= Math.round(existing.monthlyAmount)) {
            throw new BadRequestException(
              `Split amount must be between Rp 1 and Rp ${Math.round(existing.monthlyAmount) - 1}`,
            );
          }

          const targetPeriod = this.addMonthsToPeriod(
            existing.month,
            existing.year,
            offset,
          );
          const srcSnap = await tx.monthlySnapshot.findUnique({
            where: {
              userId_month_year: {
                userId,
                month: existing.month,
                year: existing.year,
              },
            },
          });
          const dstSnap = await tx.monthlySnapshot.findUnique({
            where: {
              userId_month_year: {
                userId,
                month: targetPeriod.month,
                year: targetPeriod.year,
              },
            },
          });
          if (
            srcSnap?.status === SnapshotStatus.LOCKED ||
            dstSnap?.status === SnapshotStatus.LOCKED
          ) {
            throw new BadRequestException(
              'Source or target period is LOCKED and cannot be split across cycles',
            );
          }

          const remainingAmt = Math.round(existing.monthlyAmount) - splitAmt;
          await tx.liabilityLineItem.update({
            where: { id: existing.id },
            data: { monthlyAmount: remainingAmt },
          });

          await tx.liabilityLineItem.create({
            data: {
              userId: existing.userId,
              month: targetPeriod.month,
              year: targetPeriod.year,
              category: existing.category,
              title: existing.title.includes('(Cutoff Split)')
                ? existing.title
                : `${existing.title} (Cutoff Split)`,
              merchantOrPlatform: existing.merchantOrPlatform,
              principalAmount: existing.principalAmount,
              monthlyAmount: splitAmt,
              tenorMonths: existing.tenorMonths,
              installmentIndex: existing.installmentIndex,
              cutoffDay: existing.cutoffDay,
              dueDay: existing.dueDay,
              isSettled: false,
              parentContractId: existing.parentContractId,
              notes: `Split Rp ${splitAmt.toLocaleString('id-ID')} ${dto.direction.toLowerCase()} from ${existing.month}/${existing.year}`,
            },
          });

          addPeriod(existing.month, existing.year);
          addPeriod(targetPeriod.month, targetPeriod.year);
        } else {
          const periodPairsToCheck = new Map<string, { month: number; year: number }>();
          for (const item of itemsToShift) {
            const target = this.addMonthsToPeriod(item.month, item.year, offset);
            periodPairsToCheck.set(`${item.year}-${item.month}`, {
              month: item.month,
              year: item.year,
            });
            periodPairsToCheck.set(`${target.year}-${target.month}`, target);
          }

          const snaps = await tx.monthlySnapshot.findMany({
            where: {
              userId,
              OR: Array.from(periodPairsToCheck.values()),
            },
            select: { month: true, year: true, status: true },
          });
          const lockedSet = new Set(
            snaps
              .filter((s) => s.status === SnapshotStatus.LOCKED)
              .map((s) => `${s.year}-${s.month}`),
          );

          for (const item of itemsToShift) {
            const target = this.addMonthsToPeriod(item.month, item.year, offset);
            if (
              lockedSet.has(`${item.year}-${item.month}`) ||
              lockedSet.has(`${target.year}-${target.month}`)
            ) {
              throw new BadRequestException(
                `Cannot shift "${item.title}": ${item.month}/${item.year} or ${target.month}/${target.year} is LOCKED`,
              );
            }

            addPeriod(item.month, item.year);
            addPeriod(target.month, target.year);

            await tx.liabilityLineItem.update({
              where: { id: item.id },
              data: {
                month: target.month,
                year: target.year,
              },
            });
          }
        }

        const affectedPeriods = Array.from(periodKeys).map((k) => {
          const [y, m] = k.split('-').map(Number);
          return { month: m, year: y };
        });

        for (const p of affectedPeriods) {
          await this.recomputeBulkBillFromLineItems(tx, userId, p.month, p.year);
        }

        return {
          shiftedCount: dto.splitAmount ? 1 : itemsToShift.length,
          affectedPeriods,
        };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'SHIFT_LIABILITY_LINE_ITEM',
      severity: AuditSeverity.ADJUSTMENT,
      month: existing.month,
      year: existing.year,
      summary: `Shifted "${existing.title}" ${dto.direction} (${result.shiftedCount} item(s))`,
      details: JSON.stringify(dto),
    });

    return result;
  }

  async deleteLineItem(id: number, userId: number = 1) {
    const existing = await this.prisma.liabilityLineItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`LiabilityLineItem #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Cannot delete liability belonging to another user');
    }

    const snap = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId,
          month: existing.month,
          year: existing.year,
        },
      },
    });
    if (snap?.status === SnapshotStatus.LOCKED) {
      throw new BadRequestException(
        `Period ${existing.month}/${existing.year} is LOCKED and items cannot be deleted`,
      );
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const removed = await tx.liabilityLineItem.delete({ where: { id } });
      await this.recomputeBulkBillFromLineItems(
        tx,
        userId,
        existing.month,
        existing.year,
      );
      return removed;
    }, { maxWait: 15000, timeout: 30000 });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'DELETE_LIABILITY_LINE_ITEM',
      severity: AuditSeverity.INFO,
      month: existing.month,
      year: existing.year,
      summary: `Deleted liability line item "${existing.title}" (Rp ${Math.round(existing.monthlyAmount).toLocaleString('id-ID')})`,
    });

    return deleted;
  }

  async createBridgeLoan(dto: CreateBridgeLoanDto, userId: number = 1) {
    const principal = Math.round(dto.principalAmount);
    const livingAlloc = Math.round(dto.livingCashAllocation);
    const routineAlloc = Math.round(dto.routineBillsAllocation);
    if (livingAlloc + routineAlloc !== principal) {
      throw new BadRequestException(
        `Living Cash allocation (${livingAlloc}) + Routine Bills allocation (${routineAlloc}) must equal principal (${principal})`,
      );
    }

    const contractId = `BRIDGE-${dto.inflowYear}${String(dto.inflowMonth).padStart(2, '0')}-${Date.now()}`;
    const monthlyInstallment = Math.round(dto.monthlyInstallment);
    const firstSerial = dto.firstInstallmentYear * 12 + dto.firstInstallmentMonth;
    const earlySerial =
      dto.earlyPayoffMonth && dto.earlyPayoffYear
        ? dto.earlyPayoffYear * 12 + dto.earlyPayoffMonth
        : null;

    if (earlySerial !== null && earlySerial < firstSerial) {
      throw new BadRequestException('Early payoff period cannot be earlier than first installment');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const inflowSnap = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
          dto.inflowMonth,
          dto.inflowYear,
          userId,
        );
        await this.snapshotsService.assertSnapshotUnlocked(inflowSnap.id, tx);

        const nextDailyOp = Math.round(inflowSnap.dailyOperational) + livingAlloc;
        const slot = dto.routineCategorySlot || 'INTERNET';
        const slotFieldMap: Record<string, 'transport' | 'internet' | 'vape' | 'haircut'> = {
          TRANSPORT: 'transport',
          INTERNET: 'internet',
          VAPE: 'vape',
          HAIRCUT: 'haircut',
        };
        const slotField = slotFieldMap[slot] || 'internet';
        const prevSlotVal = Math.round(inflowSnap[slotField] ?? 0);
        const nextSlotVal = prevSlotVal + routineAlloc;

        let nextOneOffs = Array.isArray(inflowSnap.oneOffBillsJson)
          ? [...(inflowSnap.oneOffBillsJson as any[])]
          : [];
        if (routineAlloc > 0 && dto.routineSlotLabel?.trim()) {
          nextOneOffs = nextOneOffs.filter(
            (o) => o.slot?.toLowerCase() !== slotField,
          );
          nextOneOffs.push({
            slot: slotField,
            label: dto.routineSlotLabel.trim(),
            amount: nextSlotVal,
          });
        }

        await tx.monthlySnapshot.update({
          where: { id: inflowSnap.id },
          data: {
            dailyOperational: nextDailyOp,
            [slotField]: nextSlotVal,
            bridgeInflowAmount: Math.round(inflowSnap.bridgeInflowAmount ?? 0) + principal,
            oneOffBillsJson: nextOneOffs as any,
          },
        });

        if (livingAlloc > 0) {
          await tx.budgetRevision.create({
            data: {
              snapshotId: inflowSnap.id,
              month: dto.inflowMonth,
              year: dto.inflowYear,
              category: BudgetRevisionCategory.DAILY_OPERATIONAL,
              bucketKey: 'daily_operational',
              bucketLabel: 'Daily Operational',
              previousValue: inflowSnap.dailyOperational,
              newValue: nextDailyOp,
              difference: livingAlloc,
              reason: `Bridge loan cash inflow (${dto.title})`,
            },
          });
        }

        if (routineAlloc > 0) {
          await tx.budgetRevision.create({
            data: {
              snapshotId: inflowSnap.id,
              month: dto.inflowMonth,
              year: dto.inflowYear,
              category: BudgetRevisionCategory[slot],
              bucketKey: slotField,
              bucketLabel: dto.routineSlotLabel?.trim() || slotField,
              previousValue: prevSlotVal,
              newValue: nextSlotVal,
              difference: routineAlloc,
              reason: `Bridge loan routine bill coverage (${dto.title})`,
            },
          });
        }

        await this.snapshotsService.recalculateSnapshot(inflowSnap.id, tx);

        // Generate installment schedule (consolidating into earlyPayoffMonth if specified)
        const affectedPeriods: Array<{ month: number; year: number }> = [];
        let consolidatedCreated = false;

        for (let i = 0; i < dto.tenorMonths; i++) {
          const p = this.addMonthsToPeriod(
            dto.firstInstallmentMonth,
            dto.firstInstallmentYear,
            i,
          );
          const pSerial = p.year * 12 + p.month;
          const dstSnap = await tx.monthlySnapshot.findUnique({
            where: { userId_month_year: { userId, month: p.month, year: p.year } },
          });
          if (dstSnap?.status === SnapshotStatus.LOCKED) {
            throw new BadRequestException(
              `Installment target period ${p.month}/${p.year} is LOCKED`,
            );
          }

          if (earlySerial !== null && pSerial >= earlySerial) {
            if (!consolidatedCreated && dto.earlyPayoffMonth && dto.earlyPayoffYear) {
              const remainingSlices = dto.tenorMonths - i;
              const consolidatedAmt = remainingSlices * monthlyInstallment;
              const targetPayoffSnap = await tx.monthlySnapshot.findUnique({
                where: {
                  userId_month_year: {
                    userId,
                    month: dto.earlyPayoffMonth,
                    year: dto.earlyPayoffYear,
                  },
                },
              });
              if (targetPayoffSnap?.status === SnapshotStatus.LOCKED) {
                throw new BadRequestException(
                  `Early payoff period ${dto.earlyPayoffMonth}/${dto.earlyPayoffYear} is LOCKED`,
                );
              }
              await tx.liabilityLineItem.create({
                data: {
                  userId,
                  month: dto.earlyPayoffMonth,
                  year: dto.earlyPayoffYear,
                  category: LiabilityCategory.PERSONAL_DEBT,
                  title: `${dto.title} Early Payoff (${remainingSlices}x Consolidated)`,
                  merchantOrPlatform: dto.merchantOrPlatform?.trim() || 'SPinjam',
                  principalAmount: principal,
                  monthlyAmount: consolidatedAmt,
                  tenorMonths: dto.tenorMonths,
                  installmentIndex: i + 1,
                  cutoffDay: 1,
                  dueDay: dto.dueDay ?? 8,
                  isSettled: false,
                  parentContractId: contractId,
                  notes: `Accelerated early payoff of ${remainingSlices} remaining installments`,
                },
              });
              affectedPeriods.push({
                month: dto.earlyPayoffMonth,
                year: dto.earlyPayoffYear,
              });
              consolidatedCreated = true;
            }
            break;
          }

          await tx.liabilityLineItem.create({
            data: {
              userId,
              month: p.month,
              year: p.year,
              category: LiabilityCategory.PERSONAL_DEBT,
              title: `${dto.title} (${i + 1}/${dto.tenorMonths})`,
              merchantOrPlatform: dto.merchantOrPlatform?.trim() || 'SPinjam',
              principalAmount: principal,
              monthlyAmount: monthlyInstallment,
              tenorMonths: dto.tenorMonths,
              installmentIndex: i + 1,
              cutoffDay: 1,
              dueDay: dto.dueDay ?? 8,
              isSettled: false,
              parentContractId: contractId,
            },
          });
          affectedPeriods.push(p);
        }

        for (const p of affectedPeriods) {
          await this.recomputeBulkBillFromLineItems(tx, userId, p.month, p.year);
        }

        return { parentContractId: contractId, affectedPeriods };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREATE_BRIDGE_LOAN',
      severity: AuditSeverity.ADJUSTMENT,
      month: dto.inflowMonth,
      year: dto.inflowYear,
      summary: `Recorded bridge loan "${dto.title}" (Rp ${principal.toLocaleString('id-ID')}) with ${dto.tenorMonths}x Rp ${monthlyInstallment.toLocaleString('id-ID')} schedule`,
      details: JSON.stringify(dto),
    });

    return result;
  }

  async accelerateBridgeLoan(dto: AccelerateBridgeLoanDto, userId: number = 1) {
    const items = await this.prisma.liabilityLineItem.findMany({
      where: {
        userId,
        parentContractId: dto.parentContractId,
        isSettled: false,
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    if (items.length === 0) {
      throw new NotFoundException(
        `No unsettled liability items found for contract ${dto.parentContractId}`,
      );
    }

    const targetSerial = dto.targetYear * 12 + dto.targetMonth;
    const toConsolidate = items.filter(
      (i) => i.year * 12 + i.month >= targetSerial,
    );

    if (toConsolidate.length <= 1) {
      throw new BadRequestException(
        `Contract ${dto.parentContractId} does not have multiple unsettled future installments from ${dto.targetMonth}/${dto.targetYear} onward`,
      );
    }

    const totalRemaining = toConsolidate.reduce(
      (s, i) => s + Math.round(i.monthlyAmount),
      0,
    );
    const template = toConsolidate[0];
    const baseTitle = template.title
      .replace(/\s*\(\d+\/\d+.*?\)\s*/g, '')
      .trim();

    const affectedPeriods = await this.prisma.$transaction(
      async (tx) => {
        const periodKeys = new Set<string>();
        periodKeys.add(`${dto.targetYear}-${dto.targetMonth}`);

        for (const row of toConsolidate) {
          periodKeys.add(`${row.year}-${row.month}`);
          const snap = await tx.monthlySnapshot.findUnique({
            where: {
              userId_month_year: { userId, month: row.month, year: row.year },
            },
          });
          if (snap?.status === SnapshotStatus.LOCKED) {
            throw new BadRequestException(
              `Period ${row.month}/${row.year} is LOCKED and cannot be consolidated`,
            );
          }
        }

        await tx.liabilityLineItem.deleteMany({
          where: { id: { in: toConsolidate.map((i) => i.id) } },
        });

        await tx.liabilityLineItem.create({
          data: {
            userId,
            month: dto.targetMonth,
            year: dto.targetYear,
            category: template.category,
            title: `${baseTitle} Early Payoff (${toConsolidate.length}x Consolidated)`,
            merchantOrPlatform: template.merchantOrPlatform,
            principalAmount: template.principalAmount,
            monthlyAmount: totalRemaining,
            tenorMonths: template.tenorMonths,
            installmentIndex: template.installmentIndex,
            cutoffDay: template.cutoffDay,
            dueDay: template.dueDay,
            isSettled: false,
            parentContractId: dto.parentContractId,
            notes: `Accelerated early payoff of ${toConsolidate.length} slices consolidated into ${dto.targetMonth}/${dto.targetYear}`,
          },
        });

        const periods = Array.from(periodKeys).map((k) => {
          const [y, m] = k.split('-').map(Number);
          return { month: m, year: y };
        });

        for (const p of periods) {
          await this.recomputeBulkBillFromLineItems(tx, userId, p.month, p.year);
        }

        return periods;
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'ACCELERATE_LIABILITY_PAYOFF',
      severity: AuditSeverity.ADJUSTMENT,
      month: dto.targetMonth,
      year: dto.targetYear,
      summary: `Consolidated ${toConsolidate.length} slices of "${baseTitle}" (Rp ${totalRemaining.toLocaleString('id-ID')}) into ${dto.targetMonth}/${dto.targetYear}`,
      details: JSON.stringify(dto),
    });

    return {
      consolidatedSlices: toConsolidate.length,
      totalConsolidatedAmount: totalRemaining,
      targetPeriod: { month: dto.targetMonth, year: dto.targetYear },
      affectedPeriods,
    };
  }

  /**
   * Marks an itemized liability line item as Settled/Paid or Unpaid.
   * Tracks explicit past-due manual unpaid overrides via [MANUAL_UNPAID] marker
   * so read-time due-date auto-settlement never overrides deliberate user choices.
   * Preserves MonthlyBulkBill scheduled totals so waterfall history never drifts.
   */
  private computeNextSettlementWriteData(
    item: LiabilityLineItem,
    targetState: DerivedBillSettlementState,
  ): { isSettled: boolean; notes: string | null } {
    const markSettled = targetState === 'PAID';
    const evalCheck = evaluateObligationSettlement({
      periodMonth: item.month,
      periodYear: item.year,
      dueDay:
        item.dueDay > 0
          ? item.dueDay
          : getDefaultDueDayForCategory(item.category),
      dbIsSettled: markSettled,
      notes: null,
    });
    let nextNotes = setManualUnpaidMarker(
      item.notes,
      !markSettled && evalCheck.isPastDueDate,
    );
    nextNotes = setReservedMarker(nextNotes, targetState === 'RESERVED');
    return { isSettled: markSettled, notes: nextNotes };
  }

  async setLineItemSettlementState(
    id: number,
    settlementState: DerivedBillSettlementState,
    userId: number = 1,
  ): Promise<LiabilityLineItem> {
    const existing = await this.prisma.liabilityLineItem.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Liability line item #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied to liability line item');
    }

    const writeData = this.computeNextSettlementWriteData(existing, settlementState);
    const updated = await this.prisma.liabilityLineItem.update({
      where: { id },
      data: writeData,
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'SET_LINE_ITEM_SETTLEMENT_STATE',
      severity: AuditSeverity.INFO,
      month: existing.month,
      year: existing.year,
      summary: `Marked "${existing.title}" (${existing.category}) as ${settlementState} (Rp ${Math.round(existing.monthlyAmount).toLocaleString('id-ID')})`,
      details: JSON.stringify({ id, settlementState, isSettled: writeData.isSettled }),
    });

    return updated;
  }

  async toggleLineItemSettled(
    id: number,
    isSettled: boolean,
    userId: number = 1,
  ): Promise<LiabilityLineItem> {
    return this.setLineItemSettlementState(
      id,
      isSettled ? 'PAID' : 'UNPAID',
      userId,
    );
  }

  /**
   * Atomically settles or resets all LiabilityLineItem entries matching a billing
   * period (and optional bucket category) inside one transaction.
   * When PERSONAL_DEBT is specified, also includes paired P1_VAULT_REFUND entries
   * grouped under the Personal Debt drawer.
   */
  async settleBulkLineItems(
    dto: {
      month: number;
      year: number;
      category?: LiabilityCategory;
      isSettled?: boolean;
      settlementState?: DerivedBillSettlementState;
    },
    userId: number = 1,
  ): Promise<{
    updatedCount: number;
    month: number;
    year: number;
    isSettled: boolean;
    settlementState: DerivedBillSettlementState;
  }> {
    const categoryFilter =
      dto.category === LiabilityCategory.PERSONAL_DEBT
        ? { in: [LiabilityCategory.PERSONAL_DEBT, LiabilityCategory.P1_VAULT_REFUND] }
        : dto.category;

    const items = await this.prisma.liabilityLineItem.findMany({
      where: {
        userId,
        month: dto.month,
        year: dto.year,
        ...(categoryFilter ? { category: categoryFilter } : {}),
      },
    });

    const targetState: DerivedBillSettlementState =
      dto.settlementState ?? (dto.isSettled ? 'PAID' : 'UNPAID');
    const markSettled = targetState === 'PAID';

    if (items.length === 0) {
      return {
        updatedCount: 0,
        month: dto.month,
        year: dto.year,
        isSettled: markSettled,
        settlementState: targetState,
      };
    }

    await this.prisma.$transaction(
      items.map((item) => {
        const writeData = this.computeNextSettlementWriteData(item, targetState);
        return this.prisma.liabilityLineItem.update({
          where: { id: item.id },
          data: writeData,
        });
      }),
    );

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: markSettled
        ? 'BULK_SETTLE_LINE_ITEMS'
        : 'BULK_UNSETTLE_LINE_ITEMS',
      severity: AuditSeverity.INFO,
      month: dto.month,
      year: dto.year,
      summary: `Set ${items.length} liability item(s) to ${targetState} for ${dto.month}/${dto.year}${dto.category ? ` (${dto.category})` : ''}`,
      details: JSON.stringify({
        month: dto.month,
        year: dto.year,
        category: dto.category ?? 'ALL',
        isSettled: markSettled,
        settlementState: targetState,
        count: items.length,
      }),
    });

    return {
      updatedCount: items.length,
      month: dto.month,
      year: dto.year,
      isSettled: markSettled,
      settlementState: targetState,
    };
  }
}
