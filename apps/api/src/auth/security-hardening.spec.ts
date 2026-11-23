import { UnauthorizedException } from '@nestjs/common';
import { isAllowedCorsOrigin } from '../main';
import { AuthService } from './auth.service';
import { RateLimiterService } from './rate-limiter.service';
import { hashPassword } from './auth.utils';

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
});
