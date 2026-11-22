"use client";

import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { MarqueeChatResponse } from "@/lib/api";

interface MarqueeResponseCardsProps {
  response: MarqueeChatResponse;
  busyConfirm?: boolean;
  onConfirm?: (res: MarqueeChatResponse) => void;
  onCancelPending?: () => void;
}

export function MarqueeResponseCards({
  response,
  busyConfirm = false,
  onConfirm,
  onCancelPending,
}: MarqueeResponseCardsProps) {
  return (
    <div className="space-y-3">
      <div className="text-xs text-text-primary leading-relaxed">{response.summary}</div>

      {response.cards && response.cards.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {response.cards.map((card, idx) => (
            <div
              key={`${card.label}-${idx}`}
              className="rounded border border-border-subtle bg-canvas/80 px-2.5 py-2"
            >
              <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary truncate">
                {card.label}
              </div>
              <div
                className={`text-xs font-mono font-semibold mt-0.5 tabular-nums truncate ${
                  card.tone === "positive"
                    ? "text-delta-positive"
                    : card.tone === "caution"
                      ? "text-caution"
                      : card.tone === "urgency"
                        ? "text-urgency"
                        : "text-text-primary"
                }`}
                title={card.value}
              >
                {card.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {response.pendingAction && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
          <span className="text-[11px] font-mono text-text-secondary">
            Requires confirmation before writing to ledger
          </span>
          <div className="flex items-center gap-2">
            {onCancelPending && (
              <button
                type="button"
                disabled={busyConfirm}
                onClick={onCancelPending}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-surface hover:bg-surface-hover text-[11px] font-mono text-text-secondary cursor-pointer"
              >
                <XCircle className="w-3 h-3" />
                <span>Cancel</span>
              </button>
            )}
            {onConfirm && (
              <button
                type="button"
                disabled={busyConfirm}
                onClick={() => onConfirm(response)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-text-primary text-canvas hover:opacity-90 text-[11px] font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>{busyConfirm ? "Saving..." : "Confirm & Save"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
