"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnalyticsScope } from "@/lib/api";

interface AnalyticsScopeToggleProps {
  currentScope: AnalyticsScope;
  totalAvailableCount: number;
  lockedCount: number;
}

export function AnalyticsScopeToggle({
  currentScope,
  totalAvailableCount,
  lockedCount,
}: AnalyticsScopeToggleProps) {
  const searchParams = useSearchParams();

  const buildHref = (targetScope: AnalyticsScope) => {
    const params = new URLSearchParams(searchParams.toString());
    if (targetScope === "all") {
      params.delete("scope");
    } else {
      params.set("scope", targetScope);
    }
    const qs = params.toString();
    return qs ? `/analytics?${qs}` : "/analytics";
  };

  return (
    <div className="inline-flex items-center rounded border border-border-subtle bg-surface p-0.5">
      <Link
        href={buildHref("all")}
        className={`px-3 py-1.5 text-xs font-sans font-medium rounded-sm transition-colors ${
          currentScope === "all"
            ? "bg-surface-subtle text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        All Genuine Periods ({totalAvailableCount})
      </Link>
      <Link
        href={buildHref("locked")}
        className={`px-3 py-1.5 text-xs font-sans font-medium rounded-sm transition-colors ${
          currentScope === "locked"
            ? "bg-surface-subtle text-text-primary"
            : "text-text-tertiary hover:text-text-secondary"
        }`}
      >
        Closed Only ({lockedCount})
      </Link>
    </div>
  );
}
