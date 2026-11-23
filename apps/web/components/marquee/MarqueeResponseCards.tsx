"use client";

import React from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { MarqueeChatResponse, MarqueeStreamStatusEvent } from "@/lib/api";
import { MarqueeRobotAvatar, MarqueeRobotState } from "@/components/primitives/MarqueeRobotAvatar";

export function MarqueeTypingBubble({
  status,
  robotState = "thinking",
}: {
  status: MarqueeStreamStatusEvent | null;
  robotState?: MarqueeRobotState;
}) {
  return (
    <div
      data-testid="marquee-typing-bubble"
      className="rounded-md px-3.5 py-2.5 border border-border-subtle/80 bg-surface-subtle/50 mr-2 space-y-1.5"
    >
      <div className="flex items-center gap-2.5">
        <MarqueeRobotAvatar state={robotState} size={22} />
        <span className="inline-flex items-center gap-1" aria-label="Marquee is thinking">
          <span className="w-1.5 h-1.5 rounded-full bg-delta-positive marquee-typing-dot" />
          <span className="w-1.5 h-1.5 rounded-full bg-delta-positive marquee-typing-dot marquee-typing-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-delta-positive marquee-typing-dot marquee-typing-dot-3" />
        </span>
        <span className="text-[11px] font-mono text-text-primary">
          {status?.label || "Thinking..."}
        </span>
      </div>
      {status?.detail && (
        <div className="text-[10px] font-mono text-text-tertiary pl-7">
          {status.detail}
        </div>
      )}
    </div>
  );
}

interface MarqueeResponseCardsProps {
  response: MarqueeChatResponse;
  busyConfirm?: boolean;
  onConfirm?: (res: MarqueeChatResponse) => void;
  onCancelPending?: () => void;
}

function renderInlineSegments(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-semibold text-text-primary">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-surface-subtle font-mono text-[11px] text-text-primary"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function FormattedProse({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  type Block =
    | { type: "list"; ordered: boolean; items: string[] }
    | { type: "table"; headers: string[]; rows: string[][] }
    | { type: "p"; text: string };
  const blocks: Block[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const trimmed = lines[idx].trim();
    if (!trimmed) continue;

    // Detect Markdown table
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const parseCells = (row: string) =>
        row
          .slice(1, -1)
          .split("|")
          .map((c) => c.trim());
      const headers = parseCells(trimmed);
      const nextLine = (lines[idx + 1] ?? "").trim();
      const isSeparator = /^\|[\s:|-]+\|$/.test(nextLine);
      if (isSeparator) {
        idx++;
      }
      const rows: string[][] = [];
      while (idx + 1 < lines.length) {
        const candidate = lines[idx + 1].trim();
        if (!candidate.startsWith("|") || !candidate.endsWith("|")) break;
        rows.push(parseCells(candidate));
        idx++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*·]\s+(.*)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.*)$/);
    if (bulletMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const content = (orderedMatch?.[1] ?? bulletMatch?.[1] ?? "").trim();
      const prev = blocks[blocks.length - 1];
      if (prev && prev.type === "list" && prev.ordered === ordered) {
        prev.items.push(content);
      } else {
        blocks.push({ type: "list", ordered, items: [content] });
      }
    } else {
      blocks.push({ type: "p", text: trimmed });
    }
  }
  return (
    <div className="space-y-1.5 text-xs text-text-primary leading-relaxed">
      {blocks.map((b, i) => {
        if (b.type === "table") {
          return (
            <div key={i} className="overflow-x-auto rounded border border-border-subtle my-1.5">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-surface-subtle/60 border-b border-border-subtle text-text-tertiary">
                    {b.headers.map((h, hIdx) => (
                      <th key={hIdx} className="px-2.5 py-1.5 font-medium">
                        {renderInlineSegments(h)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle/60">
                  {b.rows.map((r, rIdx) => (
                    <tr key={rIdx}>
                      {r.map((cell, cIdx) => (
                        <td
                          key={cIdx}
                          className={`px-2.5 py-1.5 ${cIdx === r.length - 1 ? "font-mono text-text-primary text-right" : "text-text-secondary"}`}
                        >
                          {renderInlineSegments(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (b.type === "list") {
          return b.ordered ? (
            <ol key={i} className="list-decimal pl-4 space-y-1 text-text-secondary">
              {b.items.map((item, j) => (
                <li key={j}>{renderInlineSegments(item)}</li>
              ))}
            </ol>
          ) : (
            <ul key={i} className="list-disc pl-4 space-y-1 text-text-secondary">
              {b.items.map((item, j) => (
                <li key={j}>{renderInlineSegments(item)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{renderInlineSegments(b.text)}</p>;
      })}
    </div>
  );
}

export function MarqueeResponseCards({
  response,
  busyConfirm = false,
  onConfirm,
  onCancelPending,
}: MarqueeResponseCardsProps) {
  return (
    <div className="space-y-3">
      {response.assistantPrefix &&
        response.assistantPrefix.trim() !== response.summary.trim() && (
          <FormattedProse text={response.assistantPrefix} />
        )}

      <FormattedProse text={response.summary} />

      {(response.agentSteps?.length || response.reasoning) && (
        <details className="rounded border border-border-subtle bg-canvas/60 px-2.5 py-1.5 text-[11px] text-text-tertiary">
          <summary className="cursor-pointer font-mono text-[10px] text-text-secondary select-none">
            Thinking · {response.agentSteps?.length ?? 1} {response.agentSteps?.length === 1 ? "step" : "steps"}
          </summary>
          {response.agentSteps && response.agentSteps.length > 0 && (
            <ul className="mt-1.5 space-y-1 font-mono text-[10px]">
              {response.agentSteps.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-2 text-text-secondary">
                  <span>
                    <span className="text-delta-positive mr-1.5">·</span>
                    <strong className="text-text-primary font-medium">{s.label}</strong>
                    {s.detail ? ` — ${s.detail}` : ""}
                  </span>
                  {s.durationMs !== undefined && (
                    <span className="text-text-tertiary shrink-0">{s.durationMs}ms</span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {response.reasoning && (
            <p className="mt-1.5 pt-1.5 border-t border-border-subtle/60 whitespace-pre-line leading-relaxed text-[11px]">
              {response.reasoning}
            </p>
          )}
        </details>
      )}

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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded erp-btn-primary hover:opacity-90 text-[11px] font-mono font-semibold cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>
                  {busyConfirm
                    ? "Saving..."
                    : response.pendingAction.type === "CONFIRM_SHIFT_LIABILITY"
                      ? "Confirm Shift"
                      : response.pendingAction.type === "CONFIRM_SETTLE_LIABILITY"
                        ? "Confirm Settlement"
                        : response.pendingAction.type === "CONFIRM_BUDGET_REVISION"
                          ? "Confirm Quota"
                          : response.pendingAction.type === "CONFIRM_SAVINGS_ACTION"
                            ? "Confirm Savings"
                            : response.pendingAction.type === "CONFIRM_WISHLIST_ADD"
                              ? "Save Wishlist"
                              : response.pendingAction.type === "CONFIRM_SUBSCRIPTION_ACTION"
                                ? "Update Subscription"
                                : "Confirm & Save"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
