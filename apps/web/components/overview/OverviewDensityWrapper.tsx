"use client";

import React from "react";
import Link from "next/link";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { MonthlySnapshot, DailyPacing, SavingsVault } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { PrivacyEyeButton } from "@/components/shell/PrivacyEyeButton";
import { RecordExpenseCard } from "@/components/overview/RecordExpenseCard";

interface OverviewDensityWrapperProps {
  snapshot: MonthlySnapshot | null;
  pacing: DailyPacing | null;
  vault: SavingsVault | null;
  month: number;
  year: number;
  isLocked: boolean;
  fixedEssentialsTotal: number;
  children: React.ReactNode;
}

export function OverviewDensityWrapper({
  snapshot,
  pacing,
  vault,
  month,
  year,
  isLocked,
  fixedEssentialsTotal,
  children,
}: OverviewDensityWrapperProps) {
  const { uiDensityMode, setUiDensityMode, formulaEngineType } = usePerspective();
  const { isAmountsMasked } = usePrivacyMask();

  if (uiDensityMode !== "SIMPLE_CLARITY") {
    return <>{children}</>;
  }

  const totalIncome = snapshot?.finalTotalIncome ?? snapshot?.netSalaryIncome ?? 0;
  const safeDaily = pacing?.safeToSpendToday ?? pacing?.baselineDailyRate ?? 0;
  const remainingDailyBudget =
    pacing?.remainingBudget ?? snapshot?.actualDailyOperational ?? 0;
  const daysRemaining = pacing?.daysRemaining ?? 30;
  const routineAndBillsTotal =
    fixedEssentialsTotal + (snapshot?.totalDeductions ?? 0);
  const totalSavingsBalance =
    (vault?.balance ?? 0) > 0
      ? vault?.balance ?? 0
      : snapshot?.actualSavings ?? 0;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between bg-surface border border-border rounded-md px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Simple Clarity Overview
          </h2>
          <p className="text-sm text-text-secondary mt-0.5">
            High-contrast essential numbers with enlarged typography ({formulaEngineType.replace(/_/g, " ")}).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/preferences?tab=modules"
            className="px-4 py-2 text-sm font-medium rounded border border-border bg-surface-subtle text-text-primary hover:bg-surface transition-colors"
          >
            Manage Modules
          </Link>
          <button
            type="button"
            onClick={() => setUiDensityMode("COMMAND_COCKPIT")}
            className="px-4 py-2 text-sm font-medium rounded border border-border-strong bg-surface text-text-primary hover:bg-surface-subtle transition-colors"
          >
            Switch to Command Cockpit
          </button>
        </div>
      </div>

      {/* 4 High-Contrast Senior / Minimalist Cards */}
      <div className="grid grid-cols-2 gap-5">
        {/* Card 1: Monthly Income & Pension */}
        <div className="bg-surface border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Monthly Income & Pension
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="font-display text-4xl font-bold text-text-primary tabular-nums">
                {formatRupiah(totalIncome, isAmountsMasked)}
              </div>
              <PrivacyEyeButton size="lg" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between text-base text-text-secondary">
            <span>Net Monthly Inflow ({month}/{year})</span>
            <Link
              href={`/payroll?month=${month}&year=${year}`}
              className="text-sm font-medium text-text-primary underline underline-offset-4"
            >
              Adjust Inflow
            </Link>
          </div>
        </div>

        {/* Card 2: Safe Daily Spending */}
        <div className="bg-surface border border-border-strong rounded-md p-6 flex flex-col justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-delta-positive">
              Safe Daily Spending Today
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="font-display text-4xl font-bold text-delta-positive tabular-nums">
                {formatRupiah(safeDaily, isAmountsMasked)}
              </div>
              <PrivacyEyeButton size="lg" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between text-base text-text-secondary">
            <span>
              Remaining Living Pool: <strong className="text-text-primary font-mono">{formatRupiah(remainingDailyBudget, isAmountsMasked)}</strong>
            </span>
            <span className="font-mono text-sm">
              {daysRemaining} days left
            </span>
          </div>
        </div>

        {/* Card 3: Routine Monthly Bills */}
        <div className="bg-surface border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Routine Monthly Bills & Healthcare
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="font-display text-4xl font-bold text-text-primary tabular-nums">
                {formatRupiah(routineAndBillsTotal, isAmountsMasked)}
              </div>
              <PrivacyEyeButton size="lg" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between text-base text-text-secondary">
            <span>
              Routine Envelopes: <strong className="text-text-primary font-mono">{formatRupiah(fixedEssentialsTotal, isAmountsMasked)}</strong>
            </span>
            <Link
              href={`/allocations?month=${month}&year=${year}`}
              className="text-sm font-medium text-text-primary underline underline-offset-4"
            >
              View Envelopes
            </Link>
          </div>
        </div>

        {/* Card 4: Savings Balance */}
        <div className="bg-surface border border-border rounded-md p-6 flex flex-col justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
              Savings Balance & Reserve
            </div>
            <div className="flex items-center gap-2 mt-3">
              <div className="font-display text-4xl font-bold text-text-primary tabular-nums">
                {formatRupiah(totalSavingsBalance, isAmountsMasked)}
              </div>
              <PrivacyEyeButton size="lg" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-subtle flex items-center justify-between text-base text-text-secondary">
            <span>
              This Period Allocation: <strong className="text-text-primary font-mono">{formatRupiah(snapshot?.actualSavings ?? 0, isAmountsMasked)}</strong>
            </span>
            <Link
              href={`/savings?month=${month}&year=${year}`}
              className="text-sm font-medium text-text-primary underline underline-offset-4"
            >
              Open Savings
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Expense Entry for Simple Clarity */}
      <div className="max-w-xl">
        <RecordExpenseCard month={month} year={year} isLocked={isLocked} />
      </div>
    </section>
  );
}

