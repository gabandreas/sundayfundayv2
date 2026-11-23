import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import * as crypto from 'node:crypto';

const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const isLiveFlag = process.argv.includes('--live');
const externalBaseUrl =
  urlArg ||
  process.env.MOBILE_E2E_BASE_URL ||
  (isLiveFlag ? 'https://sundayfunday-api.vercel.app' : '');

if (!externalBaseUrl) {
  process.env.NODE_ENV = 'production';
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
    process.env.DATABASE_URL =
      'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';
  }
}

async function runMobileE2E() {
  let app: any = null;
  let baseUrl = '';

  if (externalBaseUrl) {
    baseUrl = externalBaseUrl.replace(/\/$/, '');
    console.log(`Target: LIVE REMOTE (${baseUrl})\n`);
  } else {
    const { NestFactory } = await import('@nestjs/core');
    const { AppModule } = await import('../apps/api/dist/src/app.module');
    const { applySecurityMiddleware } = await import('../apps/api/dist/src/main');
    app = await NestFactory.create(AppModule, { logger: ['error'] });
    applySecurityMiddleware(app);
    await app.listen(0, '127.0.0.1');
    const addr = app.getHttpServer().address();
    const port = typeof addr === 'object' && addr ? addr.port : 3098;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Target: LOCAL IN-PROCESS (${baseUrl})\n`);
  }

  let passed = 0;
  async function testCase(name: string, fn: () => Promise<void>) {
    await fn();
    passed++;
    console.log(`[PASS] ${name}`);
  }

  let sandboxAccessToken = '';
  let sandboxRefreshToken = '';
  let sandboxSessionId = '';
  const deviceId = `e2e-mobile-${Date.now()}`;

  try {
    await testCase('1. Mobile login issues opaque refreshToken, JWT sid, and strict security headers', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: 'demo',
          username: 'guest',
          password: 'Sandbox2026!',
          deviceId,
          deviceName: 'Huawei Mate 60 E2E',
          platform: 'HUAWEI_HARMONY',
          appVersion: '1.0.0',
        }),
      });
      assert.equal(res.status, 200, `Expected 200 login, got ${res.status}`);
      assert.ok(res.headers.get('x-request-id'), 'Missing X-Request-Id header');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(res.headers.get('x-frame-options'), 'DENY');

      const data: any = await res.json();
      assert.ok(data.accessToken, 'Expected accessToken');
      assert.match(data.refreshToken || '', /^sf_rt_[a-f0-9]{64}$/);
      assert.ok(data.sessionId, 'Expected sessionId');
      sandboxAccessToken = data.accessToken;
      sandboxRefreshToken = data.refreshToken;
      sandboxSessionId = data.sessionId;
    });

    await testCase('2. Refresh rotation revokes old JWT sid immediately and reuse theft kills token family', async () => {
      const prevAccess = sandboxAccessToken;
      const prevRefresh = sandboxRefreshToken;

      const rotRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: prevRefresh, deviceId }),
      });
      assert.equal(rotRes.status, 200, `Expected 200 refresh, got ${rotRes.status}`);
      const rotData: any = await rotRes.json();
      assert.ok(rotData.accessToken);
      assert.match(rotData.refreshToken || '', /^sf_rt_[a-f0-9]{64}$/);
      assert.notEqual(rotData.refreshToken, prevRefresh);
      assert.notEqual(rotData.sessionId, sandboxSessionId);

      // Wait zero delay: previous access token carrying revoked sid must fail immediately
      const oldMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${prevAccess}` },
      });
      assert.equal(oldMe.status, 401, `Expected 401 for revoked sid JWT, got ${oldMe.status}`);

      // Active rotated access token succeeds
      const newMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${rotData.accessToken}` },
      });
      assert.equal(newMe.status, 200);

      // Theft simulation: reuse already-rotated prevRefresh -> kills ENTIRE family!
      const theftRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: prevRefresh, deviceId }),
      });
      assert.equal(theftRes.status, 401, `Expected 401 on refresh reuse, got ${theftRes.status}`);

      const killedVictimRes = await fetch(`${baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rotData.refreshToken, deviceId }),
      });
      assert.equal(
        killedVictimRes.status,
        401,
        `Expected entire compromised token family revoked (401), got ${killedVictimRes.status}`,
      );

      // Re-login cleanly for subsequent steps
      const relogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: 'demo',
          username: 'guest',
          password: 'Sandbox2026!',
          deviceId,
          deviceName: 'Huawei Mate 60 E2E',
          platform: 'HUAWEI_HARMONY',
        }),
      });
      assert.equal(relogin.status, 200);
      const reData: any = await relogin.json();
      sandboxAccessToken = reData.accessToken;
      sandboxRefreshToken = reData.refreshToken;
      sandboxSessionId = reData.sessionId;
    });

    await testCase('3. Hardware Biometric (FaceID/Keystore ECDSA P-256) enroll, challenge, verify & anti-replay', async () => {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'prime256v1',
      });
      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

      const enrollRes = await fetch(`${baseUrl}/api/auth/biometric/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
        },
        body: JSON.stringify({
          deviceId,
          deviceName: 'Huawei Mate 60 E2E',
          platform: 'HUAWEI_HARMONY',
          publicKeyPem,
          keyAlgorithm: 'ECDSA_P256',
        }),
      });
      assert.equal(enrollRes.status, 200, `Biometric enroll failed: ${enrollRes.status}`);
      const enrollJson: any = await enrollRes.json();
      assert.equal(enrollJson.biometricEnabled, true);

      const chalRes = await fetch(`${baseUrl}/api/auth/biometric/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, refreshToken: sandboxRefreshToken }),
      });
      assert.equal(chalRes.status, 200, `Biometric challenge failed: ${chalRes.status}`);
      const chalJson: any = await chalRes.json();
      assert.ok(chalJson.challengeId && chalJson.signingPayload);

      const signatureBase64 = crypto
        .sign('sha256', Buffer.from(chalJson.signingPayload, 'utf8'), privateKey)
        .toString('base64');

      const verifyRes = await fetch(`${baseUrl}/api/auth/biometric/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: chalJson.challengeId,
          deviceId,
          signatureBase64,
        }),
      });
      assert.equal(verifyRes.status, 200, `Biometric verify failed: ${verifyRes.status}`);
      const verifiedJson: any = await verifyRes.json();
      assert.ok(verifiedJson.accessToken && verifiedJson.refreshToken);
      sandboxAccessToken = verifiedJson.accessToken;
      sandboxRefreshToken = verifiedJson.refreshToken;
      sandboxSessionId = verifiedJson.sessionId;

      // Single-use replay check must reject
      const replayRes = await fetch(`${baseUrl}/api/auth/biometric/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: chalJson.challengeId,
          deviceId,
          signatureBase64,
        }),
      });
      assert.equal(replayRes.status, 401, `Expected 401 on challenge replay, got ${replayRes.status}`);

      const delRes = await fetch(`${baseUrl}/api/auth/biometric/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      assert.equal(delRes.status, 200);
    });

    await testCase('4. App 6-digit Security PIN setup rejects weak PINs, verifies valid PIN, and isolates unauth access', async () => {
      const weakRes = await fetch(`${baseUrl}/api/auth/pin/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
        },
        body: JSON.stringify({ currentPassword: 'Sandbox2026!', newPin: '123456' }),
      });
      assert.equal(weakRes.status, 400, `Expected 400 for weak PIN, got ${weakRes.status}`);

      const setupRes = await fetch(`${baseUrl}/api/auth/pin/setup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
        },
        body: JSON.stringify({ currentPassword: 'Sandbox2026!', newPin: '492817' }),
      });
      assert.equal(setupRes.status, 200);

      const unauthPin = await fetch(`${baseUrl}/api/auth/pin/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '492817' }),
      });
      assert.equal(unauthPin.status, 401, `Expected 401 for unbound PIN verify`);

      const okPin = await fetch(`${baseUrl}/api/auth/pin/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
        },
        body: JSON.stringify({ pin: '492817', deviceId }),
      });
      assert.equal(okPin.status, 200);
      const pinJson: any = await okPin.json();
      assert.equal(pinJson.verified, true);
    });

    await testCase('5. Sessions registry prevents cross-tenant IDOR & logout invalidates active Bearer token', async () => {
      const sessRes = await fetch(`${baseUrl}/api/auth/sessions`, {
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      assert.equal(sessRes.status, 200);
      const sessList: any[] = await sessRes.json();
      assert.ok(sessList.some((s) => s.sessionId === sandboxSessionId && s.isCurrent === true));

      // Attempt cross-tenant spoofing on mobile-boot must stay scoped strictly to userId=2
      const bootSpoofRes = await fetch(`${baseUrl}/api/finance/mobile-boot`, {
        headers: {
          Authorization: `Bearer ${sandboxAccessToken}`,
          'x-user-id': '1',
        },
      });
      assert.equal(bootSpoofRes.status, 200);
      const bootSpoof: any = await bootSpoofRes.json();
      assert.equal(bootSpoof.user.id, 2, 'Cross-tenant x-user-id leaked user #1!');

      // Logout kills current session token immediately
      const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
        },
        body: JSON.stringify({ refreshToken: sandboxRefreshToken }),
      });
      assert.equal(logoutRes.status, 200);

      const postLogoutMe = await fetch(`${baseUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      assert.equal(postLogoutMe.status, 401, 'Bearer JWT still worked after explicit logout!');

      // Re-login cleanly for Idempotency + Boot tests
      const relogin = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountName: 'demo',
          username: 'guest',
          password: 'Sandbox2026!',
        }),
      });
      assert.equal(relogin.status, 200);
      sandboxAccessToken = ((await relogin.json()) as any).accessToken;
    });

    await testCase('6. Idempotency-Key deduplicates mobile expense retries & rejects mismatched payload (409)', async () => {
      const idemKey = `mob-e2e-tx-${Date.now()}`;
      const beforeTxRes = await fetch(`${baseUrl}/api/finance/transactions?month=10&year=2026`, {
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      const beforeList: any[] = await beforeTxRes.json();

      const txPayload = {
        month: 10,
        year: 2026,
        date: '2026-10-15T08:00:00.000Z',
        label: 'E2E Mobile Idempotent Espresso',
        amount: 45000,
        type: 'DEDUCTION',
        paymentMethod: 'CASH',
      };

      const r1 = await fetch(`${baseUrl}/api/finance/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify(txPayload),
      });
      assert.ok(r1.status === 200 || r1.status === 201, `Expected 200/201, got ${r1.status}`);
      assert.equal(r1.headers.get('x-idempotency-replayed'), 'false');
      const created1: any = await r1.json();

      // Exact retry (reordered JSON keys) -> replayed cached response, 0 extra rows
      const r2 = await fetch(`${baseUrl}/api/finance/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({
          amount: 45000,
          label: 'E2E Mobile Idempotent Espresso',
          month: 10,
          year: 2026,
          date: '2026-10-15T08:00:00.000Z',
          type: 'DEDUCTION',
          paymentMethod: 'CASH',
        }),
      });
      assert.ok(r2.status === 200 || r2.status === 201);
      assert.equal(r2.headers.get('x-idempotency-replayed'), 'true');
      const replayed2: any = await r2.json();
      assert.equal(replayed2.id, created1.id);

      const afterTxRes = await fetch(`${baseUrl}/api/finance/transactions?month=10&year=2026`, {
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      const afterList: any[] = await afterTxRes.json();
      assert.equal(afterList.length, beforeList.length + 1, 'Duplicate transaction created on retry!');

      // Mismatched body with identical key -> 409 Conflict
      const conflictRes = await fetch(`${baseUrl}/api/finance/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sandboxAccessToken}`,
          'Idempotency-Key': idemKey,
        },
        body: JSON.stringify({ ...txPayload, amount: 999999 }),
      });
      assert.equal(conflictRes.status, 409, `Expected 409 conflict, got ${conflictRes.status}`);

      // Reset Demo Sandbox cleanly
      const resetRes = await fetch(`${baseUrl}/api/auth/reset-demo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${sandboxAccessToken}` },
      });
      assert.equal(resetRes.status, 200);
    });

    await testCase('7. Consolidated GET /api/finance/mobile-boot matches pacing 1:1 & exposes SSO catalog cleanly', async () => {
      const ssoRes = await fetch(`${baseUrl}/api/auth/sso/providers`);
      assert.equal(ssoRes.status, 200);
      const ssoJson: any = await ssoRes.json();
      assert.ok(Array.isArray(ssoJson.providers) && ssoJson.providers.length === 3);

      const [bootRes, pacingRes] = await Promise.all([
        fetch(`${baseUrl}/api/finance/mobile-boot?month=10&year=2026`, {
          headers: { Authorization: `Bearer ${sandboxAccessToken}` },
        }),
        fetch(`${baseUrl}/api/finance/pacing?month=10&year=2026`, {
          headers: { Authorization: `Bearer ${sandboxAccessToken}` },
        }),
      ]);
      assert.equal(bootRes.status, 200);
      assert.equal(pacingRes.status, 200);

      const boot: any = await bootRes.json();
      const pacing: any = await pacingRes.json();

      assert.equal(boot.pacing.safeToSpendToday, pacing.safeToSpendToday);
      assert.equal(boot.pacing.remainingBudget, pacing.remainingBudget);
      assert.equal(boot.mobileCapabilities.apiContractVersion, '2026-11-v1');
      assert.ok(!JSON.stringify(boot).includes('passwordHash'));
      assert.ok(!JSON.stringify(boot).includes('securityPinHash'));
    });

    console.log(`\nALL ${passed} MOBILE E2E SECURITY & CONTRACT CHECKS PASSED.`);
  } finally {
    if (app) {
      await app.close().catch(() => {});
    }
  }
}

runMobileE2E()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n[FAIL] Mobile E2E failed:', err);
    process.exit(1);
  });
