import * as fs from 'fs';
import * as path from 'path';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuthMiddleware } from './auth.middleware';
import * as authUtils from './auth.utils';

describe('Enterprise Auth Lifecycle & Session Security (TDD)', () => {
  it('enforces strong password rules (min 10 chars, upper, lower, digit) and generates CSPRNG temporary passwords', () => {
    const validate = (authUtils as any).validatePasswordStrength;
    const generateTemp = (authUtils as any).generateSecureTemporaryPassword;

    expect(typeof validate).toBe('function');
    expect(typeof generateTemp).toBe('function');

    expect(validate('Short1!').valid).toBe(false);
    expect(validate('alllowercase123!').valid).toBe(false);
    expect(validate('ALLUPPERCASE123!').valid).toBe(false);
    expect(validate('NoDigitsPassword!').valid).toBe(false);
    expect(validate('StrongLedger2026!').valid).toBe(true);

    const temp1 = generateTemp();
    const temp2 = generateTemp();
    expect(temp1).not.toBe(temp2);
    expect(temp1.length).toBeGreaterThanOrEqual(12);
    expect(validate(temp1).valid).toBe(true);
  });

  it('prevents user enumeration on forgotPassword, stores only SHA-256 hashed tokens, and pins URL origin to WEB_PUBLIC_URL', async () => {
    const resetTokens: any[] = [];
    const users = [
      {
        id: 4,
        accountName: 'mei',
        username: 'meimeri',
        email: 'meimeri95@gmail.com',
        fullName: 'Mei',
        role: 'STANDARD_MEMBER',
        status: 'ACTIVE',
      },
      {
        id: 2,
        accountName: 'demo',
        username: 'guest',
        email: 'demo@sundayfunday.id',
        fullName: 'General Sandbox (Demo)',
        role: 'DEMO_SANDBOX',
        status: 'ACTIVE',
      },
    ];

    const prismaMock: any = {
      user: {
        findFirst: jest.fn(async ({ where }: any) => {
          const or = where?.OR ?? [];
          for (const cond of or) {
            const val = cond.email?.equals ?? cond.username?.equals;
            const found = users.find(
              (u) => u.email.toLowerCase() === String(val).toLowerCase() || u.username.toLowerCase() === String(val).toLowerCase(),
            );
            if (found) return found;
          }
          return null;
        }),
      },
      passwordResetToken: {
        updateMany: jest.fn(async () => ({ count: 0 })),
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `prt_${resetTokens.length + 1}`, ...data, usedAt: null };
          resetTokens.push(row);
          return row;
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const emailMock: any = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue({ status: 'DRY_RUN_PREVIEW' }),
    };

    const authService = new AuthService(prismaMock, new RateLimiterService(), emailMock);

    const unknownRes = await (authService as any).forgotPassword({ identifier: 'nobody@example.com', locale: 'en' }, '203.0.113.10');
    const demoRes = await (authService as any).forgotPassword({ identifier: 'demo@sundayfunday.id', locale: 'en' }, '203.0.113.10');
    const validRes = await (authService as any).forgotPassword({ identifier: 'meimeri95@gmail.com', locale: 'id' }, '203.0.113.10');

    expect(unknownRes.accepted).toBe(true);
    expect(demoRes.accepted).toBe(true);
    expect(validRes.accepted).toBe(true);
    expect(unknownRes.message).toBe(validRes.message);

    expect(resetTokens).toHaveLength(1);
    expect(resetTokens[0].userId).toBe(4);
    expect(resetTokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(emailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);

    const callArg = emailMock.sendPasswordResetEmail.mock.calls[0][0];
    expect(callArg.resetUrl).toContain('/reset-password?token=');
    expect(callArg.resetUrl).not.toContain('evil-host');
    const rawToken = callArg.resetUrl.split('token=')[1];
    expect(rawToken).toMatch(/^sf_pr_/);
    expect(resetTokens[0].tokenHash).toBe(authUtils.hashOpaqueToken(rawToken));
  });

  it('validates, redeems once, revokes all sessions, increments tokenVersion, and rejects replay on resetPasswordWithToken', async () => {
    let storedUser: any = {
      id: 4,
      accountName: 'mei',
      username: 'meimeri',
      email: 'meimeri95@gmail.com',
      fullName: 'Mei',
      role: 'STANDARD_MEMBER',
      status: 'ACTIVE',
      blueprintType: 'STANDARD_GENERAL',
      passwordHash: authUtils.hashPassword('TempInit2026!'),
      mustChangePassword: true,
      tokenVersion: 1,
    };

    const rawToken = 'sf_pr_' + 'a'.repeat(64);
    let tokenRow: any = {
      id: 'prt_1',
      userId: 4,
      tokenHash: authUtils.hashOpaqueToken(rawToken),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      usedAt: null,
      user: storedUser,
    };
    const revokedFamilies: any[] = [];

    const prismaMock: any = {
      passwordResetToken: {
        findUnique: jest.fn(async ({ where }: any) => (where.tokenHash === tokenRow.tokenHash ? { ...tokenRow, user: storedUser } : null)),
        updateMany: jest.fn(async ({ where, data }: any) => {
          if (where.id === tokenRow.id && where.usedAt === null && tokenRow.usedAt === null) {
            tokenRow = { ...tokenRow, ...data };
            return { count: 1 };
          }
          return { count: 0 };
        }),
      },
      user: {
        update: jest.fn(async ({ data }: any) => {
          if (data.tokenVersion?.increment) {
            storedUser.tokenVersion += data.tokenVersion.increment;
          }
          const { tokenVersion: _tv, ...rest } = data;
          storedUser = { ...storedUser, ...rest };
          return storedUser;
        }),
      },
      refreshToken: {
        updateMany: jest.fn(async (args: any) => {
          revokedFamilies.push(args);
          return { count: 2 };
        }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const emailMock: any = {
      sendPasswordChangedAlert: jest.fn().mockResolvedValue({ status: 'DRY_RUN_PREVIEW' }),
    };

    const authService = new AuthService(prismaMock, new RateLimiterService(), emailMock);

    const check = await (authService as any).validatePasswordResetToken(rawToken);
    expect(check.valid).toBe(true);

    await expect(
      (authService as any).resetPasswordWithToken(
        { token: rawToken, newPassword: 'ValidPass2026!', confirmPassword: 'DifferentPass2026!' },
        '198.51.100.4',
      ),
    ).rejects.toThrow(BadRequestException);

    const resetResult = await (authService as any).resetPasswordWithToken(
      { token: rawToken, newPassword: 'BrandNewStrong2026!', confirmPassword: 'BrandNewStrong2026!' },
      '198.51.100.4',
    );
    expect(resetResult.success).toBe(true);
    expect(storedUser.mustChangePassword).toBe(false);
    expect(storedUser.tokenVersion).toBe(2);
    expect(authUtils.verifyPassword('BrandNewStrong2026!', storedUser.passwordHash)).toBe(true);
    expect(revokedFamilies.length).toBeGreaterThanOrEqual(1);
    expect(emailMock.sendPasswordChangedAlert).toHaveBeenCalledTimes(1);

    await expect(
      (authService as any).resetPasswordWithToken(
        { token: rawToken, newPassword: 'ReplayAttempt2026!', confirmPassword: 'ReplayAttempt2026!' },
        '198.51.100.4',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces forced first-login password rotation (rejecting same temp password, updating hash, clearing mustChangePassword, rotating JWT tv)', async () => {
    let storedUser: any = {
      id: 4,
      accountName: 'mei',
      username: 'meimeri',
      email: 'meimeri95@gmail.com',
      fullName: 'Mei',
      role: 'STANDARD_MEMBER',
      status: 'ACTIVE',
      blueprintType: 'STANDARD_GENERAL',
      passwordHash: authUtils.hashPassword('TempMama2026!'),
      mustChangePassword: true,
      tokenVersion: 0,
    };

    const prismaMock: any = {
      user: {
        findUnique: jest.fn(async () => storedUser),
        update: jest.fn(async ({ data }: any) => {
          if (data.tokenVersion?.increment) {
            storedUser.tokenVersion += data.tokenVersion.increment;
          }
          const { tokenVersion: _tv, ...rest } = data;
          storedUser = { ...storedUser, ...rest };
          return storedUser;
        }),
      },
      refreshToken: {
        create: jest.fn(async ({ data }: any) => ({ id: 'rt_new_1', ...data })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const emailMock: any = {
      sendPasswordChangedAlert: jest.fn().mockResolvedValue({ status: 'DRY_RUN_PREVIEW' }),
    };

    const authService = new AuthService(prismaMock, new RateLimiterService(), emailMock);

    await expect(
      (authService as any).completeFirstLoginPassword(
        4,
        { newPassword: 'TempMama2026!', confirmPassword: 'TempMama2026!' },
        '198.51.100.8',
      ),
    ).rejects.toThrow(BadRequestException);

    const session = await (authService as any).completeFirstLoginPassword(
      4,
      { newPassword: 'MamaPermanent2026!', confirmPassword: 'MamaPermanent2026!' },
      '198.51.100.8',
    );
    expect(storedUser.mustChangePassword).toBe(false);
    expect(storedUser.tokenVersion).toBe(1);
    expect(session.user.mustChangePassword).toBe(false);
    expect(session.accessToken).toBeTruthy();

    const claims = authUtils.verifyToken(session.accessToken) as any;
    expect(claims.tv).toBe(1);
    expect(claims.mcp).toBe(false);
  });

  it('rejects stale tokenVersion JWTs, SUSPENDED accounts, and non-auth routes during mustChangePassword in AuthMiddleware', async () => {
    let activeUser: any = {
      id: 4,
      role: 'STANDARD_MEMBER',
      status: 'ACTIVE',
      mustChangePassword: true,
      tokenVersion: 2,
    };

    const prismaMock: any = {
      user: {
        findUnique: jest.fn(async () => activeUser),
      },
      refreshToken: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sid_1',
          userId: 4,
          revokedAt: null,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      },
    };

    const mw = new AuthMiddleware(prismaMock);
    const makeRes = () => {
      const res: any = { statusCode: 200, body: null };
      res.status = (code: number) => {
        res.statusCode = code;
        return res;
      };
      res.json = (b: any) => {
        res.body = b;
        return res;
      };
      return res;
    };

    // 1. Stale tokenVersion (tv=1 vs user.tokenVersion=2) must be rejected as unauthenticated
    const staleJwt = authUtils.signToken({
      sub: 4,
      sid: 'sid_1',
      email: 'meimeri95@gmail.com',
      role: 'STANDARD_MEMBER',
      blueprintType: 'STANDARD_GENERAL',
      fullName: 'Mei',
      tv: 1,
    } as any);
    const reqStale: any = { headers: { authorization: `Bearer ${staleJwt}` }, originalUrl: '/api/snapshots' };
    const nextStale = jest.fn();
    await mw.use(reqStale, makeRes(), nextStale);
    expect(reqStale.isAuthenticated).toBe(false);
    expect(reqStale.userId).toBeUndefined();

    // 2. mustChangePassword blocks financial endpoint with 403 PASSWORD_CHANGE_REQUIRED
    const validJwt = authUtils.signToken({
      sub: 4,
      sid: 'sid_1',
      email: 'meimeri95@gmail.com',
      role: 'STANDARD_MEMBER',
      blueprintType: 'STANDARD_GENERAL',
      fullName: 'Mei',
      tv: 2,
    } as any);
    const reqBlocked: any = { headers: { authorization: `Bearer ${validJwt}` }, originalUrl: '/api/snapshots', path: '/api/snapshots' };
    const resBlocked = makeRes();
    const nextBlocked = jest.fn();
    await mw.use(reqBlocked, resBlocked, nextBlocked);
    expect(nextBlocked).not.toHaveBeenCalled();
    expect(resBlocked.statusCode).toBe(403);
    expect(resBlocked.body?.errorCode).toBe('PASSWORD_CHANGE_REQUIRED');

    // 3. mustChangePassword allows /api/auth/complete-first-login-password
    const reqAllowed: any = {
      headers: { authorization: `Bearer ${validJwt}` },
      originalUrl: '/api/auth/complete-first-login-password',
      path: '/api/auth/complete-first-login-password',
    };
    const nextAllowed = jest.fn();
    await mw.use(reqAllowed, makeRes(), nextAllowed);
    expect(nextAllowed).toHaveBeenCalledTimes(1);

    // 4. SUSPENDED user returns 403 ACCOUNT_SUSPENDED
    activeUser = { ...activeUser, status: 'SUSPENDED', mustChangePassword: false };
    const reqSusp: any = { headers: { authorization: `Bearer ${validJwt}` }, originalUrl: '/api/auth/me', path: '/api/auth/me' };
    const resSusp = makeRes();
    const nextSusp = jest.fn();
    await mw.use(reqSusp, resSusp, nextSusp);
    expect(nextSusp).not.toHaveBeenCalled();
    expect(resSusp.statusCode).toBe(403);
    expect(resSusp.body?.errorCode).toBe('ACCOUNT_SUSPENDED');
  });

  it('never overwrites existing user passwords on bootstrap and contains zero hardcoded production password literals', async () => {
    const existingOwner = {
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
      passwordHash: authUtils.hashPassword('CustomRotatedOwnerPass#2027!'),
      securityPinHash: authUtils.hashPin('928471'),
    };
    const updateCalls: any[] = [];

    const prismaMock: any = {
      user: {
        findFirst: jest.fn(async ({ where }: any) => {
          if (where?.OR?.some((c: any) => c.id === 1)) return existingOwner;
          return {
            id: 2,
            accountName: 'demo',
            username: 'guest',
            email: 'demo@sundayfunday.id',
            fullName: 'General Sandbox (Demo)',
            role: 'DEMO_SANDBOX',
            blueprintType: 'STANDARD_GENERAL',
            passwordHash: authUtils.hashPassword('DemoCustomPass#2027!'),
          };
        }),
        update: jest.fn(async (args: any) => {
          updateCalls.push(args);
          return existingOwner;
        }),
      },
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      trustedIpAddress: { findFirst: jest.fn().mockResolvedValue({ id: 1 }), create: jest.fn() },
      globalConfig: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      monthlySnapshot: { findFirst: jest.fn().mockResolvedValue({ id: 1 }) },
    };

    const authService = new AuthService(prismaMock, new RateLimiterService());
    await authService.bootstrapDefaultAccounts();

    const updatedPassword = updateCalls.some((c) => c.data?.passwordHash !== undefined);
    expect(updatedPassword).toBe(false);

    const authSrc = fs.readFileSync(path.join(__dirname, 'auth.service.ts'), 'utf8');
    const adminSrc = fs.readFileSync(path.resolve(__dirname, '../admin/admin.service.ts'), 'utf8');
    expect(authSrc).not.toContain('Djakarta2026Nov!@#');
    expect(authSrc).not.toContain('SuperAdmin#2026!');
    expect(authSrc).not.toContain('Sandbox2026!');
    expect(adminSrc).not.toContain('SuperAdmin#2026!');
  });

  it('increments tokenVersion and revokes all RefreshToken rows on logoutAll', async () => {
    const userUpdates: any[] = [];
    const rtUpdates: any[] = [];

    const prismaMock: any = {
      user: {
        update: jest.fn(async (args: any) => {
          userUpdates.push(args);
          return { id: 4, tokenVersion: 2 };
        }),
      },
      refreshToken: {
        updateMany: jest.fn(async (args: any) => {
          rtUpdates.push(args);
          return { count: 1 };
        }),
      },
      biometricChallenge: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
    };

    const authService = new AuthService(prismaMock, new RateLimiterService());
    const out = await authService.logoutAll(4);
    expect(out.success).toBe(true);
    expect(rtUpdates).toHaveLength(1);
    expect(userUpdates.some((u) => u.data?.tokenVersion?.increment === 1)).toBe(true);
  });
});
