import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { SnapshotsSelectors } from '../snapshots/snapshots.selectors';
import { AuditLogService } from '../audit/audit-log.service';
import { CreditService } from '../credit/credit.service';
import {
  Transaction,
  TransactionType,
  TransactionSourceType,
  AuditCategory,
  AuditSeverity,
  BudgetRevisionCategory,
  LiabilityCategory,
  CreditCardChargeType,
} from '@prisma/client';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { ExecuteReconcileBalanceDto } from './dto/reconcile-balance.dto';
import { CommitReconcilerDto } from './dto/hybrid-finance.dto';
import { FinanceSelectors } from './finance.selectors';
import {
  buildDefaultSandboxState,
  SandboxState,
} from '../config/sandbox.defaults';

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly snapshotsSelectors: SnapshotsSelectors,
    private readonly snapshotsService: SnapshotsService,
    private readonly auditLogService: AuditLogService,
    private readonly financeSelectors: FinanceSelectors,
    @Optional()
    @Inject(forwardRef(() => CreditService))
    private readonly creditService?: CreditService,
  ) {}

  async createTransaction(dto: CreateTransactionDto, userId: number = 1): Promise<any> {
    if (dto.type === TransactionType.CREDIT_BILL) {
      throw new BadRequestException(
        'CREDIT_BILL transactions cannot be created manually — they must be materialized via credit synchronization',
      );
    }

    // 1. Get or create draft snapshot for the transaction's month/year
    const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
      dto.month,
      dto.year,
      userId,
    );

    // 2. Assert snapshot is unlocked (rejects if LOCKED)
    await this.snapshotsService.assertSnapshotUnlocked(snapshot.id, undefined, userId);

    // Cross-Bucket Routing: PayLater / Credit Card (never drains Remaining Living Cash directly)
    if (
      dto.type === TransactionType.DEDUCTION &&
      !dto.isOperationalRefund &&
      dto.paymentMethod === 'PAYLATER'
    ) {
      if (!this.creditService) {
        throw new BadRequestException('CreditService is unavailable');
      }
      const hasExplicitCycle =
        Number.isInteger(dto.billingStartMonth) &&
        Number.isInteger(dto.billingStartYear);
      const schedule = await this.creditService.createLineItemSchedule(
        {
          title: dto.fixedEssentialCategory
            ? `${dto.label} [${dto.fixedEssentialCategory}]`
            : dto.label,
          category: LiabilityCategory.PAYLATER,
          merchantOrPlatform: 'SPayLater',
          totalAmount: Math.round(dto.amount),
          tenorMonths: dto.paylaterTenor ?? 1,
          startMonth: hasExplicitCycle ? dto.billingStartMonth! : dto.month,
          startYear: hasExplicitCycle ? dto.billingStartYear! : dto.year,
          purchaseDate: dto.date,
          holdPastCutoff: Boolean(dto.holdPastCutoff),
          autoRouteByCutoff: !hasExplicitCycle,
          notes: dto.fixedEssentialCategory
            ? `Routine category (${dto.fixedEssentialCategory}) paid via PayLater`
            : `Cross-bucket expense rolled from ${dto.month}/${dto.year} cash log`,
        },
        userId,
      );

      await this.auditLogService.record({
        action: 'CROSS_BUCKET_PAYLATER_ROUTE',
        category: AuditCategory.TRANSACTIONS,
        summary: `Routed "${dto.label}" (Rp ${Math.round(dto.amount).toLocaleString('id-ID')}) to PayLater matrix (${schedule.affectedPeriods.map((p) => `${p.month}/${p.year}`).join(', ')})`,
        details: JSON.stringify(dto),
        month: dto.month,
        year: dto.year,
        severity: AuditSeverity.INFO,
      });

      return {
        routedTo: 'PAYLATER',
        affectedPeriods: schedule.affectedPeriods,
        lineItems: schedule.items,
        amount: Math.round(dto.amount),
        label: dto.label,
      };
    }

    if (
      dto.type === TransactionType.DEDUCTION &&
      !dto.isOperationalRefund &&
      dto.paymentMethod === 'CC'
    ) {
      if (!this.creditService) {
        throw new BadRequestException('CreditService is unavailable');
      }
      const tenor = dto.paylaterTenor ?? 1;
      const cardTx = await this.creditService.createCardTransaction(
        {
          label: dto.label,
          amount: Math.round(dto.amount),
          totalAmount: Math.round(dto.amount),
          monthlyAmount: tenor > 1 ? Math.round(dto.amount / tenor) : undefined,
          chargeType:
            tenor > 1
              ? CreditCardChargeType.INSTALLMENT
              : CreditCardChargeType.FULL,
          tenor,
          category: dto.fixedEssentialCategory || 'General',
          transactionDate: dto.date,
          billingMonth: dto.billingStartMonth,
          billingYear: dto.billingStartYear,
          notes: 'Logged via cross-bucket Credit Card selector',
        },
        userId,
      );

      return {
        routedTo: 'CC',
        billingPeriod: {
          month: cardTx.billingMonth,
          year: cardTx.billingYear,
        },
        cardTransaction: cardTx,
        amount: Math.round(dto.amount),
        label: dto.label,
      };
    }

    // 3. Standard Cash / Income / Refund transaction creation
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

  async deleteTransaction(id: number, userId: number = 1): Promise<Transaction> {
    // 1. Find transaction and check existence + ownership
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { snapshot: true },
    });

    if (!existing) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    if (existing.snapshot && existing.snapshot.userId !== userId) {
      throw new ForbiddenException('Access denied to transaction');
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
    requestingUserId?: number,
  ): Promise<any> {
    const existing = await this.prisma.transaction.findUnique({
      where: { id },
      include: { snapshot: true },
    });

    if (!existing) {
      throw new NotFoundException(`Transaction #${id} not found`);
    }
    if (
      requestingUserId !== undefined &&
      existing.snapshot &&
      existing.snapshot.userId !== requestingUserId
    ) {
      throw new ForbiddenException('Access denied to transaction');
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

    const updatedLabel = dto.label !== undefined ? dto.label.trim() : existing.label;
    const updatedAmount = dto.amount !== undefined ? Math.round(dto.amount) : Math.round(existing.amount);
    const updatedDate = dto.date !== undefined ? new Date(dto.date) : existing.date;
    const updatedCategory =
      dto.fixedEssentialCategory !== undefined
        ? dto.fixedEssentialCategory
        : existing.fixedEssentialCategory;
    const userId = existing.snapshot?.userId ?? 1;

    // Cross-bucket conversion: convert an existing cash deduction into PayLater or Credit Card
    if (
      (dto.paymentMethod === 'PAYLATER' || dto.paymentMethod === 'CC') &&
      existing.type === TransactionType.DEDUCTION
    ) {
      if (!this.creditService) {
        throw new BadRequestException('CreditService is unavailable');
      }
      if (!existing.snapshot) {
        throw new BadRequestException('Snapshot metadata missing for transaction');
      }

      if (dto.paymentMethod === 'PAYLATER') {
        const schedule = await this.creditService.createLineItemSchedule(
          {
            title: updatedCategory ? `${updatedLabel} [${updatedCategory}]` : updatedLabel,
            category: LiabilityCategory.PAYLATER,
            merchantOrPlatform: 'SPayLater',
            totalAmount: updatedAmount,
            tenorMonths: 1,
            startMonth: existing.snapshot.month,
            startYear: existing.snapshot.year,
            purchaseDate: updatedDate.toISOString(),
            autoRouteByCutoff: true,
            dueDay: 25,
            notes: `Converted from cash transaction #${id}`,
          },
          userId,
        );

        await this.prisma.transaction.delete({ where: { id } });
        await this.snapshotsService.recalculateSnapshot(existing.snapshotId);

        await this.auditLogService.record({
          action: 'CONVERT_TRANSACTION_TO_PAYLATER',
          category: AuditCategory.TRANSACTIONS,
          summary: `Converted "${updatedLabel}" (Rp ${updatedAmount.toLocaleString('id-ID')}) from Cash to PayLater`,
          details: `Original Tx #${id}, routed to ${schedule.affectedPeriods.map((p) => `${p.month}/${p.year}`).join(', ')}`,
          month: existing.snapshot.month,
          year: existing.snapshot.year,
          severity: AuditSeverity.INFO,
        });

        return {
          convertedTo: 'PAYLATER',
          affectedPeriods: schedule.affectedPeriods,
          lineItems: schedule.items,
        };
      }

      const cardTx = await this.creditService.createCardTransaction(
        {
          label: updatedLabel,
          amount: updatedAmount,
          totalAmount: updatedAmount,
          chargeType: CreditCardChargeType.FULL,
          tenor: 1,
          category: updatedCategory || 'General',
          transactionDate: updatedDate.toISOString(),
          notes: `Converted from cash transaction #${id}`,
        },
        userId,
      );

      await this.prisma.transaction.delete({ where: { id } });
      await this.snapshotsService.recalculateSnapshot(existing.snapshotId);

      await this.auditLogService.record({
        action: 'CONVERT_TRANSACTION_TO_CC',
        category: AuditCategory.TRANSACTIONS,
        summary: `Converted "${updatedLabel}" (Rp ${updatedAmount.toLocaleString('id-ID')}) from Cash to Credit Card`,
        details: `Original Tx #${id}, billed to ${cardTx.billingMonth}/${cardTx.billingYear}`,
        month: existing.snapshot.month,
        year: existing.snapshot.year,
        severity: AuditSeverity.INFO,
      });

      return {
        convertedTo: 'CC',
        cardTransaction: cardTx,
      };
    }

    const updated = await this.prisma.transaction.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: updatedLabel }),
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.date !== undefined && { date: updatedDate }),
        ...(dto.fixedEssentialCategory !== undefined && {
          fixedEssentialCategory:
            existing.type === TransactionType.DEDUCTION ? dto.fixedEssentialCategory : null,
        }),
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
  async executeCashReconciliation(
    dto: ExecuteReconcileBalanceDto,
    userId: number = 1,
  ) {
    const snapshot = await this.snapshotsSelectors.getOrCreateDraftSnapshot(
      dto.month,
      dto.year,
      userId,
    );

    await this.snapshotsService.assertSnapshotUnlocked(snapshot.id, undefined, userId);

    const preview = await this.financeSelectors.previewCashReconciliation({
      month: dto.month,
      year: dto.year,
      actualRealBalance: dto.actualRealBalance,
      surplusResolutionMode: dto.surplusResolutionMode,
      includesUnspentRoutinePool: dto.includesUnspentRoutinePool,
      userId,
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

  async evaluateAndPersistWalletGuard(
    dto: {
      month: number;
      year: number;
      actualWalletBalance: number;
      reservedBillsTotal?: number;
      persist?: boolean;
      note?: string;
    },
    userId: number = 1,
  ) {
    const status = await this.financeSelectors.getWalletGuardStatus(
      dto.month,
      dto.year,
      userId,
      dto.actualWalletBalance,
      dto.reservedBillsTotal,
    );

    if (dto.persist && status.guard) {
      const snap = await this.prisma.monthlySnapshot.findUnique({
        where: { userId_month_year: { userId, month: dto.month, year: dto.year } },
      });
      if (snap && snap.status === 'LOCKED') {
        throw new BadRequestException(
          'Snapshot is locked and cannot accept wallet check-ins',
        );
      }
      const key = `${dto.year}-${dto.month}`;
      const record = {
        actualWalletBalance: Math.round(dto.actualWalletBalance),
        reservedBillsTotal: status.guard.reservedBillsTotal,
        freeSpendableCash: status.guard.freeSpendableCash,
        guardStatus: status.guard.guardStatus,
        checkedInAt: new Date().toISOString(),
        note: dto.note?.trim() || null,
      };
      const cfg = await this.prisma.globalConfig.findFirst({ where: { userId } });
      if (cfg) {
        const curPolicy = ((cfg.financialPolicyJson as any) ?? {}) as Record<string, any>;
        const walletCheckins = { ...(curPolicy.walletCheckins ?? {}), [key]: record };
        await this.prisma.globalConfig.update({
          where: { id: cfg.id },
          data: { financialPolicyJson: { ...curPolicy, walletCheckins } },
        });
      }
      return { ...status, savedCheckin: record };
    }

    return status;
  }

  async commitReconcilerRows(dto: CommitReconcilerDto, userId: number = 1) {
    const committed: any[] = [];
    for (const row of dto.rows ?? []) {
      const paymentMethod =
        row.instrument === 'PAYLATER'
          ? 'PAYLATER'
          : row.instrument === 'CREDIT_CARD'
            ? 'CC'
            : 'CASH';
      const created = await this.createTransaction(
        {
          month: row.targetPeriodMonth,
          year: row.targetPeriodYear,
          type: TransactionType.DEDUCTION,
          label: row.description,
          amount: Math.round(row.amountRp),
          date: row.dateIso,
          paymentMethod,
          paylaterTenor: 1,
        } as any,
        userId,
      );
      committed.push(created);
    }
    return {
      committedCount: committed.length,
      items: committed,
    };
  }
}
