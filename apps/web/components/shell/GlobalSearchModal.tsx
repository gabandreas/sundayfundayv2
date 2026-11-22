"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowUpRight, Terminal, Zap, CheckCircle2 } from "lucide-react";
import { BrandMark } from "@/components/primitives/BrandMark";
import { useAuth } from "@/context/AuthContext";
import { usePeriod } from "@/context/PeriodContext";
import {
  CutoffSimulateResponse,
  GlobalSearchResponse,
  GlobalSearchResultItem,
  WalletGuardStatusResponse,
  createCardCharge,
  createLineItem,
  evaluateWalletGuardApi,
  searchGlobalTransactions,
  simulateCutoffApi,
} from "@/lib/api";
import { ParsedSmartCommand, parseSmartCommand } from "@/lib/smartCommandParser";
import {
  formatIDR,
  formatDate,
  formatSourceTypeLabel,
  formatFixedEssentialCategoryLabel,
  getJakartaDateParts,
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
  const { month: activeMonth, year: activeYear, refreshPeriod } = usePeriod();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preset, setPreset] = useState<FilterPreset>("ALL");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResponse | null>(null);
  const [smartCutoffPreview, setSmartCutoffPreview] = useState<CutoffSimulateResponse | null>(
    null
  );
  const [smartWalletPreview, setSmartWalletPreview] =
    useState<WalletGuardStatusResponse | null>(null);
  const [smartExecuting, setSmartExecuting] = useState(false);
  const [smartStatusMsg, setSmartStatusMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const todayIso = getJakartaDateParts().isoDate;
  const parsedSmart: ParsedSmartCommand | null = React.useMemo(
    () => parseSmartCommand(query, activeYear || 2026, todayIso),
    [query, activeYear, todayIso]
  );

  const isSuperadmin = user?.role === "SUPERADMIN";
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

  const executeSmartCommand = React.useCallback(async () => {
    if (!parsedSmart || smartExecuting) return;
    setSmartExecuting(true);
    setSmartStatusMsg(null);

    if (parsedSmart.kind === "WALLET_CHECKIN") {
      const res = await evaluateWalletGuardApi({
        month: activeMonth,
        year: activeYear,
        actualWalletBalance: parsedSmart.actualWalletBalance,
        persist: true,
        note: "Quick-entry via Ctrl+K",
      });
      setSmartExecuting(false);
      if (!res?.guard) {
        setSmartStatusMsg({ ok: false, text: "Failed to persist wallet check-in." });
        return;
      }
      setSmartWalletPreview(res);
      setSmartStatusMsg({
        ok: true,
        text: `Saved check-in (${res.guard.guardStatus}): Free cash ${formatIDR(res.guard.freeSpendableCash)}.`,
      });
      return;
    }

    if (parsedSmart.kind === "SIMULATE_AFFORD") {
      setSmartExecuting(false);
      setIsOpen(false);
      router.push("/credit?tab=matrix&tool=simulator");
      return;
    }

    if (parsedSmart.instrument === "CREDIT_CARD") {
      const res = await createCardCharge({
        label: parsedSmart.title,
        amount: parsedSmart.amount,
        chargeType: parsedSmart.tenorMonths > 1 ? "INSTALLMENT" : "FULL",
        category: "Quick Entry",
        tenor: parsedSmart.tenorMonths,
        monthlyAmount:
          parsedSmart.tenorMonths > 1
            ? Math.round(parsedSmart.amount / parsedSmart.tenorMonths)
            : parsedSmart.amount,
        transactionDate: `${parsedSmart.purchaseDateIso}T12:00:00.000Z`,
      });
      setSmartExecuting(false);
      if (!res.success) {
        setSmartStatusMsg({ ok: false, text: res.error || "Failed to add card charge." });
        return;
      }
      setSmartStatusMsg({
        ok: true,
        text: `Recorded CC "${parsedSmart.title}" (${formatIDR(parsedSmart.amount)}) starting ${smartCutoffPreview?.startPeriodLabel ?? "routed cycle"}.`,
      });
      return;
    }

    const res = await createLineItem({
      title: parsedSmart.title,
      category: parsedSmart.instrument === "SPINJAM" ? "PERSONAL_DEBT" : "PAYLATER",
      merchantOrPlatform: parsedSmart.instrument === "SPINJAM" ? "SPinjam" : "SPayLater",
      totalAmount: parsedSmart.amount,
      amountMode: "PRINCIPAL_SPLIT",
      tenorMonths: parsedSmart.tenorMonths,
      purchaseDate: `${parsedSmart.purchaseDateIso}T12:00:00.000Z`,
      autoRouteByCutoff: true,
      cutoffDay: parsedSmart.instrument === "SPAYLATER" ? 15 : 8,
      dueDay: parsedSmart.instrument === "SPAYLATER" ? 25 : 8,
      notes: "Quick-entry via Ctrl+K",
    });
    setSmartExecuting(false);
    if (!res.success) {
      setSmartStatusMsg({ ok: false, text: res.error || "Failed to add liability item." });
      return;
    }
    setSmartStatusMsg({
      ok: true,
      text: `Added ${parsedSmart.instrument} "${parsedSmart.title}" (${formatIDR(parsedSmart.amount)}) -> ${smartCutoffPreview?.startPeriodLabel ?? "routed"}.`,
    });
  }, [
    parsedSmart,
    smartExecuting,
    activeMonth,
    activeYear,
    refreshPeriod,
    router,
    smartCutoffPreview,
  ]);

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
      } else if (e.key === "Enter" && isOpen && parsedSmart) {
        e.preventDefault();
        void executeSmartCommand();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSqlMatch, parsedSmart, executeSmartCommand, router]);

  useEffect(() => {
    if (!isOpen || !parsedSmart) {
      setSmartCutoffPreview(null);
      setSmartWalletPreview(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (parsedSmart.kind === "WALLET_CHECKIN") {
        const res = await evaluateWalletGuardApi({
          month: activeMonth,
          year: activeYear,
          actualWalletBalance: parsedSmart.actualWalletBalance,
          persist: false,
        });
        if (!cancelled) setSmartWalletPreview(res);
      } else {
        const res = await simulateCutoffApi({
          title: parsedSmart.title,
          instrument: parsedSmart.instrument,
          amountMode: "PRINCIPAL_SPLIT",
          principalAmount: parsedSmart.amount,
          tenorMonths: parsedSmart.tenorMonths,
          purchaseDate: parsedSmart.purchaseDateIso,
        });
        if (!cancelled) setSmartCutoffPreview(res);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, parsedSmart, activeMonth, activeYear]);

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
        const normalizedRes: GlobalSearchResponse | null = Array.isArray(res)
          ? {
              query: query.trim(),
              totalMatches: res.length,
              totalDeductionsMatched: (res as GlobalSearchResultItem[])
                .filter((i) => i.type === "DEDUCTION" || i.type === "CREDIT_BILL")
                .reduce((s, i) => s + Number(i.amount ?? 0), 0),
              totalIncomeMatched: (res as GlobalSearchResultItem[])
                .filter((i) => i.type === "INCOME")
                .reduce((s, i) => s + Number(i.amount ?? 0), 0),
              items: res,
            }
          : res && Array.isArray(res.items)
            ? res
            : null;

        if (normalizedRes && preset === "FIXED_ESSENTIAL") {
          const filteredItems = normalizedRes.items.filter(
            (i) => i.fixedEssentialCategory !== null
          );
          setResults({
            ...normalizedRes,
            totalMatches: filteredItems.length,
            totalDeductionsMatched: filteredItems.reduce(
              (s, i) => s + i.amount,
              0
            ),
            items: filteredItems,
          });
        } else {
          setResults(normalizedRes);
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
        className="hidden md:flex h-8 w-8 xl:w-full xl:max-w-[240px] px-0 xl:px-2.5 rounded-md bg-surface hover:bg-surface-hover border border-border items-center justify-center xl:justify-between gap-2 text-xs font-sans text-text-secondary hover:text-text-primary transition-all active:scale-[0.98] cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
        title="Cross-Period Global Ledger Search (Ctrl+K)"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
          <span className="hidden xl:inline truncate">Search or jump to...</span>
        </div>
        <kbd className="hidden xl:inline-block px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary bg-surface-subtle border border-border-subtle rounded shrink-0">
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
              <BrandMark size={18} className="shrink-0" />
              <Search className="w-4 h-4 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSmartStatusMsg(null);
                }}
                placeholder="Search ledger or type quick command (e.g. 'kopken 34200 spaylater', 'claude 350000 cc 21 nov', 'wallet 515000', 'afford 1.5m spaylater 3x')..."
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

            {/* Quick Actions Shortcuts */}
            {(normalizedQuery.length === 0 ||
              [
                "matrix",
                "simulator",
                "bridge",
                "loan",
                "contract",
                "credit",
                "borrow",
                "p1",
                "overview",
                "subscription",
                "recurring",
                "kill",
                "quota",
                "guide",
                "help",
                "panduan",
                "sop",
                "manual",
              ].some((kw) => normalizedQuery.includes(kw))) && (
              <div className="px-4 py-2.5 border-b border-border-subtle bg-canvas/40 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-mono uppercase text-text-tertiary mr-1">
                  Quick Jumps:
                </span>
                {[
                  { label: "Bill Schedule & Cards", href: "/credit?sub=matrix" },
                  { label: "Payoff & Cutoff Check", href: "/credit?sub=simulator" },
                  { label: "Statement Import", href: "/import" },
                  { label: "Scenario Lab", href: "/scenarios" },
                  { label: "Savings Pockets", href: "/savings?sub=pockets" },
                  { label: "Alerts & Email", href: "/preferences?sub=notifications" },
                  { label: "Overview & Savings Advance", href: "/" },
                  { label: "User Guide", href: "/guide" },
                ].map((act) => (
                  <button
                    key={act.href}
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      router.push(act.href);
                    }}
                    className="px-2 py-1 rounded border border-border bg-surface hover:bg-surface-hover text-[11px] font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                  >
                    {act.label}
                  </button>
                ))}
              </div>
            )}

            {/* Smart Command Execution Bar */}
            {(parsedSmart || smartStatusMsg) && (
              <div className="px-4 py-3 border-b border-border bg-surface-subtle/80 space-y-2">
                {parsedSmart && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Zap className="w-4 h-4 text-delta-positive shrink-0 mt-0.5" />
                      <div className="space-y-0.5 min-w-0">
                        <div className="text-xs font-mono font-semibold text-text-primary flex flex-wrap items-center gap-2">
                          <span>
                            {parsedSmart.kind === "WALLET_CHECKIN"
                              ? `WALLET CHECK-IN · ${formatIDR(parsedSmart.actualWalletBalance)}`
                              : parsedSmart.kind === "SIMULATE_AFFORD"
                                ? `AFFORDABILITY CHECK · "${parsedSmart.title}" (${formatIDR(parsedSmart.amount)} · ${parsedSmart.tenorMonths}x ${parsedSmart.instrument})`
                                : `QUICK ENTRY · ${parsedSmart.instrument} "${parsedSmart.title}" (${formatIDR(parsedSmart.amount)} · ${parsedSmart.tenorMonths}x)`}
                          </span>
                        </div>
                        {parsedSmart.kind !== "WALLET_CHECKIN" && smartCutoffPreview && (
                          <div className="text-[11px] font-mono text-text-secondary">
                            Routed: <strong className="text-text-primary">{smartCutoffPreview.startPeriodLabel}</strong> · 1st Due {smartCutoffPreview.firstDueDateIso} · DSR {smartCutoffPreview.dsrBeforePercent}% â†’ {smartCutoffPreview.dsrAfterPercent}% ({smartCutoffPreview.verdict})
                          </div>
                        )}
                        {parsedSmart.kind === "WALLET_CHECKIN" && smartWalletPreview?.guard && (
                          <div className="text-[11px] font-mono text-text-secondary">
                            Free Cash: <strong className="text-text-primary">{formatIDR(smartWalletPreview.guard.freeSpendableCash)}</strong> · Hold: {formatIDR(smartWalletPreview.guard.reservedBillsTotal)} · Guard: <strong>{smartWalletPreview.guard.guardStatus}</strong>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={smartExecuting}
                      onClick={() => void executeSmartCommand()}
                      className="px-3 py-1.5 rounded erp-btn-primary text-xs font-mono font-semibold hover:opacity-90 disabled:opacity-50 shrink-0 cursor-pointer"
                    >
                      {smartExecuting
                        ? "Executing..."
                        : parsedSmart.kind === "SIMULATE_AFFORD"
                          ? "Open Simulator (Enter)"
                          : parsedSmart.kind === "WALLET_CHECKIN"
                            ? "Save Check-In (Enter)"
                            : "Execute Entry (Enter)"}
                    </button>
                  </div>
                )}

                {smartStatusMsg && (
                  <div
                    className={`flex items-center gap-2 text-xs font-mono ${
                      smartStatusMsg.ok ? "text-delta-positive" : "text-urgency"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{smartStatusMsg.text}</span>
                  </div>
                )}
              </div>
            )}

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
                    Enter â†µ
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
              ) : !results || !Array.isArray(results.items) || results.items.length === 0 ? (
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
