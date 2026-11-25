"use client";

import React, { useEffect, useState } from "react";
import {
  AuditEvaluationResult,
  IntelligenceBundleResponse,
  PaginatedAuditLogs,
  fetchIntelligenceBundle,
  getCached,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { formatRupiah } from "@/lib/utils";
import { syncTabInUrl } from "@/lib/tabs";
import { AuditTabNav, AuditTabType } from "./AuditTabNav";
import { AuditScorecardView } from "./AuditScorecardView";
import { AuditOperationalView } from "./AuditOperationalView";
import { AuditRewardsView } from "./AuditRewardsView";
import { AuditDebtBurdenView } from "./AuditDebtBurdenView";
import { AuditLedgerView } from "./AuditLedgerView";

interface AuditStudioProps {
  initialTab: AuditTabType;
  report: AuditEvaluationResult | null;
  logs: PaginatedAuditLogs | null;
}

export function AuditStudio({ initialTab, report, logs }: AuditStudioProps) {
  const { month, year, revisionTick } = usePeriod();
  const [activeTab, setActiveTab] = useState<AuditTabType>(initialTab);
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${month}:${year}:0`);
    if (cached && revisionTick === 0) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(month, year).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [month, year, revisionTick]);

  const handleSelectTab = (nextTab: AuditTabType) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  return (
    <div className="space-y-6">
      {intel && (
        <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] font-mono text-text-tertiary">
              Spending Pace &amp; Next-Cycle Charge Monitor ({intel.periodCode})
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              Spending Pace:{" "}
              <span className="font-mono font-semibold text-text-primary">
                {intel.anomaly.burnVelocityIndex.toFixed(2)}x (
                {intel.anomaly.velocityStatus === "BURNING_FAST"
                  ? "Elevated Pace"
                  : intel.anomaly.velocityStatus === "CAUTION"
                    ? "Slightly Fast"
                    : "On Track"}
                )
              </span>{" "}
              · Next-Cycle New Charges:{" "}
              <span className="font-mono text-caution">
                {formatRupiah(intel.anomaly.postCutoffCreepRp)}
              </span>
            </div>
          </div>
          <div className="text-xs font-mono text-text-tertiary">
            {intel.anomaly.alertCount} active anomaly signal(s)
          </div>
        </div>
      )}

      <AuditTabNav currentTab={activeTab} onSelectTab={handleSelectTab} />

      <div className="relative">
        <section
          role="tabpanel"
          id="audit-panel-scorecard"
          aria-labelledby="audit-tab-scorecard"
          data-active={activeTab === "scorecard" ? "true" : "false"}
          aria-hidden={activeTab !== "scorecard"}
          inert={activeTab !== "scorecard"}
          className="tab-panel"
        >
          {report ? (
            <AuditScorecardView report={report} />
          ) : (
            <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
              Audit report unavailable.
            </div>
          )}
        </section>

        <section
          role="tabpanel"
          id="audit-panel-operational"
          aria-labelledby="audit-tab-operational"
          data-active={activeTab === "operational" ? "true" : "false"}
          aria-hidden={activeTab !== "operational"}
          inert={activeTab !== "operational"}
          className="tab-panel"
        >
          {report ? (
            <AuditOperationalView entries={report.operationalAudit} />
          ) : (
            <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
              Operational audit unavailable.
            </div>
          )}
        </section>

        <section
          role="tabpanel"
          id="audit-panel-rewards"
          aria-labelledby="audit-tab-rewards"
          data-active={activeTab === "rewards" ? "true" : "false"}
          aria-hidden={activeTab !== "rewards"}
          inert={activeTab !== "rewards"}
          className="tab-panel"
        >
          {report ? (
            <AuditRewardsView entries={report.selfRewardAudit} />
          ) : (
            <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
              Self-reward streak audit unavailable.
            </div>
          )}
        </section>

        <section
          role="tabpanel"
          id="audit-panel-debt_burden"
          aria-labelledby="audit-tab-debt_burden"
          data-active={activeTab === "debt_burden" ? "true" : "false"}
          aria-hidden={activeTab !== "debt_burden"}
          inert={activeTab !== "debt_burden"}
          className="tab-panel"
        >
          {report ? (
            <AuditDebtBurdenView entries={report.debtBurdenAudit} />
          ) : (
            <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
              Debt burden audit unavailable.
            </div>
          )}
        </section>

        <section
          role="tabpanel"
          id="audit-panel-ledger"
          aria-labelledby="audit-tab-ledger"
          data-active={activeTab === "ledger" ? "true" : "false"}
          aria-hidden={activeTab !== "ledger"}
          inert={activeTab !== "ledger"}
          className="tab-panel"
        >
          {logs ? (
            <AuditLedgerView logs={logs} />
          ) : (
            <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
              Audit log feed unavailable.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
