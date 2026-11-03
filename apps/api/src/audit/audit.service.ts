import { Injectable } from '@nestjs/common';
import { AuditSelectors } from './audit.selectors';
import {
  evaluateAuditDimensions,
  AuditEvaluationResult,
  SnapshotAuditInput,
  WithdrawalAuditInput,
} from '../calculator/discipline';

export interface AuditSummary {
  disciplineScore: number;
  healthStatus: string;
  totalGreenFlags: number;
  totalRedFlags: number;
  totalChecks: number;
  flags: AuditEvaluationResult['flags'];
}

@Injectable()
export class AuditService {
  constructor(private readonly selectors: AuditSelectors) {}

  /**
   * Internal shared evaluation engine.
   * Feeds historical snapshots and withdrawals into the authoritative calculator/discipline.ts evaluator.
   */
  private async computeEvaluation(): Promise<AuditEvaluationResult> {
    const snapshots = await this.selectors.listHistoricalSnapshots();
    const withdrawals = await this.selectors.listSavingsWithdrawals();
    const bulkBills = await this.selectors.listBulkBills();

    // Group MonthlyBulkBill personalDebtAmount and paylaterAmount by period `${year}-${month}`
    const personalDebtByPeriod = new Map<string, number>();
    const paylaterByPeriod = new Map<string, number>();
    for (const b of bulkBills) {
      const key = `${b.year}-${b.month}`;
      personalDebtByPeriod.set(
        key,
        (personalDebtByPeriod.get(key) ?? 0) + (b.personalDebtAmount ?? 0),
      );
      paylaterByPeriod.set(
        key,
        (paylaterByPeriod.get(key) ?? 0) + (b.paylaterAmount ?? 0),
      );
    }

    const snapshotInputs: SnapshotAuditInput[] = snapshots.map((s) => {
      const key = `${s.year}-${s.month}`;
      const ccUsageFromTx = (s.transactions ?? [])
        .filter(
          (t) =>
            t.type === 'CREDIT_BILL' && t.sourceType === 'CC_TRANSACTION',
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const paylaterFromTx = (s.transactions ?? [])
        .filter(
          (t) => t.type === 'CREDIT_BILL' && t.sourceType === 'BULK_BILL',
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const paylaterUsage = paylaterByPeriod.has(key)
        ? (paylaterByPeriod.get(key) ?? 0)
        : paylaterFromTx;

      return {
        id: s.id,
        month: s.month,
        year: s.year,
        totalIncome: s.finalTotalIncome ?? 0,
        actualDailyOperational: s.actualDailyOperational ?? 0,
        targetDailyOperational: s.dailyOperational ?? 0,
        selfReward: s.selfReward ?? 0,
        targetSelfReward: s.selfRewardTarget ?? 0,
        actualSavings: s.actualSavings ?? 0,
        targetSavings: s.savings ?? 0,
        totalBills: s.totalDeductions ?? 0,
        personalDebt: personalDebtByPeriod.get(key) ?? 0,
        deficitUncovered: s.deficitUncovered ?? 0,
        ccUsage: ccUsageFromTx,
        ccUsageLimit: s.ccUsageLimit ?? 0,
        paylaterUsage,
        paylaterUsageLimit: s.paylaterUsageLimit ?? 0,
      };
    });

    const withdrawalInputs: WithdrawalAuditInput[] = withdrawals.map((w) => ({
      id: w.id,
      amount: w.amount,
      remark: w.label,
      date: w.date,
    }));

    const config = await this.selectors.getGlobalConfig();
    const policy = config?.financialPolicyJson as any;

    return evaluateAuditDimensions(snapshotInputs, withdrawalInputs, policy);
  }

  /**
   * Evaluates historical snapshots and returns the aggregate discipline scorecard summary.
   * Single source of truth: delegates directly to calculator/discipline.ts.
   */
  async getSummary(): Promise<AuditSummary> {
    const result = await this.computeEvaluation();
    return {
      disciplineScore: result.healthScorecard.disciplineScore,
      healthStatus: result.healthScorecard.healthStatus,
      totalGreenFlags: result.healthScorecard.totalGreenFlags,
      totalRedFlags: result.healthScorecard.totalRedFlags,
      totalChecks: result.healthScorecard.totalChecks,
      flags: result.flags,
    };
  }

  /**
   * Evaluates historical snapshots and returns the full per-dimension, per-month report
   * (powers SCORECARD/OPERATIONAL/REWARDS/DEBT_BURDEN views).
   * Shares identical underlying data and calculation with getSummary().
   */
  async getFullReport(): Promise<AuditEvaluationResult> {
    return this.computeEvaluation();
  }
}
