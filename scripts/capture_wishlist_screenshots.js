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
    this.consoleLogs = [];

    ws.on('message', (msg) => {
      const data = JSON.parse(msg.toString());
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value || a.description || '').join(' ');
        this.consoleLogs.push({ type: data.params.type, text });
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
      '--remote-debugging-port=9223',
      '--window-size=1440,1050',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--user-data-dir=' + path.join(__dirname, '../.chrome-wishlist-data'),
    ],
    { stdio: 'ignore' }
  );

  let targets = null;
  for (let i = 0; i < 20; i++) {
    try {
      targets = await fetchJson('http://localhost:9223/json');
      break;
    } catch {
      await sleep(500);
    }
  }

  if (!targets) {
    console.error('Failed to connect to Chrome debugging port 9223');
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

  console.log('\n--- 1. Navigating to /wishlist?month=8&year=2026&tab=planner ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/wishlist?month=8&year=2026&tab=planner' });
  await sleep(2500);

  // Case 1: CASH Simulation (Keychron K2 Keyboard - 1.450.000)
  console.log('Filling form for CASH simulation...');
  await cdp.evaluate(`
    (() => {
      const setInput = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      setInput('item-name-input', 'Keychron K2 Wireless Keyboard');
      setInput('item-price-input', '1450000');

      // Click Cash vehicle button
      const btns = Array.from(document.querySelectorAll('button'));
      const cashBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Cash');
      if (cashBtn) cashBtn.click();
    })()
  `);
  await sleep(500);

  // Click Simulate Purchase button
  console.log('Clicking "Simulate Purchase"...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const simBtn = btns.find(b => b.textContent && b.textContent.includes('Simulate Purchase'));
      if (simBtn) simBtn.click();
    })()
  `);
  await sleep(1500);

  // Also save this item to Vault
  console.log('Saving Cash item to Vault...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent && b.textContent.includes('Save to Vault'));
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(1500);

  const shot1 = path.join(ARTIFACT_DIR, 'wishlist_1_cash_planner.png');
  await cdp.screenshot(shot1);

  // Case 2: INSTALLMENT Simulation (MacBook Pro M3 Max - 28.000.000, 12 months)
  console.log('\n--- 2. Filling form for INSTALLMENT simulation ---');
  await cdp.evaluate(`
    (() => {
      const setInput = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      setInput('item-name-input', 'MacBook Pro 16-inch M3 Max');
      setInput('item-price-input', '28000000');

      // Click Installment vehicle button
      const btns = Array.from(document.querySelectorAll('button'));
      const instBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Installment');
      if (instBtn) instBtn.click();
    })()
  `);
  await sleep(500);

  // Fill installment details
  await cdp.evaluate(`
    (() => {
      const setInput = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };
      const setSelect = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
          setter.call(el, val);
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
      };

      setInput('installment-provider', 'BCA Cicilan 0%');
      setSelect('installment-tenor', '12');
      setInput('installment-monthly-payment', '2333333');
    })()
  `);
  await sleep(500);

  console.log('Clicking "Simulate Purchase" for installment...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const simBtn = btns.find(b => b.textContent && b.textContent.includes('Simulate Purchase'));
      if (simBtn) simBtn.click();
    })()
  `);
  await sleep(1500);

  // Also save this installment item to Vault
  console.log('Saving Installment item to Vault...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent && b.textContent.includes('Save to Vault'));
      if (saveBtn) saveBtn.click();
    })()
  `);
  await sleep(1500);

  const shot2 = path.join(ARTIFACT_DIR, 'wishlist_2_installment_planner.png');
  await cdp.screenshot(shot2);

  // Case 3: Vault Tab with saved items
  console.log('\n--- 3. Navigating to Vault tab ---');
  await cdp.send('Page.navigate', { url: 'http://localhost:3000/wishlist?month=8&year=2026&tab=vault' });
  await sleep(2500);

  const shot3 = path.join(ARTIFACT_DIR, 'wishlist_3_vault_items.png');
  await cdp.screenshot(shot3);

  // Case 4: Open Convert to Contract Confirmation Modal
  console.log('\n--- 4. Opening Convert to Contract confirmation modal ---');
  const openedModal = await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const convertBtn = btns.find(b => b.textContent && b.textContent.includes('Convert'));
      if (convertBtn) {
        convertBtn.click();
        return true;
      }
      return false;
    })()
  `);
  console.log(`Opened Convert to Contract Modal: ${openedModal}`);
  await sleep(1000);

  const shot4 = path.join(ARTIFACT_DIR, 'wishlist_4_convert_contract_modal.png');
  await cdp.screenshot(shot4);

  console.log('\nCleaning up Chrome...');
  ws.close();
  chromeProcess.kill();
  console.log('Wishlist verification completed successfully!');
}

main().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
