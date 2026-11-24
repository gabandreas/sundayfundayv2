"use client";

import React from "react";
import { DeltaBadge, DeltaBadgeProps } from "./DeltaBadge";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { formatRupiah } from "@/lib/utils";

export interface MetricCardProps {
  label: string;
  value?: string;
  amount?: number | null;
  hasCurrency?: boolean;
  subvalue?: string;
  delta?: DeltaBadgeProps;
  isCenterpiece?: boolean;
  statusVariant?: "default" | "caution" | "urgency";
  statusLabel?: string;
  chart?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const statusBorderStyles: Record<"default" | "caution" | "urgency", string> = {
  default: "border-border hover:border-border-strong",
  caution: "erp-callout-caution",
  urgency: "erp-callout-urgency",
};

export function MetricCard({
  label,
  value = "",
  amount,
  hasCurrency: hasCurrencyProp,
  subvalue,
  delta,
  isCenterpiece = false,
  statusVariant = "default",
  statusLabel,
  chart,
  footer,
  className = "",
}: MetricCardProps) {
  const { isAmountsMasked } = usePrivacyMask();

  const displayValue =
    amount !== undefined && amount !== null
      ? formatRupiah(amount, isAmountsMasked)
      : value;

  const isCurrency =
    hasCurrencyProp ??
    (amount !== undefined ||
      (typeof displayValue === "string" &&
        (displayValue.includes("Rp") || displayValue.includes("••••"))));

  return (
    <div
      className={`relative flex flex-col justify-between rounded-lg border bg-surface p-5 transition-colors duration-150 ${statusBorderStyles[statusVariant]} ${className}`}
    >
      {/* Top section: small muted label */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold text-text-tertiary font-sans truncate">
            {label}
          </span>
          
        </div>
        {statusLabel && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border ${
              statusVariant === "urgency"
                ? "border-[rgba(255,56,56,0.4)] text-urgency bg-[rgba(255,56,56,0.12)]"
                : statusVariant === "caution"
                ? "border-[rgba(229,155,44,0.4)] text-caution bg-[rgba(229,155,44,0.12)]"
                : "border-border-subtle text-text-tertiary bg-surface-subtle"
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Main Metric Value: Centerpiece uses Newsreader serif display, secondary uses tight tabular font-mono */}
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 my-1 min-w-0 overflow-hidden">
        <span
          className={`erp-tabular-currency whitespace-nowrap leading-tight ${
            isCenterpiece
              ? "font-display text-[24px] sm:text-[26px] xl:text-[28px] font-normal tracking-tight text-text-primary"
              : "font-mono text-[18px] xl:text-[20px] font-semibold tracking-tight text-text-primary"
          }`}
        >
          {displayValue}
        </span>
        {subvalue && (
          <span className="text-xs font-mono text-text-tertiary whitespace-nowrap">
            {subvalue}
          </span>
        )}
      </div>

      {/* Below metric: Small delta badge */}
      {delta && (
        <div className="mt-2.5 flex items-center">
          <DeltaBadge {...delta} />
        </div>
      )}

      {/* Optional minimal trend chart slot */}
      {chart && <div className="mt-4 pt-3 border-t border-border-subtle">{chart}</div>}

      {/* Optional footer info slot */}
      {footer && !chart && <div className="mt-3 pt-2 text-xs text-text-tertiary">{footer}</div>}
    </div>
  );
}
