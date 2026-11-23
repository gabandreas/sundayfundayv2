import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import puppeteer from 'puppeteer-core';

const isLive = process.argv.includes('--live');
const urlArg = process.argv.find((a) => a.startsWith('--url='))?.slice(6);
const WEB_URL = (
  urlArg ||
  process.env.ERP_WEB_URL ||
  (isLive ? 'https://sundayfunday-erp.vercel.app' : 'http://localhost:3000')
).replace(/\/$/, '');

const API_URL = (
  process.env.ERP_API_URL ||
  (isLive ? 'https://sundayfunday-api.vercel.app' : 'http://localhost:3001')
).replace(/\/$/, '');

function resolveBrowserExecutable(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('No local Chrome or Edge binary found for puppeteer-core E2E.');
}

async function loginApi(username: string, password: string): Promise<{ token: string; user: any }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const body: any = await res.json();
  assert.equal(res.status, 200, `Login failed for ${username}: ${JSON.stringify(body)}`);
  assert.ok(body.accessToken, `Missing accessToken for ${username}`);
  return { token: body.accessToken, user: body.user };
}

async function main() {
  console.log(`=== SUNDAY FUNDAY ERP — HEADLESS DOM & UX FLOW E2E (${WEB_URL}) ===`);

  // 1. Verify API Auth & Role Separation first
  const u1 = await loginApi('cheeseburger', 'Djakarta2026Nov!@#');
  assert.equal(u1.user.role, 'USER', `User #1 role must be USER, got ${u1.user.role}`);
  assert.equal(u1.user.blueprintType, 'SUPERADMIN_BESPOKE');

  const superAdmin = await loginApi('superadmin', process.env.SYS_ADMIN_PASSWORD || 'SuperAdmin#2026!');
  assert.equal(superAdmin.user.role, 'SUPERADMIN', `superadmin role must be SUPERADMIN`);

  const executablePath = resolveBrowserExecutable();
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  });

  try {
    const page = await browser.newPage();

    // Seed User #1 read-only session using exact AuthContext + middleware cookie & storage keys
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(
      (token, user) => {
        const serialized = JSON.stringify(user);
        localStorage.setItem('erp_auth_token', token);
        localStorage.setItem('erp_auth_user', serialized);
        localStorage.setItem('erp_locale', 'en');
        sessionStorage.setItem('erp_auth_token', token);
        sessionStorage.setItem('erp_auth_user', serialized);
        const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `erp_user_id=${user.id}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
        document.cookie = `erp_auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
      },
      u1.token,
      u1.user,
    );

    // 2. Navigate to Overview (/) and verify Smart Default Active Period (11/2026 ACTIVE: 28 OCT – 26 NOV), Spending & Trend Review in Sidebar, Savings & Emergency Fund label, and no Platform Admin or Marquee Sidebar link
    await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle2', timeout: 60000 });
    assert.notEqual(
      new URL(page.url()).pathname,
      '/login',
      'Authenticated User #1 must stay on Overview (/), not redirect to /login',
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('Savings & Emergency Fund'),
      { timeout: 15000 },
    );
    const overviewText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !overviewText.includes('Platform Admin'),
      'Sidebar must NOT display Platform Admin for consumer role USER (User #1)',
    );
    assert.ok(
      overviewText.includes('Savings & Emergency Fund'),
      'Sidebar must render humanized "Savings & Emergency Fund" label instead of "Savings & Reservoirs" or "Savings & Vaults"',
    );
    assert.ok(
      overviewText.includes('Spending & Trend Review'),
      'Sidebar AUDIT & DECISION section must render "Spending & Trend Review" (/analytics)',
    );
    assert.ok(
      !overviewText.includes('Marquee AI'),
      'Sidebar must not list a redundant "Marquee AI" entry',
    );
    assert.ok(
      !overviewText.includes('SPinjam Payoff Watch'),
      'Sidebar must not render removed legacy "SPinjam Payoff Watch" shortcut',
    );
    assert.ok(
      !overviewText.includes('Savings & Reservoirs'),
      'Sidebar must not contain "Savings & Reservoirs"',
    );
    assert.ok(
      overviewText.includes('28 OCT') && overviewText.includes('26 NOV'),
      'Overview ACTIVE 11/2026 Daily Pacing chart must display cycle boundary dates "28 OCT" and "26 NOV"',
    );
    assert.ok(
      !overviewText.includes('Burn-Rate Telemetry'),
      'Overview must not contain robotic "Burn-Rate Telemetry" copy',
    );

    // Also verify 12/2026 PRE_PAYDAY cycle boundary dates ("27 NOV" and "27 DEC")
    await page.goto(`${WEB_URL}/?month=12&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
      () => document.body.innerText.includes('27 NOV'),
      { timeout: 15000 },
    );
    const decOverviewText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      decOverviewText.includes('27 NOV') && decOverviewText.includes('27 DEC'),
      'Overview PRE_PAYDAY 12/2026 Daily Pacing chart must display cycle boundary dates "27 NOV" and "27 DEC"',
    );
    assert.ok(
      !decOverviewText.includes('DAY 32'),
      'Overview PRE_PAYDAY Daily Pacing chart must not show generic "DAY 32" axis label',
    );
    console.log(
      '  PASS [1/6]: User #1 consumer role hides Platform Admin, renders "Savings & Emergency Fund" & "Spending & Trend Review", verifies 11/2026 ACTIVE (28 OCT–26 NOV) & 12/2026 PRE_PAYDAY (27 NOV–27 DEC), and eliminates AI-slop labels.',
    );

    // 3. Verify Trilingual Switcher (EN / ID / ZH) renders localized human terms with zero raw translation keys
    const expectedLocaleTerm: Record<'en' | 'id' | 'zh', string> = {
      en: 'Savings & Emergency Fund',
      id: 'Tabungan & Dana Darurat',
      zh: '储蓄与应急基金',
    };
    for (const loc of ['en', 'id', 'zh'] as const) {
      await page.evaluate((l) => {
        localStorage.setItem('erp_locale', l);
      }, loc);
      await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
      await page.waitForFunction(
        (expected) => document.body.innerText.includes(expected),
        { timeout: 15000 },
        expectedLocaleTerm[loc],
      );
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(
        !/\b(nav\.[a-zA-Z]+|sub\.[a-zA-Z.]+|overview\.[a-zA-Z.]+)\b/.test(bodyText),
        `Detected raw translation key on Overview in locale ${loc}`,
      );
    }
    await page.evaluate(() => localStorage.setItem('erp_locale', 'en'));
    console.log('  PASS [2/6]: Trilingual (EN / ID / ZH) DOM verification passed ("Savings & Emergency Fund" / "Tabungan & Dana Darurat" / "储蓄与应急基金").');

    // 4. Verify Consolidated Routes (/payday-wizard, /calendar, /credit?sub=contracts, /credit?sub=simulator, /analytics, /marquee, /preferences?sub=ai)
    const routeChecks: Array<{ path: string; expectedSubstring: string }> = [
      { path: '/payday-wizard?month=11&year=2026', expectedSubstring: 'Paycycle Activation Checklist' },
      { path: '/calendar?month=11&year=2026', expectedSubstring: 'Lowest Cash Point' },
      { path: '/calendar?month=4&year=2027', expectedSubstring: 'Lowest Cash Point' },
      { path: '/credit?sub=contracts&month=11&year=2026', expectedSubstring: 'Active Installment Plans' },
      { path: '/credit?sub=simulator&month=11&year=2026', expectedSubstring: 'Wishlist' },
      { path: '/import?month=11&year=2026', expectedSubstring: 'Statement Import' },
      { path: '/scenarios?month=11&year=2026', expectedSubstring: 'What-If Scenario Lab' },
      { path: '/savings?sub=pockets&month=11&year=2026', expectedSubstring: 'Savings Pockets' },
      { path: '/reports?sub=executive&month=12&year=2026', expectedSubstring: 'Where Your Money Went' },
      { path: '/analytics', expectedSubstring: 'Spending' },
      { path: '/marquee', expectedSubstring: 'Marquee Financial Co-Pilot' },
      { path: '/preferences?sub=ai', expectedSubstring: 'AES-256-GCM' },
    ];

    for (const rc of routeChecks) {
      await page.goto(`${WEB_URL}${rc.path}`, { waitUntil: 'networkidle2', timeout: 60000 });
      assert.notEqual(
        new URL(page.url()).pathname,
        '/login',
        `Route ${rc.path} unexpectedly redirected to /login`,
      );
      try {
        await page.waitForFunction(
          (substr) => document.body.innerText.toLowerCase().includes(substr.toLowerCase()),
          { timeout: 15000 },
          rc.expectedSubstring,
        );
      } catch (err) {
        const snippet = await page.evaluate(() => document.body.innerText.slice(0, 600));
        throw new Error(`Route ${rc.path} missing "${rc.expectedSubstring}". Rendered snippet: ${snippet}`);
      }
      const routeText = await page.evaluate(() => document.body.innerText.toLowerCase());
      assert.ok(
        !routeText.includes('asset reservoirs') && !routeText.includes('net worth reservoirs'),
        `Route ${rc.path} still contains banned "reservoirs" phrasing`,
      );
    }
    console.log('  PASS [3/6]: All new & consolidated routes render expected domain sections.');

    // 5. Verify Icon-Only Floating Bottom-Right Marquee Launcher & native top-layer <dialog> Marquee drawer + read-only context query
    const launcherValid = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="marquee-floating-launcher"]') as HTMLElement | null;
      if (!btn) return false;
      const svg = btn.querySelector('svg');
      const title = btn.getAttribute('title') ?? '';
      return Boolean(
        svg &&
          btn.innerText.trim() === '' &&
          title.includes('Alt+M') &&
          btn.className.includes('fixed') &&
          btn.className.includes('bottom-5') &&
          btn.className.includes('rounded-full'),
      );
    });
    assert.equal(
      launcherValid,
      true,
      'Icon-only floating bottom-right Marquee launcher ([data-testid="marquee-floating-launcher"]) with custom SVG emblem and Alt+M hover title must be mounted',
    );

    await page.click('[data-testid="marquee-floating-launcher"]');
    await new Promise((r) => setTimeout(r, 350));

    const dialogOpen = await page.evaluate(() => {
      const dlg = document.querySelector('dialog.marquee-drawer') as HTMLDialogElement | null;
      return Boolean(dlg && dlg.open);
    });
    assert.equal(dialogOpen, true, 'Floating launcher must open native <dialog class="marquee-drawer"> via showModal()');

    // Run a read-only period variance query inside the live drawer to confirm end-to-end Marquee UX with zero dev leakage
    await page.type('dialog.marquee-drawer input[type="text"]', 'Compare 11/2026 vs 12/2026 variance');
    await page.click('dialog.marquee-drawer button[type="submit"]');
    await page.waitForFunction(
      () => {
        const dlg = document.querySelector('dialog.marquee-drawer');
        const txt = dlg?.textContent ?? '';
        return (
          (txt.includes('Rp ') || txt.includes('Nov') || txt.includes('Dec') || txt.includes('11/2026')) &&
          !txt.includes('TIER1_NLU') &&
          !txt.includes('explain_period_variance')
        );
      },
      { timeout: 25000 },
    );
    console.log('  PASS [4/6]: Floating bottom-right Marquee launcher, <dialog> drawer & live read-only variance query verified.');

    // 6. Verify /admin is restricted for consumer role USER
    await page.goto(`${WEB_URL}/admin`, { waitUntil: 'networkidle2', timeout: 45000 });
    assert.notEqual(
      new URL(page.url()).pathname,
      '/login',
      '/admin check must stay authenticated as consumer USER',
    );
    const adminText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      adminText.includes('Access Restricted') || adminText.includes('SUPERADMIN'),
      'Consumer USER navigating to /admin must see Access Restricted guard',
    );
    console.log('  PASS [5/6]: /admin renders Access Restricted for consumer role USER.');

    // 7. Verify Clean Auth Routes (/login, /forgot-password, /reset-password), US Standard Sandbox Workspace, and Superadmin Console
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      document.cookie = 'erp_auth_token=; path=/; max-age=0';
      document.cookie = 'erp_user_id=; path=/; max-age=0';
    });
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'networkidle2', timeout: 45000 });
    await page.waitForSelector('input[name="username"]', { timeout: 15000 });
    const loginText = await page.evaluate(() => document.body.innerText);
    assert.ok(!loginText.includes('Switch Account'), '/login must not contain Switch Account');
    assert.ok(!loginText.includes('User Session'), '/login must not contain User Session');
    assert.ok(!loginText.includes('Session Locked'), '/login must not contain Session Locked');
    const hasForgotLink = await page.evaluate(() =>
      Boolean(document.querySelector('a[href*="/forgot-password"]')),
    );
    assert.equal(hasForgotLink, true, '/login must include /forgot-password link');

    await page.goto(`${WEB_URL}/forgot-password`, { waitUntil: 'networkidle2', timeout: 45000 });
    assert.equal(new URL(page.url()).pathname, '/forgot-password', '/forgot-password must render cleanly without login redirect');
    await page.waitForSelector('#forgot-identifier', { timeout: 15000 });

    await page.goto(`${WEB_URL}/reset-password`, { waitUntil: 'networkidle2', timeout: 45000 });
    assert.equal(new URL(page.url()).pathname, '/reset-password', '/reset-password must render cleanly without login redirect');

    // Demo Sandbox -> US Personal Finance Standard Sidebar & zero Gabriel leaks
    const demoRes = await fetch(`${API_URL}/api/auth/demo-login`, { method: 'POST' });
    const demoBody: any = await demoRes.json();
    assert.equal(demoRes.status, 200, 'demo-login must succeed');
    await page.evaluate(
      (token, user) => {
        const serialized = JSON.stringify(user);
        localStorage.setItem('erp_auth_token', token);
        localStorage.setItem('erp_auth_user', serialized);
        localStorage.setItem('erp_locale', 'en');
        sessionStorage.setItem('erp_auth_token', token);
        sessionStorage.setItem('erp_auth_user', serialized);
        document.cookie = `erp_user_id=${user.id}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `erp_auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      },
      demoBody.accessToken,
      demoBody.user,
    );
    await page.goto(`${WEB_URL}/?month=11&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes('Transactions') &&
        document.body.innerText.includes('Budgets & Envelopes'),
      { timeout: 15000 },
    );
    const sandboxText = await page.evaluate(() => document.body.innerText);
    for (const stdNav of [
      'Transactions',
      'Budgets & Envelopes',
      'Income & Cash Flow',
      'Accounts & Goals',
      'Bills & Recurring',
    ]) {
      assert.ok(sandboxText.includes(stdNav), `Standard Sandbox sidebar must include "${stdNav}"`);
    }
    assert.ok(
      !/\bVape\b|\bHaircut\b|\bKRL Commuter\b/i.test(sandboxText),
      'Standard Sandbox must not leak User #1 Vape/Haircut/KRL labels',
    );

    // Superadmin (/admin) -> Provision modal + Security Audit Log + Zero Age brackets
    await page.evaluate(
      (token, user) => {
        const serialized = JSON.stringify(user);
        localStorage.setItem('erp_auth_token', token);
        localStorage.setItem('erp_auth_user', serialized);
        sessionStorage.setItem('erp_auth_token', token);
        sessionStorage.setItem('erp_auth_user', serialized);
        document.cookie = `erp_user_id=${user.id}; path=/; max-age=604800; SameSite=Lax`;
        document.cookie = `erp_auth_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
      },
      superAdmin.token,
      superAdmin.user,
    );
    await page.goto(`${WEB_URL}/admin`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
      () => document.body.innerText.includes('Provision Client Account'),
      { timeout: 15000 },
    );
    const adminConsoleText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !/Ages\s+\d{2}/i.test(adminConsoleText),
      '/admin console must not show removed Age Bracket labels',
    );
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const secBtn = buttons.find((b) => b.textContent?.includes('Security, IP Whitelist & Backup'));
      secBtn?.click();
    });
    await page.waitForFunction(
      () => document.body.innerText.includes('Security & Admin Audit Log'),
      { timeout: 10000 },
    );
    console.log(
      '  PASS [6/7]: Auth routes (/login, /forgot-password, /reset-password), US Standard Sandbox workspace, and Superadmin Console verified.',
    );

    console.log('  PASS [7/7]: Full Headless DOM & UX Flow E2E completed with 0 defects.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nUX FLOW E2E FAILED:', err);
  process.exit(1);
});
