import { SavingsInstrumentType } from '@prisma/client';
import { SavingsService } from './savings.service';

describe('SavingsService — Idempotent confirmPeriodDeposit & LIQUID_CASH Default (TDD)', () => {
  it('returns alreadyConfirmed: true without creating a duplicate row when the period deposit already exists', async () => {
    const existingRow = {
      id: 142,
      userId: 1,
      label: 'P1 Savings Transfer (11/2026)',
      amount: 6341,
      instrumentType: SavingsInstrumentType.LIQUID_CASH,
      date: new Date('2026-11-23T23:15:50.000Z'),
    };
    const createMock = jest.fn();
    const prismaMock: any = {
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({ userId: 1, formulaParamsJson: null }),
      },
      savingsManualTransaction: {
        findMany: jest.fn().mockResolvedValue([existingRow]),
        create: createMock,
      },
    };
    const auditMock: any = { record: jest.fn() };
    const service = new SavingsService(prismaMock, auditMock);

    const res: any = await service.confirmPeriodDeposit(
      { month: 11, year: 2026, amount: 6341 },
      1,
    );

    expect(createMock).not.toHaveBeenCalled();
    expect(res.alreadyConfirmed).toBe(true);
    expect(res.confirmedAmount).toBe(6341);
    expect(res.transaction.id).toBe(142);
  });

  it('defaults instrumentType to LIQUID_CASH when omitted or when external asset portfolio is disabled', async () => {
    const createMock = jest.fn(async ({ data }: any) => ({ id: 201, ...data }));
    const prismaMock: any = {
      globalConfig: {
        findFirst: jest.fn().mockResolvedValue({
          userId: 1,
          formulaParamsJson: { studioConfig: { enableExternalAssetPortfolio: false } },
        }),
      },
      savingsManualTransaction: {
        findMany: jest.fn().mockResolvedValue([]),
        create: createMock,
      },
    };
    const auditMock: any = { record: jest.fn() };
    const service = new SavingsService(prismaMock, auditMock);

    const res: any = await service.confirmPeriodDeposit(
      { month: 12, year: 2026, amount: 1000000 },
      1,
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0][0].data.instrumentType).toBe(
      SavingsInstrumentType.LIQUID_CASH,
    );
    expect(res.alreadyConfirmed).toBe(false);
    expect(res.confirmedAmount).toBe(1000000);
    expect(res.transaction.id).toBe(201);
  });
});
