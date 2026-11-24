"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AssetAccountConfigRow,
  CustomSidebarShortcut,
  FormulaDefinitions,
  FormulaEvalResult,
  InstrumentConfigRow,
  ModularStudioConfig,
  PaycycleFormulaConfig,
  PeriodScheduleOverride,
  RESERVED_WORDS_CATALOG_LIST,
  RoutineTemplateConfigRow,
  SidebarNavigationConfig,
  buildDefaultFormulasClient,
  evaluateFormulaDslClient,
  evaluateFormulaSuiteApi,
  fetchIntelligenceBundle,
} from "@/lib/api";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePeriod } from "@/context/PeriodContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  formatRupiah,
  resolveInstrumentCutoffDayClient,
  resolveInstrumentLandingPeriodClient,
} from "@/lib/utils";
import { Plus, Save, Trash2, CheckCircle2, Calendar, Bookmark, RotateCcw, AlertTriangle } from "lucide-react";

const SHORT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtUtcIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoUtc(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || "").trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function computePreviewHorizons(form: PaycycleFormulaConfig) {
  const periods = [
    { month: 11, year: 2026 },
    { month: 12, year: 2026 },
    { month: 1, year: 2027 },
    { month: 2, year: 2027 },
    { month: 3, year: 2027 },
    { month: 4, year: 2027 },
  ];

  const holidaySet = new Set(form.holidayDatesIso ?? []);
  const payslipAnchor = form.payslipAnchorDay ?? 25;
  const shiftRule = (form.payslipShiftRule || (form.shiftWeekendToFriday ? "SHIFT_PREVIOUS_FRIDAY" : "EXACT_DAY")).toUpperCase();
  const lagDays = Math.max(0, Number(form.reviewLagWorkingDays ?? 0));
  const overrides = form.periodOverrides ?? {};

  const shiftDate = (d: Date, rule: string): { date: Date; shifted: boolean } => {
    let cur = new Date(d.getTime());
    let shifted = false;
    if (rule === "EXACT_DAY") return { date: cur, shifted: false };
    const step = rule === "SHIFT_NEXT_WEEKDAY" ? 86400000 : -86400000;
    for (let k = 0; k < 10; k++) {
      const wd = cur.getUTCDay();
      const iso = fmtUtcIso(cur);
      if (wd === 6 || wd === 0 || holidaySet.has(iso)) {
        cur = new Date(cur.getTime() + step);
        shifted = true;
      } else {
        break;
      }
    }
    return { date: cur, shifted };
  };

  const addWorkingDays = (start: Date, workDays: number): Date => {
    let cur = new Date(start.getTime());
    let added = 0;
    while (added < workDays) {
      cur = new Date(cur.getTime() + 86400000);
      const wd = cur.getUTCDay();
      if (wd !== 6 && wd !== 0 && !holidaySet.has(fmtUtcIso(cur))) {
        added++;
      }
    }
    return cur;
  };

  const resolveDates = (m: number, y: number) => {
    const code = `${String(m).padStart(2, "0")}/${y}`;
    const ov = overrides[code];
    const maxD = new Date(Date.UTC(y, m, 0)).getUTCDate();

    let payslipDate: Date;
    let overrideApplied = false;
    if (ov?.payslipDateIso && parseIsoUtc(ov.payslipDateIso)) {
      payslipDate = parseIsoUtc(ov.payslipDateIso)!;
      overrideApplied = true;
    } else {
      const rawPayslip = new Date(Date.UTC(y, m - 1, Math.min(Math.max(1, payslipAnchor), maxD)));
      payslipDate = shiftDate(rawPayslip, shiftRule).date;
    }

    let paydayDate: Date;
    let shifted = false;
    if (ov?.paydayDateIso && parseIsoUtc(ov.paydayDateIso)) {
      paydayDate = parseIsoUtc(ov.paydayDateIso)!;
      overrideApplied = true;
    } else if (lagDays > 0 || (form.payslipAnchorDay ?? 0) > 0) {
      const lagged = addWorkingDays(payslipDate, lagDays);
      const res = shiftDate(lagged, form.shiftWeekendToFriday ? "SHIFT_PREVIOUS_FRIDAY" : "EXACT_DAY");
      paydayDate = res.date;
      shifted = res.shifted;
    } else {
      const rawPay = new Date(Date.UTC(y, m - 1, Math.min(Math.max(1, form.paydayAnchorDay || 27), maxD)));
      const res = shiftDate(rawPay, form.shiftWeekendToFriday ? "SHIFT_PREVIOUS_FRIDAY" : "EXACT_DAY");
      paydayDate = res.date;
      shifted = res.shifted;
    }
    return { payslipDate, paydayDate, shifted, overrideApplied, ov };
  };

  return periods.map(({ month, year }) => {
    const p1 = resolveDates(month, year);
    const nextM = month === 12 ? 1 : month + 1;
    const nextY = month === 12 ? year + 1 : year;
    const p2 = resolveDates(nextM, nextY);
    const livingEnd = new Date(p2.paydayDate.getTime() - 86400000);
    const days = Math.max(1, Math.round((livingEnd.getTime() - p1.paydayDate.getTime()) / 86400000) + 1);
    return {
      periodCode: `${String(month).padStart(2, "0")}/${year}`,
      payslipIso: fmtUtcIso(p1.payslipDate),
      payslipLabel: `${SHORT_MON[p1.payslipDate.getUTCMonth()]} ${p1.payslipDate.getUTCDate()}`,
      paydayIso: fmtUtcIso(p1.paydayDate),
      paydayLabel: `${SHORT_MON[p1.paydayDate.getUTCMonth()]} ${p1.paydayDate.getUTCDate()}${p1.overrideApplied ? " (Override)" : p1.shifted ? " (Shift)" : ""}`,
      livingWindow: `${SHORT_MON[p1.paydayDate.getUTCMonth()]} ${p1.paydayDate.getUTCDate()} - ${SHORT_MON[livingEnd.getUTCMonth()]} ${livingEnd.getUTCDate()}`,
      days,
      maturityLabel: `${SHORT_MON[nextM - 1]} ${nextY} Maturities`,
      overrideApplied: p1.overrideApplied,
      override: p1.ov,
    };
  });
}

const FORMULA_META: Array<{
  key: keyof FormulaDefinitions;
  title: string;
  description: string;
  unit: "RP" | "RATIO";
}> = [
  {
    key: "takeHomeSalaryFormula",
    title: "Monthly Take-Home Salary",
    description: "Calculates net monthly payroll before THR.",
    unit: "RP",
  },
  {
    key: "proratedThrFormula",
    title: "Prorated Holiday Bonus (THR)",
    description: "Calculates pro-rata annual religious/holiday bonus from tenure months.",
    unit: "RP",
  },
  {
    key: "waterfallAllocationFormula",
    title: "Waterfall Distributable Pool",
    description: "Income left for Core Savings Reserve and Flexible Surplus after essentials and debt.",
    unit: "RP",
  },
  {
    key: "debtSafeCeilingFormula",
    title: "Credit & PayLater Safe Ceiling",
    description: "Maximum combined Credit Card + PayLater billing before payroll hits deficit.",
    unit: "RP",
  },
  {
    key: "dailySafeToSpendFormula",
    title: "Daily Safe-to-Spend Baseline",
    description: "Baseline daily allowance from living budget divided by cycle length.",
    unit: "RP",
  },
  {
    key: "trueHourlyWageFormula",
    title: "True Net Hourly Wage",
    description: "Net salary after routine bills divided by monthly work + commute hours.",
    unit: "RP",
  },
  {
    key: "forecasterFreedDebtToP1Formula",
    title: "Freed Installment Sweep to Savings",
    description: "Portion of maturing installment cashflow routed toward Core Savings.",
    unit: "RP",
  },
];

function SaveBanner({ savedMsg, errorMsg }: { savedMsg: string | null; errorMsg: string | null }) {
  if (!savedMsg && !errorMsg) return null;
  return (
    <div
      className={`px-3 py-2 rounded border text-xs font-sans flex items-center gap-2 ${
        errorMsg
          ? "border-delta-negative/40 bg-[rgba(224,108,83,0.10)] text-delta-negative"
          : "border-delta-positive/40 bg-[rgba(16,183,141,0.10)] text-delta-positive"
      }`}
    >
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
      <span>{errorMsg || savedMsg}</span>
    </div>
  );
}

// 1. Paycycle & Waterfall Formula Engine Table
export function PaycycleFormulaStudioCard({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { month, year } = usePeriod();
  const activeStudio = studioConfig ?? initialConfig;
  const [form, setForm] = useState<PaycycleFormulaConfig | null>(activeStudio?.paycycleFormulaConfig ?? null);
  const [liveVars, setLiveVars] = useState<Record<string, number>>({});
  const [serverEval, setServerEval] = useState<Record<string, FormulaEvalResult> | null>(null);
  const [activeFormulaKey, setActiveFormulaKey] = useState<keyof FormulaDefinitions>("takeHomeSalaryFormula");
  const [editingOverrideCode, setEditingOverrideCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const formulaInputRefs = useRef<Partial<Record<keyof FormulaDefinitions, HTMLInputElement | null>>>({});

  useEffect(() => {
    if (activeStudio?.paycycleFormulaConfig) {
      setForm({
        ...activeStudio.paycycleFormulaConfig,
        formulas: {
          ...buildDefaultFormulasClient(),
          ...(activeStudio.paycycleFormulaConfig.formulas ?? {}),
        },
        periodOverrides: activeStudio.paycycleFormulaConfig.periodOverrides ?? {},
      });
    }
  }, [activeStudio]);

  useEffect(() => {
    let cancelled = false;
    fetchIntelligenceBundle(month, year)
      .then((bundle) => {
        if (!cancelled && bundle?.formulaContext?.variables) {
          setLiveVars(bundle.formulaContext.variables);
          setServerEval(bundle.formulaContext.evaluation?.results ?? null);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [month, year]);

  const previewRows = useMemo(
    () => (form ? computePreviewHorizons(form) : []),
    [form],
  );

  const clientEvaluations = useMemo(() => {
    const out: Partial<Record<keyof FormulaDefinitions, FormulaEvalResult>> = {};
    if (!form) return out;
    const fMap = { ...buildDefaultFormulasClient(), ...(form.formulas ?? {}) };
    for (const meta of FORMULA_META) {
      out[meta.key] = evaluateFormulaDslClient(fMap[meta.key], liveVars);
    }
    return out;
  }, [form, liveVars]);

  if (!form) return null;

  const activeFormulas: FormulaDefinitions = {
    ...buildDefaultFormulasClient(),
    ...(form.formulas ?? {}),
  };

  const handleInsertToken = (token: string) => {
    const key = activeFormulaKey;
    const curExpr = activeFormulas[key] ?? "";
    const el = formulaInputRefs.current[key];
    const tokenText = `{${token}}`;
    let nextExpr = `${curExpr} ${tokenText}`.trim();
    if (el && typeof el.selectionStart === "number" && typeof el.selectionEnd === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      nextExpr = `${curExpr.slice(0, start)}${tokenText}${curExpr.slice(end)}`;
    }
    setForm({
      ...form,
      formulas: { ...activeFormulas, [key]: nextExpr },
    });
  };

  const handleVerifyServer = async () => {
    setVerifying(true);
    setErrorMsg(null);
    try {
      const res = await evaluateFormulaSuiteApi({
        month,
        year,
        formulas: activeFormulas as unknown as Record<string, string>,
      });
      if (res) {
        setLiveVars(res.variables);
        setServerEval(res.evaluation.results);
        if (res.evaluation.allValid) {
          setSavedMsg("All 7 custom formulas verified against server engine.");
        } else {
          setErrorMsg("One or more formula expressions contain syntax errors.");
        }
      }
    } catch (e: any) {
      setErrorMsg(e?.message || "Formula verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResetDefaults = () => {
    setForm({
      ...form,
      payslipAnchorDay: 25,
      payslipShiftRule: "SHIFT_PREVIOUS_FRIDAY",
      reviewLagWorkingDays: 2,
      shiftWeekendToFriday: true,
      formulas: buildDefaultFormulasClient(),
      milestonePriorityOrder: ["SPINJAM_ZERO", "PAYLATER_INSTALLMENTS_ZERO", "ALL_DEBT_FREE_P1_FOCUS"],
    });
    setSavedMsg("Formulas restored to standard defaults (click Save Configuration to persist).");
    setErrorMsg(null);
  };

  const updateOverride = (periodCode: string, patch: Partial<PeriodScheduleOverride>) => {
    const curMap = { ...(form.periodOverrides ?? {}) };
    const existing = curMap[periodCode] ?? {};
    const nextOv = { ...existing, ...patch };
    if (!nextOv.payslipDateIso && !nextOv.paydayDateIso && !nextOv.note) {
      delete curMap[periodCode];
    } else {
      curMap[periodCode] = nextOv;
    }
    setForm({ ...form, periodOverrides: curMap });
  };

  const handleSave = async () => {
    const invalid = FORMULA_META.find((m) => clientEvaluations[m.key]?.valid === false);
    if (invalid) {
      setErrorMsg(`Cannot save: ${invalid.title} has a syntax error (${clientEvaluations[invalid.key]?.error}).`);
      return;
    }
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await updateStudioConfig({ paycycleFormulaConfig: { ...form, formulas: activeFormulas } });
      setSavedMsg("Two-stage payroll calendar & custom formula rules saved.");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save formula configuration.");
    } finally {
      setSaving(false);
    }
  };

  const currentPriorityTop = form.milestonePriorityOrder?.[0] ?? "SPINJAM_ZERO";

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-sans">
            Two-Stage Payroll Schedule &amp; Formula Studio
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Models Stage 1 Payslip Drop -&gt; Stage 2 HR Review Lag -&gt; Actual Payday &amp; Living Window (Payday M to Payday M+1 - 1).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleVerifyServer}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
            {verifying ? "Verifying..." : "Verify Live"}
          </button>
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-border text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Configuration"}
          </button>
        </div>
      </div>

      <SaveBanner savedMsg={savedMsg} errorMsg={errorMsg} />

      {/* Stage 1 + Stage 2 Corporate Payroll Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Default Landing Period</span>
          <select
            value={form.defaultPeriodStrategy ?? "EARLIEST_OPEN_ACTIVE"}
            onChange={(e) =>
              setForm({
                ...form,
                defaultPeriodStrategy:
                  e.target.value === "CALENDAR_WINDOW"
                    ? "CALENDAR_WINDOW"
                    : "EARLIEST_OPEN_ACTIVE",
              })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-text-primary"
          >
            <option value="EARLIEST_OPEN_ACTIVE">Earliest Open Active Cycle</option>
            <option value="CALENDAR_WINDOW">Strict Calendar Window</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Payslip Anchor Day</span>
          <input
            type="number"
            min={1}
            max={31}
            value={form.payslipAnchorDay ?? 25}
            onChange={(e) => setForm({ ...form, payslipAnchorDay: Number(e.target.value) || 25 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Payslip Weekend Rule</span>
          <select
            value={form.payslipShiftRule ?? "SHIFT_PREVIOUS_FRIDAY"}
            onChange={(e) => setForm({ ...form, payslipShiftRule: e.target.value })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-text-primary"
          >
            <option value="SHIFT_PREVIOUS_FRIDAY">Shift Weekend -&gt; Friday</option>
            <option value="SHIFT_NEXT_WEEKDAY">Shift Weekend -&gt; Monday</option>
            <option value="EXACT_DAY">Exact Calendar Day</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Review Lag (Working Days)</span>
          <input
            type="number"
            min={0}
            max={10}
            value={form.reviewLagWorkingDays ?? 2}
            onChange={(e) => setForm({ ...form, reviewLagWorkingDays: Math.max(0, Number(e.target.value) || 0) })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Fallback Payday Day</span>
          <input
            type="number"
            min={1}
            max={31}
            value={form.paydayAnchorDay}
            onChange={(e) => setForm({ ...form, paydayAnchorDay: Number(e.target.value) || 27 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Weekend Pacing Weight (x)</span>
          <input
            type="number"
            step="0.1"
            min={1}
            max={3}
            value={form.weekendWeightMultiplier}
            onChange={(e) => setForm({ ...form, weekendWeightMultiplier: Number(e.target.value) || 1.5 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Core Savings Floor (Rp)</span>
          <input
            type="number"
            step={50000}
            min={0}
            value={form.p1TargetFloorRp}
            onChange={(e) => setForm({ ...form, p1TargetFloorRp: Number(e.target.value) || 0 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Default Daily Living Baseline (Rp)</span>
          <input
            type="number"
            step={50000}
            min={0}
            value={form.defaultDailyFoodBaselineRp}
            onChange={(e) => setForm({ ...form, defaultDailyFoodBaselineRp: Number(e.target.value) || 0 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Dashboard Milestone Target</span>
          <select
            value={currentPriorityTop}
            onChange={(e) => {
              const first = e.target.value;
              const order = [first, "SPINJAM_ZERO", "PAYLATER_INSTALLMENTS_ZERO", "ALL_DEBT_FREE_P1_FOCUS"].filter(
                (v, i, a) => a.indexOf(v) === i,
              );
              setForm({ ...form, milestonePriorityOrder: order });
            }}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-text-primary"
          >
            <option value="SPINJAM_ZERO">Auto: High-Interest Loan -&gt; PayLater -&gt; Debt-Free</option>
            <option value="PAYLATER_INSTALLMENTS_ZERO">Focus: PayLater Zero Target</option>
            <option value="ALL_DEBT_FREE_P1_FOCUS">Focus: Core Savings Growth</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Workdays / Week</span>
          <input
            type="number"
            min={1}
            max={7}
            value={form.workdaysPerWeek}
            onChange={(e) => setForm({ ...form, workdaysPerWeek: Number(e.target.value) || 5 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Work Hours / Day</span>
          <input
            type="number"
            step="0.5"
            min={1}
            max={16}
            value={form.workHoursPerDay}
            onChange={(e) => setForm({ ...form, workHoursPerDay: Number(e.target.value) || 8 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Daily Commute Hours (KRL)</span>
          <input
            type="number"
            step="0.5"
            min={0}
            max={8}
            value={form.dailyCommuteHours}
            onChange={(e) => setForm({ ...form, dailyCommuteHours: Number(e.target.value) || 0 })}
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="flex items-center gap-2 pt-5 text-xs text-text-secondary cursor-pointer">
          <input
            type="checkbox"
            checked={form.shiftWeekendToFriday}
            onChange={(e) => setForm({ ...form, shiftWeekendToFriday: e.target.checked })}
            className="rounded border-border"
          />
          <span>Shift weekend payday to Friday</span>
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">
            Attendance Start Day <span className="font-mono text-[10px] text-accent">(Feb clamped)</span>
          </span>
          <input
            type="number"
            min={1}
            max={31}
            value={form.attendanceCutoffStartDay ?? 16}
            onChange={(e) =>
              setForm({ ...form, attendanceCutoffStartDay: Math.max(1, Math.min(31, Number(e.target.value) || 16)) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">
            Attendance End Day <span className="font-mono text-[10px] text-accent">(Feb clamped)</span>
          </span>
          <input
            type="number"
            min={1}
            max={31}
            value={form.attendanceCutoffEndDay ?? 15}
            onChange={(e) =>
              setForm({ ...form, attendanceCutoffEndDay: Math.max(1, Math.min(31, Number(e.target.value) || 15)) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">BPJS Deduction Rate (%)</span>
          <input
            type="number"
            step="0.1"
            min={0}
            max={20}
            value={form.bpjsRatePercent ?? 3}
            onChange={(e) =>
              setForm({ ...form, bpjsRatePercent: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Laptop Allowance (Rp)</span>
          <input
            type="number"
            step={25000}
            min={0}
            value={form.laptopAllowanceRp ?? 250000}
            onChange={(e) =>
              setForm({ ...form, laptopAllowanceRp: Math.max(0, Number(e.target.value) || 0) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Optimal Debt Ratio (%)</span>
          <input
            type="number"
            min={5}
            max={60}
            value={form.optimalDebtRatioPercent ?? 20}
            onChange={(e) =>
              setForm({ ...form, optimalDebtRatioPercent: Math.max(1, Number(e.target.value) || 20) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
        <label className="space-y-1 text-xs">
          <span className="text-text-tertiary font-medium block">Max Safe Debt Ratio (%)</span>
          <input
            type="number"
            min={5}
            max={80}
            value={form.maxSafeDebtRatioPercent ?? 35}
            onChange={(e) =>
              setForm({ ...form, maxSafeDebtRatioPercent: Math.max(1, Number(e.target.value) || 35) })
            }
            className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-text-primary"
          />
        </label>
      </div>

      {/* Live Cycle Horizon Preview Table + Per-Month Override Editor */}
      <div className="rounded border border-border-subtle overflow-hidden">
        <div className="px-3 py-2 bg-surface-subtle border-b border-border-subtle flex items-center justify-between gap-2 text-xs font-medium text-text-secondary">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-text-tertiary" />
            <span>Two-Stage Payroll Schedule &amp; Per-Month Overrides</span>
          </div>
          <span className="text-[11px] text-text-tertiary font-normal">
            Click Override to lock exact Payslip or Payday dates for bonuses/holidays
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-xs text-left">
            <thead className="bg-surface-subtle/50 text-[10px] font-mono text-text-tertiary border-b border-border-subtle">
              <tr>
                <th className="px-3 py-2">Period</th>
                <th className="px-3 py-2">Stage 1: Payslip</th>
                <th className="px-3 py-2">Stage 2: Payday</th>
                <th className="px-3 py-2">Daily Living Window</th>
                <th className="px-3 py-2">Cycle</th>
                <th className="px-3 py-2">Maturities Funded</th>
                <th className="px-3 py-2 text-right">Override</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle font-mono">
              {previewRows.map((row) => (
                <React.Fragment key={row.periodCode}>
                  <tr className="hover:bg-surface-hover/40">
                    <td className="px-3 py-2 font-semibold text-text-primary">{row.periodCode}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.payslipLabel}</td>
                    <td className="px-3 py-2 text-text-primary">{row.paydayLabel}</td>
                    <td className="px-3 py-2 text-text-secondary">{row.livingWindow}</td>
                    <td className="px-3 py-2 tabular-nums text-text-primary">{row.days}d</td>
                    <td className="px-3 py-2 font-sans text-text-secondary">{row.maturityLabel}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOverrideCode(editingOverrideCode === row.periodCode ? null : row.periodCode)
                        }
                        className="px-2 py-0.5 rounded border border-border text-[11px] font-sans text-text-secondary hover:bg-surface-hover cursor-pointer"
                      >
                        {row.overrideApplied ? "Edit Override" : "Override"}
                      </button>
                    </td>
                  </tr>
                  {editingOverrideCode === row.periodCode && (
                    <tr className="bg-surface-subtle/40">
                      <td colSpan={7} className="px-3 py-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end font-sans">
                          <label className="space-y-1 text-[11px]">
                            <span className="text-text-tertiary block">Explicit Payslip ISO</span>
                            <input
                              type="date"
                              value={row.override?.payslipDateIso ?? row.payslipIso}
                              onChange={(e) => updateOverride(row.periodCode, { payslipDateIso: e.target.value })}
                              className="w-full bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                            />
                          </label>
                          <label className="space-y-1 text-[11px]">
                            <span className="text-text-tertiary block">Explicit Payday ISO</span>
                            <input
                              type="date"
                              value={row.override?.paydayDateIso ?? row.paydayIso}
                              onChange={(e) => updateOverride(row.periodCode, { paydayDateIso: e.target.value })}
                              className="w-full bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                            />
                          </label>
                          <label className="space-y-1 text-[11px]">
                            <span className="text-text-tertiary block">Override Reason</span>
                            <input
                              type="text"
                              placeholder="e.g. Natal / Year-end early closing"
                              value={row.override?.note ?? ""}
                              onChange={(e) => updateOverride(row.periodCode, { note: e.target.value })}
                              className="w-full bg-canvas border border-border rounded px-2 py-1 text-xs text-text-primary"
                            />
                          </label>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => updateOverride(row.periodCode, { payslipDateIso: "", paydayDateIso: "", note: "" })}
                              className="px-2 py-1 rounded border border-border text-[11px] text-text-tertiary hover:text-delta-negative cursor-pointer"
                            >
                              Clear Override
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Universal Formula DSL Editor & Clickable Reserved Words */}
      <div className="rounded border border-border-subtle p-4 space-y-4 bg-canvas/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-semibold text-text-primary">
              Custom Calculation Formulas &amp; Reserved Tokens
            </h4>
            <p className="text-[11px] text-text-tertiary mt-0.5">
              Select a formula row below and click any token chip to insert it. Supported functions: ROUND, FLOOR, CEIL, MIN, MAX, CLAMP, IF, PCT.
            </p>
          </div>
          <span className="text-[11px] font-mono text-text-tertiary">
            Target: {FORMULA_META.find((m) => m.key === activeFormulaKey)?.title}
          </span>
        </div>

        {/* Clickable 31 Reserved Word Chips */}
        <div className="flex flex-wrap gap-1.5">
          {RESERVED_WORDS_CATALOG_LIST.map((token) => (
            <button
              key={token}
              type="button"
              onClick={() => handleInsertToken(token)}
              title={`Current period value: ${formatRupiah(Math.round(liveVars[token] ?? 0))}`}
              className="px-2 py-0.5 rounded border border-border bg-surface text-[10px] font-mono text-text-secondary hover:border-accent hover:text-text-primary cursor-pointer"
            >
              {"{" + token + "}"}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {FORMULA_META.map((meta) => {
            const evalRes = clientEvaluations[meta.key];
            const srvRes = serverEval?.[meta.key];
            const isSelected = activeFormulaKey === meta.key;
            return (
              <div
                key={meta.key}
                className={`rounded border p-3 space-y-2 transition-colors ${
                  isSelected ? "border-accent/60 bg-surface" : "border-border-subtle bg-surface/60"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-text-primary">{meta.title}</div>
                    <div className="text-[11px] text-text-tertiary">{meta.description}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {evalRes?.valid ? (
                      <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded bg-[rgba(16,183,141,0.10)] text-delta-positive font-mono text-xs tabular-nums">
                        Preview: {formatRupiah(evalRes.valueRp)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded bg-[rgba(224,108,83,0.12)] text-delta-negative text-[11px]">
                        <AlertTriangle className="w-3 h-3" />
                        {evalRes?.error || "Syntax Error"}
                      </span>
                    )}
                    {srvRes?.valid && (
                      <span className="text-[10px] font-mono text-text-tertiary">
                        (Verified: {formatRupiah(srvRes.valueRp)})
                      </span>
                    )}
                  </div>
                </div>
                <input
                  ref={(el) => {
                    formulaInputRefs.current[meta.key] = el;
                  }}
                  type="text"
                  onFocus={() => setActiveFormulaKey(meta.key)}
                  value={activeFormulas[meta.key]}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      formulas: { ...activeFormulas, [meta.key]: e.target.value },
                    })
                  }
                  className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 2. Instruments & Cutoff Rules Table
export function InstrumentsTableCard({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const activeStudio = studioConfig ?? initialConfig;
  const [rows, setRows] = useState<InstrumentConfigRow[]>(activeStudio?.instrumentsTable ?? []);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudio?.instrumentsTable) setRows(activeStudio.instrumentsTable);
  }, [activeStudio]);

  const handleAddRow = () => {
    setRows((prev) => [
      ...prev,
      {
        id: `inst_${Date.now()}`,
        name: "Custom PayLater / Card",
        type: "PAYLATER",
        cutoffDay: 15,
        cutoffFormula: "DAYS_IN_MONTH - 15",
        cutoffBoundaryInclusive: true,
        preCutoffOffsetMonths: 0,
        postCutoffOffsetMonths: 1,
        dueDay: 25,
        dueRule: "FIXED_DAY",
        dueShiftRule: "EXACT_DAY",
        monthlyInterestPct: 2.5,
        adminFeePct: 1.0,
        creditLimitRp: 5000000,
        utilizationWarnPct: 40,
        lateFeeRule: "Standard fee",
        active: true,
      },
    ]);
  };

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    setErrorMsg(null);
    try {
      await updateStudioConfig({ instrumentsTable: rows });
      setSavedMsg("Instruments & cutoff rules saved to active engine.");
    } catch (e: any) {
      setErrorMsg(e?.message || "Failed to save instruments table.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-sans">
            Payment Instruments &amp; Billing Cutoff Formulas
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Configures modular cutoff expressions (e.g. DAYS_IN_MONTH - 15), boundary rules, billing offsets, and due shifts across calendar &amp; Feb 28/29 months.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAddRow}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Instrument
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Table"}
          </button>
        </div>
      </div>

      <SaveBanner savedMsg={savedMsg} errorMsg={errorMsg} />

      <div className="space-y-3">
        {rows.map((row, idx) => {
          const isLoan = row.dueRule === "DISBURSEMENT_DAY";
          const inclusive =
            typeof row.cutoffBoundaryInclusive === "boolean"
              ? row.cutoffBoundaryInclusive
              : row.type !== "CREDIT_CARD";
          const preOffset =
            typeof row.preCutoffOffsetMonths === "number"
              ? row.preCutoffOffsetMonths
              : row.type === "CREDIT_CARD"
                ? 1
                : 0;
          const postOffset =
            typeof row.postCutoffOffsetMonths === "number"
              ? row.postCutoffOffsetMonths
              : row.type === "CREDIT_CARD"
                ? 2
                : 1;
          return (
            <div
              key={row.id}
              className="rounded-md border border-border bg-canvas/70 p-3.5 space-y-3"
            >
              {/* Row 1: Identity, Instrument Type, Rate, Limit, Active & Action */}
              <div className="grid grid-cols-12 gap-3 items-end">
                <label className="col-span-4 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Instrument Name
                  </span>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, name: e.target.value };
                      setRows(next);
                    }}
                    className="w-full bg-surface border border-border rounded px-2.5 py-1.5 text-xs text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong"
                  />
                </label>

                <label className="col-span-2 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Type
                  </span>
                  <select
                    value={row.type}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, type: e.target.value };
                      setRows(next);
                    }}
                    className="w-full bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-secondary"
                  >
                    <option value="PAYLATER">PayLater</option>
                    <option value="CREDIT_CARD">Credit Card</option>
                    <option value="CASH_LOAN">Cash Loan</option>
                  </select>
                </label>

                <label className="col-span-2 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Rate (% / mo)
                  </span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={row.monthlyInterestPct}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, monthlyInterestPct: Number(e.target.value) || 0 };
                      setRows(next);
                    }}
                    className="w-full bg-surface border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
                  />
                </label>

                <label className="col-span-3 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Limit (Rp)
                  </span>
                  <input
                    type="number"
                    step={500000}
                    min={0}
                    value={row.creditLimitRp}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, creditLimitRp: Number(e.target.value) || 0 };
                      setRows(next);
                    }}
                    className="w-full bg-surface border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
                  />
                </label>

                <div className="col-span-1 flex items-center justify-end gap-2 pb-1.5">
                  <input
                    type="checkbox"
                    title="Instrument active"
                    aria-label={`Toggle ${row.name} active`}
                    checked={row.active}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, active: e.target.checked };
                      setRows(next);
                    }}
                    className="h-4 w-4 rounded border-border bg-surface accent-delta-positive cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                    className="p-1 text-text-tertiary hover:text-delta-negative cursor-pointer"
                    title="Delete instrument"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Row 2: Cutoff Formula, Boundary Rule, Pre/Post Cycle Offsets & Due Schedule */}
              <div className="grid grid-cols-12 gap-3 items-start pt-2.5 border-t border-border-subtle/70">
                <div className="col-span-4 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Cutoff Formula
                  </span>
                  {isLoan ? (
                    <div className="py-1.5 text-[11px] font-mono text-text-tertiary">
                      Disbursement Day Anchor (+1 mo)
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={row.cutoffFormula ?? String(row.cutoffDay || 15)}
                        onChange={(e) => {
                          const val = e.target.value;
                          const num = Number(val);
                          const next = [...rows];
                          next[idx] = {
                            ...row,
                            cutoffFormula: val,
                            ...(Number.isFinite(num) && num >= 0 && num <= 31 ? { cutoffDay: num } : {}),
                          };
                          setRows(next);
                        }}
                        placeholder="DAYS_IN_MONTH - 15"
                        className="w-full bg-surface border border-border rounded px-2.5 py-1.5 font-mono text-[11px] text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-border-strong"
                      />
                      <div className="flex gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...rows];
                            next[idx] = { ...row, cutoffFormula: "DAYS_IN_MONTH - 15", cutoffDay: 15 };
                            setRows(next);
                          }}
                          className="px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-[10px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
                        >
                          H-15 EOM
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...rows];
                            next[idx] = { ...row, cutoffFormula: "25", cutoffDay: 25 };
                            setRows(next);
                          }}
                          className="px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-[10px] font-mono text-text-tertiary hover:text-text-primary cursor-pointer"
                        >
                          25th
                        </button>
                      </div>
                    </>
                  )}
                </div>

                <div className="col-span-3 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Boundary Rule
                  </span>
                  {isLoan ? (
                    <div className="py-1.5 text-[11px] font-mono text-text-tertiary">
                      +1 month maturity
                    </div>
                  ) : (
                    <select
                      value={inclusive ? "INCLUSIVE" : "EXCLUSIVE"}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = {
                          ...row,
                          cutoffBoundaryInclusive: e.target.value === "INCLUSIVE",
                        };
                        setRows(next);
                      }}
                      className="w-full bg-surface border border-border rounded px-2 py-1.5 text-[11px] font-mono text-text-secondary whitespace-nowrap"
                    >
                      <option value="INCLUSIVE">&gt;= Cutoff rolls next</option>
                      <option value="EXCLUSIVE">&gt; Cutoff rolls next</option>
                    </select>
                  )}
                </div>

                <div className="col-span-2 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Offsets (Pre / Post)
                  </span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      title="Pre-cutoff cycle offset (months)"
                      value={preOffset}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, preCutoffOffsetMonths: Math.max(0, Number(e.target.value) || 0) };
                        setRows(next);
                      }}
                      className="w-12 bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary"
                    />
                    <span className="text-text-tertiary">/</span>
                    <input
                      type="number"
                      min={0}
                      max={6}
                      title="Post-cutoff cycle offset (months)"
                      value={postOffset}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, postCutoffOffsetMonths: Math.max(0, Number(e.target.value) || 0) };
                        setRows(next);
                      }}
                      className="w-12 bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary"
                    />
                  </div>
                </div>

                <div className="col-span-3 space-y-1">
                  <span className="block text-[10px] font-mono text-text-tertiary">
                    Due Day / Shift
                  </span>
                  {isLoan ? (
                    <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1.5 rounded bg-surface-subtle border border-border-subtle text-[11px] text-text-secondary">
                      Disbursement Day
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={row.dueDay}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, dueDay: Number(e.target.value) || 25 };
                          setRows(next);
                        }}
                        className="w-14 bg-surface border border-border rounded px-2 py-1.5 font-mono text-xs text-text-primary"
                      />
                      <select
                        value={row.dueShiftRule ?? (row.type === "CREDIT_CARD" ? "SHIFT_PREVIOUS_FRIDAY" : "EXACT_DAY")}
                        onChange={(e) => {
                          const next = [...rows];
                          next[idx] = { ...row, dueShiftRule: e.target.value };
                          setRows(next);
                        }}
                        className="flex-1 min-w-0 bg-surface border border-border rounded px-2 py-1.5 text-[11px] text-text-secondary"
                      >
                        <option value="EXACT_DAY">Exact Due Day</option>
                        <option value="SHIFT_PREVIOUS_FRIDAY">H-1 Weekday</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Multi-Month & February 28/29 Cutoff Tester */}
      <div className="rounded border border-border-subtle bg-surface-subtle/60 p-3.5 space-y-2">
        <div className="text-[11px] font-mono text-text-tertiary">
          Live Calendar &amp; February Clamping Verification
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5 text-[11px] font-mono">
          {[
            { label: "Nov 2026 (30d)", m: 11, y: 2026, testDate: "2026-11-23" },
            { label: "Dec 2026 (31d)", m: 12, y: 2026, testDate: "2026-12-16" },
            { label: "Feb 2027 (28d)", m: 2, y: 2027, testDate: "2027-02-13" },
            { label: "Feb 2028 Leap (29d)", m: 2, y: 2028, testDate: "2028-02-14" },
          ].map((probe) => {
            const spay = rows.find((r) => r.active && r.type === "PAYLATER");
            const cutoffD = resolveInstrumentCutoffDayClient(spay, probe.m, probe.y, 15);
            const landed = resolveInstrumentLandingPeriodClient(spay, probe.testDate, false);
            return (
              <div key={probe.label} className="rounded border border-border-subtle bg-canvas px-2.5 py-2 space-y-0.5">
                <div className="text-text-secondary font-sans font-medium">{probe.label}</div>
                <div className="text-text-primary">
                  SPayLater cutoff: <span className="text-accent">{cutoffD}th</span>
                </div>
                <div className="text-text-tertiary text-[10px]">
                  Tx {probe.testDate.slice(5)} -&gt; {landed.label} (Due {landed.dueDay}th)
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 3. Asset Accounts & Vaults Table
export function AssetAccountsTableCard({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const activeStudio = studioConfig ?? initialConfig;
  const [enableExternal, setEnableExternal] = useState<boolean>(
    activeStudio?.enableExternalAssetPortfolio ?? false,
  );
  const [p1OverrideInput, setP1OverrideInput] = useState<string>(
    activeStudio?.actualP1VaultBalanceRp !== null &&
      activeStudio?.actualP1VaultBalanceRp !== undefined
      ? String(activeStudio.actualP1VaultBalanceRp)
      : "",
  );
  const [rows, setRows] = useState<AssetAccountConfigRow[]>(activeStudio?.assetAccountsTable ?? []);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudio) {
      setEnableExternal(activeStudio.enableExternalAssetPortfolio ?? false);
      setP1OverrideInput(
        activeStudio.actualP1VaultBalanceRp !== null &&
          activeStudio.actualP1VaultBalanceRp !== undefined
          ? String(activeStudio.actualP1VaultBalanceRp)
          : "",
      );
      if (activeStudio.assetAccountsTable) setRows(activeStudio.assetAccountsTable);
    }
  }, [activeStudio]);

  const totalAssets = useMemo(
    () => (enableExternal ? rows.reduce((s, r) => s + Math.max(0, Number(r.balanceRp) || 0), 0) : 0),
    [rows, enableExternal],
  );

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    const trimmed = p1OverrideInput.trim();
    const actualP1VaultBalanceRp = trimmed === "" ? null : Math.max(0, Number(trimmed) || 0);
    await updateStudioConfig({
      enableExternalAssetPortfolio: enableExternal,
      actualP1VaultBalanceRp,
      assetAccountsTable: rows,
    });
    setSavedMsg(
      enableExternal
        ? "External asset portfolio enabled & synced with Cash & Savings vs. Debt."
        : "External asset portfolio disabled - balances derive strictly from ledger snapshots.",
    );
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-sans">
            Cash &amp; External Asset Accounts
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Feeds Cash &amp; Savings vs. Remaining Debt and Savings Runway. Active external total: {formatRupiah(totalAssets)}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded border border-border bg-surface-subtle text-xs text-text-primary cursor-pointer">
            <input
              type="checkbox"
              checked={enableExternal}
              onChange={(e) => setEnableExternal(e.target.checked)}
              className="rounded border-border"
            />
            <span>Enable External Asset Portfolio</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                {
                  id: `acc_${Date.now()}`,
                  name: "New Savings Account",
                  institution: "Bank / Fund",
                  accountType: "MONEY_MARKET_RDPU",
                  balanceRp: 0,
                  annualYieldPct: 2.0,
                  includeInRunway: true,
                  isPrimaryPayroll: false,
                },
              ])
            }
            disabled={!enableExternal}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs text-text-secondary hover:bg-surface-hover disabled:opacity-40 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Account
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Accounts"}
          </button>
        </div>
      </div>

      <SaveBanner savedMsg={savedMsg} errorMsg={null} />

      <div className="rounded border border-border-subtle bg-surface-subtle/40 p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-text-primary font-sans">
            Actual Closed-Cycles Savings Balance Override (Rp)
          </div>
          <p className="text-[11px] text-text-tertiary mt-0.5">
            Set an exact realized balance for closed cycles or leave blank to compute directly from verified savings records.
          </p>
        </div>
        <input
          type="number"
          min={0}
          step={10000}
          placeholder="Auto (from ledger)"
          value={p1OverrideInput}
          onChange={(e) => setP1OverrideInput(e.target.value)}
          className="w-44 bg-canvas border border-border rounded px-2.5 py-1.5 text-xs font-mono text-text-primary tabular-nums"
        />
      </div>

      {!enableExternal ? (
        <div className="rounded border border-border-subtle bg-surface-subtle/50 p-4 text-xs text-text-secondary space-y-1">
          <div className="font-medium text-text-primary">
            External Asset Portfolio is currently OFF (Ledger-Truth Mode)
          </div>
          <p className="text-text-tertiary">
            Cash &amp; Savings balances derive exclusively from your verified monthly Core Savings ledger deposits and actual Wallet Check-In cash balances. Turn on &quot;Enable External Asset Portfolio&quot; above if you want to track off-ledger money market, time deposits, gold, stocks, or crypto holdings.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-xs text-left">
            <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
              <tr>
                <th className="px-2.5 py-2">Account Name</th>
                <th className="px-2.5 py-2">Institution</th>
                <th className="px-2.5 py-2">Type</th>
                <th className="px-2.5 py-2">Current Balance (Rp)</th>
                <th className="px-2.5 py-2">Yield (% p.a.)</th>
                <th className="px-2.5 py-2">Runway</th>
                <th className="px-2.5 py-2 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-surface-hover/40">
                  <td className="px-2.5 py-2">
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, name: e.target.value };
                        setRows(next);
                      }}
                      className="w-60 bg-canvas border border-border rounded px-2 py-1 text-xs text-text-primary"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="text"
                      value={row.institution}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, institution: e.target.value };
                        setRows(next);
                      }}
                      className="w-40 bg-canvas border border-border rounded px-2 py-1 text-xs text-text-secondary"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <select
                      value={row.accountType}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, accountType: e.target.value };
                        setRows(next);
                      }}
                      className="bg-canvas border border-border rounded px-2 py-1 text-xs text-text-secondary"
                    >
                      <option value="OPERATIONAL_BANK">Liquid Bank</option>
                      <option value="MONEY_MARKET_RDPU">Money Market / RDPU</option>
                      <option value="TIME_DEPOSIT">Time Deposit</option>
                      <option value="GOLD">Gold / Bullion</option>
                      <option value="STOCKS">Stocks / Equities</option>
                      <option value="CRYPTO">Crypto Assets</option>
                      <option value="CASH_WALLET">Daily Cash Wallet</option>
                      <option value="SAVINGS_VAULT">Custom Savings Account</option>
                    </select>
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="number"
                      min={0}
                      step={50000}
                      value={row.balanceRp}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, balanceRp: Number(e.target.value) || 0 };
                        setRows(next);
                      }}
                      className="w-32 bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={row.annualYieldPct}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, annualYieldPct: Number(e.target.value) || 0 };
                        setRows(next);
                      }}
                      className="w-20 bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                    />
                  </td>
                  <td className="px-2.5 py-2">
                    <input
                      type="checkbox"
                      checked={row.includeInRunway}
                      onChange={(e) => {
                        const next = [...rows];
                        next[idx] = { ...row, includeInRunway: e.target.checked };
                        setRows(next);
                      }}
                    />
                  </td>
                  <td className="px-2.5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                      className="p-1 text-text-tertiary hover:text-delta-negative cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 4. Routine Envelopes & Budget Templates Table
export function RoutineTemplatesTableCard({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const activeStudio = studioConfig ?? initialConfig;
  const [rows, setRows] = useState<RoutineTemplateConfigRow[]>(activeStudio?.routineTemplatesTable ?? []);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudio?.routineTemplatesTable) setRows(activeStudio.routineTemplatesTable);
  }, [activeStudio]);

  const handleSave = async () => {
    setSaving(true);
    setSavedMsg(null);
    await updateStudioConfig({ routineTemplatesTable: rows });
    setSavedMsg("Routine envelope templates & rollover policies saved.");
    setSaving(false);
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary font-sans">
            Routine Envelopes &amp; Rollover Policy Templates
          </h3>
          <p className="text-xs text-text-tertiary mt-0.5">
            Defines default monthly routine quotas, due dates, and end-of-cycle rollover behavior (Sweep to Savings vs Roll Forward).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setRows((prev) => [
                ...prev,
                {
                  id: `tpl_${Date.now()}`,
                  slotKey: `custom_${prev.length + 1}`,
                  name: "Custom Routine Bill",
                  monthlyQuotaRp: 100000,
                  targetDueDay: 25,
                  rolloverPolicy: "SWEEP_TO_P1",
                  active: true,
                },
              ])
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-border text-xs text-text-secondary hover:bg-surface-hover cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Template
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Templates"}
          </button>
        </div>
      </div>

      <SaveBanner savedMsg={savedMsg} errorMsg={null} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-xs text-left">
          <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
            <tr>
              <th className="px-2.5 py-2">Template Label</th>
              <th className="px-2.5 py-2">Slot Key</th>
              <th className="px-2.5 py-2">Monthly Quota (Rp)</th>
              <th className="px-2.5 py-2">Due Day</th>
              <th className="px-2.5 py-2">End-of-Cycle Rollover Policy</th>
              <th className="px-2.5 py-2">Active</th>
              <th className="px-2.5 py-2 text-right">Remove</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((row, idx) => (
              <tr key={row.id} className="hover:bg-surface-hover/40">
                <td className="px-2.5 py-2">
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, name: e.target.value };
                      setRows(next);
                    }}
                    className="w-52 bg-canvas border border-border rounded px-2 py-1 text-xs text-text-primary"
                  />
                </td>
                <td className="px-2.5 py-2 font-mono text-text-tertiary">{row.slotKey}</td>
                <td className="px-2.5 py-2">
                  <input
                    type="number"
                    min={0}
                    step={25000}
                    value={row.monthlyQuotaRp}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, monthlyQuotaRp: Number(e.target.value) || 0 };
                      setRows(next);
                    }}
                    className="w-28 bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={row.targetDueDay}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, targetDueDay: Number(e.target.value) || 25 };
                      setRows(next);
                    }}
                    className="w-16 bg-canvas border border-border rounded px-2 py-1 font-mono text-xs text-text-primary"
                  />
                </td>
                <td className="px-2.5 py-2">
                  <select
                    value={row.rolloverPolicy}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = {
                        ...row,
                        rolloverPolicy: e.target.value as RoutineTemplateConfigRow["rolloverPolicy"],
                      };
                      setRows(next);
                    }}
                    className="bg-canvas border border-border rounded px-2 py-1 text-xs text-text-secondary"
                  >
                    <option value="SWEEP_TO_P1">Sweep Unspent to Core Savings</option>
                    <option value="ROLLOVER_NEXT_MONTH">Roll Over to Next Month Quota</option>
                  </select>
                </td>
                <td className="px-2.5 py-2">
                  <input
                    type="checkbox"
                    checked={row.active}
                    onChange={(e) => {
                      const next = [...rows];
                      next[idx] = { ...row, active: e.target.checked };
                      setRows(next);
                    }}
                  />
                </td>
                <td className="px-2.5 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                    className="p-1 text-text-tertiary hover:text-delta-negative cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 5. Sidebar Navigation & Custom Menu Builder
const MANAGED_SIDEBAR_ROUTES = [
  { href: "/", defaultLabel: "Overview" },
  { href: "/payroll", defaultLabel: "Payroll & Income" },
  { href: "/allocations", defaultLabel: "Monthly Plan" },
  { href: "/credit", defaultLabel: "Installments & Bills" },
  { href: "/savings", defaultLabel: "Savings & Pockets" },
  { href: "/import", defaultLabel: "Statement Import" },
  { href: "/scenarios", defaultLabel: "Scenario Lab" },
  { href: "/ledger", defaultLabel: "Transaction Ledger" },
  { href: "/wishlist", defaultLabel: "Wishlist Simulator" },
  { href: "/audit", defaultLabel: "Health Check" },
  { href: "/analytics", defaultLabel: "Spending Trend" },
  { href: "/reports", defaultLabel: "Financial Reports" },
  { href: "/subscriptions", defaultLabel: "Recurring Bills" },
  { href: "/preferences", defaultLabel: "Preferences" },
  { href: "/admin", defaultLabel: "Platform Admin" },
];

const SHORTCUT_DESTINATION_CATALOG: Array<{ group: string; items: Array<{ href: string; label: string }> }> = [
  {
    group: "All Top-Level Modules",
    items: [
      { href: "/", label: "Overview (/)" },
      { href: "/payroll", label: "Payroll & Income (/payroll)" },
      { href: "/allocations", label: "Monthly Plan (/allocations)" },
      { href: "/credit", label: "Installments & Bills (/credit)" },
      { href: "/savings", label: "Savings & Pockets (/savings)" },
      { href: "/import", label: "Statement Import (/import)" },
      { href: "/scenarios", label: "Scenario Lab (/scenarios)" },
      { href: "/ledger", label: "Transaction Ledger (/ledger)" },
      { href: "/wishlist", label: "Wishlist Simulator (/wishlist)" },
      { href: "/audit", label: "Health Check (/audit)" },
      { href: "/analytics", label: "Spending Trend (/analytics)" },
      { href: "/reports", label: "Financial Reports (/reports)" },
      { href: "/subscriptions", label: "Recurring Bills (/subscriptions)" },
      { href: "/preferences", label: "Preferences (/preferences)" },
      { href: "/admin", label: "Platform Admin (/admin)" },
    ],
  },
  {
    group: "All Sub-Module Views",
    items: [
      { href: "/payroll?sub=payslip", label: "Payslip & Income (/payroll?sub=payslip)" },
      { href: "/payroll?sub=timeline", label: "Payday Timeline (/payroll?sub=timeline)" },
      { href: "/payroll?sub=lifeenergy", label: "Hourly Wage & Time Cost (/payroll?sub=lifeenergy)" },
      { href: "/allocations?sub=waterfall", label: "Plan & Quota Simulator (/allocations?sub=waterfall)" },
      { href: "/allocations?sub=envelopes", label: "Routine & Sinking Reserve (/allocations?sub=envelopes)" },
      { href: "/credit?sub=matrix", label: "Bill Schedule & Cards (/credit?sub=matrix)" },
      { href: "/credit?sub=simulator", label: "Payoff Strategy & Cutoff (/credit?sub=simulator)" },
      { href: "/savings?sub=pockets", label: "Savings Pockets & Splits (/savings?sub=pockets)" },
      { href: "/savings?sub=runway", label: "Net Worth & Runway (/savings?sub=runway)" },
      { href: "/reports?sub=executive", label: "Statement & Visuals (/reports?sub=executive)" },
      { href: "/reports?sub=variance", label: "Comparison & Health Check (/reports?sub=variance)" },
      { href: "/reports?sub=export", label: "Forward Outlook & Exports (/reports?sub=export)" },
      { href: "/preferences?sub=formula", label: "Formula & Priority (/preferences?sub=formula)" },
      { href: "/preferences?sub=instruments", label: "Methods & Accounts (/preferences?sub=instruments)" },
      { href: "/preferences?sub=templates", label: "Routine & Buckets (/preferences?sub=templates)" },
      { href: "/preferences?sub=display", label: "Display, Account & AI (/preferences?sub=display)" },
      { href: "/preferences?sub=notifications", label: "Alerts & Email (/preferences?sub=notifications)" },
      { href: "/preferences?sub=backup", label: "Backup & Restore (/preferences?sub=backup)" },
    ],
  },
];

export function SidebarMenuBuilderCard({ initialConfig }: { initialConfig?: ModularStudioConfig }) {
  const { studioConfig, updateStudioConfig } = usePerspective();
  const { t } = useLanguage();
  const activeStudio = studioConfig ?? initialConfig;
  const [navCfg, setNavCfg] = useState<SidebarNavigationConfig>(
    activeStudio?.sidebarNavigationConfig ?? {
      defaultLandingRoute: "/",
      moduleOverrides: {},
      customShortcuts: [],
    },
  );
  const [newLabel, setNewLabel] = useState("");
  const [newTargetHref, setNewTargetHref] = useState("/scenarios");
  const [newIcon, setNewIcon] = useState("TrendingDown");
  const [newGroup, setNewGroup] = useState<CustomSidebarShortcut["sectionGroup"]>("AUDIT_DECISION");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (activeStudio?.sidebarNavigationConfig) {
      setNavCfg(activeStudio.sidebarNavigationConfig);
    }
  }, [activeStudio]);

  const persistNav = async (next: SidebarNavigationConfig, msg: string) => {
    setNavCfg(next);
    setSaving(true);
    setSavedMsg(null);
    await updateStudioConfig({ sidebarNavigationConfig: next });
    setSavedMsg(msg);
    setSaving(false);
  };

  const handleAddShortcut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    const item: CustomSidebarShortcut = {
      id: `sc_${Date.now()}`,
      label: newLabel.trim(),
      icon: newIcon,
      targetHref: newTargetHref.trim() || "/",
      sectionGroup: newGroup,
    };
    const next: SidebarNavigationConfig = {
      ...navCfg,
      customShortcuts: [...navCfg.customShortcuts, item],
    };
    setNewLabel("");
    await persistNav(next, `Custom sidebar shortcut "${item.label}" added and rendered live.`);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary font-sans">
              Custom Sidebar Shortcut Builder
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Pin custom shortcuts directly into your left sidebar pointing to any route or sub-module.
            </p>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <span>Startup Page:</span>
            <select
              value={navCfg.defaultLandingRoute}
              onChange={(e) =>
                persistNav(
                  { ...navCfg, defaultLandingRoute: e.target.value },
                  "Startup landing route saved.",
                )
              }
              className="bg-canvas border border-border rounded px-2 py-1 text-xs text-text-primary"
            >
              {MANAGED_SIDEBAR_ROUTES.map((r) => (
                <option key={r.href} value={r.href}>
                  {r.defaultLabel} ({r.href})
                </option>
              ))}
            </select>
          </label>
        </div>

        <SaveBanner savedMsg={savedMsg} errorMsg={null} />

        <form onSubmit={handleAddShortcut} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <label className="space-y-1 text-xs sm:col-span-2">
            <span className="text-text-tertiary block">Custom Menu Name</span>
            <input
              type="text"
              placeholder="e.g. Payoff Strategy"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full bg-canvas border border-border rounded px-2.5 py-1.5 text-xs text-text-primary"
            />
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-text-tertiary block">Target Route / Sub</span>
            <select
              value={newTargetHref}
              onChange={(e) => setNewTargetHref(e.target.value)}
              className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs text-text-primary"
            >
              {SHORTCUT_DESTINATION_CATALOG.map((grp) => (
                <optgroup key={grp.group} label={grp.group}>
                  {grp.items.map((opt) => (
                    <option key={opt.href} value={opt.href}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs">
            <span className="text-text-tertiary block">Sidebar Group</span>
            <select
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as CustomSidebarShortcut["sectionGroup"])}
              className="w-full bg-canvas border border-border rounded px-2 py-1.5 text-xs text-text-primary"
            >
              <option value="FINANCIAL_ENGINE">{t("nav.section.engine")}</option>
              <option value="AUDIT_DECISION">{t("nav.section.audit")}</option>
              <option value="SYSTEM">{t("nav.section.system")}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={saving || !newLabel.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Shortcut
          </button>
        </form>

        {navCfg.customShortcuts.length > 0 && (
          <div className="divide-y divide-border-subtle border border-border-subtle rounded">
            {navCfg.customShortcuts.map((sc) => (
              <div key={sc.id} className="px-3 py-2 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bookmark className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="font-medium text-text-primary">{sc.label}</span>
                  <span className="font-mono text-[11px] text-text-tertiary truncate">{sc.targetHref}</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    persistNav(
                      {
                        ...navCfg,
                        customShortcuts: navCfg.customShortcuts.filter((x) => x.id !== sc.id),
                      },
                      `Removed shortcut "${sc.label}".`,
                    )
                  }
                  className="p-1 text-text-tertiary hover:text-delta-negative cursor-pointer"
                  title="Remove shortcut"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Module Label & Visibility Override Table */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary font-sans">
              Module Label &amp; Visibility Manager
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Customize menu display names or hide optional routes in your workspace sidebar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => persistNav(navCfg, "Module navigation overrides saved.")}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            Save Navigation
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-xs text-left">
            <thead className="bg-surface-subtle text-[10px] font-mono text-text-tertiary border-b border-border">
              <tr>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Default Name</th>
                <th className="px-3 py-2">Custom Label Override</th>
                <th className="px-3 py-2">Visible in Sidebar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {MANAGED_SIDEBAR_ROUTES.map((r) => {
                const ov = navCfg.moduleOverrides[r.href] ?? {};
                return (
                  <tr key={r.href} className="hover:bg-surface-hover/40">
                    <td className="px-3 py-2 font-mono text-text-tertiary">{r.href}</td>
                    <td className="px-3 py-2 text-text-secondary">{r.defaultLabel}</td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        placeholder={r.defaultLabel}
                        value={ov.label || ""}
                        onChange={(e) =>
                          setNavCfg({
                            ...navCfg,
                            moduleOverrides: {
                              ...navCfg.moduleOverrides,
                              [r.href]: { ...ov, label: e.target.value },
                            },
                          })
                        }
                        className="w-56 bg-canvas border border-border rounded px-2 py-1 text-xs text-text-primary"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={!ov.hidden}
                        onChange={(e) =>
                          setNavCfg({
                            ...navCfg,
                            moduleOverrides: {
                              ...navCfg.moduleOverrides,
                              [r.href]: { ...ov, hidden: !e.target.checked },
                            },
                          })
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
