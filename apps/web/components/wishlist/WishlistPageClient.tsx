"use client";

import React from "react";
import {
  MonthlySnapshot,
  WishlistItem,
  fetchSnapshot,
  fetchWishlistItems,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { WishlistTabType } from "@/components/wishlist/WishlistTabNav";
import { WishlistSummaryMetrics } from "@/components/wishlist/WishlistSummaryMetrics";
import { WishlistStudio } from "@/components/wishlist/WishlistStudio";

export interface WishlistPeriodData {
  items: WishlistItem[];
  forwardSnapshots: MonthlySnapshot[];
}

interface WishlistPageClientProps {
  initialMonth: number;
  initialYear: number;
  initialTab: WishlistTabType;
  initialData: WishlistPeriodData;
}

function getNextPeriod(m: number, y: number) {
  return m === 12 ? { month: 1, year: y + 1 } : { month: m + 1, year: y };
}

export function WishlistPageClient({
  initialMonth,
  initialYear,
  initialTab,
  initialData,
}: WishlistPageClientProps) {
  const { month, year, data } = usePeriodSlice<WishlistPeriodData>({
    initialMonth,
    initialYear,
    initialData,
    seedCache: (m, y, d) => {
      setCached("wishlistItems:all", d.items);
      for (const s of d.forwardSnapshots) {
        setCached(`snapshot:${s.month}:${s.year}`, s);
      }
    },
    readFromCache: (m, y, prev) => {
      const n1 = getNextPeriod(m, y);
      const n2 = getNextPeriod(n1.month, n1.year);
      const s0 = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
      const s1 = getCached<MonthlySnapshot | null>(`snapshot:${n1.month}:${n1.year}`);
      const s2 = getCached<MonthlySnapshot | null>(`snapshot:${n2.month}:${n2.year}`);
      if (s0 === undefined || s1 === undefined || s2 === undefined) {
        return undefined;
      }
      const items = getCached<WishlistItem[]>("wishlistItems:all") ?? prev.items;
      const forwardSnapshots = [s0, s1, s2].filter(
        (s): s is MonthlySnapshot => s !== null && s !== undefined,
      );
      return { items, forwardSnapshots };
    },
    fetchForPeriod: async (m, y) => {
      const n1 = getNextPeriod(m, y);
      const n2 = getNextPeriod(n1.month, n1.year);
      const [items, snap0, snap1, snap2] = await Promise.all([
        fetchWishlistItems(),
        fetchSnapshot(m, y),
        fetchSnapshot(n1.month, n1.year),
        fetchSnapshot(n2.month, n2.year),
      ]);
      setCached("wishlistItems:all", items);
      const forwardSnapshots = [snap0, snap1, snap2].filter(
        (s): s is MonthlySnapshot => s !== null && s !== undefined,
      );
      return { items, forwardSnapshots };
    },
  });

  const { items, forwardSnapshots } = data;

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Wishlist Simulator &amp; Capital Planning
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Cash purchase feasibility, installment leverage stress-testing, and capital target catalog.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Cycle{" "}
            <strong className="text-text-primary font-mono tabular-nums">
              {String(month).padStart(2, "0")}/{year}
            </strong>
          </span>
        </div>
      </div>

      <WishlistSummaryMetrics items={items} />

      <WishlistStudio
        month={month}
        year={year}
        initialTab={initialTab}
        items={items}
        forwardSnapshots={forwardSnapshots}
      />
    </div>
  );
}
