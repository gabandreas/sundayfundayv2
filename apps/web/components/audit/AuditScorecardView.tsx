"use client";

import React from "react";
import { AuditEvaluationResult } from "@/lib/api";
import { MetricCard } from "@/components/primitives/MetricCard";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatAuditCategoryLabel, formatHumanStatus } from "@/lib/format-labels";

interface AuditScorecardViewProps {
  report: AuditEvaluationResult;
}

export function AuditScorecardView({ report }: AuditScorecardViewProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const { locale } = useLanguage();
  const { healthScorecard, flags, debtBurdenAudit } = report;

  let statusVariant: "default" | "caution" | "urgency" = "default";
  if (healthScorecard.healthStatus === "CAUTION") statusVariant = "caution";
  if (healthScorecard.healthStatus === "CRITICAL") statusVariant = "urgency";

  const sortedDebtTrail = [...(debtBurdenAudit || [])].sort((a, b) =>
    a.year !== b.year ? a.year - b.year : a.month - b.month
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <MetricCard
            label="Discipline Score"
            value={healthScorecard.disciplineScore.toString()}
            subvalue="/ 100"
            isCenterpiece
            statusVariant={statusVariant}
            statusLabel={formatHumanStatus(healthScorecard.healthStatus, locale)}
            footer={`${healthScorecard.totalChecks} Checks Analyzed`}
          />
        </div>
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <MetricCard
            label="Positive Adherence"
            value={healthScorecard.totalGreenFlags.toString()}
            subvalue="Green Flags"
            className="border-border-subtle"
            footer="Targets met & healthy behavior"
          />
          <MetricCard
            label="Violations & Risks"
            value={healthScorecard.totalRedFlags.toString()}
            subvalue="Red Flags"
            className="border-border-subtle"
            footer="Missed targets & deficit warnings"
          />
        </div>
      </div>

      {/* Debt-to-Income Deleveraging Trajectory */}
      {sortedDebtTrail.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold font-sans text-text-primary">
                Deleveraging & Debt-to-Income Horizon
              </h3>
              <p className="text-xs font-sans text-text-tertiary">
                Tracking obligation compression toward optimal 20% ceiling across active payroll cycles.
              </p>
            </div>
            <span className="text-[10px] font-mono text-text-tertiary">
              Target Ceiling: 35% Safe · 20% Optimal
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {sortedDebtTrail.map((entry) => {
              const barColor =
                entry.debtRatio > 50
                  ? "bg-urgency"
                  : entry.debtRatio > 35
                  ? "bg-caution"
                  : "bg-delta-positive";
              const textColor =
                entry.debtRatio > 50
                  ? "text-urgency"
                  : entry.debtRatio > 35
                  ? "text-caution"
                  : "text-delta-positive";
              return (
                <div
                  key={`${entry.year}-${entry.month}`}
                  className="p-2.5 rounded border border-border-subtle bg-surface-subtle space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-text-secondary">
                      {entry.month}/{entry.year}
                    </span>
                    <span className={`font-semibold tabular-nums ${textColor}`}>
                      {entry.debtRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-1 w-full rounded-full bg-surface-hover overflow-hidden">
                    <div
                      className={`h-full ${barColor}`}
                      style={{ width: `${Math.min(100, entry.debtRatio)}%` }}
                    />
                  </div>
                  <div className="text-[10px] font-mono text-text-tertiary tabular-nums">
                    {formatRupiah(Math.round(entry.totalBills), isAmountsMasked)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold font-sans text-text-primary mb-3">
          Chronological Audit Feed
        </h3>
        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
          {flags.length === 0 ? (
            <div className="p-8 text-center text-text-tertiary text-xs font-mono">
              No flags recorded in the current dataset.
            </div>
          ) : (
            <div className="divide-y divide-border-subtle">
              {flags.map((flag) => (
                <div key={flag.id} className="p-4 flex gap-4 items-start hover:bg-surface-subtle transition-colors">
                  <div className="shrink-0 mt-0.5">
                    {flag.type === "GREEN" ? (
                      <div className="w-2 h-2 rounded-full bg-delta-positive" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-urgency" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-text-primary">
                          {flag.title}
                        </span>
                        <span className="text-[10px] font-sans px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary">
                          {formatAuditCategoryLabel(flag.category, locale)}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-text-tertiary tabular-nums shrink-0">
                        {flag.month}/{flag.year}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{flag.description}</p>
                    {flag.amount !== undefined && (
                      <div className="font-mono text-xs tabular-nums text-text-tertiary pt-1">
                        {formatRupiah(flag.amount, isAmountsMasked)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
