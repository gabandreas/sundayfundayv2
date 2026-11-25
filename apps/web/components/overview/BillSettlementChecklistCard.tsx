"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  BillSettlementState,
  LiabilityLineItemDto,
  LiabilityMatrixResponse,
  PeriodCommitmentDto,
  fetchCommitments,
  fetchLiabilityMatrix,
  setLineItemSettlementState,
  updateCommitmentStatus,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { usePeriod } from "@/context/PeriodContext";

interface BillSettlementChecklistCardProps {
  month: number;
  year: number;
  isLocked: boolean;
  remainingLivingCash: number;
  savedWalletBalance?: number | null;
}

export function BillSettlementChecklistCard({
  month,
  year,
  isLocked,
  remainingLivingCash,
  savedWalletBalance = null,
}: BillSettlementChecklistCardProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { revisionTick } = usePeriod();
  const formatRp = (v: number) => formatRupiah(v, isAmountsMasked);

  const [matrix, setMatrix] = useState<LiabilityMatrixResponse | null>(null);
  const [commitments, setCommitments] = useState<PeriodCommitmentDto[]>([]);
  const [optimisticStates, setOptimisticStates] = useState<
    Record<number, BillSettlementState>
  >({});

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchLiabilityMatrix(10, 2026, 12),
      fetchCommitments(month, year),
    ]).then(([res, comRes]) => {
      if (cancelled) return;
      if (res) setMatrix(res);
      setCommitments(comRes.items ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [month, year, revisionTick]);

  const key = `${year}-${month}`;
  const rawLineItems: LiabilityLineItemDto[] = matrix?.lineItemsPerMonth?.[key] ?? [];
  const ccItems = matrix?.creditCardRow.cells?.[key]?.items ?? [];

  const itemsWithState = rawLineItems.map((li) => ({
    ...li,
    settlementState:
      optimisticStates[li.id] ??
      li.settlementState ??
      (li.isSettled ? "PAID" : "UNPAID"),
  }));

  let paidAmount = 0;
  let reservedAmount = 0;
  let unpaidAmount = 0;
  for (const li of itemsWithState) {
    const amt = Math.round(li.monthlyAmount);
    if (li.settlementState === "PAID") paidAmount += amt;
    else if (li.settlementState === "RESERVED") reservedAmount += amt;
    else unpaidAmount += amt;
  }
  for (const cc of ccItems) {
    const amt = Math.round(cc.amount);
    const st = cc.settlementState ?? (cc.isSettled ? "PAID" : "UNPAID");
    if (st === "PAID") paidAmount += amt;
    else if (st === "RESERVED") reservedAmount += amt;
    else unpaidAmount += amt;
  }
  for (const cm of commitments) {
    const amt = Math.round(cm.amount);
    if (cm.status === "PAID") paidAmount += amt;
    else if (cm.status === "RESERVED") reservedAmount += amt;
    else unpaidAmount += amt;
  }

  const bankHoldNeeded = reservedAmount + unpaidAmount;
  const totalScheduled = paidAmount + bankHoldNeeded;
  const freeCashVsWallet =
    savedWalletBalance !== null && savedWalletBalance !== undefined
      ? savedWalletBalance - bankHoldNeeded
      : remainingLivingCash;

  const handleStateClick = async (id: number, nextState: BillSettlementState) => {
    if (isLocked) return;
    setOptimisticStates((prev) => ({ ...prev, [id]: nextState }));
    const res = await setLineItemSettlementState(id, nextState);
    if (!res.success) {
      setOptimisticStates((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    }
  };

  if (rawLineItems.length === 0 && ccItems.length === 0 && commitments.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-border-subtle">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Bill Settlement Checklist &amp; Bank Reservation
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Track Unpaid, Bank-Reserved, and Paid obligations for {month}/{year} to separate earmarked bank cash from free spending cash.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/credit?sub=commitments&month=${month}&year=${year}`}
            className="inline-flex items-center gap-1 text-[11px] font-sans text-accent hover:underline"
          >
            + One-Off Bill
          </Link>
          <Link
            href={`/credit?sub=matrix&month=${month}&year=${year}`}
            className="inline-flex items-center gap-1 text-[11px] font-sans text-text-secondary hover:text-text-primary"
          >
            Open Matrix <ArrowUpRight className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Bank Reservation vs Free Cash Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="rounded border border-border-subtle bg-canvas p-2.5">
          <div className="text-[10px] text-text-tertiary">Total Bills</div>
          <div className="text-sm font-semibold text-text-primary mt-0.5">
            {formatRp(totalScheduled)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas p-2.5">
          <div className="text-[10px] text-text-tertiary">Already Paid</div>
          <div className="text-sm font-semibold text-delta-positive mt-0.5">
            {formatRp(paidAmount)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas p-2.5">
          <div className="text-[10px] text-text-tertiary">
            Bank Hold Needed
          </div>
          <div className="text-sm font-semibold text-caution mt-0.5">
            {formatRp(bankHoldNeeded)}
          </div>
          <div className="text-[10px] text-text-tertiary">
            Reserved: {formatRp(reservedAmount)}
          </div>
        </div>
        <div className="rounded border border-border-subtle bg-canvas p-2.5">
          <div className="text-[10px] text-text-tertiary">
            {savedWalletBalance !== null && savedWalletBalance !== undefined
              ? "Free Cash (Wallet - Hold)"
              : "Planned Spending Pool"}
          </div>
          <div
            className={`text-sm font-semibold mt-0.5 ${
              freeCashVsWallet < 0 ? "text-urgency" : "text-delta-positive"
            }`}
          >
            {formatRp(freeCashVsWallet)}
          </div>
        </div>
      </div>

      {/* Interactive Settlement Checklist Rows */}
      <div className="divide-y divide-border-subtle border border-border-subtle rounded-lg max-h-[260px] overflow-y-auto">
        {itemsWithState.map((item) => (
          <div
            key={item.id}
            className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-surface-hover/20"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-sans font-medium text-text-primary truncate">
                {item.title}
              </div>
              <div className="text-[10px] font-mono text-text-tertiary">
                {item.merchantOrPlatform} · Due {item.dueDateIso ?? `${item.dueDay}th`}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {formatRp(item.monthlyAmount)}
              </span>
              <div className="inline-flex items-center rounded border border-border bg-canvas p-0.5 text-[10px] font-mono">
                {(["UNPAID", "RESERVED", "PAID"] as const).map((st) => {
                  const active = item.settlementState === st;
                  const activeStyle =
                    st === "PAID"
                      ? "bg-[rgba(16,183,141,0.14)] text-delta-positive font-semibold"
                      : st === "RESERVED"
                        ? "bg-caution/15 text-caution font-semibold"
                        : "bg-surface-active text-text-primary font-semibold";
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isLocked}
                      onClick={() => handleStateClick(item.id, st)}
                      className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer disabled:opacity-40 ${
                        active ? activeStyle : "text-text-tertiary hover:text-text-primary"
                      }`}
                    >
                      {st === "PAID" ? "Paid" : st === "RESERVED" ? "Reserved" : "Unpaid"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
        {ccItems.map((cc) => {
          const st = cc.settlementState ?? (cc.isSettled ? "PAID" : "UNPAID");
          return (
            <div
              key={`cc-${cc.id}`}
              className="px-3 py-2 flex items-center justify-between gap-2 bg-canvas/30"
            >
              <div className="min-w-0">
                <div className="text-xs font-sans font-medium text-text-primary truncate">
                  {cc.label}
                </div>
                <div className="text-[10px] font-mono text-text-tertiary">
                  Credit Card · Due {cc.dueDateIso ?? "11th"}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                  {formatRp(cc.amount)}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                    st === "PAID"
                      ? "border-delta-positive/40 text-delta-positive"
                      : "border-border-subtle text-text-secondary"
                  }`}
                >
                  {st === "PAID" ? "Paid" : "Card Scheduled"}
                </span>
              </div>
            </div>
          );
        })}
        {commitments.map((cm) => (
          <div
            key={`cm-${cm.id}`}
            className="px-3 py-2 flex flex-wrap items-center justify-between gap-2 hover:bg-surface-hover/20"
          >
            <div className="min-w-0 flex-1">
              <div className="text-xs font-sans font-medium text-text-primary truncate">
                {cm.title}
              </div>
              <div className="text-[10px] font-mono text-text-tertiary">
                One-Off {cm.category} · Due {String(cm.dueDate).slice(0, 10)}
              </div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-mono text-xs font-semibold tabular-nums text-text-primary">
                {formatRp(cm.amount)}
              </span>
              <div className="inline-flex items-center rounded border border-border bg-canvas p-0.5 text-[10px] font-mono">
                {(["UNPAID", "RESERVED", "PAID"] as const).map((st) => {
                  const active = cm.status === st;
                  const activeStyle =
                    st === "PAID"
                      ? "bg-[rgba(16,183,141,0.14)] text-delta-positive font-semibold"
                      : st === "RESERVED"
                        ? "bg-caution/15 text-caution font-semibold"
                        : "bg-surface-active text-text-primary font-semibold";
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        if (isLocked) return;
                        setCommitments((prev) =>
                          prev.map((row) =>
                            row.id === cm.id ? { ...row, status: st } : row
                          )
                        );
                        void updateCommitmentStatus(cm.id, st);
                      }}
                      className={`px-2 py-0.5 rounded-sm transition-colors cursor-pointer disabled:opacity-40 ${
                        active ? activeStyle : "text-text-tertiary hover:text-text-primary"
                      }`}
                    >
                      {st === "PAID" ? "Paid" : st === "RESERVED" ? "Reserved" : "Unpaid"}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
