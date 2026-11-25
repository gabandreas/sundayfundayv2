"use client";

import React, { useEffect, useState } from "react";
import { IntelligenceBundleResponse, MonthlySnapshot, WishlistItem, fetchIntelligenceBundle, getCached } from "@/lib/api";
import { syncTabInUrl } from "@/lib/tabs";
import { WishlistTabNav, WishlistTabType } from "./WishlistTabNav";
import { WishlistPlannerView } from "./WishlistPlannerView";
import { WishlistVaultTable } from "./WishlistVaultTable";
import { usePeriod } from "@/context/PeriodContext";

interface WishlistStudioProps {
  month: number;
  year: number;
  initialTab: WishlistTabType;
  items: WishlistItem[];
  forwardSnapshots: MonthlySnapshot[];
}

export function WishlistStudio({
  month,
  year,
  initialTab,
  items,
  forwardSnapshots,
}: WishlistStudioProps) {
  const { revisionTick } = usePeriod();
  const [activeTab, setActiveTab] = useState<WishlistTabType>(initialTab);
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

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

  const handleSelectTab = (nextTab: WishlistTabType) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    syncTabInUrl(nextTab);
  };

  return (
    <div className="space-y-6">
      <WishlistTabNav
        currentTab={activeTab}
        vaultCount={items.length}
        onSelectTab={handleSelectTab}
      />

      <div className="relative">
        <section
          role="tabpanel"
          id="wishlist-panel-planner"
          aria-labelledby="wishlist-tab-planner"
          data-active={activeTab === "planner" ? "true" : "false"}
          aria-hidden={activeTab !== "planner"}
          inert={activeTab !== "planner"}
          className="tab-panel"
        >
          <WishlistPlannerView
            currentMonth={month}
            currentYear={year}
            forwardSnapshots={forwardSnapshots}
            items={items}
          />
        </section>

        <section
          role="tabpanel"
          id="wishlist-panel-vault"
          aria-labelledby="wishlist-tab-vault"
          data-active={activeTab === "vault" ? "true" : "false"}
          aria-hidden={activeTab !== "vault"}
          inert={activeTab !== "vault"}
          className="tab-panel"
        >
          <WishlistVaultTable
            items={items}
            trueHourlyWageRp={intel?.lifeenergy?.trueNetHourlyWageRp}
            hoursPerWorkday={
              intel
                ? (intel.studioConfig.paycycleFormulaConfig.workHoursPerDay || 8) +
                  (intel.studioConfig.paycycleFormulaConfig.dailyCommuteHours || 0)
                : 10
            }
            onSelectItemForAnalysis={() => handleSelectTab("planner")}
          />
        </section>
      </div>
    </div>
  );
}
