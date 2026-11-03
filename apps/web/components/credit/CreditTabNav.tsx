"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type CreditTabType = "matrix" | "card" | "contracts";

interface CreditTabNavProps {
  currentTab: CreditTabType;
  month: number;
  year: number;
}

export function CreditTabNav({ currentTab, month, year }: CreditTabNavProps) {
  const tabs: Array<{ id: CreditTabType; label: string }> = [
    { id: "matrix", label: "12-Month Matrix" },
    { id: "card", label: "Credit Cards" },
    { id: "contracts", label: "Active Contracts" },
  ];

  return (
    <div className="w-full">
      <nav
        className="bg-[#0B0F19] border border-slate-800/80 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar"
        aria-label="Credit Tabs"
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/credit?month=${month}&year=${year}&tab=${tab.id}`}
              className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 ${
                isActive
                  ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
