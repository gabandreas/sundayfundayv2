import { ForbiddenException } from '@nestjs/common';
import { EventsService } from './events.service';
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
});
