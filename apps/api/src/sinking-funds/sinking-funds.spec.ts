import { ForbiddenException } from '@nestjs/common';
import { SinkingFundsService } from './sinking-funds.service';

describe('SinkingFundsService (TDD RED->GREEN)', () => {
  it('creates an annual sinking fund, computes monthly set-aside, and contributes safely', async () => {
    const row = {
      id: 12,
      userId: 2,
      name: 'Annual Vehicle Tax & Service',
      category: 'ANNUAL_TAX',
      targetAmountRp: 2400000,
      savedAmountRp: 600000,
      targetMonth: 6,
      targetYear: 2027,
      isActive: true,
    };
    const prismaMock: any = {
      sinkingFundItem: {
        create: jest.fn().mockResolvedValue(row),
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...row, ...data })),
      },
    };
    const service = new SinkingFundsService(prismaMock, { record: jest.fn() } as any);

    const created = await service.create(
      {
        name: 'Annual Vehicle Tax & Service',
        category: 'ANNUAL_TAX',
        targetAmountRp: 2400000,
        savedAmountRp: 600000,
        targetMonth: 6,
        targetYear: 2027,
      },
      2,
    );
    expect(created.id).toBe(12);

    const updated = await service.contribute(12, 300000, 2);
    expect(updated.savedAmountRp).toBe(900000);
  });

  it('rejects cross-tenant IDOR updates on SinkingFundItem', async () => {
    const prismaMock: any = {
      sinkingFundItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 1, userId: 1 }),
      },
    };
    const service = new SinkingFundsService(prismaMock, { record: jest.fn() } as any);
    await expect(service.contribute(1, 100000, 2)).rejects.toThrow(ForbiddenException);
  });
});
