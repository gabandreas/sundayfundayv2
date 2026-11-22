"use client";

import React from "react";
import { BrandMark } from "./BrandMark";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  periodLabel?: string;
  status?: string;
  statusLabel?: string;
  showBrand?: boolean;
  rightActions?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle,
  periodLabel,
  status,
  statusLabel,
  showBrand = true,
  rightActions,
}: PageHeaderProps) {
  const isLocked = status === "LOCKED";
  const isDraft = status === "DRAFT";

  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-border-subtle">
      <div className="min-w-[260px] flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {showBrand && <BrandMark size={20} className="shrink-0" />}
          <h1 className="text-lg sm:text-xl font-bold font-sans tracking-tight text-text-primary">
            {title}
          </h1>
          {periodLabel && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono bg-surface-subtle text-text-secondary border border-border-subtle whitespace-nowrap">
              {periodLabel}
            </span>
          )}
          {status && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium border whitespace-nowrap ${
                isLocked
                  ? "bg-surface-subtle text-text-tertiary border-border-subtle"
                  : isDraft
                  ? "bg-[rgba(16,183,141,0.10)] text-delta-positive border-[rgba(16,183,141,0.25)]"
                  : "bg-surface-subtle text-text-secondary border-border"
              }`}
            >
              {statusLabel || status}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs font-sans text-text-secondary max-w-3xl leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {rightActions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 print-hidden">
          {rightActions}
        </div>
      )}
    </div>
  );
}
