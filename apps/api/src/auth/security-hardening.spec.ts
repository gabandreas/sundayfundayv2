import { UnauthorizedException } from '@nestjs/common';
import { isAllowedCorsOrigin } from '../main';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PlatformOwnerGuard } from './roles.guard';
import { RateLimiterService } from './rate-limiter.service';
import { hashPassword } from './auth.utils';
import { FinanceController } from '../finance/finance.controller';
import { GUARDS_METADATA } from '@nestjs/common/constants';

describe('Production Security & CORS Hardening', () => {
  it('allows strictly Sunday Funday Vercel origins and localhost while rejecting unrelated .vercel.app origins', () => {
    expect(isAllowedCorsOrigin('https://sundayfunday-erp.vercel.app')).toBe(true);
    expect(isAllowedCorsOrigin('https://sundayfunday-api.vercel.app')).toBe(true);
    expect(isAllowedCorsOrigin('https://sundayfunday-preview123-sundayfunday-org.vercel.app')).toBe(true);
    expect(isAllowedCorsOrigin('http://localhost:3000')).toBe(true);

    expect(isAllowedCorsOrigin('https://evil-attacker.vercel.app')).toBe(false);
    expect(isAllowedCorsOrigin('https://phishing-site.vercel.app')).toBe(false);
    expect(isAllowedCorsOrigin('https://sundayfunday.attacker.com')).toBe(false);
  });

  it('rejects hardcoded legacy literal passwords for User #1 when real passwordHash differs', async () => {
    const newHash = hashPassword('BrandNewSecurePass#2027!');
    const prismaMock: any = {
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 1,
          accountName: 'cheeseburger',
          username: 'cheeseburger',
          email: 'gabandreas22@gmail.com',
          fullName: 'Gabriel',
          role: 'USER',
          status: 'ACTIVE',
          ipWhitelistEnforced: false,
          passwordHash: newHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          accountName: 'cheeseburger',
          username: 'cheeseburger',
          email: 'gabandreas22@gmail.com',
          fullName: 'Gabriel',
          role: 'USER',
          status: 'ACTIVE',
          ipWhitelistEnforced: false,
          passwordHash: newHash,
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      trustedIpAddress: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    };

    const rateLimiter = new RateLimiterService();
    const authService = new AuthService(prismaMock, rateLimiter);

    await expect(
      authService.login({ username: 'cheeseburger', password: 'SundayFunday#2026' } as any, '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      authService.login({ username: 'cheeseburger', password: 'Djakarta2026Nov!@#' } as any, '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      authService.verifyPassword(1, 'SundayFunday#2026', '127.0.0.1'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      authService.changePassword(1, { currentPassword: 'SundayFunday#2026', newPassword: 'AnotherPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);

    const validLogin = await authService.login(
      { username: 'cheeseburger', password: 'BrandNewSecurePass#2027!' } as any,
      '127.0.0.1',
    );
    expect(validLogin.accessToken).toBeTruthy();
  });

  it('persists brute-force lockouts across separate serverless isolates via Postgres AuthRateLimit', async () => {
    const store = new Map<string, any>();
    const prismaMock: any = {
      authRateLimit: {
        findUnique: jest.fn(async ({ where }: any) => store.get(where.key) ?? null),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const next = store.has(where.key) ? { ...store.get(where.key), ...update } : { ...create };
          store.set(where.key, next);
          return next;
        }),
        deleteMany: jest.fn(async ({ where }: any) => {
          store.delete(where.key);
          return { count: 1 };
        }),
      },
    };

    const isolateA = new RateLimiterService(prismaMock);
    const isolateB = new RateLimiterService(prismaMock);

    for (let i = 0; i < 4; i++) {
      await isolateA.recordFailureAsync('victim@sundayfunday.id', '203.0.113.5');
    }

    await expect(
      isolateB.recordFailureAsync('victim@sundayfunday.id', '203.0.113.5'),
    ).rejects.toThrow(/Too many failed login attempts/i);

    await expect(
      isolateB.checkAsync('victim@sundayfunday.id', '203.0.113.5'),
    ).rejects.toThrow(/Too many failed authentication attempts/i);

    await isolateA.recordSuccessAsync('victim@sundayfunday.id', '203.0.113.5');
    await expect(
      isolateB.checkAsync('victim@sundayfunday.id', '203.0.113.5'),
    ).resolves.toBeUndefined();
  });

  it('requires SUPERADMIN PlatformOwnerGuard on POST /api/auth/register to block public self-signup', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.register);
    expect(Array.isArray(guards)).toBe(true);
    expect(guards).toContain(PlatformOwnerGuard);
  });

  it('passes authenticated req userId to stopRecurringSubscription and resumeRecurringSubscription (anti-IDOR)', async () => {
    const creditServiceMock: any = {
      stopRecurringSubscription: jest.fn().mockResolvedValue({ id: 55, isActive: false }),
      resumeRecurringSubscription: jest.fn().mockResolvedValue({ id: 55, isActive: true }),
    };
    const controller = new FinanceController({} as any, {} as any, creditServiceMock);
    const prevEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      await expect(
        controller.stopRecurringSubscription(55, { stopFromMonth: 12, stopFromYear: 2026 } as any, { isAuthenticated: false } as any),
      ).rejects.toThrow(UnauthorizedException);

      await controller.stopRecurringSubscription(
        55,
        { stopFromMonth: 12, stopFromYear: 2026 },
        { isAuthenticated: true, userId: 4 } as any,
      );
      expect(creditServiceMock.stopRecurringSubscription).toHaveBeenCalledWith(55, 12, 2026, 4);

      await controller.resumeRecurringSubscription(55, { isAuthenticated: true, userId: 4 } as any);
      expect(creditServiceMock.resumeRecurringSubscription).toHaveBeenCalledWith(55, 4);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});
