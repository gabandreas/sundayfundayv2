"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Plus, X, Loader2 } from "lucide-react";
import { initializeNewPeriod } from "@/lib/api";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

import { getDefaultPayrollPeriod } from "@/lib/utils";

const START_YEAR = 2026;
const START_MONTH = 7; // July 2026 (app launch boundary)

export function MonthYearSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const defaultPeriod = getDefaultPayrollPeriod();

  // Read from search params, with fallback to active funding payroll period (M-1)
  const monthParam = searchParams.get("month");
  const yearParam = searchParams.get("year");

  const currentMonth = monthParam ? parseInt(monthParam, 10) : defaultPeriod.month;
  const currentYear = yearParam ? parseInt(yearParam, 10) : defaultPeriod.year;

  const isCurrentPeriod =
    currentMonth === defaultPeriod.month && currentYear === defaultPeriod.year;

  const isAtStartBoundary =
    currentYear < START_YEAR || (currentYear === START_YEAR && currentMonth <= START_MONTH);

  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newMonth, setNewMonth] = useState<number>(currentMonth === 12 ? 1 : currentMonth + 1);
  const [newYear, setNewYear] = useState<number>(currentMonth === 12 ? currentYear + 1 : currentYear);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const handleOpenNewPeriod = () => {
    const calcNextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
    const calcNextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
    setNewMonth(calcNextMonth);
    setNewYear(calcNextYear);
    setInitError(null);
    setIsNewPeriodModalOpen(true);
  };

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInitializing(true);
    setInitError(null);
    try {
      const res = await initializeNewPeriod({ month: newMonth, year: newYear });
      if (!res.success) {
        setInitError(res.error || "Failed to initialize period");
        setIsInitializing(false);
        return;
      }
      setIsNewPeriodModalOpen(false);
      setIsInitializing(false);
      navigateToPeriod(newMonth, newYear);
    } catch (err: any) {
      setInitError(err.message || "Failed to initialize period");
      setIsInitializing(false);
    }
  };

  const navigateToPeriod = (newMonth: number, newYear: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", newMonth.toString());
    params.set("year", newYear.toString());
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePrevMonth = () => {
    if (isAtStartBoundary) return;
    if (currentMonth === 1) {
      navigateToPeriod(12, currentYear - 1);
    } else {
      navigateToPeriod(currentMonth - 1, currentYear);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      navigateToPeriod(1, currentYear + 1);
    } else {
      navigateToPeriod(currentMonth + 1, currentYear);
    }
  };

  const handleMonthSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value, 10);
    navigateToPeriod(newMonth, currentYear);
  };

  const handleYearSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value, 10);
    const targetMonth =
      newYear === START_YEAR && currentMonth < START_MONTH ? START_MONTH : currentMonth;
    navigateToPeriod(targetMonth, newYear);
  };

  const handleResetToCurrent = () => {
    navigateToPeriod(defaultPeriod.month, defaultPeriod.year);
  };

  // Generate selectable years: dynamic rolling window starting from 2026
  const maxYear = Math.max(2028, currentYear + 3);
  const availableYears: number[] = [];
  for (let y = START_YEAR; y <= maxYear; y++) {
    availableYears.push(y);
  }

  return (
    <div className="flex items-center gap-2">
      {/* Control Pill: Prev, Month/Year selector, Next */}
      <div
        className={`flex items-center rounded-md border border-border bg-surface px-1 py-1 shadow-sm transition-opacity ${
          isPending ? "opacity-60" : "opacity-100"
        }`}
      >
        {/* Previous Month Button — strictly disabled at July 2026 boundary */}
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={isAtStartBoundary}
          title={isAtStartBoundary ? "Historical boundary reached (July 2026)" : "Previous Month"}
          aria-label="Previous Month"
          className={`p-1 rounded transition-colors ${
            isAtStartBoundary
              ? "text-text-disabled cursor-not-allowed opacity-30"
              : "text-text-tertiary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          }`}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.8} />
        </button>

        {/* Month Selector Dropdown */}
        <div className="relative mx-1">
          <select
            value={currentMonth}
            onChange={handleMonthSelect}
            aria-label="Select month"
            className="appearance-none bg-transparent pl-2 pr-5 py-0.5 text-xs font-sans font-medium text-text-primary cursor-pointer hover:text-text-primary focus:outline-none"
          >
            {MONTH_NAMES.map((name, idx) => {
              const monthNum = idx + 1;
              const isBeforeStart = currentYear === START_YEAR && monthNum < START_MONTH;
              return (
                <option
                  key={name}
                  value={monthNum}
                  disabled={isBeforeStart}
                  className={`bg-surface font-sans ${
                    isBeforeStart ? "text-text-disabled" : "text-text-primary"
                  }`}
                >
                  {MONTH_SHORT[idx]}
                </option>
              );
            })}
          </select>
          <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-text-tertiary">
            ▾
          </span>
        </div>

        <span className="text-border-strong select-none">/</span>

        {/* Year Selector Dropdown — JetBrains Mono strictly for numeric data */}
        <div className="relative mx-1">
          <select
            value={currentYear}
            onChange={handleYearSelect}
            aria-label="Select year"
            className="appearance-none bg-transparent pl-2 pr-5 py-0.5 text-xs font-mono font-medium tabular-nums text-text-primary cursor-pointer hover:text-text-primary focus:outline-none"
          >
            {availableYears.map((y) => (
              <option key={y} value={y} className="bg-surface text-text-primary font-mono tabular-nums">
                {y}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[9px] text-text-tertiary">
            ▾
          </span>
        </div>

        {/* Next Month Button — uncapped forward navigation */}
        <button
          type="button"
          onClick={handleNextMonth}
          title="Next Month"
          aria-label="Next Month"
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.8} />
        </button>
      </div>

      {/* Jump to Current Month Button (only visible when viewing a different period) */}
      {!isCurrentPeriod && (
        <button
          type="button"
          onClick={handleResetToCurrent}
          className="px-2 py-1 rounded text-[11px] font-sans text-text-tertiary hover:text-text-primary border border-border-subtle hover:border-border bg-surface-subtle transition-colors cursor-pointer"
        >
          Current ({MONTH_SHORT[defaultPeriod.month - 1]} {defaultPeriod.year})
        </button>
      )}

      {/* Initialize Next Period Action Button */}
      <button
        type="button"
        onClick={handleOpenNewPeriod}
        className="h-8 w-8 rounded text-xs font-sans font-medium bg-surface hover:bg-surface-active text-text-primary border border-border hover:border-border-strong transition-colors flex items-center justify-center cursor-pointer shadow-xs active:scale-95 shrink-0"
        title="Create New Period (e.g. 01/2027)"
        aria-label="Create New Period"
      >
        <Plus className="w-3.5 h-3.5 text-text-secondary hover:text-text-primary" />
      </button>

      {/* New Period Initialization Modal */}
      {isNewPeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-surface border border-border rounded-lg max-w-sm w-full p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-accent" />
                <h3 className="text-sm font-semibold text-text-primary font-sans">
                  Initialize New Financial Period
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewPeriodModalOpen(false)}
                className="text-text-tertiary hover:text-text-primary p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePeriod} className="space-y-4 pt-4">
              <p className="text-xs font-sans text-text-secondary leading-relaxed">
                Creates a new draft period, inherits global budget rules, auto-materializes active installment contracts, and rolls recurring subscriptions.
              </p>

              {initError && (
                <div className="p-2 rounded bg-urgency/10 border border-urgency/30 text-urgency text-xs">
                  {initError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
                    Month
                  </label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border text-xs font-sans text-text-primary focus:outline-none focus:border-accent"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m} ({idx + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
                    Year
                  </label>
                  <select
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                    className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-accent"
                  >
                    {[2026, 2027, 2028, 2029].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs font-sans text-text-secondary hover:text-text-primary border border-border hover:bg-surface-subtle transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="px-3.5 py-1.5 rounded text-xs font-sans font-medium bg-accent text-white hover:bg-accent/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isInitializing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isInitializing ? "Creating..." : "Initialize Period"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
