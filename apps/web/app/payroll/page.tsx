import React from "react";
import { fetchSnapshot, fetchPayroll, fetchGlobalConfig } from "@/lib/api";
import { MetricCard } from "@/components/primitives/MetricCard";
import { PayrollStatementTable } from "@/components/payroll/PayrollStatementTable";
import { PayrollAdjustmentForm } from "@/components/payroll/PayrollAdjustmentForm";
import { PayrollArchetypeSelector } from "@/components/payroll/PayrollArchetypeSelector";
import { ContractualBaseRateEditor } from "@/components/payroll/ContractualBaseRateEditor";
import { QuickIncomeForm } from "@/components/payroll/QuickIncomeForm";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { formatRupiah, getDefaultPayrollPeriod } from "@/lib/utils";

interface PayrollPageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function PayrollPage({ searchParams }: PayrollPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  // Temporal boundary guard: tracking begins in July 2026
  if (year < 2026 || (year === 2026 && month < 7)) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  // Fetch payroll breakdown, snapshot, and global config in parallel
  const [snapshot, payroll, config] = await Promise.all([
    fetchSnapshot(month, year),
    fetchPayroll(month, year),
    fetchGlobalConfig(),
  ]);

  const isLocked = snapshot?.status === "LOCKED";
  const finalTotalIncome = payroll?.finalTotalIncome ?? snapshot?.finalTotalIncome ?? 0;
  const netSalaryIncome = payroll?.netSalaryIncome ?? snapshot?.netSalaryIncome ?? 0;
  const extraIncome = payroll?.extraIncome ?? snapshot?.extraIncome ?? 0;
  const workingDays = payroll?.totalWorkingDays ?? snapshot?.totalWorkingDays ?? 0;

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header & Status Bar */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Payroll & Income
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Calculated monthly payroll statement, working days adjustment, and windfall tracking.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium border ${
              isLocked
                ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                : "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
            }`}
          >
            {snapshot?.status ?? "DRAFT"}
          </span>
        </div>
      </div>

      {/* Income Archetype Selector (Visible in Standard Edition) */}
      <PayrollArchetypeSelector />

      {/* Top Metric Cards */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary uppercase tracking-wider">
          Cashflow Highlights
        </div>
        <div className="grid grid-cols-12 gap-4">
          {/* Centerpiece: Final Total Income */}
          <div className="col-span-5">
            <MetricCard
              label="Final Total Income"
              value={formatRupiah(finalTotalIncome)}
              footer="Net distributed salary + bonuses + THR + windfall"
              isCenterpiece={true}
              statusVariant="default"
            />
          </div>

          {/* Net Distributed Base */}
          <div className="col-span-3">
            <MetricCard
              label="Net Distributed Salary"
              value={formatRupiah(netSalaryIncome)}
              footer="Base payroll + daily allowances - BPJS"
              statusVariant="default"
            />
          </div>

          {/* Windfall / Extra */}
          <div className="col-span-2">
            <MetricCard
              label="Extra / Windfall"
              value={formatRupiah(extraIncome)}
              footer="Freelance & bonuses"
              statusVariant="default"
            />
          </div>

          {/* Working Days */}
          <div className="col-span-2">
            <MetricCard
              label="Working Days"
              value={`${workingDays} days`}
              footer="Attended office days"
              statusVariant="default"
            />
          </div>
        </div>
      </section>

      {/* Main Content: Itemized Statement & Adjustments */}
      <section className="grid grid-cols-12 gap-6 items-start">
        {/* Left Column: Itemized Payroll Statement (7 cols) */}
        <div className="col-span-7 space-y-4">
          {payroll ? (
            <PayrollStatementTable payroll={payroll} />
          ) : (
            <div className="bg-surface border border-border-subtle rounded-lg p-6 text-center text-xs font-sans text-text-tertiary">
              No payroll calculation found for period {month}/{year}.
            </div>
          )}
        </div>

        {/* Right Column: Parameters Form, Contract Rates & Income Logger (5 cols) */}
        <div className="col-span-5 space-y-6">
          {snapshot && (
            <PayrollAdjustmentForm
              key={`payroll-form-${snapshot.id}-${month}-${year}`}
              snapshotId={snapshot.id}
              month={month}
              year={year}
              isLocked={isLocked}
              initialWorkingDays={snapshot.totalWorkingDays ?? 0}
              initialSalaryAdjustment={snapshot.salaryAdjustment ?? 0}
              initialCafeteriaDeduction={snapshot.cafeteriaDeduction ?? 0}
              initialBonusAmount={snapshot.bonusAmount ?? 0}
              hasThr={(snapshot.thrAmount ?? 0) > 0}
              initialThrAmount={snapshot.thrAmount ?? 0}
              baseSalary={config?.baseSalary ?? 5300000}
              initialPayrollPayoutDate={snapshot.payrollPayoutDate}
            />
          )}

          <ContractualBaseRateEditor
            key={`contract-rates-${month}-${year}`}
            month={month}
            year={year}
            isLocked={isLocked}
            config={config}
          />

          <QuickIncomeForm
            month={month}
            year={year}
            isLocked={isLocked}
          />
        </div>
      </section>
    </div>
  );
}
