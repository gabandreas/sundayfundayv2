import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
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
import { formatPeriodVaultLabel, extractPeriodTagFromLabel } from './savings.utils';
import { getPayrollPeriodForDate } from '../calculator/pacing';
import { resolveStudioConfig, SavingsPocketConfig } from '../config/studio.defaults';
import { SaveSavingsPocketsDto } from './dto/savings-pockets.dto';

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
  async createTransaction(dto: CreateSavingsTransactionDto, userId: number = 1) {
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
        userId,
        label: finalLabel,
        amount: signedAmount,
        instrumentType,
        date: txDate,
      },
    });

    const isWithdrawal = dto.type === SavingsTransactionType.WITHDRAWAL;
    const txPeriod = getPayrollPeriodForDate(txDate);
    await this.auditLogService.record({
      action: isWithdrawal ? 'SAVINGS_WITHDRAWAL' : 'SAVINGS_TOPUP',
      category: AuditCategory.SAVINGS,
      summary: `${isWithdrawal ? 'Withdrawal' : 'Top-up'} of Rp ${dto.amount} (${instrumentType}) from/to savings: "${finalLabel}"`,
      details: `Savings transaction #${created.id}, instrument: ${instrumentType}`,
      month: dto.periodMonth ?? txPeriod.month,
      year: dto.periodYear ?? txPeriod.year,
      severity: isWithdrawal ? AuditSeverity.WARNING : AuditSeverity.INFO,
    });

    return created;
  }

  async rebalanceInstrument(dto: RebalanceSavingsDto, userId: number = 1) {
    if (dto.fromInstrument === dto.toInstrument) {
      throw new BadRequestException(
        'Source and destination instruments must be different',
      );
    }

    const amount = Math.round(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Rebalance amount must be greater than Rp 0');
    }

    const allTxs = await this.prisma.savingsManualTransaction.findMany({
      where: { userId },
    });
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
          userId,
          label: `Internal Vault Rebalance: ${fromName} to ${toName}${customSuffix}`,
          amount: -amount,
          instrumentType: dto.fromInstrument,
          date: now,
        },
      }),
      this.prisma.savingsManualTransaction.create({
        data: {
          userId,
          label: `Internal Vault Rebalance: ${fromName} to ${toName}${customSuffix}`,
          amount,
          instrumentType: dto.toInstrument,
          date: now,
        },
      }),
    ]);

    const nowPeriod = getPayrollPeriodForDate(now);
    await this.auditLogService.record({
      action: 'SAVINGS_REBALANCE',
      category: AuditCategory.SAVINGS,
      summary: `Rebalanced Rp ${amount.toLocaleString('id-ID')} from ${fromName} to ${toName}`,
      details: `Debit #${debitTx.id}, Credit #${creditTx.id}`,
      month: nowPeriod.month,
      year: nowPeriod.year,
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

  async deleteTransaction(id: number, userId: number = 1) {
    const existing = await this.prisma.savingsManualTransaction.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings transaction #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied to savings transaction');
    }

    return this.prisma.savingsManualTransaction.delete({ where: { id } });
  }

  /**
   * 1-Click Period Deposit Confirmation from Monthly Savings Accumulation Ledger
   */
  async confirmPeriodDeposit(
    dto: {
      month?: number;
      periodMonth?: number;
      year?: number;
      periodYear?: number;
      amount: number;
      destination?: string;
      instrumentType?: SavingsInstrumentType;
      note?: string;
    },
    userId: number = 1,
  ) {
    const month = dto.month ?? dto.periodMonth;
    const year = dto.year ?? dto.periodYear;
    if (!month || !year) {
      throw new BadRequestException('Target period month and year are required');
    }
    if (dto.amount <= 0) {
      throw new BadRequestException('Deposit amount must be greater than Rp 0');
    }

    const existingTxs = await this.prisma.savingsManualTransaction.findMany({
      where: { userId },
      orderBy: { id: 'asc' },
    });
    const periodMatches = existingTxs.filter((tx) => {
      if ((tx.amount ?? 0) <= 0) return false;
      const tag = extractPeriodTagFromLabel(tx.label);
      return tag?.month === month && tag?.year === year;
    });
    const confirmedSum = periodMatches.reduce(
      (sum, tx) => sum + Math.round(Number(tx.amount) || 0),
      0,
    );
    if (periodMatches.length > 0 && confirmedSum >= Math.round(dto.amount)) {
      const latest = periodMatches[periodMatches.length - 1];
      return {
        ...latest,
        alreadyConfirmed: true,
        confirmedAmount: confirmedSum,
        transaction: latest,
      };
    }

    const cfg = this.prisma.globalConfig
      ? await this.prisma.globalConfig.findFirst({ where: { userId } })
      : null;
    const studioCfg = resolveStudioConfig(userId, cfg?.formulaParamsJson, cfg);
    const requestedInstrument =
      dto.instrumentType ??
      (dto.destination === 'INVESTMENT_RDPU'
        ? SavingsInstrumentType.INVESTMENT_RDPU
        : SavingsInstrumentType.LIQUID_CASH);
    const instrumentType =
      requestedInstrument === SavingsInstrumentType.INVESTMENT_RDPU &&
      studioCfg.enableExternalAssetPortfolio
        ? SavingsInstrumentType.INVESTMENT_RDPU
        : SavingsInstrumentType.LIQUID_CASH;

    const created = await this.createTransaction(
      {
        type: SavingsTransactionType.TOPUP,
        amount: dto.amount,
        label: dto.note ? `${dto.note} (${month}/${year})` : `P1 Savings Transfer (${month}/${year})`,
        date: new Date().toISOString(),
        instrumentType,
        periodMonth: month,
        periodYear: year,
      },
      userId,
    );

    return {
      ...created,
      alreadyConfirmed: false,
      confirmedAmount: created.amount,
      transaction: created,
    };
  }

  // -------------------------------------------------------------------------
  // Savings Goals CRUD
  // -------------------------------------------------------------------------

  async createGoal(
    dto: {
      name: string;
      targetAmount: number;
      targetMonth: number;
      targetYear: number;
      category?: string;
      currentAllocatedAmount?: number;
    },
    userId: number = 1,
  ) {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Goal name is required');
    }
    if (dto.targetAmount <= 0) {
      throw new BadRequestException('Target amount must be greater than Rp 0');
    }

    const created = await this.prisma.savingsGoal.create({
      data: {
        userId,
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
    userId: number = 1,
  ) {
    const existing = await this.prisma.savingsGoal.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings goal #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied to savings goal');
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

  async saveWealthTarget(
    dto: {
      targetAmount: number;
      targetMonth: number;
      targetYear: number;
      targetBase?: string;
    },
    userId: number = 1,
  ) {
    if (dto.targetAmount <= 0) {
      throw new BadRequestException('Target wealth amount must be greater than Rp 0');
    }
    const updatedConfig = await this.prisma.globalConfig.update({
      where: { userId },
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

  async deleteGoal(id: number, userId: number = 1) {
    const existing = await this.prisma.savingsGoal.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException(`Savings goal #${id} not found`);
    }
    if (existing.userId !== userId) {
      throw new ForbiddenException('Access denied to savings goal');
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

  async updateSavingsPockets(dto: SaveSavingsPocketsDto, userId: number = 1) {
    const [config, transactions] = await Promise.all([
      this.prisma.globalConfig.findFirst({ where: { userId } }),
      this.prisma.savingsManualTransaction.findMany({ where: { userId } }),
    ]);

    if (!config) {
      throw new NotFoundException('GlobalConfig not found for user');
    }

    const studioConfig = resolveStudioConfig(userId, config.formulaParamsJson, config);
    const rawBalance = transactions.reduce((sum, t) => sum + t.amount, 0);
    const hasP1Override =
      studioConfig.actualP1VaultBalanceRp !== null &&
      studioConfig.actualP1VaultBalanceRp !== undefined &&
      !Number.isNaN(Number(studioConfig.actualP1VaultBalanceRp));
    const totalConfirmedSavingsRp = hasP1Override
      ? Math.max(0, Math.round(Number(studioConfig.actualP1VaultBalanceRp)))
      : Math.max(0, Math.round(rawBalance));

    const cleanPockets: SavingsPocketConfig[] = (dto.pockets ?? []).map((p, idx) => {
      const alloc = Math.round(Number(p.allocatedRp));
      const target = Math.round(Number(p.targetRp ?? 0));
      if (!Number.isFinite(alloc) || alloc < 0) {
        throw new BadRequestException(
          `Allocation for "${p.name}" cannot be negative.`,
        );
      }
      if (!Number.isFinite(target) || target < 0) {
        throw new BadRequestException(
          `Target for "${p.name}" cannot be negative.`,
        );
      }
      return {
        id: String(p.id || `pocket_${idx + 1}`).trim(),
        key: String(p.key || p.id || `POCKET_${idx + 1}`).trim(),
        name: String(p.name || `Pocket ${idx + 1}`).trim(),
        category: p.category,
        allocatedRp: alloc,
        targetRp: target,
        notes: p.notes?.trim() || undefined,
      };
    });

    const totalAllocatedRp = cleanPockets.reduce((s, p) => s + p.allocatedRp, 0);
    if (totalAllocatedRp > totalConfirmedSavingsRp) {
      throw new BadRequestException(
        `Allocated pockets total (Rp ${totalAllocatedRp.toLocaleString('id-ID')}) exceeds confirmed savings pool (Rp ${totalConfirmedSavingsRp.toLocaleString('id-ID')}).`,
      );
    }

    const baseFormula =
      config.formulaParamsJson && typeof config.formulaParamsJson === 'object'
        ? { ...(config.formulaParamsJson as any) }
        : {};
    const nextStudio = {
      ...studioConfig,
      savingsPockets: cleanPockets,
    };

    await this.prisma.globalConfig.update({
      where: { id: config.id },
      data: {
        formulaParamsJson: {
          ...baseFormula,
          studioConfig: nextStudio,
        } as any,
      },
    });

    await this.auditLogService.record({
      action: 'SAVINGS_POCKETS_UPDATED',
      category: AuditCategory.SAVINGS,
      summary: `Updated ${cleanPockets.length} savings pocket allocations (Rp ${totalAllocatedRp.toLocaleString('id-ID')} allocated of Rp ${totalConfirmedSavingsRp.toLocaleString('id-ID')})`,
      details: JSON.stringify(cleanPockets),
      severity: AuditSeverity.INFO,
    });

    return {
      totalConfirmedSavingsRp,
      totalAllocatedRp,
      unallocatedPoolRp: Math.max(0, totalConfirmedSavingsRp - totalAllocatedRp),
      pockets: cleanPockets,
    };
  }
}
