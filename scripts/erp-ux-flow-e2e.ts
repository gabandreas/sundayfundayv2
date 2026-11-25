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
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    const httpErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message ?? err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon')) {
          consoleErrors.push(text);
        }
      }
    });
    page.on('response', (res) => {
      const status = res.status();
      const url = res.url();
      if (status >= 500 || (status >= 400 && url.includes('/api/'))) {
        httpErrors.push(`${status} ${url}`);
      }
    });

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

    // 2. Navigate to Overview (/) and verify Smart Default Active Period (11/2026 ACTIVE: 28 OCT – 26 NOV), 8-hub Sidebar labels, and no Platform Admin or Marquee Sidebar link
    await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle2', timeout: 60000 });
    assert.notEqual(
      new URL(page.url()).pathname,
      '/login',
      'Authenticated User #1 must stay on Overview (/), not redirect to /login',
    );
    await page.waitForFunction(
      () => document.body.innerText.includes('Savings & Net Worth'),
      { timeout: 15000 },
    );
    const overviewText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !overviewText.includes('Platform Admin'),
      'Sidebar must NOT display Platform Admin for consumer role USER (User #1)',
    );
    for (const hubLabel of [
      'Overview',
      'Cashflow & Ledger',
      'Income & Payday',
      'Bills & Credit',
      'Plan & Events',
      'Savings & Net Worth',
      'Reports & Insights',
      'Preferences',
    ]) {
      assert.ok(
        overviewText.includes(hubLabel),
        `8-Hub Sidebar must display "${hubLabel}"`,
      );
    }
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
      overviewText.includes('28 Oct') && overviewText.includes('26 Nov'),
      'Overview ACTIVE 11/2026 Daily Pacing chart must display cycle boundary dates "28 Oct" and "26 Nov"',
    );
    assert.ok(
      !overviewText.includes('Burn-Rate Telemetry'),
      'Overview must not contain robotic "Burn-Rate Telemetry" copy',
    );
    assert.ok(
      !overviewText.includes('Automatic recalculation enabled'),
      'Overview cycle header must not contain "Automatic recalculation enabled" filler copy',
    );

    const deficitCheck = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="deficit-alert"]');
      if (!box) return { present: false, hasAllocLink: true, rpCount: 0 };
      const txt = box.textContent ?? '';
      const rpMatches = txt.match(/Rp\s+[•\d.]+/g) ?? [];
      return {
        present: true,
        hasAllocLink: Boolean(box.querySelector('a[href*="/allocations"]')),
        rpCount: rpMatches.length,
      };
    });
    if (deficitCheck.present) {
      assert.equal(deficitCheck.hasAllocLink, true, 'DeficitAlert must link directly to /allocations');
      assert.equal(deficitCheck.rpCount, 1, `DeficitAlert must show shortfall amount once, found ${deficitCheck.rpCount}`);
    }

    // Verify collapsible desktop sidebar rail toggle
    await page.waitForSelector('[data-testid="sidebar-collapse-toggle"]', { timeout: 10000 });
    await page.click('[data-testid="sidebar-collapse-toggle"]');
    await new Promise((r) => setTimeout(r, 250));
    const collapsedWidth = await page.evaluate(
      () => document.querySelector('aside')?.getBoundingClientRect().width ?? 0,
    );
    assert.ok(
      collapsedWidth > 0 && collapsedWidth <= 72,
      `Collapsed sidebar width must be <= 72px, got ${collapsedWidth}`,
    );
    await page.click('[data-testid="sidebar-collapse-toggle"]');
    await new Promise((r) => setTimeout(r, 250));
    const expandedWidth = await page.evaluate(
      () => document.querySelector('aside')?.getBoundingClientRect().width ?? 0,
    );
    assert.ok(
      expandedWidth >= 200,
      `Expanded sidebar width must be >= 200px, got ${expandedWidth}`,
    );

    // Also verify 12/2026 PRE_PAYDAY cycle boundary dates ("27 Nov" and "27 Dec")
    await page.goto(`${WEB_URL}/?month=12&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
      () => document.body.innerText.includes('27 Nov'),
      { timeout: 15000 },
    );
    const decOverviewText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      decOverviewText.includes('27 Nov') && decOverviewText.includes('27 Dec'),
      'Overview PRE_PAYDAY 12/2026 Daily Pacing chart must display cycle boundary dates "27 Nov" and "27 Dec"',
    );
    assert.ok(
      !decOverviewText.includes('Day 32') && !decOverviewText.includes('DAY 32'),
      'Overview PRE_PAYDAY Daily Pacing chart must not show generic "Day 32" axis label',
    );
    console.log(
      '  PASS [1/6]: User #1 consumer role hides Platform Admin, renders 8-hub Sidebar navigation, verifies 11/2026 ACTIVE (28 Oct–26 Nov) & 12/2026 PRE_PAYDAY (27 Nov–27 Dec), and eliminates AI-slop labels.',
    );

    // 3. Verify Trilingual Switcher (EN / ID / ZH) renders localized human terms with zero raw translation keys
    const expectedLocaleTerm: Record<'en' | 'id' | 'zh', string> = {
      en: 'Savings & Net Worth',
      id: 'Tabungan & Kekayaan',
      zh: '储蓄与净资产',
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
    console.log('  PASS [2/6]: Trilingual (EN / ID / ZH) DOM verification passed ("Savings & Net Worth" / "Tabungan & Kekayaan" / "储蓄与净资产").');

    // 4. Verify Consolidated 8-Hub Routes & Legacy Zero-404 Redirects
    const routeChecks: Array<{ path: string; expectedSubstring: string }> = [
      { path: '/payday-wizard?month=11&year=2026', expectedSubstring: 'Paycycle Activation Checklist' },
      { path: '/calendar?month=11&year=2026', expectedSubstring: 'Lowest Cash Point' },
      { path: '/calendar?month=4&year=2027', expectedSubstring: 'Lowest Cash Point' },
      { path: '/credit?sub=contracts&month=11&year=2026', expectedSubstring: 'Active Installment Plans' },
      { path: '/credit?sub=commitments&month=11&year=2026', expectedSubstring: 'One-Off Commitments' },
      { path: '/credit?sub=simulator&month=11&year=2026', expectedSubstring: 'Wishlist' },
      { path: '/allocations?sub=events&month=11&year=2026', expectedSubstring: 'Trip & Event Budget Planner' },
      { path: '/import?month=11&year=2026', expectedSubstring: 'Statement Import' },
      { path: '/scenarios?month=11&year=2026', expectedSubstring: 'What-If Scenario Lab' },
      { path: '/savings?sub=pockets&month=11&year=2026', expectedSubstring: 'Savings Pockets' },
      { path: '/reports?sub=executive&month=12&year=2026', expectedSubstring: 'Where Your Money Went' },
      { path: '/analytics', expectedSubstring: 'Month-to-Month Comparison' },
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
    assert.ok(
      adminConsoleText.includes('Permissive') || adminConsoleText.includes('Strict'),
      '/admin IP Whitelist KPI must display Title Case "Permissive" or "Strict"',
    );
    assert.ok(
      !/\b(PERMISSIVE|STRICT)\b/.test(adminConsoleText),
      '/admin must not render uppercase PERMISSIVE/STRICT KPI text',
    );
    const adminTableCheck = await page.evaluate(() => {
      const tbl = document.querySelector('table');
      if (!tbl) return { ok: false, reason: 'No users table rendered' };
      const actionBtns = Array.from(tbl.querySelectorAll('tbody tr:first-child button'));
      const lastBtn = actionBtns[actionBtns.length - 1] as HTMLElement | undefined;
      if (!lastBtn) return { ok: false, reason: 'No action buttons in first user row' };
      const rect = lastBtn.getBoundingClientRect();
      return {
        ok: rect.right <= window.innerWidth && rect.width > 0,
        right: rect.right,
        innerWidth: window.innerWidth,
      };
    });
    assert.equal(
      adminTableCheck.ok,
      true,
      `/admin Users Actions column must fit cleanly on desktop without right clipping: ${JSON.stringify(adminTableCheck)}`,
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
      '  PASS [6/8]: Auth routes (/login, /forgot-password, /reset-password), US Standard Sandbox workspace, and Superadmin Console verified.',
    );

    // 7. Single Privacy Eye, Monogram Account Popover Menu, Zero CAPSLOCK Header/Overview, Marquee Greeting & Scenarios Go Workbench
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
      u1.token,
      u1.user,
    );
    await page.goto(`${WEB_URL}/?month=11&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('#account-menu-trigger', { timeout: 15000 });
    await page.waitForSelector('[data-testid="cycle-pace-breakdown"]', { timeout: 10000 });
    await page.waitForSelector('[data-testid="cycle-allocation-mix"]', { timeout: 10000 });

    const headerAudit = await page.evaluate(() => {
      const eyeBtns = document.querySelectorAll(
        'button[aria-label="Hide amounts"], button[aria-label="Show amounts"]',
      );
      const eyeInAside = Boolean(
        document.querySelector('aside button[aria-label="Hide amounts"], aside button[aria-label="Show amounts"]'),
      );
      const eyeInHeader = Boolean(
        document.querySelector('header button[aria-label="Hide amounts"], header button[aria-label="Show amounts"]'),
      );
      const acctBtn = document.getElementById('account-menu-trigger');
      const acctTriggerText = acctBtn?.textContent?.trim() ?? '';
      acctBtn?.click();
      const pop = document.getElementById('account-menu-popover');
      const popText = pop?.innerText ?? '';
      acctBtn?.click();

      const bodyText = document.body.innerText;
      return {
        eyeCount: eyeBtns.length,
        eyeInAside,
        eyeInHeader,
        hasPaceBreakdown: Boolean(document.querySelector('[data-testid="cycle-pace-breakdown"]')),
        hasAllocMix: Boolean(document.querySelector('[data-testid="cycle-allocation-mix"]')),
        acctTriggerText,
        popText,
        hasAllCapsHeaderCopy:
          /SAFE-TO-SPEND TODAY|MONTHLY BUDGET OVERVIEW|PERSONAL ERP|BURNING FAST/.test(bodyText),
      };
    });
    assert.equal(headerAudit.eyeCount, 1, `Expected exactly 1 Privacy Eye button on Overview, got ${headerAudit.eyeCount}`);
    assert.equal(headerAudit.eyeInAside, true, 'Single Privacy Eye button must sit in Sidebar aside');
    assert.equal(headerAudit.eyeInHeader, false, 'Top header must not contain Privacy Eye button');

    await page.click('#locale-menu-trigger');
    await page.waitForFunction(
      () => Boolean(document.getElementById('locale-menu-popover')?.matches(':popover-open')),
      { timeout: 5000 },
    );
    await page.click('#locale-menu-trigger');
    await page.waitForFunction(
      () => !document.getElementById('locale-menu-popover')?.matches(':popover-open'),
      { timeout: 5000 },
    );

    assert.equal(headerAudit.hasPaceBreakdown, true, 'Overview Col 1 must render Cycle Pace & Burn Forecast');
    assert.equal(headerAudit.hasAllocMix, true, 'Overview Col 2 must render Cycle Allocation Mix');
    assert.ok(
      headerAudit.acctTriggerText.length > 0 && headerAudit.acctTriggerText.length <= 3,
      `Account trigger must be icon-only monogram, got "${headerAudit.acctTriggerText}"`,
    );
    assert.ok(!headerAudit.popText.includes('Privacy Stealth'), 'Account menu must not show Privacy Stealth');
    assert.ok(!headerAudit.popText.includes('Switch Account'), 'Account menu must not show Switch Account');
    assert.ok(!headerAudit.hasAllCapsHeaderCopy, 'Overview must not show CAPSLOCK header strings');

    // Verify Privacy Mask Edit Guard blocks edit modal when masked and reveals via Toast CTA -> VerifyPasswordModal
    await page.waitForFunction(() => document.body.innerText.includes('Rp •••••'), { timeout: 5000 });
    await page.click('button[aria-label="Revise Self-Reward target"]');
    await page.waitForFunction(
      () => Boolean(document.querySelector('.erp-toast-viewport')?.matches(':popover-open')),
      { timeout: 5000 },
    );
    const guardAudit = await page.evaluate(() => {
      const toastText = (document.querySelector('.erp-toast-viewport') as HTMLElement | null)?.innerText ?? '';
      const hasModal = Boolean(document.querySelector('[aria-labelledby="modal-title"]'));
      return { toastText, hasModal };
    });
    assert.ok(
      guardAudit.toastText.includes('Balances are hidden') && guardAudit.toastText.includes('Reveal Balances'),
      `Masked edit must trigger Privacy Guard toast with Reveal Balances action, got "${guardAudit.toastText}"`,
    );
    assert.equal(guardAudit.hasModal, false, 'Masked edit must block opening Budget Revision Modal');
    await page.click('.erp-toast-viewport button:not([aria-label="Dismiss notification"])');
    await page.waitForSelector('input[type="password"][placeholder="Enter password"]', { timeout: 5000 });
    await page.type('input[type="password"][placeholder="Enter password"]', 'Djakarta2026Nov!@#');
    await page.click('form:has(input[placeholder="Enter password"]) button[type="submit"]');
    await page.waitForFunction(() => !document.body.innerText.includes('Rp •••••'), { timeout: 15000 });

    // Verify custom ErpDatePicker (toggle + #main-content scroll anchor/dismiss), Title Case cycle label, and zero Marquee orb collision on PayLater tab
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const paylaterTab = buttons.find((b) => b.textContent?.trim() === 'PayLater');
      (paylaterTab as HTMLElement | undefined)?.click();
    });
    await page.waitForSelector('[data-testid="erp-date-picker-trigger"]', { timeout: 10000 });
    await page.click('[data-testid="erp-date-picker-trigger"]');
    await page.waitForFunction(
      () => Boolean(document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]')?.matches(':popover-open')),
      { timeout: 5000 },
    );

    const paylaterAudit = await page.evaluate(() => {
      const rawDateInputs = document.querySelectorAll('input[type="date"]').length;
      const datePop = document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]') as HTMLElement | null;
      const datePopOpen = Boolean(datePop?.matches(':popover-open'));
      const submitBtn = document.querySelector('[data-testid="record-expense-submit"]') as HTMLElement | null;
      const marqueeOrb = document.querySelector('[data-testid="marquee-floating-launcher"]') as HTMLElement | null;
      const rSub = submitBtn?.getBoundingClientRect();
      const rOrb = marqueeOrb?.getBoundingClientRect();
      const overlaps =
        rSub && rOrb
          ? !(rSub.right < rOrb.left || rSub.left > rOrb.right || rSub.bottom < rOrb.top || rSub.top > rOrb.bottom)
          : false;
      const bodyText = document.body.innerText;
      return {
        rawDateInputs,
        datePopOpen,
        overlaps,
        hasUppercaseDec26: /\bDEC\s+'26\b/.test(bodyText),
      };
    });
    await page.click('[data-testid="erp-date-picker-trigger"]');
    await page.waitForFunction(
      () => !document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]')?.matches(':popover-open'),
      { timeout: 5000 },
    );
    await page.click('[data-testid="erp-date-picker-trigger"]');
    await page.waitForFunction(
      () => Boolean(document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]')?.matches(':popover-open')),
      { timeout: 5000 },
    );
    const beforeTop = await page.evaluate(() => {
      const pop = document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]') as HTMLElement | null;
      return pop ? pop.getBoundingClientRect().top : -1;
    });
    await page.evaluate(() => {
      const mainEl = document.getElementById('main-content');
      if (mainEl) mainEl.scrollTop += 120;
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    const scrollTrackAudit = await page.evaluate(() => {
      const pop = document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]') as HTMLElement | null;
      return {
        isOpen: Boolean(pop?.matches(':popover-open')),
        afterTop: pop ? pop.getBoundingClientRect().top : -1,
      };
    });
    assert.ok(
      !scrollTrackAudit.isOpen || Math.abs(scrollTrackAudit.afterTop - beforeTop) > 40,
      `ErpDatePicker must track #main-content scroll or dismiss cleanly (before=${beforeTop}, after=${scrollTrackAudit.afterTop})`,
    );
    await page.evaluate(() => {
      const mainEl = document.getElementById('main-content');
      if (mainEl) mainEl.scrollTop = 1000;
    });
    await page.waitForFunction(
      () => !document.querySelector('.erp-popover-panel[aria-label="Purchase Date"]')?.matches(':popover-open'),
      { timeout: 5000 },
    );
    await page.evaluate(() => {
      const mainEl = document.getElementById('main-content');
      if (mainEl) mainEl.scrollTop = 0;
    });
    assert.equal(paylaterAudit.rawDateInputs, 0, 'Overview DOM must have zero native <input type="date">');
    assert.equal(paylaterAudit.datePopOpen, true, 'ErpDatePicker trigger must open top-layer calendar popover');
    assert.equal(paylaterAudit.overlaps, false, 'Marquee launcher orb must not overlap + Record Expense button');
    assert.equal(paylaterAudit.hasUppercaseDec26, false, 'PayLater billing preview must use Title Case (Dec 2026), not DEC \'26');

    // Verify /marquee "hi" responds cleanly with zero model/Tier leaks
    await page.goto(`${WEB_URL}/marquee`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('input[type="text"]', { timeout: 15000 });
    await page.type('input[type="text"]', 'hi');
    await page.keyboard.press('Enter');
    await page.waitForFunction(
      () =>
        !document.body.innerText.includes('Choose a command below') &&
        !document.body.innerText.includes('Running...') &&
        document.body.innerText.includes('Marquee'),
      { timeout: 25000 },
    );
    const marqueeUiText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !/Gemini 3\.8|DeepSeek-V|Llama 3\.3|Tier 1|Tier 2|Provider:|deepseek-flash/i.test(marqueeUiText),
      'Marquee UI must not leak internal model/provider/Tier strings',
    );

    // Verify /scenarios renders Monte Carlo Stress Test & Surplus Allocation Frontier without 999m target
    await page.goto(`${WEB_URL}/scenarios?month=11&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(
      () =>
        document.body.innerText.includes('12-Month Survival Rate') &&
        document.body.innerText.includes('Surplus Allocation Frontier'),
      { timeout: 20000 },
    );
    const scenariosText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !scenariosText.includes('999m target'),
      '/scenarios must not display raw "999m target" placeholder',
    );

    // Verify /calendar filter bar placement, zero Priority 1 copy, and /payroll Dec 2026 THR accuracy
    await page.goto(`${WEB_URL}/calendar?month=11&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('[role="tablist"][aria-label="Calendar activity filter"]', { timeout: 15000 });
    const calendarAudit = await page.evaluate(() => ({
      hasFilterTablist: Boolean(document.querySelector('[role="tablist"][aria-label="Calendar activity filter"]')),
      hasPriority1Copy: /Priority 1/i.test(document.body.innerText),
      duplicateStepperInMain: document.querySelectorAll('main button[aria-label="Previous month"], main button[aria-label="Next month"]').length,
    }));
    assert.equal(calendarAudit.hasFilterTablist, true, '/calendar must render activity filter tablist below KPI cards');
    assert.equal(calendarAudit.hasPriority1Copy, false, '/calendar must not render legacy "Priority 1" copy');
    assert.equal(calendarAudit.duplicateStepperInMain, 0, '/calendar main area must not duplicate global header month stepper');

    await page.goto(`${WEB_URL}/payroll?month=12&year=2026`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.body.innerText.includes('3.833.425'), { timeout: 15000 });
    const payrollAudit = await page.evaluate(() => ({
      hasExactDecThr: document.body.innerText.includes('3.833.425'),
      hasDriftedDecThr: document.body.innerText.includes('3.833.667'),
    }));
    assert.equal(payrollAudit.hasExactDecThr, true, '/payroll Dec 2026 must display exact Rp 3.833.425 THR');
    assert.equal(payrollAudit.hasDriftedDecThr, false, '/payroll Dec 2026 must not drift to Rp 3.833.667');

    console.log(
      '  PASS [7/8]: Privacy Mask guard, popover toggle/scroll, /calendar trajectory & filter bar, /payroll Dec THR, Marquee, and /scenarios verified.',
    );

    // 8. Demo Sandbox Realtime Cross-Route Reactivity Check (PayLater on / -> Sidebar link -> /credit without reload)
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
    try {
      await page.waitForSelector('input[placeholder*="Lunch"]', { timeout: 15000 });
      const clickedPayLater = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === 'PayLater',
        );
        if (!btn) return false;
        btn.click();
        return true;
      });
      assert.equal(clickedPayLater, true, 'Demo Sandbox / must render PayLater payment method button');

      await page.waitForFunction(
        () => Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.trim() === '3x'),
        { timeout: 5000 },
      );
      await page.evaluate(() => {
        const btn3x = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '3x',
        );
        btn3x?.click();
      });

      await page.type('input[placeholder*="Lunch"]', 'QA Realtime PayLater Sync');
      const amtInput = await page.$('input[placeholder="Amount"]');
      assert.ok(amtInput, 'Amount input must exist');
      await amtInput!.click({ clickCount: 3 });
      await amtInput!.type('120000');

      const [postRes] = await Promise.all([
        page.waitForResponse(
          (res) =>
            res.url().includes('/api/finance/transactions') &&
            res.request().method() === 'POST',
          { timeout: 15000 },
        ),
        page.click('button[data-testid="record-expense-submit"]'),
      ]);
      assert.ok(
        postRes.status() === 200 || postRes.status() === 201,
        `Expected POST /api/finance/transactions to return 200/201, got ${postRes.status()}`,
      );

      // Client-side navigate via Sidebar link to /credit WITHOUT page.reload()
      const creditNavLink = await page.$('aside a[href*="/credit"]');
      assert.ok(creditNavLink, 'Sidebar link to /credit must exist');
      await creditNavLink!.click();
      await page.waitForFunction(() => window.location.pathname === '/credit', { timeout: 15000 });

      await page.waitForFunction(
        () =>
          Array.from(document.querySelectorAll('button')).some((b) =>
            b.textContent?.includes('Payoff & Cutoff Check'),
          ),
        { timeout: 20000 },
      );
      await page.evaluate(() => {
        const simTab = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('Payoff & Cutoff Check'),
        );
        (simTab as HTMLElement | undefined)?.click();
      });

      await page.waitForFunction(
        () =>
          window.location.pathname === '/credit' &&
          document.body.innerText.includes('QA Realtime PayLater Sync'),
        { timeout: 15000 },
      );
      console.log('  PASS [8/8]: Realtime cross-route reactivity verified (/ PayLater 3x -> /credit simulator without hard reload).');
    } finally {
      // Clean up Demo Sandbox even if assertions fail
      await page.evaluate(async (apiUrl, token) => {
        await fetch(`${apiUrl}/api/auth/reset-demo`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
      }, API_URL, demoBody.accessToken);
    }

    assert.equal(pageErrors.length, 0, `Uncaught pageerrors during E2E: ${pageErrors.join(' | ')}`);
    assert.equal(consoleErrors.length, 0, `Console errors during E2E: ${consoleErrors.join(' | ')}`);
    assert.equal(httpErrors.length, 0, `Unexpected HTTP >= 400 API responses during E2E: ${httpErrors.join(' | ')}`);

    console.log('  PASS [ALL]: Full Headless DOM & UX Flow E2E completed with 0 console/HTTP/layout defects.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nUX FLOW E2E FAILED:', err);
  process.exit(1);
});
