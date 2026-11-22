"use client";

import React, { useEffect, useState } from "react";
import { IntelligenceBundleResponse, fetchIntelligenceBundle, getCached } from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { formatRupiah } from "@/lib/utils";
import { NetWorthReservoirsPanel, WealthForecaster12MPanel } from "@/components/finance/ModuleGoPanels";

export function AnalyticsGoTelemetryStrip() {
  const { month, year } = usePeriod();
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${month}:${year}:0`);
    if (cached) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(month, year).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [month, year]);

  if (!intel) return null;

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between border-t border-border pt-5">
        <div>
          <h2 className="text-sm font-semibold font-sans text-text-primary">
            Cash &amp; Debt Position &amp; 12-Month Projection ({intel.periodCode})
          </h2>
          <p className="text-xs text-text-tertiary mt-0.5">
            Cash &amp; savings vs remaining debt principal ({formatRupiah(intel.networth.totalNetWorthRp)}) and 3-scenario wealth trajectory.
          </p>
        </div>
      </div>
      <NetWorthReservoirsPanel intel={intel} />
      <WealthForecaster12MPanel intel={intel} />
    </div>
  );
}
