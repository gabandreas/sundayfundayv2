import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventsService, getJakartaTodayIso } from './events.service';
import { optimizeTripBudgetTs } from '../calculator/erp-engines';

describe('EventsService & Go/TS Trip Optimizer (TDD RED->GREEN)', () => {
  it('computes 3-tier optimal cap with exact category and daily sum conservation', () => {
    const opt = optimizeTripBudgetTs({
      eventType: 'DAY_OUTING',
      durationDays: 2,
      prepaidCommittedRp: 100000,
      cycleDiscretionaryRp: 2316084,
      cycleEmergencyBufferRp: 250000,
      cycleCoreSavingsRp: 1000000,
      cashRadarLowestPointRp: 900000,
      remainingDaysInCycle: 18,
    });

    expect(opt.conservative.totalCapRp).toBeLessThanOrEqual(opt.balanced.totalCapRp);
    expect(opt.balanced.totalCapRp).toBeLessThanOrEqual(opt.maxSafe.totalCapRp);
    expect(
      opt.balanced.categorySplit.reduce((s, c) => s + c.amountRp, 0),
    ).toBe(opt.balanced.variableSpendCapRp);
    expect(
      opt.balanced.dailyPlan.reduce((s, d) => s + d.recommendedCapRp, 0),
    ).toBe(opt.balanced.variableSpendCapRp);
  });

  it('tracks shared friend advances cleanly and sweeps unused balance to CORE_SAVINGS without touching Daily Operational', async () => {
    const eventRow = {
      id: 41,
      userId: 2,
      month: 12,
      year: 2026,
      title: 'Outing Kantor 5 Des',
      eventType: 'DAY_OUTING',
      startDate: new Date('2026-12-05T00:00:00.000Z'),
      endDate: new Date('2026-12-05T00:00:00.000Z'),
      plannedCapRp: 350000,
      recommendedTier: 'BALANCED',
      fundingSource: 'DISCRETIONARY',
      prepaidAmountRp: 100000,
      status: 'ACTIVE',
      expenses: [
        { id: 1, amountRp: 120000, isSharedAdvance: false, reimbursedAmountRp: 0 },
        { id: 2, amountRp: 100000, isSharedAdvance: true, reimbursedAmountRp: 100000 },
      ],
    };

    const createSavingsMock = jest.fn(async ({ data }: any) => ({ id: 901, ...data }));
    const updateEventMock = jest.fn(async ({ data }: any) => ({ ...eventRow, ...data }));
    const prismaMock: any = {
      tripEventPlan: {
        findUnique: jest.fn().mockResolvedValue(eventRow),
        update: updateEventMock,
      },
      savingsManualTransaction: {
        create: createSavingsMock,
      },
      monthlySnapshot: {
        findFirst: jest.fn().mockResolvedValue({ id: 99, status: 'DRAFT' }),
      },
    };

    const service = new EventsService(
      prismaMock,
      { optimizeTripBudget: jest.fn() } as any,
      { recalculateSnapshot: jest.fn() } as any,
      { record: jest.fn() } as any,
    );

    const swept = await service.closeAndSweep(41, 'CORE_SAVINGS', 2);
    // Personal net spent = 120,000 + (100,000 - 100,000) = 120,000 -> unused = 350,000 - 120,000 = 230,000
    expect(swept.unusedAmountRp).toBe(230000);
    expect(createSavingsMock).toHaveBeenCalledTimes(1);
    expect(createSavingsMock.mock.calls[0][0].data.amount).toBe(230000);
    expect(swept.event.status).toBe('COMPLETED');
  });

  it('rejects cross-tenant access on event expenses and sweeps', async () => {
    const prismaMock: any = {
      tripEventPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 5, userId: 1, expenses: [] }),
      },
    };
    const service = new EventsService(
      prismaMock,
      {} as any,
      {} as any,
      { record: jest.fn() } as any,
    );
    await expect(service.closeAndSweep(5, 'DISCRETIONARY', 2)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects backdated startDate & inverted endDate, differentiates TODAY vs UPCOMING, and resolves target paycycle + modular weights', async () => {
    const todayIso = getJakartaTodayIso();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const nextDecIso = '2026-12-05';

    const createdRows: any[] = [];
    const prismaMock: any = {
      monthlySnapshot: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            month: 11,
            year: 2026,
            status: 'DRAFT',
            selfReward: 250000,
            bufferPocket: 0,
            actualSavings: 6341,
            deficitUncovered: 108633,
            payrollPayoutDate: new Date('2026-10-28T00:00:00.000Z'),
          },
          {
            id: 12,
            month: 12,
            year: 2026,
            status: 'DRAFT',
            selfReward: 2316084,
            bufferPocket: 250000,
            actualSavings: 1000000,
            deficitUncovered: 0,
            payrollPayoutDate: new Date('2026-11-27T00:00:00.000Z'),
          },
          {
            id: 13,
            month: 1,
            year: 2027,
            status: 'DRAFT',
            selfReward: 2000000,
            bufferPocket: 250000,
            actualSavings: 1000000,
            deficitUncovered: 0,
            payrollPayoutDate: new Date('2026-12-28T00:00:00.000Z'),
          },
        ]),
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => ({
          id: where.month,
          month: where.month,
          year: where.year,
          status: 'DRAFT',
          selfReward: where.month === 12 ? 2316084 : 250000,
          bufferPocket: where.month === 12 ? 250000 : 0,
          actualSavings: where.month === 12 ? 1000000 : 6341,
          deficitUncovered: where.month === 12 ? 0 : 108633,
        })),
      },
      tripEventPlan: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: 100 + createdRows.length, ...data };
          createdRows.push(row);
          return row;
        }),
      },
    };

    const optimizeSpy = jest.fn(async (req: any) => optimizeTripBudgetTs(req));
    const financeMock: any = {
      getCashRadarProjection: jest.fn().mockImplementation(async (m: number) => ({
        lowestCashPoint: { balanceRp: m === 12 ? 1800000 : -108633 },
        daysRemaining: m === 12 ? 22 : 2,
      })),
    };
    const configMock: any = {
      getConfig: jest.fn().mockResolvedValue({
        studioConfig: {
          eventCategoriesTable: [
            {
              id: 'evt_custom',
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
      }),
    };

    const service = new EventsService(
      prismaMock,
      { optimizeTripBudget: optimizeSpy } as any,
      { recalculateSnapshot: jest.fn() } as any,
      { record: jest.fn() } as any,
      financeMock,
      configMock,
    );

    await expect(
      service.create(
        {
          month: 11,
          year: 2026,
          title: 'Past Event',
          eventType: 'DAY_OUTING',
          startDate: yesterday,
          endDate: yesterday,
          plannedCapRp: 100000,
        },
        2,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create(
        {
          month: 11,
          year: 2026,
          title: 'Inverted Dates',
          eventType: 'DAY_OUTING',
          startDate: tomorrow,
          endDate: todayIso,
          plannedCapRp: 100000,
        },
        2,
      ),
    ).rejects.toThrow(BadRequestException);

    const todayEv = await service.create(
      {
        month: 11,
        year: 2026,
        title: 'Today Coffee Catchup',
        eventType: 'TEAM_RETREAT',
        startDate: todayIso,
        endDate: todayIso,
        plannedCapRp: 150000,
      },
      2,
    );
    expect(todayEv.status).toBe('ACTIVE');

    const decEv = await service.create(
      {
        month: 11,
        year: 2026,
        title: 'Dec 5 Outing',
        eventType: 'TEAM_RETREAT',
        startDate: nextDecIso,
        endDate: '2026-12-06',
        plannedCapRp: 500000,
      },
      2,
    );
    expect(decEv.status).toBe('PLANNING');
    expect(decEv.month).toBe(12);
    expect(decEv.year).toBe(2026);

    const optRes: any = await service.optimizeForPeriod(
      {
        month: 11,
        year: 2026,
        eventType: 'TEAM_RETREAT',
        durationDays: 2,
        startDateIso: nextDecIso,
        prepaidCommittedRp: 0,
      },
      2,
    );
    expect(optRes.targetMonth).toBe(12);
    expect(optRes.targetYear).toBe(2026);
    expect(optRes.timingMode).toBe('UPCOMING');
    expect(optimizeSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        cycleDiscretionaryRp: 2316084,
        weekendWeightPct: 140,
        customCategoryWeights: expect.arrayContaining([
          expect.objectContaining({ code: 'FOOD_DRINK', pct: 50 }),
        ]),
      }),
    );
  });
});
