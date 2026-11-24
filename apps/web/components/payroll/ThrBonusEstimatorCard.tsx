"use client";

import React, { useMemo, useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { ThrConfig } from "@/lib/api";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface ThrBonusEstimatorCardProps {
  baseSalary: number;
  dailyAllowance: number;
  laptopAllowance: number;
  currentWorkingDays: number;
  currentSalaryAdjustment: number;
  currentCafeteriaDeduction: number;
  currentExtraIncome: number;
  currentThrAmount?: number;
  currentMonth?: number;
  thrConfig?: ThrConfig | null;
  directDeductionsTotal?: number;
}

type EstimatorMethod = "EXACT_DAYS" | "MONTHS_PRORATED" | "FULL_100" | "CUSTOM";

function diffCalendarDaysInclusive(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(`${startIso.slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${endIso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return null;
  }
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(0, Math.min(365, days));
}

export function ThrBonusEstimatorCard({
  baseSalary,
  dailyAllowance,
  laptopAllowance,
  currentWorkingDays,
  currentSalaryAdjustment,
  currentCafeteriaDeduction,
  currentExtraIncome,
  currentThrAmount = 0,
  currentMonth = 12,
  thrConfig,
  directDeductionsTotal = 0,
}: ThrBonusEstimatorCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const adjustedBase = Math.max(0, baseSalary + currentSalaryAdjustment);
  const thrBase = thrConfig?.includeFixedAllowances
    ? adjustedBase + laptopAllowance
    : adjustedBase;

  const thrLabel = thrConfig?.label?.trim() || "Holiday Bonus (THR)";
  const joinDateIso = thrConfig?.joinDateIso?.trim() || "";
  const holidayDateIso = thrConfig?.holidayDateIso?.trim() || "";
  const exactDays = useMemo(
    () => diffCalendarDaysInclusive(joinDateIso, holidayDateIso),
    [joinDateIso, holidayDateIso],
  );
  const payoutMonth = thrConfig?.payoutMonth ?? 12;

  const defaultTenureMonths = useMemo(() => {
    if (currentThrAmount > 0 && thrBase > 0) {
      return Math.round((currentThrAmount / thrBase) * 12 * 100) / 100;
    }
    if (exactDays !== null) {
      return Math.round((exactDays / 365) * 12 * 100) / 100;
    }
    return 12;
  }, [currentThrAmount, exactDays, thrBase]);

  const initialMethod: EstimatorMethod =
    thrConfig?.calculationMode === "EXACT_DAYS_365" && exactDays !== null
      ? "EXACT_DAYS"
      : thrConfig?.calculationMode === "FULL_MONTH"
        ? "FULL_100"
        : thrConfig?.calculationMode === "STATUTORY_MONTHS_12"
          ? "MONTHS_PRORATED"
          : currentMonth === payoutMonth && exactDays !== null
            ? "EXACT_DAYS"
            : "MONTHS_PRORATED";

  const [simulatedDays, setSimulatedDays] = useState<number>(
    currentWorkingDays > 0 ? currentWorkingDays : 20,
  );
  const [method, setMethod] = useState<EstimatorMethod>(initialMethod);
  const [tenureMonths, setTenureMonths] = useState<number>(defaultTenureMonths);
  const [customThrInput, setCustomThrInput] = useState<number>(currentThrAmount);
  const [bonusFactorMonths, setBonusFactorMonths] = useState<number>(0);

  const bpjsDeduction = Math.round(adjustedBase * 0.03);
  const netBase = adjustedBase - bpjsDeduction + laptopAllowance;
  const attendanceTotal = simulatedDays * dailyAllowance;

  const exactDaysThr = exactDays !== null ? Math.round((exactDays / 365) * thrBase) : 0;
  const monthsThr = Math.round(thrBase * (Math.min(12, Math.max(0, tenureMonths)) / 12));

  const estimatedThr =
    method === "EXACT_DAYS" && exactDays !== null
      ? exactDaysThr
      : method === "FULL_100"
        ? thrBase
        : method === "CUSTOM"
          ? Math.max(0, Math.round(customThrInput))
          : monthsThr;

  const projectedBonus = Math.round(adjustedBase * Math.max(0, bonusFactorMonths));
  const projectedSlipNet = Math.max(0, netBase + attendanceTotal - currentCafeteriaDeduction);
  const projectedBankTransfer = Math.max(0, projectedSlipNet - Math.max(0, directDeductionsTotal));
  const projectedTakeHome =
    projectedBankTransfer + estimatedThr + projectedBonus + currentExtraIncome;

  const dayGrid = [19, 20, 21, 22, 23];

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2.5 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
            {thrLabel} &amp; Attendance Estimator
          </h3>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            {thrConfig?.includeFixedAllowances
              ? `Prorated on base + fixed allowances (${formatRupiah(thrBase, isAmountsMasked)}).`
              : `Prorated strictly on base salary (${formatRupiah(thrBase, isAmountsMasked)}), excluding variable attendance.`}
          </p>
        </div>

        <div className="inline-flex flex-wrap items-center rounded border border-border bg-canvas p-0.5 text-[10px] font-mono">
          {exactDays !== null && (
            <button
              type="button"
              onClick={() => setMethod("EXACT_DAYS")}
              className={`px-2 py-1 rounded-sm cursor-pointer ${
                method === "EXACT_DAYS"
                  ? "bg-surface-active text-text-primary font-semibold"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              {exactDays}/365 Days
            </button>
          )}
          <button
            type="button"
            onClick={() => setMethod("MONTHS_PRORATED")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              method === "MONTHS_PRORATED"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Months / 12
          </button>
          <button
            type="button"
            onClick={() => setMethod("FULL_100")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              method === "FULL_100"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Full 100%
          </button>
          <button
            type="button"
            onClick={() => setMethod("CUSTOM")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              method === "CUSTOM"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {exactDays !== null && (
        <div className="px-3 py-2 rounded bg-canvas border border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-secondary">
          <span>
            Service Window: {joinDateIso.slice(0, 10)} to {holidayDateIso.slice(0, 10)} ({exactDays}/365 days)
          </span>
          <span>
            Exact Prorated:{" "}
            <strong className="text-delta-positive tabular-nums">
              {formatRupiah(exactDaysThr, isAmountsMasked)}
            </strong>
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-sans text-text-secondary mb-1">
            Attendance Days ({formatRupiah(dailyAllowance, isAmountsMasked)}/d)
          </label>
          <input
            type="number"
            min={0}
            max={31}
            value={simulatedDays}
            onChange={(e) => setSimulatedDays(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
          />
        </div>

        {method === "CUSTOM" ? (
          <div>
            <label className="block text-[11px] font-sans text-text-secondary mb-1">
              Custom Holiday Bonus (Rp)
            </label>
            <input
              type="number"
              min={0}
              step={50000}
              value={customThrInput}
              onChange={(e) => setCustomThrInput(Math.max(0, Number(e.target.value) || 0))}
              className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[11px] font-sans text-text-secondary mb-1">
              Tenure Weight (Months / 12)
            </label>
            <input
              type="number"
              min={0}
              max={12}
              step={0.1}
              value={tenureMonths}
              onChange={(e) =>
                setTenureMonths(Math.min(12, Math.max(0, Number(e.target.value) || 0)))
              }
              disabled={method !== "MONTHS_PRORATED"}
              className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-sans text-text-secondary mb-1">
            Annual Bonus (x Base)
          </label>
          <input
            type="number"
            min={0}
            max={12}
            step={0.25}
            value={bonusFactorMonths}
            onChange={(e) => setBonusFactorMonths(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-text-secondary"
          />
        </div>
      </div>

      <div className="p-3 rounded bg-surface-subtle border border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">Attendance</span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(attendanceTotal, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">Est. {thrLabel}</span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(estimatedThr, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">Slip Net Pay</span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(projectedSlipNet, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">
            Total Cycle Inflow
          </span>
          <span className="font-mono font-semibold text-delta-positive tabular-nums mt-0.5 block">
            {formatRupiah(projectedTakeHome, isAmountsMasked)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-tertiary pt-1 border-t border-border-subtle">
        {dayGrid.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSimulatedDays(d)}
            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer tabular-nums ${
              simulatedDays === d
                ? "border-delta-positive/40 bg-delta-positive/10 text-delta-positive"
                : "border-border-subtle bg-surface-subtle hover:border-border-default text-text-secondary"
            }`}
          >
            {d}d: {formatRupiah(netBase + d * dailyAllowance - currentCafeteriaDeduction, isAmountsMasked)}
          </button>
        ))}
      </div>
    </div>
  );
}
