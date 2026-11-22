"use client";

import React, { useEffect, useState } from "react";
import {
  AuditEvaluationResult,
  PaginatedAuditLogs,
  fetchAuditLogs,
  fetchAuditReport,
} from "@/lib/api";
import { AuditStudio } from "@/components/audit/AuditStudio";

export function ReportsAuditEmbed() {
  const [report, setReport] = useState<AuditEvaluationResult | null>(null);
  const [logs, setLogs] = useState<PaginatedAuditLogs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([fetchAuditReport(), fetchAuditLogs(1, 20)])
      .then(([r, l]) => {
        if (!active) return;
        setReport(r);
        setLogs(l);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading && !report) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-xs text-text-tertiary">
        Loading Discipline Audit Scorecard &amp; Telemetry...
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="space-y-4">
      <AuditStudio initialTab="scorecard" report={report} logs={logs} />
    </div>
  );
}
