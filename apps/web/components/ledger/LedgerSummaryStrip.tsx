import { Transaction, MonthlySnapshot } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface LedgerSummaryStripProps {
  transactions: Transaction[];
  snapshot: MonthlySnapshot | null;
}

export function LedgerSummaryStrip({ transactions, snapshot }: LedgerSummaryStripProps) {
  const snapshotIncome = snapshot?.finalTotalIncome ?? snapshot?.netSalaryIncome ?? 0;
  const extraIncomeSum = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);

  // If snapshot has computed income, use that (it includes extraIncome); otherwise sum manual income
  const totalInflow = snapshotIncome > 0 ? snapshotIncome : extraIncomeSum;

  const totalOutflow = transactions
    .filter((t) => t.type === "DEDUCTION" || t.type === "CREDIT_BILL")
    .reduce((sum, t) => sum + t.amount, 0);

  const netCashflow = totalInflow - totalOutflow;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Total Inflow */}
      <div className="col-span-4 rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
        <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
          TOTAL PERIOD INFLOW
        </div>
        <div className="my-2">
          <div className="font-mono text-[22px] font-semibold leading-none tracking-tight text-delta-positive tabular-nums">
            +{formatRupiah(totalInflow)}
          </div>
          <div className="text-xs font-sans text-text-tertiary mt-1.5">
            Net salary, allowances & auxiliary income
          </div>
        </div>
        <div className="text-[11px] font-mono text-text-tertiary pt-2 border-t border-border-subtle">
          {snapshot?.month ?? "-"}/{snapshot?.year ?? "-"} payroll cycle
        </div>
      </div>

      {/* Total Outflow */}
      <div className="col-span-4 rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
        <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
          TOTAL PERIOD OUTFLOW
        </div>
        <div className="my-2">
          <div className="font-mono text-[22px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
            -{formatRupiah(totalOutflow)}
          </div>
          <div className="text-xs font-sans text-text-tertiary mt-1.5">
            Materialized debt, credit bills & daily expenses
          </div>
        </div>
        <div className="text-[11px] font-mono text-text-tertiary pt-2 border-t border-border-subtle">
          {transactions.filter((t) => t.type !== "INCOME").length} expense & liability items
        </div>
      </div>

      {/* Net Period Cashflow */}
      <div className="col-span-4 rounded-lg border border-border bg-surface p-4 flex flex-col justify-between">
        <div className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
          NET PERIOD CASHFLOW
        </div>
        <div className="my-2">
          <div
            className={`font-mono text-[22px] font-semibold leading-none tracking-tight tabular-nums ${
              netCashflow >= 0 ? "text-delta-positive" : "text-delta-negative"
            }`}
          >
            {netCashflow >= 0 ? `+${formatRupiah(netCashflow)}` : formatRupiah(netCashflow)}
          </div>
          <div className="text-xs font-sans text-text-tertiary mt-1.5">
            Retained cash before savings & investment allocation
          </div>
        </div>
        <div className="text-[11px] font-mono text-text-tertiary pt-2 border-t border-border-subtle">
          {transactions.length} total logged transactions
        </div>
      </div>
    </div>
  );
}
