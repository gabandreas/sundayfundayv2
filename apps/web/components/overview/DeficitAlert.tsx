"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";

interface DeficitAlertProps {
  deficitUncovered: number;
  month?: number;
  year?: number;
}

export function DeficitAlert({ deficitUncovered, month, year }: DeficitAlertProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (!deficitUncovered || deficitUncovered <= 0 || dismissed) {
    return null;
  }

  const allocationsHref =
    month && year ? `/allocations?month=${month}&year=${year}` : "/allocations";

  return (
    <div
      role="status"
      data-testid="deficit-alert"
      className="w-full rounded-md border border-border border-l-2 border-l-urgency bg-surface-subtle px-3.5 py-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs"
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
        <AlertCircle className="w-3.5 h-3.5 text-urgency shrink-0" strokeWidth={2} aria-hidden="true" />
        <span className="font-medium text-text-primary whitespace-nowrap">
          {t("deficit.title")}
        </span>
        <span className="font-mono font-semibold text-urgency erp-tabular-currency">
          {formatRupiah(deficitUncovered, isAmountsMasked)}
        </span>
        <span className="text-border-strong hidden sm:inline" aria-hidden="true">
          ·
        </span>
        <span className="text-text-tertiary truncate">
          {t("deficit.compactNote")}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <Link
          href={allocationsHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-primary hover:text-accent transition-colors whitespace-nowrap"
        >
          <span>{t("deficit.adjustPlan")}</span>
          <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss shortfall notice"
          className="p-0.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
