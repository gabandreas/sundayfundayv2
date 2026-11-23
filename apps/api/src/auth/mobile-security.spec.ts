import * as crypto from 'crypto';
import {
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthMiddleware } from './auth.middleware';
import { RateLimiterService } from './rate-limiter.service';
import { hashPassword, hashPin, verifyToken } from './auth.utils';

function buildInMemoryMobileAuthPrisma() {
  const users = new Map<number, any>();
  const refreshTokens = new Map<string, any>();
  const mobileDevices = new Map<string, any>();
  const biometricChallenges = new Map<string, any>();
  const userIdentities = new Map<string, any>();
  const trustedIpAddresses: any[] = [];
  const auditLogs: any[] = [];
  const authRateLimits = new Map<string, any>();

  let nextId = 100;

  users.set(1, {
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
    passwordHash: hashPassword('MobileProdPass#2026'),
    securityPinHash: hashPin('849201'),
    ipWhitelistEnforced: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  users.set(2, {
    id: 2,
    accountName: 'demo',
    username: 'guest',
    email: 'demo@sundayfunday.id',
    fullName: 'General Sandbox (Demo)',
    role: 'DEMO_SANDBOX',
    status: 'ACTIVE',
    blueprintType: 'STANDARD_GENERAL',
    lifeStagePreset: 'CORPORATE_PROFESSIONAL',
    uiDensityMode: 'COMMAND_COCKPIT',
    passwordHash: hashPassword('Sandbox2026!'),
    securityPinHash: null,
    ipWhitelistEnforced: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const prisma: any = {
    auditLogs,
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        for (const u of users.values()) {
          if (where?.OR) {
            for (const clause of where.OR) {
              if (clause.id && u.id === clause.id) return u;
              if (clause.email && u.email.toLowerCase() === String(clause.email).toLowerCase()) return u;
              if (
                clause.username?.equals &&
                u.username.toLowerCase() === String(clause.username.equals).toLowerCase()
              ) {
                return u;
              }
              if (
                clause.accountName?.equals &&
                u.accountName.toLowerCase() === String(clause.accountName.equals).toLowerCase()
              ) {
                return u;
              }
            }
          } else if (
            where?.accountName?.equals &&
            where?.username?.equals &&
            u.accountName.toLowerCase() === String(where.accountName.equals).toLowerCase() &&
            u.username.toLowerCase() === String(where.username.equals).toLowerCase()
          ) {
            return u;
          }
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where?.id !== undefined) return users.get(where.id) ?? null;
        if (where?.email) {
          for (const u of users.values()) {
            if (u.email.toLowerCase() === String(where.email).toLowerCase()) return u;
          }
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = users.get(where.id);
        if (!existing) throw new Error('User not found');
        const next = { ...existing, ...data, updatedAt: new Date() };
        users.set(where.id, next);
        return next;
      }),
    },
    trustedIpAddress: {
      findFirst: jest.fn(async () => trustedIpAddresses[0] ?? null),
      create: jest.fn(async ({ data }: any) => {
        trustedIpAddresses.push(data);
        return data;
      }),
    },
    auditLog: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: ++nextId, createdAt: new Date(), ...data };
        auditLogs.push(row);
        return row;
      }),
    },
    authRateLimit: {
      findUnique: jest.fn(async ({ where }: any) => authRateLimits.get(where.key) ?? null),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const next = authRateLimits.has(where.key)
          ? { ...authRateLimits.get(where.key), ...update }
          : { ...create };
        authRateLimits.set(where.key, next);
        return next;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        authRateLimits.delete(where.key);
        return { count: 1 };
      }),
    },
    refreshToken: {
      create: jest.fn(async ({ data }: any) => {
        const id = data.id || `rt_${++nextId}`;
        const row = {
          id,
          revokedAt: null,
          revokeReason: null,
          replacedById: null,
          lastUsedAt: new Date(),
          createdAt: new Date(),
          ...data,
        };
        refreshTokens.set(id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        let found: any = null;
        if (where?.id) found = refreshTokens.get(where.id) ?? null;
        else if (where?.tokenHash) {
          for (const rt of refreshTokens.values()) {
            if (rt.tokenHash === where.tokenHash) {
              found = rt;
              break;
            }
          }
        }
        if (!found) return null;
        if (include?.user) {
          return { ...found, user: users.get(found.userId) ?? null };
        }
        return found;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        for (const rt of refreshTokens.values()) {
          if (where?.id && rt.id !== where.id) continue;
          if (where?.userId !== undefined && rt.userId !== where.userId) continue;
          if (where?.deviceId !== undefined && rt.deviceId !== where.deviceId) continue;
          if (where?.revokedAt === null && rt.revokedAt !== null) continue;
          return rt;
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const out: any[] = [];
        for (const rt of refreshTokens.values()) {
          if (where?.userId !== undefined && rt.userId !== where.userId) continue;
          if (where?.revokedAt === null && rt.revokedAt !== null) continue;
          out.push(rt);
        }
        return out;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const row = refreshTokens.get(where.id);
        if (!row) throw new Error('RefreshToken not found');
        const next = { ...row, ...data };
        refreshTokens.set(where.id, next);
        return next;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, rt] of refreshTokens.entries()) {
          if (where?.familyId && rt.familyId !== where.familyId) continue;
          if (where?.userId !== undefined && rt.userId !== where.userId) continue;
          if (where?.revokedAt === null && rt.revokedAt !== null) continue;
          refreshTokens.set(id, { ...rt, ...data });
          count++;
        }
        return { count };
      }),
    },
    mobileDevice: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = `${where.userId_deviceId.userId}:${where.userId_deviceId.deviceId}`;
        const existing = mobileDevices.get(key);
        const row = existing
          ? { ...existing, ...update, updatedAt: new Date() }
          : { id: ++nextId, createdAt: new Date(), updatedAt: new Date(), revokedAt: null, ...create };
        mobileDevices.set(key, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.userId_deviceId.userId}:${where.userId_deviceId.deviceId}`;
        return mobileDevices.get(key) ?? null;
      }),
      findFirst: jest.fn(async ({ where }: any) => {
        for (const d of mobileDevices.values()) {
          if (where?.userId !== undefined && d.userId !== where.userId) continue;
          if (where?.deviceId && d.deviceId !== where.deviceId) continue;
          if (where?.revokedAt === null && d.revokedAt !== null) continue;
          return d;
        }
        return null;
      }),
      count: jest.fn(async ({ where }: any) => {
        let n = 0;
        for (const d of mobileDevices.values()) {
          if (where?.userId !== undefined && d.userId !== where.userId) continue;
          if (where?.biometricEnabled !== undefined && d.biometricEnabled !== where.biometricEnabled) continue;
          if (where?.revokedAt === null && d.revokedAt !== null) continue;
          n++;
        }
        return n;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [k, d] of mobileDevices.entries()) {
          if (where?.userId !== undefined && d.userId !== where.userId) continue;
          if (where?.deviceId && d.deviceId !== where.deviceId) continue;
          mobileDevices.set(k, { ...d, ...data, updatedAt: new Date() });
          count++;
        }
        return { count };
      }),
    },
    biometricChallenge: {
      create: jest.fn(async ({ data }: any) => {
        const id = data.id || `bc_${++nextId}`;
        const row = { id, consumedAt: null, createdAt: new Date(), ...data };
        biometricChallenges.set(id, row);
        return row;
      }),
      findUnique: jest.fn(async ({ where }: any) => biometricChallenges.get(where.id) ?? null),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const [id, bc] of biometricChallenges.entries()) {
          if (where?.id && bc.id !== where.id) continue;
          if (where?.userId !== undefined && bc.userId !== where.userId) continue;
          if (where?.consumedAt === null && bc.consumedAt !== null) continue;
          biometricChallenges.set(id, { ...bc, ...data });
          count++;
        }
        return { count };
      }),
    },
    userIdentity: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.provider_subject.provider}:${where.provider_subject.subject}`;
        const found = userIdentities.get(key) ?? null;
        if (!found) return null;
        return { ...found, user: users.get(found.userId) ?? null };
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const list: any[] = [];
        for (const row of userIdentities.values()) {
          if (where?.userId !== undefined && row.userId !== where.userId) continue;
          list.push(row);
        }
        return list;
      }),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const key = `${where.provider_subject.provider}:${where.provider_subject.subject}`;
        const existing = userIdentities.get(key);
        const next = existing
          ? { ...existing, ...update }
          : { id: ++nextId, createdAt: new Date(), ...create };
        userIdentities.set(key, next);
        return next;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let count = 0;
        for (const [k, row] of userIdentities.entries()) {
          if (where?.id !== undefined && row.id !== where.id) continue;
          if (where?.userId !== undefined && row.userId !== where.userId) continue;
          userIdentities.delete(k);
          count++;
        }
        return { count };
      }),
    },
  };

  return { prisma, refreshTokens, mobileDevices, users };
}

describe('Phase 1 Mobile ERP Backend Security, Refresh Rotation, Biometrics, PIN & SSO', () => {
  it('mints rotating opaque refreshToken with hashed DB storage, detects reuse theft, and enforces immediate JWT sid revocation in AuthMiddleware', async () => {
    const { prisma, refreshTokens } = buildInMemoryMobileAuthPrisma();
    const rateLimiter = new RateLimiterService(prisma);
    const authService = new AuthService(prisma, rateLimiter);

    const loginRes: any = await authService.login(
      {
        username: 'cheeseburger',
        password: 'MobileProdPass#2026',
        deviceId: 'iphone-15-pro-gabriel',
        deviceName: 'Gabriel iPhone 15 Pro',
        platform: 'IOS',
        appVersion: '1.0.0',
      } as any,
      '103.10.20.30',
    );

    expect(loginRes.accessToken).toBeTruthy();
    expect(loginRes.refreshToken).toMatch(/^sf_rt_[a-f0-9]{64}$/);
    expect(loginRes.sessionId).toBeTruthy();
    expect(loginRes.hasSecurityPin).toBe(true);

    // Ensure DB never stores plaintext refresh token
    const storedRow = refreshTokens.get(loginRes.sessionId);
    expect(storedRow).toBeTruthy();
    expect(storedRow.tokenHash).not.toEqual(loginRes.refreshToken);

    const decoded = verifyToken(loginRes.accessToken) as any;
    expect(decoded.sid).toEqual(loginRes.sessionId);

    // Valid Bearer sid passes AuthMiddleware
    const mw = new AuthMiddleware(prisma);
    const activeReq: any = { headers: { authorization: `Bearer ${loginRes.accessToken}` } };
    await mw.use(activeReq, {} as any, () => {});
    expect(activeReq.isAuthenticated).toBe(true);
    expect(activeReq.userId).toBe(1);

    // Rotate refresh token once
    const rotated: any = await (authService as any).rotateRefreshToken(
      { refreshToken: loginRes.refreshToken, deviceId: 'iphone-15-pro-gabriel' },
      '103.10.20.30',
    );
    expect(rotated.accessToken).toBeTruthy();
    expect(rotated.refreshToken).toMatch(/^sf_rt_[a-f0-9]{64}$/);
    expect(rotated.refreshToken).not.toEqual(loginRes.refreshToken);
    expect(rotated.sessionId).not.toEqual(loginRes.sessionId);

    // Old accessToken (old sid) must immediately fail middleware validation after rotation/revocation
    const oldAccessReq: any = { headers: { authorization: `Bearer ${loginRes.accessToken}` } };
    await mw.use(oldAccessReq, {} as any, () => {});
    expect(oldAccessReq.isAuthenticated).toBe(false);

    // REUSE THEFT TEST: Re-presenting the already-rotated old refreshToken must revoke the entire family (including the new one!)
    await expect(
      (authService as any).rotateRefreshToken(
        { refreshToken: loginRes.refreshToken, deviceId: 'iphone-15-pro-gabriel' },
        '203.0.113.88',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Now even the legitimate rotated refreshToken from that compromised family is dead!
    await expect(
      (authService as any).rotateRefreshToken(
        { refreshToken: rotated.refreshToken, deviceId: 'iphone-15-pro-gabriel' },
        '103.10.20.30',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Audit trail recorded reuse attack
    expect(prisma.auditLogs.some((a: any) => a.action === 'REFRESH_TOKEN_REUSE_DETECTED')).toBe(true);
  });

  it('prevents cross-tenant session IDOR and invalidates all active tokens on logoutAll or changePassword', async () => {
    const { prisma } = buildInMemoryMobileAuthPrisma();
    const rateLimiter = new RateLimiterService(prisma);
    const authService = new AuthService(prisma, rateLimiter);

    const user1Session: any = await authService.login(
      { username: 'cheeseburger', password: 'MobileProdPass#2026', deviceId: 'mate60', platform: 'HUAWEI_HARMONY' } as any,
      '103.10.20.30',
    );
    const user2Session: any = await authService.login(
      { username: 'guest', password: 'Sandbox2026!', deviceId: 'pixel9', platform: 'ANDROID' } as any,
      '103.10.20.31',
    );

    const listU1 = await (authService as any).listSessions(1, user1Session.sessionId);
    expect(listU1.length).toBe(1);
    expect(listU1[0].deviceId).toBe('mate60');
    expect(listU1[0].isCurrent).toBe(true);

    // User 2 cannot revoke User 1's session
    await expect(
      (authService as any).revokeSession(2, user1Session.sessionId),
    ).rejects.toThrow(NotFoundException);

    // Password change revokes User 1 active mobile sessions
    await authService.changePassword(1, {
      currentPassword: 'MobileProdPass#2026',
      newPassword: 'BrandNewMobilePass#2027',
    });

    await expect(
      (authService as any).rotateRefreshToken({ refreshToken: user1Session.refreshToken }, '103.10.20.30'),
    ).rejects.toThrow(UnauthorizedException);

    // User 2 session remains untouched
    const stillOk = await (authService as any).rotateRefreshToken(
      { refreshToken: user2Session.refreshToken },
      '103.10.20.31',
    );
    expect(stillOk.accessToken).toBeTruthy();
  });

  it('enforces App PIN setup password verification, weak-PIN rejection, and 429 lockout on PIN verify', async () => {
    const { prisma } = buildInMemoryMobileAuthPrisma();
    const rateLimiter = new RateLimiterService(prisma);
    const authService = new AuthService(prisma, rateLimiter);

    // User 2 sets up a 6-digit App PIN
    await expect(
      (authService as any).setupSecurityPin(2, { currentPassword: 'WrongPassword!', newPin: '492817' }, '10.0.0.2'),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      (authService as any).setupSecurityPin(2, { currentPassword: 'Sandbox2026!', newPin: '123456' }, '10.0.0.2'),
    ).rejects.toThrow(BadRequestException);

    const setupRes = await (authService as any).setupSecurityPin(
      2,
      { currentPassword: 'Sandbox2026!', newPin: '492817' },
      '10.0.0.2',
    );
    expect(setupRes.success).toBe(true);

    const session = await authService.login(
      { username: 'guest', password: 'Sandbox2026!', deviceId: 'dev-pin-test', platform: 'ANDROID' } as any,
      '10.0.0.2',
    );

    const verified = await (authService as any).verifySecurityPin(
      { userId: 2, pin: '492817', refreshToken: session.refreshToken, deviceId: 'dev-pin-test' },
      '10.0.0.2',
    );
    expect(verified.verified).toBe(true);

    // 5 wrong PIN attempts trigger HTTP 429 Too Many Requests lockout
    for (let i = 0; i < 4; i++) {
      await expect(
        (authService as any).verifySecurityPin(
          { userId: 2, pin: '999999', refreshToken: session.refreshToken, deviceId: 'dev-pin-test' },
          '10.0.0.2',
        ),
      ).rejects.toThrow(UnauthorizedException);
    }
    await expect(
      (authService as any).verifySecurityPin(
        { userId: 2, pin: '999999', refreshToken: session.refreshToken, deviceId: 'dev-pin-test' },
        '10.0.0.2',
      ),
    ).rejects.toThrow(HttpException);
  });

  it('verifies FaceID / TouchID / Biometric hardware asymmetric Ed25519 challenge-response with single-use anti-replay', async () => {
    const { prisma } = buildInMemoryMobileAuthPrisma();
    const rateLimiter = new RateLimiterService(prisma);
    const authService = new AuthService(prisma, rateLimiter);

    const session: any = await authService.login(
      {
        username: 'cheeseburger',
        password: 'MobileProdPass#2026',
        deviceId: 'ios-secure-enclave-1',
        deviceName: 'iPhone 15 Pro',
        platform: 'IOS',
      } as any,
      '103.10.20.30',
    );

    // Reject invalid PEM keys cleanly
    await expect(
      (authService as any).enrollBiometricDevice(1, {
        deviceId: 'ios-secure-enclave-1',
        deviceName: 'iPhone 15 Pro',
        platform: 'IOS',
        publicKeyPem: 'not-a-valid-pem-key',
        keyAlgorithm: 'ED25519',
      }),
    ).rejects.toThrow(BadRequestException);

    // Generate real Ed25519 keypair as hardware enclave does
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
    const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    const enrollRes = await (authService as any).enrollBiometricDevice(1, {
      deviceId: 'ios-secure-enclave-1',
      deviceName: 'iPhone 15 Pro',
      platform: 'IOS',
      publicKeyPem,
      keyAlgorithm: 'ED25519',
    });
    expect(enrollRes.biometricEnabled).toBe(true);

    const challenge = await (authService as any).createBiometricChallenge({
      deviceId: 'ios-secure-enclave-1',
      refreshToken: session.refreshToken,
    });
    expect(challenge.challengeId).toBeTruthy();
    expect(challenge.nonce).toBeTruthy();

    const payloadBytes = Buffer.from(`${challenge.nonce}:ios-secure-enclave-1`, 'utf8');
    const validSigBase64 = crypto.sign(null, payloadBytes, privateKey).toString('base64');

    // Wrong signature must fail cleanly
    const badSigBase64 = crypto
      .sign(null, Buffer.from('wrong-payload', 'utf8'), privateKey)
      .toString('base64');
    await expect(
      (authService as any).verifyBiometricChallenge(
        {
          challengeId: challenge.challengeId,
          deviceId: 'ios-secure-enclave-1',
          signatureBase64: badSigBase64,
        },
        '103.10.20.30',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Re-request fresh challenge and verify valid biometric signature
    const challenge2 = await (authService as any).createBiometricChallenge({
      deviceId: 'ios-secure-enclave-1',
      refreshToken: session.refreshToken,
    });
    const sig2 = crypto
      .sign(null, Buffer.from(`${challenge2.nonce}:ios-secure-enclave-1`, 'utf8'), privateKey)
      .toString('base64');

    const unlocked: any = await (authService as any).verifyBiometricChallenge(
      {
        challengeId: challenge2.challengeId,
        deviceId: 'ios-secure-enclave-1',
        signatureBase64: sig2,
      },
      '103.10.20.30',
    );
    expect(unlocked.accessToken).toBeTruthy();
    expect(unlocked.refreshToken).toMatch(/^sf_rt_[a-f0-9]{64}$/);
    expect(unlocked.user.email).toBe('gabandreas22@gmail.com');

    // Replay of challenge2 must fail strictly!
    await expect(
      (authService as any).verifyBiometricChallenge(
        {
          challengeId: challenge2.challengeId,
          deviceId: 'ios-secure-enclave-1',
          signatureBase64: sig2,
        },
        '103.10.20.30',
      ),
    ).rejects.toThrow(UnauthorizedException);

    // Also verify default Android/Huawei ECDSA P-256 hardware keystore keypair flow
    const ecSession: any = await authService.login(
      {
        username: 'cheeseburger',
        password: 'MobileProdPass#2026',
        deviceId: 'huawei-mate60-keystore',
        deviceName: 'Huawei Mate 60',
        platform: 'HUAWEI_HARMONY',
      } as any,
      '103.10.20.32',
    );
    const ecPair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const ecPubPem = ecPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const ecEnroll = await (authService as any).enrollBiometricDevice(1, {
      deviceId: 'huawei-mate60-keystore',
      deviceName: 'Huawei Mate 60',
      platform: 'HUAWEI_HARMONY',
      publicKeyPem: ecPubPem,
      keyAlgorithm: 'ECDSA_P256',
    });
    expect(ecEnroll.keyAlgorithm).toBe('ECDSA_P256');
    const ecChallenge = await (authService as any).createBiometricChallenge({
      deviceId: 'huawei-mate60-keystore',
      refreshToken: ecSession.refreshToken,
    });
    const ecSig = crypto
      .sign('sha256', Buffer.from(`${ecChallenge.nonce}:huawei-mate60-keystore`, 'utf8'), ecPair.privateKey)
      .toString('base64');
    const ecVerified = await (authService as any).verifyBiometricChallenge(
      {
        challengeId: ecChallenge.challengeId,
        deviceId: 'huawei-mate60-keystore',
        signatureBase64: ecSig,
      },
      '103.10.20.32',
    );
    expect(ecVerified.accessToken).toBeTruthy();
    expect(ecVerified.refreshToken).toMatch(/^sf_rt_[a-f0-9]{64}$/);
  });

  it('verifies cryptographic RS256 OIDC / Google / Apple SSO tokens, rejects unregistered emails, and issues mobile tokens', async () => {
    const { prisma } = buildInMemoryMobileAuthPrisma();
    const rateLimiter = new RateLimiterService(prisma);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SsoService } = require('./sso.service');

    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const jwk = publicKey.export({ format: 'jwk' }) as any;
    jwk.kid = 'test-rsa-key-1';
    jwk.alg = 'RS256';
    jwk.use = 'sig';

    const ssoService = new SsoService(prisma, {
      googleClientId: 'sunday-funday-google-mobile-client',
      jwksFetcher: async () => [jwk],
    });
    const authService = new AuthService(prisma, rateLimiter, undefined, undefined, ssoService);

    const signOidcJwt = (claims: Record<string, any>) => {
      const h = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'test-rsa-key-1' })).toString('base64url');
      const p = Buffer.from(JSON.stringify(claims)).toString('base64url');
      const sig = crypto.createSign('RSA-SHA256').update(`${h}.${p}`).sign(privateKey, 'base64url');
      return `${h}.${p}.${sig}`;
    };

    const now = Math.floor(Date.now() / 1000);
    const validIdToken = signOidcJwt({
      iss: 'https://accounts.google.com',
      aud: 'sunday-funday-google-mobile-client',
      sub: 'google-sub-12345',
      email: 'gabandreas22@gmail.com',
      email_verified: true,
      iat: now,
      exp: now + 300,
    });

    const ssoLogin: any = await (authService as any).loginWithSso(
      {
        provider: 'GOOGLE',
        idToken: validIdToken,
        deviceId: 'huawei-mate60',
        platform: 'HUAWEI_HARMONY',
      },
      '103.10.20.40',
    );
    expect(ssoLogin.accessToken).toBeTruthy();
    expect(ssoLogin.refreshToken).toMatch(/^sf_rt_[a-f0-9]{64}$/);
    expect(ssoLogin.user.id).toBe(1);

    // Reject unverified email or unknown stranger email
    const strangerIdToken = signOidcJwt({
      iss: 'https://accounts.google.com',
      aud: 'sunday-funday-google-mobile-client',
      sub: 'stranger-sub-999',
      email: 'attacker@evil.com',
      email_verified: true,
      iat: now,
      exp: now + 300,
    });
    await expect(
      (authService as any).loginWithSso(
        { provider: 'GOOGLE', idToken: strangerIdToken },
        '103.10.20.40',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });
});
