"use client";

import React from "react";
import { CreditContract } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface CreditContractsTableProps {
  contracts: CreditContract[];
}

export function CreditContractsTable({ contracts }: CreditContractsTableProps) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <div className="p-4 border-b border-border-subtle flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold font-sans text-text-primary">
            Active Financing & Credit Contracts
          </h3>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Fixed installment obligations with amortization schedules.
          </p>
        </div>
        <span className="text-xs font-mono text-text-tertiary">
          {contracts.length} active contracts
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              <th className="py-2.5 px-4">CONTRACT DESCRIPTION</th>
              <th className="py-2.5 px-3 w-36 text-right">PRINCIPAL</th>
              <th className="py-2.5 px-3 w-36 text-right">INSTALLMENT</th>
              <th className="py-2.5 px-3 w-32 text-center">TENOR</th>
              <th className="py-2.5 px-3 w-36 text-right">REMAINING DEBT</th>
              <th className="py-2.5 px-4 w-32 text-right">PROJECTED PAYOFF</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle text-xs">
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-16 px-6 text-center">
                  <div className="space-y-1.5 max-w-md mx-auto">
                    <div className="text-sm font-medium font-sans text-text-secondary">
                      No Active Financing Contracts
                    </div>
                    <p className="text-xs font-sans text-text-tertiary leading-relaxed">
                      No long-term installment contracts or financing loans are currently scheduled. Active debt amortizations materialize here and decrement tenors on period close.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              contracts.map((c) => (
                <tr key={c.id} className="hover:bg-surface-hover/40 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-text-primary">{c.label}</div>
                    <div className="text-[10px] font-mono text-text-tertiary mt-0.5">
                      Contract #{c.id} · Active
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[12px] tabular-nums text-text-secondary">
                    {formatRupiah(c.principalAmount)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[13px] font-medium tabular-nums text-text-primary">
                    {formatRupiah(c.monthlyInstallment)} <span className="text-[10px] text-text-tertiary">/ mo</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="font-mono text-[11px] tabular-nums text-text-primary">
                      {c.remainingTenor} / {c.totalTenor} mo
                    </div>
                    <div className="text-[10px] font-sans text-text-tertiary mt-0.5">
                      {c.tenorProgressPercent}% paid
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono text-[13px] font-semibold tabular-nums text-text-primary">
                    {formatRupiah(c.remainingPrincipal ?? c.remainingTenor * c.monthlyInstallment)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-mono text-xs font-medium text-text-secondary">
                      {c.payoffDateLabel || "-"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
