"use client";

import React from "react";
import Link from "next/link";

export type AuditTabType = "scorecard" | "operational" | "rewards" | "debt_burden" | "ledger";

interface AuditTabNavProps {
  currentTab: AuditTabType;
}

export function AuditTabNav({ currentTab }: AuditTabNavProps) {
  const tabs: Array<{ id: AuditTabType; label: string }> = [
    { id: "scorecard", label: "Scorecard" },
    { id: "operational", label: "Operational Budget" },
    { id: "rewards", label: "Self-Reward Streak" },
    { id: "debt_burden", label: "Debt Burden" },
    { id: "ledger", label: "Audit Ledger" },
  ];

  return (
    <div className="w-full">
      <nav
        className="bg-[#0B0F19] border border-slate-800/80 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar"
        aria-label="Audit Tabs"
      >
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <Link
              key={tab.id}
              href={`/audit?tab=${tab.id}`}
              className={`whitespace-nowrap text-xs font-medium px-3.5 py-2 rounded-md transition-all duration-150 flex items-center gap-2 ${
                isActive
                  ? "bg-slate-800/90 text-white shadow-sm border border-slate-700/60"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-transparent"
              }`}
            >
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
