const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\ac73e91a-1a42-42ab-bd93-3b2b352acaab";
const TEMP_USER_DATA_DIR = path.join(os.tmpdir(), `chrome-p10-${Date.now()}`);

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

    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
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

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot: ${filePath}`);
  }
}

async function main() {
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  console.log('Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--window-size=1440,1100',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `--user-data-dir=${TEMP_USER_DATA_DIR}`,
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

  // Listen to console and exceptions
  const consoleMessages = [];
  ws.on('message', (msg) => {
    try {
      const d = JSON.parse(msg.toString());
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value !== undefined ? a.value : (a.description || '')).join(' ');
        consoleMessages.push(`[${d.params.type}] ${text}`);
      } else if (d.method === 'Runtime.exceptionThrown') {
        consoleMessages.push(`[EXCEPTION] ${JSON.stringify(d.params.exceptionDetails)}`);
      }
    } catch {}
  });

  try {
    // 1. Log in as Platform Owner
    console.log('Navigating to login page...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/login' });
    await sleep(2000);

    console.log('Filling owner login credentials...');
    await cdp.evaluate(`
      (() => {
        const emailInput = document.querySelector('input[type="email"]');
        const passInput = document.querySelector('input[type="password"]');
        if (emailInput && passInput) {
          emailInput.value = 'owner@sundayfunday.id';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
          passInput.value = 'SundayFunday#2026';
          passInput.dispatchEvent(new Event('input', { bubbles: true }));
          const submitBtn = document.querySelector('button[type="submit"]');
          if (submitBtn) submitBtn.click();
        }
      })()
    `);
    await sleep(3000);

    // 2. Navigate to /admin (Tab 4: Security, IP Whitelist & Backup)
    console.log('Navigating to /admin...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/admin' });
    await sleep(3000);

    // Click Tab 4 "Security, IP Whitelist & Backup"
    console.log('Switching to Tab 4 (Security, IP Whitelist & Backup)...');
    await cdp.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const securityTab = buttons.find(b => b.textContent && b.textContent.includes('Security'));
        if (securityTab) securityTab.click();
      })()
    `);
    await sleep(2500);

    // Inspect Next.js dev overlay issues
    const overlayReport = await cdp.evaluate(`
      (() => {
        const portal = document.querySelector('nextjs-portal');
        if (portal && portal.shadowRoot) {
          return {
            shadowText: portal.shadowRoot.textContent,
            html: portal.shadowRoot.innerHTML
          };
        }
        return { shadowText: 'No portal found', html: '' };
      })()
    `);
    console.log('--- NEXTJS OVERLAY REPORT ---');
    console.log(overlayReport);
    console.log('--- CONSOLE MESSAGES ON /ADMIN ---');
    console.log(consoleMessages.join('\\n'));

    await cdp.screenshot(path.join(ARTIFACT_DIR, 'phase10_admin_tab4_backup_restore.png'));

    // 3. Mobile Viewport (390x844) Overview Dashboard
    console.log('Switching to mobile viewport (390x844)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(500);

    console.log('Navigating to Overview on mobile viewport...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=10&year=2026' });
    await sleep(3500);

    await cdp.screenshot(path.join(ARTIFACT_DIR, 'phase10_mobile_overview_390x844.png'));

    // Scroll down to show Record Expense and Routine Bills Quota cards on mobile
    console.log('Scrolling mobile viewport to show Record Expense quick logger...');
    await cdp.evaluate(`
      (() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 900;
        else window.scrollTo(0, 900);
      })()
    `);
    await sleep(1500);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'phase10_mobile_overview_scrolled.png'));

    console.log('Phase 10 screenshots captured successfully!');
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
    } catch {}
    // Clean up temporary user data directory
    try {
      if (fs.existsSync(TEMP_USER_DATA_DIR)) {
        fs.rmSync(TEMP_USER_DATA_DIR, { recursive: true, force: true });
        console.log('Cleaned up temp Chrome user data directory.');
      }
    } catch (e) {
      console.warn('Could not remove temp user data dir:', e.message);
    }
  }
}

main().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
