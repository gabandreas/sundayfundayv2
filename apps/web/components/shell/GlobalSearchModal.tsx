"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowUpRight, Terminal } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  GlobalSearchResponse,
  GlobalSearchResultItem,
  searchGlobalTransactions,
} from "@/lib/api";
import {
  formatIDR,
  formatDate,
  formatSourceTypeLabel,
  formatFixedEssentialCategoryLabel,
} from "@/lib/utils";

type FilterPreset =
  | "ALL"
  | "MANUAL_SPEND"
  | "FIXED_ESSENTIAL"
  | "REFUND"
  | "CREDIT_BILL"
  | "INCOME";

export function GlobalSearchModal() {
  const router = useRouter();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("ALL");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const isSuperadmin = user?.role === "PLATFORM_OWNER" && user?.id === 1;
  const normalizedQuery = query.trim().toLowerCase();
  const isSqlMatch =
    isSuperadmin &&
    Boolean(
      normalizedQuery === "sql" ||
      normalizedQuery === "sql query" ||
      normalizedQuery === "query" ||
      normalizedQuery === "database" ||
      normalizedQuery === "table" ||
      normalizedQuery.startsWith("sql")
    );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      } else if (e.key === "Enter" && isOpen && isSqlMatch) {
        e.preventDefault();
        setIsOpen(false);
        router.push("/admin/sql");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSqlMatch, router]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      const params: {
        q?: string;
        type?: string;
        sourceType?: string;
        limit?: number;
      } = {
        q: query.trim() || undefined,
        limit: 50,
      };
      if (preset === "MANUAL_SPEND") {
        params.type = "DEDUCTION";
        params.sourceType = "MANUAL";
      } else if (preset === "REFUND") {
        params.sourceType = "OPERATIONAL_REFUND";
      } else if (preset === "CREDIT_BILL") {
        params.type = "CREDIT_BILL";
      } else if (preset === "INCOME") {
        params.type = "INCOME";
      }
      const res = await searchGlobalTransactions(params);
      if (!cancelled) {
        if (res && preset === "FIXED_ESSENTIAL") {
          const filteredItems = res.items.filter(
            (i) => i.fixedEssentialCategory !== null
          );
          setResults({
            ...res,
            totalMatches: filteredItems.length,
            totalDeductionsMatched: filteredItems.reduce(
              (s, i) => s + i.amount,
              0
            ),
            items: filteredItems,
          });
        } else {
          setResults(res);
        }
        setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, query, preset]);

  const handleSelectRow = (item: GlobalSearchResultItem) => {
    setIsOpen(false);
    router.push(`/ledger?month=${item.month}&year=${item.year}`);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="hidden sm:flex h-8 px-3 rounded-md bg-surface hover:bg-surface-hover border border-border items-center gap-3 text-xs font-sans text-text-secondary hover:text-text-primary transition-all active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        title="Cross-Period Global Ledger Search (Ctrl+K)"
      >
        <Search className="w-3.5 h-3.5 text-text-tertiary" />
        <span>Search all periods...</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary bg-surface-subtle border border-border-subtle rounded">
          Ctrl+K
        </kbd>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-border bg-surface shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Search Input */}
            <div className="px-4 py-3 border-b border-border flex items-center gap-3">
              <Search className="w-4 h-4 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search any transaction across all periods (e.g. 'Tokopedia', 'Bensin', 'Netflix', 'Patungan')..."
                className="w-full bg-transparent text-sm font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="text-xs font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-subtle cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Presets + Aggregate Match Summary */}
            <div className="px-4 py-2.5 border-b border-border-subtle bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: "ALL", label: "All Entries" },
                    { id: "MANUAL_SPEND", label: "Operational Spend" },
                    { id: "FIXED_ESSENTIAL", label: "Fixed Essentials" },
                    { id: "REFUND", label: "Refunds" },
                    { id: "CREDIT_BILL", label: "Credit & Debt" },
                    { id: "INCOME", label: "Extra Income" },
                  ] as Array<{ id: FilterPreset; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreset(tab.id)}
                    className={`px-2 py-1 rounded text-[11px] font-sans transition-colors cursor-pointer ${
                      preset === tab.id
                        ? "bg-surface-elevated text-text-primary font-medium border border-border"
                        : "text-text-tertiary hover:text-text-secondary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {results && (
                <div className="text-[11px] font-mono text-text-tertiary flex items-center gap-3">
                  <span>{results.totalMatches} matches</span>
                  <span>
                    Outflow:{" "}
                    <strong className="text-text-secondary">
                      {formatIDR(results.totalDeductionsMatched)}
                    </strong>
                  </span>
                  {results.totalIncomeMatched > 0 && (
                    <span>
                      Inflow/Refund:{" "}
                      <strong className="text-positive">
                        +{formatIDR(results.totalIncomeMatched)}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Top-Priority Command Route: Superadmin SQL Query Studio */}
            {isSqlMatch && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  router.push("/admin/sql");
                }}
                className="w-full px-4 py-3 bg-emerald-950/20 hover:bg-emerald-950/40 border-b border-emerald-500/30 flex items-center justify-between text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-emerald-400">
                        Superadmin SQL Query & E2E Data Studio
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-500/30">
                        /admin/sql
                      </span>
                    </div>
                    <p className="text-[11px] text-text-tertiary mt-0.5">
                      Execute raw SQL queries, inspect schemas, and manage all tenant records end-to-end
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 shrink-0">
                  <span className="text-[11px] text-text-tertiary hidden sm:inline">Jump to studio</span>
                  <kbd className="px-2 py-0.5 text-[10px] bg-emerald-900/50 border border-emerald-500/30 rounded text-emerald-300">
                    Enter ↵
                  </kbd>
                </div>
              </button>
            )}

            {/* Results List */}
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border-subtle">
              {loading && !results ? (
                <div className="py-12 text-center text-xs font-mono text-text-tertiary">
                  Searching all snapshots...
                </div>
              ) : !results || results.items.length === 0 ? (
                <div className="py-12 text-center space-y-1">
                  <div className="text-xs font-medium text-text-secondary">
                    No matching ledger transactions found
                  </div>
                  <div className="text-[11px] text-text-tertiary">
                    Try another keyword or switch the filter above.
                  </div>
                </div>
              ) : (
                results.items.map((item) => {
                  const isPositive =
                    item.type === "INCOME" ||
                    item.sourceType === "OPERATIONAL_REFUND";
                  const categoryBadge = item.fixedEssentialCategory
                    ? `Fixed Essential · ${formatFixedEssentialCategoryLabel(
                        item.fixedEssentialCategory
                      )}`
                    : formatSourceTypeLabel(item.sourceType, item.type);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectRow(item)}
                      className="w-full px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-surface-subtle/60 text-left transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-surface-elevated border border-border text-text-secondary">
                            {item.month}/{item.year}
                          </span>
                          <span className="text-xs font-medium text-text-primary truncate">
                            {item.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-text-tertiary">
                          <span className="font-mono">
                            {formatDate(item.date)}
                          </span>
                          <span>·</span>
                          <span>{categoryBadge}</span>
                          <span>·</span>
                          <span className="font-mono">
                            {item.snapshotStatus === "LOCKED"
                              ? "Locked"
                              : "Draft"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`font-mono text-xs font-medium tabular-nums ${
                            isPositive ? "text-positive" : "text-text-primary"
                          }`}
                        >
                          {isPositive ? "+" : "-"}
                          {formatIDR(item.amount)}
                        </span>
                        <ArrowUpRight className="w-3.5 h-3.5 text-text-tertiary group-hover:text-text-primary transition-colors" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-surface-subtle/30 flex items-center justify-between text-[11px] font-mono text-text-tertiary">
              <span>Click any entry to jump directly to its period ledger</span>
              <span>ESC to close</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
