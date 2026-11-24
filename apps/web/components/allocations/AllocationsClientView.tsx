"use client";

import React, { useEffect, useState } from "react";
import {
  BudgetRevision,
  IntelligenceBundleResponse,
  MonthlySnapshot,
  createBudgetRevision,
  fetchBudgetRevisions,
  fetchIntelligenceBundle,
  fetchSnapshot,
  getCached,
  resolvePriorityTierLabel,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useSubModule } from "@/hooks/useSubModule";
import { ALLOCATIONS_SUB_KEYS, AllocationsSubKey } from "@/lib/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import { EnvelopesAndSinkingPanel } from "@/components/finance/ModuleGoPanels";
import { MetricCard } from "@/components/primitives/MetricCard";
import {
  AllocationsDonutChart,
  AllocationSlice,
} from "@/components/allocations/AllocationsDonutChart";
import { FixedEssentialsTable } from "@/components/allocations/FixedEssentialsTable";
import { FormulaEngineSelectorCard } from "@/components/allocations/FormulaEngineSelectorCard";
import { DeficitAlert } from "@/components/overview/DeficitAlert";
import { PaydayTimelineSimulator } from "@/components/finance/PaydayTimelineSimulator";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";
import { formatRupiah } from "@/lib/utils";

export interface AllocationsPeriodData {
  snapshot: MonthlySnapshot | null;
  next1Snapshot: MonthlySnapshot | null;
  next2Snapshot: MonthlySnapshot | null;
}

interface AllocationsClientViewProps {
  initialMonth: number;
  initialYear: number;
  initialData: AllocationsPeriodData;
}

function getNextPeriod(m: number, y: number) {
  return m === 12 ? { month: 1, year: y + 1 } : { month: m + 1, year: y };
}

export function AllocationsClientView({
  initialMonth,
  initialYear,
  initialData,
}: AllocationsClientViewProps) {
  const { t } = useLanguage();
  const { studioConfig } = usePerspective();
  const savingsLabel = resolvePriorityTierLabel(studioConfig, "SAVINGS", "Core Savings");
  const surplusLabel = resolvePriorityTierLabel(studioConfig, "DISCRETIONARY", "Discretionary");
  const activeInstruments = (studioConfig?.instrumentsTable ?? []).filter((i) => i.active);
  const cutoffSummaryText =
    activeInstruments.length > 0
      ? `Cutoffs: ${activeInstruments
          .slice(0, 4)
          .map((inst) => `${inst.name} (${inst.cutoffDay > 0 ? `${inst.cutoffDay}th` : "exact"}/${inst.dueDay}th)`)
          .join(" · ")}`
      : "Cutoffs driven dynamically by your configured payment instruments";
  const [activeSub, selectSub] = useSubModule<AllocationsSubKey>(ALLOCATIONS_SUB_KEYS, "waterfall");
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [revisions, setRevisions] = useState<BudgetRevision[]>([]);
  const [liveSnapshotOverride, setLiveSnapshotOverride] = useState<MonthlySnapshot | null>(null);
  const [quotaDraft, setQuotaDraft] = useState<number>(0);
  const [quotaReason, setQuotaReason] = useState<string>("Rebalancing cycle daily living quota");
  const [quotaSaving, setQuotaSaving] = useState<boolean>(false);
  const [quotaMsg, setQuotaMsg] = useState<string | null>(null);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const { month, year, data, isPreBoundary } =
    usePeriodSlice<AllocationsPeriodData>({
      initialMonth,
      initialYear,
      initialData,
      seedCache: (m, y, d) => {
        const n1 = getNextPeriod(m, y);
        const n2 = getNextPeriod(n1.month, n1.year);
        if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
        if (d.next1Snapshot)
          setCached(`snapshot:${n1.month}:${n1.year}`, d.next1Snapshot);
        if (d.next2Snapshot)
          setCached(`snapshot:${n2.month}:${n2.year}`, d.next2Snapshot);
      },
      readFromCache: (m, y) => {
        const n1 = getNextPeriod(m, y);
        const n2 = getNextPeriod(n1.month, n1.year);
        const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
        const next1Snapshot = getCached<MonthlySnapshot | null>(
          `snapshot:${n1.month}:${n1.year}`,
        );
        const next2Snapshot = getCached<MonthlySnapshot | null>(
          `snapshot:${n2.month}:${n2.year}`,
        );
        if (
          snapshot === undefined ||
          next1Snapshot === undefined ||
          next2Snapshot === undefined
        ) {
          return undefined;
        }
        return { snapshot, next1Snapshot, next2Snapshot };
      },
      fetchForPeriod: async (m, y) => {
        const n1 = getNextPeriod(m, y);
        const n2 = getNextPeriod(n1.month, n1.year);
        const [snapshot, next1Snapshot, next2Snapshot] = await Promise.all([
          fetchSnapshot(m, y),
          fetchSnapshot(n1.month, n1.year),
          fetchSnapshot(n2.month, n2.year),
        ]);
        return { snapshot, next1Snapshot, next2Snapshot };
      },
    });

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot: sliceSnapshot, next1Snapshot, next2Snapshot } = data;
  const snapshot =
    liveSnapshotOverride && liveSnapshotOverride.month === month && liveSnapshotOverride.year === year
      ? liveSnapshotOverride
      : sliceSnapshot;
  const isLocked = snapshot?.status === "LOCKED";
  const finalTotalIncome = snapshot?.finalTotalIncome ?? 0;
  const totalDeductions = snapshot?.totalDeductions ?? 0;
  const survivalPocket = snapshot?.survivalPocket ?? 0;
  const actualSavings = snapshot?.actualSavings ?? 0;
  const selfReward = snapshot?.selfReward ?? 0;
  const bufferPocket = snapshot?.bufferPocket ?? 0;
  const deficitUncovered = snapshot?.deficitUncovered ?? 0;
  const routineBillsTotal =
    (snapshot?.transport ?? 0) +
    (snapshot?.internet ?? 0) +
    (snapshot?.vape ?? 0) +
    (snapshot?.haircut ?? 0);
  const trueHourlyWage = intel?.lifeenergy?.trueNetHourlyWageRp ?? 0;

  useEffect(() => {
    setLiveSnapshotOverride(null);
    setQuotaDraft(Math.round(sliceSnapshot?.actualDailyOperational ?? sliceSnapshot?.dailyOperational ?? 0));
    setRevisions(sliceSnapshot?.budgetRevisions ?? []);
    if (sliceSnapshot?.id) {
      fetchBudgetRevisions(sliceSnapshot.id).then((list) => {
        if (list.length > 0) setRevisions(list);
      });
    }
  }, [month, year, sliceSnapshot?.id, sliceSnapshot?.actualDailyOperational, sliceSnapshot?.dailyOperational]);

  const handleApplyQuotaPlan = async () => {
    if (!snapshot || isLocked) return;
    setQuotaSaving(true);
    setQuotaMsg(null);
    setQuotaError(null);
    const res = await createBudgetRevision(snapshot.id, {
      category: "DAILY_OPERATIONAL",
      newValue: Math.max(0, Math.round(quotaDraft)),
      reason: quotaReason.trim() || "Interactive Quota Planner adjustment",
    });
    if (!res.success || !res.data) {
      setQuotaError(res.error || "Failed to apply quota revision.");
      setQuotaSaving(false);
      return;
    }
    setCached(`snapshot:${month}:${year}`, res.data.snapshot);
    setLiveSnapshotOverride(res.data.snapshot);
    setRevisions((prev) => [res.data!.revision, ...prev]);
    setQuotaMsg(
      `Living quota updated to ${formatRupiah(quotaDraft)} (${res.data.revision.difference >= 0 ? "+" : ""}${formatRupiah(res.data.revision.difference)}).`,
    );
    setQuotaSaving(false);
  };

  const slices: AllocationSlice[] = [
    {
      id: "deductions",
      label: "Liabilities & Deductions",
      amount: totalDeductions,
      color: "#e06c53",
      priority: "Upfront - Debt & Card Bills",
    },
    {
      id: "survival",
      label:
        deficitUncovered > 0 ? "Survival Baseline Need" : "Survival Pocket",
      amount: survivalPocket,
      color: "#10b78d",
      priority:
        deficitUncovered > 0
          ? "Upfront - Baseline Living Need"
          : "Upfront - Essentials + Living Base",
    },
    {
      id: "savings",
      label: savingsLabel,
      amount: actualSavings,
      color: "#4f5b75",
      priority: savingsLabel,
    },
    {
      id: "self-reward",
      label: surplusLabel,
      amount: selfReward,
      color: "#e59b2c",
      priority: surplusLabel,
    },
  ];

  if (bufferPocket > 0) {
    slices.push({
      id: "buffer",
      label: "Emergency Buffer Pocket",
      amount: bufferPocket,
      color: "#384054",
      priority: "Reserve Buffer Allocation",
    });
  }

  useEffect(() => {
    let active = true;
    const cached = getCached<IntelligenceBundleResponse | null>(`intelligence:${month}:${year}:0`);
    if (cached) {
      setIntel(cached);
    } else {
      fetchIntelligenceBundle(month, year).then((res) => {
        if (active && res) setIntel(res);
      });
    }
    return () => {
      active = false;
    };
  }, [month, year]);

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Deficit Alert if any deficit exists */}
      <DeficitAlert deficitUncovered={deficitUncovered} />

      <PageHeader
        title={t("nav.allocations")}
        subtitle="Sequential cashflow plan, monthly quota simulator, and recurring envelope rollover rules."
        periodLabel={`${month}/${year}`}
        status={snapshot?.status ?? "DRAFT"}
        statusLabel={isLocked ? "Closed" : "Active Draft"}
      />

      <SubModuleNav
        items={[
          { key: "waterfall", label: t("sub.allocations.waterfall") },
          { key: "envelopes", label: t("sub.allocations.envelopes") },
        ]}
        activeKey={activeSub}
        onSelect={selectSub}
      />

      {activeSub === "waterfall" && (
        <div className="space-y-8">

      {/* SECTION 1: Donut Visualization & Pocket Proportions */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary">
          Allocation Architecture &amp; Distribution
        </div>

        <AllocationsDonutChart
          totalIncome={finalTotalIncome}
          slices={slices}
          bufferPocket={bufferPocket}
        />
      </section>

      {/* SECTION 2: Exact Metric Cards for Precision */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary">
          Exact Pocket Distributions
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-3">
            <MetricCard
              label="Liabilities / Deductions"
              amount={totalDeductions}
              value={formatRupiah(totalDeductions)}
              footer="Upfront: KPR, installments & bills"
              statusVariant="default"
            />
          </div>

          <div className="lg:col-span-3">
            <MetricCard
              label={
                deficitUncovered > 0
                  ? "Survival Baseline Need"
                  : "Survival Pocket"
              }
              amount={survivalPocket}
              value={formatRupiah(survivalPocket)}
              footer={
                deficitUncovered > 0
                  ? `Baseline need (${formatRupiah(deficitUncovered)} shortfall)`
                  : "Upfront: Essentials & daily operational"
              }
              statusVariant={deficitUncovered > 0 ? "urgency" : "default"}
              statusLabel={deficitUncovered > 0 ? "DEFICIT RISK" : undefined}
            />
          </div>

          <div className="lg:col-span-3">
            <MetricCard
              label={savingsLabel}
              amount={actualSavings}
              value={formatRupiah(actualSavings)}
              footer={`Target: ${formatRupiah(snapshot?.savings ?? 0)}`}
              statusVariant="default"
            />
          </div>

          <div className="lg:col-span-3">
            <MetricCard
              label={surplusLabel}
              amount={selfReward}
              value={formatRupiah(selfReward)}
              footer="Unallocated discretionary pool"
              statusVariant="default"
            />
          </div>
        </div>
      </section>

      {/* SECTION 3: Detailed Breakdown Tables */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7">
          <FixedEssentialsTable
            transport={snapshot?.transport ?? 0}
            internet={snapshot?.internet ?? 0}
            vape={snapshot?.vape ?? 0}
            haircut={snapshot?.haircut ?? 0}
            dailyOperational={snapshot?.dailyOperational ?? 0}
            actualDailyOperational={snapshot?.actualDailyOperational}
            deficitUncovered={deficitUncovered}
          />
        </div>

        <div className="lg:col-span-5 bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
          <div className="pb-3 border-b border-border-subtle">
            <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
              Waterfall Execution Order
            </h3>
            <p className="text-xs font-sans text-text-tertiary mt-0.5">
              Strict sequential capital distribution rules governed by ERP core.
            </p>
          </div>

          <div className="space-y-3 text-xs font-sans">
            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-delta-negative bg-[rgba(224,108,83,0.1)] px-1.5 py-0.5 rounded shrink-0">
                UPFRONT
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  Liabilities &amp; Essential Living Baseline
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  First claim on take-home pay: debt contracts, card bills, fixed routine bills &amp; envelopes, and the daily operational living budget.
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-text-primary bg-surface-subtle px-1.5 py-0.5 rounded shrink-0 border border-border-subtle">
                Step 1
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  {savingsLabel}
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  Monthly capital preservation target funded immediately from available surplus once all upfront commitments are satisfied.
                </span>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <span className="font-mono text-[10px] font-bold text-caution bg-[rgba(229,155,44,0.1)] px-1.5 py-0.5 rounded shrink-0">
                Step 2
              </span>
              <div>
                <span className="font-medium text-text-primary block">
                  {surplusLabel}
                </span>
                <span className="text-[11px] text-text-tertiary leading-relaxed">
                  All residual cashflow overflows into your flexible discretionary pool for guilt-free personal spending and wishlist funding.
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: 3-Period Forward Waterfall Trajectory & Cutoff Alignment */}
      <section className="space-y-3">
        <div className="text-[11px] font-sans font-medium text-text-tertiary">
          Forward 3-Cycle Waterfall &amp; Cutoff Planner
        </div>
        <div className="rounded-lg border border-border-default bg-surface overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-subtle text-[10px] font-mono text-text-tertiary">
                  <th className="text-left py-2.5 px-4">Period</th>
                  <th className="text-right py-2.5 px-4">Income</th>
                  <th className="text-right py-2.5 px-4">Debt Bills</th>
                  <th className="text-right py-2.5 px-4">Routine Quota</th>
                  <th className="text-right py-2.5 px-4">Daily Living</th>
                  <th className="text-right py-2.5 px-4">{savingsLabel}</th>
                  <th className="text-right py-2.5 px-4">{surplusLabel}</th>
                  <th className="text-right py-2.5 px-4">Debt Ratio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle font-mono tabular-nums">
                {[snapshot, next1Snapshot, next2Snapshot]
                  .filter((s): s is NonNullable<typeof s> => Boolean(s))
                  .map((s, idx) => {
                    const rPool =
                      (s.transport ?? 0) +
                      (s.internet ?? 0) +
                      (s.vape ?? 0) +
                      (s.haircut ?? 0);
                    const totalIncome = Number(s.finalTotalIncome ?? 0);
                    const totalDebt = Number(s.totalDeductions ?? 0);
                    const dRatio =
                      totalIncome > 0
                        ? Math.round((totalDebt / totalIncome) * 1000) / 10
                        : 0;
                    return (
                      <tr
                        key={`${s.year}-${s.month}-${idx}`}
                        className={idx === 0 ? "bg-surface-subtle/40" : ""}
                      >
                        <td className="py-2.5 px-4 font-medium text-text-primary">
                          {s.month}/{s.year}
                          {idx === 0 && (
                            <span className="ml-2 text-[10px] font-sans text-delta-positive">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-primary">
                          {formatRupiah(s.finalTotalIncome)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-delta-negative">
                          {formatRupiah(s.totalDeductions)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-secondary">
                          {formatRupiah(rPool)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-primary">
                          {formatRupiah(
                            s.actualDailyOperational ?? s.dailyOperational,
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right text-delta-positive">
                          {formatRupiah(s.actualSavings)}
                        </td>
                        <td className="py-2.5 px-4 text-right text-caution">
                          {formatRupiah(s.selfReward)}
                        </td>
                        <td
                          className={`py-2.5 px-4 text-right font-semibold ${
                            dRatio > 50
                              ? "text-urgency"
                              : dRatio > 35
                              ? "text-caution"
                              : "text-delta-positive"
                          }`}
                        >
                          {dRatio.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-border-subtle bg-surface-subtle/50 flex flex-wrap items-center justify-between gap-2 text-[11px] font-sans text-text-tertiary">
            <span>
              Payday Convention: Each cycle covers payday-to-payday consumption and pays obligations maturing inside that named month.
            </span>
            <span className="font-mono text-[10px]">
              {cutoffSummaryText}
            </span>
          </div>
        </div>
      </section>

      <PaydayTimelineSimulator month={month} year={year} />

      {/* SECTION 5: Interactive Living & Routine Quota Planner */}
      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary font-sans">
              Interactive Living Quota Planner ({month}/{year})
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Preview how adjusting your monthly Daily Living Pool impacts {savingsLabel}, {surplusLabel}, and work-hours needed.
            </p>
          </div>
          {isLocked && (
            <span className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded bg-surface-subtle border border-border-subtle text-[11px] font-mono text-text-tertiary">
              Period Locked (Preview Only)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">Daily Food &amp; Living Quota</span>
              <span className="font-mono font-semibold text-text-primary tabular-nums">
                {formatRupiah(quotaDraft)}
                {trueHourlyWage > 0 && (
                  <span className="text-text-tertiary ml-2 text-[11px]">
                    (~{(quotaDraft / trueHourlyWage).toFixed(1)} hrs work)
                  </span>
                )}
              </span>
            </div>
            <input
              type="range"
              min={500000}
              max={Math.max(4000000, Math.round(finalTotalIncome * 0.65))}
              step={50000}
              value={quotaDraft}
              onChange={(e) => setQuotaDraft(Math.max(0, Number(e.target.value) || 0))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                step={50000}
                value={quotaDraft}
                onChange={(e) => setQuotaDraft(Math.max(0, Number(e.target.value) || 0))}
                className="w-36 bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
              />
              <input
                type="text"
                value={quotaReason}
                onChange={(e) => setQuotaReason(e.target.value)}
                placeholder="Reason for budget revision"
                className="flex-1 bg-canvas border border-border rounded px-2.5 py-1.5 text-xs text-text-primary"
              />
            </div>
          </div>

          {(() => {
            const p1Target = snapshot?.savings ?? 1000000;
            const poolAfterDraft = finalTotalIncome - totalDeductions - routineBillsTotal - quotaDraft;
            const projDeficit = poolAfterDraft < 0 ? Math.abs(poolAfterDraft) : 0;
            const projP1 = poolAfterDraft > 0 ? Math.min(p1Target, poolAfterDraft) : 0;
            const projP2 = poolAfterDraft > p1Target ? poolAfterDraft - p1Target : 0;
            return (
              <div className="lg:col-span-5 grid grid-cols-3 gap-3 text-xs font-mono">
                <div className="rounded border border-border-subtle bg-surface-subtle p-2.5">
                  <div className="text-[10px] text-text-tertiary">Projected Savings</div>
                  <div className="text-sm font-semibold text-delta-positive mt-0.5 tabular-nums erp-tabular-currency">
                    {formatRupiah(projP1)}
                  </div>
                </div>
                <div className="rounded border border-border-subtle bg-surface-subtle p-2.5">
                  <div className="text-[10px] text-text-tertiary">Projected Surplus</div>
                  <div className="text-sm font-semibold text-caution mt-0.5 tabular-nums erp-tabular-currency">
                    {formatRupiah(projP2)}
                  </div>
                </div>
                <div className="rounded border border-border-subtle bg-surface-subtle p-2.5">
                  <div className="text-[10px] text-text-tertiary">Deficit Risk</div>
                  <div
                    className={`text-sm font-semibold mt-0.5 tabular-nums ${
                      projDeficit > 0 ? "text-urgency" : "text-delta-positive"
                    }`}
                  >
                    {formatRupiah(projDeficit)}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="lg:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={handleApplyQuotaPlan}
              disabled={isLocked || quotaSaving || !snapshot}
              className="w-full px-3 py-2 rounded erp-btn-primary text-xs font-medium hover:opacity-90 disabled:opacity-40 cursor-pointer"
            >
              {quotaSaving ? "Applying..." : "Apply Quota"}
            </button>
          </div>
        </div>

        {(quotaMsg || quotaError) && (
          <div
            className={`px-3 py-2 rounded border text-xs ${
              quotaError
                ? "border-delta-negative/40 bg-[rgba(224,108,83,0.08)] text-delta-negative"
                : "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
            }`}
          >
            {quotaError || quotaMsg}
          </div>
        )}
      </section>

      <details className="rounded-lg border border-border-subtle bg-surface overflow-hidden group">
        <summary className="px-5 py-3.5 cursor-pointer flex items-center justify-between text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-subtle/40 transition-colors">
          <span>
            Quota &amp; Target Change Log ({month}/{year}) · {revisions.length} revision(s)
          </span>
          <span className="font-mono text-[10px] text-text-tertiary">
            {snapshot?.isManualOverride ? "Manual Override Active" : "Auto-Engine Active"}
          </span>
        </summary>
        <div className="border-t border-border-subtle">
          <FormulaEngineSelectorCard />
          {revisions.length === 0 ? (
            <div className="p-5 text-xs text-text-tertiary text-center">
              No quota adjustments recorded for {month}/{year}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-subtle/50 text-[10px] font-mono text-text-tertiary border-b border-border-subtle">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2 text-right">Previous</th>
                    <th className="px-4 py-2 text-right">New Value</th>
                    <th className="px-4 py-2 text-right">Delta</th>
                    <th className="px-4 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {revisions.map((rev) => (
                    <tr key={rev.id} className="hover:bg-surface-hover/40">
                      <td className="px-4 py-2.5 font-mono text-text-tertiary whitespace-nowrap">
                        {new Date(rev.createdAt).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-text-primary whitespace-nowrap">
                        {rev.category}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right tabular-nums text-text-secondary">
                        {formatRupiah(rev.previousValue)}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-right tabular-nums text-text-primary">
                        {formatRupiah(rev.newValue)}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-mono text-right tabular-nums font-medium ${
                          rev.difference > 0 ? "text-caution" : "text-delta-positive"
                        }`}
                      >
                        {rev.difference >= 0 ? "+" : ""}
                        {formatRupiah(rev.difference)}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary">{rev.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </details>
        </div>
      )}

      {activeSub === "envelopes" && (
        <EnvelopesAndSinkingPanel intel={intel} />
      )}
    </div>
  );
}
