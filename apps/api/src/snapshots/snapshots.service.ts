import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { SnapshotsSelectors } from './snapshots.selectors';
import { CreditService } from '../credit/credit.service';
import { buildDefaultSandboxState } from '../config/sandbox.defaults';
import {
  SnapshotStatus,
  Prisma,
  MonthlySnapshot,
  SavingsManualTransaction,
  AuditCategory,
  AuditSeverity,
  BudgetRevisionCategory,
  LiabilityCategory,
} from '@prisma/client';
import { BorrowFromP1Dto } from './dto/borrow-p1.dto';
import {
  calculatePayroll,
  sumExtraIncome,
  calculateAdjustedBaseSalary,
  calculateDecemberProratedThr,
  calculateDecemberProratedThrByDates,
} from '../calculator/payroll';
import { resolveStudioConfig } from '../config/studio.defaults';
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
    @Optional()
    @Inject(forwardRef(() => CreditService))
    private readonly creditService?: CreditService,
  ) {}

  /**
   * Asserts that a snapshot exists and its status is DRAFT.
   * Throws BadRequestException if the snapshot is LOCKED.
   * Can be called by other domain services (finance, credit, etc.) to enforce lock integrity.
   */
  async assertSnapshotUnlocked(
    snapshotId: number,
    tx?: Prisma.TransactionClient,
    userId?: number,
  ): Promise<MonthlySnapshot> {
    const client = tx ?? this.prisma;
    const snapshot = await client.monthlySnapshot.findUnique({
      where: { id: snapshotId },
    });

    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${snapshotId} not found`);
    }
    if (userId !== undefined && snapshot.userId !== userId) {
      throw new ForbiddenException(`Access denied to snapshot #${snapshotId}`);
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
    userId?: number,
  ) {
    const execute = async (tx: Prisma.TransactionClient) => {
      const snapshot = await tx.monthlySnapshot.findUniqueOrThrow({
        where: { id: snapshotId },
        include: {
          budgetRevisions: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      if (userId !== undefined && snapshot.userId !== userId) {
        throw new ForbiddenException(`Access denied to snapshot #${snapshotId}`);
      }
      if (snapshot.status === SnapshotStatus.LOCKED) {
        throw new BadRequestException('Cannot recalculate a locked snapshot');
      }

      const [config, transactions] = await Promise.all([
        (async () => {
          return (
            (await tx.globalConfig.findUnique({ where: { userId: snapshot.userId } })) ||
            (await tx.globalConfig.findFirst({ where: { userId: snapshot.userId } })) ||
            (await tx.globalConfig.findFirst({ where: { userId: 1 } }))
          );
        })(),
        tx.transaction.findMany({
          where: { snapshotId },
        }),
      ]);
      if (!config) {
        throw new BadRequestException(
          'Global configuration has not been initialized',
        );
      }

      const rawModularRules =
        (snapshot.frozenRulesJson as any) ||
        synthesizeRulesFromSnapshot({
          ...snapshot,
          dailyAllowance: config.dailyAllowance,
          laptopAllowance: config.laptopAllowance,
        });

      const modularRules = snapshot.isManualOverride
        ? (() => {
            const manualColMap: Record<string, number> = {
              transport: Math.max(0, Math.round(Number(snapshot.transport) || 0)),
              internet: Math.max(0, Math.round(Number(snapshot.internet) || 0)),
              vape: Math.max(0, Math.round(Number(snapshot.vape) || 0)),
              haircut: Math.max(0, Math.round(Number(snapshot.haircut) || 0)),
              buffer: Math.max(0, Math.round(Number(snapshot.bufferPocket) || 0)),
              buffer_pocket: Math.max(0, Math.round(Number(snapshot.bufferPocket) || 0)),
              daily_operational: Math.max(
                0,
                Math.round(Number(snapshot.dailyOperational) || 0),
              ),
              core_savings: Math.max(
                0,
                Math.round(
                  snapshot.lockedP1 !== undefined && snapshot.lockedP1 !== null
                    ? Number(snapshot.lockedP1)
                    : Number(snapshot.savings) || 0,
                ),
              ),
              savings: Math.max(
                0,
                Math.round(
                  snapshot.lockedP1 !== undefined && snapshot.lockedP1 !== null
                    ? Number(snapshot.lockedP1)
                    : Number(snapshot.savings) || 0,
                ),
              ),
              self_reward: Math.max(
                0,
                Math.round(
                  snapshot.lockedP2 !== undefined && snapshot.lockedP2 !== null
                    ? Number(snapshot.lockedP2)
                    : Number(snapshot.selfRewardTarget) || 0,
                ),
              ),
            };
            const baseBuckets = Array.isArray(rawModularRules?.allocationBuckets)
              ? rawModularRules.allocationBuckets
              : [];
            return {
              ...rawModularRules,
              allocationBuckets: baseBuckets.map((bucket: any) => {
                const key = String(bucket?.id ?? '').toLowerCase();
                if (!(key in manualColMap)) return bucket;
                const explicitVal = manualColMap[key];
                return {
                  ...bucket,
                  value: explicitVal,
                  isActive: explicitVal > 0 ? true : bucket.isActive,
                };
              }),
            };
          })()
        : rawModularRules;

      const frozenDailyRule = Array.isArray(modularRules?.payrollRules)
        ? modularRules.payrollRules.find((r: any) => r?.id === 'daily_attendance')
        : null;
      const effectiveDailyAllowance =
        snapshot.frozenRulesJson && frozenDailyRule && frozenDailyRule.value !== undefined
          ? Number(frozenDailyRule.value)
          : config.dailyAllowance;

      const extraIncome = sumExtraIncome(transactions);

      const studioCfg = resolveStudioConfig(
        snapshot.userId,
        config.formulaParamsJson,
        config,
      );
      const pcCfg = studioCfg.paycycleFormulaConfig;

      const payroll = calculatePayroll({
        baseSalary: config.baseSalary,
        salaryAdjustment: snapshot.salaryAdjustment,
        totalWorkingDays: snapshot.totalWorkingDays,
        dailyAllowance: effectiveDailyAllowance,
        cafeteriaDeduction: snapshot.cafeteriaDeduction,
        thrAmount: snapshot.thrAmount,
        bonusAmount: snapshot.bonusAmount,
        extraIncome,
        laptopAllowance: pcCfg.laptopAllowanceRp ?? config.laptopAllowance,
        bpjsRate: (pcCfg.bpjsRatePercent ?? 3) / 100,
      });

      const fixedTargets = {
        transport: snapshot.transport,
        internet: snapshot.internet,
        vape: snapshot.vape,
        haircut: snapshot.haircut,
      };

      const effectiveDailyOperational = (() => {
        if (snapshot.isManualOverride) {
          return snapshot.dailyOperational;
        }
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

      const trackingStartYear = config.activeTrackingStartYear ?? 2026;
      const trackingStartMonth = config.activeTrackingStartMonth ?? 10;
      const isPreTrackingPeriod =
        snapshot.year < trackingStartYear ||
        (snapshot.year === trackingStartYear && snapshot.month < trackingStartMonth);

      const totalDeductions = calculateTotalDeductions(
        transactions,
        fixedTargets,
        isPreTrackingPeriod ? undefined : effectiveDailyOperational,
      );

      const totalCreditBills = transactions
        .filter((t) => t.type === 'CREDIT_BILL')
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const modularResult = evaluateModularEngine({
        baseSalary: config.baseSalary,
        salaryAdjustment: snapshot.salaryAdjustment,
        totalWorkingDays: snapshot.totalWorkingDays,
        dailyAllowance: effectiveDailyAllowance,
        cafeteriaDeduction: snapshot.cafeteriaDeduction,
        thrAmount: snapshot.thrAmount,
        bonusAmount: snapshot.bonusAmount,
        extraIncome,
        bridgeInflowAmount: snapshot.bridgeInflowAmount ?? 0,
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
        budgetRevisions: snapshot.isManualOverride ? [] : snapshot.budgetRevisions,
        isManualOverride: snapshot.isManualOverride,
        lockedP1: snapshot.lockedP1,
        lockedP2: snapshot.lockedP2,
        oneOffBills: (snapshot.oneOffBillsJson as any) || null,
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
                ...(snapshot.isManualOverride
                  ? { frozenRulesJson: modularRules as any }
                  : {}),
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
          budgetRevisions: {
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
    };

    return txClient
      ? execute(txClient)
      : this.prisma.$transaction(execute, { maxWait: 15000, timeout: 30000 });
  }

  /**
   * Updates editable fields on a DRAFT snapshot and recalculates derived figures.
   * If useDecemberProratedThr is provided, computes THR server-side using the pure calculator.
   * Rejects immediately if snapshot is LOCKED.
   */
  async updateSnapshot(id: number, dto: UpdateSnapshotDto, userId?: number) {
    const execute = async (tx: Prisma.TransactionClient) => {
      // 1. Assert snapshot is unlocked (rejects if LOCKED) and owned by caller
      const snapshot = await this.assertSnapshotUnlocked(id, tx, userId);

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
          thrAmount =
            snapshot.userId === 1 && snapshot.year === 2026
              ? calculateDecemberProratedThrByDates(
                  adjustedBase,
                  '2026-04-06',
                  '2026-12-25',
                ).exactDaysAmountRp
              : calculateDecemberProratedThr(adjustedBase);
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

    const updated = await this.prisma.$transaction(execute, {
      maxWait: 15000,
      timeout: 30000,
    });

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
  async closePeriod(snapshotId: number, dto?: ClosePeriodDto, userId?: number) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        // 1. Verify snapshot is currently DRAFT (rejects with BadRequestException if LOCKED)
      const current = await this.assertSnapshotUnlocked(snapshotId, tx, userId);

      // 2. Enforce chronological order within the same userId: no earlier DRAFT snapshot may exist.
      const earlierDraft = await tx.monthlySnapshot.findFirst({
        where: {
          userId: current.userId,
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

      // 4. Decrement remainingTenor by 1 for all active contracts owned by this user
      const activeContracts = await tx.creditContract.findMany({
        where: {
          userId: current.userId,
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
    }, { maxWait: 15000, timeout: 30000 });

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
  async reopenSnapshot(snapshotId: number, userId?: number) {
    const snapshot = await this.prisma.monthlySnapshot.findUnique({
      where: { id: snapshotId },
    });
    if (!snapshot) {
      throw new NotFoundException(`Snapshot #${snapshotId} not found`);
    }
    if (userId !== undefined && snapshot.userId !== userId) {
      throw new ForbiddenException(`Access denied to snapshot #${snapshotId}`);
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
  async evaluateAutoClosePeriods(
    referenceDate: Date = new Date(),
    userId: number = 1,
  ) {
    const config = await this.prisma.globalConfig.findFirst({
      where: { userId },
    });
    if (!config || !config.autoCloseEnabled) {
      return { autoClosedCount: 0, checkedCount: 0, autoClosedPeriods: [] };
    }

    const autoCloseAfterDays = config.autoCloseAfterDays ?? 14;
    const trackingStartMonth = config.activeTrackingStartMonth ?? 10;
    const trackingStartYear = config.activeTrackingStartYear ?? 2026;

    // Fetch DRAFT snapshots starting from active tracking start for this userId only
    const draftSnapshots = await this.prisma.monthlySnapshot.findMany({
      where: {
        userId,
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
    userId?: number,
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

    const snapshot = await this.assertSnapshotUnlocked(snapshotId, undefined, userId);

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
        let nextOneOffBills = Array.isArray(snapshot.oneOffBillsJson)
          ? ([...(snapshot.oneOffBillsJson as any[])] as Array<{
              slot: string;
              label: string;
              amount: number;
            }>)
          : [];

        if (bucketKey) {
          if (dto.isOneOff) {
            const customSlotLabel =
              dto.oneOffLabel?.trim() || dto.bucketLabel?.trim() || bucketLabel;
            nextOneOffBills = nextOneOffBills.filter(
              (item) => item.slot?.toLowerCase() !== bucketKey.toLowerCase(),
            );
            if (dto.newValue > 0) {
              nextOneOffBills.push({
                slot: bucketKey.toLowerCase(),
                label: customSlotLabel,
                amount: dto.newValue,
              });
            }
          } else if (dto.oneOffLabel === '') {
            nextOneOffBills = nextOneOffBills.filter(
              (item) => item.slot?.toLowerCase() !== bucketKey.toLowerCase(),
            );
          }
        }

        await tx.monthlySnapshot.update({
          where: { id: snapshotId },
          data: {
            [targetField]: dto.newValue,
            ...(dto.isOneOff !== undefined || dto.oneOffLabel === ''
              ? { oneOffBillsJson: nextOneOffBills as any }
              : {}),
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
    }, { maxWait: 15000, timeout: 30000 });

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
  async resyncSnapshotRules(snapshotId: number, userId?: number) {
    const snapshot = await this.assertSnapshotUnlocked(snapshotId, undefined, userId);
    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId: snapshot.userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
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
    userId?: number,
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

    const snapshot = await this.assertSnapshotUnlocked(snapshotId, undefined, userId);

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

    const config =
      (await this.prisma.globalConfig.findFirst({ where: { userId: snapshot.userId } })) ||
      (await this.prisma.globalConfig.findFirst({ where: { userId: 1 } }));
    if (!config) {
      throw new BadRequestException('Global configuration has not been initialized');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { snapshotId },
    });

    const extraIncome = sumExtraIncome(transactions);

    const studioCfg = resolveStudioConfig(
      snapshot.userId,
      config.formulaParamsJson,
      config,
    );
    const pcCfg = studioCfg.paycycleFormulaConfig;

    const payroll = calculatePayroll({
      baseSalary: config.baseSalary,
      salaryAdjustment: snapshot.salaryAdjustment,
      totalWorkingDays: snapshot.totalWorkingDays,
      dailyAllowance: config.dailyAllowance,
      cafeteriaDeduction: snapshot.cafeteriaDeduction,
      thrAmount: snapshot.thrAmount,
      bonusAmount: snapshot.bonusAmount,
      extraIncome,
      laptopAllowance: pcCfg.laptopAllowanceRp ?? config.laptopAllowance,
      bpjsRate: (pcCfg.bpjsRatePercent ?? 3) / 100,
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

    const bridgeInflow = Math.max(0, Math.round(snapshot.bridgeInflowAmount ?? 0));
    const waterfall = calculateWaterfall({
      finalTotalIncome: payroll.finalTotalIncome + bridgeInflow,
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

  /**
   * P1 Vault Self-Borrowing ("Forward Purchase"):
   * Transfers `amount` out of current period Core Savings (P1) into Self-Reward (P2) or Living Cash,
   * while automatically locking a mandatory `P1_VAULT_REFUND` LiabilityLineItem into `(refundMonth, refundYear)`.
   */
  async borrowFromP1Vault(snapshotId: number, dto: BorrowFromP1Dto, userId?: number) {
    const amount = Math.round(dto.amount);
    if (amount <= 0) {
      throw new BadRequestException('Borrow amount must be positive');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const snapshot = await this.assertSnapshotUnlocked(snapshotId, tx, userId);
        const currentSerial = snapshot.year * 12 + snapshot.month;
        const refundSerial = dto.refundYear * 12 + dto.refundMonth;
        if (refundSerial <= currentSerial) {
          throw new BadRequestException(
            'Refund period must be strictly later than the current borrowing period',
          );
        }

        const currentSavings = Math.round(snapshot.actualSavings ?? 0);
        if (amount > currentSavings) {
          throw new BadRequestException(
            `Requested borrow (Rp ${amount.toLocaleString('id-ID')}) exceeds available Core Savings P1 (Rp ${currentSavings.toLocaleString('id-ID')})`,
          );
        }

        const refundSnapshot = await tx.monthlySnapshot.findUnique({
          where: {
            userId_month_year: {
              userId: snapshot.userId,
              month: dto.refundMonth,
              year: dto.refundYear,
            },
          },
        });
        if (refundSnapshot?.status === SnapshotStatus.LOCKED) {
          throw new BadRequestException(
            `Target refund period (${dto.refundMonth}/${dto.refundYear}) is locked`,
          );
        }

        const nextP1 = Math.max(0, currentSavings - amount);
        const reason = dto.reason.trim();

        if (dto.destination === 'SELF_REWARD') {
          const prevP2 = Math.round(snapshot.selfReward ?? 0);
          await tx.monthlySnapshot.update({
            where: { id: snapshotId },
            data: {
              savings: nextP1,
              isManualOverride: true,
              lockedP1: nextP1,
              lockedP2: prevP2 + amount,
            },
          });

          await tx.budgetRevision.create({
            data: {
              snapshotId,
              month: snapshot.month,
              year: snapshot.year,
              category: BudgetRevisionCategory.SAVINGS,
              bucketKey: 'core_savings',
              bucketLabel: 'Priority 1 Core Savings',
              previousValue: snapshot.savings,
              newValue: nextP1,
              difference: nextP1 - snapshot.savings,
              reason: `P1 Vault forward-borrow (${reason}) -> Self-Reward P2, mandatory refund scheduled ${dto.refundMonth}/${dto.refundYear}`,
            },
          });
        } else {
          const prevLiving = Math.round(snapshot.dailyOperational);
          const nextLiving = prevLiving + amount;
          await tx.monthlySnapshot.update({
            where: { id: snapshotId },
            data: {
              savings: nextP1,
              dailyOperational: nextLiving,
              isManualOverride: true,
              lockedP1: nextP1,
            },
          });

          await tx.budgetRevision.createMany({
            data: [
              {
                snapshotId,
                month: snapshot.month,
                year: snapshot.year,
                category: BudgetRevisionCategory.SAVINGS,
                bucketKey: 'core_savings',
                bucketLabel: 'Priority 1 Core Savings',
                previousValue: snapshot.savings,
                newValue: nextP1,
                difference: nextP1 - snapshot.savings,
                reason: `P1 Vault forward-borrow (${reason}) -> Living Cash, mandatory refund scheduled ${dto.refundMonth}/${dto.refundYear}`,
              },
              {
                snapshotId,
                month: snapshot.month,
                year: snapshot.year,
                category: BudgetRevisionCategory.DAILY_OPERATIONAL,
                bucketKey: 'daily_operational',
                bucketLabel: 'Daily Operational Living Budget',
                previousValue: prevLiving,
                newValue: nextLiving,
                difference: amount,
                reason: `P1 Vault forward-borrow liquidity infusion (${reason})`,
              },
            ],
          });
        }

        const updatedSource = await this.recalculateSnapshot(snapshotId, tx);

        const contractId = `P1-REFUND-${snapshot.year}${String(snapshot.month).padStart(2, '0')}-${Date.now()}`;
        const createdRefundItem = await tx.liabilityLineItem.create({
          data: {
            userId: snapshot.userId,
            month: dto.refundMonth,
            year: dto.refundYear,
            category: LiabilityCategory.P1_VAULT_REFUND,
            title: `${reason} (P1 Vault Refund)`,
            merchantOrPlatform: 'Internal P1 Vault',
            principalAmount: amount,
            monthlyAmount: amount,
            tenorMonths: 1,
            installmentIndex: 1,
            cutoffDay: 1,
            dueDay: 25,
            isSettled: false,
            parentContractId: contractId,
            notes: `Mandatory P1 restoration from ${snapshot.month}/${snapshot.year} borrow`,
          },
        });

        const itemsInRefundMonth = await tx.liabilityLineItem.findMany({
          where: {
            userId: snapshot.userId,
            month: dto.refundMonth,
            year: dto.refundYear,
          },
        });
        const paylaterSum = itemsInRefundMonth
          .filter((li) => li.category === LiabilityCategory.PAYLATER)
          .reduce((s, li) => s + Math.round(li.monthlyAmount), 0);
        const personalDebtSum = itemsInRefundMonth
          .filter(
            (li) =>
              li.category === LiabilityCategory.PERSONAL_DEBT ||
              li.category === LiabilityCategory.P1_VAULT_REFUND,
          )
          .reduce((s, li) => s + Math.round(li.monthlyAmount), 0);

        await tx.monthlyBulkBill.upsert({
          where: {
            userId_month_year: {
              userId: snapshot.userId,
              month: dto.refundMonth,
              year: dto.refundYear,
            },
          },
          update: {
            paylaterAmount: paylaterSum,
            personalDebtAmount: personalDebtSum,
            amount: paylaterSum + personalDebtSum,
          },
          create: {
            userId: snapshot.userId,
            month: dto.refundMonth,
            year: dto.refundYear,
            paylaterAmount: paylaterSum,
            personalDebtAmount: personalDebtSum,
            creditCardAmount: 0,
            amount: paylaterSum + personalDebtSum,
          },
        });

        if (refundSnapshot && refundSnapshot.status === SnapshotStatus.DRAFT && this.creditService) {
          await this.creditService.syncLiabilitiesToSnapshot(
            dto.refundMonth,
            dto.refundYear,
            tx,
            snapshot.userId,
          );
        }

        return {
          snapshot: updatedSource,
          refundLineItem: createdRefundItem,
        };
      },
      { maxWait: 15000, timeout: 30000 },
    );

    await this.auditLogService.record({
      action: 'P1_VAULT_FORWARD_BORROW',
      category: AuditCategory.SAVINGS,
      summary: `Borrowed Rp ${amount.toLocaleString('id-ID')} from P1 Core Savings to ${dto.destination} (${dto.reason}) with mandatory refund in ${dto.refundMonth}/${dto.refundYear}`,
      details: JSON.stringify(dto),
      month: result.snapshot.month,
      year: result.snapshot.year,
      severity: AuditSeverity.ADJUSTMENT,
    });

    return result;
  }
}
