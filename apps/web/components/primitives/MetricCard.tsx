"use client";

import React from "react";
import { DeltaBadge, DeltaBadgeProps } from "./DeltaBadge";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { InlinePrivacyEye } from "../shell/InlinePrivacyEye";

export interface MetricCardProps {
  label: string;
  value: string;
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
  caution: "border-[rgba(229,155,44,0.35)] bg-[rgba(229,155,44,0.03)]",
  urgency: "border-[rgba(255,56,56,0.45)] bg-[rgba(255,56,56,0.04)]",
};

export function MetricCard({
  label,
  value,
  subvalue,
  delta,
  isCenterpiece = false,
  statusVariant = "default",
  statusLabel,
  chart,
  footer,
  className = "",
}: MetricCardProps) {
  const { isAmountsMasked, openVerifyModal } = usePrivacyMask();
  const isMaskedValue =
    isAmountsMasked &&
    typeof value === "string" &&
    (value.includes("•••••••") || value.includes("•••"));

  return (
    <div
      className={`relative flex flex-col justify-between rounded-lg border bg-surface p-5 transition-colors duration-150 ${statusBorderStyles[statusVariant]} ${className}`}
    >
      {/* Top section: small muted label */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
          {label}
        </span>
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
      <div className="flex items-baseline gap-2 my-1">
        <div className="flex items-center gap-1.5">
          <span
            onClick={isMaskedValue ? openVerifyModal : undefined}
            title={
              isMaskedValue
                ? "Click to verify password & reveal figures"
                : undefined
            }
            className={`${
              isCenterpiece
                ? "font-display text-[32px] font-normal leading-none tracking-tight text-text-primary"
                : "font-mono text-[24px] font-semibold leading-none tracking-tight text-text-primary"
            } ${
              isMaskedValue
                ? "cursor-pointer hover:text-emerald-300 transition-colors"
                : ""
            }`}
          >
            {value}
          </span>
          {isMaskedValue && (
            <InlinePrivacyEye size={isCenterpiece ? "md" : "sm"} />
          )}
        </div>
        {subvalue && (
          <span className="text-xs font-mono text-text-tertiary">
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
