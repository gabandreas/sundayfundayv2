const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\ac73e91a-1a42-42ab-bd93-3b2b352acaab";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleLogs = [];

    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method) {
        if (data.method === 'Runtime.consoleAPICalled') {
          const text = data.params.args.map((a) => a.value || a.description || '').join(' ');
          this.consoleLogs.push({ type: data.params.type, text });
        } else if (data.method === 'Runtime.exceptionThrown') {
          this.consoleLogs.push({
            type: 'error',
            text: data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''),
          });
        }
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async screenshot(filePath) {
    const { data } = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  const tmpProfile = path.join(__dirname, '..', '.chrome-tmp-' + Date.now());
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${tmpProfile}`,
      '--no-first-run',
      '--disable-gpu',
      '--window-size=1440,950',
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      targets = await fetchJson('http://localhost:9222/json');
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!targets) {
    console.error('Failed to connect to Chrome debugging port 9222');
    chromeProcess.kill();
    process.exit(1);
  }

  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  try {
    // 1. Savings Page with WealthTargetPlannerCard & Linked Wishlist
    console.log('\n--- 1. Capturing Savings with Wealth Target Planner (/savings?month=10&year=2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/savings?month=10&year=2026' });
    await sleep(3500);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'savings_wealth_planner.png'));

    // 2. Ledger with 4-Tab Unified Money Movement & Daily Spend Banner
    console.log('\n--- 2. Capturing Ledger Unified Movement (/ledger?month=10&year=2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/ledger?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'ledger_unified_movement.png'));

    // 3. Wishlist with Track as Savings Goal controls
    console.log('\n--- 3. Capturing Wishlist (/wishlist) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/wishlist' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'wishlist_savings_linkage.png'));

    // 4. Overview locked period with Reopen Period button (08/2026)
    console.log('\n--- 4. Capturing Overview Reopen Period (08/2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=8&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'overview_reopen_period.png'));

    // 5. Overview active period with Auto-close badge (10/2026)
    console.log('\n--- 5. Capturing Overview Active Period (10/2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'overview_active_autoclose.png'));

    // 6. Preferences Tab 4: Policy & Auto-Close Engine
    console.log('\n--- 6. Capturing Preferences Policy & Auto-Close (/preferences?tab=policy) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/preferences?tab=policy' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'preferences_autoclose.png'));

    console.log('\nAll phase 4 verification screenshots captured successfully!');
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
      fs.rmSync(tmpProfile, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
