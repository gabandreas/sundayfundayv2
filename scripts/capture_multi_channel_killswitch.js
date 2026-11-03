const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const WebSocket = require('ws');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity\\brain\\ac73e91a-1a42-42ab-bd93-3b2b352acaab";
const TEMP_USER_DATA_DIR = path.join(os.tmpdir(), `chrome-multi-ks-${Date.now()}`);

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
      '--remote-debugging-port=9224',
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
      targets = await fetchJson('http://localhost:9224/json');
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!targets) {
    console.error('Failed to connect to Chrome debugging port 9224');
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

    // 2. Navigate to /preferences?tab=killswitch
    console.log('Navigating to /preferences?tab=killswitch...');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/preferences?tab=killswitch' });
    await sleep(3500);

    // Capture top half: Stats + Card A + Card B Table with Calendar / Remind actions
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'killswitch_calendar_sync_table.png'));

    // 3. Scroll down to Card C: External Multi-Channel Dispatcher
    console.log('Scrolling to Card C: External Multi-Channel Dispatcher...');
    await cdp.evaluate(`
      (() => {
        const main = document.querySelector('main');
        if (main) {
          main.scrollTop = 900;
        } else {
          window.scrollBy({ top: 900, behavior: 'instant' });
        }
      })()
    `);
    await sleep(1500);

    // Fill sample values and click Save Channel Settings
    console.log('Filling channel settings inputs...');
    await cdp.evaluate(`
      (() => {
        const emailInput = document.querySelector('input[placeholder="e.g. your-email@gmail.com"]');
        const phoneInput = document.querySelector('input[placeholder="e.g. 6281234567890"]');
        if (emailInput) {
          emailInput.value = 'gabriel@example.com';
          emailInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (phoneInput) {
          phoneInput.value = '6281299998888';
          phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Save Channel Settings'));
        if (saveBtn) saveBtn.click();
      })()
    `);
    await sleep(2000);

    await cdp.screenshot(path.join(ARTIFACT_DIR, 'killswitch_external_channels_dispatcher.png'));

    console.log('Screenshots captured successfully!');
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
