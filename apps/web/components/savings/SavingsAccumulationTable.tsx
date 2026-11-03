"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ArrowDownToLine, Loader2 } from "lucide-react";
import {
  SavingsPeriodLedgerItem,
  SavingsInstrumentType,
  confirmPeriodDeposit,
} from "@/lib/api";
import { formatRupiah, formatSnapshotStatus } from "@/lib/utils";

interface SavingsAccumulationTableProps {
  ledger: SavingsPeriodLedgerItem[];
}

export function SavingsAccumulationTable({
  ledger,
}: SavingsAccumulationTableProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [activeDepositPeriod, setActiveDepositPeriod] = useState<{
    month: number;
    year: number;
    pendingAmount: number;
  } | null>(null);

  const [selectedInstrument, setSelectedInstrument] =
    useState<SavingsInstrumentType>("LIQUID_CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirmDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDepositPeriod || submitting) return;

    setSubmitting(true);
    setError(null);

    const res = await confirmPeriodDeposit({
      month: activeDepositPeriod.month,
      year: activeDepositPeriod.year,
      amount: activeDepositPeriod.pendingAmount,
      instrumentType: selectedInstrument,
    });

    setSubmitting(false);

    if (!res.success) {
      setError(res.error || "Failed to confirm period deposit");
      return;
    }

    setActiveDepositPeriod(null);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-primary">
            Monthly Savings Accumulation Ledger
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Snapshot-to-Vault reconciliation tracking Priority 1 (P1) salary allocations vs confirmed vault deposits.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary">
          {ledger.length} periods active
        </span>
      </div>

      <div className="overflow-x-auto border border-border-subtle rounded-md">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-surface-subtle text-text-tertiary text-[11px] font-mono border-b border-border-subtle">
            <tr>
              <th className="py-2.5 px-3">Period</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Monthly Target</th>
              <th className="py-2.5 px-3 text-right text-text-primary">Funded from Salary (P1)</th>
              <th className="py-2.5 px-3 text-right">Deposited to Vault</th>
              <th className="py-2.5 px-3 text-right">Pending Transfer</th>
              <th className="py-2.5 px-3 text-center">Reconciliation Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-text-secondary">
            {ledger.map((item) => {
              const isLocked = item.status === "LOCKED";
              const hasPending = item.pendingTransfer > 0;

              return (
                <tr
                  key={`${item.year}-${item.month}`}
                  className="hover:bg-surface-subtle/50 transition-colors"
                >
                  <td className="py-2.5 px-3 font-mono font-medium text-text-primary">
                    {String(item.month).padStart(2, "0")}/{item.year}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium border ${
                        isLocked
                          ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                          : "bg-[rgba(16,183,141,0.08)] text-delta-positive border-[rgba(16,183,141,0.25)]"
                      }`}
                    >
                      {formatSnapshotStatus(item.status)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-text-tertiary">
                    {formatRupiah(item.monthlyTarget)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-text-primary">
                    {formatRupiah(item.actualSavings)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-delta-positive font-medium">
                    {formatRupiah(item.depositedAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    {hasPending ? (
                      <span className="text-caution font-medium">
                        {formatRupiah(item.pendingTransfer)}
                      </span>
                    ) : (
                      <span className="text-text-disabled">Rp 0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {hasPending ? (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveDepositPeriod({
                            month: item.month,
                            year: item.year,
                            pendingAmount: item.pendingTransfer,
                          })
                        }
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-sans font-medium bg-[rgba(16,183,141,0.12)] hover:bg-[rgba(16,183,141,0.2)] text-delta-positive border border-[rgba(16,183,141,0.3)] transition-colors cursor-pointer"
                      >
                        <ArrowDownToLine className="w-3 h-3" />
                        <span>Confirm Deposit ({formatRupiah(item.pendingTransfer)})</span>
                      </button>
                    ) : item.actualSavings > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-delta-positive font-mono">
                        <Check className="w-3 h-3" /> Fully Deposited
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-disabled font-mono">
                        No P1 Allocation
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal */}
      {activeDepositPeriod && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h3 className="text-sm font-semibold text-text-primary">
                Confirm Vault Deposit for {activeDepositPeriod.month}/{activeDepositPeriod.year}
              </h3>
              <button
                type="button"
                onClick={() => setActiveDepositPeriod(null)}
                className="text-text-tertiary hover:text-text-primary text-xs"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              Deposit <strong className="text-text-primary font-mono">{formatRupiah(activeDepositPeriod.pendingAmount)}</strong> funded
              from Salary (P1) into your savings vault. This will bridge the snapshot to the vault and mark this period as fully transferred.
            </p>

            <form onSubmit={handleConfirmDeposit} className="space-y-3">
              <div>
                <label className="text-[11px] font-mono uppercase text-text-tertiary block mb-1">
                  Destination Instrument
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInstrument("LIQUID_CASH")}
                    className={`p-2.5 rounded border text-left text-xs transition-colors cursor-pointer ${
                      selectedInstrument === "LIQUID_CASH"
                        ? "bg-surface-active border-border-strong text-text-primary"
                        : "bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className="font-semibold block">Liquid Emergency Cash</span>
                    <span className="text-[10px] text-text-tertiary block mt-0.5">
                      Bank savings account
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedInstrument("INVESTMENT_RDPU")}
                    className={`p-2.5 rounded border text-left text-xs transition-colors cursor-pointer ${
                      selectedInstrument === "INVESTMENT_RDPU"
                        ? "bg-surface-active border-border-strong text-delta-positive"
                        : "bg-surface-subtle border-border-subtle text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <span className="font-semibold block">Investment — RDPU</span>
                    <span className="text-[10px] text-text-tertiary block mt-0.5">
                      Money market mutual fund
                    </span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="text-xs text-delta-negative bg-[rgba(235,87,87,0.1)] p-2 rounded border border-[rgba(235,87,87,0.2)]">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-subtle">
                <button
                  type="button"
                  onClick={() => setActiveDepositPeriod(null)}
                  className="px-3 py-1.5 rounded text-xs text-text-tertiary hover:text-text-primary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Depositing...</span>
                    </>
                  ) : (
                    <span>Confirm Deposit ({formatRupiah(activeDepositPeriod.pendingAmount)})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
