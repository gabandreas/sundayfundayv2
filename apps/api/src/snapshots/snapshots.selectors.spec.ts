import { SnapshotsSelectors } from './snapshots.selectors';
import { SavingsSelectors } from '../savings/savings.selectors';
import { SnapshotStatus } from '@prisma/client';

describe('SnapshotsSelectors & SavingsSelectors Multi-Period Integrity', () => {
  it('provisions uncreated 09/2027 with Payday(08/2027) working days (21), 2027-08-27 payout date, and Rp 1.500.000 living budget', async () => {
    const createdPayloads: any[] = [];
    const mockPrisma: any = {
      monthlySnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          createdPayloads.push(data);
          return {
            id: 99,
            ...data,
            transactions: [],
            budgetRevisions: [],
          };
        }),
      },
      globalConfig: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          baseSalary: 5300000,
          dailyAllowance: 25000,
          laptopAllowance: 250000,
          dailyOperational: 1500000,
          transport: 300000,
          internet: 0,
          vape: 150000,
          haircut: 85000,
          baseSavings: 1000000,
          creditLimit: 7000000,
          creditStatementDay: 25,
          creditDueDay: 11,
          payrollPayoutDay: 27,
          ccUsageLimit: 6000000,
          paylaterUsageLimit: 6000000,
          payrollRulesJson: null,
          allocationBucketsJson: null,
          surplusSplitRulesJson: null,
          financialPolicyJson: null,
          formulaParamsJson: null,
        }),
      },
    };

    const selectors = new SnapshotsSelectors(mockPrisma);
    const snap = await selectors.getOrCreateDraftSnapshot(9, 2027, 1);

    expect(createdPayloads).toHaveLength(1);
    expect(snap.totalWorkingDays).toBe(21);
    expect(snap.dailyOperational).toBe(1500000);
    // Aug 25, 2027 is Wed -> +1 Thu 26 review -> +2 Fri 27 Aug 2027 transfer
    expect(new Date(snap.payrollPayoutDate).toISOString().slice(0, 10)).toBe('2027-08-27');
  });

  it('computes Payday(M-1) working days and Friday->Tuesday Two-Stage payout dates across 07/2027–09/2027', async () => {
    const mockPrisma: any = {
      globalConfig: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          baseSalary: 5300000,
          dailyAllowance: 25000,
          laptopAllowance: 250000,
          dailyOperational: 1500000,
          transport: 300000,
          internet: 0,
          vape: 150000,
          haircut: 85000,
          baseSavings: 1000000,
          creditLimit: 7000000,
          creditStatementDay: 25,
          creditDueDay: 11,
          payrollPayoutDay: 27,
          ccUsageLimit: 6000000,
          paylaterUsageLimit: 6000000,
          payrollRulesJson: null,
          allocationBucketsJson: null,
          surplusSplitRulesJson: null,
          financialPolicyJson: null,
          formulaParamsJson: null,
          formulaEngineType: 'DEBT_FIRST_WATERFALL',
        }),
      },
      monthlySnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      monthlyBulkBill: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      creditCardTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      creditContract: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const selectors = new SnapshotsSelectors(mockPrisma);
    const horizon = await selectors.listHorizonSnapshots(7, 2027, 3, 1);
    expect(horizon.periods).toHaveLength(3);
    const jul27 = horizon.periods[0];
    const aug27 = horizon.periods[1];
    const sep27 = horizon.periods[2];
    // Jun 25, 2027 is Friday -> Mon Jun 28 review -> Tue Jun 29 transfer
    expect(jul27.payrollPayoutDate.slice(0, 10)).toBe('2027-06-29');
    expect(aug27.totalWorkingDays).toBe(22);
    expect(aug27.finalTotalIncome).toBe(5941000);
    // Jul 25, 2027 is Sunday -> Fri Jul 23 payslip -> Mon Jul 26 review -> Tue Jul 27 transfer
    expect(aug27.payrollPayoutDate.slice(0, 10)).toBe('2027-07-27');
    expect(sep27.totalWorkingDays).toBe(21);
    expect(sep27.finalTotalIncome).toBe(5916000);
    expect(sep27.payrollPayoutDate.slice(0, 10)).toBe('2027-08-27');
    expect(sep27.dailyOperational).toBe(1500000);
  });

  it('defaults monthlyLivingExpenseBaseline to Rp 1.500.000 in SavingsSelectors when config is null', async () => {
    const mockPrisma: any = {
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      savingsManualTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      monthlySnapshot: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const savings = new SavingsSelectors(mockPrisma);
    // Avoid full getOverview call side queries by spying cleanly on getOverview
    jest.spyOn(savings, 'getOverview').mockResolvedValue({
      currentVaultBalance: 0,
      monthlyTarget: 1000000,
      statusCounts: { [SnapshotStatus.LOCKED]: 0, [SnapshotStatus.DRAFT]: 0 },
      periods: [],
      pendingTransferCount: 0,
      pendingTransferTotal: 0,
      untransferredLockedCount: 0,
      untransferredLockedTotal: 0,
    } as any);

    const vault = await savings.getVault(11, 2026, 1);
    expect(vault.monthlyLivingExpenseBaseline).toBe(1500000);
  });
});
