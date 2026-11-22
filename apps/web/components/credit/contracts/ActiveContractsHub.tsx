"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  FastForward,
  RefreshCw,
  SlidersHorizontal,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import {
  ActiveInstallmentPlanDto,
  CreditContract,
  IntelligenceBundleResponse,
  LiabilityLineItemDto,
  LiabilityMatrixResponse,
  accelerateBridgeLoan,
  fetchIntelligenceBundle,
  settleCardInstallmentEarly,
  toggleLineItemSettled,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface ActiveContractsHubProps {
  contracts: CreditContract[];
  installmentPlans?: ActiveInstallmentPlanDto[];
  matrixData?: LiabilityMatrixResponse | null;
  currentMonth: number;
  currentYear: number;
  initialIntel?: IntelligenceBundleResponse | null;
  onSelectSub?: (sub: "matrix" | "simulator") => void;
  onMutated?: () => void | Promise<void>;
}

const MONTH_SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

function nextPeriod(month: number, year: number): { month: number; year: number } {
  return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

type PlanGroupKey = "PERSONAL_SPINJAM" | "CREDIT_CARD" | "PAYLATER";

interface EnrichedPlanView {
  id: string;
  group: PlanGroupKey;
  isSpinjamPriority: boolean;
  title: string;
  merchantOrPlatform: string;
  category: string;
  principalAmount: number;
  monthlyInstallment: number;
  contractMonthlyInstallment: number;
  remainingPrincipal: number;
  remainingMonths: number;
  totalTenor: number;
  paidMonths: number;
  progressPct: number;
  sliceBadge: string | null;
  payoffMonth: number;
  payoffYear: number;
  payoffDateLabel: string;
  parentContractId: string | null;
  cardId: number | null;
  canAccelerate: boolean;
  canSettleEarly: boolean;
  matchingLineItem: LiabilityLineItemDto | null;
  isPaidForCycle: boolean;
}

export function ActiveContractsHub({
  contracts,
  installmentPlans = [],
  matrixData,
  currentMonth,
  currentYear,
  initialIntel = null,
  onSelectSub,
  onMutated,
}: ActiveContractsHubProps) {
  const searchParams = useSearchParams();
  const isSpinjamFocus = searchParams.get("focus") === "spinjam";
  const { isAmountsMasked } = usePrivacyMask();
  const formatRp = (val: number) => formatRupiah(val, isAmountsMasked);

  const [selectedMilestoneKey, setSelectedMilestoneKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Tier 5: Live Auto-Populated Snowball vs Avalanche Optimizer (defaults to Rp 1.000.000)
  const [lumpSum, setLumpSum] = useState<number>(1000000);
  const [customIntel, setCustomIntel] = useState<IntelligenceBundleResponse | null>(initialIntel);
  const [loadingIntel, setLoadingIntel] = useState<boolean>(!initialIntel);
  const [simulatedTargetTitle, setSimulatedTargetTitle] = useState<string | null>(null);
  const optimizerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingIntel(true);
    fetchIntelligenceBundle(currentMonth, currentYear, lumpSum)
      .then((res) => {
        if (active && res) setCustomIntel(res);
      })
      .finally(() => {
        if (active) setLoadingIntel(false);
      });
    return () => {
      active = false;
    };
  }, [currentMonth, currentYear]);

  const runOptimizer = async (nextAmount: number, targetTitle?: string) => {
    setLumpSum(nextAmount);
    setSimulatedTargetTitle(targetTitle ?? null);
    setLoadingIntel(true);
    try {
      const res = await fetchIntelligenceBundle(currentMonth, currentYear, nextAmount);
      if (res) setCustomIntel(res);
    } finally {
      setLoadingIntel(false);
    }
  };

  const currentKey = `${currentYear}-${currentMonth}`;
  const selectedYm = currentYear * 12 + currentMonth;
  const periodLabel = `${MONTH_SHORT[(currentMonth - 1) % 12]} '${String(currentYear).slice(2)}`;

  const lineItemsThisCycle: LiabilityLineItemDto[] = useMemo(() => {
    if (!matrixData) return [];
    const fromMap = matrixData.lineItemsPerMonth?.[currentKey] ?? [];
    if (fromMap.length > 0) return fromMap;
    return [
      ...(matrixData.payLaterRow?.cells?.[currentKey]?.items ?? []),
      ...(matrixData.personalDebtRow?.cells?.[currentKey]?.items ?? []),
    ];
  }, [matrixData, currentKey]);

  const enrichedPlans: EnrichedPlanView[] = useMemo(() => {
    if (installmentPlans.length > 0) {
      return installmentPlans
        .filter((p) => {
          if ((p.totalTenor ?? 1) <= 1) return false;
          if (p.category === "P1_VAULT_REFUND") return false;
          const payoffYm = (p.payoffYear ?? currentYear) * 12 + (p.payoffMonth ?? currentMonth);
          return payoffYm >= selectedYm;
        })
        .map((p) => {
          const slice = p.cells?.[currentKey];
          const sliceBadge = slice?.sliceBadge ?? null;
          const activeSliceAmount = slice !== undefined ? slice.amount : p.monthlyInstallment;
          const contractMonthlyInstallment =
            slice && slice.amount > 0 ? slice.amount : p.monthlyInstallment;

          const cellEntries = Object.entries(p.cells ?? {});
          let maxColYm = 0;
          let futureCellSum = 0;
          for (const [ymKey, c] of cellEntries) {
            const [cy, cm] = ymKey.split("-").map(Number);
            if (!cy || !cm) continue;
            const ym = cy * 12 + cm;
            if (ym > maxColYm) maxColYm = ym;
            if (ym >= selectedYm) {
              futureCellSum += Math.max(0, Math.round(c?.amount ?? 0));
            }
          }
          const payoffYm = (p.payoffYear ?? currentYear) * 12 + (p.payoffMonth ?? currentMonth);
          const remainingPrincipal =
            cellEntries.length > 0 && payoffYm <= maxColYm
              ? futureCellSum
              : Math.max(futureCellSum, Math.round(p.remainingPrincipal || 0));

          let remainingMonths = Math.max(
            1,
            (p.payoffYear ?? currentYear) * 12 + (p.payoffMonth ?? currentMonth) - selectedYm + 1,
          );
          let paidMonths = Math.max(0, p.totalTenor - remainingMonths);
          if (sliceBadge && sliceBadge.includes("/")) {
            const [cStr, tStr] = sliceBadge.split("/");
            const cNum = parseInt(cStr, 10);
            const tNum = parseInt(tStr, 10);
            if (!Number.isNaN(cNum) && !Number.isNaN(tNum) && tNum >= cNum) {
              remainingMonths = tNum - cNum + 1;
              paidMonths = Math.max(0, cNum - 1);
            }
          }
          const progressPct = p.totalTenor > 0 ? Math.round((paidMonths / p.totalTenor) * 100) : 0;

          const combinedLabel = `${p.title} ${p.merchantOrPlatform}`.toLowerCase();
          const isSpinjamPriority =
            p.category === "PERSONAL_DEBT" ||
            combinedLabel.includes("spinjam") ||
            combinedLabel.includes("bridge");
          const group: PlanGroupKey = isSpinjamPriority
            ? "PERSONAL_SPINJAM"
            : p.category === "CREDIT_CARD" || p.source === "CC_TRANSACTION"
              ? "CREDIT_CARD"
              : "PAYLATER";

          const matchingLineItem =
            lineItemsThisCycle.find(
              (li) =>
                (p.parentContractId && li.parentContractId === p.parentContractId) ||
                li.title.toLowerCase().includes(p.title.toLowerCase().slice(0, 14)),
            ) ?? null;

          const matchingCardItem =
            p.source === "CC_TRANSACTION" && p.cardId
              ? (matrixData?.creditCardRow?.cells?.[currentKey]?.items ?? []).find(
                  (ci) => ci.id === p.cardId,
                )
              : undefined;

          const isPaidForCycle = Boolean(
            matchingLineItem?.isSettled ||
              matchingCardItem?.isSettled ||
              matchingCardItem?.isAutoSettled,
          );

          return {
            id: p.id,
            group,
            isSpinjamPriority,
            title: p.title,
            merchantOrPlatform: p.merchantOrPlatform,
            category: p.category,
            principalAmount: p.principalAmount,
            monthlyInstallment: activeSliceAmount,
            contractMonthlyInstallment,
            remainingPrincipal,
            remainingMonths,
            totalTenor: p.totalTenor,
            paidMonths,
            progressPct,
            sliceBadge,
            payoffMonth: p.payoffMonth,
            payoffYear: p.payoffYear,
            payoffDateLabel: p.payoffDateLabel,
            parentContractId: p.parentContractId ?? null,
            cardId: p.cardId ?? null,
            canAccelerate: Boolean(p.canAccelerate && p.parentContractId && remainingMonths > 1),
            canSettleEarly: Boolean(p.canSettleEarly && p.cardId && remainingMonths > 1),
            matchingLineItem,
            isPaidForCycle,
          };
        })
        .sort((a, b) => {
          const order: Record<PlanGroupKey, number> = {
            PERSONAL_SPINJAM: 0,
            CREDIT_CARD: 1,
            PAYLATER: 2,
          };
          if (order[a.group] !== order[b.group]) return order[a.group] - order[b.group];
          return b.remainingPrincipal - a.remainingPrincipal;
        });
    }

    return contracts
      .filter((c) => (c.totalTenor ?? 1) > 1 && c.isActive)
      .map((c) => ({
        id: String(c.id),
        group: "CREDIT_CARD" as PlanGroupKey,
        isSpinjamPriority: /spinjam|bridge/i.test(c.label),
        title: c.label,
        merchantOrPlatform: "Credit Facility",
        category: "CREDIT_CARD",
        principalAmount: c.principalAmount,
        monthlyInstallment: c.monthlyInstallment,
        contractMonthlyInstallment: c.monthlyInstallment,
        remainingPrincipal: Math.round(c.remainingPrincipal ?? c.remainingTenor * c.monthlyInstallment),
        remainingMonths: c.remainingTenor,
        totalTenor: c.totalTenor,
        paidMonths: Math.max(0, c.totalTenor - c.remainingTenor),
        progressPct: c.tenorProgressPercent ?? 0,
        sliceBadge: null,
        payoffMonth: currentMonth,
        payoffYear: currentYear,
        payoffDateLabel: c.payoffDateLabel || "-",
        parentContractId: null,
        cardId: null,
        canAccelerate: false,
        canSettleEarly: false,
        matchingLineItem: null,
        isPaidForCycle: false,
      }));
  }, [installmentPlans, contracts, currentKey, currentMonth, currentYear, selectedYm, lineItemsThisCycle, matrixData]);

  // Tier 2 Summary KPIs
  const totalRemainingPrincipal = useMemo(
    () => enrichedPlans.reduce((sum, p) => sum + p.remainingPrincipal, 0),
    [enrichedPlans],
  );
  const activeMonthlyCommitment = useMemo(
    () =>
      enrichedPlans
        .filter((p) => p.sliceBadge !== null || p.remainingMonths > 0)
        .reduce((sum, p) => sum + p.monthlyInstallment, 0),
    [enrichedPlans],
  );

  // Tier 3 Cashflow Freed Up Horizon (cycle AFTER payoffMonth/payoffYear)
  const freedMilestones = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        label: string;
        freedMonthly: number;
        planIds: string[];
        titles: string[];
      }
    >();

    for (const p of enrichedPlans) {
      if (!p.payoffMonth || !p.payoffYear) continue;
      const unlock = nextPeriod(p.payoffMonth, p.payoffYear);
      const key = `${unlock.year}-${String(unlock.month).padStart(2, "0")}`;
      const label = `${MONTH_SHORT[(unlock.month - 1) % 12]} '${String(unlock.year).slice(2)}`;
      const cur = map.get(key) ?? {
        key,
        label,
        freedMonthly: 0,
        planIds: [],
        titles: [],
      };
      cur.freedMonthly += Math.round(p.contractMonthlyInstallment || p.monthlyInstallment);
      cur.planIds.push(p.id);
      cur.titles.push(p.title);
      map.set(key, cur);
    }

    const ordered = Array.from(map.values()).sort((a, b) => (a.key < b.key ? -1 : 1));
    let cumulative = 0;
    return ordered.map((m) => {
      cumulative += m.freedMonthly;
      return { ...m, cumulative };
    });
  }, [enrichedPlans]);

  const highlightedPlanIds = useMemo(() => {
    if (!selectedMilestoneKey) return null;
    const hit = freedMilestones.find((m) => m.key === selectedMilestoneKey);
    return hit ? new Set(hit.planIds) : null;
  }, [selectedMilestoneKey, freedMilestones]);

  const finalFreedomLabel = useMemo(() => {
    if (enrichedPlans.length === 0) return "Debt-Free Now";
    let bestYm = 0;
    let bestLabel = enrichedPlans[0].payoffDateLabel;
    for (const p of enrichedPlans) {
      const ym = p.payoffYear * 12 + p.payoffMonth;
      if (ym > bestYm) {
        bestYm = ym;
        bestLabel = p.payoffDateLabel;
      }
    }
    return bestLabel;
  }, [enrichedPlans]);

  const hasSpinjamActive = enrichedPlans.some((p) => p.group === "PERSONAL_SPINJAM");

  const handleTogglePaidCycle = async (plan: EnrichedPlanView) => {
    if (!plan.matchingLineItem) return;
    setBusyKey(`paid:${plan.id}`);
    setFeedbackMsg(null);
    const nextSettled = !plan.matchingLineItem.isSettled;
    const res = await toggleLineItemSettled(plan.matchingLineItem.id, nextSettled);
    setBusyKey(null);
    if (res.success) {
      setFeedbackMsg({
        ok: true,
        text: `${plan.title} marked as ${nextSettled ? "paid" : "pending"} for ${periodLabel}.`,
      });
      await onMutated?.();
    } else {
      setFeedbackMsg({ ok: false, text: res.error || "Failed to update cycle payment status." });
    }
  };

  const handleAccelerate = async (plan: EnrichedPlanView) => {
    setBusyKey(`accel:${plan.id}`);
    setFeedbackMsg(null);
    if (plan.canAccelerate && plan.parentContractId) {
      const res = await accelerateBridgeLoan({
        parentContractId: plan.parentContractId,
        targetMonth: currentMonth,
        targetYear: currentYear,
      });
      setBusyKey(null);
      if (res.success) {
        setFeedbackMsg({
          ok: true,
          text: `${plan.title} remaining balance compressed into ${periodLabel}.`,
        });
        await onMutated?.();
      } else {
        setFeedbackMsg({ ok: false, text: res.error || "Failed to accelerate contract." });
      }
      return;
    }

    if (plan.canSettleEarly && plan.cardId) {
      const res = await settleCardInstallmentEarly(plan.cardId, {
        month: currentMonth,
        year: currentYear,
        settlementMode: "LUMP_SUM_CURRENT_PERIOD",
      });
      setBusyKey(null);
      if (res.success) {
        setFeedbackMsg({
          ok: true,
          text: `${plan.title} accelerated into ${periodLabel} card bill.`,
        });
        await onMutated?.();
      } else {
        setFeedbackMsg({ ok: false, text: res.error || "Failed to accelerate card installment." });
      }
    } else {
      setBusyKey(null);
    }
  };

  const handleSimulateEarlyClose = (plan: EnrichedPlanView) => {
    const exactRemaining = Math.max(50000, plan.remainingPrincipal);
    void runOptimizer(exactRemaining, plan.title);
    optimizerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const rawGroups: Array<{
    key: PlanGroupKey;
    title: string;
    subtitle: string;
    plans: EnrichedPlanView[];
  }> = [
    {
      key: "PERSONAL_SPINJAM",
      title: "1. Personal & Bridge Loans (Priority Interest)",
      subtitle: "Carries active compounding interest (~2.95%-3.5%/mo) - clear these first before 0% promos.",
      plans: enrichedPlans.filter((p) => p.group === "PERSONAL_SPINJAM"),
    },
    {
      key: "CREDIT_CARD",
      title: "2. Bank Permata Credit Card Installments",
      subtitle: "Multi-month card charges due on the 11th (statement closes 25th; pay H-1 working day if weekend/holiday).",
      plans: enrichedPlans.filter((p) => p.group === "CREDIT_CARD"),
    },
    {
      key: "PAYLATER",
      title: "3. SPayLater Multi-Month Plans",
      subtitle: "Scheduled multi-cycle SPayLater obligations due on the 25th (dynamic M-15d cutoff: 15th/16th).",
      plans: enrichedPlans.filter((p) => p.group === "PAYLATER"),
    },
  ];
  const groups = rawGroups.filter((g) => g.plans.length > 0);
  const spinjamGroup = groups.find((g) => g.key === "PERSONAL_SPINJAM") ?? null;
  const spinjamMonthlyTotal = spinjamGroup
    ? spinjamGroup.plans.reduce((s, p) => s + p.monthlyInstallment, 0)
    : 0;
  const spinjamScheduledMonthlyTotal = spinjamGroup
    ? spinjamGroup.plans.reduce((s, p) => s + (p.contractMonthlyInstallment || p.monthlyInstallment), 0)
    : 0;
  const spinjamRemainingTotal = spinjamGroup
    ? spinjamGroup.plans.reduce((s, p) => s + p.remainingPrincipal, 0)
    : 0;

  const opt = customIntel?.debtopt ?? null;

  return (
    <div className="space-y-6 w-full max-w-full">
      {isSpinjamFocus && spinjamGroup && (
        <div className="rounded-lg erp-callout-caution px-5 py-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-amber-300 font-semibold">
                Focused View: Priority Loan Tracker
              </div>
              <h2 className="text-sm font-semibold text-text-primary mt-0.5">
                {spinjamGroup.plans.length} active SPinjam obligations (
                {spinjamMonthlyTotal > 0
                  ? `${formatRp(spinjamMonthlyTotal)}/cycle in ${periodLabel}`
                  : `${formatRp(spinjamScheduledMonthlyTotal)}/mo starting next cycle`}
                )
              </h2>
            </div>
            <div className="text-right font-mono tabular-nums">
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                Remaining Principal
              </div>
              <div className="text-sm font-semibold text-text-primary">
                {formatRp(spinjamRemainingTotal)}
              </div>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            Due days fall on the 8th, 17th, 23rd, and 24th of each cycle. Clearing these first permanently unlocks compounding cashflow relief.
          </p>
        </div>
      )}

      {/* TIER 1: GUIDED HEADER & NAVIGATION ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface px-5 py-4">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Active Installment Plans · {periodLabel}
          </div>
          <h2 className="text-base font-semibold text-text-primary mt-0.5">
            {enrichedPlans.length} Active Multi-Month Obligations (Excludes 1/1 &amp; Savings Repayments)
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Track personal loans (due 8th / 17th / 23rd / 24th), credit card, and PayLater payoff dates, settle slices, and simulate early payoffs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onSelectSub && (
            <>
              <button
                type="button"
                onClick={() => onSelectSub("matrix")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-surface-subtle hover:bg-surface-hover text-xs font-medium text-text-primary cursor-pointer"
              >
                <span>Open 12-Month Matrix</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectSub("simulator")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-canvas hover:bg-surface-hover text-xs font-medium text-text-secondary hover:text-text-primary cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Affordability Simulator</span>
              </button>
            </>
          )}
        </div>
      </div>

      {feedbackMsg && (
        <div
          className={`px-4 py-2.5 rounded border text-xs font-mono ${
            feedbackMsg.ok
              ? "border-delta-positive/40 bg-[rgba(16,183,141,0.08)] text-delta-positive"
              : "border-urgency/40 bg-[rgba(255,56,56,0.08)] text-urgency"
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* TIER 2: ASYMMETRIC SUMMARY KPIs (Serif display strictly on centerpiece KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        <div className="md:col-span-5 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Total Remaining Principal
          </div>
          <div className="font-display text-3xl font-normal tracking-tight text-text-primary mt-2 tabular-nums">
            {formatRp(totalRemainingPrincipal)}
          </div>
          <div className="text-xs text-text-tertiary mt-2">
            Across {enrichedPlans.length} active multi-month plans from {periodLabel} onward
          </div>
        </div>

        <div className="md:col-span-3 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Monthly Installment Commitment
          </div>
          <div className="font-mono text-2xl font-semibold tracking-tight text-text-primary mt-2 tabular-nums">
            {formatRp(activeMonthlyCommitment)}
          </div>
          <div className="text-xs text-text-tertiary mt-2">
            Combined recurring installment slices in active plans
          </div>
        </div>

        <div className="md:col-span-4 rounded-lg border border-border bg-surface p-5 flex flex-col justify-between">
          <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
            Debt Freedom Horizon
          </div>
          <div className="font-display text-3xl font-normal tracking-tight text-delta-positive mt-2">
            {finalFreedomLabel}
          </div>
          <div className="text-xs text-text-tertiary mt-2">
            {freedMilestones.length > 0
              ? `Next relief in ${freedMilestones[0].label}: +${formatRp(freedMilestones[0].freedMonthly)}/mo`
              : "All active installments clear within the current window"}
          </div>
        </div>
      </div>

      {/* TIER 3: INTERACTIVE CASHFLOW FREED UP HORIZON */}
      {freedMilestones.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-delta-positive font-semibold">
                Cashflow Freed Up Horizon
              </div>
              <p className="text-xs text-text-secondary mt-0.5">
                Click any payoff unlock cycle below to highlight the contracts expiring into that monthly relief.
              </p>
            </div>
            {selectedMilestoneKey && (
              <button
                type="button"
                onClick={() => setSelectedMilestoneKey(null)}
                className="px-2.5 py-1 rounded border border-border text-[11px] font-mono text-text-secondary hover:text-text-primary cursor-pointer"
              >
                Clear highlight
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {freedMilestones.slice(0, 8).map((m) => {
              const selected = selectedMilestoneKey === m.key;
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setSelectedMilestoneKey(selected ? null : m.key)}
                  className={`text-left rounded border px-3.5 py-2.5 transition-colors cursor-pointer space-y-1 ${
                    selected
                      ? "border-delta-positive bg-[rgba(16,183,141,0.10)]"
                      : "border-border-subtle bg-surface-subtle/50 hover:border-border-strong"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="font-semibold text-text-primary">{m.label}</span>
                    <span className="text-delta-positive font-semibold tabular-nums">
                      +{formatRp(m.freedMonthly)}/mo
                    </span>
                  </div>
                  <div className="text-[11px] text-text-tertiary truncate" title={m.titles.join(", ")}>
                    {m.titles.join(" · ")}
                  </div>
                  <div className="text-[10px] font-mono text-text-secondary tabular-nums">
                    Cumulative relief: +{formatRp(m.cumulative)}/mo
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TIER 4: GROUPED CONTRACT CARDS (SPinjam/Bridge Loans First) */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center space-y-1.5">
          <div className="text-sm font-medium text-text-primary">
            No Active Multi-Month Contracts for {periodLabel}
          </div>
          <p className="text-xs text-text-tertiary max-w-md mx-auto">
            Single-period bills appear directly inside the 12-Month Matrix and Daily Pacing settlement ledger.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((grp) => (
            <section key={grp.key} className="space-y-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
                <div>
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-text-primary">
                    {grp.title} ({grp.plans.length})
                  </h3>
                  <p className="text-xs text-text-tertiary mt-0.5">{grp.subtitle}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {grp.plans.map((plan) => {
                  const isHighlighted = highlightedPlanIds ? highlightedPlanIds.has(plan.id) : false;
                  const isDimmed = Boolean(highlightedPlanIds && !isHighlighted);
                  const isBusy =
                    busyKey === `paid:${plan.id}` || busyKey === `accel:${plan.id}`;

                  return (
                    <div
                      key={plan.id}
                      className={`rounded-lg p-4 space-y-3 transition-opacity ${
                        isHighlighted
                          ? "erp-callout-positive"
                          : plan.isSpinjamPriority
                            ? "erp-callout-caution"
                            : "border border-border bg-surface"
                      } ${isDimmed ? "opacity-45" : "opacity-100"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-text-primary truncate">
                            {plan.title}
                          </div>
                          <div className="text-[11px] font-mono text-text-tertiary mt-0.5">
                            {plan.merchantOrPlatform}
                            {plan.sliceBadge ? ` · Cycle slice ${plan.sliceBadge}` : ` · ${plan.remainingMonths}m left`}
                            {` · Payoff ${plan.payoffDateLabel}`}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-sm font-mono font-semibold text-text-primary tabular-nums">
                            {formatRp(plan.monthlyInstallment > 0 ? plan.monthlyInstallment : plan.contractMonthlyInstallment)}/mo
                          </div>
                          <div className="text-[11px] font-mono text-text-tertiary tabular-nums">
                            Rem: {formatRp(plan.remainingPrincipal)}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-mono text-text-secondary">
                          <span>
                            {plan.paidMonths}/{plan.totalTenor} installments cleared
                          </span>
                          <span>{plan.progressPct}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded bg-surface-subtle overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              plan.isPaidForCycle ? "bg-delta-positive" : "bg-text-primary"
                            }`}
                            style={{ width: `${Math.max(4, plan.progressPct)}%` }}
                          />
                        </div>
                      </div>

                      {/* Contract Actions */}
                      <div className="pt-2 border-t border-border-subtle flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {plan.matchingLineItem ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleTogglePaidCycle(plan)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono cursor-pointer transition-colors disabled:opacity-50 ${
                                plan.matchingLineItem.isSettled
                                  ? "border-delta-positive/50 bg-[rgba(16,183,141,0.10)] text-delta-positive"
                                  : "border-border bg-surface-subtle hover:bg-surface-hover text-text-primary"
                              }`}
                            >
                              {plan.matchingLineItem.isSettled ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : (
                                <Circle className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {plan.matchingLineItem.isSettled
                                  ? `Paid (${periodLabel})`
                                  : `Mark Paid (${periodLabel})`}
                              </span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono text-text-tertiary">
                              {plan.isPaidForCycle ? `Settled (${periodLabel})` : `Scheduled (${periodLabel})`}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSimulateEarlyClose(plan)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-canvas hover:bg-surface-hover text-[11px] font-mono text-text-secondary hover:text-text-primary cursor-pointer"
                          >
                            <span>Simulate Early Close</span>
                          </button>

                          {(plan.canAccelerate || plan.canSettleEarly) && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => void handleAccelerate(plan)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded erp-btn-primary hover:opacity-90 text-[11px] font-mono font-medium cursor-pointer disabled:opacity-50"
                            >
                              <FastForward className="w-3 h-3" />
                              <span>Accelerate to {periodLabel}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* TIER 5: LIVE AUTO-POPULATED SNOWBALL VS AVALANCHE PAYOFF OPTIMIZER */}
      <div ref={optimizerRef} className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
              Live Snowball vs Avalanche Prepayment Simulator
            </div>
            <h3 className="text-sm font-semibold text-text-primary mt-0.5">
              Extra One-Time Prepayment Impact
              {simulatedTargetTitle ? ` · Focused on "${simulatedTargetTitle}"` : ""}
            </h3>
            <p className="text-xs text-text-tertiary mt-0.5">
              Auto-computed from active liabilities with extra surplus (default Rp 1.000.000) to measure monthly cashflow unlocks.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="optimizer-lump-sum" className="sr-only">
              Extra prepayment amount in Rupiah
            </label>
            <input
              id="optimizer-lump-sum"
              type="number"
              min={0}
              step={250000}
              value={lumpSum}
              onChange={(e) => setLumpSum(Math.max(0, Number(e.target.value) || 0))}
              className="w-40 bg-canvas border border-border rounded px-2.5 py-1.5 font-mono text-xs text-text-primary"
            />
            <button
              type="button"
              onClick={() => void runOptimizer(lumpSum, simulatedTargetTitle ?? undefined)}
              disabled={loadingIntel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded erp-btn-primary text-xs font-medium hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingIntel ? "animate-spin" : ""}`} />
              <span>Simulate Prepayment</span>
            </button>
          </div>
        </div>

        {hasSpinjamActive && (
          <div className="flex items-start gap-2.5 rounded erp-callout-caution px-3.5 py-2.5 text-xs text-text-secondary">
            <AlertTriangle className="w-4 h-4 text-caution shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-text-primary">High-Interest Priority Loan Note:</span>{" "}
              Active personal &amp; bridge facilities accrue high monthly interest (~2.95%–3.5%/mo), whereas 0% promo installments incur zero incremental carry. Under Avalanche, direct surplus to high-interest loans first before accelerating 0% installments.
            </div>
          </div>
        )}

        {opt ? (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle border-y border-border-subtle py-3 gap-4">
            {opt.strategies.map((st, idx) => (
              <div
                key={st.strategy}
                className={`space-y-2 ${idx > 0 ? "pt-3 md:pt-0 md:pl-4" : "md:pr-4"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text-primary">{st.strategy}</span>
                  <span className="font-mono text-xs text-delta-positive tabular-nums">
                    +{formatRp(st.immediateFreedMonthlyRp)}/mo freed
                  </span>
                </div>
                <p className="text-[11px] text-text-tertiary leading-relaxed">{st.summary}</p>
                <div className="pt-1.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-text-secondary">Interest Saved:</span>
                  <span className="text-delta-positive font-semibold tabular-nums">
                    {formatRp(st.estimatedInterestSavedRp)} ({st.monthsShaved}m shaved)
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-xs font-mono text-text-tertiary py-4">
            {loadingIntel
              ? "Computing Snowball vs Avalanche prepayment trajectories..."
              : "No multi-contract payoff schedule available."}
          </div>
        )}
      </div>
    </div>
  );
}
