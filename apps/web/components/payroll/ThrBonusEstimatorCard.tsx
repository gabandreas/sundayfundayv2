"use client";

import React, { useState } from "react";
import { formatRupiah } from "@/lib/utils";
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
  currentMonth = 11,
}: ThrBonusEstimatorCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const adjustedBase = Math.max(0, baseSalary + currentSalaryAdjustment);
  const derivedDefaultTenure =
    currentThrAmount > 0 && adjustedBase > 0
      ? Math.round((currentThrAmount / adjustedBase) * 12 * 100) / 100
      : currentMonth === 12
        ? 8.83
        : 12;

  const [simulatedDays, setSimulatedDays] = useState<number>(
    currentWorkingDays > 0 ? currentWorkingDays : 21
  );
  const [tenureMonths, setTenureMonths] = useState<number>(derivedDefaultTenure);
  const [bonusFactorMonths, setBonusFactorMonths] = useState<number>(0);

  const bpjsDeduction = Math.round(adjustedBase * 0.03);
  const netBase = adjustedBase - bpjsDeduction + laptopAllowance;
  const attendanceTotal = simulatedDays * dailyAllowance;
  const proratedThr = Math.round(adjustedBase * (Math.min(12, Math.max(0, tenureMonths)) / 12));
  const projectedBonus = Math.round(adjustedBase * Math.max(0, bonusFactorMonths));
  const projectedNetSalary = Math.max(0, netBase + attendanceTotal - currentCafeteriaDeduction);
  const projectedTakeHome = projectedNetSalary + proratedThr + projectedBonus + currentExtraIncome;

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5 space-y-4">
      <div className="pb-2.5 border-b border-border-subtle">
        <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
          THR, Bonus & Attendance Sensitivity Estimator
        </h3>
        <p className="text-xs font-sans text-text-tertiary mt-0.5">
          Non-destructive simulator for attendance-day variances and prorated holiday allowance (THR).
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-sans text-text-secondary mb-1">
            Attendance Days ({formatRupiah(dailyAllowance, isAmountsMasked)}/d)
          </label>
          <input
            type="number"
            min={0}
            max={26}
            value={simulatedDays}
            onChange={(e) => setSimulatedDays(Math.max(0, Number(e.target.value) || 0))}
            className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
          />
        </div>

        <div>
          <label className="block text-[11px] font-sans text-text-secondary mb-1">
            THR Tenure (Months / 12)
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
            className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
          />
        </div>

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
            className="w-full px-2.5 py-1.5 rounded bg-surface-subtle border border-border-default font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
          />
        </div>
      </div>

      {/* Projected Output Summary */}
      <div className="p-3 rounded bg-surface-subtle border border-border-subtle grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-[10px] font-sans uppercase text-text-tertiary block">
            Attendance
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(attendanceTotal, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans uppercase text-text-tertiary block">
            Est. THR
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(proratedThr, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans uppercase text-text-tertiary block">
            Regular Net Pay
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(projectedNetSalary, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans uppercase text-text-tertiary block">
            Total Projected
          </span>
          <span className="font-mono font-semibold text-delta-positive tabular-nums mt-0.5 block">
            {formatRupiah(projectedTakeHome, isAmountsMasked)}
          </span>
        </div>
      </div>

      {/* Quick Attendance Reference Matrix */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-tertiary pt-1 border-t border-border-subtle">
        {[19, 20, 21, 22, 23].map((d) => (
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
