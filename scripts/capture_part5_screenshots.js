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
      '--user-data-dir=' + path.join(__dirname, '../.chrome-user-data-part5'),
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
    // 1. Overview Page (10/2026)
    console.log('\n--- 1. Capturing Overview (10/2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'overview_10_2026.png'));

    // 2. Savings Page (10/2026)
    console.log('\n--- 2. Capturing Savings (/savings?month=10&year=2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/savings?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'savings_overview.png'));

    // 3. Credits Page (/credit?month=10&year=2026)
    console.log('\n--- 3. Capturing Credits (/credit?month=10&year=2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/credit?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'credits_subscriptions.png'));

    // 4. Payroll Page (10/2026)
    console.log('\n--- 4. Capturing Payroll (10/2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/payroll?month=10&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'payroll_october_rates.png'));

    // 5. Payroll Page (12/2026) for December Pro-Rated THR
    console.log('\n--- 5. Capturing Payroll (12/2026) ---');
    await cdp.send('Page.navigate', { url: 'http://localhost:3000/payroll?month=12&year=2026' });
    await sleep(3000);
    await cdp.screenshot(path.join(ARTIFACT_DIR, 'payroll_december_thr.png'));

    console.log('\nAll verification screenshots captured successfully!');
  } finally {
    try {
      ws.close();
      chromeProcess.kill();
    } catch {}
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
