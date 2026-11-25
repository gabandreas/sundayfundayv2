import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { resolveStudioConfig } from './studio.defaults';
import { SavingsService } from '../savings/savings.service';
import { AuthService } from '../auth/auth.service';
import { hashPassword } from '../auth/auth.utils';
import { FinanceSelectors } from '../finance/finance.selectors';
import { ReportsSelectors } from '../reports/reports.selectors';

describe('V2.6 Configurable Priorities, Savings Pockets, Account Password, Go Scenarios & Unified Discipline Score (TDD)', () => {
  it('resolves priorityTiers without P1/P2/P3 labels, includes savingsPockets/display/privacy defaults, and strips legacy SPinjam shortcut', () => {
    const legacySaved = {
      sidebarNavigationConfig: {
        defaultLandingRoute: '/',
        moduleOverrides: {},
        customShortcuts: [
          {
            id: 'shortcut_spinjam_freedom',
            label: 'SPinjam Tracker',
            icon: 'TrendingDown',
            targetHref: '/credit?sub=contracts&focus=spinjam',
            sectionGroup: 'AUDIT_DECISION',
          },
          {
            id: 'custom_user_shortcut',
            label: 'Cash Flow Radar',
            icon: 'CalendarDays',
            targetHref: '/calendar',
            sectionGroup: 'FINANCIAL_ENGINE',
          },
        ],
      },
    };

    const resolved: any = resolveStudioConfig(1, { studioConfig: legacySaved });

    expect(Array.isArray(resolved.priorityTiers)).toBe(true);
    expect(resolved.priorityTiers.length).toBeGreaterThanOrEqual(2);
    expect(resolved.priorityTiers[0].label).not.toMatch(/\b(P1|P2|P3|Priority [123])\b/i);
    expect(Array.isArray(resolved.savingsPockets)).toBe(true);
    expect(resolved.savingsPockets.some((p: any) => p.category === 'EMERGENCY_FUND')).toBe(true);
    expect(resolved.displayPreferences?.hidePriorityCodesInUi).toBe(true);
    expect(resolved.privacyPreferences?.maskBalancesByDefault).toBe(true);

    const shortcutIds = resolved.sidebarNavigationConfig.customShortcuts.map((s: any) => s.id);
    expect(shortcutIds).not.toContain('shortcut_spinjam_freedom');
    expect(shortcutIds).toContain('custom_user_shortcut');
  });

  it('validates SavingsService.updateSavingsPockets against confirmed balance and computes unallocated pool accurately', async () => {
    const prisma: any = {
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({ id: 1, userId: 1, formulaParamsJson: {} }),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 1, userId: 1, ...data })),
      },
      savingsManualTransaction: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1, amount: 272541, instrumentType: 'LIQUID_CASH' },
        ]),
      },
    };
    const auditLogService: any = { record: jest.fn().mockResolvedValue(undefined) };
    const svc: any = new SavingsService(prisma, auditLogService);

    await expect(
      svc.updateSavingsPockets(
        {
          pockets: [
            { id: 'pocket_emergency', key: 'EMERGENCY_FUND', name: 'Emergency Fund', category: 'EMERGENCY_FUND', allocatedRp: 300000, targetRp: 4500000 },
          ],
        },
        1,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      svc.updateSavingsPockets(
        {
          pockets: [
            { id: 'pocket_emergency', key: 'EMERGENCY_FUND', name: 'Emergency Fund', category: 'EMERGENCY_FUND', allocatedRp: -100, targetRp: 4500000 },
          ],
        },
        1,
      ),
    ).rejects.toThrow(BadRequestException);

    const saved = await svc.updateSavingsPockets(
      {
        pockets: [
          { id: 'pocket_emergency', key: 'EMERGENCY_FUND', name: 'Emergency Fund', category: 'EMERGENCY_FUND', allocatedRp: 200000, targetRp: 4500000 },
          { id: 'pocket_wishlist', key: 'WISHLIST_RESERVE', name: 'Wishlist Reserve', category: 'WISHLIST', allocatedRp: 50000, targetRp: 500000 },
        ],
      },
      1,
    );

    expect(saved.totalConfirmedSavingsRp).toBe(272541);
    expect(saved.totalAllocatedRp).toBe(250000);
    expect(saved.unallocatedPoolRp).toBe(22541);
    expect(prisma.globalConfig.update).toHaveBeenCalledTimes(1);
  });

  it('enforces current password verification and protects Demo Sandbox in AuthService.changePassword', async () => {
    const oldHash = hashPassword('CurrentPass#123');
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
          if (where.id === 2) return { id: 2, passwordHash: oldHash };
          return { id: 1, passwordHash: oldHash };
        }),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };
    const rateLimiter: any = { check: jest.fn(), recordFailure: jest.fn(), reset: jest.fn() };
    const auth: any = new AuthService(prisma, rateLimiter);

    await expect(
      auth.changePassword(2, { currentPassword: 'CurrentPass#123', newPassword: 'NewPassword#999' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      auth.changePassword(1, { currentPassword: 'WrongPassword', newPassword: 'NewPassword#999' }),
    ).rejects.toThrow(UnauthorizedException);

    const res = await auth.changePassword(1, {
      currentPassword: 'CurrentPass#123',
      newPassword: 'NewPassword#999',
    });
    expect(res.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
  });

  it('simulates baseline vs what-if scenario delta cleanly via FinanceSelectors.simulateScenarioForUser', async () => {
    const mockBundle = {
      paycycle: { remainingDays: 10 },
      networth: { liquidAssetsRp: 500000 },
      forecaster: {
        spinjamFreedomDate: 'Mar 2027',
        emergencyFundCompletionDate: 'Beyond 12M',
        pureSurvivalRunwayDays: 10,
        projected12MWealthBaselineRp: 8000000,
        projected12MWealthZeroLeakRp: 10500000,
        series: [
          { month: 12, year: 2026, label: 'Dec 2026', baselineWealthRp: 1500000, disciplinedWealthRp: 2000000, shockWealthRp: 900000, dsrPercent: 42.2, remainingPersonalDebtRp: 1200000 },
          { month: 1, year: 2027, label: 'Jan 2027', baselineWealthRp: 2200000, disciplinedWealthRp: 3100000, shockWealthRp: 1200000, dsrPercent: 35.0, remainingPersonalDebtRp: 500000 },
        ],
      },
      debtopt: { strategies: [] },
      lifeenergy: { trueNetHourlyWageRp: 35000 },
      _forecastInputPeriods: [
        { month: 12, year: 2026, label: 'Dec 2026', totalIncomeRp: 9737425, totalDebtDueRp: 4110341, personalDebtDueRp: 669970, dailyLivingRp: 1500000, routineBillsRp: 300000, coreSavingsP1Rp: 1000000, selfRewardP2Rp: 2827084, dsrPercent: 42.2 },
        { month: 1, year: 2027, label: 'Jan 2027', totalIncomeRp: 5941000, totalDebtDueRp: 3171115, personalDebtDueRp: 919970, dailyLivingRp: 1500000, routineBillsRp: 300000, coreSavingsP1Rp: 734885, selfRewardP2Rp: 0, dsrPercent: 53.4 },
      ],
      _startingLiquidAssetsRp: 500000,
      _startingVaultRp: 272541,
      _emergencyTargetRp: 15000000,
      _baselineDailyBurnRp: 50000,
      _rdpuYieldPct: 0,
      _optContracts: [],
    };
    const goBridge: any = {
      runForecast: jest.fn().mockImplementation(async (req: any) => ({
        spinjamFreedomDate: 'Mar 2027',
        emergencyFundCompletionDate: 'Beyond 12M',
        pureSurvivalRunwayDays: Math.floor(req.startingLiquidAssetsRp / 50000),
        projected6MWealthBaselineRp: 5000000,
        projected12MWealthBaselineRp: req.startingLiquidAssetsRp + req.periods.reduce((s: number, p: any) => s + p.coreSavingsP1Rp, 0),
        projected6MWealthZeroLeakRp: 6000000,
        projected12MWealthZeroLeakRp: 12000000,
        projected12MWealthShockRp: 7000000,
        series: req.periods.map((p: any, idx: number) => ({
          month: p.month,
          year: p.year,
          label: p.label,
          baselineWealthRp: req.startingLiquidAssetsRp + (idx + 1) * p.coreSavingsP1Rp,
          disciplinedWealthRp: req.startingLiquidAssetsRp + (idx + 1) * (p.coreSavingsP1Rp + 200000),
          shockWealthRp: req.startingLiquidAssetsRp + (idx + 1) * Math.max(0, p.coreSavingsP1Rp - 100000),
          dsrPercent: p.dsrPercent,
          remainingPersonalDebtRp: Math.max(0, 1000000 - (idx + 1) * 500000),
        })),
      })),
      optimizeDebtPayoff: jest.fn().mockResolvedValue({ strategies: [{ strategy: 'Avalanche', immediateFreedMonthlyRp: 669970, estimatedInterestSavedRp: 240000, monthsShaved: 2, summary: 'Pay SPinjam first' }] }),
    };

    const selector: any = Object.create(FinanceSelectors.prototype);
    selector.goBridge = goBridge;
    selector.getIntelligenceBundle = jest.fn().mockResolvedValue(mockBundle);

    const result = await selector.simulateScenarioForUser(
      {
        month: 12,
        year: 2026,
        extraMonthlySavingsRp: 500000,
        oneTimeBonusRp: 2000000,
        monthlyLivingDeltaRp: -100000,
        extraDebtPrepaymentRp: 500000,
        variableShockPercent: 10,
      },
      1,
    );

    expect(result.baseline.projected12MWealthRp).toBeGreaterThan(0);
    expect(result.simulated.projected12MWealthRp).toBeGreaterThan(result.baseline.projected12MWealthRp);
    expect(result.net12MDeltaRp).toBe(result.simulated.projected12MWealthRp - result.baseline.projected12MWealthRp);
    expect(result.series.length).toBe(2);
    expect(goBridge.runForecast).toHaveBeenCalledTimes(2);
  });

  it('computes single authoritative disciplineScore in ReportsSelectors without double-counting greenCount in denominator', () => {
    const score = (ReportsSelectors as any).computePeriodDisciplineScore([
      { type: 'GREEN' },
      { type: 'GREEN' },
      { type: 'GREEN' },
      { type: 'GREEN' },
    ]);
    expect(score).toBe(100);
    expect(
      (ReportsSelectors as any).computePeriodDisciplineScore([
        { type: 'GREEN' },
        { type: 'GREEN' },
        { type: 'GREEN' },
        { type: 'RED' },
      ]),
    ).toBe(75);
  });

  it('resolves modular UI-editable instrument cutoffFormula (DAYS_IN_MONTH - 15) and modular payroll attendance/BPJS/DSR config without hardcodes', () => {
    const resolved: any = resolveStudioConfig(1, { studioConfig: {} });
    const spay = resolved.instrumentsTable.find((i: any) => i.type === 'PAYLATER');
    const cc = resolved.instrumentsTable.find((i: any) => i.type === 'CREDIT_CARD');

    expect(spay.cutoffFormula).toBe('DAYS_IN_MONTH - 15');
    expect(spay.cutoffBoundaryInclusive).toBe(true);
    expect(spay.preCutoffOffsetMonths).toBe(0);
    expect(spay.postCutoffOffsetMonths).toBe(1);

    expect(cc.cutoffFormula).toBe('25');
    expect(cc.cutoffBoundaryInclusive).toBe(false);
    expect(cc.preCutoffOffsetMonths).toBe(1);
    expect(cc.postCutoffOffsetMonths).toBe(2);

    const pc: any = resolved.paycycleFormulaConfig;
    expect(pc.attendanceCutoffStartDay).toBe(16);
    expect(pc.attendanceCutoffEndDay).toBe(15);
    expect(pc.bpjsRatePercent).toBe(3);
    expect(pc.optimalDebtRatioPercent).toBe(20);
    expect(pc.maxSafeDebtRatioPercent).toBe(35);
  });

  it('resolves modular event, commitment, and sinking fund category master tables with custom user rows', () => {
    const def: any = resolveStudioConfig(2, { studioConfig: {} });
    expect(Array.isArray(def.eventCategoriesTable)).toBe(true);
    expect(def.eventCategoriesTable.some((c: any) => c.code === 'DAY_OUTING')).toBe(true);
    expect(Array.isArray(def.commitmentCategoriesTable)).toBe(true);
    expect(def.commitmentCategoriesTable.some((c: any) => c.code === 'EVENT_OUTING')).toBe(true);
    expect(Array.isArray(def.sinkingFundCategoriesTable)).toBe(true);
    expect(def.sinkingFundCategoriesTable.some((c: any) => c.code === 'TRAVEL')).toBe(true);

    const custom: any = resolveStudioConfig(2, {
      studioConfig: {
        eventCategoriesTable: [
          {
            id: 'evt_retreat',
            code: 'TEAM_RETREAT',
            label: 'Team Retreat',
            foodPct: 50,
            transportPct: 20,
            activitiesPct: 20,
            contingencyPct: 10,
            weekendWeightPct: 140,
            active: true,
          },
        ],
      },
    });
    expect(custom.eventCategoriesTable).toHaveLength(1);
    expect(custom.eventCategoriesTable[0].code).toBe('TEAM_RETREAT');
  });
});
