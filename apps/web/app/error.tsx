"use client";

import React, { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorBoundary({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("Application error boundary triggered:", error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-[rgba(224,108,83,0.3)] bg-surface p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-delta-negative shrink-0 mt-0.5" strokeWidth={1.8} />
          <div className="space-y-2">
            <h2 className="text-sm font-semibold font-sans text-text-primary">
              Service Unavailable / Request Failed
            </h2>
            <p className="text-xs font-sans text-text-secondary leading-relaxed">
              Unable to reach the backend financial service. This could indicate a connection failure or an unhandled server error.
            </p>
            {error?.message && (
              <div className="p-2.5 rounded bg-surface-subtle border border-border-subtle text-[11px] font-mono text-text-tertiary break-words">
                {error.message}
              </div>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-active hover:bg-surface-hover text-text-primary border border-border hover:border-border-strong transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.8} />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
