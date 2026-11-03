import {
  calculateCashReconciliation,
  ReconciliationSimulationInput,
} from './reconciliation';

describe('calculateCashReconciliation', () => {
  const baseInput: ReconciliationSimulationInput = {
    periodMonth: 10,
    periodYear: 2026,
    actualRealBalance: 800000,
    baseSalary: 5000000,
    salaryAdjustment: 0,
    totalWorkingDays: 21,
    dailyAllowance: 40000,
    cafeteriaDeduction: 0,
    thrAmount: 0,
    bonusAmount: 0,
    laptopAllowance: 250000,
    savingsTarget: 1000000,
    selfRewardTarget: 300000,
    dailyOperationalTarget: 1000000,
    transportTarget: 250000,
    internetTarget: 150000,
    vapeTarget: 260000,
    haircutTarget: 100000,
    bufferPocketTarget: 0,
    transactions: [
      { type: 'CREDIT_BILL', sourceType: 'BULK_BILL', amount: 1500000 },
      { type: 'DEDUCTION', sourceType: 'MANUAL', amount: 200000 },
    ],
    cycleStartDate: new Date(Date.UTC(2026, 9, 25)),
    cycleEndDate: new Date(Date.UTC(2026, 10, 24)),
    isEndDateConfirmed: true,
    referenceDate: new Date(Date.UTC(2026, 10, 15)), // 10 days remaining (15..24 Nov inclusive)
  };

  it('returns MATCHED and NO_OP when actualRealBalance equals systemRemainingBudget', () => {
    const res = calculateCashReconciliation({
      ...baseInput,
      actualRealBalance: 800000, // 1,000,000 - 200,000 = 800,000
    });

    expect(res.systemRemainingBudget).toBe(800000);
    expect(res.varianceAmount).toBe(0);
    expect(res.discrepancyDirection).toBe('MATCHED');
    expect(res.resolvedActionType).toBe('NO_OP');
    expect(res.projected.remainingBudget).toBe(800000);
    expect(res.impact.warnings).toHaveLength(0);
  });

  it('simulates normal SHORTFALL via RECORD_DEDUCTION_ADJUSTMENT and updates remainingBudget to actualRealBalance without double-counting in waterfall', () => {
    // Net income: 5,000,000 - 150,000 + 250,000 + 840,000 = 5,940,000
    // Fixed essentials: 760,000; Daily Op target: 1,000,000; Credit bills: 1,500,000
    // 200k existing spend + 150k shortfall = 350k total spend (fully absorbed in 1M living pool)
    // Available funds: 5,940,000 - 1,760,000 - 1,500,000 = 2,680,000 (P1=1,000,000, P2=1,680,000)
    const res = calculateCashReconciliation({
      ...baseInput,
      actualRealBalance: 650000, // Shortfall of Rp 150,000
    });

    expect(res.discrepancyDirection).toBe('SHORTFALL');
    expect(res.varianceAmount).toBe(-150000);
    expect(res.adjustmentAmount).toBe(150000);
    expect(res.resolvedActionType).toBe('RECORD_DEDUCTION_ADJUSTMENT');

    // Remaining budget becomes 650,000; across 10 remaining days safeToSpendToday = 65,000
    expect(res.projected.totalDailySpent).toBe(350000);
    expect(res.projected.remainingBudget).toBe(650000);
    expect(res.projected.safeToSpendToday).toBe(65000);
    expect(res.projected.actualSavings).toBe(1000000);
    expect(res.projected.selfReward).toBe(1680000); // 350k spend is absorbed in the 1M daily living pool, so selfReward remains 1,680,000
    expect(res.impact.triggersWaterfallDeficit).toBe(false);
    expect(res.impact.reducesPriority1Savings).toBe(false);
  });

  it('detects Priority 1 Savings reduction and Waterfall Deficit Trap when target expansion exceeds available surplus', () => {
    // Credit bill: 3,800,000, Fixed: 760,000, Daily Op: 1,000,000 -> Upfront: 1,760,000
    // Available funds: 5,940,000 - 1,760,000 - 3,800,000 = 380,000 (P1 = 380,000, P2 = 0)
    // System remaining budget: 1,000,000 - 200,000 = 800,000
    const tightInput: ReconciliationSimulationInput = {
      ...baseInput,
      transactions: [
        { type: 'CREDIT_BILL', sourceType: 'BULK_BILL', amount: 3800000 },
        { type: 'DEDUCTION', sourceType: 'MANUAL', amount: 200000 },
      ],
      surplusResolutionMode: 'INCREASE_OPERATIONAL_TARGET',
    };

    // Case A: Surplus of Rp 200,000 (actualRealBalance: 1,000,000 vs 800,000 budget)
    // Expanding daily operational target by 200,000 reduces P1 Savings from 380,000 to 180,000
    const p1Reduced = calculateCashReconciliation({
      ...tightInput,
      actualRealBalance: 1000000,
    });
    expect(p1Reduced.discrepancyDirection).toBe('SURPLUS');
    expect(p1Reduced.resolvedActionType).toBe('REVISE_OPERATIONAL_TARGET');
    expect(p1Reduced.impact.reducesPriority1Savings).toBe(true);
    expect(p1Reduced.impact.savingsReductionAmount).toBe(200000);
    expect(p1Reduced.projected.actualSavings).toBe(180000);
    expect(p1Reduced.impact.triggersWaterfallDeficit).toBe(false);

    // Case B: Surplus of Rp 500,000 (actualRealBalance: 1,300,000 vs 800,000 budget)
    // Expanding daily operational target by 500,000 exceeds 380,000 available surplus -> triggers Waterfall Deficit Trap!
    const deficitTrap = calculateCashReconciliation({
      ...tightInput,
      actualRealBalance: 1300000,
    });
    expect(deficitTrap.impact.triggersWaterfallDeficit).toBe(true);
    expect(deficitTrap.projected.isDeficit).toBe(true);
    expect(deficitTrap.projected.deficitUncovered).toBe(120000);
    // Because waterfall enters deficit, actualDailyOperational collapses to 0!
    expect(deficitTrap.projected.actualDailyOperational).toBe(0);
    expect(deficitTrap.projected.safeToSpendToday).toBe(0);
    expect(
      deficitTrap.impact.warnings.some((w) =>
        w.includes('Waterfall Deficit Trap'),
      ),
    ).toBe(true);
  });

  it('accurately simulates both SURPLUS resolution modes (INCREASE_OPERATIONAL_TARGET vs RECORD_INCOME_ADJUSTMENT)', () => {
    // Mode 1: INCREASE_OPERATIONAL_TARGET (+100,000 surplus)
    const opMode = calculateCashReconciliation({
      ...baseInput,
      actualRealBalance: 900000, // +100,000 above 800,000
      surplusResolutionMode: 'INCREASE_OPERATIONAL_TARGET',
    });

    expect(opMode.discrepancyDirection).toBe('SURPLUS');
    expect(opMode.varianceAmount).toBe(100000);
    expect(opMode.resolvedActionType).toBe('REVISE_OPERATIONAL_TARGET');
    expect(opMode.projected.dailyOperationalTarget).toBe(1100000);
    expect(opMode.projected.actualDailyOperational).toBe(1100000);
    expect(opMode.projected.remainingBudget).toBe(900000);
    expect(opMode.projected.safeToSpendToday).toBe(90000);

    // Mode 2: RECORD_INCOME_ADJUSTMENT (+100,000 extra income)
    const incomeMode = calculateCashReconciliation({
      ...baseInput,
      actualRealBalance: 900000,
      surplusResolutionMode: 'RECORD_INCOME_ADJUSTMENT',
    });

    expect(incomeMode.resolvedActionType).toBe('RECORD_INCOME_ADJUSTMENT');
    expect(incomeMode.projected.finalTotalIncome).toBe(
      incomeMode.current.finalTotalIncome + 100000,
    );
    // Remaining operational budget stays 800,000 while P2 self-reward absorbs +100,000
    expect(incomeMode.projected.remainingBudget).toBe(800000);
    expect(incomeMode.projected.selfReward).toBe(
      incomeMode.current.selfReward + 100000,
    );
    expect(
      incomeMode.impact.warnings.some((w) =>
        w.includes('Income Waterfall Routing'),
      ),
    ).toBe(true);

    // Mode 3: RECORD_OPERATIONAL_REFUND (+100,000 operational reimbursement offset)
    const refundMode = calculateCashReconciliation({
      ...baseInput,
      actualRealBalance: 900000,
      surplusResolutionMode: 'RECORD_OPERATIONAL_REFUND',
    });

    expect(refundMode.resolvedActionType).toBe('RECORD_OPERATIONAL_REFUND');
    expect(refundMode.projected.finalTotalIncome).toBe(
      refundMode.current.finalTotalIncome,
    );
    expect(refundMode.projected.totalDailySpent).toBe(100000); // 200,000 - 100,000 refund
    expect(refundMode.projected.remainingBudget).toBe(900000);
    expect(refundMode.projected.safeToSpendToday).toBe(90000);
  });

  describe('smart dual-mode balance checkpoint with includesUnspentRoutinePool', () => {
    it('accurately deducts remaining unspent routine bills pool when includesUnspentRoutinePool is true', () => {
      // Total routine bills target = 250k (transport) + 150k (internet) + 260k (vape) + 100k (haircut) = 760,000
      // 0 fixed transactions logged -> remainingRoutineBillsPool = 760,000
      // Daily operational remaining budget = 1,000,000 - 200,000 = 800,000
      // Total bank balance = 1,560,000 (800,000 daily living + 760,000 routine bills in same bank account)
      const res = calculateCashReconciliation({
        ...baseInput,
        actualRealBalance: 1560000,
        includesUnspentRoutinePool: true,
      });

      expect(res.includesUnspentRoutinePool).toBe(true);
      expect(res.remainingRoutineBillsPool).toBe(760000);
      expect(res.effectiveOperationalCashBalance).toBe(800000);
      expect(res.varianceAmount).toBe(0);
      expect(res.discrepancyDirection).toBe('MATCHED');
      expect(res.resolvedActionType).toBe('NO_OP');
    });

    it('identifies unitemized spend shortfall when bank balance is lower than daily living + routine bills', () => {
      // Total in bank: 1,460,000 (100,000 less than the required 1,560,000)
      const res = calculateCashReconciliation({
        ...baseInput,
        actualRealBalance: 1460000,
        includesUnspentRoutinePool: true,
      });

      expect(res.includesUnspentRoutinePool).toBe(true);
      expect(res.remainingRoutineBillsPool).toBe(760000);
      expect(res.effectiveOperationalCashBalance).toBe(700000); // 1,460,000 - 760,000
      expect(res.varianceAmount).toBe(-100000);
      expect(res.adjustmentAmount).toBe(100000);
      expect(res.discrepancyDirection).toBe('SHORTFALL');
      expect(res.resolvedActionType).toBe('RECORD_DEDUCTION_ADJUSTMENT');
    });
  });
});
