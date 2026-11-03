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

  // 1. Payroll Page: Actual Payroll Payout Date Field
  console.log('Navigating to Payroll page (August 2026)...');
  await page.goto('http://localhost:3000/payroll?month=8&year=2026', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const shotPayrollPath = path.join(ARTIFACT_DIR, 'payroll_payout_date_input.png');
  await page.screenshot({ path: shotPayrollPath, fullPage: false });
  console.log('Saved Payroll page screenshot:', shotPayrollPath);

  // 2. Overview Page: August 2026 Daily Pacing Engine (31-day cycle, 25 Aug – 24 Sep 2026)
  console.log('Navigating to August 2026 Overview...');
  await page.goto('http://localhost:3000/?month=8&year=2026', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const shotAugPath = path.join(ARTIFACT_DIR, 'august_2026_pacing_31_days.png');
  await page.screenshot({ path: shotAugPath, fullPage: false });
  console.log('Saved August 2026 pacing screenshot:', shotAugPath);

  // 3. Overview Page: Cashflow Summary Card with Date Range Label
  console.log('Capturing Cashflow Summary Card on August 2026...');
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('span')).find(s => s.textContent.includes('CASHFLOW SUMMARY'));
    if (el) {
      el.scrollIntoView({ block: 'center' });
    } else {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 400;
    }
  });
  await new Promise((r) => setTimeout(r, 600));
  const shotCashflowPath = path.join(ARTIFACT_DIR, 'cashflow_summary_date_range_label.png');
  await page.screenshot({ path: shotCashflowPath, fullPage: false });
  console.log('Saved Cashflow Summary screenshot:', shotCashflowPath);
  await page.evaluate(() => window.scrollTo(0, 0));

  // 4. Overview Page: September 2026 Daily Pacing Engine (30-day cycle, 25 Sep – 24 Oct 2026)
  console.log('Navigating to September 2026 Overview...');
  await page.goto('http://localhost:3000/?month=9&year=2026', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 1200));
  const shotSepPath = path.join(ARTIFACT_DIR, 'september_2026_pacing_30_days.png');
  await page.screenshot({ path: shotSepPath, fullPage: false });
  console.log('Saved September 2026 pacing screenshot:', shotSepPath);

  await browser.close();
  console.log('All 4 screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
