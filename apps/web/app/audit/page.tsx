import React from "react";
import { fetchAuditReport, fetchAuditLogs } from "@/lib/api";
import { AuditTabNav, AuditTabType } from "@/components/audit/AuditTabNav";
import { AuditScorecardView } from "@/components/audit/AuditScorecardView";
import { AuditOperationalView } from "@/components/audit/AuditOperationalView";
import { AuditRewardsView } from "@/components/audit/AuditRewardsView";
import { AuditDebtBurdenView } from "@/components/audit/AuditDebtBurdenView";
import { AuditLedgerView } from "@/components/audit/AuditLedgerView";
import { MetricCard } from "@/components/primitives/MetricCard";

interface AuditPageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const validTabs: AuditTabType[] = ["scorecard", "operational", "rewards", "debt_burden", "ledger"];
  const currentTab: AuditTabType = validTabs.includes(params.tab as AuditTabType)
    ? (params.tab as AuditTabType)
    : "scorecard";

  const report = await fetchAuditReport();
  
  let logs = null;
  if (currentTab === "ledger") {
    const page = params.page ? parseInt(params.page, 10) : 1;
    logs = await fetchAuditLogs(page, 20);
  }

  // If there's no report data (e.g. no snapshots yet), show empty state
  if (!report) {
    return (
      <div className="space-y-6 max-w-7xl">
        <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
          Discipline Audit
        </h1>
        <div className="p-8 border border-border-subtle border-dashed rounded-lg text-center text-text-secondary text-sm">
          No historical snapshot data available for audit.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Discipline Audit
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Historical adherence scorecard and dimensional compliance reporting.
          </p>
        </div>
      </div>

      {/* URL-driven Tab Navigation */}
      <AuditTabNav currentTab={currentTab} />

      <div className="animate-in fade-in duration-150">
        {/* Tab 1: Scorecard */}
        {currentTab === "scorecard" && (
          <section className="space-y-4">
            <AuditScorecardView report={report} />
          </section>
        )}

        {/* Tab 2: Operational Budget */}
        {currentTab === "operational" && (
          <section className="space-y-4">
            <AuditOperationalView entries={report.operationalAudit} />
          </section>
        )}

        {/* Tab 3: Self-Reward Streak */}
        {currentTab === "rewards" && (
          <section className="space-y-4">
            <AuditRewardsView entries={report.selfRewardAudit} />
          </section>
        )}

        {/* Tab 4: Debt Burden */}
        {currentTab === "debt_burden" && (
          <section className="space-y-4">
            <AuditDebtBurdenView entries={report.debtBurdenAudit} />
          </section>
        )}

        {/* Tab 5: Audit Ledger */}
        {currentTab === "ledger" && logs && (
          <section className="space-y-4">
            <AuditLedgerView logs={logs} />
          </section>
        )}
      </div>
    </div>
  );
}
