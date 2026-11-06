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
  CreditCardChargeType,
  CreditCardStatus,
  SnapshotStatus,
  TransactionType,
  TransactionSourceType,
  AuditCategory,
  AuditSeverity,
} from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
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
import { formatKillSwitchReminderMessage } from './kill-switch-message';
import * as nodemailer from 'nodemailer';
import { CreditSelectors } from './credit.selectors';
import { CreditLimitCalculationResult } from '../calculator/credit-limit';
import {
  calculateCardDueAmountForMonth,
  calculateCardInstallmentProgress,
} from './credit.utils';

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

  async createContract(dto: CreateCreditContractDto): Promise<CreditContract> {
    const created = await this.prisma.creditContract.create({
      data: {
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
  ): Promise<CreditContract> {
    const existing = await this.prisma.creditContract.findUnique({
      where: { id },
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

  async deleteContract(id: number): Promise<CreditContract> {
    const existing = await this.prisma.creditContract.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`CreditContract #${id} not found`);
    }
    const deleted = await this.prisma.creditContract.delete({ where: { id } });

    await this.auditLogService.record({
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
    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
    const statementDay = config?.creditStatementDay ?? 20;

    const { billingMonth, billingYear } = this.calculateBillingCycle(
      dto.transactionDate,
      statementDay,
    );

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
    const targetSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId, month: dto.month, year: dto.year } },
    });
    if (targetSnapshot?.status === 'LOCKED') {
      throw new BadRequestException(
        `Target period (${dto.month}/${dto.year}) is locked and cannot receive bulk bill modifications`,
      );
    }

    const existing = await this.prisma.monthlyBulkBill.findFirst({
      where: { userId, month: dto.month, year: dto.year },
    });

    if (existing) {
      return this.updateBulkBill(existing.id, {
        label: dto.label,
        amount: dto.amount,
        paylaterAmount: dto.paylaterAmount,
        personalDebtAmount: dto.personalDebtAmount,
        creditCardAmount: dto.creditCardAmount,
      }, userId);
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

    const created = await this.prisma.monthlyBulkBill.create({
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

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'CREATE_BULK_BILL',
      severity: AuditSeverity.INFO,
      month: dto.month,
      year: dto.year,
      summary: `Created bulk bill for ${dto.month}/${dto.year}: PayLater=Rp ${paylaterAmount.toLocaleString()}, PersonalDebt=Rp ${personalDebtAmount.toLocaleString()} (Total: Rp ${amount.toLocaleString()})`,
    });

    if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(dto.month, dto.year, undefined, userId);
    }

    await this.checkAndLogCreditLimitBreach(dto.month, dto.year, 'PAYLATER', userId);

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

    const updated = await this.prisma.monthlyBulkBill.update({
      where: { id },
      data: {
        ...(dto.label !== undefined ? { label: dto.label } : {}),
        amount,
        paylaterAmount,
        personalDebtAmount,
        creditCardAmount,
      },
    });

    await this.auditLogService.record({
      category: AuditCategory.LIABILITIES,
      action: 'UPDATE_BULK_BILL',
      severity: AuditSeverity.INFO,
      month: existing.month,
      year: existing.year,
      summary: `Updated bulk bill for ${existing.month}/${existing.year}: PayLater=Rp ${paylaterAmount.toLocaleString()}, PersonalDebt=Rp ${personalDebtAmount.toLocaleString()} (Total: Rp ${amount.toLocaleString()})`,
    });

    if (targetSnapshot && targetSnapshot.status === SnapshotStatus.DRAFT) {
      await this.syncLiabilitiesToSnapshot(existing.month, existing.year, undefined, existing.userId);
    }

    await this.checkAndLogCreditLimitBreach(
      existing.month,
      existing.year,
      'PAYLATER',
      existing.userId,
    );

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
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Ensure snapshot exists and is DRAFT (assertSnapshotUnlocked throws if LOCKED)
      const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
        month,
        year,
        userId,
      );
      await this.snapshotsService.assertSnapshotUnlocked(snapshot.id, tx);

      // 2. Fetch due liabilities in parallel
      const [contracts, bulkBills, cardTxs] = await Promise.all([
        userId === 1
          ? tx.creditContract.findMany({
              where: {
                isActive: true,
                remainingTenor: { gt: 0 },
              },
            })
          : Promise.resolve<CreditContract[]>([]),
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

      // Filter contracts that have started by (month, year)
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

      // 3. Clean up previous non-manual (materialized) liability transactions for this snapshot
      //    (preserves MANUAL and OPERATIONAL_REFUND entries)
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

      // 4. Materialize new CREDIT_BILL transactions
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

      // 5. Trigger snapshot recalculation
      await this.snapshotsService.recalculateSnapshot(snapshot.id, tx);

      return {
        snapshotId: snapshot.id,
        materializedCount: recordsToCreate.length,
      };
    };

    const result = txClient
      ? await execute(txClient)
      : await this.prisma.$transaction(execute, { maxWait: 15000, timeout: 30000 });

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

  // -------------------------------------------------------------------------
  // Per-Period Credit Usage Limit & Breach Guardrails
  // -------------------------------------------------------------------------

  async updateCreditUsageLimit(
    dto: UpdateCreditUsageLimitDto,
  ): Promise<CreditLimitCalculationResult> {
    const existingSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: {
          userId: 1,
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

    const config = await this.prisma.globalConfig.findFirst();
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

    if (dto.saveAsGlobalDefault) {
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

    return this.creditSelectors.getCreditUsageLimit(dto.month, dto.year);
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

    for (const s of draftSnapshots) {
      if (s.month === primaryMonth && s.year === primaryYear) continue;
      const due = calculateCardDueAmountForMonth(card, s.month, s.year);
      if (due > 0) {
        await this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, userId);
      }
    }
  }

  private async syncAllDraftSnapshots(userId: number = 1): Promise<void> {
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: { userId, status: SnapshotStatus.DRAFT },
      select: { month: true, year: true },
    });

    for (const s of draftSnapshots) {
      await this.syncLiabilitiesToSnapshot(s.month, s.year, undefined, userId);
    }
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
    const config = await this.prisma.globalConfig.findFirst({
      where: { userId },
    });
    const statementDay = config?.creditStatementDay ?? 20;

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
          await this.syncLiabilitiesToSnapshot(s.month, s.year);
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
    const updateData = {
      ...(dto.killSwitchNotifyEmail !== undefined
        ? { killSwitchNotifyEmail: dto.killSwitchNotifyEmail }
        : {}),
      ...(dto.killSwitchSmtpUser !== undefined
        ? { killSwitchSmtpUser: dto.killSwitchSmtpUser }
        : {}),
      ...(dto.killSwitchSmtpAppPassword !== undefined
        ? {
            killSwitchSmtpAppPassword: dto.killSwitchSmtpAppPassword
              ? dto.killSwitchSmtpAppPassword.replace(/\s+/g, '')
              : null,
          }
        : {}),
      ...(dto.killSwitchWebhookUrl !== undefined
        ? { killSwitchWebhookUrl: dto.killSwitchWebhookUrl }
        : {}),
      ...(dto.killSwitchWaPhone !== undefined
        ? { killSwitchWaPhone: dto.killSwitchWaPhone }
        : {}),
      ...(dto.killSwitchWaApiKey !== undefined
        ? { killSwitchWaApiKey: dto.killSwitchWaApiKey }
        : {}),
      ...(dto.killSwitchCustomMessageTemplate !== undefined
        ? {
            killSwitchCustomMessageTemplate:
              dto.killSwitchCustomMessageTemplate,
          }
        : {}),
    };

    await this.prisma.globalConfig.upsert({
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
        hasSmtpUser: !!dto.killSwitchSmtpUser,
        hasWebhook: !!dto.killSwitchWebhookUrl,
        hasWaPhone: !!dto.killSwitchWaPhone,
      }),
    });

    return this.creditSelectors.getKillSwitchNotificationConfig(userId);
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

    const config = await this.prisma.globalConfig.findFirst({
      where: { userId },
    });

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

    let emailSent = false;
    let emailError: string | undefined;
    let webhookSent = false;
    let webhookError: string | undefined;

    // 1. Direct Gmail SMTP Delivery
    if (config?.killSwitchSmtpUser && config?.killSwitchSmtpAppPassword) {
      try {
        const transporter = nodemailer.createTransport({
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
            user: config.killSwitchSmtpUser,
            pass: config.killSwitchSmtpAppPassword,
          },
        });

        await transporter.sendMail({
          from: `"Sunday Funday Kill-Switch" <${config.killSwitchSmtpUser}>`,
          to: config.killSwitchNotifyEmail || config.killSwitchSmtpUser,
          subject: `[PENTING] Batalin ${item.label} sebelum ${deadline}!`,
          text: message,
        });
        emailSent = true;
      } catch (err: any) {
        emailError = err.message || 'Failed to send SMTP email';
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

    return {
      success:
        emailSent ||
        webhookSent ||
        (!config?.killSwitchSmtpUser && !config?.killSwitchWebhookUrl),
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
}
