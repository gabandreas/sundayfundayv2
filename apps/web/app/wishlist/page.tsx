import React from "react";
import { fetchWishlistItems, fetchSnapshot } from "@/lib/api";
import { getDefaultPayrollPeriod } from "@/lib/utils";
import { WishlistTabNav, WishlistTabType } from "@/components/wishlist/WishlistTabNav";
import { WishlistSummaryMetrics } from "@/components/wishlist/WishlistSummaryMetrics";
import { WishlistPlannerView } from "@/components/wishlist/WishlistPlannerView";
import { WishlistVaultTable } from "@/components/wishlist/WishlistVaultTable";

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

  const [items] = await Promise.all([
    fetchWishlistItems(),
    fetchSnapshot(month, year),
  ]);

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header & Period Context */}
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <h1 className="text-xl font-bold font-sans tracking-tight text-text-primary">
            Wishlist Simulator & Capital Planning
          </h1>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Cash purchase feasibility, installment leverage stress-testing, and capital target catalog.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-text-tertiary">
            Context Period: <span className="font-mono text-text-secondary">{month}/{year}</span>
          </span>
        </div>
      </div>

      {/* Summary Metrics Banner */}
      <WishlistSummaryMetrics items={items} />

      {/* URL-driven Tab Navigation */}
      <WishlistTabNav
        currentTab={currentTab}
        month={month}
        year={year}
        vaultCount={items.length}
      />

      {/* Tab Panels */}
      <div className="animate-in fade-in duration-150">
        {/* Tab 1: Simulator & Planner */}
        {currentTab === "planner" && (
          <section className="space-y-4">
            <WishlistPlannerView
              currentMonth={month}
              currentYear={year}
            />
          </section>
        )}

        {/* Tab 2: Wishlist Vault */}
        {currentTab === "vault" && (
          <section className="space-y-4">
            <WishlistVaultTable items={items} />
          </section>
        )}
      </div>
    </div>
  );
}
