const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const ARTIFACT_DIR = "C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\07b88f30-96f1-4c2f-8167-7229b62fa594\\screenshots";

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
    this.events = [];
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
  console.log('Launching headless Chrome...');
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9222',
      '--window-size=1440,1080',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + path.join(__dirname, '../.chrome-user-data'),
    ],
    { stdio: 'ignore' }
  );

  // Wait for Chrome remote debugging port to be ready
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
  console.log(`Connecting to page target: ${pageTarget.webSocketDebuggerUrl}`);

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.on('open', resolve));

  const cdp = new CDPClient(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log('\n--- 1. Testing Part 2: Current Button & MiniTrendChart (Zero NaN warnings) ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=7&year=2026' });
  await sleep(2500);

  // Click the "Current" button
  const currentClicked = await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const currentBtn = btns.find(b => b.textContent && b.textContent.includes('Current'));
      if (currentBtn) {
        currentBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`Clicked "Current" button: ${currentClicked}`);
  await sleep(2500);

  // Check for NaN console warnings/errors
  const nanWarnings = cdp.consoleLogs.filter((l) => l.text.includes('NaN') || l.text.includes('MiniTrendChart'));
  console.log(`NaN warnings/errors detected after clicking "Current": ${nanWarnings.length}`);
  if (nanWarnings.length > 0) {
    console.log(nanWarnings);
  } else {
    console.log('CONFIRMED: Zero NaN warnings or MiniTrendChart errors!');
  }

  // Also test navigating to a period without snapshot (lazy creation)
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=1&year=2028' });
  await sleep(2500);
  const nanWarningsLazy = cdp.consoleLogs.filter((l) => l.text.includes('NaN') || l.text.includes('MiniTrendChart'));
  console.log(`NaN warnings for lazily-created period (1/2028): ${nanWarningsLazy.length}`);

  // Screenshot 1: Overview page after "Current" button
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/?month=8&year=2026' });
  await sleep(2500);
  const shot1 = path.join(ARTIFACT_DIR, 'item1_overview_current_pacing.png');
  await cdp.screenshot(shot1);

  console.log('\n--- 2. Testing Part B & Part 1: Distinct PayLater and Personal Debt Rows ---');
  // Confirm both rows exist
  const rows = await cdp.evaluate(`
    (() => {
      const text = document.body.innerText;
      const hasPayLater = text.includes('PayLater Bill');
      const hasPersonalDebt = text.includes('Personal & Informal Debt');
      return { hasPayLater, hasPersonalDebt };
    })()
  `);
  console.log('Transaction rows on August 2026 Overview:', rows);
  const shot2 = path.join(ARTIFACT_DIR, 'item2_distinct_paylater_personal_debt.png');
  await cdp.screenshot(shot2);

  console.log('\n--- 3. Testing Part C: Budget Revision Live Preview ---');
  // Click edit pencil on Daily Operational Target
  const openedModal = await cdp.evaluate(`
    (() => {
      const pencil = document.querySelector('button[aria-label="Revise Daily Operational target"]');
      if (pencil) {
        pencil.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`Opened Budget Revision Modal: ${openedModal}`);
  await sleep(1000);

  // Type 2500000 into the input using React value setter
  await cdp.evaluate(`
    (() => {
      const input = document.getElementById('new-target-input');
      if (input) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        nativeSetter.call(input, '2500000');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    })()
  `);
  console.log('Entered 2500000 into new target amount input');
  // Wait 1500ms for 400ms debounce + API call
  await sleep(1500);

  const previewText = await cdp.evaluate(`
    (() => {
      const previewBox = document.querySelector('[role="dialog"]');
      return previewBox ? previewBox.innerText : null;
    })()
  `);
  console.log('Modal text content with live preview:\n', previewText?.slice(0, 300));
  const shot3 = path.join(ARTIFACT_DIR, 'item3_budget_revision_live_preview.png');
  await cdp.screenshot(shot3);

  // Close modal
  await cdp.evaluate(`
    (() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    })()
  `);
  await sleep(500);

  console.log('\n--- 4. Testing Part A: Payroll Form Reset on Period Switch ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/payroll?month=8&year=2026' });
  await sleep(2500);

  const augCafeteria = await cdp.evaluate(`
    (() => {
      const input = document.getElementById('cafeteria-input');
      return input ? input.value : null;
    })()
  `);
  console.log(`August Cafeteria Deduction value: ${augCafeteria}`);

  // Switch to September using select
  await cdp.evaluate(`
    (() => {
      const select = document.querySelector('select[aria-label="Select month"]');
      if (select) {
        select.value = '9';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    })()
  `);
  console.log('Switched month selector to September (9)...');
  await sleep(2500);

  const sepCafeteria = await cdp.evaluate(`
    (() => {
      const input = document.getElementById('cafeteria-input');
      return input ? input.value : null;
    })()
  `);
  console.log(`September Cafeteria Deduction value after switch: ${sepCafeteria} (Expected: 0)`);
  const shot4 = path.join(ARTIFACT_DIR, 'item4_payroll_form_reset_september.png');
  await cdp.screenshot(shot4);

  console.log('\nCleaning up Chrome...');
  ws.close();
  chromeProcess.kill();
  console.log('Verification completed successfully!');
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
