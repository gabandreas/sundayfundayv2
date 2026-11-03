import * as XLSX from "xlsx";
import { ExecutiveReportPayload } from "./api";

function finalizeFormattedSheet(
  rows: Array<Record<string, string | number>>,
  descriptionKeys: string[] = []
): XLSX.WorkSheet {
  const ws = XLSX.utils.json_to_sheet(rows);
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  const descSet = new Set(descriptionKeys);

  // Apply #,##0 number format to every numeric cell in the sheet
  const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : null;
  if (range) {
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[ref];
        if (cell && cell.t === "n") {
          cell.z = "#,##0";
        }
      }
    }
  }

  // Dynamically calculate column widths (wch) from header + cell contents (+4 buffer)
  ws["!cols"] = keys.map((key) => {
    let maxLen = key.length;
    for (const row of rows) {
      const val = row[key];
      if (val === null || val === undefined) continue;
      const str =
        typeof val === "number"
          ? val.toLocaleString("en-US")
          : String(val);
      if (str.length > maxLen) {
        maxLen = str.length;
      }
    }
    const minWidth = descSet.has(key) ? 36 : 14;
    const computed = Math.max(minWidth, Math.min(84, maxLen + 4));
    return { wch: computed };
  });

  return ws;
}

export function buildExecutiveReportWorkbook(
  report: ExecutiveReportPayload,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const cs = report.closingStatement;
  const uw = cs.upfrontAndWaterfall;
  const p = cs.payroll;
  const gov = cs.governance;
  const mc = cs.moneyCycle;

  type CycleRow = {
    Step_Or_Section: string;
    Line_Item_Description: string;
    Initial_Plan_IDR: number | string;
    Current_Budget_IDR: number | string;
    Actual_Or_Funded_IDR: number | string;
    Plain_Language_Notes: string;
  };

  const blankCycleRow = (): CycleRow => ({
    Step_Or_Section: "",
    Line_Item_Description: "",
    Initial_Plan_IDR: "",
    Current_Budget_IDR: "",
    Actual_Or_Funded_IDR: "",
    Plain_Language_Notes: "",
  });

  const dividerCycleRow = (title: string, subtitle = ""): CycleRow => ({
    Step_Or_Section: `=== ${title} ===`,
    Line_Item_Description: subtitle,
    Initial_Plan_IDR: "",
    Current_Budget_IDR: "",
    Actual_Or_Funded_IDR: "",
    Plain_Language_Notes: "",
  });

  // ---------------------------------------------------------------------------
  // Sheet 1: 1_Monthly_Money_Cycle
  // ---------------------------------------------------------------------------
  const cycleRows: CycleRow[] = [
    dividerCycleRow(
      `MONTHLY MONEY CYCLE STATEMENT — ${cs.periodLabel.toUpperCase()}`,
      `Period Status: ${cs.status === "LOCKED" ? "Closed & Locked" : cs.status === "DRAFT" ? "Active Draft Period" : "Uninitialized Forecast"}`
    ),
    {
      Step_Or_Section: "TOP KPI 1",
      Line_Item_Description: "Total Money In (Take-Home Pay + Extra Inflow)",
      Initial_Plan_IDR: mc.kpis.netPaycheck,
      Current_Budget_IDR: mc.kpis.totalMoneyIn,
      Actual_Or_Funded_IDR: mc.kpis.totalMoneyIn,
      Plain_Language_Notes: `Net paycheck Rp ${mc.kpis.netPaycheck.toLocaleString("id-ID")} + extra inflow Rp ${mc.kpis.extraInflow.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "TOP KPI 2",
      Line_Item_Description: "Total Debt & Bills Paid (Upfront Credit Bills)",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: mc.kpis.totalDebtAndBillsPaid,
      Actual_Or_Funded_IDR: mc.kpis.totalDebtAndBillsPaid,
      Plain_Language_Notes: `${mc.kpis.debtShareOfIncomePercent}% of Total Money In`,
    },
    {
      Step_Or_Section: "TOP KPI 3",
      Line_Item_Description: "Living & Routine Spend (Routine Bills + Daily Living + Manual Spend)",
      Initial_Plan_IDR: uw.fixedEssentialsBaseline + uw.dailyOperationalBaseline,
      Current_Budget_IDR: uw.fixedEssentialsRevised + uw.dailyOperationalRevised,
      Actual_Or_Funded_IDR: mc.kpis.livingAndRoutineSpend,
      Plain_Language_Notes: `${mc.kpis.livingShareOfIncomePercent}% of Total Money In`,
    },
    {
      Step_Or_Section: "TOP KPI 4",
      Line_Item_Description: "Net Saved & Leftover (Core Savings P1 + Self-Reward P2)",
      Initial_Plan_IDR: uw.savingsBaseline + uw.selfRewardBaseline,
      Current_Budget_IDR: uw.savingsRevised + uw.selfRewardRevised,
      Actual_Or_Funded_IDR: mc.kpis.netSavedAndLeftover,
      Plain_Language_Notes: mc.savingsBottomLine.verdictHeadline,
    },
    blankCycleRow(),
    dividerCycleRow(
      "WHERE YOUR MONEY WENT & WHY THIS MONTH CHANGED",
      mc.driversAndSpikes.biggestCostDriversHeadline
    ),
    ...mc.driversAndSpikes.costDrivers.map((d, idx) => ({
      Step_Or_Section: `COST DRIVER #${idx + 1}`,
      Line_Item_Description: d.label,
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: d.amount,
      Actual_Or_Funded_IDR: d.amount,
      Plain_Language_Notes: `${d.shareOfIncomePercent}% of Money In — ${d.detail}`,
    })),
    ...mc.driversAndSpikes.spikes.map((s) => ({
      Step_Or_Section: "MOM CHANGE",
      Line_Item_Description: s.label,
      Initial_Plan_IDR: s.previousAmount,
      Current_Budget_IDR: s.currentAmount,
      Actual_Or_Funded_IDR: s.deltaAmount,
      Plain_Language_Notes: s.explanation,
    })),
    ...(mc.driversAndSpikes.budgetRevisionSummaryText
      ? [
          {
            Step_Or_Section: "MID-MONTH EDITS",
            Line_Item_Description: "Target Adjustments Summary",
            Initial_Plan_IDR: "-",
            Current_Budget_IDR: "-",
            Actual_Or_Funded_IDR: "-",
            Plain_Language_Notes: mc.driversAndSpikes.budgetRevisionSummaryText,
          },
        ]
      : []),
    blankCycleRow(),
    dividerCycleRow(
      "PAYDAY EXECUTION CHECKLIST (TRANSFER & PAYMENT GUIDE)",
      "Exact transfers and bill reserves to execute when salary lands"
    ),
    {
      Step_Or_Section: "CHECKLIST 1",
      Line_Item_Description: `Set Aside for Debt & Bills (PayLater due ${mc.paydayChecklist.paylaterDueDay}th, CC due ${mc.paydayChecklist.creditDueDay}th)`,
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: mc.paydayChecklist.step1SetAsideForDebt.totalAmount,
      Actual_Or_Funded_IDR: mc.paydayChecklist.step1SetAsideForDebt.totalAmount,
      Plain_Language_Notes: `PayLater Rp ${uw.paylaterBills.toLocaleString("id-ID")} | CC Statement Rp ${uw.creditCardBills.toLocaleString("id-ID")} | Personal Debt Rp ${uw.personalDebtBills.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "CHECKLIST 2",
      Line_Item_Description: "Keep in Operational Account (Routine Bills + Funded Daily Living)",
      Initial_Plan_IDR: uw.fixedEssentialsBaseline + uw.dailyOperationalBaseline,
      Current_Budget_IDR: mc.paydayChecklist.step2KeepInOperationalAccount.totalAmount,
      Actual_Or_Funded_IDR: mc.paydayChecklist.step2KeepInOperationalAccount.totalAmount,
      Plain_Language_Notes: `Routine pool Rp ${mc.paydayChecklist.step2KeepInOperationalAccount.fixedRoutinePoolAmount.toLocaleString("id-ID")} + Daily living Rp ${mc.paydayChecklist.step2KeepInOperationalAccount.fundedDailyLivingAmount.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "CHECKLIST 3",
      Line_Item_Description: "Transfer to Savings Vault (Core Savings P1)",
      Initial_Plan_IDR: uw.savingsBaseline,
      Current_Budget_IDR: mc.paydayChecklist.step3TransferToSavingsVault.fundedP1Savings,
      Actual_Or_Funded_IDR: mc.paydayChecklist.step3TransferToSavingsVault.realizedInVault,
      Plain_Language_Notes: `${mc.paydayChecklist.step3TransferToSavingsVault.statusLabel} (Pending: Rp ${mc.paydayChecklist.step3TransferToSavingsVault.pendingTransferAmount.toLocaleString("id-ID")})`,
    },
    {
      Step_Or_Section: "CHECKLIST 4",
      Line_Item_Description: "Free / Self-Reward Allowance (Priority 2 Surplus)",
      Initial_Plan_IDR: uw.selfRewardBaseline,
      Current_Budget_IDR: uw.selfRewardRevised,
      Actual_Or_Funded_IDR: mc.paydayChecklist.step4FreeSelfRewardAllowance.fundedP2Allowance,
      Plain_Language_Notes: "Guilt-free discretionary surplus after P1 Savings",
    },
    blankCycleRow(),
    dividerCycleRow(
      "STEP 1: MONEY IN (PAYROLL & EXTRA INFLOW)",
      `Attendance Cutoff Window: ${cs.workingDaysWindowLabel}`
    ),
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Base Salary",
      Initial_Plan_IDR: p.baseSalary,
      Current_Budget_IDR: p.baseSalary,
      Actual_Or_Funded_IDR: p.baseSalary,
      Plain_Language_Notes: "Monthly contractual base salary",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Salary Adjustment",
      Initial_Plan_IDR: 0,
      Current_Budget_IDR: p.salaryAdjustment,
      Actual_Or_Funded_IDR: p.salaryAdjustment,
      Plain_Language_Notes: "Period salary adjustment",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "BPJS Deduction (3%)",
      Initial_Plan_IDR: -p.bpjsDeduction,
      Current_Budget_IDR: -p.bpjsDeduction,
      Actual_Or_Funded_IDR: -p.bpjsDeduction,
      Plain_Language_Notes: "3% statutory payroll deduction",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Laptop Allowance",
      Initial_Plan_IDR: p.laptopAllowance,
      Current_Budget_IDR: p.laptopAllowance,
      Actual_Or_Funded_IDR: p.laptopAllowance,
      Plain_Language_Notes: "Fixed monthly laptop allowance",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: `Attendance Allowance (${p.totalWorkingDays} days @ Rp ${p.dailyAllowance.toLocaleString("id-ID")})`,
      Initial_Plan_IDR: p.totalDailyAllowance,
      Current_Budget_IDR: p.totalDailyAllowance,
      Actual_Or_Funded_IDR: p.totalDailyAllowance,
      Plain_Language_Notes: `${p.totalWorkingDays} working days in ${cs.workingDaysWindowLabel}`,
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Cafeteria Deduction",
      Initial_Plan_IDR: 0,
      Current_Budget_IDR: -p.cafeteriaDeduction,
      Actual_Or_Funded_IDR: -p.cafeteriaDeduction,
      Plain_Language_Notes: "Office cafeteria deduction",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Net Paycheck (Take-Home Salary)",
      Initial_Plan_IDR: p.netSalaryIncome,
      Current_Budget_IDR: p.netSalaryIncome,
      Actual_Or_Funded_IDR: p.netSalaryIncome,
      Plain_Language_Notes: "Base + Attendance + Laptop - BPJS - Cafeteria",
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "THR & Performance Bonus",
      Initial_Plan_IDR: 0,
      Current_Budget_IDR: p.thrAmount + p.bonusAmount,
      Actual_Or_Funded_IDR: p.thrAmount + p.bonusAmount,
      Plain_Language_Notes: `THR Rp ${p.thrAmount.toLocaleString("id-ID")} | Bonus Rp ${p.bonusAmount.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "Extra Income (Non-Payroll Inflows)",
      Initial_Plan_IDR: 0,
      Current_Budget_IDR: p.extraIncome,
      Actual_Or_Funded_IDR: p.extraIncome,
      Plain_Language_Notes: `${p.incomeTransactions.length} extra income entries`,
    },
    {
      Step_Or_Section: "STEP 1: MONEY IN",
      Line_Item_Description: "TOTAL MONEY IN",
      Initial_Plan_IDR: p.finalTotalIncome,
      Current_Budget_IDR: p.finalTotalIncome,
      Actual_Or_Funded_IDR: p.finalTotalIncome,
      Plain_Language_Notes: "100% Inflow Base for Monthly Money Cycle",
    },
    blankCycleRow(),
    dividerCycleRow(
      "STEP 2: DEBT & CREDIT BILLS (DEDUCTED FIRST)",
      "Upfront credit and debt obligations paid before discretionary spending"
    ),
    {
      Step_Or_Section: "STEP 2: DEBT BILLS",
      Line_Item_Description: "PayLater Bill (Due 25th)",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: uw.paylaterBills,
      Actual_Or_Funded_IDR: uw.paylaterBills,
      Plain_Language_Notes:
        gov.paylaterUsageLimit > 0
          ? `Period Cap: Rp ${gov.paylaterUsageLimit.toLocaleString("id-ID")}`
          : "No period cap set",
    },
    {
      Step_Or_Section: "STEP 2: DEBT BILLS",
      Line_Item_Description: "Credit Card Statement (Due 11th)",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: uw.creditCardBills,
      Actual_Or_Funded_IDR: uw.creditCardBills,
      Plain_Language_Notes: `${mc.itemizedCreditCardCharges.length} active charges billed this period`,
    },
    {
      Step_Or_Section: "STEP 2: DEBT BILLS",
      Line_Item_Description: "Personal / Pre-Payday Debt",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: uw.personalDebtBills,
      Actual_Or_Funded_IDR: uw.personalDebtBills,
      Plain_Language_Notes: "Informal personal borrowing settled on payday",
    },
    {
      Step_Or_Section: "STEP 2: DEBT BILLS",
      Line_Item_Description: "Fixed Installment Contracts",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: uw.contractInstallments,
      Actual_Or_Funded_IDR: uw.contractInstallments,
      Plain_Language_Notes: "Scheduled multi-month contract installments",
    },
    {
      Step_Or_Section: "STEP 2: DEBT BILLS",
      Line_Item_Description: "TOTAL DEBT & CREDIT BILLS",
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: uw.totalCreditBills,
      Actual_Or_Funded_IDR: uw.totalCreditBills,
      Plain_Language_Notes: `${mc.kpis.debtShareOfIncomePercent}% of Total Money In`,
    },
    ...mc.itemizedCreditCardCharges.map((cc) => ({
      Step_Or_Section: "CC STATEMENT ITEM",
      Line_Item_Description: `${cc.label} (${cc.sliceBadge ?? cc.chargeTypeLabel})`,
      Initial_Plan_IDR: cc.totalAmount,
      Current_Budget_IDR: cc.dueAmount,
      Actual_Or_Funded_IDR: cc.dueAmount,
      Plain_Language_Notes: `${cc.chargeTypeLabel}${cc.isNewThisPeriod ? " · New charge this period" : ""}${cc.remainingPrincipalAfterPeriod > 0 ? ` · Remaining principal after period: Rp ${cc.remainingPrincipalAfterPeriod.toLocaleString("id-ID")}` : ""}`,
    })),
    blankCycleRow(),
    dividerCycleRow(
      profileMode === "STANDARD_GENERAL"
        ? "STEP 3: MONTHLY ROUTINE BILLS & ENVELOPES"
        : "STEP 3: MONTHLY ROUTINE BILLS (TRANSPORT, INTERNET, VAPE, HAIRCUT)",
      "4-Column Comparison: Initial Plan -> Revised Budget -> Logged Realization -> Remaining Pool"
    ),
    ...mc.routineBillsRealization.rows.map((r) => ({
      Step_Or_Section: "STEP 3: ROUTINE BILL",
      Line_Item_Description: r.label,
      Initial_Plan_IDR: r.initialPlan,
      Current_Budget_IDR: r.revisedBudget,
      Actual_Or_Funded_IDR: r.loggedRealization,
      Plain_Language_Notes: `Remaining Pool: Rp ${r.remainingPool.toLocaleString("id-ID")} | Status: ${r.statusLabel}`,
    })),
    {
      Step_Or_Section: "STEP 3: ROUTINE BILL",
      Line_Item_Description: "TOTAL MONTHLY ROUTINE BILLS POOL",
      Initial_Plan_IDR: mc.routineBillsRealization.totalInitialPlan,
      Current_Budget_IDR: mc.routineBillsRealization.totalRevisedBudget,
      Actual_Or_Funded_IDR: uw.fixedEssentialsActual,
      Plain_Language_Notes: `Logged realization: Rp ${mc.routineBillsRealization.totalLoggedRealization.toLocaleString("id-ID")} | Remaining pool: Rp ${mc.routineBillsRealization.totalRemainingPool.toLocaleString("id-ID")}`,
    },
    blankCycleRow(),
    dividerCycleRow(
      "STEP 4: DAILY LIVING & FOOD BUDGET (DAILY OPERATIONAL)",
      `Consumption Cycle: ${mc.dailyLiving.cycleDateLabel} (${mc.dailyLiving.daysInCycle} days)`
    ),
    {
      Step_Or_Section: "STEP 4: DAILY LIVING",
      Line_Item_Description: "Monthly Daily Living & Food Budget Pool",
      Initial_Plan_IDR: mc.dailyLiving.initialPlan,
      Current_Budget_IDR: mc.dailyLiving.currentMonthlyCap,
      Actual_Or_Funded_IDR: mc.dailyLiving.fundedAmount,
      Plain_Language_Notes: `Baseline daily rate: Rp ${mc.dailyLiving.baselineDailyRate.toLocaleString("id-ID")}/day`,
    },
    {
      Step_Or_Section: "STEP 4: DAILY LIVING",
      Line_Item_Description: "Net Daily Spend Used (Logged Spend - Refunds)",
      Initial_Plan_IDR: 0,
      Current_Budget_IDR: mc.dailyLiving.fundedAmount,
      Actual_Or_Funded_IDR: mc.dailyLiving.netDailySpendUsed,
      Plain_Language_Notes: `Gross logged: Rp ${mc.dailyLiving.grossDailyExpensesLogged.toLocaleString("id-ID")} | Refunds offset: -Rp ${mc.dailyLiving.operationalRefundsOffset.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "STEP 4: DAILY LIVING",
      Line_Item_Description: "Remaining Operational Cash",
      Initial_Plan_IDR: mc.dailyLiving.initialPlan,
      Current_Budget_IDR: mc.dailyLiving.fundedAmount,
      Actual_Or_Funded_IDR: mc.dailyLiving.remainingOperationalCash,
      Plain_Language_Notes: `Safe to spend today: Rp ${mc.dailyLiving.safeToSpendToday.toLocaleString("id-ID")}/day (${mc.dailyLiving.daysRemaining} days left)`,
    },
    ...mc.dailyLiving.itemizedDailyExpenses.map((exp) => ({
      Step_Or_Section: "LOGGED EXPENSE / REFUND",
      Line_Item_Description: exp.label,
      Initial_Plan_IDR: "-",
      Current_Budget_IDR: exp.signedAmount,
      Actual_Or_Funded_IDR: exp.signedAmount,
      Plain_Language_Notes: `${exp.kindLabel}${exp.fixedEssentialCategoryLabel ? ` (${exp.fixedEssentialCategoryLabel})` : ""} · ${exp.date.slice(0, 10)}`,
    })),
    blankCycleRow(),
    dividerCycleRow(
      "STEP 5: SAVINGS & BOTTOM LINE (WHAT YOU KEPT)",
      mc.savingsBottomLine.verdictHeadline
    ),
    {
      Step_Or_Section: "STEP 5: BOTTOM LINE",
      Line_Item_Description: "Core Savings (Priority 1)",
      Initial_Plan_IDR: mc.savingsBottomLine.p1Baseline,
      Current_Budget_IDR: mc.savingsBottomLine.p1Target,
      Actual_Or_Funded_IDR: mc.savingsBottomLine.p1Funded,
      Plain_Language_Notes:
        profileMode === "STANDARD_GENERAL"
          ? `Realized in Vault: Rp ${mc.savingsBottomLine.realizedInVaultTotal.toLocaleString("id-ID")} (Liquid Cash Rp ${mc.savingsBottomLine.realizedInVaultLiquidCash.toLocaleString("id-ID")} / Investment Portfolio Rp ${mc.savingsBottomLine.realizedInVaultInvestmentRdpu.toLocaleString("id-ID")})`
          : `Realized in Vault: Rp ${mc.savingsBottomLine.realizedInVaultTotal.toLocaleString("id-ID")} (Liquid Cash Rp ${mc.savingsBottomLine.realizedInVaultLiquidCash.toLocaleString("id-ID")} / RDPU Rp ${mc.savingsBottomLine.realizedInVaultInvestmentRdpu.toLocaleString("id-ID")})`,
    },
    {
      Step_Or_Section: "STEP 5: BOTTOM LINE",
      Line_Item_Description: "Self-Reward / Surplus (Priority 2)",
      Initial_Plan_IDR: uw.selfRewardBaseline,
      Current_Budget_IDR: mc.savingsBottomLine.p2Target,
      Actual_Or_Funded_IDR: mc.savingsBottomLine.p2Funded,
      Plain_Language_Notes: "Free surplus after Core Savings (P1)",
    },
    {
      Step_Or_Section: "STEP 5: BOTTOM LINE",
      Line_Item_Description: "Cumulative Savings Vault Balance (All Periods)",
      Initial_Plan_IDR: mc.savingsBottomLine.vaultLiquidCashBalance,
      Current_Budget_IDR: mc.savingsBottomLine.vaultInvestmentRdpuBalance,
      Actual_Or_Funded_IDR: mc.savingsBottomLine.vaultTotalBalance,
      Plain_Language_Notes:
        profileMode === "STANDARD_GENERAL"
          ? `Liquid Cash: Rp ${mc.savingsBottomLine.vaultLiquidCashBalance.toLocaleString("id-ID")} | Investment Portfolio: Rp ${mc.savingsBottomLine.vaultInvestmentRdpuBalance.toLocaleString("id-ID")}`
          : `Liquid Cash: Rp ${mc.savingsBottomLine.vaultLiquidCashBalance.toLocaleString("id-ID")} | Investment RDPU: Rp ${mc.savingsBottomLine.vaultInvestmentRdpuBalance.toLocaleString("id-ID")}`,
    },
    {
      Step_Or_Section: "STEP 5: BOTTOM LINE",
      Line_Item_Description: "NET SAVED & LEFTOVER (PERIOD VERDICT)",
      Initial_Plan_IDR: uw.savingsBaseline + uw.selfRewardBaseline,
      Current_Budget_IDR: uw.savingsRevised + uw.selfRewardRevised,
      Actual_Or_Funded_IDR: mc.savingsBottomLine.netSavedAndLeftover,
      Plain_Language_Notes: mc.savingsBottomLine.verdictDescription,
    },
  ];

  const wsCycle = finalizeFormattedSheet(cycleRows, [
    "Line_Item_Description",
    "Plain_Language_Notes",
  ]);
  XLSX.utils.book_append_sheet(wb, wsCycle, "1_Monthly_Money_Cycle");

  // ---------------------------------------------------------------------------
  // Sheet 2: 2_Month_Comparison
  // ---------------------------------------------------------------------------
  const comp = report.comparativeStatement;
  const momRows = [
    ...comp.periods.map((r) => ({
      Month: r.periodLabel,
      Status: r.status === "LOCKED" ? "Closed" : "Draft",
      Money_In_IDR: r.finalTotalIncome,
      Debt_Bills_IDR: r.creditBillsAmount,
      Debt_Share_Percent: `${r.creditDebtRatioPercent}%`,
      Routine_And_Daily_Living_IDR: r.routineAndDailyLivingAmount,
      Saved_P1_IDR: r.actualSavings,
      Transferred_To_Vault_IDR: r.realizedVaultAmount,
      Leftover_P2_IDR: r.selfReward,
      Discipline_Score: r.disciplineScore,
      Change_Vs_Last_Month: r.changeVsLastMonthSummary,
    })),
    {
      Month: `TOTAL / AVERAGE (${comp.periodCount} Months)`,
      Status: comp.scope === "locked" ? "Locked Only" : "All Periods",
      Money_In_IDR: comp.totals.totalIncome,
      Debt_Bills_IDR: comp.totals.totalCreditBills,
      Debt_Share_Percent: `${comp.totals.averageCreditDebtRatioPercent}%`,
      Routine_And_Daily_Living_IDR:
        comp.totals.totalFixedEssentials +
        comp.totals.totalDailyOperational +
        comp.totals.totalBufferPocket +
        comp.totals.totalManualDeductions,
      Saved_P1_IDR: comp.totals.totalSavings,
      Transferred_To_Vault_IDR: comp.totals.totalRealizedVault,
      Leftover_P2_IDR: comp.totals.totalSelfReward,
      Discipline_Score: comp.totals.averageDisciplineScore,
      Change_Vs_Last_Month: `Avg Savings Rate: ${comp.totals.averageSavingsRatePercent}%`,
    },
  ];

  const wsMom = finalizeFormattedSheet(momRows, ["Change_Vs_Last_Month"]);
  XLSX.utils.book_append_sheet(wb, wsMom, "2_Month_Comparison");

  // ---------------------------------------------------------------------------
  // Sheet 3: 3_Debt_Payoff_Schedule
  // ---------------------------------------------------------------------------
  const amort = report.amortizationSchedule;
  const scheduleRows = [
    ...amort.months.map((m) => ({
      Month: m.periodLabel,
      PayLater_Bill_IDR: m.paylaterAmount,
      Credit_Card_Statement_IDR: m.creditCardAmount,
      Personal_Debt_IDR: m.personalDebtAmount,
      Contract_Installments_IDR: m.contractInstallmentsAmount,
      Total_Debt_Due_IDR: m.totalLiabilityDue,
      Payoff_Progress_Percent: `${m.cumulativeSettledPercent}%`,
      Active_Installments_Countdown:
        m.activeInstallmentSlices.length > 0
          ? m.activeInstallmentSlices
              .map((s) => `${s.label} [${s.sliceBadge}]`)
              .join(", ")
          : "None",
      Dropping_Off_After_This_Month:
        m.droppingOffAfterThisMonth.length > 0
          ? m.droppingOffAfterThisMonth.join(", ")
          : "—",
    })),
    {
      Month: "12-MONTH TOTAL",
      PayLater_Bill_IDR: amort.summary.totalPaylater12M,
      Credit_Card_Statement_IDR: amort.summary.totalCreditCard12M,
      Personal_Debt_IDR: amort.summary.totalPersonalDebt12M,
      Contract_Installments_IDR: amort.summary.totalContracts12M,
      Total_Debt_Due_IDR: amort.summary.total12MonthObligations,
      Payoff_Progress_Percent: `Peak: ${amort.summary.peakMonthLabel}`,
      Active_Installments_Countdown: `Peak Month Due: Rp ${amort.summary.peakMonthAmount.toLocaleString("id-ID")}`,
      Dropping_Off_After_This_Month: amort.summary.firstDebtFreeMonthLabel
        ? `First Debt-Free Month: ${amort.summary.firstDebtFreeMonthLabel}`
        : "Ongoing recurring subscriptions",
    },
  ];

  const wsSchedule = finalizeFormattedSheet(scheduleRows, [
    "Active_Installments_Countdown",
    "Dropping_Off_After_This_Month",
  ]);
  XLSX.utils.book_append_sheet(wb, wsSchedule, "3_Debt_Payoff_Schedule");

  // ---------------------------------------------------------------------------
  // Sheet 4: 4_Budget_Edits_Log
  // ---------------------------------------------------------------------------
  const dos = report.dossier;
  const dossierRows: Array<Record<string, string | number>> = [
    ...dos.revisions.map((r) => ({
      Entry_Type: "Budget Target Edit",
      Month: r.periodLabel,
      What_Changed: r.categoryLabel,
      Before_IDR: r.previousValue,
      After_IDR: r.newValue,
      Difference_IDR: r.difference,
      Reason_Or_Notes: r.reason,
      Recorded_At: r.createdAt.slice(0, 19).replace("T", " "),
    })),
    ...dos.periodAudits.map((a) => ({
      Entry_Type: "Monthly Discipline Scorecard",
      Month: a.periodLabel,
      What_Changed: "7-Rule Financial Health Check",
      Before_IDR: a.status === "LOCKED" ? "Closed" : "Draft",
      After_IDR: a.disciplineScore,
      Difference_IDR: `${a.greenCount} Passed / ${a.redCount} Attention`,
      Reason_Or_Notes: a.flags
        .map((f) => `${f.type === "GREEN" ? "PASS" : "ALERT"}: ${f.title}`)
        .join(" | "),
      Recorded_At: "—",
    })),
    ...dos.recentGovernanceLogs.map((l) => ({
      Entry_Type: l.actionLabel,
      Month: l.month && l.year ? `${l.month}/${l.year}` : "System",
      What_Changed: l.categoryLabel,
      Before_IDR: l.severity,
      After_IDR: "—",
      Difference_IDR: "—",
      Reason_Or_Notes: `${l.summary}${l.details ? ` — ${l.details}` : ""}`,
      Recorded_At: l.createdAt.slice(0, 19).replace("T", " "),
    })),
  ];

  const wsDossier = finalizeFormattedSheet(dossierRows, [
    "What_Changed",
    "Reason_Or_Notes",
  ]);
  XLSX.utils.book_append_sheet(wb, wsDossier, "4_Budget_Edits_Log");

  // ---------------------------------------------------------------------------
  // Sheet 5: 5_3Month_Forecast
  // ---------------------------------------------------------------------------
  const lf = report.liquidityForecast;
  const forecastRows = (lf?.months ?? []).map((m) => ({
    Horizon: `Month +${m.monthOffset}`,
    Period: m.periodLabel,
    Expected_Payday: m.expectedPaydayLabel,
    Cycle_Window: m.cycleDateLabel,
    Projected_Money_In_IDR: m.projectedFinalTotalIncome,
    Projected_Debt_Bills_IDR: m.liabilities.projectedTotalDeductions,
    Credit_Card_Bills_IDR: m.liabilities.creditCardsTotal,
    PayLater_And_Personal_Debt_IDR: m.liabilities.bulkBillsTotal,
    Contracts_And_Scheduled_IDR:
      m.liabilities.contractsTotal + m.liabilities.scheduledBillsTotal,
    Debt_Ratio_Percent: `${m.liabilities.debtRatioPercent}%`,
    Routine_Bills_And_Buffer_IDR:
      m.projectedFixedEssentials + m.projectedBufferPocket,
    Projected_Daily_Living_IDR: m.waterfall.projectedDailyOperational,
    P1_Savings_Target_IDR: m.waterfall.p1SavingsTarget,
    Projected_Funded_Savings_IDR: m.waterfall.projectedFundedSavings,
    Projected_Leftover_P2_IDR: m.waterfall.projectedSelfRewardSurplus,
    Forecast_Verdict:
      m.liquidityStatus === "HEALTHY_SURPLUS"
        ? "Healthy Surplus"
        : m.liquidityStatus === "SAVINGS_COMPRESSED"
          ? "Savings Compressed"
          : "Deficit Squeeze",
    Recommended_P1_Adjustment_IDR: m.recommendedP1SavingsReduction,
    Plain_Language_Warning: m.squeezeBannerText ?? "All bills and savings targets covered.",
  }));

  const wsForecast = finalizeFormattedSheet(forecastRows, [
    "Plain_Language_Warning",
  ]);
  XLSX.utils.book_append_sheet(wb, wsForecast, "5_3Month_Forecast");

  return wb;
}

export function exportExecutiveReportToExcel(
  report: ExecutiveReportPayload,
  profileMode: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL" = "SUPERADMIN_BESPOKE"
) {
  const wb = buildExecutiveReportWorkbook(report, profileMode);
  const mm = String(report.selectedMonth).padStart(2, "0");
  const fileName = `SundayFunday_ERP_Report_${report.selectedYear}_${mm}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
