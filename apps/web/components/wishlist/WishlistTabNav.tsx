"use client";

import React from "react";
import Link from "next/link";

export type WishlistTabType = "planner" | "vault";

interface WishlistTabNavProps {
  currentTab: WishlistTabType;
  month: number;
  year: number;
  vaultCount?: number;
}

export function WishlistTabNav({
  currentTab,
  month,
  year,
  vaultCount,
}: WishlistTabNavProps) {
  const tabs: Array<{ id: WishlistTabType; label: string; count?: number }> = [
    { id: "planner", label: "Simulator & Planner" },
    { id: "vault", label: "Wishlist Vault", count: vaultCount },
  ];

  return (
    <div className="w-full">
      <nav
        className="bg-[#0B0F19] border border-slate-800/80 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar"
        aria-label="Wishlist Tabs"
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/wishlist?month=${month}&year=${year}&tab=${tab.id}`}
              className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 ${
                isActive
                  ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded ${
                    isActive
                      ? "bg-slate-700/80 text-white"
                      : "bg-slate-800/60 text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
