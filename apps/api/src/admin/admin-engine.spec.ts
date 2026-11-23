import { BadRequestException } from '@nestjs/common';
import { AdminService } from './admin.service';
import {
  DEFAULT_STANDARD_ROUTINE_LABELS,
  SUNDAY_FUNDAY_STANDARD_MODULES,
} from '../auth/auth.types';
import { verifyPassword } from '../auth/auth.utils';

describe('Platform Admin Engine (TDD)', () => {
  function buildPrismaMock() {
    let nextUserId = 10;
    const createdUsers: any[] = [];
    const auditLogs: any[] = [];
    const prisma: any = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          const row = { id: nextUserId++, ...data, createdAt: new Date(), updatedAt: new Date() };
          createdUsers.push(row);
          return row;
        }),
        update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
          id: where.id,
          ...data,
        })),
        delete: jest.fn().mockResolvedValue({ id: 4 }),
      },
      globalConfig: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 1, ...data })),
        upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ id: 1, ...create })),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 1 }),
      },
      monthlySnapshot: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 100, ...data })),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      refreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      passwordResetToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: {
        create: jest.fn().mockImplementation(async ({ data }: any) => {
          auditLogs.push(data);
          return { id: auditLogs.length, ...data };
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn(prisma)),
      _createdUsers: createdUsers,
      _auditLogs: auditLogs,
    };
    return prisma;
  }

  it('provisions a standard client with CSPRNG temp password, mustChangePassword=true, US-standard modules, dynamic current month snapshot, welcome email, and audit log', async () => {
    const prisma = buildPrismaMock();
    const emailService: any = {
      sendWelcomeCredentialsEmail: jest.fn().mockResolvedValue({ status: 'SENT' }),
    };

    const service = new AdminService(prisma, emailService);
    const result: any = await service.createClient(
      {
        accountName: 'keluarga',
        username: 'mei',
        fullName: 'Mei Client',
        email: 'mei@example.com',
        initialMonthlyIncome: 8_500_000,
        paydayAnchorDay: 1,
        initializeSnapshot: true,
        sendWelcomeEmail: true,
      } as any,
      1,
    );

    // Auto-generated strong temporary password returned once and stored hashed
    expect(typeof result.temporaryPassword).toBe('string');
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(result.mustChangePassword).toBe(true);
    expect(result.welcomeEmailSent).toBe(true);

    const createdUserCall = prisma.user.create.mock.calls[0][0].data;
    expect(createdUserCall.mustChangePassword).toBe(true);
    expect(verifyPassword(result.temporaryPassword, createdUserCall.passwordHash)).toBe(true);

    const createdConfig = prisma.globalConfig.create.mock.calls[0][0].data;
    expect(createdConfig.baseSalary).toBe(8_500_000);
    expect(createdConfig.payrollPayoutDay).toBe(1);
    expect(createdConfig.creditLimit).toBe(0);
    expect(createdConfig.enabledModulesJson).toEqual(SUNDAY_FUNDAY_STANDARD_MODULES);
    expect(createdConfig.customRoutineLabelsJson).toEqual(DEFAULT_STANDARD_ROUTINE_LABELS);

    // Must NOT hardcode month: 10, year: 2026
    const createdSnap = prisma.monthlySnapshot.create.mock.calls[0][0].data;
    expect(createdSnap.finalTotalIncome).toBe(8_500_000);
    expect(createdSnap.netSalaryIncome).toBe(8_500_000);
    expect(`${createdSnap.month}/${createdSnap.year}`).not.toBe('10/2026');

    expect(emailService.sendWelcomeCredentialsEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'mei@example.com',
        username: 'mei',
        temporaryPassword: result.temporaryPassword,
      }),
    );

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_CREATE_CLIENT',
        }),
      }),
    );
  });

  it('rejects weak manually provided temporary passwords when creating a client', async () => {
    const prisma = buildPrismaMock();
    const service = new AdminService(prisma);

    await expect(
      service.createClient(
        {
          accountName: 'keluarga',
          username: 'weakuser',
          fullName: 'Weak User',
          email: 'weak@example.com',
          password: '123',
        } as any,
        1,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('resets a client password with temp password, mustChangePassword=true, increments tokenVersion, and revokes sessions + reset tokens', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      accountName: 'mei',
      username: 'meimeri',
      email: 'meimeri95@gmail.com',
      fullName: 'Mei',
      role: 'STANDARD_MEMBER',
      status: 'ACTIVE',
      tokenVersion: 2,
    });

    const service = new AdminService(prisma);
    const res: any = await (service as any).resetClientPassword(4, {}, 1);

    expect(typeof res.temporaryPassword).toBe('string');
    expect(res.temporaryPassword.length).toBeGreaterThanOrEqual(12);
    expect(res.mustChangePassword).toBe(true);

    const updateArgs = prisma.user.update.mock.calls[0][0].data;
    expect(updateArgs.mustChangePassword).toBe(true);
    expect(updateArgs.tokenVersion).toEqual({ increment: 1 });
    expect(verifyPassword(res.temporaryPassword, updateArgs.passwordHash)).toBe(true);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.passwordResetToken.updateMany).toHaveBeenCalled();
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'ADMIN_RESET_PASSWORD',
        }),
      }),
    );
  });

  it('revokes all active sessions for a user and increments tokenVersion', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: 'meimeri',
      role: 'STANDARD_MEMBER',
    });
    const service = new AdminService(prisma);

    const res: any = await (service as any).revokeUserSessions(4, 1);
    expect(res.success).toBe(true);
    expect(res.revokedCount).toBe(2);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
  });

  it('suspending a client immediately revokes sessions and rejects suspending or deleting SUPERADMIN / Sandbox / User #1', async () => {
    const prisma = buildPrismaMock();
    prisma.user.findUnique.mockImplementation(async ({ where }: any) => {
      if (where.id === 1) return { id: 1, role: 'SUPERADMIN', username: 'cheeseburger' };
      if (where.id === 2) return { id: 2, role: 'USER', username: 'sandbox' };
      if (where.id === 4) return { id: 4, role: 'STANDARD_MEMBER', username: 'meimeri' };
      return null;
    });

    const service = new AdminService(prisma);

    // Suspending #4 revokes tokens & increments tokenVersion
    await service.updateClient(4, { status: 'SUSPENDED' } as any, 1);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: expect.objectContaining({
          status: 'SUSPENDED',
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();

    // Rejects suspending SUPERADMIN
    await expect(
      service.updateClient(1, { status: 'SUSPENDED' } as any, 1),
    ).rejects.toThrow(BadRequestException);

    // Blocks deleting User #1, Sandbox #2, or SUPERADMIN
    await expect((service as any).deleteClient(1, 1)).rejects.toThrow(BadRequestException);
    await expect((service as any).deleteClient(2, 1)).rejects.toThrow(BadRequestException);

    // Allows safely deleting client #4
    const deleted = await (service as any).deleteClient(4, 1);
    expect(deleted.success).toBe(true);
    expect(deleted.deletedUserId).toBe(4);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 4 } });
  });
});
