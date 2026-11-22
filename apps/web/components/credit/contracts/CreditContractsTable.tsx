"use client";

import React, { useState } from "react";
import { FastForward } from "lucide-react";
import {
  ActiveInstallmentPlanDto,
  CreditContract,
  accelerateBridgeLoan,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface CreditContractsTableProps {
  contracts: CreditContract[];
  installmentPlans?: ActiveInstallmentPlanDto[];
  currentMonth?: number;
  currentYear?: number;
}

function nextMonthYear(month: number, year: number): { month: number; year: number } {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

export function CreditContractsTable({
  contracts,
  installmentPlans = [],
  currentMonth = 10,
  currentYear = 2026,
}: CreditContractsTableProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const [acceleratingId, setAcceleratingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const nextCycle = nextMonthYear(currentMonth, currentYear);
  const [targetMonthYear, setTargetMonthYear] = useState<string>(
    `${nextCycle.year}-${nextCycle.month}`
  );

  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const currentKey = `${currentYear}-${currentMonth}`;
  const selectedYmVal = currentYear * 12 + currentMonth;

  const displayRows =
    installmentPlans.length > 0
      ? installmentPlans
          .filter(
            (p) =>
              (p.totalTenor ?? 1) > 1 &&
              p.category !== "P1_VAULT_REFUND" &&
              (p.cells?.[currentKey]?.amount ?? 0) > 0
          )
          .map((p) => {
            const sliceBadge = p.cells?.[currentKey]?.sliceBadge ?? null;
            let remainingMonths = Math.max(
              1,
              (p.payoffYear ?? currentYear) * 12 + (p.payoffMonth ?? currentMonth) - selectedYmVal + 1
            );
            let paidMonths = Math.max(0, p.totalTenor - remainingMonths);
            if (sliceBadge && sliceBadge.includes("/")) {
              const [cStr, tStr] = sliceBadge.split("/");
              const cNum = parseInt(cStr, 10);
              const tNum = parseInt(tStr, 10);
              if (!Number.isNaN(cNum) && !Number.isNaN(tNum) && tNum >= cNum) {
                remainingMonths = tNum - cNum + 1;
                paidMonths = Math.max(0, cNum - 1);
              }
            }
            const progressPct =
              p.totalTenor > 0 ? Math.round((paidMonths / p.totalTenor) * 100) : 0;
            const activeSliceAmount = p.cells?.[currentKey]?.amount ?? p.monthlyInstallment;
            return {
              id: p.id,
              title: p.title,
              subtitle: `${p.merchantOrPlatform} · ${p.category.replace(/_/g, " ")}${sliceBadge ? ` · ${sliceBadge}` : ""}`,
              principalAmount: p.principalAmount,
              monthlyInstallment: activeSliceAmount,
              remainingTenor: remainingMonths,
              totalTenor: p.totalTenor,
              progressPct,
              remainingPrincipal: Math.round(activeSliceAmount * remainingMonths),
              payoffDateLabel: p.payoffDateLabel,
              canAccelerate: p.canAccelerate && Boolean(p.parentContractId) && remainingMonths > 1,
              parentContractId: p.parentContractId ?? null,
            };
          })
      : contracts
          .filter((c) => (c.totalTenor ?? 1) > 1)
          .map((c) => ({
            id: String(c.id),
            title: c.label,
            subtitle: `Contract #${c.id} · Active`,
            principalAmount: c.principalAmount,
            monthlyInstallment: c.monthlyInstallment,
            remainingTenor: c.remainingTenor,
            totalTenor: c.totalTenor,
            progressPct: c.tenorProgressPercent ?? 0,
            remainingPrincipal: c.remainingPrincipal ?? c.remainingTenor * c.monthlyInstallment,
            payoffDateLabel: c.payoffDateLabel || "-",
            canAccelerate: false,
            parentContractId: null,
          }));

  const futureMonthOptions = Array.from({ length: 6 }, (_, i) => {
    let m = currentMonth + i;
    let y = currentYear;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    return {
      key: `${y}-${m}`,
      month: m,
      year: y,
      label: `${String(m).padStart(2, "0")}/${y}`,
    };
  });

  const handleAccelerate = async (parentContractId: string, rowId: string) => {
    const [yStr, mStr] = targetMonthYear.split("-");
    const targetYear = parseInt(yStr, 10);
    const targetMonth = parseInt(mStr, 10);
    if (!targetMonth || !targetYear) return;

    setBusyId(rowId);
    const res = await accelerateBridgeLoan({
      parentContractId,
      targetMonth,
      targetYear,
    });
    setBusyId(null);
    if (res.success) {
      setAcceleratingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Active Financing & Installment Plans
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Unified register across Credit Card installments, PayLater schedules, and informal bridge loans.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary">
          {displayRows.length} active plans
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <th className="py-2.5 px-4">CONTRACT / PLAN</th>
              <th className="py-2.5 px-3 w-36 text-right">PRINCIPAL</th>
              <th className="py-2.5 px-3 w-36 text-right">INSTALLMENT</th>
              <th className="py-2.5 px-3 w-28 text-center">TENOR</th>
              <th className="py-2.5 px-3 w-36 text-right">REMAINING</th>
              <th className="py-2.5 px-3 w-28 text-right">PAYOFF</th>
              <th className="py-2.5 px-4 w-44 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {displayRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 px-6 text-center">
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <div className="text-sm font-medium font-sans text-text-secondary">
                      No Active Installment Plans
                    </div>
                    <p className="text-xs font-sans text-text-tertiary leading-relaxed">
                      Multi-month credit card charges, PayLater plans, and bridge loans appear here once scheduled.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              displayRows.map((row) => {
                const isAccelOpen = acceleratingId === row.id;
                return (
                  <tr key={row.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-text-primary">{row.title}</div>
                      <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                        {row.subtitle}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[12px] tabular-nums text-text-secondary">
                      {formatRp(row.principalAmount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[13px] font-medium tabular-nums text-text-primary">
                      {formatRp(row.monthlyInstallment)}{" "}
                      <span className="text-[10px] text-text-tertiary">/ mo</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="font-mono text-[11px] tabular-nums text-text-primary">
                        {row.remainingTenor} / {row.totalTenor} mo
                      </div>
                      <div className="text-[10px] font-sans text-text-tertiary mt-0.5">
                        {row.progressPct}% paid
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[13px] font-semibold tabular-nums text-text-primary">
                      {formatRp(row.remainingPrincipal)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-mono text-xs font-medium text-text-secondary">
                        {row.payoffDateLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {row.canAccelerate && row.parentContractId ? (
                        isAccelOpen ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <select
                              value={targetMonthYear}
                              onChange={(e) => setTargetMonthYear(e.target.value)}
                              className="bg-canvas border border-border rounded px-1.5 py-1 text-[10px] font-mono text-text-primary"
                            >
                              {futureMonthOptions.map((opt) => (
                                <option key={opt.key} value={opt.key}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={busyId === row.id}
                              onClick={() => handleAccelerate(row.parentContractId!, row.id)}
                              className="px-2 py-1 rounded bg-text-primary text-canvas text-[10px] font-mono font-semibold disabled:opacity-40"
                            >
                              {busyId === row.id ? "..." : "Settle"}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAcceleratingId(row.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border hover:bg-surface-hover text-[11px] font-mono text-text-secondary hover:text-text-primary"
                          >
                            <FastForward className="w-3 h-3" /> Early Payoff
                          </button>
                        )
                      ) : (
                        <span className="text-[10px] font-mono text-text-tertiary">Scheduled</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
