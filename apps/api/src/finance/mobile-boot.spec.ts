import { FinanceSelectors } from './finance.selectors';

describe('Phase 1 Consolidated Mobile Boot Endpoint (GET /api/finance/mobile-boot)', () => {
  it('returns exact authoritative pacing, priority tiers, wallet guard, cash radar summary, and mobile capabilities without duplicating calculations', async () => {
    const prismaMock: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          accountName: 'cheeseburger',
          username: 'cheeseburger',
          email: 'gabandreas22@gmail.com',
          fullName: 'Gabriel',
          role: 'USER',
          status: 'ACTIVE',
          blueprintType: 'SUPERADMIN_BESPOKE',
          lifeStagePreset: 'SUPERADMIN_BESPOKE',
          uiDensityMode: 'COMMAND_COCKPIT',
          securityPinHash: 'scryptv2$salt$secret',
          ipWhitelistEnforced: false,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-11-23T00:00:00Z'),
        }),
      },
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 1,
          baseSalary: 5300000,
          dailyAllowance: 25000,
          laptopAllowance: 250000,
          dailyOperational: 1500000,
          transport: 200000,
          internet: 200000,
          vape: 0,
          haircut: 0,
          baseSavings: 1000000,
          payrollPayoutDay: 27,
          formulaParamsJson: {},
        }),
      },
      monthlySnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          id: 11,
          userId: 1,
          month: 11,
          year: 2026,
          status: 'DRAFT',
          finalTotalIncome: 5891000,
          totalDeductions: 4522976,
          dailyOperational: 1720316,
          actualDailyOperational: 1720316,
          actualSavings: 6341,
          selfReward: 250000,
          deficitUncovered: 108633,
          transport: 200000,
          internet: 200000,
          vape: 0,
          haircut: 0,
          savings: 1000000,
          selfRewardTarget: 1000000,
        }),
      },
      mobileDevice: {
        count: jest.fn().mockResolvedValue(1),
      },
    };

    const snapshotsSelectorsMock: any = {
      getDefaultActivePeriod: jest.fn().mockResolvedValue({
        month: 11,
        year: 2026,
        strategy: 'EARLIEST_OPEN_ACTIVE',
        skippedLockedPeriod: true,
      }),
    };

    const creditSelectorsMock: any = {
      listLineItems: jest.fn().mockResolvedValue([
        { id: 501, title: 'SPayLater Coffee', category: 'PAYLATER', amount: 52000, dueDay: 25, isSettled: false },
        { id: 502, title: 'Permata Statement', category: 'CREDIT_CARD', amount: 1060900, dueDay: 11, isSettled: true },
      ]),
    };

    const goBridgeMock: any = {};
    const selectors = new FinanceSelectors(
      prismaMock,
      snapshotsSelectorsMock,
      goBridgeMock,
      creditSelectorsMock,
    );

    const mockPacing = {
      cycleState: 'ACTIVE',
      safeToSpendToday: 43636,
      remainingBudget: 160000,
      daysRemaining: 5,
      weekdaySafeRateRp: 43636,
      weekendSafeRateRp: 65454,
      paceDeltaRp: 0,
      cycleStartIso: '2026-10-28',
      cycleEndIso: '2026-11-26',
    };
    const mockWalletGuard = {
      pacing: mockPacing,
      settlementSummary: {
        totalDue: 4522976,
        paidAmount: 1060900,
        reservedAmount: 0,
        unpaidAmount: 3462076,
        bankHoldNeeded: 3462076,
      },
      savedCheckin: null,
      guard: null,
    };
    const mockCashRadar = {
      periodMonth: 11,
      periodYear: 2026,
      cycleStartIso: '2026-10-28',
      cycleEndIso: '2026-11-26',
      nextPaydayIso: '2026-11-27',
      paydayInflowsRp: 5891000,
      totalScheduledBillsRp: 4522976,
      endingCashBufferRp: 160000,
      lowestCashPoint: {
        dateIso: '2026-11-25',
        balanceRp: 125000,
        contextLabel: 'SPayLater Due',
        isTightOrDeficit: false,
      },
      events: [{ dateIso: '2026-11-25', title: 'SPayLater Due', amountRp: -3264116 }],
      dailySeries: [],
    };

    jest.spyOn(selectors, 'getPacing').mockResolvedValue(mockPacing as any);
    jest.spyOn(selectors, 'getWalletGuardStatus').mockResolvedValue(mockWalletGuard as any);
    jest.spyOn(selectors, 'getCashRadarProjection').mockResolvedValue(mockCashRadar as any);

    const boot: any = await (selectors as any).getMobileBoot(1);

    expect(boot.period).toEqual({
      month: 11,
      year: 2026,
      status: 'DRAFT',
      strategy: 'EARLIEST_OPEN_ACTIVE',
      skippedLockedPeriod: true,
    });
    expect(boot.pacing.safeToSpendToday).toBe(43636);
    expect(boot.pacing.remainingBudget).toBe(160000);
    expect(boot.walletGuard.settlementSummary.unpaidAmount).toBe(3462076);
    expect(boot.cashRadarSummary.lowestCashPointRp).toBe(125000);
    expect(boot.bills.unpaidCount).toBe(1);
    expect(boot.bills.totalCount).toBe(2);

    // Must never leak passwordHash, securityPinHash, or P1/Vault jargon
    const serialized = JSON.stringify(boot);
    expect(serialized).not.toContain('securityPinHash');
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toMatch(/\b(Vault|Reservoir|Forward-Borrow|P1 Savings|P2 Reward)\b/);

    expect(boot.mobileCapabilities).toEqual(
      expect.objectContaining({
        hasSecurityPin: true,
        biometricDevicesCount: 1,
        apiContractVersion: '2026-11-v1',
      }),
    );
  });
});
