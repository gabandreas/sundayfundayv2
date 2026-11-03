import * as XLSX from "xlsx";
import { Transaction } from "./api";
import { formatTransactionType, formatSourceType, formatDate } from "./utils";

export interface LedgerExportOptions {
  month: number;
  year: number;
  snapshotStatus?: string;
  transactions: Transaction[];
}

export function exportLedgerToExcel({
  month,
  year,
  snapshotStatus = "DRAFT",
  transactions,
}: LedgerExportOptions) {
  // 1. Prepare Transactions Sheet Data
  const txRows = transactions.map((t) => ({
    ID: t.id,
    Date: formatDate(t.date),
    Description: t.label,
    Type: formatTransactionType(t.type),
    Source: formatSourceType(t.sourceType) || "Manual",
    "Amount (IDR)": t.amount,
  }));

  const wsTransactions = XLSX.utils.json_to_sheet(txRows);

  // Auto-fit column widths
  wsTransactions["!cols"] = [
    { wch: 8 },  // ID
    { wch: 15 }, // Date
    { wch: 35 }, // Description
    { wch: 15 }, // Type
    { wch: 18 }, // Source
    { wch: 18 }, // Amount
  ];

  // 2. Prepare Summary Sheet Data
  const totalInflow = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalOutflow = transactions
    .filter((t) => t.type === "DEDUCTION" || t.type === "CREDIT_BILL")
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashflow = totalInflow - totalOutflow;

  const summaryRows = [
    { Metric: "Period", Value: `${month.toString().padStart(2, "0")}/${year}` },
    { Metric: "Snapshot Status", Value: snapshotStatus },
    { Metric: "Total Transactions", Value: transactions.length },
    { Metric: "Total Inflow (Income)", Value: totalInflow },
    { Metric: "Total Outflow (Deductions & Debt)", Value: totalOutflow },
    { Metric: "Net Cashflow", Value: netCashflow },
    { Metric: "Exported At", Value: new Date().toISOString().replace("T", " ").substring(0, 19) },
  ];

  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary["!cols"] = [{ wch: 32 }, { wch: 25 }];

  // 3. Create Workbook & Append Sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsTransactions, "Transactions");
  XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

  // 4. Download file
  const fileName = `Ledger_${year}_${month.toString().padStart(2, "0")}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
