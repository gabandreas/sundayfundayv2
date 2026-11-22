import 'reflect-metadata';
import * as assert from 'node:assert/strict';

const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const isLiveFlag = process.argv.includes('--live');
const externalBaseUrl =
  urlArg ||
  process.env.EMAIL_E2E_BASE_URL ||
  (isLiveFlag ? 'https://sundayfunday-api.vercel.app' : '');

if (!externalBaseUrl) {
  process.env.NODE_ENV = 'production';
  if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('127.0.0.1:5433')) {
    process.env.DATABASE_URL =
      'postgresql://postgres:password@127.0.0.1:5433/finance_erp?schema=public';
  }
}

async function runEmailE2E() {
  let app: any = null;
  let baseUrl = '';
  let token = '';

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

    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 3098;
    baseUrl = `http://127.0.0.1:${port}`;
    console.log(`Target: LOCAL IN-PROCESS (${baseUrl})\n`);
  }

  const results: Array<{ name: string; status: string }> = [];

  async function testCase(name: string, fn: () => Promise<void>) {
    await fn();
    results.push({ name, status: 'PASS' });
    console.log(`[PASS] ${name}`);
  }

  async function apiJson(
    path: string,
    options: { method?: string; body?: unknown; auth?: boolean } = {},
  ): Promise<{ status: number; json: any }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.auth !== false && token) {
      headers.Authorization = `Bearer ${token}`;
    }
    const res = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { rawText: text };
    }
    return { status: res.status, json };
  }

  try {
    await testCase('1. Unauthenticated access to /api/email/* endpoints returns 401', async () => {
      const r1 = await apiJson('/api/email/status', { auth: false });
      assert.equal(r1.status, 401, `Expected 401 on GET /api/email/status, got ${r1.status}`);

      const r2 = await apiJson('/api/email/verify', { method: 'POST', auth: false });
      assert.equal(r2.status, 401, `Expected 401 on POST /api/email/verify, got ${r2.status}`);

      const r3 = await apiJson('/api/email/test-dispatch', {
        method: 'POST',
        body: { locale: 'EN' },
        auth: false,
      });
      assert.equal(
        r3.status,
        401,
        `Expected 401 on POST /api/email/test-dispatch, got ${r3.status}`,
      );
    });

    await testCase('2. Authenticate cleanly into isolated Demo Sandbox (userId = 2)', async () => {
      const login = await apiJson('/api/auth/demo-login', {
        method: 'POST',
        auth: false,
      });
      assert.equal(login.status, 200, `Demo login returned HTTP ${login.status}`);
      assert.ok(login.json?.accessToken, 'Missing accessToken on demo-login');
      assert.equal(login.json?.user?.id, 2, 'Expected demo sandbox userId = 2');
      token = login.json.accessToken;
    });

    await testCase('3. Reset Demo Sandbox SMTP credentials and verify DRY_RUN_PREVIEW status', async () => {
      const reset = await apiJson('/api/credit/kill-switches/notification-config', {
        method: 'PATCH',
        body: { clearSmtpPassword: true, resetSmtpConfig: true },
      });
      assert.equal(reset.status, 200, `Reset config returned HTTP ${reset.status}`);
      assert.equal(reset.json?.hasSmtpPassword, false, 'Expected hasSmtpPassword=false after reset');

      const st = await apiJson('/api/email/status');
      assert.equal(st.status, 200);
      assert.equal(st.json?.mode, 'DRY_RUN_PREVIEW');
      assert.equal(st.json?.configured, false);
      assert.equal(st.json?.verified, false);
      assert.equal(st.json?.verificationStatus, 'UNCONFIGURED');
    });

    await testCase('4. All 4 email workflows execute cleanly in DRY_RUN_PREVIEW (EN/ID/ZH)', async () => {
      for (const locale of ['EN', 'ID', 'ZH'] as const) {
        const testRes = await apiJson('/api/email/test-dispatch', {
          method: 'POST',
          body: { locale },
        });
        assert.equal(testRes.status, 200, `test-dispatch (${locale}) returned ${testRes.status}`);
        assert.equal(testRes.json?.status, 'DRY_RUN_PREVIEW');
      }

      const stmt = await apiJson('/api/email/monthly-statement', {
        method: 'POST',
        body: { month: 11, year: 2026, scope: 'all', locale: 'EN' },
      });
      assert.equal(stmt.status, 200, `monthly-statement returned ${stmt.status}`);
      assert.equal(stmt.json?.status, 'DRY_RUN_PREVIEW');
      assert.ok(stmt.json?.attachmentNames?.[0]?.endsWith('.xlsx'), 'Expected .xlsx attachment');
      assert.ok(
        (stmt.json?.attachmentSizesBytes?.[0] ?? 0) > 2000,
        'Expected non-empty .xlsx attachment size',
      );

      const digest = await apiJson('/api/email/cutoff-digest', {
        method: 'POST',
        body: { month: 11, year: 2026, locale: 'ID' },
      });
      assert.equal(digest.status, 200, `cutoff-digest returned ${digest.status}`);
      assert.equal(digest.json?.status, 'DRY_RUN_PREVIEW');

      const backup = await apiJson('/api/email/ledger-backup', {
        method: 'POST',
        body: { month: 11, year: 2026, locale: 'ZH' },
      });
      assert.equal(backup.status, 200, `ledger-backup returned ${backup.status}`);
      assert.equal(backup.json?.status, 'DRY_RUN_PREVIEW');
      assert.equal(backup.json?.attachmentNames?.length, 2, 'Expected JSON + XLSX backup attachments');
      assert.match(
        backup.json?.checksumSha256 ?? '',
        /^[a-f0-9]{64}$/,
        'Expected 64-char SHA-256 checksum on ledger backup',
      );
    });

    await testCase('5. All 5 read-only HTML preview templates render cleanly', async () => {
      const templates = [
        'kill-switch',
        'monthly-statement',
        'cutoff-digest',
        'ledger-backup',
        'test-dispatch',
      ] as const;
      for (const template of templates) {
        const prev = await apiJson('/api/email/preview', {
          method: 'POST',
          body: { template, month: 11, year: 2026, scope: 'all', locale: 'EN' },
        });
        assert.equal(prev.status, 200, `Preview ${template} returned HTTP ${prev.status}`);
        assert.ok(prev.json?.subject?.length > 5, `Empty subject for ${template}`);
        assert.ok(prev.json?.htmlPreview?.includes('<html'), `Invalid HTML for ${template}`);
      }
    });

    await testCase(
      '6. Saving invalid 16-digit App Password strips whitespace and honestly reports AUTH_ERROR (no fake green badge)',
      async () => {
        const fakeAppPass = 'abcd efgh ijkl mnop';
        const saveRes = await apiJson('/api/credit/kill-switches/notification-config', {
          method: 'PATCH',
          body: {
            killSwitchNotifyEmail: 'sundayfundayerp@gmail.com',
            killSwitchSmtpUser: 'sundayfundayerp@gmail.com',
            killSwitchSmtpAppPassword: fakeAppPass,
          },
        });
        assert.equal(saveRes.status, 200, `Save config returned HTTP ${saveRes.status}`);
        assert.equal(saveRes.json?.hasSmtpPassword, true);
        assert.equal(
          saveRes.json?.smtpVerification?.ok,
          false,
          'Expected smtpVerification.ok=false on invalid App Password',
        );
        assert.equal(
          saveRes.json?.smtpVerification?.errorCode,
          'SMTP_AUTH_FAILED',
          `Expected SMTP_AUTH_FAILED, got ${saveRes.json?.smtpVerification?.errorCode}`,
        );

        const verifyRes = await apiJson('/api/email/verify', { method: 'POST' });
        assert.equal(verifyRes.status, 200, `POST /api/email/verify returned ${verifyRes.status}`);
        assert.equal(verifyRes.json?.mode, 'AUTH_ERROR');
        assert.equal(verifyRes.json?.verified, false);
        assert.equal(verifyRes.json?.verificationStatus, 'ERROR');
        assert.equal(verifyRes.json?.errorCode, 'SMTP_AUTH_FAILED');
        assert.ok(
          verifyRes.json?.verificationGuidance?.includes('SMTP Sender Account'),
          'Expected actionable sender guidance on 535 AUTH_ERROR',
        );

        const st = await apiJson('/api/email/status');
        assert.equal(st.status, 200);
        assert.equal(st.json?.mode, 'AUTH_ERROR', 'GET /api/email/status must not return fake LIVE_SMTP');
      },
    );

    await testCase(
      '7. All 4 email dispatch endpoints return structured 422 diagnostics (ZERO HTTP 500s) and zero secret leaks on 535 auth failure',
      async () => {
        const ops: Array<{ path: string; body: Record<string, unknown> }> = [
          { path: '/api/email/test-dispatch', body: { locale: 'EN' } },
          {
            path: '/api/email/monthly-statement',
            body: { month: 11, year: 2026, scope: 'all', locale: 'EN' },
          },
          { path: '/api/email/cutoff-digest', body: { month: 11, year: 2026, locale: 'EN' } },
          { path: '/api/email/ledger-backup', body: { month: 11, year: 2026, locale: 'EN' } },
        ];

        for (const op of ops) {
          const res = await apiJson(op.path, { method: 'POST', body: op.body });
          assert.equal(
            res.status,
            422,
            `Expected HTTP 422 on ${op.path} with bad SMTP credentials, got ${res.status}: ${JSON.stringify(res.json)}`,
          );
          assert.equal(res.json?.errorCode, 'SMTP_AUTH_FAILED');
          assert.ok(
            typeof res.json?.message === 'string' && !res.json.message.includes('unexpected server error'),
            `Expected actionable 422 message on ${op.path}, got: ${res.json?.message}`,
          );
          assert.ok(res.json?.guidance?.includes('SMTP Sender Account'), 'Expected guidance field on 422');
          assert.ok(
            !JSON.stringify(res.json).includes('abcdefghijklmnop'),
            'Plaintext App Password leaked in HTTP error payload!',
          );
        }
      },
    );

    await testCase(
      '8. Kill-switch reminder handles invalid SMTP 535 gracefully with top-level error + guidance',
      async () => {
        const ksList = await apiJson('/api/credit/kill-switches');
        assert.equal(ksList.status, 200);
        let targetId: number | undefined = ksList.json?.items?.[0]?.id;
        let createdTempId: number | null = null;

        if (!targetId) {
          const created = await apiJson('/api/credit/kill-switches', {
            method: 'POST',
            body: {
              label: 'E2E Disposable SMTP Probe',
              amount: 0,
              promoLabel: 'E2E Probe',
              promoEndDate: '2027-01-27',
              postPromoNormalAmount: 199000,
              killSwitchEnabled: true,
            },
          });
          assert.ok(
            created.status === 200 || created.status === 201,
            `Failed to create temporary kill-switch probe: ${created.status}`,
          );
          createdTempId = created.json?.id;
          targetId = created.json?.id;
        }

        assert.ok(targetId, 'Missing kill-switch ID for send-reminder verification');
        try {
          const rem = await apiJson(`/api/credit/kill-switches/${targetId}/send-reminder`, {
            method: 'POST',
          });
          assert.ok(rem.status === 200 || rem.status === 201, `Unexpected status ${rem.status}`);
          assert.equal(rem.json?.success, false);
          assert.equal(rem.json?.mode, 'ERROR');
          assert.equal(rem.json?.errorCode, 'SMTP_AUTH_FAILED');
          assert.ok(rem.json?.error?.includes('SMTP'), 'Expected top-level error string on reminder failure');
          assert.ok(rem.json?.channels?.emailError?.includes('535'), 'Expected channel emailError details');
        } finally {
          if (createdTempId) {
            await apiJson(`/api/credit/cards/${createdTempId}`, { method: 'DELETE' }).catch(() => {});
          }
        }
      },
    );

    await testCase(
      '9. Explicit dryRun fallback works cleanly across all 4 workflows even while invalid credentials remain saved',
      async () => {
        const ops: Array<{ path: string; body: Record<string, unknown> }> = [
          { path: '/api/email/test-dispatch', body: { locale: 'EN', dryRun: true } },
          {
            path: '/api/email/monthly-statement',
            body: { month: 11, year: 2026, scope: 'all', locale: 'EN', dryRun: true },
          },
          { path: '/api/email/cutoff-digest', body: { month: 11, year: 2026, locale: 'EN', dryRun: true } },
          { path: '/api/email/ledger-backup', body: { month: 11, year: 2026, locale: 'EN', dryRun: true } },
        ];
        for (const op of ops) {
          const res = await apiJson(op.path, { method: 'POST', body: op.body });
          assert.equal(res.status, 200, `dryRun fallback on ${op.path} returned ${res.status}`);
          assert.equal(res.json?.status, 'DRY_RUN_PREVIEW');
          assert.equal(res.json?.configured, true);
        }
      },
    );

    await testCase('10. Clear Saved Password reverts Demo Sandbox cleanly to DRY_RUN_PREVIEW', async () => {
      const cleared = await apiJson('/api/credit/kill-switches/notification-config', {
        method: 'PATCH',
        body: { clearSmtpPassword: true, resetSmtpConfig: true },
      });
      assert.equal(cleared.status, 200);
      assert.equal(cleared.json?.hasSmtpPassword, false);
      assert.equal(cleared.json?.smtpVerification, null);

      const st = await apiJson('/api/email/status');
      assert.equal(st.status, 200);
      assert.equal(st.json?.mode, 'DRY_RUN_PREVIEW');
      assert.equal(st.json?.hasAppPassword, false);
    });

    if (!externalBaseUrl) {
      await testCase('11. Local XLSX workbook signature & multi-sheet Integrity check', async () => {
        const { ReportsSelectors } = await import('../apps/api/dist/src/reports/reports.selectors');
        const { generateExecutiveWorkbookBuffer } = await import(
          '../apps/api/dist/src/email/email.workbook'
        );
        const ExcelJS = (await import('exceljs')).default;
        const reports = app.get(ReportsSelectors);
        const execReport = await reports.getExecutiveReport(11, 2026, 'all', 2);
        const xlsxBuf: Buffer = await generateExecutiveWorkbookBuffer(execReport);
        assert.ok(Buffer.isBuffer(xlsxBuf) && xlsxBuf.byteLength > 2000, 'Expected non-empty Buffer');
        assert.equal(xlsxBuf.subarray(0, 2).toString('utf8'), 'PK', 'Expected valid XLSX zip header PK');

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(xlsxBuf as any);
        assert.ok(wb.worksheets.length >= 4, `Expected >=4 worksheets, got ${wb.worksheets.length}`);
      });
    }

    console.log(`\nALL EMAIL E2E CHECKS PASSED (${results.length}/${results.length}).`);
  } finally {
    if (token) {
      await apiJson('/api/credit/kill-switches/notification-config', {
        method: 'PATCH',
        body: { clearSmtpPassword: true, resetSmtpConfig: true },
      }).catch(() => {});
    }
    if (app) {
      await app.close();
    }
  }
}

runEmailE2E().catch((err) => {
  console.error('\nEMAIL E2E FAILURE:', err);
  process.exit(1);
});
