import React from "react";
import { AuditEvaluationResult } from "@/lib/api";
import { MetricCard } from "@/components/primitives/MetricCard";

interface AuditScorecardViewProps {
  report: AuditEvaluationResult;
}

export function AuditScorecardView({ report }: AuditScorecardViewProps) {
  const { healthScorecard, flags } = report;

  // Derive styling for health status
  let statusVariant: "default" | "caution" | "urgency" = "default";
  if (healthScorecard.healthStatus === "CAUTION") statusVariant = "caution";
  if (healthScorecard.healthStatus === "CRITICAL") statusVariant = "urgency";

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
            statusLabel={healthScorecard.healthStatus}
            footer={`${healthScorecard.totalChecks} Total Checks Analyzed`}
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
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-text-tertiary">
                          {flag.category}
                        </span>
                      </div>
                      <span className="font-mono text-xs text-text-tertiary tabular-nums shrink-0">
                        {flag.month}/{flag.year}
                      </span>
                    </div>
                    <p className="text-sm text-text-secondary">{flag.description}</p>
                    {flag.amount !== undefined && (
                      <div className="font-mono text-xs tabular-nums text-text-tertiary pt-1">
                        Rp {flag.amount.toLocaleString("id-ID")}
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
