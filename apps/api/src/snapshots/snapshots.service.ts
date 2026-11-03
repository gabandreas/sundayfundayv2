import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SnapshotsSelectors } from './snapshots.selectors';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';
import {
  SnapshotStatus,
  Prisma,
  MonthlySnapshot,
  SavingsManualTransaction,
  AuditCategory,
  AuditSeverity,
  BudgetRevisionCategory,
} from '@prisma/client';
import {
  calculatePayroll,
  sumExtraIncome,
  calculateAdjustedBaseSalary,
  calculateDecemberProratedThr,
} from '../calculator/payroll';
import {
  calculateOperationalDailySpent,
  calculateTotalDeductions,
  calculateWaterfall,
} from '../calculator/waterfall';
import { calculateDailyPacing, normalizeDate } from '../calculator/pacing';
import {
  evaluateModularEngine,
  synthesizeRulesFromSnapshot,
  buildDefaultPayrollRules,
  buildDefaultAllocationBuckets,
  buildDefaultSurplusSplitRules,
  buildDefaultFinancialPolicy,
} from '../calculator/modular-engine';
import { UpdateSnapshotDto } from './dto/update-snapshot.dto';
import { CreateBudgetRevisionDto } from './dto/create-budget-revision.dto';
import { PreviewBudgetRevisionDto } from './dto/preview-budget-revision.dto';
import { ClosePeriodDto } from './dto/close-period.dto';
import { formatPeriodVaultLabel } from '../savings/savings.utils';

@Injectable()
export class SnapshotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    @Optional()
    @Inject(forwardRef(() => SnapshotsSelectors))
    private readonly selectors?: SnapshotsSelectors,
  ) {}

  /**
   * Asserts that a snapshot exists and its status is DRAFT.
   * Throws BadRequestException if the snapshot is LOCKED.
   * Can be called by other domain services (finance, credit, etc.) to enforce lock integrity.
   */
  async assertSnapshotUnlocked(
    snapshotId: number,
    tx?: Prisma.TransactionClient,
  ): Promise<MonthlySnapshot> {
    const client = tx ?? this.prisma;
    const snapshot = await client.monthlySnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${snapshotId} not found`);
    }

    if (snapshot.status === SnapshotStatus.LOCKED) {
      throw new BadRequestException(
        'Snapshot is locked and cannot be modified',
      );
    }

    return snapshot;
  }

  /**
   * Recalculates stored fields on a snapshot from its current inputs and transactions.
   * Rejects immediately if the snapshot is LOCKED.
   */
  async recalculateSnapshot(
    snapshotId: number,
    txClient?: Prisma.TransactionClient,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const snapshot = await tx.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshotId },
        include: { budgetRevisions: true },
      });
      if (snapshot.status === SnapshotStatus.LOCKED) {
        throw new BadRequestException('Cannot recalculate a locked snapshot');
      }

      const config =
        (await tx.globalConfig.findUnique({ where: { userId: snapshot.userId } })) ||
        (await tx.globalConfig.findFirst({ where: { userId: snapshot.userId } })) ||
        (await tx.globalConfig.findFirst({ where: { userId: 1 } }));
      if (!config) {
        throw new BadRequestException(
          'Global configuration has not been initialized',
        );
      }

      const transactions = await tx.transaction.findMany({
        where: { snapshotId },
      });

      const extraIncome = sumExtraIncome(transactions);

      const payroll = calculatePayroll({
        baseSalary: config.baseSalary,
        salaryAdjustment: snapshot.salaryAdjustment,
        totalWorkingDays: snapshot.totalWorkingDays,
        dailyAllowance: config.dailyAllowance,
        cafeteriaDeduction: snapshot.cafeteriaDeduction,
        thrAmount: snapshot.thrAmount,
        bonusAmount: snapshot.bonusAmount,
        extraIncome,
        laptopAllowance: config.laptopAllowance,
      });

      const fixedTargets = {
        transport: snapshot.transport,
        internet: snapshot.internet,
        vape: snapshot.vape,
        haircut: snapshot.haircut,
      };

      const effectiveDailyOperational = (() => {
        if (snapshot.budgetRevisions && snapshot.budgetRevisions.length > 0) {
          const revs = [...snapshot.budgetRevisions].reverse();
          const dailyRev = revs.find(
            (r) =>
              r.category === 'DAILY_OPERATIONAL' ||
              r.bucketKey?.toLowerCase() === 'daily_operational',
          );
          if (dailyRev) return dailyRev.newValue;
        }
        return snapshot.dailyOperational;
      })();

      const totalDeductions = calculateTotalDeductions(
        transactions,
        fixedTargets,
        effectiveDailyOperational,
      );

      const totalCreditBills = transactions
        .filter((t) => t.type === 'CREDIT_BILL')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const modularRules =
        (snapshot.frozenRulesJson as any) ||
        synthesizeRulesFromSnapshot({
          ...snapshot,
          dailyAllowance: config.dailyAllowance,
          laptopAllowance: config.laptopAllowance,
        });

      const modularResult = evaluateModularEngine({
        baseSalary: config.baseSalary,
        salaryAdjustment: snapshot.salaryAdjustment,
        totalWorkingDays: snapshot.totalWorkingDays,
        dailyAllowance: config.dailyAllowance,
        cafeteriaDeduction: snapshot.cafeteriaDeduction,
        thrAmount: snapshot.thrAmount,
        bonusAmount: snapshot.bonusAmount,
        extraIncome,
        month: snapshot.month,
        year: snapshot.year,
        cycleDays: 30,
        totalCreditBills,
        totalDeductions,
        payrollRules: modularRules.payrollRules,
        allocationBuckets: modularRules.allocationBuckets,
        surplusSplitRules: modularRules.surplusSplitRules,
        financialPolicy: modularRules.financialPolicy,
        formulaEngineType:
          snapshot.userId === 1 && !config.formulaEngineType
            ? 'DEBT_FIRST_WATERFALL'
            : ((config.formulaEngineType as any) || 'DEBT_FIRST_WATERFALL'),
        formulaParams: (config.formulaParamsJson as any) || null,
        budgetRevisions: snapshot.budgetRevisions,
        transactions,
      });

      return tx.monthlySnapshot.update({
        where: { id: snapshotId },
        data: {
          netSalaryIncome: modularResult.payroll.netSalaryIncome,
          extraIncome: payroll.extraIncome,
          finalTotalIncome: modularResult.payroll.finalTotalIncome,
          totalDeductions,
          actualDailyOperational: modularResult.waterfall.actualDailyOperational,
          actualSavings: modularResult.waterfall.actualSavings,
          selfReward: modularResult.waterfall.actualSelfReward,
          deficitUncovered: modularResult.waterfall.deficitUncovered,
          survivalPocket: modularResult.waterfall.survivalPocket,
          bucketRealizationsJson: modularResult.bucketRealizations as any,
          ...(snapshot.frozenRulesJson
            ? {
                transport: modularResult.canonicalSnapshotColumns.transport,
                internet: modularResult.canonicalSnapshotColumns.internet,
                vape: modularResult.canonicalSnapshotColumns.vape,
                haircut: modularResult.canonicalSnapshotColumns.haircut,
                dailyOperational: modularResult.canonicalSnapshotColumns.dailyOperational,
                savings: modularResult.canonicalSnapshotColumns.savings,
                selfRewardTarget: modularResult.canonicalSnapshotColumns.selfRewardTarget,
                bufferPocket: modularResult.canonicalSnapshotColumns.bufferPocket,
              }
            : {}),
        },
        include: {
          transactions: true,
          budgetRevisions: true,
        },
      });
    };

    return txClient ? execute(txClient) : this.prisma.$transaction(execute);
  }

  /**
   * Updates editable fields on a DRAFT snapshot and recalculates derived figures.
   * If useDecemberProratedThr is provided, computes THR server-side using the pure calculator.
   * Rejects immediately if snapshot is LOCKED.
   */
  async updateSnapshot(id: number, dto: UpdateSnapshotDto) {
    if (id === 999999) {
      const globalConfig = await this.prisma.globalConfig.findFirst({
        where: { userId: 1 },
      });
      const sandbox =
        (globalConfig?.sandboxStateJson as any) || buildDefaultSandboxState();
      if (dto.totalWorkingDays !== undefined)
        sandbox.persona.totalWorkingDays = dto.totalWorkingDays;
      if ((dto as any).dailyOperational !== undefined)
        sandbox.persona.dailyLivingBudget = (dto as any).dailyOperational;
      if (dto.payrollPayoutDate !== undefined && dto.payrollPayoutDate) {
        const d = new Date(dto.payrollPayoutDate);
        if (!isNaN(d.getDate())) sandbox.persona.paydayAnchor = d.getDate();
      }
      await this.prisma.globalConfig.update({
        where: { userId: 1 },
        data: { sandboxStateJson: sandbox },
      });
      return (
        this.selectors?.buildSandboxSnapshot(
          sandbox,
          sandbox.month || 10,
          sandbox.year || 2026,
        ) ?? (sandbox as any)
      );
    }

    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Assert snapshot is unlocked (rejects if LOCKED)
      const snapshot = await this.assertSnapshotUnlocked(id, tx);

      const config =
        (await tx.globalConfig.findUnique({ where: { userId: snapshot.userId } })) ||
        (await tx.globalConfig.findFirst({ where: { userId: snapshot.userId } })) ||
        (await tx.globalConfig.findFirst({ where: { userId: 1 } }));
      if (!config) {
        throw new BadRequestException(
          'Global configuration has not been initialized',
        );
      }

      // 2. Compute pro-rated THR server-side if toggle is passed or thrAmount is provided
      let thrAmount = snapshot.thrAmount;
      if (dto.thrAmount !== undefined) {
        thrAmount = dto.thrAmount;
      } else if (dto.useDecemberProratedThr !== undefined) {
        if (dto.useDecemberProratedThr) {
          const effectiveAdjustment =
            dto.salaryAdjustment !== undefined
              ? dto.salaryAdjustment
              : snapshot.salaryAdjustment;
          const adjustedBase = calculateAdjustedBaseSalary(
            config.baseSalary,
            effectiveAdjustment,
          );
          thrAmount = calculateDecemberProratedThr(adjustedBase);
        } else {
          thrAmount = 0;
        }
      }

      // 3. Update snapshot record
      await tx.monthlySnapshot.update({
        where: { id },
        data: {
          ...(dto.totalWorkingDays !== undefined && {
            totalWorkingDays: dto.totalWorkingDays,
          }),
          ...(dto.cafeteriaDeduction !== undefined && {
            cafeteriaDeduction: dto.cafeteriaDeduction,
          }),
          ...(dto.bonusAmount !== undefined && {
            bonusAmount: dto.bonusAmount,
          }),
          ...(dto.salaryAdjustment !== undefined && {
            salaryAdjustment: dto.salaryAdjustment,
          }),
          ...(dto.thrAmount !== undefined || dto.useDecemberProratedThr !== undefined
            ? { thrAmount }
            : {}),
          ...(dto.payrollPayoutDate !== undefined && {
            payrollPayoutDate: dto.payrollPayoutDate ? new Date(dto.payrollPayoutDate) : null,
            isPayoutDateConfirmed: true,
          }),
        },
      });

      // 4. Recalculate derived waterfall fields within same transaction if financial inputs changed
      const hasFinancialChanges =
        dto.totalWorkingDays !== undefined ||
        dto.cafeteriaDeduction !== undefined ||
        dto.bonusAmount !== undefined ||
        dto.salaryAdjustment !== undefined ||
        dto.useDecemberProratedThr !== undefined ||
        dto.thrAmount !== undefined;

      if (hasFinancialChanges) {
        return this.recalculateSnapshot(id, tx);
      }

      return tx.monthlySnapshot.findUniqueOrThrow({
        where: { id },
        include: {
          transactions: true,
        },
      });
    };

    const updated = await this.prisma.$transaction(execute);

    // 5. Audit log side effect with category: BUDGET
    await this.auditLogService.record({
      action: 'UPDATE_SNAPSHOT_INPUTS',
      category: AuditCategory.BUDGET,
      summary: `Updated snapshot inputs for period ${updated.month}/${updated.year}`,
      details: JSON.stringify(dto),
      month: updated.month,
      year: updated.year,
      severity: AuditSeverity.INFO,
    });

    return updated;
  }

  /**
   * Closes a period snapshot.
   *
   * STRICT CONSTRAINT (ARCHITECTURE.md §3):
   * This is the ONLY place in the entire codebase allowed to decrement CreditContract.remainingTenor.
   * Runs in a single atomic transaction:
   * (a) verify snapshot is DRAFT (reject if LOCKED)
   * (b) enforce chronological order: reject if any earlier DRAFT snapshot exists
   * (c) run recalculateSnapshot's logic one final time
   * (d) decrement remainingTenor by 1 for each active contract (setting isActive = false if it reaches 0)
   * (e) set snapshot status to LOCKED.
   *
   * Only the chronologically earliest still-open DRAFT snapshot may be closed at any time.
   * Attempting to close a later period while an earlier one remains DRAFT will throw.
   */
  async closePeriod(snapshotId: number, dto?: ClosePeriodDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Verify snapshot is currently DRAFT (rejects with BadRequestException if LOCKED)
      const current = await this.assertSnapshotUnlocked(snapshotId, tx);

      // 2. Enforce chronological order: no earlier DRAFT snapshot may exist.
      //    An "earlier" snapshot is one where (year < current.year) OR
      //    (year === current.year AND month < current.month).
      const earlierDraft = await tx.monthlySnapshot.findFirst({
        where: {
          status: SnapshotStatus.DRAFT,
          id: { not: snapshotId },
          OR: [
            { year: { lt: current.year } },
            { year: current.year, month: { lt: current.month } },
          ],
        },
        orderBy: [{ year: 'asc' }, { month: 'asc' }],
      });

      if (earlierDraft) {
        throw new BadRequestException(
          `Cannot close snapshot #${snapshotId} (${current.month}/${current.year}) — ` +
            `snapshot #${earlierDraft.id} (${earlierDraft.month}/${earlierDraft.year}) ` +
            `is still DRAFT and must be closed first.`,
        );
      }

      // 3. Final recalculation within the transaction
      await this.recalculateSnapshot(snapshotId, tx);

      // 4. Decrement remainingTenor by 1 for all active contracts
      const activeContracts = await tx.creditContract.findMany({
        where: {
          isActive: true,
          remainingTenor: { gt: 0 },
        },
      });

      for (const contract of activeContracts) {
        const newRemainingTenor = Math.max(0, contract.remainingTenor - 1);
        const isActive = newRemainingTenor > 0;

        await tx.creditContract.update({
          where: { id: contract.id },
          data: {
            remainingTenor: newRemainingTenor,
            isActive,
          },
        });
      }

      // 5. Lock the snapshot
      const lockedSnapshot = await tx.monthlySnapshot.update({
        where: { id: snapshotId },
        data: {
          status: SnapshotStatus.LOCKED,
        },
        include: {
          transactions: true,
        },
      });

      // 6. Optional user-confirmed Savings Vault top-up (never auto-writes unless vaultTopupAmount > 0)
      let vaultTransfer: SavingsManualTransaction | null = null;
      const topupAmount = dto?.vaultTopupAmount
        ? Math.max(0, Math.round(dto.vaultTopupAmount))
        : 0;

      if (topupAmount > 0) {
        const formattedLabel = formatPeriodVaultLabel(
          dto?.vaultTopupLabel,
          current.month,
          current.year,
        );

        vaultTransfer = await tx.savingsManualTransaction.create({
          data: {
            label: formattedLabel,
            amount: topupAmount,
            date: new Date(),
          },
        });
      }

      return {
        snapshot: lockedSnapshot,
        decrementedContractsCount: activeContracts.length,
        vaultTransfer,
      };
    });

    const isDeficit = (result.snapshot.deficitUncovered ?? 0) > 0;
    await this.auditLogService.record({
      action: 'CLOSE_PERIOD',
      category: AuditCategory.BUDGET,
      summary: `Closed period ${result.snapshot.month}/${result.snapshot.year}`,
      details: isDeficit
        ? `Uncovered deficit: Rp ${result.snapshot.deficitUncovered}`
        : `Healthy close with ${result.decrementedContractsCount} contracts decremented${result.vaultTransfer ? `, Vault transfer: Rp ${result.vaultTransfer.amount}` : ''}`,
      month: result.snapshot.month,
      year: result.snapshot.year,
      severity: isDeficit ? AuditSeverity.DEFICIT : AuditSeverity.INFO,
    });

    if (result.vaultTransfer) {
      await this.auditLogService.record({
        action: 'SAVINGS_TOPUP',
        category: AuditCategory.SAVINGS,
        summary: `Top-up of Rp ${result.vaultTransfer.amount} to savings at period close: "${result.vaultTransfer.label}"`,
        details: `Savings transaction #${result.vaultTransfer.id}`,
        month: result.snapshot.month,
        year: result.snapshot.year,
        severity: AuditSeverity.INFO,
      });
    }

    return result;
  }

  /**
   * Reopens a previously LOCKED snapshot back to DRAFT status for administrative modifications.
   */
  async reopenSnapshot(snapshotId: number) {
    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${snapshotId} not found`);
    }

    if (snapshot.status !== SnapshotStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot reopen snapshot #${snapshotId}: snapshot is currently in ${snapshot.status} status`,
      );
    }

    const updated = await this.prisma.monthlySnapshot.update({
      where: { id: snapshotId },
      data: {
        status: SnapshotStatus.DRAFT,
      },
    });

    await this.auditLogService.record({
      action: 'REOPEN_PERIOD',
      category: AuditCategory.BUDGET,
      summary: `Reopened period ${snapshot.month}/${snapshot.year} for administrative modifications`,
      details: `Snapshot #${snapshotId} status changed from LOCKED to DRAFT`,
      month: snapshot.month,
      year: snapshot.year,
      severity: AuditSeverity.WARNING,
    });

    await this.recalculateSnapshot(snapshotId);

    return updated;
  }

  /**
   * Evaluates expired consumption cycles and automatically locks them
   * once the configurable grace period (default: 14 days) has elapsed.
   */
  async evaluateAutoClosePeriods(referenceDate: Date = new Date()) {
    const config = await this.prisma.globalConfig.findFirst();
    if (!config || !config.autoCloseEnabled) {
      return { autoClosedCount: 0, checkedCount: 0, autoClosedPeriods: [] };
    }

    const autoCloseAfterDays = config.autoCloseAfterDays ?? 14;
    const trackingStartMonth = config.activeTrackingStartMonth ?? 10;
    const trackingStartYear = config.activeTrackingStartYear ?? 2026;

    // Fetch DRAFT snapshots starting from active tracking start
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: {
        status: SnapshotStatus.DRAFT,
        OR: [
          { year: { gt: trackingStartYear } },
          { year: trackingStartYear, month: { gte: trackingStartMonth } },
        ],
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    const autoClosedPeriods: Array<{ id: number; month: number; year: number }> = [];

    for (const draft of draftSnapshots) {
      let cycleEndDate: Date;
      if (draft.payrollPayoutDate) {
        cycleEndDate = new Date(draft.payrollPayoutDate.getTime() + 30 * 86400000);
      } else {
        const nextMonth = draft.month === 12 ? 1 : draft.month + 1;
        const nextYear = draft.month === 12 ? draft.year + 1 : draft.year;
        cycleEndDate = new Date(Date.UTC(nextYear, nextMonth - 1, 25));
      }

      const graceDeadline = new Date(
        cycleEndDate.getTime() + autoCloseAfterDays * 86400000,
      );

      if (referenceDate.getTime() >= graceDeadline.getTime()) {
        await this.prisma.monthlySnapshot.update({
          where: { id: draft.id },
          data: { status: SnapshotStatus.LOCKED },
        });

        await this.auditLogService.record({
          action: 'AUTO_CLOSE_PERIOD',
          category: AuditCategory.BUDGET,
          summary: `Auto-closed period ${draft.month}/${draft.year} after ${autoCloseAfterDays}-day post-cycle grace window`,
          details: `Cycle ended on ${cycleEndDate.toISOString().slice(0, 10)}. Grace window elapsed on ${graceDeadline.toISOString().slice(0, 10)}.`,
          month: draft.month,
          year: draft.year,
          severity: AuditSeverity.INFO,
        });

        autoClosedPeriods.push({
          id: draft.id,
          month: draft.month,
          year: draft.year,
        });
      }
    }

    return {
      autoClosedCount: autoClosedPeriods.length,
      autoClosedPeriods,
      checkedCount: draftSnapshots.length,
    };
  }

  /**
   * Revises a target budget category on a DRAFT snapshot, records an audit trail
   * in BudgetRevision and AuditLog, and recalculates the snapshot.
   * Strictly rejects when snapshot is LOCKED.
   */
  async createBudgetRevision(
    snapshotId: number,
    dto: CreateBudgetRevisionDto,
  ) {
    const categoryFieldMap: Record<string, string> = {
      SAVINGS: 'savings',
      DAILY_OPERATIONAL: 'dailyOperational',
      SELF_REWARD: 'selfRewardTarget',
      BUFFER: 'bufferPocket',
      TRANSPORT: 'transport',
      INTERNET: 'internet',
      VAPE: 'vape',
      HAIRCUT: 'haircut',
    };

    const targetField = dto.category ? categoryFieldMap[dto.category] : undefined;
    const bucketKey =
      dto.bucketKey ?? (dto.category ? dto.category.toLowerCase() : undefined);
    const bucketLabel = dto.bucketLabel ?? dto.category ?? dto.bucketKey ?? 'Custom Bucket';

    const snapshot = await this.assertSnapshotUnlocked(snapshotId);

    let previousValue = 0;
    if (targetField && snapshot[targetField as keyof typeof snapshot] !== undefined) {
      previousValue = (snapshot[targetField as keyof typeof snapshot] as number) ?? 0;
    } else if (Array.isArray(snapshot.bucketRealizationsJson)) {
      const match = (snapshot.bucketRealizationsJson as any[]).find(
        (b) => b.bucketId?.toLowerCase() === bucketKey?.toLowerCase(),
      );
      if (match) {
        previousValue = match.revisedTarget ?? match.baselineTarget ?? 0;
      }
    }
    const difference = dto.newValue - previousValue;

    const result = await this.prisma.$transaction(async (tx) => {
      await this.assertSnapshotUnlocked(snapshotId, tx);

      if (targetField) {
        await tx.monthlySnapshot.update({
          where: { id: snapshotId },
          data: {
            [targetField]: dto.newValue,
          },
        });
      }

      const revision = await tx.budgetRevision.create({
        data: {
          snapshotId,
          month: snapshot.month,
          year: snapshot.year,
          category: dto.category ?? BudgetRevisionCategory.CUSTOM_BUCKET,
          bucketKey,
          bucketLabel,
          previousValue,
          newValue: dto.newValue,
          difference,
          reason: dto.reason.trim(),
        },
      });

      const updatedSnapshot = await this.recalculateSnapshot(snapshotId, tx);

      return { revision, snapshot: updatedSnapshot };
    });

    await this.auditLogService.record({
      action: 'BUDGET_TARGET_REVISED',
      category: AuditCategory.BUDGET,
      summary: `Revised ${bucketLabel} target for ${snapshot.month}/${snapshot.year}`,
      details: `Changed from ${previousValue} to ${dto.newValue} (diff: ${difference}). Reason: ${dto.reason.trim()}`,
      month: snapshot.month,
      year: snapshot.year,
      severity: AuditSeverity.ADJUSTMENT,
    });

    return result;
  }

  /**
   * Resyncs global modular rules into this snapshot's frozenRulesJson and triggers recalculation.
   * Strictly rejects when snapshot is LOCKED.
   */
  async resyncSnapshotRules(snapshotId: number) {
    const snapshot = await this.assertSnapshotUnlocked(snapshotId);
    const config = await this.prisma.globalConfig.findFirst();
    if (!config) {
      throw new BadRequestException('Global configuration has not been initialized');
    }

    const frozenRulesJson = {
      payrollRules:
        config.payrollRulesJson ??
        buildDefaultPayrollRules(config.dailyAllowance, config.laptopAllowance),
      allocationBuckets:
        config.allocationBucketsJson ??
        buildDefaultAllocationBuckets({
          transport: config.transport,
          internet: config.internet,
          vape: config.vape,
          haircut: config.haircut,
          dailyOperational: config.dailyOperational,
          savings: config.baseSavings,
          bufferPocket: 0,
        }),
      surplusSplitRules:
        config.surplusSplitRulesJson ?? buildDefaultSurplusSplitRules(),
      financialPolicy:
        config.financialPolicyJson ?? buildDefaultFinancialPolicy(),
    };

    await this.prisma.monthlySnapshot.update({
      where: { id: snapshotId },
      data: {
        dailyOperational: config.dailyOperational,
        transport: config.transport,
        internet: config.internet,
        vape: config.vape,
        haircut: config.haircut,
        savings: config.baseSavings,
        ccUsageLimit: config.ccUsageLimit,
        paylaterUsageLimit: config.paylaterUsageLimit,
        frozenRulesJson: frozenRulesJson as any,
      },
    });

    const recalculated = await this.recalculateSnapshot(snapshotId);

    await this.auditLogService.record({
      action: 'RESYNC_CONFIG_TARGETS',
      category: AuditCategory.SETTINGS,
      summary: `Resynced modular rules for period ${snapshot.month}/${snapshot.year} from GlobalConfig`,
      details: 'Updated frozenRulesJson from globalConfig and recalculated',
      month: snapshot.month,
      year: snapshot.year,
      severity: AuditSeverity.INFO,
    });

    return recalculated;
  }

  /**
   * Read-only preview of a proposed budget revision.
   * Computes projected waterfall allocations and daily pacing without mutating any database records or writing audit logs.
   * Strictly rejects when snapshot is LOCKED (per assertSnapshotUnlocked).
   */
  async previewBudgetRevision(
    snapshotId: number,
    dto: PreviewBudgetRevisionDto,
  ) {
    const categoryFieldMap: Record<string, string> = {
      SAVINGS: 'savings',
      DAILY_OPERATIONAL: 'dailyOperational',
      SELF_REWARD: 'selfRewardTarget',
      BUFFER: 'bufferPocket',
      TRANSPORT: 'transport',
      INTERNET: 'internet',
      VAPE: 'vape',
      HAIRCUT: 'haircut',
    };

    const targetField = dto.category ? categoryFieldMap[dto.category] : undefined;
    const bucketKey =
      dto.bucketKey ?? (dto.category ? dto.category.toLowerCase() : undefined);
    const bucketLabel = dto.bucketLabel ?? dto.category ?? dto.bucketKey ?? 'Custom Bucket';

    const snapshot = await this.assertSnapshotUnlocked(snapshotId);

    let previousValue = 0;
    if (targetField && snapshot[targetField as keyof typeof snapshot] !== undefined) {
      previousValue = (snapshot[targetField as keyof typeof snapshot] as number) ?? 0;
    } else if (Array.isArray(snapshot.bucketRealizationsJson)) {
      const match = (snapshot.bucketRealizationsJson as any[]).find(
        (b) => b.bucketId?.toLowerCase() === bucketKey?.toLowerCase(),
      );
      if (match) {
        previousValue = match.revisedTarget ?? match.baselineTarget ?? 0;
      }
    }
    const difference = dto.newValue - previousValue;

    const config = await this.prisma.globalConfig.findFirst();
    if (!config) {
      throw new BadRequestException('Global configuration has not been initialized');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { snapshotId },
    });

    const extraIncome = sumExtraIncome(transactions);

    const payroll = calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot.salaryAdjustment,
      totalWorkingDays: snapshot.totalWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot.cafeteriaDeduction,
      thrAmount: snapshot.thrAmount,
      bonusAmount: snapshot.bonusAmount,
      extraIncome,
      laptopAllowance: config.laptopAllowance,
    });

    const hypotheticalDailyOperational =
      dto.category === BudgetRevisionCategory.DAILY_OPERATIONAL
        ? dto.newValue
        : snapshot.dailyOperational;

    const hypotheticalSavings =
      dto.category === BudgetRevisionCategory.SAVINGS
        ? dto.newValue
        : snapshot.savings;

    const hypotheticalSelfRewardTarget =
      dto.category === BudgetRevisionCategory.SELF_REWARD
        ? dto.newValue
        : snapshot.selfRewardTarget;

    const hypotheticalBuffer =
      dto.category === BudgetRevisionCategory.BUFFER
        ? dto.newValue
        : snapshot.bufferPocket;

    const hypotheticalTransport =
      dto.category === BudgetRevisionCategory.TRANSPORT
        ? dto.newValue
        : snapshot.transport;

    const hypotheticalInternet =
      dto.category === BudgetRevisionCategory.INTERNET
        ? dto.newValue
        : snapshot.internet;

    const hypotheticalVape =
      dto.category === BudgetRevisionCategory.VAPE
        ? dto.newValue
        : snapshot.vape;

    const hypotheticalHaircut =
      dto.category === BudgetRevisionCategory.HAIRCUT
        ? dto.newValue
        : snapshot.haircut;

    const hypotheticalFixedTargets = {
      transport: hypotheticalTransport,
      internet: hypotheticalInternet,
      vape: hypotheticalVape,
      haircut: hypotheticalHaircut,
    };

    const totalDeductions = calculateTotalDeductions(
      transactions,
      hypotheticalFixedTargets,
      hypotheticalDailyOperational,
    );

    const fixedExpenses =
      hypotheticalTransport +
      hypotheticalInternet +
      hypotheticalVape +
      hypotheticalHaircut;

    const waterfall = calculateWaterfall({
      finalTotalIncome: payroll.finalTotalIncome,
      totalDeductions,
      savingsTarget: hypotheticalSavings,
      selfRewardTarget: hypotheticalSelfRewardTarget,
      dailyOperationalTarget: hypotheticalDailyOperational,
      fixedExpenses,
      bufferPocket: hypotheticalBuffer,
    });

    const defaultPayoutDay = config.payrollPayoutDay ?? 25;
    const cycleStartDate =
      snapshot.payrollPayoutDate ??
      new Date(Date.UTC(snapshot.year, snapshot.month - 1, defaultPayoutDay));

    const nextMonth = snapshot.month === 12 ? 1 : snapshot.month + 1;
    const nextYear = snapshot.month === 12 ? snapshot.year + 1 : snapshot.year;

    const nextSnapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { userId_month_year: { userId: snapshot.userId, month: nextMonth, year: nextYear } },
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

    const totalDailySpent = calculateOperationalDailySpent(
      transactions,
      hypotheticalFixedTargets,
    );

    const pacing = calculateDailyPacing({
      periodMonth: snapshot.month,
      periodYear: snapshot.year,
      cycleStartDate,
      cycleEndDate,
      isEndDateConfirmed,
      actualDailyOperational: waterfall.actualDailyOperational,
      dailyOperationalTarget: hypotheticalDailyOperational,
      totalDailySpent,
    });

    return {
      category: dto.category ?? BudgetRevisionCategory.CUSTOM_BUCKET,
      bucketKey,
      bucketLabel,
      previousValue,
      newValue: dto.newValue,
      difference,
      projected: {
        actualDailyOperational: waterfall.actualDailyOperational,
        actualSavings: waterfall.actualSavings,
        actualSelfReward: waterfall.actualSelfReward,
        deficitUncovered: waterfall.deficitUncovered,
        survivalPocket: waterfall.survivalPocket,
        safeToSpendToday: pacing.safeToSpendToday,
        pacingStatus: pacing.pacingStatus,
        baselineDailyRate: pacing.baselineDailyRate,
      },
    };
  }

  /**
   * Initializes a brand-new monthly period.
   * Inherits baselines from GlobalConfig, auto-materializes active installment slices
   * and recurring subscriptions, and calculates the initial waterfall cleanly.
   */
  async initializePeriod(month: number, year: number, userId: number = 1): Promise<MonthlySnapshot> {
    const config =
      (await this.prisma.globalConfig.findUnique({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
    if (!config) {
      throw new BadRequestException('Global configuration has not been initialized');
    }

    if (userId !== 1 && (userId === 2 || config.profileMode === 'STANDARD_GENERAL') && config.sandboxStateJson) {
      const sandbox =
        (config.sandboxStateJson as any) || buildDefaultSandboxState(month, year);
      return (
        this.selectors?.buildSandboxSnapshot(sandbox, month, year) ??
        (sandbox as any)
      );
    }

    const existing = await this.prisma.monthlySnapshot.findUnique({
      where: {
        userId_month_year: { userId, month, year },
      },
    });

    if (existing) {
      return existing;
    }

    if (!this.selectors) {
      throw new BadRequestException('SnapshotsSelectors is not available');
    }

    return this.selectors.getOrCreateDraftSnapshot(month, year, userId);
  }
}
