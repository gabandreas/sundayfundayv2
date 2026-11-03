"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  fetchSqlTables,
  executeSqlQuery,
  fetchSqlRecords,
  createSqlRecord,
  updateSqlRecord,
  deleteSqlRecord,
  SqlTableSummary,
  SqlQueryResult,
  SqlRecordsResponse,
} from "@/lib/api";
import {
  Database,
  Terminal,
  Play,
  Download,
  Plus,
  Edit2,
  Trash2,
  Search,
  Table as TableIcon,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

const QUERY_PRESETS = [
  {
    label: "All Users & Tenants",
    sql: 'SELECT id, "accountName", username, email, role, "fullName", status FROM "User" ORDER BY id;',
  },
  {
    label: "Snapshots by User",
    sql: 'SELECT id, "userId", month, year, status, "totalIncome", "totalDeductions" FROM "MonthlySnapshot" ORDER BY "userId", year, month;',
  },
  {
    label: "Active Kill-Switches",
    sql: 'SELECT id, "userId", name, amount, "promoLabel", "promoEndDate", "killSwitchArmed" FROM "CreditCardTransaction" WHERE "killSwitchArmed" = true ORDER BY id;',
  },
  {
    label: "Recent Transactions",
    sql: 'SELECT id, "snapshotId", label, amount, type, "sourceType" FROM "Transaction" ORDER BY id DESC LIMIT 25;',
  },
  {
    label: "Table Row Counts",
    sql: "SELECT relname AS table_name, n_live_tup AS row_count FROM pg_stat_user_tables ORDER BY n_live_tup DESC;",
  },
  {
    label: "Monthly Bulk Bills",
    sql: 'SELECT id, "userId", name, amount, "categoryKey", "isActive" FROM "MonthlyBulkBill" ORDER BY "userId", id;',
  },
];

export default function SqlStudioPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [tables, setTables] = useState<SqlTableSummary[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [sqlInput, setSqlInput] = useState(
    'SELECT id, "accountName", username, email, role, "fullName", status FROM "User" ORDER BY id;'
  );
  const [executionMode, setExecutionMode] = useState<
    "READ_ONLY" | "DRY_RUN_ROLLBACK" | "EXECUTE_COMMIT"
  >("READ_ONLY");

  const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Table browser view mode state
  const [viewMode, setViewMode] = useState<"QUERY" | "BROWSE">("QUERY");
  const [tableRecords, setTableRecords] = useState<SqlRecordsResponse | null>(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [userIdFilter, setUserIdFilter] = useState<string>("");
  const [recordSearch, setRecordSearch] = useState("");

  // Row Edit / Insert Modal
  const [rowModal, setRowModal] = useState<{
    isOpen: boolean;
    mode: "INSERT" | "EDIT";
    tableName: string;
    rowData: Record<string, any>;
  }>({
    isOpen: false,
    mode: "INSERT",
    tableName: "",
    rowData: {},
  });

  // Delete Confirm Modal
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    tableName: string;
    rowId: any;
  }>({
    isOpen: false,
    tableName: "",
    rowId: null,
  });

  const [toast, setToast] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Load tables metadata
  const loadTables = useCallback(async () => {
    try {
      const data = await fetchSqlTables();
      setTables(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load database schema metadata.");
    }
  }, []);

  useEffect(() => {
    if (user && user.role === "PLATFORM_OWNER" && user.id === 1) {
      loadTables();
    }
  }, [user, loadTables]);

  // Execute SQL Query
  const handleRunQuery = async () => {
    if (!sqlInput.trim()) return;
    setIsExecuting(true);
    setErrorMessage(null);
    try {
      const result = await executeSqlQuery({
        sql: sqlInput,
        mode: executionMode,
      });
      setQueryResult(result);
      setViewMode("QUERY");
      // Refresh table counts in background
      loadTables();
    } catch (err: any) {
      const errData = err.data;
      if (errData && errData.message) {
        setQueryResult({
          success: false,
          mode: executionMode,
          executionTimeMs: errData.executionTimeMs || 0,
          rowCount: 0,
          rows: [],
          fields: [],
          error: errData.message.error || errData.message,
        });
        setErrorMessage(errData.message.error || errData.message);
      } else {
        setErrorMessage(err.message || "Execution error");
      }
    } finally {
      setIsExecuting(false);
    }
  };

  // Keyboard shortcut Ctrl+Enter to execute
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRunQuery();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sqlInput, executionMode]);

  // Browse Table Records
  const handleBrowseTable = async (tableName: string, targetPage = 1) => {
    setSelectedTable(tableName);
    setViewMode("BROWSE");
    setRecordsLoading(true);
    setPage(targetPage);
    try {
      const res = await fetchSqlRecords(tableName, {
        page: targetPage,
        limit,
        userId: userIdFilter ? Number(userIdFilter) : undefined,
        search: recordSearch || undefined,
      });
      setTableRecords(res);
    } catch (err: any) {
      showToast(err.message || `Failed to fetch records from "${tableName}"`, "error");
    } finally {
      setRecordsLoading(false);
    }
  };

  // Handle Table Select from Explorer
  const handleTableSelect = (tableName: string) => {
    setSelectedTable(tableName);
    setSqlInput(`SELECT * FROM "${tableName}" LIMIT 50;`);
  };

  // Save Record (Insert or Update)
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rowModal.tableName) return;
    try {
      if (rowModal.mode === "INSERT") {
        await createSqlRecord(rowModal.tableName, rowModal.rowData);
        showToast(`Record inserted into "${rowModal.tableName}".`);
      } else {
        const pk = tableRecords?.primaryKey || "id";
        const id = rowModal.rowData[pk];
        await updateSqlRecord(rowModal.tableName, id, rowModal.rowData);
        showToast(`Record ${id} updated in "${rowModal.tableName}".`);
      }
      setRowModal({ isOpen: false, mode: "INSERT", tableName: "", rowData: {} });
      if (viewMode === "BROWSE" && selectedTable) {
        handleBrowseTable(selectedTable, page);
      } else {
        handleRunQuery();
      }
      loadTables();
    } catch (err: any) {
      showToast(err.message || "Operation failed", "error");
    }
  };

  // Delete Record
  const handleDeleteRecord = async () => {
    if (!deleteModal.tableName || deleteModal.rowId === null) return;
    try {
      await deleteSqlRecord(deleteModal.tableName, deleteModal.rowId);
      showToast(`Record ${deleteModal.rowId} deleted from "${deleteModal.tableName}".`);
      setDeleteModal({ isOpen: false, tableName: "", rowId: null });
      if (viewMode === "BROWSE" && selectedTable) {
        handleBrowseTable(selectedTable, page);
      } else {
        handleRunQuery();
      }
      loadTables();
    } catch (err: any) {
      showToast(err.message || "Delete failed", "error");
    }
  };

  // Export JSON
  const handleExportJson = () => {
    const rows = viewMode === "BROWSE" ? tableRecords?.rows : queryResult?.rows;
    if (!rows || rows.length === 0) return;
    const blob = new Blob([JSON.stringify(rows, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sql-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported JSON results file.");
  };

  // Export CSV
  const handleExportCsv = () => {
    const rows = viewMode === "BROWSE" ? tableRecords?.rows : queryResult?.rows;
    if (!rows || rows.length === 0) return;
    const fields = Object.keys(rows[0]);
    const csvLines = [
      fields.join(","),
      ...rows.map((row) =>
        fields
          .map((f) => {
            const val = row[f];
            if (val === null || val === undefined) return "";
            const s = String(val).replace(/"/g, '""');
            return `"${s}"`;
          })
          .join(",")
      ),
    ];
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sql-results-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported CSV results file.");
  };

  // Access Guard
  if (!authLoading && (!user || user.role !== "PLATFORM_OWNER" || user.id !== 1)) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-xl border border-negative/30 bg-surface shadow-2xl space-y-4">
          <ShieldAlert className="w-12 h-12 text-negative mx-auto" />
          <h2 className="text-xl font-serif text-text-primary">Access Restricted</h2>
          <p className="text-xs text-text-secondary leading-relaxed">
            The Superadmin SQL Query & E2E Data Studio is exclusively reserved for the Platform
            Owner (ID: 1). Non-superadmin tenants cannot access this workspace.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded border border-border bg-surface-subtle hover:bg-surface text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Workspace Overview</span>
          </Link>
        </div>
      </div>
    );
  }

  const filteredTables = tables.filter((t) =>
    t.tableName.toLowerCase().includes(tableSearch.toLowerCase())
  );

  const displayRows = viewMode === "BROWSE" ? tableRecords?.rows || [] : queryResult?.rows || [];
  const displayFields =
    viewMode === "BROWSE"
      ? tableRecords?.columns.map((c) => c.columnName) || []
      : queryResult?.fields || [];

  return (
    <div className="min-h-screen bg-canvas text-text-primary flex flex-col font-sans select-none">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg border text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            toast.type === "success"
              ? "bg-slate-900 border-emerald-500/40 text-emerald-300"
              : "bg-slate-900 border-negative/40 text-negative"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-negative shrink-0" />
          )}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-14 border-b border-border bg-canvas/90 px-4 sm:px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Platform Admin</span>
          </Link>
          <span className="text-border-strong select-none">/</span>
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            <h1 className="text-sm font-semibold text-text-primary tracking-tight">
              SQL Query & E2E Data Studio
            </h1>
          </div>
          <span className="hidden md:inline-block px-2 py-0.5 text-[10px] font-mono rounded bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
            SUPERADMIN ONLY
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin"
            className="px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
          >
            Console Tabs
          </Link>
          <Link
            href="/"
            className="px-3 py-1.5 text-xs rounded border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors"
          >
            Overview
          </Link>
        </div>
      </header>

      {/* Main Studio Body: 2-Column Responsive Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Schema & Table Explorer */}
        <aside className="w-64 border-r border-border bg-surface/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-border">
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary mb-2 flex items-center justify-between">
              <span>Database Tables</span>
              <button
                type="button"
                onClick={loadTables}
                className="hover:text-text-primary transition-colors"
                title="Refresh table counts"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-text-tertiary" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filter tables..."
                className="w-full pl-8 pr-2.5 py-1 text-xs rounded border border-border bg-surface text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-strong font-mono"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-border-subtle p-1.5 space-y-0.5">
            {filteredTables.map((t) => {
              const isSelected = selectedTable === t.tableName;
              return (
                <div
                  key={t.tableName}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded text-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-slate-800/80 text-white border border-slate-700/60"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                  }`}
                  onClick={() => handleTableSelect(t.tableName)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TableIcon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? "text-emerald-400" : "text-text-tertiary"
                      }`}
                    />
                    <span className="font-mono truncate">{t.tableName}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-surface border border-border text-text-tertiary group-hover:text-text-secondary">
                      {t.rowCount}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBrowseTable(t.tableName);
                      }}
                      title="Browse records directly"
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-text-tertiary hover:text-text-primary transition-opacity"
                    >
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        {/* RIGHT COLUMN: Query Editor + Results Grid */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top Control Bar: Mode, Presets, Run Button */}
          <div className="p-3 border-b border-border bg-surface flex flex-wrap items-center justify-between gap-3 shrink-0">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1.5 bg-surface-subtle p-0.5 rounded border border-border">
              <button
                type="button"
                onClick={() => setViewMode("QUERY")}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                  viewMode === "QUERY"
                    ? "bg-surface-elevated text-text-primary border border-border shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                SQL Query Console
              </button>
              <button
                type="button"
                onClick={() => {
                  if (selectedTable) handleBrowseTable(selectedTable);
                  else if (tables.length > 0) handleBrowseTable(tables[0].tableName);
                }}
                className={`px-3 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
                  viewMode === "BROWSE"
                    ? "bg-surface-elevated text-text-primary border border-border shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Table Browser {selectedTable ? `("${selectedTable}")` : ""}
              </button>
            </div>

            {/* Presets & Execution Mode */}
            <div className="flex flex-wrap items-center gap-2">
              {viewMode === "QUERY" && (
                <>
                  {/* Presets Selector */}
                  <select
                    onChange={(e) => {
                      if (e.target.value) setSqlInput(e.target.value);
                    }}
                    defaultValue=""
                    className="px-2.5 py-1 text-xs rounded border border-border bg-surface-subtle text-text-secondary hover:text-text-primary font-mono focus:outline-none cursor-pointer"
                  >
                    <option value="" disabled>
                      Quick Presets...
                    </option>
                    {QUERY_PRESETS.map((p) => (
                      <option key={p.label} value={p.sql}>
                        {p.label}
                      </option>
                    ))}
                  </select>

                  {/* Execution Mode Selector */}
                  <div className="flex items-center gap-1 text-xs font-mono">
                    <span className="text-[11px] text-text-tertiary mr-1">Mode:</span>
                    <button
                      type="button"
                      onClick={() => setExecutionMode("READ_ONLY")}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                        executionMode === "READ_ONLY"
                          ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300 font-medium"
                          : "border-border text-text-tertiary hover:text-text-secondary"
                      }`}
                      title="Read-Only Safe: Mutating queries are rejected by PostgreSQL"
                    >
                      Read-Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setExecutionMode("DRY_RUN_ROLLBACK")}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                        executionMode === "DRY_RUN_ROLLBACK"
                          ? "bg-amber-950/60 border-amber-500/40 text-amber-300 font-medium"
                          : "border-border text-text-tertiary hover:text-text-secondary"
                      }`}
                      title="Dry-Run (Rollback): Runs query and automatically rolls back changes"
                    >
                      Dry-Run
                    </button>
                    <button
                      type="button"
                      onClick={() => setExecutionMode("EXECUTE_COMMIT")}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                        executionMode === "EXECUTE_COMMIT"
                          ? "bg-rose-950/60 border-rose-500/40 text-rose-300 font-medium"
                          : "border-border text-text-tertiary hover:text-text-secondary"
                      }`}
                      title="Write / Commit: Commits mutations permanently to disk"
                    >
                      Commit
                    </button>
                  </div>

                  {/* Run Query Button */}
                  <button
                    type="button"
                    onClick={handleRunQuery}
                    disabled={isExecuting}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    <span>{isExecuting ? "Executing..." : "Run"}</span>
                    <kbd className="hidden sm:inline text-[9px] font-mono bg-emerald-700/60 px-1 py-0.2 rounded border border-emerald-400/30">
                      Ctrl+↵
                    </kbd>
                  </button>
                </>
              )}

              {viewMode === "BROWSE" && selectedTable && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRowModal({
                        isOpen: true,
                        mode: "INSERT",
                        tableName: selectedTable,
                        rowData: {},
                      })
                    }
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded border border-border-strong bg-text-primary text-canvas hover:opacity-95 font-medium transition-opacity cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Insert Row</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBrowseTable(selectedTable, page)}
                    className="p-1 rounded border border-border bg-surface text-text-tertiary hover:text-text-primary cursor-pointer"
                    title="Refresh Table"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: SQL QUERY CONSOLE */}
          {viewMode === "QUERY" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* SQL Textarea Editor */}
              <div className="h-36 border-b border-border bg-[#090D16] p-3 shrink-0 flex flex-col">
                <textarea
                  value={sqlInput}
                  onChange={(e) => setSqlInput(e.target.value)}
                  placeholder="Enter raw SQL statement (e.g. SELECT * FROM &quot;User&quot;;)..."
                  className="flex-1 w-full bg-transparent text-xs font-mono text-emerald-300 placeholder:text-text-tertiary focus:outline-none resize-none leading-relaxed"
                  spellCheck={false}
                />
                <div className="flex items-center justify-between text-[11px] font-mono text-text-tertiary border-t border-slate-800/80 pt-1.5 mt-1">
                  <span>Press Ctrl+Enter to execute immediately</span>
                  <span>{sqlInput.length} chars</span>
                </div>
              </div>

              {/* Execution Telemetry Bar */}
              <div className="px-4 py-2 border-b border-border bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  {queryResult ? (
                    <>
                      <span className="flex items-center gap-1.5 text-text-secondary">
                        <Clock className="w-3 h-3 text-text-tertiary" />
                        <span>Executed in {queryResult.executionTimeMs} ms</span>
                      </span>
                      <span>·</span>
                      <span className="text-text-secondary">
                        {queryResult.rowCount} {queryResult.rowCount === 1 ? "row" : "rows"}{" "}
                        returned
                      </span>
                      <span>·</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-mono ${
                          queryResult.mode === "READ_ONLY"
                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30"
                            : queryResult.mode === "DRY_RUN_ROLLBACK"
                            ? "bg-amber-950/60 text-amber-400 border border-amber-500/30"
                            : "bg-rose-950/60 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {queryResult.mode}
                      </span>
                    </>
                  ) : (
                    <span className="text-text-tertiary">Ready to execute query</span>
                  )}
                </div>

                {/* Export Buttons */}
                {displayRows.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] rounded border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCsv}
                      className="flex items-center gap-1 px-2.5 py-0.5 text-[11px] rounded border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>CSV</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Error Box */}
              {errorMessage && (
                <div className="p-4 bg-negative/10 border-b border-negative/30 flex items-start gap-3 text-xs text-negative shrink-0">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="font-mono leading-relaxed whitespace-pre-wrap">{errorMessage}</div>
                </div>
              )}

              {/* Query Results Grid */}
              <div className="flex-1 overflow-auto bg-surface">
                {displayRows.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono text-text-tertiary">
                    {isExecuting
                      ? "Executing query on PostgreSQL catalog..."
                      : errorMessage
                      ? "Query failed. Review error message above."
                      : "No rows returned. Execute a query to view results."}
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-subtle border-b border-border z-10 text-[10px] font-mono uppercase text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2 border-r border-border-subtle w-12 text-center">
                          #
                        </th>
                        {displayFields.map((field) => (
                          <th
                            key={field}
                            className="px-3 py-2 border-r border-border-subtle whitespace-nowrap"
                          >
                            {field}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                      {displayRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-surface-subtle/50 transition-colors divide-x divide-border-subtle"
                        >
                          <td className="px-3 py-2 text-center text-text-tertiary bg-surface-subtle/20">
                            {idx + 1}
                          </td>
                          {displayFields.map((field) => {
                            const val = row[field];
                            const isNull = val === null || val === undefined;
                            return (
                              <td
                                key={field}
                                className={`px-3 py-2 whitespace-nowrap max-w-xs truncate ${
                                  isNull
                                    ? "text-text-tertiary italic"
                                    : typeof val === "number"
                                    ? "tabular-nums text-emerald-400"
                                    : typeof val === "boolean"
                                    ? val
                                      ? "text-positive"
                                      : "text-negative"
                                    : "text-text-secondary"
                                }`}
                                title={String(val)}
                              >
                                {isNull ? "NULL" : typeof val === "object" ? JSON.stringify(val) : String(val)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* VIEW MODE 2: TABLE RECORD BROWSER WITH E2E CRUD */}
          {viewMode === "BROWSE" && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Filter bar for selected table */}
              <div className="p-3 border-b border-border bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-mono text-xs font-semibold text-text-primary">
                    Table: <span className="text-emerald-400">"{selectedTable}"</span>
                  </div>

                  {/* Filter by userId */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-text-tertiary font-mono">User ID:</label>
                    <input
                      type="number"
                      value={userIdFilter}
                      onChange={(e) => setUserIdFilter(e.target.value)}
                      placeholder="All"
                      className="w-16 px-2 py-0.5 text-xs rounded border border-border bg-surface text-text-primary font-mono focus:outline-none"
                    />
                  </div>

                  {/* Text search */}
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] text-text-tertiary font-mono">Search:</label>
                    <input
                      type="text"
                      value={recordSearch}
                      onChange={(e) => setRecordSearch(e.target.value)}
                      placeholder="Search text fields..."
                      className="w-40 px-2 py-0.5 text-xs rounded border border-border bg-surface text-text-primary focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => selectedTable && handleBrowseTable(selectedTable, 1)}
                    className="px-2.5 py-0.5 text-xs rounded border border-border bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-subtle transition-colors cursor-pointer"
                  >
                    Apply Filter
                  </button>
                </div>

                {/* Pagination Controls */}
                {tableRecords && (
                  <div className="flex items-center gap-3 font-mono text-[11px] text-text-secondary">
                    <span>
                      {tableRecords.totalRows} {tableRecords.totalRows === 1 ? "record" : "records"}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => selectedTable && handleBrowseTable(selectedTable, page - 1)}
                        className="p-1 rounded border border-border bg-surface text-text-secondary disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-2">
                        {page} / {tableRecords.totalPages || 1}
                      </span>
                      <button
                        type="button"
                        disabled={page >= tableRecords.totalPages}
                        onClick={() => selectedTable && handleBrowseTable(selectedTable, page + 1)}
                        className="p-1 rounded border border-border bg-surface text-text-secondary disabled:opacity-30 cursor-pointer"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Records Table */}
              <div className="flex-1 overflow-auto bg-surface">
                {recordsLoading ? (
                  <div className="p-12 text-center text-xs font-mono text-text-tertiary">
                    Loading records from "{selectedTable}"...
                  </div>
                ) : !tableRecords || tableRecords.rows.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono text-text-tertiary">
                    No records found in "{selectedTable}".
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border-collapse">
                    <thead className="sticky top-0 bg-surface-subtle border-b border-border z-10 text-[10px] font-mono uppercase text-text-tertiary">
                      <tr>
                        <th className="px-3 py-2 border-r border-border-subtle text-center w-24">
                          Actions
                        </th>
                        {tableRecords.columns.map((c) => (
                          <th
                            key={c.columnName}
                            className="px-3 py-2 border-r border-border-subtle whitespace-nowrap"
                          >
                            <span>{c.columnName}</span>
                            <span className="text-[9px] text-text-tertiary block font-normal lowercase">
                              {c.dataType}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle font-mono text-[11px]">
                      {tableRecords.rows.map((row, idx) => {
                        const pk = tableRecords.primaryKey || "id";
                        const id = row[pk];
                        return (
                          <tr
                            key={idx}
                            className="hover:bg-surface-subtle/50 transition-colors divide-x divide-border-subtle"
                          >
                            <td className="px-2 py-1.5 text-center whitespace-nowrap bg-surface-subtle/20 space-x-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setRowModal({
                                    isOpen: true,
                                    mode: "EDIT",
                                    tableName: selectedTable!,
                                    rowData: { ...row },
                                  })
                                }
                                title="Edit row"
                                className="p-1 rounded hover:bg-slate-700 text-text-secondary hover:text-emerald-400 transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDeleteModal({
                                    isOpen: true,
                                    tableName: selectedTable!,
                                    rowId: id,
                                  })
                                }
                                title="Delete row"
                                className="p-1 rounded hover:bg-slate-700 text-text-secondary hover:text-negative transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </td>
                            {tableRecords.columns.map((c) => {
                              const val = row[c.columnName];
                              const isNull = val === null || val === undefined;
                              return (
                                <td
                                  key={c.columnName}
                                  className={`px-3 py-2 whitespace-nowrap max-w-xs truncate ${
                                    isNull
                                      ? "text-text-tertiary italic"
                                      : typeof val === "number"
                                      ? "tabular-nums text-emerald-400"
                                      : "text-text-secondary"
                                  }`}
                                  title={String(val)}
                                >
                                  {isNull
                                    ? "NULL"
                                    : typeof val === "object"
                                    ? JSON.stringify(val)
                                    : String(val)}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: INSERT / EDIT ROW MODAL */}
      {rowModal.isOpen && (
        <div className="fixed inset-0 bg-canvas/85 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-xl max-h-[85vh] rounded-xl border border-border bg-surface p-6 shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  {rowModal.mode === "INSERT" ? "Insert Row into" : "Edit Row in"}{" "}
                  <code className="text-emerald-400 font-mono">"{rowModal.tableName}"</code>
                </h3>
                <p className="text-xs text-text-secondary mt-0.5">
                  Direct database record mutation for tenant or system records.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRowModal({ ...rowModal, isOpen: false })}
                className="p-1 rounded text-text-tertiary hover:text-text-primary"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className="flex-1 overflow-y-auto py-4 space-y-3">
              {(tableRecords?.columns || []).map((col) => {
                const isPk = col.columnName === (tableRecords?.primaryKey || "id");
                if (rowModal.mode === "INSERT" && isPk) return null; // auto-increment pk

                const currVal = rowModal.rowData[col.columnName];
                return (
                  <div key={col.columnName} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-mono text-text-secondary">
                        {col.columnName}
                        <span className="text-[10px] text-text-tertiary ml-1.5 lowercase">
                          ({col.dataType})
                        </span>
                      </label>
                      {isPk && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-800 text-slate-400 rounded">
                          PRIMARY KEY
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled={isPk && rowModal.mode === "EDIT"}
                      value={currVal === undefined || currVal === null ? "" : String(currVal)}
                      onChange={(e) =>
                        setRowModal({
                          ...rowModal,
                          rowData: {
                            ...rowModal.rowData,
                            [col.columnName]: e.target.value === "" ? null : e.target.value,
                          },
                        })
                      }
                      placeholder={col.isNullable ? "NULL" : "Required"}
                      className="w-full px-3 py-1.5 text-xs rounded border border-border bg-surface-subtle text-text-primary font-mono focus:outline-none focus:border-border-strong disabled:opacity-50"
                    />
                  </div>
                );
              })}

              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRowModal({ ...rowModal, isOpen: false })}
                  className="px-3.5 py-1.5 text-xs rounded border border-border hover:bg-surface-subtle text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium rounded border border-emerald-500/50 bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  {rowModal.mode === "INSERT" ? "Insert Record" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: DELETE CONFIRMATION MODAL */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-canvas/85 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl border border-negative/30 bg-surface p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-negative">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-semibold text-text-primary">Confirm Row Deletion</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Are you sure you want to permanently delete record{" "}
              <code className="font-mono text-emerald-400">ID: {deleteModal.rowId}</code> from{" "}
              <code className="font-mono text-emerald-400">"{deleteModal.tableName}"</code>? This
              action executes an immediate hard delete.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModal({ isOpen: false, tableName: "", rowId: null })}
                className="px-3.5 py-1.5 text-xs rounded border border-border hover:bg-surface-subtle text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteRecord}
                className="px-4 py-1.5 text-xs font-medium rounded border border-negative/50 bg-negative hover:bg-negative/90 text-white"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
