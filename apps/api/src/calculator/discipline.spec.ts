import {
  calculateDisciplineScore,
  getHealthStatus,
  evaluateAuditDimensions,
  SnapshotAuditInput,
} from './discipline';

describe('discipline calculator', () => {
  describe('V1 Bug #4 regression guard: Single authoritative score formula', () => {
    it('calculates score strictly as green / (green + red) * 100', () => {
      // 8 green, 2 red = 80%
      expect(calculateDisciplineScore(8, 2)).toBe(80);

      // 7 green, 3 red = 70%
      expect(calculateDisciplineScore(7, 3)).toBe(70);

      // 1 green, 3 red = 25%
      expect(calculateDisciplineScore(1, 3)).toBe(25);

      // If V1 Bug #4 were present, a second formula:
      // score = 100 - (deficits * 15) - (adjustments * 5)
      // For 2 deficits, that formula would yield 70 instead of 80!
      // This test ensures only the green/(green+red) formula is used.
      const buggedAlternativeFormula = (
        deficits: number,
        adjustments: number,
      ) => 100 - deficits * 15 - adjustments * 5;
      expect(calculateDisciplineScore(8, 2)).not.toBe(
        buggedAlternativeFormula(2, 0),
      );
    });

    it('defaults to 100 when there are zero flags', () => {
      expect(calculateDisciplineScore(0, 0)).toBe(100);
    });

    it('handles 100% green and 100% red extremes', () => {
      expect(calculateDisciplineScore(10, 0)).toBe(100);
      expect(calculateDisciplineScore(0, 10)).toBe(0);
    });
  });

  describe('health status mapping', () => {
    it('maps scores to EXCELLENT, GOOD, CAUTION, and CRITICAL', () => {
      expect(getHealthStatus(95)).toBe('EXCELLENT');
      expect(getHealthStatus(90)).toBe('EXCELLENT');
      expect(getHealthStatus(89)).toBe('GOOD');
      expect(getHealthStatus(75)).toBe('GOOD');
      expect(getHealthStatus(74)).toBe('CAUTION');
      expect(getHealthStatus(50)).toBe('CAUTION');
      expect(getHealthStatus(49)).toBe('CRITICAL');
      expect(getHealthStatus(0)).toBe('CRITICAL');
    });
  });

  describe('7 audit check dimensions evaluation', () => {
    it('evaluates Dimension 1: Operational Living Budget (two-tier severity: CRITICAL and TIGHT)', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000, // HEALTHY
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
        {
          month: 8,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 1500000,
          targetDailyOperational: 3000000, // TIGHT (shortfall 1.5M, but >= 1M)
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
        {
          month: 9,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 800000,
          targetDailyOperational: 3000000, // CRITICAL (< 1M)
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      expect(result.operationalAudit[0].status).toBe('HEALTHY');
      expect(result.operationalAudit[1].status).toBe('TIGHT');
      expect(result.operationalAudit[2].status).toBe('CRITICAL');

      const opFlags = result.flags.filter(
        (f) => f.category === 'OPERATIONAL_BUDGET',
      );
      expect(opFlags.filter((f) => f.type === 'GREEN').length).toBe(1);
      expect(opFlags.filter((f) => f.type === 'RED').length).toBe(2);
    });

    it('evaluates Dimension 2: Self-Reward multi-month streak tracking', () => {
      // Month 1: zero reward -> streak 1 (no red flag yet)
      // Month 2: zero reward -> streak 2 (RED flag generated)
      // Month 3: self reward funded -> streak reset to 0 (GREEN flag generated)
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 0,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
        {
          month: 8,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 0,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
        {
          month: 9,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      expect(result.selfRewardAudit[0].streakWithoutReward).toBe(1);
      expect(result.selfRewardAudit[1].streakWithoutReward).toBe(2);
      expect(result.selfRewardAudit[2].streakWithoutReward).toBe(0);

      const rewardFlags = result.flags.filter(
        (f) => f.category === 'SELF_REWARD',
      );
      // Only month 2 gets RED, month 3 gets GREEN
      expect(rewardFlags.filter((f) => f.type === 'RED').length).toBe(1);
      expect(rewardFlags.filter((f) => f.type === 'GREEN').length).toBe(1);
    });

    it('evaluates Dimension 3: Debt Burden thresholds (> 35% RED, <= 25% GREEN)', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 4000000, // 40% -> RED
        },
        {
          month: 8,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000, // 20% -> GREEN
        },
        {
          month: 9,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 3000000, // 30% -> neutral (neither flag)
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      const debtFlags = result.flags.filter(
        (f) => f.category === 'DEBT_BURDEN',
      );
      expect(debtFlags.filter((f) => f.type === 'RED').length).toBe(1);
      expect(debtFlags.filter((f) => f.type === 'GREEN').length).toBe(1);
      expect(result.debtBurdenAudit[0].debtRatio).toBe(40);
      expect(result.debtBurdenAudit[1].debtRatio).toBe(20);
      expect(result.debtBurdenAudit[2].debtRatio).toBe(30);
    });

    it('evaluates Dimension 4: Savings target met vs slashed', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1500000,
          targetSavings: 1000000, // Met -> GREEN
          totalBills: 2000000,
        },
        {
          month: 8,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 500000,
          targetSavings: 1000000, // Slashed -> RED
          totalBills: 2000000,
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      const savingsFlags = result.flags.filter((f) => f.category === 'SAVINGS');
      expect(savingsFlags.find((f) => f.type === 'GREEN')?.amount).toBe(
        1500000,
      );
      expect(savingsFlags.find((f) => f.type === 'RED')?.amount).toBe(500000);
    });

    it('evaluates Dimension 5: Informal Pre-Payroll Debt', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000,
          selfReward: 500000,
          targetSelfReward: 500000,
          actualSavings: 1000000,
          targetSavings: 1000000,
          totalBills: 2000000,
          personalDebt: 750000, // borrowed -> RED
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      const debtFlags = result.flags.filter(
        (f) => f.category === 'INFORMAL_DEBT',
      );
      expect(debtFlags.length).toBe(1);
      expect(debtFlags[0].amount).toBe(750000);
    });

    it('evaluates Dimension 6: Uncovered Cashflow Deficit', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 8000000,
          actualDailyOperational: 0,
          targetDailyOperational: 3000000,
          selfReward: 0,
          targetSelfReward: 500000,
          actualSavings: 0,
          targetSavings: 1000000,
          totalBills: 9000000,
          deficitUncovered: 1000000, // deficit -> RED
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      const deficitFlags = result.flags.filter((f) => f.category === 'DEFICIT');
      expect(deficitFlags.length).toBe(1);
      expect(deficitFlags[0].amount).toBe(1000000);
    });

    it('evaluates Dimension 7: Savings Vault Drawdown', () => {
      const snapshots: SnapshotAuditInput[] = [];
      const withdrawals = [
        {
          id: 'wd-1',
          amount: 2500000,
          remark: 'Emergency laptop repair',
        },
      ];

      const result = evaluateAuditDimensions(snapshots, withdrawals);
      const vaultFlags = result.flags.filter(
        (f) => f.category === 'SAVINGS_VAULT',
      );
      expect(vaultFlags.length).toBe(1);
      expect(vaultFlags[0].amount).toBe(2500000);
      expect(vaultFlags[0].type).toBe('RED');
    });

    it('computes overall scorecard correctly across multiple dimensions', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          month: 7,
          year: 2026,
          totalIncome: 10000000,
          actualDailyOperational: 3000000,
          targetDailyOperational: 3000000, // +1 GREEN
          selfReward: 500000,
          targetSelfReward: 500000, // +1 GREEN
          actualSavings: 1000000,
          targetSavings: 1000000, // +1 GREEN
          totalBills: 2000000, // 20% -> +1 GREEN
          personalDebt: 0,
          deficitUncovered: 0,
        },
      ];
      // Total 4 GREEN, 0 RED -> Score 100, EXCELLENT
      const result = evaluateAuditDimensions(snapshots);
      expect(result.healthScorecard.totalGreenFlags).toBe(4);
      expect(result.healthScorecard.totalRedFlags).toBe(0);
      expect(result.healthScorecard.disciplineScore).toBe(100);
      expect(result.healthScorecard.healthStatus).toBe('EXCELLENT');
    });

    it('emits zero credit-limit flags when limits are 0, GREEN when respected, and RED when breached', () => {
      const snapshots: SnapshotAuditInput[] = [
        {
          // Unconfigured limits (0) -> zero credit-limit flags
          month: 7,
          year: 2026,
          totalIncome: 10_000_000,
          actualDailyOperational: 3_000_000,
          targetDailyOperational: 3_000_000,
          selfReward: 500_000,
          targetSelfReward: 500_000,
          actualSavings: 1_000_000,
          targetSavings: 1_000_000,
          totalBills: 3_000_000,
          ccUsage: 800_000,
          ccUsageLimit: 0,
          paylaterUsage: 2_200_000,
          paylaterUsageLimit: 0,
        },
        {
          // Configured limits respected -> GREEN flag credit-limit-respected-2026-8
          month: 8,
          year: 2026,
          totalIncome: 10_000_000,
          actualDailyOperational: 3_000_000,
          targetDailyOperational: 3_000_000,
          selfReward: 500_000,
          targetSelfReward: 500_000,
          actualSavings: 1_000_000,
          targetSavings: 1_000_000,
          totalBills: 3_000_000,
          ccUsage: 800_000,
          ccUsageLimit: 1_000_000,
          paylaterUsage: 1_500_000,
          paylaterUsageLimit: 2_000_000,
        },
        {
          // Configured limit breached -> RED flag credit-limit-exceeded-2026-9
          month: 9,
          year: 2026,
          totalIncome: 10_000_000,
          actualDailyOperational: 3_000_000,
          targetDailyOperational: 3_000_000,
          selfReward: 500_000,
          targetSelfReward: 500_000,
          actualSavings: 1_000_000,
          targetSavings: 1_000_000,
          totalBills: 3_000_000,
          ccUsage: 1_200_000,
          ccUsageLimit: 1_000_000,
          paylaterUsage: 1_800_000,
          paylaterUsageLimit: 2_000_000,
        },
      ];

      const result = evaluateAuditDimensions(snapshots);
      expect(
        result.flags.find((f) => f.id === 'credit-limit-exceeded-2026-7'),
      ).toBeUndefined();
      expect(
        result.flags.find((f) => f.id === 'credit-limit-respected-2026-7'),
      ).toBeUndefined();

      const respectedFlag = result.flags.find(
        (f) => f.id === 'credit-limit-respected-2026-8',
      );
      expect(respectedFlag).toBeDefined();
      expect(respectedFlag?.type).toBe('GREEN');
      expect(respectedFlag?.category).toBe('DEBT_BURDEN');

      const exceededFlag = result.flags.find(
        (f) => f.id === 'credit-limit-exceeded-2026-9',
      );
      expect(exceededFlag).toBeDefined();
      expect(exceededFlag?.type).toBe('RED');
      expect(exceededFlag?.category).toBe('DEBT_BURDEN');
      expect(exceededFlag?.amount).toBe(200_000);
    });
  });
});
