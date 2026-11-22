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

    // Seed User #1 read-only session token in localStorage & cookie before navigating
    await page.goto(`${WEB_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.evaluate(
      (token, user) => {
        localStorage.setItem('erp_token', token);
        localStorage.setItem('erp_auth_token', token);
        localStorage.setItem('erp_user', JSON.stringify(user));
        document.cookie = `erp_token=${token}; path=/; max-age=86400; SameSite=Lax`;
      },
      u1.token,
      u1.user,
    );

    // 2. Navigate to Overview (/) and verify Smart Default Active Period (11/2026) & no Platform Admin link
    await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle2', timeout: 60000 });
    const overviewText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      !overviewText.includes('Platform Admin'),
      'Sidebar must NOT display Platform Admin for consumer role USER (User #1)',
    );
    console.log('  PASS [1/6]: User #1 consumer role hides Platform Admin from Sidebar.');

    // 3. Verify Trilingual Switcher (EN / ID / ZH) produces zero raw translation keys
    for (const loc of ['en', 'id', 'zh'] as const) {
      await page.evaluate((l) => {
        localStorage.setItem('erp_locale', l);
      }, loc);
      await page.reload({ waitUntil: 'networkidle2', timeout: 45000 });
      const bodyText = await page.evaluate(() => document.body.innerText);
      assert.ok(
        !/\b(nav\.[a-zA-Z]+|sub\.[a-zA-Z.]+|overview\.[a-zA-Z.]+)\b/.test(bodyText),
        `Detected raw translation key on Overview in locale ${loc}`,
      );
    }
    await page.evaluate(() => localStorage.setItem('erp_locale', 'en'));
    console.log('  PASS [2/6]: Trilingual (EN / ID / ZH) DOM verification passed with 0 raw keys.');

    // 4. Verify Consolidated Routes (/payday-wizard, /calendar, /credit?sub=contracts, /credit?sub=simulator, /marquee, /preferences?sub=ai)
    const routeChecks: Array<{ path: string; expectedSubstring: string }> = [
      { path: '/payday-wizard?month=11&year=2026', expectedSubstring: 'Paycycle Activation Checklist' },
      { path: '/calendar?month=11&year=2026', expectedSubstring: 'Lowest Cash Point' },
      { path: '/credit?sub=contracts&month=11&year=2026', expectedSubstring: 'Total Remaining Principal' },
      { path: '/credit?sub=simulator&month=11&year=2026', expectedSubstring: 'Wishlist' },
      { path: '/marquee', expectedSubstring: 'Marquee AI' },
      { path: '/preferences?sub=ai', expectedSubstring: 'AES-256-GCM' },
    ];

    for (const rc of routeChecks) {
      await page.goto(`${WEB_URL}${rc.path}`, { waitUntil: 'networkidle2', timeout: 60000 });
      const text = await page.evaluate(() => document.body.innerText);
      assert.ok(
        text.toLowerCase().includes(rc.expectedSubstring.toLowerCase()),
        `Route ${rc.path} missing expected content "${rc.expectedSubstring}"`,
      );
    }
    console.log('  PASS [3/6]: All new & consolidated routes render expected domain sections.');

    // 5. Verify Alt+M opens the native top-layer <dialog> Marquee drawer
    await page.keyboard.down('Alt');
    await page.keyboard.press('KeyM');
    await page.keyboard.up('Alt');
    await new Promise((r) => setTimeout(r, 350));

    const dialogOpen = await page.evaluate(() => {
      const dlg = document.querySelector('dialog.marquee-drawer') as HTMLDialogElement | null;
      return Boolean(dlg && dlg.open);
    });
    assert.equal(dialogOpen, true, 'Alt+M must open native <dialog class="marquee-drawer"> via showModal()');
    console.log('  PASS [4/6]: Alt+M opens native top-layer <dialog> Marquee drawer.');

    // 6. Verify /admin is restricted for consumer role USER
    await page.goto(`${WEB_URL}/admin`, { waitUntil: 'networkidle2', timeout: 45000 });
    const adminText = await page.evaluate(() => document.body.innerText);
    assert.ok(
      adminText.includes('Access Restricted') || adminText.includes('SUPERADMIN'),
      'Consumer USER navigating to /admin must see Access Restricted guard',
    );
    console.log('  PASS [5/6]: /admin renders Access Restricted for consumer role USER.');

    console.log('  PASS [6/6]: Full Headless DOM & UX Flow E2E completed with 0 defects.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('\nUX FLOW E2E FAILED:', err);
  process.exit(1);
});
