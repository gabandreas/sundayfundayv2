"use client";

import React from "react";
import Link from "next/link";
import { RotateCcw, ArrowLeft, LogIn } from "lucide-react";

export type SupportedHttpStatusCode = 401 | 403 | 404 | 429 | 500 | 502 | 503;

interface ErrorCatalogEntry {
  codeLabel: string;
  title: string;
  description: string;
  accentClass: string;
}

const ERROR_CATALOG: Record<SupportedHttpStatusCode, ErrorCatalogEntry> = {
  401: {
    codeLabel: "UNAUTHORIZED",
    title: "Authentication required",
    description:
      "Your session token has expired or is missing. Sign in again to resume ledger access.",
    accentClass: "text-caution",
  },
  403: {
    codeLabel: "FORBIDDEN",
    title: "Access restricted",
    description:
      "This route or ledger scope requires higher privileges or an untrusted IP PIN check.",
    accentClass: "text-urgency",
  },
  404: {
    codeLabel: "NOT_FOUND",
    title: "Route not found",
    description:
      "The requested period, resource, or application route does not exist in Sunday Funday ERP.",
    accentClass: "text-text-secondary",
  },
  429: {
    codeLabel: "TOO_MANY_REQUESTS",
    title: "Rate limit active",
    description:
      "Request volume or failed authentication attempts exceeded the 15-minute threshold. Wait before retrying.",
    accentClass: "text-caution",
  },
  500: {
    codeLabel: "INTERNAL_SERVER_ERROR",
    title: "Unhandled application error",
    description:
      "An internal fault interrupted rendering or API execution. No ledger state was altered on read.",
    accentClass: "text-urgency",
  },
  502: {
    codeLabel: "BAD_GATEWAY",
    title: "Upstream API unreachable",
    description:
      "The web tier received an invalid response from the NestJS backend gateway.",
    accentClass: "text-urgency",
  },
  503: {
    codeLabel: "SERVICE_UNAVAILABLE",
    title: "Service temporarily unavailable",
    description:
      "The backend API or PostgreSQL connection pool is temporarily unavailable. Retry in a few seconds.",
    accentClass: "text-caution",
  },
};

export function inferHttpStatusFromError(err?: Error & { digest?: string; statusCode?: number }): SupportedHttpStatusCode {
  if (!err) return 500;
  if (typeof err.statusCode === "number" && err.statusCode in ERROR_CATALOG) {
    return err.statusCode as SupportedHttpStatusCode;
  }
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("session expired")) {
    return 401;
  }
  if (msg.includes("403") || msg.includes("forbidden") || msg.includes("access denied")) {
    return 403;
  }
  if (msg.includes("404") || msg.includes("not found")) {
    return 404;
  }
  if (msg.includes("429") || msg.includes("too many")) {
    return 429;
  }
  if (msg.includes("502") || msg.includes("bad gateway")) {
    return 502;
  }
  if (msg.includes("503") || msg.includes("unavailable") || msg.includes("p1001") || msg.includes("timeout")) {
    return 503;
  }
  return 500;
}

interface HttpErrorStateProps {
  statusCode: SupportedHttpStatusCode;
  detailMessage?: string;
  digest?: string;
  onRetry?: () => void;
}

export function HttpErrorState({
  statusCode,
  detailMessage,
  digest,
  onRetry,
}: HttpErrorStateProps) {
  const entry = ERROR_CATALOG[statusCode] ?? ERROR_CATALOG[500];

  return (
    <div className="min-h-[70vh] w-full flex items-center justify-center px-6 py-16 bg-canvas text-text-primary">
      <div className="w-full max-w-lg rounded-lg border border-border bg-surface p-7 space-y-5">
        <div className="flex items-baseline justify-between border-b border-border-subtle pb-4">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-5xl font-semibold tracking-tight tabular-nums text-text-primary">
              {statusCode}
            </span>
            <span className={`font-mono text-[11px] ${entry.accentClass}`}>
              HTTP_{entry.codeLabel}
            </span>
          </div>
          <span className="font-mono text-[10px] text-text-tertiary">
            Sunday Funday ERP
          </span>
        </div>

        <div className="space-y-2">
          <h1 className="text-base font-sans font-semibold text-text-primary">
            {entry.title}
          </h1>
          <p className="text-xs font-sans text-text-secondary leading-relaxed">
            {entry.description}
          </p>
        </div>

        {(detailMessage || digest) && (
          <div className="rounded border border-border-subtle bg-surface-subtle p-3 space-y-1 font-mono text-[11px] text-text-tertiary">
            {detailMessage && (
              <div className="text-text-secondary break-words">{detailMessage}</div>
            )}
            {digest && <div>Trace Digest: {digest}</div>}
          </div>
        )}

        <div className="pt-2 flex flex-wrap items-center gap-2.5">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-border bg-surface-active hover:bg-surface-hover text-xs font-sans font-medium text-text-primary transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry Request
            </button>
          )}

          {statusCode === 401 ? (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-sans font-medium text-text-primary transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In
            </Link>
          ) : (
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-sans font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Return to Overview
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
