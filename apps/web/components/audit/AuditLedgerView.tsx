import React from "react";
import { PaginatedAuditLogs } from "@/lib/api";

interface AuditLedgerViewProps {
  logs: PaginatedAuditLogs;
}

export function AuditLedgerView({ logs }: AuditLedgerViewProps) {
  if (logs.items.length === 0) {
    return (
      <div className="p-8 text-center border border-border-subtle rounded-lg text-text-tertiary text-sm">
        No audit log events available.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-surface-subtle border-b border-border-subtle">
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-36">
                Timestamp
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">
                Period
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Category
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">
                Action
              </th>
              <th className="py-2.5 px-4 text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Summary
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {logs.items.map((log) => {
              const date = new Date(log.createdAt);
              return (
                <tr key={log.id} className="hover:bg-surface-subtle/50 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-text-secondary whitespace-nowrap tabular-nums">
                    {date.toLocaleString("id-ID", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-text-secondary tabular-nums">
                    {log.month && log.year ? `${log.month}/${log.year}` : "-"}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border border-border-subtle bg-surface-subtle text-text-tertiary">
                      {log.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-text-primary">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-sm text-text-primary">
                    {log.summary}
                    {log.details && (
                      <p className="text-xs text-text-tertiary mt-0.5 break-all">
                        {log.details}
                      </p>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Basic Pagination Header */}
      <div className="flex items-center justify-between px-2 text-xs font-sans text-text-tertiary">
        <span>
          Showing {logs.items.length} of {logs.total} events
        </span>
        <span>
          Page {logs.page} of {logs.totalPages}
        </span>
      </div>
    </div>
  );
}
