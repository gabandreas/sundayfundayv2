const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\LENOVO\\.gemini\\antigravity-ide\\brain\\07b88f30-96f1-4c2f-8167-7229b62fa594';

async function main() {
  const puppeteer = await import('puppeteer-core');
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,960'],
    defaultViewport: { width: 1440, height: 960 },
  });

  const page = await browser.newPage();

  console.log('Navigating to September 2026 Overview...');
  await page.goto('http://localhost:3000/?month=9&year=2026', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1500));

  // Scroll to Cashflow Summary & Recent Transactions
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('CASHFLOW SUMMARY'));
    if (el) {
      el.scrollIntoView({ block: 'center' });
    }
  });
  await new Promise((r) => setTimeout(r, 800));

  const shotSepCashflowPath = path.join(ARTIFACT_DIR, 'september_2026_overview_synced.png');
  await page.screenshot({ path: shotSepCashflowPath, fullPage: false });
  console.log('Saved September 2026 Overview screenshot:', shotSepCashflowPath);

  // Full page screenshot of September 2026 Overview
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise((r) => setTimeout(r, 500));
  const shotSepFullPath = path.join(ARTIFACT_DIR, 'september_2026_overview_full.png');
  await page.screenshot({ path: shotSepFullPath, fullPage: true });
  console.log('Saved September 2026 Overview full screenshot:', shotSepFullPath);

  await browser.close();
  console.log('Screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
