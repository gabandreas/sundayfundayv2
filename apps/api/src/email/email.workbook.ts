import ExcelJS from 'exceljs';
import { ExecutiveReportPayload } from '../calculator/reports';

const IDR_FMT = '"Rp "#,##0;-"Rp "#,##0;"Rp "0';
const PCT_FMT = '0.0%';

const COLORS = {
  bannerBg: 'FF0F172A',
  bannerText: 'FFF8FAFC',
  sectionBg: 'FF1E293B',
  sectionText: 'FFF1F5F9',
  headerBg: 'FF334155',
  headerText: 'FFFFFFFF',
  totalBg: 'FFE2E8F0',
  zebraOdd: 'FFF8FAFC',
  zebraEven: 'FFFFFFFF',
  emeraldBg: 'FFECFDF5',
  emeraldInk: 'FF065F46',
  amberBg: 'FFFFFBEB',
  amberInk: 'FF92400E',
  roseBg: 'FFFFF1F2',
  roseInk: 'FF9F1239',
  gridBorder: 'FFCBD5E1',
  ink: 'FF0F172A',
};

function styleHeaderRow(row: ExcelJS.Row, colCount: number, leftCols: number[] = [1]) {
  row.height = 22;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.headerBg },
    };
    cell.font = { bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.alignment = {
      vertical: 'middle',
      horizontal: leftCols.includes(c) ? 'left' : 'right',
    };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.gridBorder } },
      bottom: { style: 'thin', color: { argb: COLORS.gridBorder } },
      left: { style: 'thin', color: { argb: COLORS.gridBorder } },
      right: { style: 'thin', color: { argb: COLORS.gridBorder } },
    };
  }
}

function addSectionHeading(ws: ExcelJS.Worksheet, colCount: number, label: string) {
  const r = ws.addRow([label]);
  ws.mergeCells(r.number, 1, r.number, colCount);
  r.height = 20;
  for (let c = 1; c <= colCount; c++) {
    const cell = r.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.sectionBg } };
    cell.font = { bold: true, color: { argb: COLORS.sectionText }, size: 10 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
}

function styleBanner(
  ws: ExcelJS.Worksheet,
  colCount: number,
  title: string,
  subtitle: string,
) {
  const r1 = ws.addRow([title]);
  ws.mergeCells(r1.number, 1, r1.number, colCount);
  r1.height = 26;
  for (let c = 1; c <= colCount; c++) {
    const cell = r1.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.bannerBg },
    };
    cell.font = { bold: true, color: { argb: COLORS.bannerText }, size: 13 };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
  }

  const r2 = ws.addRow([subtitle]);
  ws.mergeCells(r2.number, 1, r2.number, colCount);
  r2.height = 18;
  for (let c = 1; c <= colCount; c++) {
    const cell = r2.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: COLORS.totalBg },
    };
    cell.font = { italic: true, color: { argb: COLORS.ink }, size: 10 };
  }
  ws.addRow([]);
}

function styleDataRow(
  row: ExcelJS.Row,
  idx: number,
  colCount: number,
  opts: {
    idrCols?: number[];
    pctCols?: number[];
    leftCols?: number[];
    centerCols?: number[];
    isTotal?: boolean;
    tone?: 'emerald' | 'amber' | 'rose';
  } = {},
) {
  row.height = 19;
  const idrCols = opts.idrCols ?? [];
  const pctCols = opts.pctCols ?? [];
  const leftCols = opts.leftCols ?? [1];
  const centerCols = opts.centerCols ?? [];
  const isTotal = Boolean(opts.isTotal);

  const fillArgb = isTotal
    ? COLORS.totalBg
    : opts.tone === 'emerald'
      ? COLORS.emeraldBg
      : opts.tone === 'amber'
        ? COLORS.amberBg
        : opts.tone === 'rose'
          ? COLORS.roseBg
          : idx % 2 === 1
            ? COLORS.zebraOdd
            : COLORS.zebraEven;

  const fontArgb =
    opts.tone === 'emerald'
      ? COLORS.emeraldInk
      : opts.tone === 'amber'
        ? COLORS.amberInk
        : opts.tone === 'rose'
          ? COLORS.roseInk
          : COLORS.ink;

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: fillArgb },
    };
    cell.font = { bold: isTotal, color: { argb: fontArgb }, size: 10 };
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.gridBorder } },
      bottom: { style: isTotal ? 'double' : 'thin', color: { argb: COLORS.gridBorder } },
      left: { style: 'thin', color: { argb: COLORS.gridBorder } },
      right: { style: 'thin', color: { argb: COLORS.gridBorder } },
    };
    if (idrCols.includes(c)) {
      cell.numFmt = IDR_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (pctCols.includes(c)) {
      cell.numFmt = PCT_FMT;
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    } else if (centerCols.includes(c)) {
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    } else {
      cell.alignment = {
        horizontal: leftCols.includes(c) ? 'left' : 'right',
        vertical: 'middle',
      };
    }
  }
}

/**
 * Generates the upgraded 4-sheet Sunday Funday ERP statement workbook server-side
 * (`Executive Summary`, `Due-Date & Settlement Schedule`, `Active Contracts Burn-Down`, `Line-Item Audit Ledger`).
 */
export async function generateExecutiveWorkbookBuffer(
  report: ExecutiveReportPayload,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sunday Funday ERP';
  wb.created = new Date();

  const cs = report.closingStatement;
  const uw = cs.upfrontAndWaterfall;
  const mc = cs.moneyCycle;
  const comp = report.comparativeStatement;
  const amort = report.amortizationSchedule;
  const dos = report.dossier;
  const horizon = report.horizonMetrics;
  const settlementTot = report.settlementTotalsForSelectedPeriod;

  // -------------------------------------------------------------------------
  // Sheet 1: Executive Summary
  // -------------------------------------------------------------------------
  const ws1 = wb.addWorksheet('Executive Summary');
  ws1.columns = [
    { width: 38 },
    { width: 20 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
  ];
  styleBanner(
    ws1,
    9,
    `Sunday Funday ERP — ${cs.periodLabel} Executive Summary`,
    `Status: ${cs.status} | Window: ${cs.workingDaysWindowLabel} | Scope: ${report.scope.toUpperCase()}`,
  );

  addSectionHeading(ws1, 9, `SECTION A: ${cs.periodLabel.toUpperCase()} WATERFALL & HEALTH RATIOS`);
  const s1H = ws1.addRow([
    'Waterfall Metric / Component',
    'Amount (Rp)',
    'Share / Ratio',
    'Status / Notes',
    '',
    '',
    '',
    '',
    '',
  ]);
  styleHeaderRow(s1H, 9, [1, 4]);

  const moneyInRow = ws1.addRow([
    'Total Money In (Net Salary + Extra Inflow)',
    mc.kpis.totalMoneyIn,
    1,
    `Net Payroll: Rp ${Math.round(mc.kpis.netPaycheck).toLocaleString('id-ID')}`,
  ]);
  styleDataRow(moneyInRow, 0, 9, { idrCols: [2], pctCols: [3], leftCols: [1, 4], isTotal: true });
  const incomeRowIdx = moneyInRow.number;

  const debtStart = ws1.lastRow!.number + 1;
  const debtItems: Array<[string, number, string]> = [
    ['PayLater Bills (Due 25th M+1)', uw.paylaterBills, 'Matrix PayLater Bucket'],
    ['Credit Card Charges (Due 11th M+1)', uw.creditCardBills, 'Billed Cycle Charges'],
    ['Personal & Informal Debt (Due 8th/Exact)', uw.personalDebtBills, 'SPinjam / P1 Vault Refund'],
    ['Contract Installments (Direct)', uw.contractInstallments, 'Non-duplicated active contracts'],
  ];
  debtItems.forEach(([label, amt, note], i) => {
    const r = ws1.addRow([label, amt, 0, note]);
    r.getCell(3).value = {
      formula: `IF($B$${incomeRowIdx}>0,B${r.number}/$B$${incomeRowIdx},0)`,
      result: mc.kpis.totalMoneyIn > 0 ? amt / mc.kpis.totalMoneyIn : 0,
    };
    styleDataRow(r, i, 9, { idrCols: [2], pctCols: [3], leftCols: [1, 4] });
  });
  const debtEnd = ws1.lastRow!.number;
  const debtTotRow = ws1.addRow([
    'Total Debt Obligations (Tier 1)',
    { formula: `SUM(B${debtStart}:B${debtEnd})`, result: mc.kpis.totalDebtAndBillsPaid },
    { formula: `IF($B$${incomeRowIdx}>0,B${debtEnd + 1}/$B$${incomeRowIdx},0)`, result: mc.kpis.debtShareOfIncomePercent / 100 },
    'Debt Service Ratio (DSR)',
  ]);
  styleDataRow(debtTotRow, 0, 9, { idrCols: [2], pctCols: [3], leftCols: [1, 4], isTotal: true });

  const livingRows: Array<[string, number, string]> = [
    ['Fixed Routine Essentials Pool', uw.fixedEssentialsActual, 'Transport, Internet, Vape, Haircut'],
    ['Daily Living Budget (Daily Operational)', uw.actualDailyOperational, `Remaining: Rp ${Math.round(mc.dailyLiving.remainingOperationalCash).toLocaleString('id-ID')}`],
    ['Emergency Buffer Pocket', uw.actualBufferPocket, 'Protected reserve'],
    ['Core Savings (P1 Allocation)', uw.actualSavings, `Vault: Rp ${Math.round(mc.savingsBottomLine.realizedInVaultTotal).toLocaleString('id-ID')}`],
    ['Self-Reward Allowance (P2)', uw.actualSelfReward, 'Discretionary P2'],
    ['Deficit Uncovered', uw.deficitUncovered, uw.isDeficit ? 'Manual cap exceeds cash' : 'Balanced'],
  ];
  livingRows.forEach(([label, amt, note], i) => {
    const r = ws1.addRow([label, amt, 0, note]);
    r.getCell(3).value = {
      formula: `IF($B$${incomeRowIdx}>0,B${r.number}/$B$${incomeRowIdx},0)`,
      result: mc.kpis.totalMoneyIn > 0 ? amt / mc.kpis.totalMoneyIn : 0,
    };
    styleDataRow(r, i, 9, { idrCols: [2], pctCols: [3], leftCols: [1, 4] });
  });

  if (horizon) {
    const kpiRows: Array<[string, number, number | string, string]> = [
      ['Effective Daily Living Rate', horizon.effectiveDailyLivingRate, `${mc.dailyLiving.daysInCycle}d cycle`, `Safe today: Rp ${Math.round(mc.dailyLiving.safeToSpendToday).toLocaleString('id-ID')}`],
      ['Debt Burn-Down Velocity (/mo)', horizon.debtBurnDownVelocityRp, horizon.netSavingsRatePercent / 100, `Next: ${horizon.nextMilestoneLabel}`],
    ];
    kpiRows.forEach(([l, a, ratioOrText, n], i) => {
      const r = ws1.addRow([l, a, ratioOrText, n]);
      styleDataRow(r, i, 9, {
        idrCols: [2],
        pctCols: typeof ratioOrText === 'number' ? [3] : [],
        leftCols: [1, 4],
      });
    });
  }

  ws1.addRow([]);
  addSectionHeading(ws1, 9, `SECTION B: MULTI-PERIOD COMPARATIVE WATERFALL (${comp.periodCount} PERIODS)`);
  const compHeader = ws1.addRow([
    'Period',
    'Total Income',
    'Total Debt Bills',
    'Fixed + Daily Ops',
    'Core Savings P1',
    'Self-Reward P2',
    'DSR %',
    'Score',
    'Driver',
  ]);
  styleHeaderRow(compHeader, 9, [1, 9]);

  const cStart = ws1.lastRow!.number + 1;
  comp.periods.forEach((p, idx) => {
    const rNum = ws1.lastRow!.number + 1;
    const r = ws1.addRow([
      p.periodLabel,
      p.finalTotalIncome,
      p.creditBillsAmount,
      p.routineAndDailyLivingAmount,
      p.actualSavings,
      p.selfReward,
      { formula: `IF(B${rNum}>0,C${rNum}/B${rNum},0)`, result: p.creditDebtRatioPercent / 100 },
      p.disciplineScore,
      p.changeVsLastMonthSummary,
    ]);
    styleDataRow(r, idx, 9, { idrCols: [2, 3, 4, 5, 6], pctCols: [7], leftCols: [1, 9] });
  });
  const cEnd = ws1.lastRow!.number;
  if (comp.periods.length > 0) {
    const totR = ws1.addRow([
      'TOTAL / AVG',
      { formula: `SUM(B${cStart}:B${cEnd})`, result: comp.totals.totalIncome },
      { formula: `SUM(C${cStart}:C${cEnd})`, result: comp.totals.totalCreditBills },
      { formula: `SUM(D${cStart}:D${cEnd})`, result: comp.totals.totalFixedEssentials + comp.totals.totalDailyOperational },
      { formula: `SUM(E${cStart}:E${cEnd})`, result: comp.totals.totalSavings },
      { formula: `SUM(F${cStart}:F${cEnd})`, result: comp.totals.totalSelfReward },
      { formula: `AVERAGE(G${cStart}:G${cEnd})`, result: comp.totals.averageCreditDebtRatioPercent / 100 },
      { formula: `ROUND(AVERAGE(H${cStart}:H${cEnd}),0)`, result: Math.round(comp.totals.averageDisciplineScore) },
      `${comp.periodCount} periods`,
    ]);
    styleDataRow(totR, 0, 9, { idrCols: [2, 3, 4, 5, 6], pctCols: [7], leftCols: [1, 9], isTotal: true });
  }

  // -------------------------------------------------------------------------
  // Sheet 2: Due-Date & Settlement Schedule
  // -------------------------------------------------------------------------
  const ws2 = wb.addWorksheet('Due-Date & Settlement Schedule');
  ws2.columns = [
    { width: 14 },
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 36 },
    { width: 12 },
    { width: 18 },
    { width: 16 },
  ];
  styleBanner(
    ws2,
    8,
    `Due-Date & Settlement Schedule — ${cs.periodLabel}`,
    settlementTot
      ? `Selected Period Total: Rp ${settlementTot.totalDue.toLocaleString('id-ID')} | Bank Hold Needed: Rp ${settlementTot.bankHoldNeeded.toLocaleString('id-ID')} | Paid: Rp ${settlementTot.paidAmount.toLocaleString('id-ID')}`
      : '8th Personal Debt · 11th Credit Card · 25th SPayLater',
  );

  addSectionHeading(ws2, 8, 'SECTION A: 12-MONTH MATURITY MATRIX');
  const mHdr = ws2.addRow([
    'Period',
    'Status',
    'PayLater (25th)',
    'Credit Card (11th)',
    'Personal Debt (8th)',
    'Contracts',
    'Total Due',
    'Dropping Off',
  ]);
  styleHeaderRow(mHdr, 8, [1, 2, 8]);
  const mStart = ws2.lastRow!.number + 1;
  amort.months.forEach((m, idx) => {
    const rNum = ws2.lastRow!.number + 1;
    const r = ws2.addRow([
      m.periodLabel,
      m.cumulativeSettledPercent >= 100 ? 'CLEARED' : 'SCHEDULED',
      m.paylaterAmount,
      m.creditCardAmount,
      m.personalDebtAmount,
      m.contractInstallmentsAmount,
      { formula: `SUM(C${rNum}:F${rNum})`, result: m.totalLiabilityDue },
      m.droppingOffAfterThisMonth.join(', ') || '-',
    ]);
    styleDataRow(r, idx, 8, { idrCols: [3, 4, 5, 6, 7], leftCols: [1, 2, 8] });
  });
  const mEnd = ws2.lastRow!.number;
  if (amort.months.length > 0) {
    const mTot = ws2.addRow([
      '12M TOTAL',
      '-',
      { formula: `SUM(C${mStart}:C${mEnd})`, result: amort.summary.totalPaylater12M },
      { formula: `SUM(D${mStart}:D${mEnd})`, result: amort.summary.totalCreditCard12M },
      { formula: `SUM(E${mStart}:E${mEnd})`, result: amort.summary.totalPersonalDebt12M },
      { formula: `SUM(F${mStart}:F${mEnd})`, result: amort.summary.totalContracts12M },
      { formula: `SUM(G${mStart}:G${mEnd})`, result: amort.summary.total12MonthObligations },
      amort.summary.firstDebtFreeMonthLabel ? `Free: ${amort.summary.firstDebtFreeMonthLabel}` : '-',
    ]);
    styleDataRow(mTot, 0, 8, { idrCols: [3, 4, 5, 6, 7], leftCols: [1, 2, 8], isTotal: true });
  }

  ws2.addRow([]);
  addSectionHeading(ws2, 8, 'SECTION B: ITEMIZED SETTLEMENT CHECKLIST (PAID / RESERVED / UNPAID)');
  const liHdr = ws2.addRow([
    'Period',
    'Due Date',
    'Category',
    'Platform',
    'Item Title',
    'Slice',
    'Amount (Rp)',
    'State',
  ]);
  styleHeaderRow(liHdr, 8, [1, 2, 3, 4, 5, 6, 8]);

  const liStart = ws2.lastRow!.number + 1;
  let liIdx = 0;
  let liSum = 0;
  for (const li of report.liabilityLineItems ?? []) {
    liSum += li.monthlyAmount;
    const tone =
      li.settlementState === 'PAID'
        ? 'emerald'
        : li.settlementState === 'RESERVED'
          ? 'amber'
          : undefined;
    const r = ws2.addRow([
      li.periodLabel,
      li.dueDateIso,
      li.category,
      li.merchantOrPlatform,
      li.title,
      `${li.installmentIndex}/${li.tenorMonths}`,
      li.monthlyAmount,
      li.settlementState,
    ]);
    styleDataRow(r, liIdx++, 8, { idrCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8], tone });
  }
  for (const cc of report.creditCardScheduleItems ?? []) {
    liSum += cc.amount;
    const tone =
      cc.settlementState === 'PAID'
        ? 'emerald'
        : cc.settlementState === 'RESERVED'
          ? 'amber'
          : undefined;
    const r = ws2.addRow([
      cc.periodLabel,
      cc.dueDateIso,
      'CREDIT_CARD',
      cc.chargeType,
      cc.label,
      cc.sliceBadge ?? '1/1',
      cc.amount,
      cc.settlementState,
    ]);
    styleDataRow(r, liIdx++, 8, { idrCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8], tone });
  }
  const liEnd = ws2.lastRow!.number;
  if (liIdx > 0) {
    const liTot = ws2.addRow([
      'TOTAL',
      '-',
      `${liIdx} items`,
      '-',
      'All itemized liabilities & card obligations',
      '-',
      { formula: `SUM(G${liStart}:G${liEnd})`, result: liSum },
      '-',
    ]);
    styleDataRow(liTot, 0, 8, { idrCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8], isTotal: true });
  }

  // -------------------------------------------------------------------------
  // Sheet 3: Active Contracts Burn-Down
  // -------------------------------------------------------------------------
  const ws3 = wb.addWorksheet('Active Contracts Burn-Down');
  ws3.columns = [
    { width: 34 },
    { width: 16 },
    { width: 18 },
    { width: 12 },
    { width: 18 },
    { width: 18 },
    { width: 20 },
    { width: 16 },
  ];
  styleBanner(
    ws3,
    8,
    'Active Contracts & Installments Burn-Down',
    `Active Plans: ${(report.activeContractsSummary ?? []).length} | Next Milestone: ${horizon?.nextMilestoneLabel ?? 'N/A'}`,
  );

  addSectionHeading(ws3, 8, 'SECTION A: ACTIVE MULTI-MONTH CONTRACTS & INSTALLMENT LANES');
  const cHdr = ws3.addRow([
    'Contract / Plan Title',
    'Category',
    'Platform',
    'Tenor',
    'Total Principal',
    'Monthly Slice',
    'Remaining Principal',
    'Payoff Horizon',
  ]);
  styleHeaderRow(cHdr, 8, [1, 2, 3, 8]);
  const contracts = report.activeContractsSummary ?? [];
  const acStart = ws3.lastRow!.number + 1;
  contracts.forEach((c, idx) => {
    const r = ws3.addRow([
      c.title,
      c.category,
      c.merchantOrPlatform,
      `${c.totalTenor} mo`,
      c.principalAmount,
      c.monthlyInstallment,
      c.remainingPrincipal,
      c.payoffDateLabel,
    ]);
    styleDataRow(r, idx, 8, { idrCols: [5, 6, 7], leftCols: [1, 2, 3, 8], centerCols: [4] });
  });
  const acEnd = ws3.lastRow!.number;
  if (contracts.length > 0) {
    const acTot = ws3.addRow([
      'TOTAL COMMITMENTS',
      '-',
      `${contracts.length} active`,
      '-',
      { formula: `SUM(E${acStart}:E${acEnd})`, result: contracts.reduce((s, c) => s + c.principalAmount, 0) },
      { formula: `SUM(F${acStart}:F${acEnd})`, result: contracts.reduce((s, c) => s + c.monthlyInstallment, 0) },
      { formula: `SUM(G${acStart}:G${acEnd})`, result: contracts.reduce((s, c) => s + c.remainingPrincipal, 0) },
      '-',
    ]);
    styleDataRow(acTot, 0, 8, { idrCols: [5, 6, 7], leftCols: [1, 2, 3, 8], isTotal: true });
  }

  ws3.addRow([]);
  addSectionHeading(ws3, 8, 'SECTION B: CASHFLOW FREED UP MILESTONES');
  const fHdr = ws3.addRow([
    'Freed Period',
    'Contracts Completed',
    'Monthly Cashflow Freed',
    'Cumulative Freed (/mo)',
    '',
    '',
    '',
    '',
  ]);
  styleHeaderRow(fHdr, 8, [1, 2]);
  const milestones = horizon?.freedUpMilestones ?? [];
  milestones.forEach((m, idx) => {
    const r = ws3.addRow([
      m.periodLabel,
      m.endingContracts.join(', '),
      m.freedMonthlyRp,
      m.cumulativeFreedRp,
    ]);
    styleDataRow(r, idx, 8, { idrCols: [3, 4], leftCols: [1, 2], tone: 'emerald' });
  });

  // -------------------------------------------------------------------------
  // Sheet 4: Line-Item Audit Ledger
  // -------------------------------------------------------------------------
  const ws4 = wb.addWorksheet('Line-Item Audit Ledger');
  ws4.columns = [
    { width: 16 },
    { width: 38 },
    { width: 22 },
    { width: 18 },
    { width: 38 },
  ];
  styleBanner(
    ws4,
    5,
    `Line-Item Audit Ledger — ${cs.periodLabel}`,
    `Discipline Score: ${cs.governance.disciplineScore}/100 | Revisions: ${dos.revisions.length} | Logs: ${dos.recentGovernanceLogs.length}`,
  );

  const lHdr = ws4.addRow([
    'Date / Timestamp',
    'Label / Description',
    'Category / Kind',
    'Signed Amount (Rp)',
    'Notes / Context',
  ]);
  styleHeaderRow(lHdr, 5, [1, 2, 3, 5]);

  const txStart = ws4.lastRow!.number + 1;
  let lIdx = 0;
  let txNet = 0;
  for (const inc of cs.payroll.incomeTransactions) {
    txNet += inc.amount;
    const r = ws4.addRow([
      inc.date.slice(0, 10),
      inc.label,
      'INCOME',
      inc.amount,
      'Cash Inflow',
    ]);
    styleDataRow(r, lIdx++, 5, { idrCols: [4], leftCols: [1, 2, 3, 5], tone: 'emerald' });
  }
  for (const cc of mc.itemizedCreditCardCharges) {
    txNet -= cc.dueAmount;
    const r = ws4.addRow([
      cc.transactionDate.slice(0, 10),
      cc.label,
      cc.sliceBadge ? `${cc.chargeTypeLabel} (${cc.sliceBadge})` : cc.chargeTypeLabel,
      -cc.dueAmount,
      `Remaining Principal: Rp ${Math.round(cc.remainingPrincipalAfterPeriod).toLocaleString('id-ID')}`,
    ]);
    styleDataRow(r, lIdx++, 5, { idrCols: [4], leftCols: [1, 2, 3, 5] });
  }
  for (const exp of mc.dailyLiving.itemizedDailyExpenses) {
    txNet -= exp.signedAmount;
    const r = ws4.addRow([
      exp.date.slice(0, 10),
      exp.label,
      exp.fixedEssentialCategoryLabel || exp.kindLabel,
      -exp.signedAmount,
      exp.kind,
    ]);
    styleDataRow(r, lIdx++, 5, { idrCols: [4], leftCols: [1, 2, 3, 5] });
  }
  const txEnd = ws4.lastRow!.number;
  if (lIdx > 0) {
    const txTot = ws4.addRow([
      'NET LEDGER FLOW',
      `${lIdx} entries`,
      'Selected Period',
      { formula: `SUM(D${txStart}:D${txEnd})`, result: txNet },
      'Income minus itemized outflow',
    ]);
    styleDataRow(txTot, 0, 5, { idrCols: [4], leftCols: [1, 2, 3, 5], isTotal: true });
  }

  ws4.addRow([]);
  addSectionHeading(ws4, 5, 'REVISIONS & GOVERNANCE AUDIT TRAIL');
  const gHdr = ws4.addRow(['Timestamp', 'Action / Category', 'Period / Severity', 'Delta (Rp)', 'Summary / Reason']);
  styleHeaderRow(gHdr, 5, [1, 2, 3, 5]);

  let gIdx = 0;
  for (const rev of dos.revisions) {
    const r = ws4.addRow([
      rev.createdAt.slice(0, 19).replace('T', ' '),
      `REVISION: ${rev.categoryLabel}`,
      rev.periodLabel,
      rev.difference,
      `${rev.reason} (Rp ${Math.round(rev.previousValue).toLocaleString('id-ID')} -> Rp ${Math.round(rev.newValue).toLocaleString('id-ID')})`,
    ]);
    styleDataRow(r, gIdx++, 5, { idrCols: [4], leftCols: [1, 2, 3, 5] });
  }
  for (const log of dos.recentGovernanceLogs) {
    const r = ws4.addRow([
      log.createdAt.slice(0, 19).replace('T', ' '),
      log.actionLabel,
      log.severity,
      0,
      log.summary,
    ]);
    styleDataRow(r, gIdx++, 5, { idrCols: [4], leftCols: [1, 2, 3, 5] });
  }

  const out = await wb.xlsx.writeBuffer();
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}
