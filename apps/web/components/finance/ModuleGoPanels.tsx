"use client";

import React, { useMemo, useState } from "react";
import {
  IntelligenceBundleResponse,
  ReconcilerParseResponse,
  commitReconcilerRowsApi,
  fetchIntelligenceBundle,
  parseReconcilerStatementApi,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import {
  Clock,
  CheckCircle2,
  FileSpreadsheet,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

// 1. True Hourly Wage & Life-Energy Panel (/payroll?sub=lifeenergy)
export function TrueHourlyLifeEnergyPanel({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t } = useLanguage();
  const [probeAmount, setProbeAmount] = useState<number>(350000);

  if (!intel) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-xs text-text-tertiary">
        Loading hourly wage &amp; work-hours analytics...
      </div>
    );
  }

  const le = intel.lifeenergy;
  const trueWage = le.trueNetHourlyWageRp;
  const hrsPerDay =
    (intel.studioConfig.paycycleFormulaConfig.workHoursPerDay || 8) +
    (intel.studioConfig.paycycleFormulaConfig.dailyCommuteHours || 0);
  const probeHours = trueWage > 0 ? Math.round((probeAmount / trueWage) * 10) / 10 : 0;
  const probeDays = hrsPerDay > 0 ? Math.round((probeHours / hrsPerDay) * 10) / 10 : 0;

  return (
    <div className="space-y-5 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">
            {t("intel.trueHourlyWage")}
          </div>
          <div className="font-serif text-2xl text-delta-positive mt-1 tabular-nums">
            {formatRupiah(trueWage, isAmountsMasked)}/hr
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            After commute &amp; work transport costs
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">
            Nominal Hourly Wage
          </div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {formatRupiah(le.nominalHourlyWageRp, isAmountsMasked)}/hr
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            {le.totalMonthlyWorkHours}h office work / mo
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">
            Commute + Work Time
          </div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {le.totalLifeEnergyHours} hrs/mo
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            Includes {le.totalMonthlyCommuteHours}h KRL commute time
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">
            Net Pay After Commute Cost
          </div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {formatRupiah(le.netIncomeAfterWorkCostRp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            Configured under Preferences -&gt; Formula
          </div>
        </div>
      </div>

      {/* Interactive Rupiah -> Work Hours Converter */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              Purchase Life-Energy Translator
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Converts any Rupiah purchase or installment into true life hours required to earn it.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              step={25000}
              value={probeAmount}
              onChange={(e) => setProbeAmount(Math.max(0, Number(e.target.value) || 0))}
              className="w-40 bg-canvas border border-border rounded px-3 py-1.5 font-mono text-xs text-text-primary"
            />
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded bg-surface-subtle border border-border font-mono text-xs text-text-primary">
              <Clock className="w-3.5 h-3.5 text-caution" />
              {probeHours} hrs ({probeDays} workdays)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
              <tr>
                <th className="px-3 py-2">Spending Tier (Rp)</th>
                <th className="px-3 py-2">Work Hours Required</th>
                <th className="px-3 py-2">Full Workdays Required</th>
                <th className="px-3 py-2">% of Monthly Life Energy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono">
              {le.conversions.map((c) => (
                <tr key={c.amountRp} className="hover:bg-surface-hover/40">
                  <td className="px-3 py-2 font-semibold text-text-primary tabular-nums">
                    {formatRupiah(c.amountRp, isAmountsMasked)}
                  </td>
                  <td className="px-3 py-2 text-caution tabular-nums">{c.workHoursRequired} hours</td>
                  <td className="px-3 py-2 text-text-secondary tabular-nums">{c.workDaysRequired} days</td>
                  <td className="px-3 py-2 text-text-tertiary tabular-nums">{c.pctOfMonthlyLifePct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 2. Envelope Rollover & Sinking Funds Panel (/allocations?sub=envelopes)
export function EnvelopesAndSinkingPanel({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const { updateStudioConfig } = usePerspective();
  const [savingPolicyId, setSavingPolicyId] = useState<string | null>(null);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);

  if (!intel) {
    return (
      <div className="rounded-lg border border-border bg-surface p-6 text-xs text-text-tertiary">
        Loading Envelope &amp; Sinking Fund schedules...
      </div>
    );
  }
  const env = intel.envelopes;

  const handleTogglePolicy = async (rowId: string, nextPolicy: "SWEEP_TO_P1" | "ROLLOVER_NEXT_MONTH") => {
    setSavingPolicyId(rowId);
    setPolicyMsg(null);
    const updatedTemplates = intel.studioConfig.routineTemplatesTable.map((t) =>
      t.id === rowId || t.slotKey === rowId ? { ...t, rolloverPolicy: nextPolicy } : t,
    );
    await updateStudioConfig({ routineTemplatesTable: updatedTemplates });
    setSavingPolicyId(null);
    setPolicyMsg("Envelope rollover policy updated and synced.");
  };

  return (
    <div className="space-y-5 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Savings Runway</div>
          <div className="font-serif text-2xl text-text-primary mt-1 tabular-nums">
            {env.ageOfMoneyDays} Days
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">Cash &amp; savings buffer at current pace</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Pure Buffer Runway</div>
          <div className="font-mono text-xl font-semibold text-delta-positive mt-1 tabular-nums">
            {env.bufferDays} Days
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">At current daily burn rate</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Unspent Sweep to Savings</div>
          <div className="font-mono text-xl font-semibold text-delta-positive mt-1 tabular-nums">
            {formatRupiah(env.totalUnspentSweepToP1Rp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">Auto-swept at cycle close</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Monthly Sinking Reserve</div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {formatRupiah(env.totalSinkingMonthlyRp, isAmountsMasked)}/mo
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">Staged monthly targets</div>
        </div>
      </div>

      {/* Routine Envelope Rollover Table */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-primary">Routine Envelope Rollover Policy Editor</h3>
          {policyMsg && <span className="text-[11px] text-delta-positive font-mono">{policyMsg}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
              <tr>
                <th className="px-3 py-2">Envelope</th>
                <th className="px-3 py-2">Allocated</th>
                <th className="px-3 py-2">Spent</th>
                <th className="px-3 py-2">Unspent</th>
                <th className="px-3 py-2">Rollover Policy</th>
                <th className="px-3 py-2 text-right">Sweep to Savings / Roll Next</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {env.envelopeEvaluations.map((row) => (
                <tr key={row.id} className="hover:bg-surface-hover/40">
                  <td className="px-3 py-2 font-medium text-text-primary">{row.name}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatRupiah(row.allocatedRp, isAmountsMasked)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatRupiah(row.spentRp, isAmountsMasked)}</td>
                  <td className="px-3 py-2 font-mono text-delta-positive tabular-nums">
                    {formatRupiah(row.unspentRp, isAmountsMasked)}
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.rolloverPolicy}
                      disabled={savingPolicyId === row.id}
                      onChange={(e) =>
                        handleTogglePolicy(row.id, e.target.value as "SWEEP_TO_P1" | "ROLLOVER_NEXT_MONTH")
                      }
                      className="bg-canvas border border-border rounded px-2 py-1 text-[11px] text-text-primary cursor-pointer"
                    >
                      <option value="SWEEP_TO_P1">Sweep Unspent to Core Savings</option>
                      <option value="ROLLOVER_NEXT_MONTH">Roll Over Next Cycle</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-right tabular-nums text-text-primary">
                    {formatRupiah(
                      row.rolloverPolicy === "ROLLOVER_NEXT_MONTH" ? row.rolledNextCycleRp : row.sweptToP1Rp,
                      isAmountsMasked,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Periodic Bill Set-Asides */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-text-primary">Periodic Bill Set-Asides</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {env.sinkingSchedules.map((sf) => (
            <div key={sf.id} className="p-4 rounded border border-border-subtle bg-surface-subtle/40 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-text-primary">
                <span>{sf.name}</span>
                <span className="font-mono text-text-secondary tabular-nums">{sf.progressPercent}%</span>
              </div>
              <div className="h-1.5 rounded bg-canvas overflow-hidden">
                <div className="h-full bg-delta-positive" style={{ width: `${sf.progressPercent}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-text-tertiary font-mono">
                <span>Target: {formatRupiah(sf.targetAmountRp, isAmountsMasked)}</span>
                <span>Set aside: {formatRupiah(sf.monthlySetAsideRp, isAmountsMasked)}/mo ({sf.monthsRemaining}m)</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. Debt Payoff Optimizer Panel (/credit?sub=contracts)
export function DebtPayoffOptimizerPanel({
  month,
  year,
  initialIntel,
}: {
  month: number;
  year: number;
  initialIntel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const [lumpSum, setLumpSum] = useState<number>(1000000);
  const [customIntel, setCustomIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const intel = customIntel ?? initialIntel;
  const opt = intel?.debtopt;

  const handleSimulate = async () => {
    setLoading(true);
    const res = await fetchIntelligenceBundle(month, year, lumpSum);
    if (res) setCustomIntel(res);
    setLoading(false);
  };

  if (!opt) return null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            Debt Payoff Strategy Optimizer (Contractual vs Avalanche vs Snowball)
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Simulate applying extra THR or flexible surplus to measure interest savings and monthly cashflow unlocks.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={250000}
            value={lumpSum}
            onChange={(e) => setLumpSum(Math.max(0, Number(e.target.value) || 0))}
            className="w-36 bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
          />
          <button
            type="button"
            onClick={handleSimulate}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Simulate Prepayment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {opt.strategies.map((st) => (
          <div key={st.strategy} className="p-4 rounded border border-border-subtle bg-surface-subtle/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-text-primary">{st.strategy}</span>
              <span className="font-mono text-xs text-delta-positive tabular-nums">
                +{formatRupiah(st.immediateFreedMonthlyRp, isAmountsMasked)}/mo freed
              </span>
            </div>
            <p className="text-[11px] text-text-tertiary leading-relaxed">{st.summary}</p>
            <div className="pt-2 border-t border-border-subtle flex items-center justify-between text-xs font-mono">
              <span className="text-text-secondary">Interest Saved:</span>
              <span className="text-delta-positive font-semibold tabular-nums">
                {formatRupiah(st.estimatedInterestSavedRp, isAmountsMasked)} ({st.monthsShaved}m shaved)
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RECONCILER_INSTRUMENT_LABELS: Record<string, string> = {
  CASH: "Cash / Bank",
  PAYLATER: "PayLater",
  CREDIT_CARD: "Credit Card",
};

// 4. Bulk Statement & Mutation Reconciler Panel (/import)
export function BulkStatementReconcilerPanel({
  onCommitted,
  externalText,
  externalVersion,
}: {
  onCommitted?: () => void;
  externalText?: string;
  externalVersion?: number;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const [rawText, setRawText] = useState(
    "2026-11-16, Coffee Shop QRIS, Rp 34.200\n2026-11-18, Commuter Ride, Rp 28.500\n2026-11-21, Cloud Hosting Credit Card, Rp 145.000",
  );
  const [defaultMethod, setDefaultMethod] = useState<"CASH" | "PAYLATER" | "CREDIT_CARD">("CASH");
  const [result, setResult] = useState<ReconcilerParseResponse | null>(null);
  const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>({});
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (externalText !== undefined && externalVersion !== undefined && externalVersion > 0) {
      setRawText(externalText);
      setResult(null);
      setStatusMsg(null);
    }
  }, [externalText, externalVersion]);

  const handleParse = async () => {
    setParsing(true);
    setStatusMsg(null);
    const res = await parseReconcilerStatementApi({ rawText, defaultMethod });
    if (res) {
      setResult(res);
      const initSel: Record<number, boolean> = {};
      for (const r of res.rows) {
        initSel[r.lineNumber] = r.duplicateStatus === "NEW_ENTRY";
      }
      setSelectedLines(initSel);
    }
    setParsing(false);
  };

  const handleCommit = async () => {
    if (!result) return;
    const chosen = result.rows.filter((r) => selectedLines[r.lineNumber]);
    if (chosen.length === 0) return;
    setCommitting(true);
    const res = await commitReconcilerRowsApi(
      chosen.map((r) => ({
        dateIso: r.dateIso,
        description: r.description,
        amountRp: r.amountRp,
        instrument: r.instrument,
        targetPeriodMonth: r.targetPeriodMonth,
        targetPeriodYear: r.targetPeriodYear,
        inferredCategory: r.inferredCategory,
      })),
    );
    if (res) {
      setStatusMsg(`Committed ${res.committedCount} entry(ies) into routed paycycles.`);
      onCommitted?.();
    }
    setCommitting(false);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-text-tertiary" />
            <span>Statement &amp; Bank Mutation Bulk Parser &amp; Reconciler</span>
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Paste raw CSV or bank/QRIS/e-wallet statement lines to auto-detect paycycle cutoffs and duplicates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={defaultMethod}
            onChange={(e) => setDefaultMethod(e.target.value as any)}
            className="bg-canvas border border-border rounded px-2.5 py-1.5 text-xs text-text-secondary"
          >
            <option value="CASH">Default: Cash / Bank / QRIS</option>
            <option value="PAYLATER">Default: PayLater (Cutoff Auto-Route)</option>
            <option value="CREDIT_CARD">Default: Credit Card (Statement Cutoff)</option>
          </select>
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || !rawText.trim()}
            className="px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {parsing ? "Parsing..." : "Parse & Auto-Route"}
          </button>
        </div>
      </div>

      <textarea
        rows={5}
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="YYYY-MM-DD, Description, Rp Amount"
        className="w-full bg-canvas border border-border rounded p-3 font-mono text-xs text-text-primary focus:outline-none focus:border-text-secondary"
      />

      {statusMsg && (
        <div className="px-3 py-2 rounded border border-delta-positive/40 bg-[rgba(16,183,141,0.10)] text-xs text-delta-positive flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{statusMsg}</span>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="text-text-secondary font-mono">
              Parsed: {result.parsedCount} rows · New: {result.newEntryCount} · Duplicates: {result.duplicateCount} · Total: {formatRupiah(result.totalAmountRp, isAmountsMasked)}
            </span>
            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || result.rows.every((r) => !selectedLines[r.lineNumber])}
              className="px-3.5 py-1.5 rounded erp-btn-primary text-xs font-semibold hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              {committing ? "Committing..." : "Commit Selected Rows"}
            </button>
          </div>

          <div className="overflow-x-auto border border-border-subtle rounded">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
                <tr>
                  <th className="px-2.5 py-2">Import</th>
                  <th className="px-2.5 py-2">Date</th>
                  <th className="px-2.5 py-2">Description</th>
                  <th className="px-2.5 py-2">Instrument</th>
                  <th className="px-2.5 py-2">Routed Cycle</th>
                  <th className="px-2.5 py-2">Dedup Status</th>
                  <th className="px-2.5 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {result.rows.map((r) => (
                  <tr key={r.lineNumber} className="hover:bg-surface-hover/40">
                    <td className="px-2.5 py-2">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedLines[r.lineNumber])}
                        onChange={(e) =>
                          setSelectedLines((prev) => ({
                            ...prev,
                            [r.lineNumber]: e.target.checked,
                          }))
                        }
                      />
                    </td>
                    <td className="px-2.5 py-2 font-mono text-text-tertiary">{r.dateIso}</td>
                    <td className="px-2.5 py-2 font-medium text-text-primary">{r.description}</td>
                    <td className="px-2.5 py-2 font-sans text-text-secondary">
                      {RECONCILER_INSTRUMENT_LABELS[r.instrument] ?? r.instrument}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-text-primary">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{r.targetPeriodCode}</span>
                        {r.crossedCutoff && (
                          <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle text-[10px] text-text-secondary font-sans">
                            Post-Cutoff
                          </span>
                        )}
                        {r.advancedFromLocked && (
                          <span className="inline-flex items-center whitespace-nowrap px-1.5 py-0.5 rounded bg-[rgba(229,155,44,0.12)] border border-caution/30 text-[10px] text-caution font-sans">
                            Lock-Safe -&gt; {r.targetPeriodCode} ({r.originalPeriodCode} Closed)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2.5 py-2">
                      <span
                        className={`inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded border text-[11px] ${
                          r.duplicateStatus === "NEW_ENTRY"
                            ? "border-delta-positive/30 text-delta-positive bg-[rgba(16,183,141,0.08)]"
                            : "border-caution/30 text-caution bg-[rgba(229,155,44,0.08)]"
                        }`}
                      >
                        {r.duplicateStatus === "NEW_ENTRY" ? "New Entry" : "Duplicate Match"}
                      </span>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-right tabular-nums text-text-primary">
                      {formatRupiah(r.amountRp, isAmountsMasked)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 5. Net Worth & Cash Position Panel (/savings?sub=networth)
export function NetWorthReservoirsPanel({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  if (!intel) return null;
  const nw = intel.networth;
  const accounts = intel.effectiveAssetAccounts ?? intel.studioConfig.assetAccountsTable;

  return (
    <div className="space-y-5 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Cash &amp; Savings Balances</div>
          <div className="font-serif text-2xl text-text-primary mt-1 tabular-nums">
            {formatRupiah(nw.totalAssetsRp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-delta-positive font-mono mt-1">
            {nw.monthlyRdpuYieldRp > 0
              ? `+${formatRupiah(nw.monthlyRdpuYieldRp, isAmountsMasked)}/mo external yield`
              : "Derived strictly from ledger & wallet"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Remaining External Debt</div>
          <div className="font-mono text-xl font-semibold text-delta-negative mt-1 tabular-nums">
            {formatRupiah(nw.totalUnpaidDebtRp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-text-tertiary font-mono mt-1 tabular-nums">
            Cycle: {formatRupiah(nw.currentCycleDebtRp ?? nw.totalUnpaidDebtRp, isAmountsMasked)} · Future: {formatRupiah(nw.futureInstallmentPrincipalRp ?? 0, isAmountsMasked)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Cash &amp; Savings vs. Debt</div>
          <div
            className={`font-serif text-2xl mt-1 tabular-nums ${
              nw.totalNetWorthRp >= 0 ? "text-delta-positive" : "text-delta-negative"
            }`}
          >
            {nw.totalNetWorthRp >= 0 ? "+" : ""}
            {formatRupiah(nw.totalNetWorthRp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            Coverage: {nw.assetToDebtCoveragePct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Debt-to-Asset Leverage</div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {nw.debtToAssetLeveragePct.toFixed(1)}%
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">Target &lt; 100% net positive</div>
        </div>
      </div>

      {/* Double-Entry Account Balance Sheet + 12M Trajectory */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">Tracked Cash &amp; Asset Accounts</h3>
            <span className="text-[11px] font-mono text-text-tertiary">Editable in Preferences</span>
          </div>
          <div className="divide-y divide-border-subtle">
            {accounts.map((acc) => (
              <div key={acc.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-medium text-text-primary">{acc.name}</div>
                  <div className="text-[11px] text-text-tertiary">
                    {acc.institution} · {acc.annualYieldPct}% p.a.
                  </div>
                </div>
                <div className="font-mono font-semibold text-text-primary tabular-nums">
                  {formatRupiah(acc.balanceRp, isAmountsMasked)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">Cash &amp; Debt Trajectory</h3>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
                <tr>
                  <th className="px-2.5 py-1.5">Period</th>
                  <th className="px-2.5 py-1.5">Assets</th>
                  <th className="px-2.5 py-1.5">Remaining Debt</th>
                  <th className="px-2.5 py-1.5 text-right">Net Worth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono">
                {nw.trajectory.map((pt) => (
                  <tr key={pt.label}>
                    <td className="px-2.5 py-1.5 text-text-primary whitespace-nowrap">{pt.label}</td>
                    <td className="px-2.5 py-1.5 tabular-nums whitespace-nowrap">{formatRupiah(pt.projectedAssetsRp, isAmountsMasked)}</td>
                    <td className="px-2.5 py-1.5 text-delta-negative tabular-nums whitespace-nowrap">
                      {formatRupiah(pt.remainingDebtRp, isAmountsMasked)}
                    </td>
                    <td
                      className={`px-2.5 py-1.5 text-right font-semibold tabular-nums whitespace-nowrap ${
                        pt.netWorthRp >= 0 ? "text-delta-positive" : "text-delta-negative"
                      }`}
                    >
                      {formatRupiah(pt.netWorthRp, isAmountsMasked)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// 6. 12-Month Wealth & Runway Forecaster Panel (/savings?sub=forecaster)
export function WealthForecaster12MPanel({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  if (!intel) return null;
  const fc = intel.forecaster;

  return (
    <div className="space-y-5 w-full">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">
            {intel.dynamicMilestone?.labelEn ?? "Debt Payoff Target"}
          </div>
          <div className="font-serif text-2xl text-delta-positive mt-1">
            {intel.dynamicMilestone?.targetDateLabel ?? fc.spinjamFreedomDate}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            {intel.dynamicMilestone?.code === "SAVINGS_RESERVE_FOCUS" ||
            intel.dynamicMilestone?.code === "ALL_DEBT_FREE_P1_FOCUS"
              ? "Active surplus directed to savings"
              : intel.dynamicMilestone?.remainingAmountRp
                ? `${formatRupiah(intel.dynamicMilestone.remainingAmountRp, isAmountsMasked)} left`
                : "Milestone achieved"}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Low-DSR (&lt;15%) Date</div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1">{fc.lowDsrMilestoneDate}</div>
          <div className="text-[11px] text-text-tertiary mt-1">Healthy debt service ratio</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Survival Runway</div>
          <div className="font-mono text-xl font-semibold text-text-primary mt-1 tabular-nums">
            {fc.pureSurvivalRunwayDays} Days
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">If income paused today</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-text-tertiary">Zero-Leak 12M Wealth</div>
          <div className="font-serif text-2xl text-delta-positive mt-1 tabular-nums">
            {formatRupiah(fc.projected12MWealthZeroLeakRp, isAmountsMasked)}
          </div>
          <div className="text-[11px] text-text-tertiary mt-1">
            Baseline: {formatRupiah(fc.projected12MWealthBaselineRp, isAmountsMasked)}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-delta-positive" />
            <span>3-Scenario Horizon Checkpoints (12-Month Stress Test)</span>
          </h3>
          <span className="text-[11px] font-mono text-text-tertiary">
            Emergency Fund Target: {fc.emergencyFundCompletionDate}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Baseline Plan</th>
                <th className="px-3 py-2">Disciplined Zero-Leakage</th>
                <th className="px-3 py-2">Spend Shock (+15% Burn)</th>
                <th className="px-3 py-2">DSR %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono">
              {fc.series.map((row) => (
                <tr key={row.label} className="hover:bg-surface-hover/40">
                  <td className="px-3 py-2 font-semibold text-text-primary">{row.label}</td>
                  <td className="px-3 py-2 tabular-nums">{formatRupiah(row.baselineWealthRp, isAmountsMasked)}</td>
                  <td className="px-3 py-2 text-delta-positive font-semibold tabular-nums">
                    {formatRupiah(row.disciplinedWealthRp, isAmountsMasked)}
                  </td>
                  <td className="px-3 py-2 text-caution tabular-nums">
                    {formatRupiah(row.shockWealthRp, isAmountsMasked)}
                  </td>
                  <td className="px-3 py-2 text-text-secondary tabular-nums">{row.dsrPercent.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
