"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Settings2, Trash2 } from "lucide-react";
import { MarqueeRobotAvatar } from "@/components/primitives/MarqueeRobotAvatar";
import {
  MarqueeChatResponse,
  MarqueeMemoryRule,
  MarqueeStreamStatusEvent,
  MarqueeUiContextResponse,
  deleteMarqueeMemory,
  fetchMarqueeMemory,
  fetchMarqueeUiContext,
  sendMarqueeChat,
  sendMarqueeChatStream,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import { MarqueeResponseCards, MarqueeTypingBubble } from "./MarqueeResponseCards";

interface WorkspaceTurn {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: MarqueeChatResponse;
}

const GENERAL_EXAMPLE_GROUPS = [
  {
    label: "Daily Pacing & Stress Test",
    prompts: [
      "Safe to spend today?",
      "Run 12-month cashflow stress test",
      "Check my savings progress & goals",
    ],
  },
  {
    label: "Quick Expense & Bill Capture",
    prompts: [
      "Log coffee 45k cash",
      "Review upcoming bills this month",
      "Ingat kalau beli kopi catat ke Cash",
    ],
  },
  {
    label: "Bonus Split & History Search",
    prompts: [
      "Split my 3jt bonus",
      "Search recent spending history",
      "Hi Marquee, what can you help with?",
    ],
  },
];

const BESPOKE_EXAMPLE_GROUPS = [
  {
    label: "Paycycle Pulse & Variance",
    prompts: [
      "Safe to spend today?",
      "Stress test keuangan 12 bulan",
      "Dompet saya ada 350rb aman?",
    ],
  },
  {
    label: "Quick-Capture & Cutoff Routing",
    prompts: [
      "Log kopi kenangan 34k",
      "Catat spaylater sepatu 900rb 3x",
      "Ingat kalau beli kopi catat ke SPayLater",
    ],
  },
  {
    label: "THR Split, Debt & History Search",
    prompts: [
      "Split my 3.8jt Natal THR bonus",
      "Cari histori beli kopi bulan ini",
      "Cek saldo hari ini & simulasi sepatu 300rb SPayLater",
    ],
  },
];

export function MarqueeWorkspaceClient() {
  const { month, year, refreshPeriod } = usePeriod();
  const { locale } = useLanguage();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<MarqueeStreamStatusEvent | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [turns, setTurns] = useState<WorkspaceTurn[]>([]);
  const [memoryRules, setMemoryRules] = useState<MarqueeMemoryRule[]>([]);
  const [confirmedPulse, setConfirmedPulse] = useState(false);
  const [contextData, setContextData] = useState<MarqueeUiContextResponse | null>(null);

  const reloadMemory = async () => {
    const rules = await fetchMarqueeMemory();
    setMemoryRules(rules);
  };

  useEffect(() => {
    void reloadMemory();
  }, []);

  useEffect(() => {
    let active = true;
    void fetchMarqueeUiContext(month, year, locale).then((ctx) => {
      if (active && ctx) setContextData(ctx);
    });
    return () => {
      active = false;
    };
  }, [month, year, locale]);

  const periodTag = `${String(month).padStart(2, "0")}/${year}`;

  const handleSend = async (customText?: string) => {
    const msg = (customText ?? input).trim();
    if (!msg || sending) return;

    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg }]);
    if (!customText) setInput("");
    setSending(true);
    setLiveStatus({
      type: "status",
      phase: "THINKING",
      label: locale === "id" ? "Sedang berpikir..." : locale === "zh" ? "正在思考..." : "Thinking...",
      detail: locale === "id" ? "Membaca permintaan & konteks siklus" : locale === "zh" ? "正在解析指令与当前账期" : "Reading prompt & active cycle",
      timestamp: new Date().toISOString(),
    });

    try {
      const historySnapshot = turns
        .slice(-8)
        .map((t) => ({ role: t.role, text: t.text }));
      const res = await sendMarqueeChatStream(
        {
          message: msg,
          month,
          year,
          locale,
          activeRoute: "/marquee",
          history: historySnapshot,
        },
        (ev) => setLiveStatus(ev),
      );
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res?.summary || "No response from Marquee service.",
          response: res ?? undefined,
        },
      ]);
      void reloadMemory();
    } finally {
      setSending(false);
      setLiveStatus(null);
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
        setConfirmedPulse(true);
        setTimeout(() => setConfirmedPulse(false), 2200);
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("erp:data-mutated"));
        }
      }
    } finally {
      setConfirmingId(null);
    }
  };

  const robotState = confirmedPulse
    ? "confirmed"
    : confirmingId || liveStatus?.phase === "ANALYZING"
      ? "analyzing"
      : sending
        ? "thinking"
        : "idle";

  const exampleGroups = contextData?.isBespokeWorkspace
    ? BESPOKE_EXAMPLE_GROUPS
    : GENERAL_EXAMPLE_GROUPS;

  return (
    <div className="space-y-6 w-full max-w-full pb-16">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-start gap-3">
          <MarqueeRobotAvatar state={robotState} size={36} className="mt-0.5" />
          <div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-text-tertiary">
              <span>Context-Hydrated Financial Co-Pilot · {periodTag}</span>
              {sending && (
                <span className="text-caution">· {liveStatus?.label || "Thinking..."}</span>
              )}
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-text-primary mt-0.5">
              Marquee Financial Co-Pilot
            </h1>
            <p className="text-xs text-text-secondary mt-1">
              Ask questions about your active paycycle, shift or record bills, revise quotas, or check cutoff formulas in English, Bahasa Indonesia, or Chinese.
            </p>
          </div>
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
        <div className="lg:col-span-8 min-w-0 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
            <div className="space-y-3 min-h-[280px] max-h-[540px] overflow-y-auto pr-1">
              {turns.length === 0 ? (
                <div className="space-y-4 py-4">
                  <div className="text-xs text-text-secondary">
                    Choose a command below or type in English, Bahasa Indonesia, or Chinese. Every turn hydrates your live {periodTag} paycycle state, due-day calendar, and installment milestones before responding.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-subtle border-y border-border-subtle py-3 gap-3">
                    {exampleGroups.map((grp, idx) => (
                      <div
                        key={grp.label}
                        className={idx === 0 ? "md:pr-3" : idx === 1 ? "md:px-3 pt-3 md:pt-0" : "md:pl-3 pt-3 md:pt-0"}
                      >
                        <div className="text-[11px] font-mono text-text-tertiary mb-2">
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
                <>
                  {turns.map((turn) => (
                    <div
                      key={turn.id}
                      className={`rounded-md px-4 py-3 space-y-2 ${
                        turn.role === "user"
                          ? "border border-border bg-surface ml-10"
                          : "border border-border-subtle/80 bg-surface-subtle/40 mr-6"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-medium text-text-tertiary">
                        <span className="inline-flex items-center gap-1.5">
                          {turn.role === "assistant" && (
                            <MarqueeRobotAvatar state="idle" size={16} />
                          )}
                          <span>{turn.role === "user" ? "You" : "Marquee"}</span>
                        </span>
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
                  ))}
                  {sending && (
                    <MarqueeTypingBubble status={liveStatus} robotState={robotState} />
                  )}
                </>
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
                placeholder="Ask or record an expense (e.g. safe to spend today?, log coffee 45k, run 12-month stress test)..."
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
        <aside className="lg:col-span-4 min-w-0 xl:sticky xl:top-6 rounded-lg border border-border bg-surface p-5 space-y-4 text-xs">
          <div className="border-b border-border-subtle pb-3">
            <div className="text-[11px] font-mono text-text-tertiary">
              Hydrated Ledger Context
            </div>
            <h2 className="text-sm font-semibold text-text-primary mt-0.5">
              Active Cycle &amp; Schedule ({contextData?.cycleDateLabel || periodTag})
            </h2>
          </div>

          <div className="divide-y divide-border-subtle">
            <div className="py-2.5 space-y-1">
              <div className="text-[11px] font-mono text-text-tertiary">
                Payday Schedule
              </div>
              <div className="text-text-secondary leading-relaxed">
                {contextData?.paydayRules || "Standard monthly cycle schedule"}
              </div>
            </div>

            <div className="py-2.5 space-y-1">
              <div className="text-[11px] font-mono text-text-tertiary">
                Due-Day &amp; Cutoff Calendar
              </div>
              <div className="font-mono text-[11px] text-text-primary">
                Due days: {(contextData?.canonicalDueDays ?? [1, 15, 25]).join(" · ")}
              </div>
              <div className="text-[11px] text-text-tertiary">
                {contextData?.cutoffRules || "Cycle cutoff rules synced with your configuration"}
              </div>
            </div>

            <div className="py-2.5 space-y-1">
              <div className="text-[11px] font-mono text-text-tertiary">
                Payoff Milestones
              </div>
              {contextData?.payoffMilestones && contextData.payoffMilestones.length > 0 ? (
                <ul className="space-y-1 text-[11px] text-text-secondary font-mono">
                  {contextData.payoffMilestones.map((m, i) => (
                    <li key={`${m.periodLabel ?? m.period ?? i}-${m.event ?? m.label ?? i}`}>
                      <span className="text-text-primary">{m.periodLabel ?? m.period ?? "Milestone"}</span>
                      {" — "}
                      <span>{m.event ?? m.label ?? ""}</span>
                      {typeof m.debtClearPct === "number" ? ` (${m.debtClearPct}%)` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-[11px] text-text-tertiary">
                  No active payoff milestones for this workspace.
                </div>
              )}
            </div>

            <div className="py-2.5 space-y-1.5">
              <div className="text-[11px] font-mono text-text-tertiary">
                Built-In Capabilities &amp; Guardrails
              </div>
              <div className="flex flex-wrap gap-1 pt-1">
                {[
                  "Multi-Step Analysis",
                  "Monte Carlo Stress Test",
                  "Cutoff Simulation",
                  "Expense Staging",
                  "Bill & Due-Date Shifts",
                  "History Archive Search",
                  "Preference Memory",
                  "Income & Bonus Split",
                  "MCP Server Ready",
                ].map((cap) => (
                  <span
                    key={cap}
                    className="px-1.5 py-0.5 rounded border border-border-subtle bg-canvas text-[10px] text-text-secondary"
                  >
                    {cap}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-text-tertiary leading-relaxed pt-1">
                Restricted strictly to your Sunday Funday ledger workspace (zero cross-account reads or raw database exposure).
              </p>
            </div>

            <div className="pt-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-tertiary">
                <span>Saved Preference Memory ({memoryRules.length})</span>
                <Link href="/preferences?sub=ai" className="text-text-secondary hover:text-text-primary">
                  Settings
                </Link>
              </div>
              {memoryRules.length === 0 ? (
                <div className="text-[11px] text-text-tertiary">
                  Teach Marquee a default rule, e.g. &quot;Remember coffee purchases use Cash&quot;.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {memoryRules.map((rule) => (
                    <li
                      key={rule.id}
                      className="flex items-start justify-between gap-2 rounded border border-border-subtle bg-canvas px-2.5 py-1.5 text-[11px]"
                    >
                      <span className="text-text-secondary leading-snug">{rule.ruleText}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          if (await deleteMarqueeMemory(rule.id)) {
                            setMemoryRules((prev) => prev.filter((r) => r.id !== rule.id));
                          }
                        }}
                        aria-label={`Remove rule ${rule.id}`}
                        className="p-0.5 text-text-tertiary hover:text-delta-negative cursor-pointer shrink-0"
                        title="Forget rule"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
