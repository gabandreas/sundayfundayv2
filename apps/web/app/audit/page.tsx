import React from "react";
import Link from "next/link";
import { fetchAuditReport, fetchAuditLogs } from "@/lib/api";
import { AuditTabType } from "@/components/audit/AuditTabNav";
import { AuditStudio } from "@/components/audit/AuditStudio";

interface AuditPageProps {
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const params = await searchParams;
  const validTabs: AuditTabType[] = [
    "scorecard",
    "operational",
    "rewards",
    "debt_burden",
    "ledger",
  ];
  const currentTab: AuditTabType = validTabs.includes(params.tab as AuditTabType)
    ? (params.tab as AuditTabType)
    : "scorecard";

  const page = params.page ? parseInt(params.page, 10) : 1;

  const [report, logs] = await Promise.all([
    fetchAuditReport(),
    fetchAuditLogs(Number.isFinite(page) && page > 0 ? page : 1, 20),
  ]);

  if (!report) {
    return (
      <div className="space-y-6 w-full max-w-full">
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
    <div className="space-y-6 w-full max-w-full pb-20">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Discipline Audit
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Historical adherence scorecard and dimensional compliance reporting.
          </p>
        </div>
        <Link href="/reports?sub=audit" className="text-xs font-mono text-text-secondary hover:text-text-primary hover:underline">
          Open in Reports
        </Link>
      </div>

      <AuditStudio initialTab={currentTab} report={report} logs={logs} />
    </div>
  );
}
