"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Send, X, ArrowUpRight } from "lucide-react";
import { MarqueeRobotAvatar } from "@/components/primitives/MarqueeRobotAvatar";
import {
  MarqueeChatResponse,
  MarqueeStreamStatusEvent,
  MarqueeUiContextResponse,
  fetchMarqueeUiContext,
  sendMarqueeChat,
  sendMarqueeChatStream,
} from "@/lib/api";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/context/ToastContext";
import { MarqueeResponseCards, MarqueeTypingBubble } from "./MarqueeResponseCards";

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

const FALLBACK_PROMPTS = [
  "Safe to spend today?",
  "Log coffee 45k cash",
  "Run 12-month cashflow stress test",
  "Review upcoming bills this month",
  "Check my savings progress & goals",
  "Search recent spending history",
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
  const { toast } = useToast();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [liveStatus, setLiveStatus] = useState<MarqueeStreamStatusEvent | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmedPulse, setConfirmedPulse] = useState(false);
  const [contextData, setContextData] = useState<MarqueeUiContextResponse | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    void fetchMarqueeUiContext(month, year, locale).then((ctx) => {
      if (active && ctx) setContextData(ctx);
    });
    return () => {
      active = false;
    };
  }, [isOpen, month, year, locale]);

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
  }, [messages.length, sending]);

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
    setLiveStatus({
      type: "status",
      phase: "THINKING",
      label: locale === "id" ? "Sedang berpikir..." : locale === "zh" ? "正在思考..." : "Thinking...",
      detail: locale === "id" ? "Membaca permintaan & konteks siklus" : locale === "zh" ? "正在解析指令与当前账期" : "Reading prompt & active cycle",
      timestamp: new Date().toISOString(),
    });

    try {
      const historySnapshot = messages
        .slice(-8)
        .map((m) => ({ role: m.role, text: m.text }));
      const res = await sendMarqueeChatStream(
        {
          message: msg,
          month,
          year,
          locale,
          activeRoute: pathname || "/",
          activeSubTab,
          history: historySnapshot,
        },
        (statusEv) => {
          setLiveStatus(statusEv);
        },
      );
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
      setLiveStatus(null);
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
        setConfirmedPulse(true);
        setTimeout(() => setConfirmedPulse(false), 2200);
        toast({
          title: "Ledger updated",
          description: committed.summary,
          variant: "success",
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("erp:data-mutated"));
        }
      }
    } finally {
      setConfirmingId(null);
    }
  };

  const handleCancelPending = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.response
          ? {
              ...m,
              response: {
                ...m.response,
                pendingAction: undefined,
                summary: `${m.response.summary} (Cancelled before write)`,
              },
            }
          : m,
      ),
    );
  };

  const robotState = confirmedPulse
    ? "confirmed"
    : confirmingId || liveStatus?.phase === "ANALYZING"
      ? "analyzing"
      : sending
        ? "thinking"
        : "idle";

  const quickPrompts = contextData?.suggestedPrompts?.length
    ? contextData.suggestedPrompts
    : FALLBACK_PROMPTS;
  const activeReminders =
    messages[messages.length - 1]?.response?.proactiveReminders ??
    (contextData?.proactiveReminders?.length
      ? contextData.proactiveReminders
      : [
          {
            id: "digest-pace",
            tone: "positive" as const,
            text: `Check ${String(month).padStart(2, "0")}/${year} daily safe-to-spend & remaining living cash`,
            prompt: "Safe to spend today?",
          },
          {
            id: "digest-due",
            tone: "default" as const,
            text: "Review upcoming bills this cycle",
            prompt: "Review upcoming bills this month",
          },
          {
            id: "digest-stress",
            tone: "caution" as const,
            text: "Run 12-month cashflow stress test",
            prompt: "Run 12-month cashflow stress test",
          },
        ]);

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
          <MarqueeRobotAvatar state={robotState} size={26} />
          <div className="min-w-0">
            <h2
              id="marquee-drawer-title"
              className="text-xs font-semibold text-text-primary truncate flex items-center gap-2"
            >
              <span>Marquee Financial Co-Pilot</span>
              {sending && (
                <span className="text-[10px] font-mono font-normal text-caution">
                  {liveStatus?.label || "Thinking..."}
                </span>
              )}
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
          <div className="flex items-center justify-between text-[11px] font-mono text-text-tertiary">
            <span>Cycle Digest · {periodTag}</span>
            <span>Alt+M</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activeReminders.map((rem) => (
              <button
                key={rem.id}
                type="button"
                onClick={() => void handleSubmit(rem.prompt)}
                className={`text-left px-2 py-1 rounded text-[11px] font-sans transition-colors cursor-pointer ${
                  rem.tone === "caution"
                    ? "erp-callout-caution text-caution"
                    : rem.tone === "positive"
                      ? "erp-callout-positive text-delta-positive"
                      : "border border-border bg-surface text-text-secondary hover:text-text-primary"
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
                Live ledger assistant for {periodTag} (EN / ID / ZH)
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                Check today&apos;s safe-to-spend, run a 12-month cashflow stress test, move or settle bills, revise budgets, or log daily expenses (&quot;log coffee 45k&quot;, &quot;safe to spend today?&quot;).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-mono text-text-tertiary">
                Suggested commands
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((q) => (
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
          <>
            {messages.map((item) => (
              <div
                key={item.id}
                className={`rounded-md px-3.5 py-2.5 space-y-2 ${
                  item.role === "user"
                    ? "border border-border bg-surface ml-8"
                    : "border border-border-subtle/80 bg-surface-subtle/40 mr-2"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-medium text-text-tertiary">
                  <span className="inline-flex items-center gap-1.5">
                    {item.role === "assistant" && (
                      <MarqueeRobotAvatar state="idle" size={16} />
                    )}
                    <span>{item.role === "user" ? "You" : "Marquee"}</span>
                  </span>
                  {item.response?.hydratedContext?.periodTag && (
                    <span className="font-mono text-[10px] text-text-tertiary/80">
                      {item.response.hydratedContext.periodTag}
                    </span>
                  )}
                </div>
                {item.response ? (
                  <MarqueeResponseCards
                    response={item.response}
                    busyConfirm={confirmingId === item.id}
                    onConfirm={(r) => void handleConfirmPending(item.id, r)}
                    onCancelPending={() => handleCancelPending(item.id)}
                  />
                ) : (
                  <div className="text-xs text-text-primary">{item.text}</div>
                )}
              </div>
            ))}
            {sending && (
              <MarqueeTypingBubble status={liveStatus} robotState={robotState} />
            )}
          </>
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
          className="flex-1 bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          aria-label="Send to Marquee"
          className="px-3 py-2 rounded erp-btn-primary hover:opacity-90 disabled:opacity-40 cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sending ? "..." : "Send"}</span>
        </button>
      </form>
    </dialog>
  );
}
