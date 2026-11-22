import { SnapshotsService } from './snapshots.service';
import { SnapshotStatus } from '@prisma/client';

describe('SnapshotsService Manual Override & Sync Integrity (TDD RED->GREEN)', () => {
  it('preserves isManualOverride targets (1.720.316 Daily & 200.000 Nov 25 Bill) during recalculateSnapshot even when frozenRulesJson is stale', async () => {
    const updatedPayloads: any[] = [];
    const mockSnapshot: any = {
      id: 4,
      userId: 1,
      month: 11,
      year: 2026,
      status: SnapshotStatus.DRAFT,
      salaryAdjustment: 0,
      totalWorkingDays: 20,
      cafeteriaDeduction: 0,
      thrAmount: 0,
      bonusAmount: 0,
      dailyOperational: 1720316,
      transport: 200000,
      internet: 200000,
      vape: 0,
      haircut: 0,
      savings: 6341,
      selfRewardTarget: 250000,
      bufferPocket: 0,
      isManualOverride: true,
      lockedP1: 6341,
      lockedP2: 250000,
      bridgeInflowAmount: 900000,
      oneOffBillsJson: [{ slot: 'INTERNET', label: 'Nov 25 Bill' }],
      // Simulate stale frozenRulesJson that triggered the Nov 22 Sync Balance bug
      frozenRulesJson: {
        payrollRules: [
          { id: 'bpjs', label: 'BPJS', value: 3, isActive: true, direction: 'DEDUCTION', formulaType: 'PERCENT_OF_BASE' },
          { id: 'laptop_allowance', label: 'Laptop Allowance', value: 250000, isActive: true, direction: 'ADDITION', formulaType: 'FIXED_AMOUNT' },
          { id: 'daily_attendance', label: 'Daily Attendance', value: 25000, isActive: true, direction: 'ADDITION', formulaType: 'RATE_PER_WORKING_DAY' },
        ],
        allocationBuckets: [
          { id: 'transport', group: 'FIXED_ESSENTIAL', label: 'Transport', value: 200000, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'internet', group: 'FIXED_ESSENTIAL', label: 'Nov 25 Bill', value: 0, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'vape', group: 'FIXED_ESSENTIAL', label: 'Vape', value: 0, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'haircut', group: 'FIXED_ESSENTIAL', label: 'Haircut', value: 0, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'buffer', group: 'BUFFER', label: 'Buffer', value: 0, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'daily_operational', group: 'DAILY_OPERATIONAL', label: 'Daily Living', value: 461147, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 0 },
          { id: 'core_savings', group: 'SAVINGS_P1', label: 'Core Savings P1', value: 1000000, isActive: true, formulaType: 'FIXED_AMOUNT', priorityTier: 1 },
          { id: 'self_reward', group: 'SELF_REWARD_P2', label: 'Self-Reward P2', value: 0, isActive: true, formulaType: 'REMAINDER_OVERFLOW', priorityTier: 2 },
        ],
      },
      // Simulate prior stale revision that would clobber internet=200000 unless column override wins
      budgetRevisions: [
        { id: 32, category: 'INTERNET', bucketKey: 'internet', previousValue: 100000, newValue: 0, reason: 'Stale revision' },
      ],
    };

    const transactions: any[] = [
      { id: 1, type: 'CREDIT_BILL', sourceType: 'BULK_BILL', amount: 4522976, label: 'Debt', date: new Date('2026-11-01T00:00:00Z') },
      { id: 2, type: 'DEDUCTION', sourceType: 'MANUAL', fixedEssentialCategory: 'TRANSPORT', amount: 200000, label: 'Transport Quota', date: new Date('2026-11-01T00:00:00Z') },
      { id: 3, type: 'DEDUCTION', sourceType: 'MANUAL', fixedEssentialCategory: 'INTERNET', amount: 200000, label: 'Nov 25 Bill', date: new Date('2026-11-01T00:00:00Z') },
      { id: 4, type: 'DEDUCTION', sourceType: 'MANUAL', amount: 1420316, label: 'Prior Living Spend', date: new Date('2026-11-15T00:00:00Z') },
      // User enters 160.000 actual cash when remaining was 300.000 -> -140.000 reconciliation deduction
      { id: 5, type: 'DEDUCTION', sourceType: 'MANUAL', amount: 140000, label: 'Unitemized daily operational spend', date: new Date('2026-11-22T00:00:00Z') },
    ];

    const txMock: any = {
      monthlySnapshot: {
        findUniqueOrThrow: jest.fn().mockResolvedValue(mockSnapshot),
        update: jest.fn().mockImplementation(async ({ data }: any) => {
          updatedPayloads.push(data);
          return { ...mockSnapshot, ...data, transactions, budgetRevisions: mockSnapshot.budgetRevisions };
        }),
      },
      globalConfig: {
        findUnique: jest.fn().mockResolvedValue({
          userId: 1,
          baseSalary: 5300000,
          dailyAllowance: 25000,
          laptopAllowance: 250000,
          activeTrackingStartYear: 2026,
          activeTrackingStartMonth: 10,
          formulaEngineType: 'DEBT_FIRST_WATERFALL',
          formulaParamsJson: null,
        }),
      },
      transaction: {
        findMany: jest.fn().mockResolvedValue(transactions),
      },
    };

    const service = new SnapshotsService({} as any, { record: jest.fn() } as any);
    const updated: any = await service.recalculateSnapshot(4, txMock);

    expect(updatedPayloads).toHaveLength(1);
    const saved = updatedPayloads[0];
    expect(saved.dailyOperational).toBe(1720316);
    expect(saved.internet).toBe(200000);
    expect(saved.transport).toBe(200000);
    expect(saved.actualDailyOperational).toBe(1720316);
    expect(saved.actualSavings).toBe(6341);
    expect(saved.selfReward).toBe(250000);
    // Exact mathematical conservation: 6,899,633 total obligations (incl. Nov 25 Bill 200k) vs 6,791,000 income+bridge = 108,633 uncovered
    expect(saved.totalDeductions).toBe(4522976);
    expect(saved.deficitUncovered).toBe(108633);
    // Daily spend = 1,420,316 + 140,000 = 1,560,316 -> remaining = 1,720,316 - 1,560,316 = 160,000
    const livingRealization = saved.bucketRealizationsJson.find((b: any) => b.bucketId === 'daily_operational');
    expect(livingRealization.loggedSpend).toBe(1560316);
    expect(livingRealization.remainingBudget).toBe(160000);
    const nov25Realization = saved.bucketRealizationsJson.find((b: any) => b.bucketId === 'internet');
    expect(nov25Realization.revisedTarget).toBe(200000);
    expect(nov25Realization.remainingBudget).toBe(0);
    expect(updated.deficitUncovered).toBe(108633);
  });
});
