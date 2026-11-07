"use client";

import React, { useState, useRef, useEffect, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Calendar,
  Plus,
  X,
  Loader2,
} from "lucide-react";
import { initializeNewPeriod } from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";

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

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false);
  const [newMonth, setNewMonth] = useState<number>(currentMonth === 12 ? 1 : currentMonth + 1);
  const [newYear, setNewYear] = useState<number>(currentMonth === 12 ? currentYear + 1 : currentYear);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDropdownOpen]);

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
    <div className="relative" ref={dropdownRef}>
      {/* Unified Period Capsule: [ ‹  Oct 2026 ▾  › ] */}
      <div
        className={`flex items-center h-8 rounded-md border border-border bg-surface shadow-xs transition-opacity ${
          isPending ? "opacity-60" : "opacity-100"
        }`}
      >
        {/* Previous Month Button: ‹ */}
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={isAtStartBoundary}
          title={isAtStartBoundary ? "Historical boundary reached (July 2026)" : "Previous Month"}
          aria-label="Previous Month"
          className={`h-full px-2 flex items-center justify-center transition-colors rounded-l-md ${
            isAtStartBoundary
              ? "text-text-disabled cursor-not-allowed opacity-30"
              : "text-text-tertiary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>

        {/* Center Trigger: Oct 2026 ▾ */}
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          className="h-full px-2.5 flex items-center gap-1.5 text-xs font-sans font-medium text-text-primary hover:bg-surface-hover transition-colors cursor-pointer select-none border-x border-border-subtle"
          title="Select Financial Period"
        >
          <span className="font-sans font-medium">{MONTH_SHORT[currentMonth - 1]}</span>
          <span className="font-mono text-text-secondary">{currentYear}</span>
          <ChevronDown
            className={`w-3 h-3 text-text-tertiary transition-transform ${
              isDropdownOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Next Month Button: › */}
        <button
          type="button"
          onClick={handleNextMonth}
          title="Next Month"
          aria-label="Next Month"
          className="h-full px-2 flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors rounded-r-md cursor-pointer"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Unified Popover Dropdown */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-1.5 w-60 rounded-md border border-border bg-surface shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-100">
          {/* Year selector tabs */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border-subtle px-1">
            <span className="text-[10px] font-sans font-semibold text-text-tertiary uppercase tracking-wider">
              Year
            </span>
            <div className="flex items-center gap-1">
              {availableYears.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    const targetMonth =
                      y === START_YEAR && currentMonth < START_MONTH ? START_MONTH : currentMonth;
                    navigateToPeriod(targetMonth, y);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors cursor-pointer ${
                    y === currentYear
                      ? "bg-surface-active text-text-primary font-semibold border border-border"
                      : "text-text-tertiary hover:text-text-secondary"
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* 12-Month Grid */}
          <div className="grid grid-cols-4 gap-1 p-1">
            {MONTH_SHORT.map((short, idx) => {
              const mNum = idx + 1;
              const isSelected = mNum === currentMonth;
              const isBeforeStart = currentYear === START_YEAR && mNum < START_MONTH;
              return (
                <button
                  key={short}
                  type="button"
                  disabled={isBeforeStart}
                  onClick={() => {
                    navigateToPeriod(mNum, currentYear);
                    setIsDropdownOpen(false);
                  }}
                  className={`py-1 text-center text-xs font-sans rounded transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-surface-active text-text-primary font-semibold border border-border"
                      : isBeforeStart
                      ? "text-text-disabled cursor-not-allowed opacity-30"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  {short}
                </button>
              );
            })}
          </div>

          {/* Bottom Divider & Actions */}
          <div className="mt-2 pt-2 border-t border-border-subtle space-y-1">
            {!isCurrentPeriod && (
              <button
                type="button"
                onClick={() => {
                  handleResetToCurrent();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-subtle rounded transition-colors text-left cursor-pointer"
              >
                <span>Jump to Current Period</span>
                <span className="font-mono text-[10px] text-text-tertiary">
                  {MONTH_SHORT[defaultPeriod.month - 1]} {defaultPeriod.year}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                handleOpenNewPeriod();
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-text-primary hover:bg-surface-subtle rounded transition-colors text-left cursor-pointer font-medium"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Initialize New Period...</span>
            </button>
          </div>
        </div>
      )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
                    MONTH
                  </label>
                  <select
                    value={newMonth}
                    onChange={(e) => setNewMonth(parseInt(e.target.value, 10))}
                    className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs text-text-primary font-sans focus:outline-none"
                  >
                    {MONTH_SHORT.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m} ({idx + 1})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-sans font-medium text-text-tertiary mb-1">
                    YEAR
                  </label>
                  <select
                    value={newYear}
                    onChange={(e) => setNewYear(parseInt(e.target.value, 10))}
                    className="w-full bg-surface-subtle border border-border rounded px-2.5 py-1.5 text-xs font-mono tabular-nums text-text-primary focus:outline-none"
                  >
                    {availableYears.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {initError && (
                <div className="p-2.5 bg-urgency/10 border border-urgency/30 rounded text-xs font-sans text-urgency">
                  {initError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsNewPeriodModalOpen(false)}
                  className="px-3 py-1.5 rounded text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-500 hover:bg-emerald-600 text-black transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isInitializing && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>{isInitializing ? "Creating..." : "Initialize"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
