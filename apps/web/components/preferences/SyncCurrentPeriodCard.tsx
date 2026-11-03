"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, Check, X, ShieldAlert } from "lucide-react";
import { syncConfigToPeriod } from "@/lib/api";

export type SnapshotStatus = "DRAFT" | "LOCKED";

interface SyncCurrentPeriodCardProps {
  activeMonth: number;
  activeYear: number;
  snapshotStatus?: SnapshotStatus | string | null;
  snapshotExists: boolean;
}

export function SyncCurrentPeriodCard({
  activeMonth,
  activeYear,
  snapshotStatus,
  snapshotExists,
}: SyncCurrentPeriodCardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isLocked = snapshotStatus === "LOCKED";
  const periodLabel = `${activeMonth}/${activeYear}`;

  const handleConfirmSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);

    try {
      const res = await syncConfigToPeriod(activeMonth, activeYear);
      if (res.success) {
        setSyncSuccess(true);
        setIsOpen(false);
        startTransition(() => {
          router.refresh();
        });
        setTimeout(() => setSyncSuccess(false), 3000);
      } else {
        setErrorMessage(res.error || "Failed to synchronize configuration targets");
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Network error during synchronization");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wider text-text-tertiary uppercase font-sans">
              PERIOD BASELINE SYNCHRONIZATION
            </span>
            <span
              className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded border ${
                isLocked
                  ? "border-[rgba(255,56,56,0.4)] text-urgency bg-[rgba(255,56,56,0.12)]"
                  : "border-border-subtle text-text-secondary bg-surface-subtle"
              }`}
            >
              {snapshotExists ? (isLocked ? "LOCKED" : "DRAFT") : "NO SNAPSHOT"}
            </span>
          </div>
          <h2 className="text-sm font-semibold font-sans text-text-primary">
            Sync Baseline Targets to Active Period ({periodLabel})
          </h2>
          <p className="text-xs font-sans text-text-tertiary mt-1 max-w-2xl leading-relaxed">
            Per system architecture, each monthly snapshot freezes its baseline targets at creation time.
            Updating global preferences applies defaults to future periods without altering existing snapshots.
            Use this action to overwrite the active period&apos;s frozen targets with current global values.
          </p>
        </div>

        {/* Sync Trigger Button */}
        <div className="shrink-0 flex items-center gap-2">
          {syncSuccess && (
            <div className="flex items-center gap-1.5 text-xs font-sans text-delta-positive font-medium">
              <Check className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span>Targets Synchronized</span>
            </div>
          )}

          {isLocked ? (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-subtle text-text-tertiary border border-border-subtle cursor-not-allowed">
              <ShieldAlert className="w-3.5 h-3.5 text-text-tertiary" strokeWidth={1.8} />
              <span>Locked Period (Read-Only)</span>
            </div>
          ) : !snapshotExists ? (
            <div className="px-3 py-1.5 rounded text-xs font-sans text-text-tertiary border border-border-subtle bg-surface-subtle">
              No Snapshot for {periodLabel}
            </div>
          ) : (
            <button
              type="button"
              id="sync-to-current-period-btn"
              onClick={() => {
                setErrorMessage(null);
                setIsOpen(true);
              }}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-sans font-medium bg-surface hover:bg-surface-hover text-text-primary border border-border hover:border-text-secondary transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5 text-text-secondary" strokeWidth={1.8} />
              <span>Sync to Current Period</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sync-period-title"
            className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-2xl space-y-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-caution shrink-0" strokeWidth={1.8} />
                <div>
                  <h3
                    id="sync-period-title"
                    className="text-base font-semibold font-sans text-text-primary tracking-tight"
                  >
                    Overwrite Baseline Targets for {periodLabel}?
                  </h3>
                  <p className="text-xs font-sans text-text-tertiary mt-0.5">
                    Irreversible target overwrite and snapshot recalculation.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSyncing) {
                    setIsOpen(false);
                    setErrorMessage(null);
                  }
                }}
                disabled={isSyncing}
                className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.8} />
              </button>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.30)] text-xs font-sans text-delta-negative leading-relaxed">
                <div className="font-medium mb-0.5">Synchronization Failed</div>
                <div>{errorMessage}</div>
              </div>
            )}

            {/* Confirmation details */}
            <div className="space-y-2.5 text-xs font-sans text-text-secondary">
              <p className="text-text-primary font-medium">
                This operation will perform the following actions on period {periodLabel}:
              </p>
              <ul className="space-y-2 list-disc list-inside text-text-secondary leading-relaxed pl-1">
                <li>
                  <strong className="text-text-primary">Overwrite Frozen Targets:</strong> Updates <span className="font-mono text-text-primary">dailyOperational</span>, <span className="font-mono text-text-primary">transport</span>, <span className="font-mono text-text-primary">internet</span>, <span className="font-mono text-text-primary">vape</span>, <span className="font-mono text-text-primary">haircut</span>, and <span className="font-mono text-text-primary">savings</span> with current Global Configuration values.
                </li>
                <li>
                  <strong className="text-text-primary">Trigger Recalculation:</strong> Authoritative payroll, waterfall deductions, and daily pacing calculations will recalculate immediately.
                </li>
                <li>
                  <strong className="text-text-primary">Audit Log:</strong> Records a <span className="font-mono text-text-primary">RESYNC_CONFIG_TARGETS</span> entry in the audit journal.
                </li>
              </ul>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
              <button
                type="button"
                id="cancel-sync-btn"
                onClick={() => {
                  setIsOpen(false);
                  setErrorMessage(null);
                }}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded text-xs font-sans font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-sync-btn"
                onClick={handleConfirmSync}
                disabled={isSyncing}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-sans font-medium bg-delta-positive hover:bg-emerald-600 text-surface font-semibold transition-colors disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" strokeWidth={1.8} />
                    <span>Syncing & Recalculating...</span>
                  </>
                ) : (
                  <span>Confirm & Overwrite Targets</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
