import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  AuditCategory,
  AuditSeverity,
  SavingsInstrumentType,
} from '@prisma/client';
import {
  CreateSavingsTransactionDto,
  RebalanceSavingsDto,
  SavingsTransactionType,
} from './dto/create-savings-transaction.dto';
import { formatPeriodVaultLabel } from './savings.utils';

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Creates a savings transaction.
   * Amount is stored signed: positive for TOPUP, negative for WITHDRAWAL.
   * The caller provides a positive magnitude; this service applies the sign.
   */
  async createTransaction(dto: CreateSavingsTransactionDto) {
    const signedAmount =
      dto.type === SavingsTransactionType.TOPUP ? dto.amount : -dto.amount;

    const finalLabel =
      dto.type === SavingsTransactionType.TOPUP &&
      dto.periodMonth &&
      dto.periodYear
        ? formatPeriodVaultLabel(dto.label, dto.periodMonth, dto.periodYear)
        : dto.label.trim();

    const txDate = new Date(dto.date);
    const instrumentType =
      dto.instrumentType ?? SavingsInstrumentType.LIQUID_CASH;

    const created = await this.prisma.savingsManualTransaction.create({
      data: {
        label: finalLabel,
        amount: signedAmount,
        instrumentType,
        date: txDate,
      },
    });

    const isWithdrawal = dto.type === SavingsTransactionType.WITHDRAWAL;
    await this.auditLogService.record({
      action: isWithdrawal ? 'SAVINGS_WITHDRAWAL' : 'SAVINGS_TOPUP',
      category: AuditCategory.SAVINGS,
      summary: `${isWithdrawal ? 'Withdrawal' : 'Top-up'} of Rp ${dto.amount} (${instrumentType}) from/to savings: "${finalLabel}"`,
      details: `Savings transaction #${created.id}, instrument: ${instrumentType}`,
      month: dto.periodMonth ?? txDate.getMonth() + 1,
      year: dto.periodYear ?? txDate.getFullYear(),
      severity: isWithdrawal ? AuditSeverity.WARNING : AuditSeverity.INFO,
    });

    return created;
  }

  async rebalanceInstrument(dto: RebalanceSavingsDto) {
    if (dto.fromInstrument === dto.toInstrument) {
      throw new BadRequestException(
        'Source and destination instruments must be different',
      );
    }

    const amount = Math.round(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Rebalance amount must be greater than Rp 0');
    }

    const allTxs = await this.prisma.savingsManualTransaction.findMany();
    const fromBalance = allTxs
      .filter(
        (t) =>
          (t.instrumentType ?? SavingsInstrumentType.LIQUID_CASH) ===
          dto.fromInstrument,
      )
      .reduce((sum, t) => sum + t.amount, 0);

    if (amount > fromBalance) {
      throw new BadRequestException(
        `Insufficient balance in ${dto.fromInstrument} (available: Rp ${fromBalance.toLocaleString('id-ID')}, requested: Rp ${amount.toLocaleString('id-ID')})`,
      );
    }

    const now = new Date();
    const fromName =
      dto.fromInstrument === SavingsInstrumentType.INVESTMENT_RDPU
        ? 'Investment RDPU'
        : 'Liquid Emergency Cash';
    const toName =
      dto.toInstrument === SavingsInstrumentType.INVESTMENT_RDPU
        ? 'Investment RDPU'
        : 'Liquid Emergency Cash';
    const customSuffix = dto.note?.trim() ? ` — ${dto.note.trim()}` : '';

    const [debitTx, creditTx] = await this.prisma.$transaction([
      this.prisma.savingsManualTransaction.create({
        data: {
          label: `Internal Vault Rebalance: ${fromName} to ${toName}${customSuffix}`,
          amount: -amount,
          instrumentType: dto.fromInstrument,
          date: now,
        },
      }),
      this.prisma.savingsManualTransaction.create({
        data: {
          label: `Internal Vault Rebalance: ${fromName} to ${toName}${customSuffix}`,
          amount,
          instrumentType: dto.toInstrument,
          date: now,
        },
      }),
    ]);

    await this.auditLogService.record({
      action: 'SAVINGS_REBALANCE',
      category: AuditCategory.SAVINGS,
      summary: `Rebalanced Rp ${amount.toLocaleString('id-ID')} from ${fromName} to ${toName}`,
      details: `Debit #${debitTx.id}, Credit #${creditTx.id}`,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      severity: AuditSeverity.INFO,
    });

    return {
      amount,
      fromInstrument: dto.fromInstrument,
      toInstrument: dto.toInstrument,
      debitTransaction: debitTx,
      creditTransaction: creditTx,
    };
  }

  async deleteTransaction(id: number) {
    const existing = await this.prisma.savingsManualTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings transaction #${id} not found`);
    }

    return this.prisma.savingsManualTransaction.delete({ where: { id } });
  }

  /**
   * 1-Click Period Deposit Confirmation from Monthly Savings Accumulation Ledger
   */
  async confirmPeriodDeposit(dto: {
    month?: number;
    periodMonth?: number;
    year?: number;
    periodYear?: number;
    amount: number;
    destination?: string;
    instrumentType?: SavingsInstrumentType;
    note?: string;
  }) {
    const month = dto.month ?? dto.periodMonth;
    const year = dto.year ?? dto.periodYear;
    if (!month || !year) {
      throw new BadRequestException('Target period month and year are required');
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than Rp 0');
    }

    const instrumentType =
      dto.instrumentType ??
      (dto.destination === 'INVESTMENT_RDPU'
        ? SavingsInstrumentType.INVESTMENT_RDPU
        : SavingsInstrumentType.LIQUID_CASH);

    return this.createTransaction({
      type: SavingsTransactionType.TOPUP,
      amount: dto.amount,
      label: dto.note ? `${dto.note} (${month}/${year})` : `P1 Savings Transfer (${month}/${year})`,
      date: new Date().toISOString(),
      instrumentType,
      periodMonth: month,
      periodYear: year,
    });
  }

  // -------------------------------------------------------------------------
  // Savings Goals CRUD
  // -------------------------------------------------------------------------

  async createGoal(dto: {
    name: string;
    targetAmount: number;
    targetMonth: number;
    targetYear: number;
    category?: string;
    currentAllocatedAmount?: number;
  }) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Goal name is required');
    }
    if (dto.targetAmount <= 0) {
      throw new BadRequestException('Target amount must be greater than Rp 0');
    }

    const created = await this.prisma.savingsGoal.create({
      data: {
        name: dto.name.trim(),
        targetAmount: dto.targetAmount,
        targetMonth: dto.targetMonth,
        targetYear: dto.targetYear,
        category: dto.category?.trim() || 'GENERAL',
        currentAllocatedAmount: dto.currentAllocatedAmount ?? 0,
        isCompleted: false,
      },
    });

    await this.auditLogService.record({
      action: 'SAVINGS_GOAL_CREATED',
      category: AuditCategory.SAVINGS,
      summary: `Created savings goal "${created.name}" for Rp ${created.targetAmount.toLocaleString('id-ID')} target ${created.targetMonth}/${created.targetYear}`,
      details: `Savings goal #${created.id}`,
      month: created.targetMonth,
      year: created.targetYear,
      severity: AuditSeverity.INFO,
    });

    return created;
  }

  async updateGoal(
    id: number,
    dto: {
      name?: string;
      targetAmount?: number;
      targetMonth?: number;
      targetYear?: number;
      category?: string;
      currentAllocatedAmount?: number;
      isCompleted?: boolean;
    },
  ) {
    const existing = await this.prisma.savingsGoal.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings goal #${id} not found`);
    }

    const updated = await this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.targetAmount !== undefined ? { targetAmount: dto.targetAmount } : {}),
        ...(dto.targetMonth !== undefined ? { targetMonth: dto.targetMonth } : {}),
        ...(dto.targetYear !== undefined ? { targetYear: dto.targetYear } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.currentAllocatedAmount !== undefined
          ? { currentAllocatedAmount: dto.currentAllocatedAmount }
          : {}),
        ...(dto.isCompleted !== undefined ? { isCompleted: dto.isCompleted } : {}),
      },
    });

    await this.auditLogService.record({
      action: 'SAVINGS_GOAL_UPDATED',
      category: AuditCategory.SAVINGS,
      summary: `Updated savings goal "${updated.name}" (#${updated.id})`,
      details: JSON.stringify(dto),
      month: updated.targetMonth,
      year: updated.targetYear,
      severity: AuditSeverity.INFO,
    });

    if (
      existing.wishlistItemId &&
      updated.currentAllocatedAmount >= updated.targetAmount
    ) {
      await this.prisma.wishlistItem.update({
        where: { id: existing.wishlistItemId },
        data: { status: 'READY' },
      });
    }

    return updated;
  }

  async saveWealthTarget(dto: {
    targetAmount: number;
    targetMonth: number;
    targetYear: number;
    targetBase?: string;
  }) {
    if (dto.targetAmount <= 0) {
      throw new BadRequestException('Target wealth amount must be greater than Rp 0');
    }
    const updatedConfig = await this.prisma.globalConfig.update({
      where: { userId: 1 },
      data: {
        targetWealthAmount: dto.targetAmount,
        targetWealthMonth: dto.targetMonth,
        targetWealthYear: dto.targetYear,
        targetWealthBase: dto.targetBase ?? 'CONFIRMED_VAULT',
      },
    });

    await this.auditLogService.record({
      action: 'SAVINGS_WEALTH_TARGET_UPDATED',
      category: AuditCategory.SAVINGS,
      summary: `Updated master wealth target to Rp ${dto.targetAmount.toLocaleString('id-ID')} target ${dto.targetMonth}/${dto.targetYear}`,
      details: JSON.stringify(dto),
      severity: AuditSeverity.INFO,
    });

    return updatedConfig;
  }

  async deleteGoal(id: number) {
    const existing = await this.prisma.savingsGoal.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings goal #${id} not found`);
    }

    const deleted = await this.prisma.savingsGoal.delete({ where: { id } });

    await this.auditLogService.record({
      action: 'SAVINGS_GOAL_DELETED',
      category: AuditCategory.SAVINGS,
      summary: `Deleted savings goal "${deleted.name}" (#${id})`,
      details: `Target was Rp ${deleted.targetAmount.toLocaleString('id-ID')}`,
      month: deleted.targetMonth,
      year: deleted.targetYear,
      severity: AuditSeverity.INFO,
    });

    return deleted;
  }
}
