import React from "react";

export function WorkspaceSkeleton({
  rows = 3,
  cards = 4,
}: {
  rows?: number;
  cards?: number;
}) {
  return (
    <div className="space-y-6 w-full max-w-full animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border-subtle">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded bg-surface-elevated" />
            <div className="h-5 w-48 rounded bg-surface-elevated" />
          </div>
          <div className="h-3.5 w-80 max-w-full rounded bg-surface" />
        </div>
        <div className="h-8 w-32 rounded bg-surface border border-border-subtle" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-border-subtle bg-surface p-4 space-y-3"
          >
            <div className="h-3 w-24 rounded bg-surface-elevated" />
            <div className="h-7 w-36 rounded bg-surface-elevated" />
            <div className="h-2.5 w-full rounded bg-surface-subtle" />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border-subtle bg-surface p-5 space-y-4">
        <div className="h-4 w-52 rounded bg-surface-elevated" />
        <div className="space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full rounded bg-surface-subtle border border-border-subtle/50"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
