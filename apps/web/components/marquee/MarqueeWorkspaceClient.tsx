"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Send, Settings2 } from "lucide-react";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";
import { MarqueeChatResponse, sendMarqueeChat } from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import { MarqueeResponseCards } from "./MarqueeResponseCards";

interface WorkspaceTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: MarqueeChatResponse;
}

const EXAMPLE_GROUPS = [
  {
    label: "Paycycle Pulse & Variance",
    prompts: [
      "Safe to spend today?",
      "Compare 11/2026 vs 12/2026 variance",
      "Dompet saya ada 350rb aman?",
    ],
  },
  {
    label: "Quick-Capture & Cutoff Routing",
    prompts: [
      "Log kopi kenangan 34k",
      "Catat spaylater sepatu 900rb 3x",
      "Aman ga belanja headset 450k pake cc?",
    ],
  },
  {
    label: "THR Split, Debt & Formulas",
    prompts: [
      "Split my 3.8jt Natal THR bonus",
      "Cek sisa cicilan aktif & payoff",
      "Formula net_income - total_debt - living_pool",
    ],
  },
];

export function MarqueeWorkspaceClient() {
  const { month, year, refreshPeriod } = usePeriod();
  const { locale } = useLanguage();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);

  const periodTag = `${String(month).padStart(2, "0")}/${year}`;

  const handleSend = async (customText?: string) => {
    const msg = (customText ?? input).trim();
    if (!msg || sending) return;

    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg }]);
    if (!customText) setInput("");
    setSending(true);

    try {
      const res = await sendMarqueeChat({
        message: msg,
        month,
        year,
        locale,
        activeRoute: "/marquee",
      });
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res?.summary || "No response from Marquee service.",
          response: res ?? undefined,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirm = async (turnId: string, res: MarqueeChatResponse) => {
    if (!res.pendingAction) return;
    setConfirmingId(turnId);
    try {
      const committed = await sendMarqueeChat({
        message: res.summary,
        confirm: true,
        pendingAction: res.pendingAction,
        month,
        year,
        locale,
        activeRoute: "/marquee",
      });
      if (committed) {
        setTurns((prev) => [
          ...prev,
          {
            id: `c-${Date.now()}`,
            role: "assistant",
            text: committed.summary,
            response: committed,
          },
        ]);
        refreshPeriod();
      }
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            <MarqueeMark className="w-3.5 h-3.5 text-delta-positive" />
            <span>Context-Hydrated Financial Co-Pilot · {periodTag}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary mt-0.5">
            Marquee Financial Co-Pilot
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Ask questions about your active paycycle, test purchase cutoffs, compare monthly shifts, or log spending in plain English, Bahasa Indonesia, or ä¸­æ–‡.
          </p>
        </div>

        <Link
          href="/preferences?sub=ai"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-text-primary"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>AI Provider Settings</span>
        </Link>
      </div>

      {/* Intentional Asymmetric 12-Column Workstation: 8-col Conversation Canvas + 4-col Hydrated Ledger Context Rail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="space-y-3 min-h-[280px] max-h-[540px] overflow-y-auto pr-1">
              {turns.length === 0 ? (
                <div className="space-y-4 py-4">
                  <div className="text-xs text-text-secondary">
                    Choose a command below or type in English, Bahasa Indonesia, or Chinese. Every turn hydrates your live {periodTag} paycycle state, due-day calendar, and installment milestones before responding.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-subtle border-y border-border-subtle py-3 gap-3">
                    {EXAMPLE_GROUPS.map((grp, idx) => (
                      <div
                        key={grp.label}
                        className={idx === 0 ? "md:pr-3" : idx === 1 ? "md:px-3 pt-3 md:pt-0" : "md:pl-3 pt-3 md:pt-0"}
                      >
                        <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-2">
                          {grp.label}
                        </div>
                        <div className="space-y-1.5">
                          {grp.prompts.map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => void handleSend(p)}
                              className="w-full text-left px-2.5 py-1.5 rounded border border-border-subtle bg-canvas/70 hover:border-border-strong text-xs font-mono text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-md px-4 py-3 space-y-2 ${
                      turn.role === "user"
                        ? "border border-border bg-surface ml-10"
                        : "border border-border-subtle/80 bg-surface-subtle/40 mr-6"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-medium text-text-tertiary">
                      <span>{turn.role === "user" ? "You" : "Marquee"}</span>
                      {turn.response?.hydratedContext?.periodTag && (
                        <span className="font-mono text-[10px] text-text-tertiary/80">
                          {turn.response.hydratedContext.periodTag}
                        </span>
                      )}
                    </div>
                    {turn.response ? (
                      <MarqueeResponseCards
                        response={turn.response}
                        busyConfirm={confirmingId === turn.id}
                        onConfirm={(r) => void handleConfirm(turn.id, r)}
                      />
                    ) : (
                      <div className="text-xs text-text-primary">{turn.text}</div>
                    )}
                  </div>
                ))
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="pt-3 border-t border-border-subtle flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or stage an expense (e.g. log coffee 45k, split my 3.4jt THR, compare 11/2026 vs 12/2026)..."
                className="flex-1 bg-canvas border border-border rounded px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="px-4 py-2.5 rounded erp-btn-primary hover:opacity-90 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{sending ? "Running..." : "Execute"}</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right 4-Column Hydrated Ledger & Paycycle Domain Reference Rail */}
        <aside className="lg:col-span-4 rounded-lg border border-border bg-surface p-5 space-y-4 text-xs">
          <div className="border-b border-border-subtle pb-3">
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
              Hydrated Domain Context
            </div>
            <h2 className="text-sm font-semibold text-text-primary mt-0.5">
              Active Paycycle &amp; Cutoff Rules ({periodTag})
            </h2>
          </div>

          <div className="divide-y divide-border-subtle">
            <div className="py-2.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-text-tertiary">
                Two-Stage Payday Law
              </div>
              <div className="text-text-secondary leading-relaxed">
                Attendance &amp; payslip close on the <span className="font-mono text-text-primary">25th</span>; funds land <span className="font-mono text-text-primary">H+2 working days</span> later (e.g. Nov 27, Dec 28).
              </div>
            </div>

            <div className="py-2.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-text-tertiary">
                Due-Day &amp; Cutoff Calendar
              </div>
              <div className="font-mono text-[11px] text-text-primary">
                Due Days: 8th · 11th (Card) · 17th · 23rd · 24th · 25th (PayLater)
              </div>
              <div className="text-[11px] text-text-tertiary">
                Cutoffs: SPayLater M-15d (15th/16th) · Permata CC 25th
              </div>
            </div>

            <div className="py-2.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-text-tertiary">
                Installment Payoff Milestones
              </div>
              <ul className="space-y-1 text-[11px] text-text-secondary font-mono">
                <li>JAN &apos;27 - 11.11 3x plans complete (3/3)</li>
                <li>FEB &apos;27 — High-interest personal loan reaches Rp 0</li>
                <li>SEP &apos;27 - Final 12x card plan matures</li>
              </ul>
            </div>

            <div className="pt-2.5 space-y-1">
              <div className="text-[10px] font-mono uppercase text-text-tertiary">
                Built-In Ledger Capabilities
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {[
                  "Daily Safe-to-Spend",
                  "Cutoff Simulation",
                  "THR & Payday Split",
                  "Debt Payoff Planner",
                  "Custom Formulas",
                  "Expense Staging",
                  "Wallet Check-In",
                  "Period Comparison",
                ].map((cap) => (
                  <span
                    key={cap}
                    className="px-1.5 py-0.5 rounded border border-border-subtle bg-canvas text-[10px] text-text-secondary"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
