import ExcelJS from "exceljs";
import { ExecutiveReportPayload } from "./api";

const IDR_FMT = '"Rp "#,##0;-"Rp "#,##0;"Rp "0';
const PCT_FMT = "0.0%";

const COLORS = {
  bannerBg: "FF0F172A",
  bannerText: "FFF8FAFC",
  sectionBg: "FF1E293B",
  sectionText: "FFF1F5F9",
  headerBg: "FF334155",
  headerText: "FFFFFFFF",
  totalBg: "FFE2E8F0",
  totalBorderTop: "FF64748B",
  totalBorderBottom: "FF0F172A",
  gridBorder: "FFCBD5E1",
  zebraEven: "FFFFFFFF",
  zebraOdd: "FFF8FAFC",
  emeraldFill: "FFECFDF5",
  emeraldText: "FF065F46",
  amberFill: "FFFFFBEB",
  amberText: "FF92400E",
  roseFill: "FFFFF1F2",
  roseText: "FF9F1239",
  ink: "FF0F172A",
};

type Tone = "neutral" | "zebra" | "emerald" | "amber" | "rose" | "total";

function fillForTone(tone: Tone, rowIndex = 0): ExcelJS.Fill {
  let argb = COLORS.zebraEven;
  if (tone === "zebra") argb = rowIndex % 2 === 1 ? COLORS.zebraOdd : COLORS.zebraEven;
  else if (tone === "emerald") argb = COLORS.emeraldFill;
  else if (tone === "amber") argb = COLORS.amberFill;
  else if (tone === "rose") argb = COLORS.roseFill;
  else if (tone === "total") argb = COLORS.totalBg;
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

function textColorForTone(tone: Tone): string {
  if (tone === "emerald") return COLORS.emeraldText;
  if (tone === "amber") return COLORS.amberText;
  if (tone === "rose") return COLORS.roseText;
  return COLORS.ink;
}

function addBanner(ws: ExcelJS.Worksheet, colCount: number, title: string, subtitle: string) {
  const r1 = ws.addRow([title]);
  ws.mergeCells(r1.number, 1, r1.number, colCount);
  r1.height = 26;
  for (let c = 1; c <= colCount; c++) {
    const cell = r1.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.bannerBg } };
    cell.font = { name: "Calibri", bold: true, color: { argb: COLORS.bannerText }, size: 13 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
  const r2 = ws.addRow([subtitle]);
  ws.mergeCells(r2.number, 1, r2.number, colCount);
  r2.height = 18;
  for (let c = 1; c <= colCount; c++) {
    const cell = r2.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.totalBg } };
    cell.font = { name: "Calibri", italic: true, color: { argb: COLORS.ink }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
}

function addSectionTitle(ws: ExcelJS.Worksheet, colCount: number, title: string) {
  const row = ws.addRow([title]);
  ws.mergeCells(row.number, 1, row.number, colCount);
  row.height = 21;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.sectionBg } };
    cell.font = { name: "Calibri", bold: true, color: { argb: COLORS.sectionText }, size: 10 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  }
}

function addTableHeaders(ws: ExcelJS.Worksheet, headers: string[], rightCols: number[] = []) {
  const row = ws.addRow(headers);
  row.height = 22;
  for (let c = 1; c <= headers.length; c++) {
    const cell = row.getCell(c);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.headerBg } };
    cell.font = { name: "Calibri", bold: true, color: { argb: COLORS.headerText }, size: 10 };
    cell.alignment = {
      vertical: "middle",
      horizontal: rightCols.includes(c) ? "right" : "left",
    };
    cell.border = {
      top: { style: "thin", color: { argb: COLORS.gridBorder } },
      left: { style: "thin", color: { argb: COLORS.gridBorder } },
      bottom: { style: "thin", color: { argb: COLORS.gridBorder } },
      right: { style: "thin", color: { argb: COLORS.gridBorder } },
    };
  }
}

function styleDataRow(
  row: ExcelJS.Row,
  colCount: number,
  tone: Tone = "zebra",
  opts: {
    currencyCols?: number[];
    pctCols?: number[];
    centerCols?: number[];
    leftCols?: number[];
  } = {},
  rowIndex = 0,
  isTotal = false
) {
  row.height = isTotal ? 22 : 19;
  const fill = fillForTone(isTotal ? "total" : tone, rowIndex);
  const ink = isTotal ? COLORS.ink : textColorForTone(tone);

  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.fill = fill;
    cell.font = { name: "Calibri", bold: isTotal, color: { argb: ink }, size: 10 };
    cell.border = isTotal
      ? {
          top: { style: "thin", color: { argb: COLORS.totalBorderTop } },
          left: { style: "thin", color: { argb: COLORS.gridBorder } },
          bottom: { style: "double", color: { argb: COLORS.totalBorderBottom } },
          right: { style: "thin", color: { argb: COLORS.gridBorder } },
        }
      : {
          top: { style: "thin", color: { argb: COLORS.gridBorder } },
          left: { style: "thin", color: { argb: COLORS.gridBorder } },
          bottom: { style: "thin", color: { argb: COLORS.gridBorder } },
          right: { style: "thin", color: { argb: COLORS.gridBorder } },
        };

    if (opts.currencyCols?.includes(c)) {
      cell.numFmt = IDR_FMT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (opts.pctCols?.includes(c)) {
      cell.numFmt = PCT_FMT;
      cell.alignment = { horizontal: "right", vertical: "middle" };
    } else if (opts.centerCols?.includes(c)) {
      cell.alignment = { horizontal: "center", vertical: "middle" };
    } else {
      cell.alignment = {
        horizontal: opts.leftCols?.includes(c) ? "left" : "right",
        vertical: "middle",
      };
    }
  }
}

function autoFitColumns(ws: ExcelJS.Worksheet, minWidth = 11, maxWidth = 42) {
  ws.columns?.forEach((col, colIdx) => {
    let maxLen = minWidth;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      // Skip merged wide banner/section title cells so column 1 does not inflate unnecessarily
      if (colIdx === 0 && cell.isMerged) return;
      const val = cell.value;
      const text =
        val && typeof val === "object" && "result" in val
          ? String((val as { result?: unknown }).result ?? "")
          : String(val ?? "");
      if (text.length + 3 > maxLen) {
        maxLen = text.length + 3;
      }
    });
    col.width = Math.min(maxWidth, maxLen);
  });
}

export async function buildExecutiveReportWorkbook(
  report: ExecutiveReportPayload,
  _profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sunday Funday ERP";
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
  const ws1 = wb.addWorksheet("Executive Summary");
  addBanner(
    ws1,
    9,
    `Sunday Funday ERP — ${cs.periodLabel} Executive Summary`,
    `Status: ${cs.status} | Window: ${cs.workingDaysWindowLabel} | Scope: ${report.scope.toUpperCase()}`
  );
  addSectionTitle(ws1, 9, `SECTION A: ${cs.periodLabel.toUpperCase()} WATERFALL & KPI RATIOS`);
  addTableHeaders(
    ws1,
    ["Waterfall Component", "Amount (Rp)", "Share / Ratio", "Commentary", "", "", "", "", ""],
    [2, 3]
  );

  const incomeRow = ws1.addRow([
    "Total Money In (Net Salary + Extra Inflow)",
    mc.kpis.totalMoneyIn,
    1,
    `Net Payroll: Rp ${Math.round(mc.kpis.netPaycheck).toLocaleString("id-ID")}`,
  ]);
  styleDataRow(incomeRow, 9, "total", { currencyCols: [2], pctCols: [3], leftCols: [1, 4] }, 0, true);
  const incomeRowNum = incomeRow.number;

  const debtStart = ws1.lastRow!.number + 1;
  [
    ["PayLater Bills (Due 25th M+1)", uw.paylaterBills, "Matrix PayLater Bucket"],
    ["Credit Card Charges (Due 11th M+1)", uw.creditCardBills, "Statement Period Due"],
    ["Personal & Informal Debt (Due 8th/Exact)", uw.personalDebtBills, "Personal Loans & Savings Repayments"],
    ["Direct Contract Installments", uw.contractInstallments, "Non-duplicated contracts"],
  ].forEach(([label, amt, note], i) => {
    const rNum = ws1.lastRow!.number + 1;
    const row = ws1.addRow([
      label,
      amt,
      {
        formula: `IF($B$${incomeRowNum}>0,B${rNum}/$B$${incomeRowNum},0)`,
        result: mc.kpis.totalMoneyIn > 0 ? Number(amt) / mc.kpis.totalMoneyIn : 0,
      },
      note,
    ]);
    styleDataRow(row, 9, "zebra", { currencyCols: [2], pctCols: [3], leftCols: [1, 4] }, i);
  });
  const debtEnd = ws1.lastRow!.number;
  const debtTotNum = debtEnd + 1;
  const debtTotRow = ws1.addRow([
    "Total Debt Obligations (Tier 1)",
    { formula: `SUM(B${debtStart}:B${debtEnd})`, result: mc.kpis.totalDebtAndBillsPaid },
    { formula: `IF($B$${incomeRowNum}>0,B${debtTotNum}/$B$${incomeRowNum},0)`, result: mc.kpis.debtShareOfIncomePercent / 100 },
    "Debt Service Ratio (DSR)",
  ]);
  styleDataRow(debtTotRow, 9, "total", { currencyCols: [2], pctCols: [3], leftCols: [1, 4] }, 0, true);

  [
    ["Fixed Routine Essentials Pool", uw.fixedEssentialsActual, "Transport, Internet, Vape, Haircut"],
    ["Daily Living Budget (Daily Operational)", uw.actualDailyOperational, `Remaining: Rp ${Math.round(mc.dailyLiving.remainingOperationalCash).toLocaleString("id-ID")}`],
    ["Emergency Buffer Pocket", uw.actualBufferPocket, "Protected reserve"],
    ["Core Savings Allocation", uw.actualSavings, `Realized Savings: Rp ${Math.round(mc.savingsBottomLine.realizedInVaultTotal).toLocaleString("id-ID")}`],
    ["Flexible Surplus Allowance", uw.actualSelfReward, "Discretionary surplus"],
    ["Deficit Uncovered", uw.deficitUncovered, uw.isDeficit ? "Cap exceeds inflow" : "Fully covered"],
  ].forEach(([label, amt, note], i) => {
    const rNum = ws1.lastRow!.number + 1;
    const row = ws1.addRow([
      label,
      amt,
      {
        formula: `IF($B$${incomeRowNum}>0,B${rNum}/$B$${incomeRowNum},0)`,
        result: mc.kpis.totalMoneyIn > 0 ? Number(amt) / mc.kpis.totalMoneyIn : 0,
      },
      note,
    ]);
    styleDataRow(row, 9, "zebra", { currencyCols: [2], pctCols: [3], leftCols: [1, 4] }, i);
  });

  if (horizon) {
    const r1 = ws1.addRow([
      "Effective Daily Living Rate",
      horizon.effectiveDailyLivingRate,
      mc.dailyLiving.daysInCycle + "d cycle",
      `Safe today: Rp ${Math.round(mc.dailyLiving.safeToSpendToday).toLocaleString("id-ID")}`,
    ]);
    styleDataRow(r1, 9, "zebra", { currencyCols: [2], leftCols: [1, 4], centerCols: [3] }, 0);
    const r2 = ws1.addRow([
      "Debt Burn-Down Velocity (/mo)",
      horizon.debtBurnDownVelocityRp,
      horizon.netSavingsRatePercent / 100,
      horizon.nextMilestoneLabel,
    ]);
    styleDataRow(r2, 9, "emerald", { currencyCols: [2], pctCols: [3], leftCols: [1, 4] }, 1);
  }

  ws1.addRow([]);
  addSectionTitle(ws1, 9, `SECTION B: MULTI-PERIOD COMPARATIVE WATERFALL (${comp.periodCount} PERIODS)`);
  addTableHeaders(
    ws1,
    [
      "Period",
      "Total Income",
      "Debt Bills",
      "Routine & Daily Ops",
      "Core Savings",
      "Flexible Surplus",
      "DSR %",
      "Score",
      "Narrative Driver",
    ],
    [2, 3, 4, 5, 6, 7, 8]
  );

  const compStart = ws1.lastRow!.number + 1;
  comp.periods.forEach((p, idx) => {
    const rNum = ws1.lastRow!.number + 1;
    const row = ws1.addRow([
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
    styleDataRow(row, 9, "zebra", { currencyCols: [2, 3, 4, 5, 6], pctCols: [7], leftCols: [1, 9] }, idx);
  });
  const compEnd = ws1.lastRow!.number;
  if (comp.periods.length > 0) {
    const compTot = ws1.addRow([
      "TOTAL / AVG",
      { formula: `SUM(B${compStart}:B${compEnd})`, result: comp.totals.totalIncome },
      { formula: `SUM(C${compStart}:C${compEnd})`, result: comp.totals.totalCreditBills },
      { formula: `SUM(D${compStart}:D${compEnd})`, result: comp.totals.totalFixedEssentials + comp.totals.totalDailyOperational },
      { formula: `SUM(E${compStart}:E${compEnd})`, result: comp.totals.totalSavings },
      { formula: `SUM(F${compStart}:F${compEnd})`, result: comp.totals.totalSelfReward },
      { formula: `AVERAGE(G${compStart}:G${compEnd})`, result: comp.totals.averageCreditDebtRatioPercent / 100 },
      { formula: `ROUND(AVERAGE(H${compStart}:H${compEnd}),0)`, result: Math.round(comp.totals.averageDisciplineScore) },
      `${comp.periodCount} periods`,
    ]);
    styleDataRow(compTot, 9, "total", { currencyCols: [2, 3, 4, 5, 6], pctCols: [7], leftCols: [1, 9] }, 0, true);
  }
  autoFitColumns(ws1, 13, 44);

  // -------------------------------------------------------------------------
  // Sheet 2: Due-Date & Settlement Schedule
  // -------------------------------------------------------------------------
  const ws2 = wb.addWorksheet("Due-Date & Settlement Schedule");
  addBanner(
    ws2,
    8,
    `Due-Date & Settlement Schedule — ${cs.periodLabel}`,
    settlementTot
      ? `Period Total: Rp ${settlementTot.totalDue.toLocaleString("id-ID")} | Bank Hold Needed: Rp ${settlementTot.bankHoldNeeded.toLocaleString("id-ID")} | Paid: Rp ${settlementTot.paidAmount.toLocaleString("id-ID")}`
      : "8th Personal Debt · 11th Credit Card · 25th PayLater"
  );
  addSectionTitle(ws2, 8, "SECTION A: 12-MONTH MATURITY SCHEDULE");
  addTableHeaders(
    ws2,
    ["Period", "Status", "PayLater (25th)", "Credit Card (11th)", "Personal Debt (8th)", "Contracts", "Total Due", "Dropping Off"],
    [3, 4, 5, 6, 7]
  );

  const mStart = ws2.lastRow!.number + 1;
  amort.months.forEach((m, idx) => {
    const rNum = ws2.lastRow!.number + 1;
    const row = ws2.addRow([
      m.periodLabel,
      m.cumulativeSettledPercent >= 100 ? "CLEARED" : "SCHEDULED",
      m.paylaterAmount,
      m.creditCardAmount,
      m.personalDebtAmount,
      m.contractInstallmentsAmount,
      { formula: `SUM(C${rNum}:F${rNum})`, result: m.totalLiabilityDue },
      m.droppingOffAfterThisMonth.join(", ") || "-",
    ]);
    styleDataRow(row, 8, "zebra", { currencyCols: [3, 4, 5, 6, 7], leftCols: [1, 2, 8] }, idx);
  });
  const mEnd = ws2.lastRow!.number;
  if (amort.months.length > 0) {
    const mTot = ws2.addRow([
      "12M TOTAL",
      "-",
      { formula: `SUM(C${mStart}:C${mEnd})`, result: amort.summary.totalPaylater12M },
      { formula: `SUM(D${mStart}:D${mEnd})`, result: amort.summary.totalCreditCard12M },
      { formula: `SUM(E${mStart}:E${mEnd})`, result: amort.summary.totalPersonalDebt12M },
      { formula: `SUM(F${mStart}:F${mEnd})`, result: amort.summary.totalContracts12M },
      { formula: `SUM(G${mStart}:G${mEnd})`, result: amort.summary.total12MonthObligations },
      amort.summary.firstDebtFreeMonthLabel ? `Free: ${amort.summary.firstDebtFreeMonthLabel}` : "-",
    ]);
    styleDataRow(mTot, 8, "total", { currencyCols: [3, 4, 5, 6, 7], leftCols: [1, 2, 8] }, 0, true);
  }

  ws2.addRow([]);
  addSectionTitle(ws2, 8, "SECTION B: ITEMIZED SETTLEMENT CHECKLIST (PAID / RESERVED / UNPAID)");
  addTableHeaders(
    ws2,
    ["Period", "Due Date", "Category", "Platform", "Item Title", "Slice", "Amount (Rp)", "State"],
    [7]
  );
  const liStart = ws2.lastRow!.number + 1;
  let liIdx = 0;
  let liSum = 0;
  for (const li of report.liabilityLineItems ?? []) {
    liSum += li.monthlyAmount;
    const tone: Tone =
      li.settlementState === "PAID"
        ? "emerald"
        : li.settlementState === "RESERVED"
          ? "amber"
          : "zebra";
    const row = ws2.addRow([
      li.periodLabel,
      li.dueDateIso,
      li.category,
      li.merchantOrPlatform,
      li.title,
      `${li.installmentIndex}/${li.tenorMonths}`,
      li.monthlyAmount,
      li.settlementState,
    ]);
    styleDataRow(row, 8, tone, { currencyCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8] }, liIdx++);
  }
  for (const cc of report.creditCardScheduleItems ?? []) {
    liSum += cc.amount;
    const tone: Tone =
      cc.settlementState === "PAID"
        ? "emerald"
        : cc.settlementState === "RESERVED"
          ? "amber"
          : "zebra";
    const row = ws2.addRow([
      cc.periodLabel,
      cc.dueDateIso,
      "CREDIT_CARD",
      cc.chargeType,
      cc.label,
      cc.sliceBadge ?? "1/1",
      cc.amount,
      cc.settlementState,
    ]);
    styleDataRow(row, 8, tone, { currencyCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8] }, liIdx++);
  }
  const liEnd = ws2.lastRow!.number;
  if (liIdx > 0) {
    const liTot = ws2.addRow([
      "TOTAL",
      "-",
      `${liIdx} items`,
      "-",
      "All itemized liabilities & card obligations",
      "-",
      { formula: `SUM(G${liStart}:G${liEnd})`, result: liSum },
      "-",
    ]);
    styleDataRow(liTot, 8, "total", { currencyCols: [7], leftCols: [1, 2, 3, 4, 5], centerCols: [6, 8] }, 0, true);
  }
  autoFitColumns(ws2, 12, 42);

  // -------------------------------------------------------------------------
  // Sheet 3: Active Contracts Burn-Down
  // -------------------------------------------------------------------------
  const ws3 = wb.addWorksheet("Active Contracts Burn-Down");
  addBanner(
    ws3,
    8,
    "Active Contracts & Installments Burn-Down",
    `Active Plans: ${(report.activeContractsSummary ?? []).length} | Next Milestone: ${horizon?.nextMilestoneLabel ?? "N/A"}`
  );
  addSectionTitle(ws3, 8, "SECTION A: ACTIVE MULTI-MONTH CONTRACTS & INSTALLMENT LANES");
  addTableHeaders(
    ws3,
    ["Contract / Plan Title", "Category", "Platform", "Tenor", "Total Principal", "Monthly Slice", "Remaining Principal", "Payoff Horizon"],
    [5, 6, 7]
  );

  const contracts = report.activeContractsSummary ?? [];
  const acStart = ws3.lastRow!.number + 1;
  contracts.forEach((c, idx) => {
    const row = ws3.addRow([
      c.title,
      c.category,
      c.merchantOrPlatform,
      `${c.totalTenor} mo`,
      c.principalAmount,
      c.monthlyInstallment,
      c.remainingPrincipal,
      c.payoffDateLabel,
    ]);
    styleDataRow(row, 8, "zebra", { currencyCols: [5, 6, 7], leftCols: [1, 2, 3, 8], centerCols: [4] }, idx);
  });
  const acEnd = ws3.lastRow!.number;
  if (contracts.length > 0) {
    const acTot = ws3.addRow([
      "TOTAL COMMITMENTS",
      "-",
      `${contracts.length} active`,
      "-",
      { formula: `SUM(E${acStart}:E${acEnd})`, result: contracts.reduce((s, c) => s + c.principalAmount, 0) },
      { formula: `SUM(F${acStart}:F${acEnd})`, result: contracts.reduce((s, c) => s + c.monthlyInstallment, 0) },
      { formula: `SUM(G${acStart}:G${acEnd})`, result: contracts.reduce((s, c) => s + c.remainingPrincipal, 0) },
      "-",
    ]);
    styleDataRow(acTot, 8, "total", { currencyCols: [5, 6, 7], leftCols: [1, 2, 3, 8] }, 0, true);
  }

  ws3.addRow([]);
  addSectionTitle(ws3, 8, "SECTION B: CASHFLOW FREED UP MILESTONES");
  addTableHeaders(
    ws3,
    ["Freed Period", "Contracts Completed", "Monthly Cashflow Freed", "Cumulative Freed (/mo)", "", "", "", ""],
    [3, 4]
  );
  (horizon?.freedUpMilestones ?? []).forEach((m, idx) => {
    const row = ws3.addRow([
      m.periodLabel,
      m.endingContracts.join(", "),
      m.freedMonthlyRp,
      m.cumulativeFreedRp,
    ]);
    styleDataRow(row, 8, "emerald", { currencyCols: [3, 4], leftCols: [1, 2] }, idx);
  });
  autoFitColumns(ws3, 12, 42);

  // -------------------------------------------------------------------------
  // Sheet 4: Line-Item Audit Ledger
  // -------------------------------------------------------------------------
  const ws4 = wb.addWorksheet("Line-Item Audit Ledger");
  addBanner(
    ws4,
    5,
    `Line-Item Audit Ledger — ${cs.periodLabel}`,
    `Discipline Score: ${cs.governance.disciplineScore}/100 | Revisions: ${dos.revisions.length} | Logs: ${dos.recentGovernanceLogs.length}`
  );
  addTableHeaders(ws4, ["Date / Timestamp", "Label / Description", "Category / Kind", "Signed Amount (Rp)", "Notes / Context"], [4]);

  const txStart = ws4.lastRow!.number + 1;
  let lIdx = 0;
  let txNet = 0;
  for (const inc of cs.payroll.incomeTransactions) {
    txNet += inc.amount;
    const row = ws4.addRow([inc.date.slice(0, 10), inc.label, "INCOME", inc.amount, "Cash Inflow"]);
    styleDataRow(row, 5, "emerald", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, lIdx++);
  }
  for (const cc of mc.itemizedCreditCardCharges) {
    txNet -= cc.dueAmount;
    const row = ws4.addRow([
      cc.transactionDate.slice(0, 10),
      cc.label,
      cc.sliceBadge ? `${cc.chargeTypeLabel} (${cc.sliceBadge})` : cc.chargeTypeLabel,
      -cc.dueAmount,
      `Remaining Principal: Rp ${Math.round(cc.remainingPrincipalAfterPeriod).toLocaleString("id-ID")}`,
    ]);
    styleDataRow(row, 5, "zebra", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, lIdx++);
  }
  for (const exp of mc.dailyLiving.itemizedDailyExpenses) {
    txNet -= exp.signedAmount;
    const row = ws4.addRow([
      exp.date.slice(0, 10),
      exp.label,
      exp.fixedEssentialCategoryLabel || exp.kindLabel,
      -exp.signedAmount,
      exp.kind,
    ]);
    styleDataRow(row, 5, "zebra", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, lIdx++);
  }
  const txEnd = ws4.lastRow!.number;
  if (lIdx > 0) {
    const txTot = ws4.addRow([
      "NET LEDGER FLOW",
      `${lIdx} entries`,
      "Selected Period",
      { formula: `SUM(D${txStart}:D${txEnd})`, result: txNet },
      "Income minus itemized outflow",
    ]);
    styleDataRow(txTot, 5, "total", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, 0, true);
  }

  ws4.addRow([]);
  addSectionTitle(ws4, 5, "REVISIONS & GOVERNANCE AUDIT TRAIL");
  addTableHeaders(ws4, ["Timestamp", "Action / Category", "Period / Severity", "Delta (Rp)", "Summary / Reason"], [4]);
  let gIdx = 0;
  for (const rev of dos.revisions) {
    const row = ws4.addRow([
      rev.createdAt.slice(0, 19).replace("T", " "),
      `REVISION: ${rev.categoryLabel}`,
      rev.periodLabel,
      rev.difference,
      `${rev.reason} (Rp ${Math.round(rev.previousValue).toLocaleString("id-ID")} -> Rp ${Math.round(rev.newValue).toLocaleString("id-ID")})`,
    ]);
    styleDataRow(row, 5, "zebra", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, gIdx++);
  }
  for (const log of dos.recentGovernanceLogs) {
    const row = ws4.addRow([
      log.createdAt.slice(0, 19).replace("T", " "),
      log.actionLabel,
      log.severity,
      0,
      log.summary,
    ]);
    styleDataRow(row, 5, "zebra", { currencyCols: [4], leftCols: [1, 2, 3, 5] }, gIdx++);
  }
  autoFitColumns(ws4, 12, 46);

  return wb;
}

export async function exportExecutiveReportToExcel(
  report: ExecutiveReportPayload,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
) {
  const wb = await buildExecutiveReportWorkbook(report, profileMode);
  const mm = String(report.selectedMonth).padStart(2, "0");
  const fileName = `SundayFunday_ERP_Report_${report.selectedYear}_${mm}.xlsx`;

  const buffer = await wb.xlsx.writeBuffer();
  if (typeof window !== "undefined") {
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
