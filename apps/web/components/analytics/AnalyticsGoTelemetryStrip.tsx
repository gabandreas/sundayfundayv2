"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { IntelligenceBundleResponse, fetchIntelligenceBundle, getCached } from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { formatRupiah } from "@/lib/utils";

export function AnalyticsGoTelemetryStrip() {
  const { month, year, revisionTick } = usePeriod();
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

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

  if (!intel) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-4 flex flex-wrap items-center justify-between gap-4">
      <div>
        <div className="text-xs font-semibold font-sans text-text-primary">
          Cash &amp; Debt Position ({intel.periodCode})
        </div>
        <p className="text-xs font-sans text-text-secondary mt-0.5">
          Net position{" "}
          <span className="font-mono tabular-nums font-medium text-text-primary">
            {formatRupiah(intel.networth.totalNetWorthRp)}
          </span>
          {" · "}
          Spending pace{" "}
          <span className="font-mono tabular-nums text-text-primary">
            {intel.anomaly.burnVelocityIndex.toFixed(2)}x
          </span>
        </p>
      </div>
      <Link
        href={`/savings?sub=runway&month=${month}&year=${year}`}
        className="text-xs font-mono text-accent hover:underline"
      >
        Open Full Net Worth &amp; 12-Month Runway -&gt;
      </Link>
    </div>
  );
}
