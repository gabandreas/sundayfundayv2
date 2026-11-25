import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { CommitmentsService } from './commitments.service';

describe('CommitmentsService (TDD RED->GREEN)', () => {
  it('creates PAYCHECK_UPFRONT non-debt commitment, updates status UNPAID->RESERVED->PAID, and recalculates snapshot without inflating debt', async () => {
    const createdRow = {
      id: 71,
      userId: 2,
      month: 12,
      year: 2026,
      title: 'Penalty Bus Outing 5 Des',
      category: 'FORCE_MAJEURE',
      amount: 100000,
      dueDate: new Date('2026-11-28T00:00:00.000Z'),
      fundingSource: 'PAYCHECK_UPFRONT',
      status: 'UNPAID',
    };
    const prismaMock: any = {
      monthlySnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: 99,
          userId: 2,
          month: 12,
          year: 2026,
          status: 'DRAFT',
        }),
      },
      periodCommitment: {
        create: jest.fn().mockResolvedValue(createdRow),
        findUnique: jest.fn().mockResolvedValue(createdRow),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          ...createdRow,
          ...data,
        })),
      },
    };
    const snapshotsServiceMock: any = {
      recalculateSnapshot: jest.fn().mockResolvedValue({}),
    };
    const auditMock: any = { record: jest.fn() };

    const service = new CommitmentsService(
      prismaMock,
      snapshotsServiceMock,
      auditMock,
    );

    const created = await service.create(
      {
        month: 12,
        year: 2026,
        title: 'Penalty Bus Outing 5 Des',
        category: 'FORCE_MAJEURE',
        amount: 100000,
        dueDate: '2026-11-28',
        fundingSource: 'PAYCHECK_UPFRONT',
      },
      2,
    );
    expect(created.id).toBe(71);
    expect(snapshotsServiceMock.recalculateSnapshot).toHaveBeenCalledWith(99);

    const reserved = await service.setStatus(71, 'RESERVED', 2);
    expect(reserved.status).toBe('RESERVED');

    const paid = await service.setStatus(71, 'PAID', 2);
    expect(paid.status).toBe('PAID');
  });

  it('rejects mutations on LOCKED periods and enforces cross-tenant IDOR isolation', async () => {
    const lockedPrisma: any = {
      monthlySnapshot: {
        findFirst: jest.fn().mockResolvedValue({
          id: 55,
          userId: 2,
          month: 10,
          year: 2026,
          status: 'LOCKED',
        }),
      },
      periodCommitment: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          userId: 1,
          month: 12,
          year: 2026,
        }),
      },
    };
    const service = new CommitmentsService(
      lockedPrisma,
      { recalculateSnapshot: jest.fn() } as any,
      { record: jest.fn() } as any,
    );

    await expect(
      service.create(
        {
          month: 10,
          year: 2026,
          title: 'Backdated Penalty',
          category: 'PENALTY_FEE',
          amount: 50000,
          dueDate: '2026-10-15',
          fundingSource: 'PAYCHECK_UPFRONT',
        },
        2,
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(service.setStatus(1, 'PAID', 2)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
