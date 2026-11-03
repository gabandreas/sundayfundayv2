"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload, Check, AlertTriangle } from "lucide-react";
import { exportDatabaseBackup, restoreDatabaseBackup } from "@/lib/api";

export function DatabaseBackupRestoreCard() {
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [showRestorePanel, setShowRestorePanel] = useState(false);
  const [parsedBackup, setParsedBackup] = useState<any | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadBackup = async () => {
    setExporting(true);
    setError(null);
    const res = await exportDatabaseBackup();
    setExporting(false);

    if (!res.success || !res.data) {
      setError(res.error || "Failed to generate ERP backup snapshot");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const blob = new Blob([JSON.stringify(res.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SundayFunday_ERP_Backup_${todayStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 2500);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    setRestoreMessage(null);
    const file = e.target.files?.[0];
    if (!file) {
      setParsedBackup(null);
      setFileName("");
      return;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!json.schemaVersion || !json.data) {
        setError(
          "Invalid backup schema. Select a valid SundayFunday_ERP_Backup_YYYY-MM-DD.json file."
        );
        setParsedBackup(null);
        return;
      }
      setParsedBackup(json);
      setFileName(file.name);
    } catch {
      setError("Failed to parse JSON file.");
      setParsedBackup(null);
    }
  };

  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsedBackup) {
      setError("Upload a valid .json backup file first.");
      return;
    }
    if (confirmPhrase.trim() !== "RESTORE_ALL_DATA") {
      setError('Type "RESTORE_ALL_DATA" to confirm full database restoration.');
      return;
    }

    setError(null);
    setRestoring(true);
    const res = await restoreDatabaseBackup({
      confirmPhrase: confirmPhrase.trim(),
      backup: parsedBackup,
    });
    setRestoring(false);

    if (!res.success) {
      setError(res.error || "Database restore failed");
      return;
    }

    setRestoreMessage(
      `Restored ${res.data?.restoredCounts?.monthlySnapshots ?? 0} snapshots, ${
        res.data?.restoredCounts?.transactions ?? 0
      } ledger entries, and ${
        res.data?.restoredCounts?.savingsManualTransactions ?? 0
      } vault records.`
    );
    setConfirmPhrase("");
    setParsedBackup(null);
    setFileName("");
    router.refresh();
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold font-sans text-text-primary">
            Full ERP JSON Snapshot Backup & Disaster Recovery
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-1">
            Export all 11 relational tables (Config, Snapshots, Ledger, Credit Cards, PayLater, Contracts, Savings Vault, Wishlist, Revisions, Audit Logs) into a portable JSON archive or restore atomically.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setShowRestorePanel((prev) => !prev);
              setError(null);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-surface-subtle hover:bg-surface-hover border border-border text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {showRestorePanel ? "Close Restore" : "Restore from Backup (.json)"}
          </button>

          <button
            type="button"
            onClick={handleDownloadBackup}
            disabled={exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-canvas hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-delta-positive" />
                <span>Backup Downloaded</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>
                  {exporting
                    ? "Exporting Snapshot..."
                    : "Download Full ERP Backup (.json)"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded text-xs font-mono text-delta-negative bg-[rgba(224,108,83,0.10)] border border-[rgba(224,108,83,0.25)]">
          {error}
        </div>
      )}

      {restoreMessage && (
        <div className="p-3 rounded text-xs font-mono text-delta-positive bg-[rgba(16,183,141,0.10)] border border-[rgba(16,183,141,0.25)]">
          {restoreMessage}
        </div>
      )}

      {showRestorePanel && (
        <form
          onSubmit={handleExecuteRestore}
          className="pt-4 border-t border-border-subtle space-y-4"
        >
          <div className="p-3 rounded bg-[rgba(224,108,83,0.08)] border border-[rgba(224,108,83,0.25)] flex items-start gap-2.5 text-xs text-text-secondary">
            <AlertTriangle className="w-4 h-4 text-delta-negative shrink-0 mt-0.5" />
            <div>
              <strong className="text-text-primary font-medium">
                Atomic Full-State Replacement:
              </strong>{" "}
              Restoring from a backup replaces all current rows in PostgreSQL inside a single database transaction and resets auto-increment sequences. Download a current backup before proceeding.
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 items-end">
            <div className="col-span-5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                1. SELECT BACKUP ARCHIVE (.JSON)
              </label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleFileSelect}
                className="w-full text-xs font-mono text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-border file:text-xs file:font-sans file:bg-surface-subtle file:text-text-primary hover:file:bg-surface-hover cursor-pointer"
              />
            </div>

            <div className="col-span-4">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-text-tertiary mb-1.5">
                2. TYPE &ldquo;RESTORE_ALL_DATA&rdquo; TO CONFIRM
              </label>
              <input
                type="text"
                value={confirmPhrase}
                onChange={(e) => setConfirmPhrase(e.target.value)}
                placeholder="RESTORE_ALL_DATA"
                className="w-full px-3 py-1.5 rounded bg-surface-subtle border border-border text-xs font-mono text-text-primary focus:outline-none focus:border-border-strong"
              />
            </div>

            <div className="col-span-3">
              <button
                type="submit"
                disabled={
                  restoring ||
                  !parsedBackup ||
                  confirmPhrase.trim() !== "RESTORE_ALL_DATA"
                }
                className="w-full py-1.5 px-3 rounded text-xs font-medium bg-delta-negative text-white hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer"
              >
                {restoring ? "Restoring ERP..." : "Execute Atomic Restore"}
              </button>
            </div>
          </div>

          {parsedBackup && (
            <div className="p-3 rounded bg-surface-subtle/60 border border-border-subtle flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-text-secondary">
              <span>
                File: <strong className="text-text-primary">{fileName}</strong>{" "}
                ({parsedBackup.exportedAt?.slice(0, 19).replace("T", " ")})
              </span>
              <div className="flex items-center gap-4">
                <span>
                  Snapshots:{" "}
                  <strong>{parsedBackup.counts?.monthlySnapshots ?? 0}</strong>
                </span>
                <span>
                  Transactions:{" "}
                  <strong>{parsedBackup.counts?.transactions ?? 0}</strong>
                </span>
                <span>
                  Card Charges:{" "}
                  <strong>
                    {parsedBackup.counts?.creditCardTransactions ?? 0}
                  </strong>
                </span>
                <span>
                  Vault Entries:{" "}
                  <strong>
                    {parsedBackup.counts?.savingsManualTransactions ?? 0}
                  </strong>
                </span>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
