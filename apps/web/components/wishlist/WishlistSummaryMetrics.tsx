"use client";

import React from "react";
import { WishlistItem } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { MetricCard } from "@/components/primitives/MetricCard";

interface WishlistSummaryMetricsProps {
  items: WishlistItem[];
}

export function WishlistSummaryMetrics({ items }: WishlistSummaryMetricsProps) {
  const activeItems = items.filter((i) => i.status !== "PURCHASED");
  const totalActiveValue = activeItems.reduce((acc, i) => acc + i.price, 0);
  const planningCount = items.filter((i) => i.status === "PLANNING").length;
  const readyCount = items.filter((i) => i.status === "READY").length;
  const purchasedCount = items.filter((i) => i.status === "PURCHASED").length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Centerpiece Card: Total Planned Capital */}
      <MetricCard
        label="Total Active Wishlist"
        amount={totalActiveValue}
        value={formatRupiah(totalActiveValue)}
        isCenterpiece={true}
        footer={
          <span className="text-[11px] font-mono text-text-tertiary">
            {activeItems.length} planned {activeItems.length === 1 ? "item" : "items"}
          </span>
        }
      />

      {/* Metric 2: Ready for Execution */}
      <MetricCard
        label="Ready For Purchase"
        value={String(readyCount)}
        footer={
          <span className="text-[11px] font-mono text-text-tertiary">
            {readyCount === 1 ? "1 item ready" : `${readyCount} items ready`}
          </span>
        }
      />

      {/* Metric 3: Under Planning */}
      <MetricCard
        label="In Planning Stage"
        value={String(planningCount)}
        footer={
          <span className="text-[11px] font-mono text-text-tertiary">
            {planningCount === 1 ? "1 item queued" : `${planningCount} items queued`}
          </span>
        }
      />

      {/* Metric 4: Purchased & Converted */}
      <MetricCard
        label="Purchased & Converted"
        value={String(purchasedCount)}
        footer={
          <span className="text-[11px] font-mono text-text-tertiary">
            Materialized obligations
          </span>
        }
      />
    </div>
  );
}
