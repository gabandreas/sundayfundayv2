"use strict";
"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type PreferencesTabKey =
  | "modules"
  | "payroll"
  | "buckets"
  | "sandbox"
  | "policy"
  | "requests"
  | "killswitch";

interface TabItem {
  key: PreferencesTabKey;
  label: string;
  description: string;
}

const TABS: TabItem[] = [
  {
    key: "modules",
    label: "App Modules & Presets",
    description: "Pluggable Odoo-style modules, UI density & life-stage presets",
  },
  {
    key: "payroll",
    label: "Payroll Formulas",
    description: "Gross-to-net salary components and allowances",
  },
  {
    key: "buckets",
    label: "Budget Buckets & Waterfall",
    description: "Dynamic priority tiers, formula targets & overflow split",
  },
  {
    key: "sandbox",
    label: "Formula Sandbox",
    description: "Interactive paycheck and waterfall simulator",
  },
  {
    key: "policy",
    label: "Risk Policy & Backup",
    description: "Advisory thresholds, credit ceilings & disaster recovery",
  },
  {
    key: "requests",
    label: "Custom Rule Requests",
    description: "Bespoke formula requests, setup quotes & Superadmin inbox",
  },
  {
    key: "killswitch",
    label: "Subscription Kill-Switch",
    description: "Anti-fatigue auto-renew alerts, trial deadlines & 1-click cancel links",
  },
];

export function PreferencesNav() {
  const searchParams = useSearchParams();
  const currentTab = (searchParams.get("tab") as PreferencesTabKey) || "payroll";

  return (
    <div className="w-full">
      <nav
        className="bg-[#0B0F19] border border-slate-800/80 p-1 rounded-lg flex items-center gap-1 overflow-x-auto no-scrollbar"
        aria-label="Preferences Tabs"
      >
        {TABS.map((tab) => {
          const isActive = currentTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={`/preferences?tab=${tab.key}`}
              className={`whitespace-nowrap text-xs font-medium px-3 py-2 rounded-md transition-all duration-150 ${
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
