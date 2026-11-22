"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Send, Sparkles, Settings2 } from "lucide-react";
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
    label: "Live Pacing & Cash",
    prompts: [
      "Safe to spend today?",
      "Dompet saya ada 350rb aman?",
      "今天还能花多少钱？",
    ],
  },
  {
    label: "Quick-Capture & Affordability",
    prompts: [
      "Log kopi kenangan 34k",
      "Catat spaylater sepatu 900rb 3x",
      "Aman ga belanja headset 450k pake cc?",
    ],
  },
  {
    label: "Liabilities, Savings & Prepayment",
    prompts: [
      "Upcoming bills due this cycle",
      "Cek sisa cicilan aktif SPinjam",
      "Simulasi pelunasan dipercepat 1jt snowball vs avalanche",
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

  const handleSend = async (customText?: string) => {
    const msg = (customText ?? input).trim();
    if (!msg || sending) return;

    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", text: msg }]);
    if (!customText) setInput("");
    setSending(true);

    try {
      const res = await sendMarqueeChat({ message: msg, month, year, locale });
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
            <Sparkles className="w-3.5 h-3.5 text-delta-positive" />
            <span>3-Tier Deterministic Financial Co-Pilot</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary mt-0.5">
            Marquee AI &amp; Quick-Capture Workspace
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            Trilingual Tier 1 NLU executes instantaneously with zero hallucinations; optional Tier 2 BYOK Gemini 3.8 Flash / Groq handles multi-clause intent routing. Press <kbd className="px-1.5 py-0.5 rounded border border-border bg-surface font-mono text-[10px]">Alt+M</kbd> anywhere.
          </p>
        </div>

        <Link
          href="/preferences?sub=ai"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-border bg-surface hover:bg-surface-hover text-xs font-medium text-text-primary"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Configure Keys &amp; Webhook</span>
        </Link>
      </div>

      {/* Prompt Starters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EXAMPLE_GROUPS.map((grp) => (
          <div key={grp.label} className="rounded-lg border border-border bg-surface p-4 space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
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

      {/* Conversation Thread */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="space-y-3 min-h-[220px] max-h-[520px] overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="py-12 text-center text-xs text-text-tertiary">
              Select a quick prompt above or enter a financial command below to query live cycle data.
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`rounded border px-4 py-3 space-y-2 ${
                  turn.role === "user"
                    ? "border-border-strong bg-canvas ml-12"
                    : "border-border-subtle bg-surface-subtle/50 mr-12"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                  <span>{turn.role === "user" ? "User Query" : "Marquee Deterministic Engine"}</span>
                  {turn.response && (
                    <span>
                      {turn.response.tierUsed} · {turn.response.model} · {turn.response.tool}
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
            placeholder="Enter command in EN / ID / ZH (e.g. log coffee 45k, aman ga beli mic 800rb 3x paylater)..."
            className="flex-1 bg-canvas border border-border rounded px-3.5 py-2.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="px-4 py-2.5 rounded bg-text-primary text-canvas hover:opacity-90 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{sending ? "Evaluating..." : "Execute"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
