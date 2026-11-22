"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Send, X, ArrowUpRight } from "lucide-react";
import { MarqueeMark } from "@/components/primitives/MarqueeMark";
import { MarqueeChatResponse, sendMarqueeChat } from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import { MarqueeResponseCards } from "./MarqueeResponseCards";

interface MarqueeCoPilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  text: string;
  response?: MarqueeChatResponse;
}

const QUICK_PROMPTS = [
  "Safe to spend today?",
  "Log kopi kenangan 34k",
  "Split my 3.4jt Natal THR bonus",
  "Compare 11/2026 vs 12/2026 variance",
  "Cek sisa cicilan aktif SPinjam",
  "Formula net_income - total_debt - living_pool",
];

function isPointInsideRect(x: number, y: number, rect: DOMRect): boolean {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

export function MarqueeCoPilotDrawer({ isOpen, onClose }: MarqueeCoPilotDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pointerDownInsideRef = useRef<boolean>(true);
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSubTab = searchParams?.get("sub") ?? null;

  const { month, year, refreshPeriod } = usePeriod();
  const { locale } = useLanguage();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (isOpen && !dlg.open) {
      dlg.showModal();
      setTimeout(() => inputRef.current?.focus(), 20);
    } else if (!isOpen && dlg.open) {
      dlg.close();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = async (promptText?: string) => {
    const msg = (promptText ?? input).trim();
    if (!msg || sending) return;

    const userItem: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      text: msg,
    };
    setMessages((prev) => [...prev, userItem]);
    if (!promptText) setInput("");
    setSending(true);

    try {
      const res = await sendMarqueeChat({
        message: msg,
        month,
        year,
        locale,
        activeRoute: pathname || "/",
        activeSubTab,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          text: res?.summary || "Unable to evaluate query right now.",
          response: res ?? undefined,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleConfirmPending = async (msgId: string, res: MarqueeChatResponse) => {
    if (!res.pendingAction) return;
    setConfirmingId(msgId);
    try {
      const committed = await sendMarqueeChat({
        message: res.summary,
        confirm: true,
        pendingAction: res.pendingAction,
        month,
        year,
        locale,
        activeRoute: pathname || "/",
        activeSubTab,
      });
      if (committed) {
        setMessages((prev) => [
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

  const periodTag = `${String(month).padStart(2, "0")}/${year}`;

  return (
    <dialog
      ref={dialogRef}
      className="marquee-drawer shadow-2xl"
      aria-labelledby="marquee-drawer-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onPointerDown={(e) => {
        const rect = dialogRef.current?.getBoundingClientRect();
        if (!rect) return;
        pointerDownInsideRef.current = isPointInsideRect(e.clientX, e.clientY, rect);
      }}
      onPointerUp={(e) => {
        if (pointerDownInsideRef.current) return;
        const rect = dialogRef.current?.getBoundingClientRect();
        if (!rect) return;
        if (!isPointInsideRect(e.clientX, e.clientY, rect)) {
          onClose();
        }
      }}
    >
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between gap-2 shrink-0 bg-canvas">
        <div className="flex items-center gap-2.5 min-w-0">
          <MarqueeMark className="w-4 h-4 text-delta-positive shrink-0" />
          <div className="min-w-0">
            <h2
              id="marquee-drawer-title"
              className="text-xs font-semibold text-text-primary truncate"
            >
              Marquee Financial Co-Pilot
            </h2>
            <p className="text-[10px] font-mono text-text-tertiary truncate">
              Context: {periodTag} · {pathname || "/"}
              {activeSubTab ? `?sub=${activeSubTab}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/marquee"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-mono text-text-secondary hover:text-text-primary"
          >
            <span>Expand</span>
            <ArrowUpRight className="w-3 h-3" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Marquee drawer"
            className="p-1.5 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-surface">
        {/* Proactive Paycycle Digest Strip */}
        <div className="rounded border border-border-subtle bg-canvas/80 px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            <span>Paycycle Digest · {periodTag}</span>
            <span>Alt+M</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              messages[messages.length - 1]?.response?.proactiveReminders ?? [
                {
                  id: "digest-pace",
                  tone: "positive" as const,
                  text: `Check ${periodTag} daily safe-to-spend & remaining living cash`,
                  prompt: "Safe to spend today?",
                },
                {
                  id: "digest-due",
                  tone: "default" as const,
                  text: "Review upcoming due dates (8th, 11th, 17th, 23rd-25th)",
                  prompt: "Upcoming bills due this cycle",
                },
                {
                  id: "digest-variance",
                  tone: "caution" as const,
                  text: "Compare 11/2026 vs 12/2026 cycle variance",
                  prompt: "Compare 11/2026 vs 12/2026 variance",
                },
              ]
            ).map((rem) => (
              <button
                key={rem.id}
                type="button"
                onClick={() => void handleSubmit(rem.prompt)}
                className={`text-left px-2 py-1 rounded border text-[11px] font-sans transition-colors cursor-pointer ${
                  rem.tone === "caution"
                    ? "border-caution/30 bg-caution/10 text-caution hover:border-caution/50"
                    : rem.tone === "positive"
                      ? "border-delta-positive/30 bg-delta-positive/10 text-delta-positive hover:border-delta-positive/50"
                      : "border-border bg-surface text-text-secondary hover:text-text-primary"
                }`}
              >
                {rem.text}
              </button>
            ))}
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="space-y-3">
            <div className="border-b border-border-subtle pb-3 text-xs text-text-secondary space-y-1">
              <div className="font-semibold text-text-primary">
                Grounded in your live {periodTag} ledger (EN / ID / ZH)
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                Check daily pacing, test SPayLater 15th / Card 20th cutoffs, plan your THR split, compare period variance, or stage expenses in Rupiah shorthand (&quot;log kopi 35k&quot;, &quot;catat spaylater 900rb 3x&quot;).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-mono uppercase text-text-tertiary">
                Suggested Commands
              </div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void handleSubmit(q)}
                    className="px-2.5 py-1 rounded border border-border bg-canvas hover:bg-surface-hover text-[11px] font-mono text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((item) => (
            <div
              key={item.id}
              className={`rounded border px-3 py-2.5 space-y-2 ${
                item.role === "user"
                  ? "border-border-strong bg-canvas ml-6"
                  : "border-border-subtle bg-surface-subtle/50 mr-2"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-mono text-text-tertiary">
                <span>{item.role === "user" ? "You" : "Marquee"}</span>
                {item.response && (
                  <span>
                    {item.response.tierUsed} · {item.response.tool}
                  </span>
                )}
              </div>
              {item.response ? (
                <MarqueeResponseCards
                  response={item.response}
                  busyConfirm={confirmingId === item.id}
                  onConfirm={(r) => void handleConfirmPending(item.id, r)}
                />
              ) : (
                <div className="text-xs text-text-primary">{item.text}</div>
              )}
            </div>
          ))
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Composer Footer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="p-3 border-t border-border bg-canvas flex items-center gap-2 shrink-0"
      >
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask or log expense (e.g. beli sate 55rb)..."
          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send to Marquee"
          className="px-3 py-2 rounded bg-text-primary text-canvas hover:opacity-90 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sending ? "..." : "Send"}</span>
        </button>
      </form>
    </dialog>
  );
}
