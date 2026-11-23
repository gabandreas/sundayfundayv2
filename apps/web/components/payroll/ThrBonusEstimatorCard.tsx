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
  const joinDateIso = "2026-04-06";
  const exactDays2026 = 264;
  const completedMonths2026 = 8;
  const derivedDefaultTenure =
    currentThrAmount > 0 && adjustedBase > 0
      ? Math.round((currentThrAmount / adjustedBase) * 12 * 100) / 100
      : currentMonth === 12
        ? Math.round((exactDays2026 / 365) * 12 * 100) / 100
        : 12;

  const [simulatedDays, setSimulatedDays] = useState<number>(
    currentWorkingDays > 0 ? currentWorkingDays : 21
  );
  const [thrMethod, setThrMethod] = useState<"SUNFISH_DAYS" | "PERMENAKER_FLOOR" | "CUSTOM">(
    currentMonth === 12 ? "SUNFISH_DAYS" : "CUSTOM"
  );
  const [tenureMonths, setTenureMonths] = useState<number>(derivedDefaultTenure);
  const [bonusFactorMonths, setBonusFactorMonths] = useState<number>(0);

  const bpjsDeduction = Math.round(adjustedBase * 0.03);
  const netBase = adjustedBase - bpjsDeduction + laptopAllowance;
  const attendanceTotal = simulatedDays * dailyAllowance;
  const sunfishExactThr = Math.round((exactDays2026 / 365) * adjustedBase);
  const permenakerFloorThr = Math.round((completedMonths2026 / 12) * adjustedBase);
  const aprilProofBase = Math.round((25 / 30) * adjustedBase);
  const proratedThr =
    thrMethod === "SUNFISH_DAYS"
      ? sunfishExactThr
      : thrMethod === "PERMENAKER_FLOOR"
        ? permenakerFloorThr
        : Math.round(adjustedBase * (Math.min(12, Math.max(0, tenureMonths)) / 12));
  const projectedBonus = Math.round(adjustedBase * Math.max(0, bonusFactorMonths));
  const projectedNetSalary = Math.max(0, netBase + attendanceTotal - currentCafeteriaDeduction);
  const projectedTakeHome = projectedNetSalary + proratedThr + projectedBonus + currentExtraIncome;

  return (
    <div className="bg-surface border border-border-default rounded-lg p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-2.5 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
            THR (Gross Base Only), Bonus &amp; Attendance Simulator
          </h3>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            THR prorates strictly on Gross Base Salary ({formatRupiah(adjustedBase, isAmountsMasked)}) excluding Laptop Allowance, paid max H-7 (~Dec 18 into Dec cycle).
          </p>
        </div>
        <div className="inline-flex items-center rounded border border-border bg-canvas p-0.5 text-[10px] font-mono">
          <button
            type="button"
            onClick={() => setThrMethod("SUNFISH_DAYS")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              thrMethod === "SUNFISH_DAYS"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            264/365 Days
          </button>
          <button
            type="button"
            onClick={() => setThrMethod("PERMENAKER_FLOOR")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              thrMethod === "PERMENAKER_FLOOR"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            8/12 Mo Floor
          </button>
          <button
            type="button"
            onClick={() => setThrMethod("CUSTOM")}
            className={`px-2 py-1 rounded-sm cursor-pointer ${
              thrMethod === "CUSTOM"
                ? "bg-surface-active text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            Custom
          </button>
        </div>
      </div>

      {/* SunFish Payslip Proration Proof Strip */}
      <div className="px-3 py-2 rounded bg-canvas border border-border-subtle flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-text-secondary">
        <span>
          Join {joinDateIso} · April 2026 Proof (25/30d):{" "}
          <strong className="text-text-primary tabular-nums">{formatRupiah(aprilProofBase, isAmountsMasked)}</strong>
        </span>
        <span>
          Dec 25 Exact (264/365):{" "}
          <strong className="text-delta-positive tabular-nums">{formatRupiah(sunfishExactThr, isAmountsMasked)}</strong>{" "}
          · Statutory Floor (8/12):{" "}
          <strong className="text-text-primary tabular-nums">{formatRupiah(permenakerFloorThr, isAmountsMasked)}</strong>
        </span>
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
          <span className="text-[10px] font-sans text-text-tertiary block">
            Attendance
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(attendanceTotal, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">
            Est. THR
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(proratedThr, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">
            Regular Net Pay
          </span>
          <span className="font-mono font-medium text-text-primary tabular-nums mt-0.5 block">
            {formatRupiah(projectedNetSalary, isAmountsMasked)}
          </span>
        </div>
        <div>
          <span className="text-[10px] font-sans text-text-tertiary block">
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
