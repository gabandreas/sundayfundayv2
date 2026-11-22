"use client";

import React, { useRef } from "react";
import { handleTabListKeyDown } from "@/lib/tabs";

export type AuditTabType =
  | "scorecard"
  | "operational"
  | "rewards"
  | "debt_burden"
  | "ledger";

interface AuditTabNavProps {
  currentTab: AuditTabType;
  onSelectTab: (tab: AuditTabType) => void;
}

const AUDIT_TABS: Array<{ id: AuditTabType; label: string }> = [
  { id: "scorecard", label: "Scorecard" },
  { id: "operational", label: "Operational Budget" },
  { id: "rewards", label: "Self-Reward Streak" },
  { id: "debt_burden", label: "Debt Burden" },
  { id: "ledger", label: "Audit Ledger" },
];

export function AuditTabNav({ currentTab, onSelectTab }: AuditTabNavProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  return (
    <div
      role="tablist"
      aria-label="Discipline audit views"
      className="flex items-center gap-6 border-b border-border overflow-x-auto no-scrollbar whitespace-nowrap"
    >
      {AUDIT_TABS.map((tab, idx) => {
        const isActive = currentTab === tab.id;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[idx] = el;
            }}
            id={`audit-tab-${tab.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`audit-panel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectTab(tab.id)}
            onKeyDown={(e) =>
              handleTabListKeyDown(
                e,
                AUDIT_TABS.map((x) => x.id),
                idx,
                onSelectTab,
                tabRefs,
              )
            }
            className={`pb-3 text-xs font-medium font-sans transition-colors border-b-2 -mb-px shrink-0 cursor-pointer ${
              isActive
                ? "border-accent text-text-primary"
                : "border-transparent text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
