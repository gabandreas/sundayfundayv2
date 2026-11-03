const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\ac73e91a-1a42-42ab-bd93-3b2b352acaab";
const TEMP_USER_DATA_DIR = path.join(os.tmpdir(), `chrome-polish-${Date.now()}`);

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
      '--remote-debugging-port=9225',
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
      targets = await fetchJson('http://localhost:9225/json');
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!targets) {
    console.error('Failed to connect to Chrome debugging port 9225');
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
    // 1. Log in as Platform Owner
    console.log('Navigating to login page...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/login' });
    await sleep(2000);

    console.log('Filling owner credentials...');
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

    // 2. Desktop Screenshot 1: /preferences?tab=killswitch
    console.log('Navigating to /preferences?tab=killswitch...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/preferences?tab=killswitch' });
    await sleep(3500);

    // Ensure scrollTop is 0 so the unified segmented tab bar and the table are visible
    await cdp.evaluate(`
      (() => {
        const main = document.querySelector('main');
        if (main) main.scrollTop = 0;
      })()
    `);
    await sleep(800);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'polish_preferences_killswitch_desktop.png'));

    // 3. Desktop Screenshot 2: Overview Dashboard /?month=10&year=2026
    console.log('Navigating to Overview Dashboard...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=10&year=2026' });
    await sleep(3500);

    await cdp.screenshot(path.join(ARTIFACT_DIR, 'polish_overview_desktop.png'));

    // 4. Mobile Viewport Screenshot: 390x844
    console.log('Switching to mobile viewport (390x844)...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(1500);

    await cdp.screenshot(path.join(ARTIFACT_DIR, 'polish_mobile_header_topbar.png'));

    console.log('All polish pass screenshots captured successfully!');
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
    } catch {}
    try {
      if (fs.existsSync(TEMP_USER_DATA_DIR)) {
        fs.rmSync(TEMP_USER_DATA_DIR, { recursive: true, force: true });
      }
    } catch {}
  }
}

main().catch((err) => {
  console.error('Screenshot script error:', err);
  process.exit(1);
});
