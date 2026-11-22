import React from "react";
import Link from "next/link";
import { fetchWishlistItems, fetchSnapshot, MonthlySnapshot } from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { WishlistTabType } from "@/components/wishlist/WishlistTabNav";
import { WishlistPageClient } from "@/components/wishlist/WishlistPageClient";

interface WishlistPageProps {
  searchParams: Promise<{ month?: string; year?: string; tab?: string }>;
}

export default async function WishlistPage({ searchParams }: WishlistPageProps) {
  const params = await searchParams;
  const defaultPeriod = getDefaultPayrollPeriod();
  const month = params.month ? parseInt(params.month, 10) : defaultPeriod.month;
  const year = params.year ? parseInt(params.year, 10) : defaultPeriod.year;

  const validTabs: WishlistTabType[] = ["planner", "vault"];
  const currentTab: WishlistTabType = validTabs.includes(params.tab as WishlistTabType)
    ? (params.tab as WishlistTabType)
    : "planner";

  const next1M = month === 12 ? 1 : month + 1;
  const next1Y = month === 12 ? year + 1 : year;
  const next2M = next1M === 12 ? 1 : next1M + 1;
  const next2Y = next1M === 12 ? next1Y + 1 : next1Y;

  const [items, snap0, snap1, snap2] = await Promise.all([
    fetchWishlistItems(),
    fetchSnapshot(month, year),
    fetchSnapshot(next1M, next1Y),
    fetchSnapshot(next2M, next2Y),
  ]);
  const forwardSnapshots = [snap0, snap1, snap2].filter(
    (s): s is MonthlySnapshot => s !== null && s !== undefined,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-4 py-2 rounded border border-border bg-surface text-xs text-text-secondary">
        <span>Wishlist planning is integrated into Credit &amp; Liabilities -&gt; Cutoff &amp; Affordability Simulator.</span>
        <Link href={`/credit?sub=simulator&month=${month}&year=${year}`} className="font-mono text-text-primary hover:underline">
          Open Credit Simulator
        </Link>
      </div>
      <WishlistPageClient
        initialMonth={month}
        initialYear={year}
        initialTab={currentTab}
        initialData={{ items, forwardSnapshots }}
      />
    </div>
  );
}
