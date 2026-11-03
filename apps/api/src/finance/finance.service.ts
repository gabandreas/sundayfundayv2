import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { AuditLogService } from '../audit/audit-log.service';
import {
  Transaction,
  TransactionType,
  TransactionSourceType,
  AuditCategory,
  AuditSeverity,
  BudgetRevisionCategory,
} from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ExecuteReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { FinanceSelectors } from './finance.selectors';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsSelectors: SnapshotsSelectors,
    private readonly snapshotsService: SnapshotsService,
    private readonly auditLogService: AuditLogService,
    private readonly financeSelectors: FinanceSelectors,
  ) {}

  async createTransaction(dto: CreateTransactionDto): Promise<Transaction> {
    if (dto.type === TransactionType.CREDIT_BILL) {
      throw new BadRequestException(
        'CREDIT_BILL transactions cannot be created manually — they must be materialized via credit synchronization',
      );
    }

    // 1. Get or create draft snapshot for the transaction's month/year
    const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
      dto.month,
      dto.year,
    );

    // 2. Assert snapshot is unlocked (rejects if LOCKED)
    await this.snapshotsService.assertSnapshotUnlocked(snapshot.id);

    // 3. Create transaction with appropriate sourceType and optional fixedEssentialCategory
    const isRefund = Boolean(dto.isOperationalRefund);
    const effectiveType = isRefund ? TransactionType.INCOME : dto.type;
    const effectiveSourceType = isRefund
      ? TransactionSourceType.OPERATIONAL_REFUND
      : TransactionSourceType.MANUAL;

    const tx = await this.prisma.transaction.create({
      data: {
        snapshotId: snapshot.id,
        type: effectiveType,
        sourceType: effectiveSourceType,
        sourceId: null,
        fixedEssentialCategory:
          effectiveType === TransactionType.DEDUCTION
            ? (dto.fixedEssentialCategory ?? null)
            : null,
        bucketKey: dto.bucketKey ?? null,
        label: dto.label,
        amount: dto.amount,
        date: new Date(dto.date),
      },
    });

    // 4. Recalculate snapshot derived fields
    await this.snapshotsService.recalculateSnapshot(snapshot.id);

    // 5. Audit log side effect
    await this.auditLogService.record({
      action: 'CREATE_TRANSACTION',
      category: AuditCategory.TRANSACTIONS,
      summary: `Created transaction "${tx.label}" (${tx.type}) for Rp ${tx.amount}`,
      details: `Transaction #${tx.id}, sourceType: ${tx.sourceType}`,
      month: snapshot.month,
      year: snapshot.year,
      severity: AuditSeverity.INFO,
    });

    return tx;
  }

  async deleteTransaction(id: number): Promise<Transaction> {
    // 1. Find transaction and check existence
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { snapshot: true },
    });

    if (!existing) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    if (
      existing.sourceType !== TransactionSourceType.MANUAL &&
      existing.sourceType !== TransactionSourceType.OPERATIONAL_REFUND
    ) {
      throw new BadRequestException(
        `Cannot delete transaction #${id}: transactions with source "${existing.sourceType}" are managed through Credit & Liabilities`,
      );
    }

    // 2. Assert parent snapshot is unlocked (rejects if LOCKED)
    await this.snapshotsService.assertSnapshotUnlocked(existing.snapshotId);

    // 3. Delete transaction
    const deleted = await this.prisma.transaction.delete({
      where: { id },
    });

    // 4. Recalculate parent snapshot
    await this.snapshotsService.recalculateSnapshot(existing.snapshotId);

    // 5. Audit log side effect
    await this.auditLogService.record({
      action: 'DELETE_TRANSACTION',
      category: AuditCategory.TRANSACTIONS,
      summary: `Deleted transaction "${deleted.label}" for Rp ${deleted.amount}`,
      details: `Transaction #${deleted.id}, snapshot #${existing.snapshotId}`,
      month: existing.snapshot?.month ?? null,
      year: existing.snapshot?.year ?? null,
      severity: AuditSeverity.INFO,
    });

    return deleted;
  }

  async updateTransaction(
    id: number,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { snapshot: true },
    });

    if (!existing) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }

    if (
      existing.sourceType !== TransactionSourceType.MANUAL &&
      existing.sourceType !== TransactionSourceType.OPERATIONAL_REFUND
    ) {
      throw new BadRequestException(
        `Cannot edit transaction #${id}: transactions with source "${existing.sourceType}" are managed through Credit & Liabilities`,
      );
    }

    await this.snapshotsService.assertSnapshotUnlocked(existing.snapshotId);

    if (dto.amount !== undefined && dto.amount <= 0) {
      throw new BadRequestException('Amount must be greater than Rp 0');
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label.trim() }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.date !== undefined && { date: new Date(dto.date) }),
      },
    });

    await this.snapshotsService.recalculateSnapshot(existing.snapshotId);

    await this.auditLogService.record({
      action: 'UPDATE_TRANSACTION',
      category: AuditCategory.TRANSACTIONS,
      summary: `Updated transaction #${id} ("${updated.label}") to Rp ${updated.amount}`,
      details: `Previous: "${existing.label}" for Rp ${existing.amount}`,
      month: existing.snapshot?.month ?? null,
      year: existing.snapshot?.year ?? null,
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  /**
   * Executes Cash Balance Reconciliation ("Cash Opname") for an unlocked period.
   * - Rejects if snapshot is LOCKED or if varianceAmount === 0.
   * - For SHORTFALL (variance < 0): creates a MANUAL DEDUCTION transaction and recalculates snapshot.
   * - For SURPLUS (variance > 0):
   *    - INCREASE_OPERATIONAL_TARGET: revises DAILY_OPERATIONAL target upward by +adjustmentAmount via createBudgetRevision.
   *    - RECORD_INCOME_ADJUSTMENT: creates a MANUAL INCOME transaction and recalculates snapshot.
   */
  async executeCashReconciliation(dto: ExecuteReconcileBalanceDto) {
    const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
      dto.month,
      dto.year,
    );

    await this.snapshotsService.assertSnapshotUnlocked(snapshot.id);

    const preview = await this.financeSelectors.previewCashReconciliation({
      month: dto.month,
      year: dto.year,
      actualRealBalance: dto.actualRealBalance,
      surplusResolutionMode: dto.surplusResolutionMode,
      includesUnspentRoutinePool: dto.includesUnspentRoutinePool,
    });

    if (preview.resolvedActionType === 'NO_OP' || preview.adjustmentAmount <= 0) {
      throw new BadRequestException(
        'Actual balance already matches system remaining operational budget (variance is Rp 0)',
      );
    }

    const customNote = dto.note?.trim() ?? '';
    const txDate = new Date(
      Date.UTC(dto.year, dto.month - 1, Math.min(28, new Date().getUTCDate())),
    );

    const severityRatio =
      preview.current.safeToSpendToday > 0
        ? Math.round(
            (Math.abs(preview.varianceAmount) /
              preview.current.safeToSpendToday) *
              10,
          ) / 10
        : 1;

    const checkpointAuditDetails = JSON.stringify({
      previousRemainingCash: preview.systemRemainingBudget,
      reportedBankBalance: preview.actualRealBalance,
      unspentRoutineOffset: preview.includesUnspentRoutinePool
        ? preview.remainingRoutineBillsPool
        : 0,
      effectiveOperationalCash: preview.effectiveOperationalCashBalance,
      delta: preview.varianceAmount,
      severityRatio,
      note: customNote || null,
      actionType: preview.resolvedActionType,
    });

    if (preview.resolvedActionType === 'RECORD_DEDUCTION_ADJUSTMENT') {
      const label =
        customNote || 'Balance Checkpoint: Unitemized Daily Spend';

      const createdTx = await this.prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.DEDUCTION,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label,
          amount: preview.adjustmentAmount,
          date: txDate,
        },
      });

      const updatedSnapshot = await this.snapshotsService.recalculateSnapshot(
        snapshot.id,
      );

      await this.auditLogService.record({
        action: 'BALANCE_CHECKPOINT_SYNCED',
        category: AuditCategory.TRANSACTIONS,
        summary: `Reconciled cash shortfall of Rp ${preview.adjustmentAmount} (${severityRatio}x daily limit) for ${dto.month}/${dto.year}`,
        details: checkpointAuditDetails,
        month: dto.month,
        year: dto.year,
        severity:
          severityRatio > 2
            ? AuditSeverity.WARNING
            : preview.impact.triggersWaterfallDeficit
              ? AuditSeverity.DEFICIT
              : AuditSeverity.ADJUSTMENT,
      });

      return {
        appliedActionType: preview.resolvedActionType,
        preview,
        transaction: createdTx,
        revision: null,
        snapshot: updatedSnapshot,
      };
    }

    if (preview.resolvedActionType === 'RECORD_INCOME_ADJUSTMENT') {
      const label = customNote
        ? `Cash Balance Reconciliation (Surplus): ${customNote}`
        : 'Cash Balance Reconciliation (Surplus)';

      const createdTx = await this.prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.INCOME,
          sourceType: TransactionSourceType.MANUAL,
          sourceId: null,
          label,
          amount: preview.adjustmentAmount,
          date: txDate,
        },
      });

      const updatedSnapshot = await this.snapshotsService.recalculateSnapshot(
        snapshot.id,
      );

      await this.auditLogService.record({
        action: 'BALANCE_CHECKPOINT_SYNCED',
        category: AuditCategory.TRANSACTIONS,
        summary: `Reconciled cash surplus of +Rp ${preview.adjustmentAmount} as Extra Income for ${dto.month}/${dto.year}`,
        details: checkpointAuditDetails,
        month: dto.month,
        year: dto.year,
        severity: AuditSeverity.ADJUSTMENT,
      });

      return {
        appliedActionType: preview.resolvedActionType,
        preview,
        transaction: createdTx,
        revision: null,
        snapshot: updatedSnapshot,
      };
    }

    if (preview.resolvedActionType === 'RECORD_OPERATIONAL_REFUND') {
      const label =
        customNote || 'Balance Checkpoint: Operational Balance Correction';

      const createdTx = await this.prisma.transaction.create({
        data: {
          snapshotId: snapshot.id,
          type: TransactionType.INCOME,
          sourceType: TransactionSourceType.OPERATIONAL_REFUND,
          sourceId: null,
          label,
          amount: preview.adjustmentAmount,
          date: txDate,
        },
      });

      const updatedSnapshot = await this.snapshotsService.recalculateSnapshot(
        snapshot.id,
      );

      await this.auditLogService.record({
        action: 'BALANCE_CHECKPOINT_SYNCED',
        category: AuditCategory.TRANSACTIONS,
        summary: `Reconciled cash surplus of +Rp ${preview.adjustmentAmount} via Operational Refund offset for ${dto.month}/${dto.year}`,
        details: checkpointAuditDetails,
        month: dto.month,
        year: dto.year,
        severity: AuditSeverity.ADJUSTMENT,
      });

      return {
        appliedActionType: preview.resolvedActionType,
        preview,
        transaction: createdTx,
        revision: null,
        snapshot: updatedSnapshot,
      };
    }

    // REVISE_OPERATIONAL_TARGET (Surplus -> increase DAILY_OPERATIONAL target)
    const reason = customNote
      ? `Cash Balance Reconciliation: ${customNote}`
      : 'Cash Balance Reconciliation (Operational Surplus)';

    const revResult = await this.snapshotsService.createBudgetRevision(
      snapshot.id,
      {
        category: BudgetRevisionCategory.DAILY_OPERATIONAL,
        newValue: preview.projected.dailyOperationalTarget,
        reason,
      },
    );

    await this.auditLogService.record({
      action: 'BALANCE_CHECKPOINT_SYNCED',
      category: AuditCategory.BUDGET,
      summary: `Reconciled operational cash surplus of +Rp ${preview.adjustmentAmount} for ${dto.month}/${dto.year}`,
      details: checkpointAuditDetails,
      month: dto.month,
      year: dto.year,
      severity: AuditSeverity.ADJUSTMENT,
    });

    return {
      appliedActionType: preview.resolvedActionType,
      preview,
      transaction: null,
      revision: revResult.revision,
      snapshot: revResult.snapshot,
    };
  }
}
