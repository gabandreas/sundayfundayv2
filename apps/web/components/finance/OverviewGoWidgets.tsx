"use client";

import React from "react";
import { IntelligenceBundleResponse } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { useLanguage } from "@/context/LanguageContext";
import { Activity, CalendarClock, HelpCircle, ShieldAlert, TrendingUp } from "lucide-react";

const SHORT_MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtShortIso(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${SHORT_MON[m - 1]} ${y}`;
}

export function OverviewExecutiveRibbon({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t, language } = useLanguage();

  if (!intel) return null;
  const { paycycle, networth, envelopes, forecaster, anomaly, dynamicMilestone } = intel;

  const isPrePayday = paycycle.cycleTemporalState === "PRE_PAYDAY";
  const isCompleted = paycycle.cycleTemporalState === "COMPLETED";

  const velocityColor = isPrePayday
    ? "text-text-secondary border-border bg-surface-subtle"
    : anomaly.velocityStatus === "BURNING_FAST"
      ? "text-urgency border-[rgba(255,56,56,0.35)] bg-[rgba(255,56,56,0.08)]"
      : anomaly.velocityStatus === "CAUTION"
        ? "text-caution border-[rgba(229,155,44,0.35)] bg-[rgba(229,155,44,0.08)]"
        : "text-delta-positive border-[rgba(16,183,141,0.3)] bg-[rgba(16,183,141,0.08)]";

  const velocityLabel = isPrePayday
    ? `Starts ${fmtShortIso(paycycle.paydayIso)}`
    : isCompleted
      ? "Cycle Closed"
      : anomaly.velocityStatus === "BURNING_FAST"
        ? t("intel.paceHigh")
        : anomaly.velocityStatus === "CAUTION"
          ? t("intel.paceCaution")
          : t("intel.paceNormal");

  const milestoneTitle = dynamicMilestone
    ? language === "ID"
      ? dynamicMilestone.labelId
      : language === "ZH"
        ? dynamicMilestone.labelZh
        : dynamicMilestone.labelEn
    : t("intel.debtFreedom");

  return (
    <div className="w-full rounded-lg border border-border bg-surface p-3.5 sm:px-5 flex flex-wrap items-center justify-between gap-4">
      {/* Paycycle Horizon Window */}
      <div className="flex items-center gap-3 min-w-[240px]">
        <CalendarClock className="w-4 h-4 text-text-tertiary shrink-0" />
        <div>
          <div className="text-[10px] font-mono text-text-tertiary">
            {t("intel.paycycleWindow")} · {paycycle.periodCode}
          </div>
          <div className="text-xs font-medium text-text-primary font-mono tabular-nums mt-0.5">
            {fmtShortIso(paycycle.paydayIso)} – {fmtShortIso(paycycle.livingEndIso)}{" "}
            <span className="text-text-tertiary font-sans">
              · {SHORT_MON[(paycycle.maturityMonth - 1) % 12]} {paycycle.maturityYear} {t("intel.maturitiesLabel")}
            </span>
          </div>
        </div>
      </div>

      {/* Key Executive Metrics */}
      <div className="flex flex-wrap items-center gap-5 sm:gap-7">
        <div title={t("intel.cashVsDebtHint")}>
          <div className="text-[10px] font-mono text-text-tertiary inline-flex items-center gap-1">
            <span>{t("intel.realNetWorth")}</span>
            <HelpCircle className="w-3 h-3 text-text-tertiary/70" />
          </div>
          <div
            className={`text-sm font-semibold font-mono tabular-nums ${
              networth.totalNetWorthRp >= 0 ? "text-delta-positive" : "text-delta-negative"
            }`}
          >
            {networth.totalNetWorthRp >= 0 ? "+" : ""}
            {formatRupiah(networth.totalNetWorthRp, isAmountsMasked)}
          </div>
        </div>

        <div title={t("intel.savingsRunwayHint")}>
          <div className="text-[10px] font-mono text-text-tertiary inline-flex items-center gap-1">
            <span>{t("intel.ageOfMoney")}</span>
            <HelpCircle className="w-3 h-3 text-text-tertiary/70" />
          </div>
          <div className="text-sm font-semibold font-mono tabular-nums text-text-primary">
            {envelopes.ageOfMoneyDays}d{" "}
            <span className="text-[11px] font-normal text-text-tertiary">
              ({envelopes.bufferDays}d {t("intel.bufferDays")})
            </span>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-mono text-text-tertiary">{milestoneTitle}</div>
          <div className="text-sm font-semibold font-mono tabular-nums text-text-primary">
            {dynamicMilestone?.targetDateLabel ?? forecaster.spinjamFreedomDate}
          </div>
        </div>

        <div title={t("intel.burnVelocityHint")}>
          <div className="text-[10px] font-mono text-text-tertiary">{t("intel.burnVelocity")}</div>
          <span
            className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 mt-0.5 rounded border text-[11px] font-mono font-medium ${velocityColor}`}
          >
            <Activity className="w-3 h-3" />
            {isPrePayday
              ? `Day 0 · ${velocityLabel}`
              : `${anomaly.burnVelocityIndex.toFixed(2)}x · ${velocityLabel}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export function OverviewIntelligenceStrip({
  intel,
}: {
  intel: IntelligenceBundleResponse | null;
}) {
  const { isAmountsMasked } = usePrivacyMask();
  const { t, language } = useLanguage();

  if (!intel) return null;
  const { paycycle, networth, anomaly, debtopt, forecaster, studioConfig, dynamicMilestone } = intel;
  const isPrePayday = paycycle.cycleTemporalState === "PRE_PAYDAY";

  const accounts = intel.effectiveAssetAccounts ?? studioConfig.assetAccountsTable;
  const firstUnlock = debtopt.unlockMilestones[0];
  const milestoneTitle = dynamicMilestone
    ? language === "ID"
      ? dynamicMilestone.labelId
      : language === "ZH"
        ? dynamicMilestone.labelZh
        : dynamicMilestone.labelEn
    : t("intel.debtFreedom");

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Card 1 (5 cols): Cash & Savings vs. Remaining Debt (Centerpiece Serif) */}
      <div className="lg:col-span-5 rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span
            title={t("intel.cashVsDebtHint")}
            className="text-[11px] font-semibold text-text-tertiary font-sans inline-flex items-center gap-1.5"
          >
            <span>{t("intel.cashVsDebtTitle")}</span>
            <HelpCircle className="w-3.5 h-3.5 text-text-tertiary/70 shrink-0" />
          </span>
          <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
            {networth.assetToDebtCoveragePct.toFixed(1)}% Cover
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-4">
            <div className="font-serif text-2xl text-text-primary tabular-nums">
              {formatRupiah(networth.totalAssetsRp, isAmountsMasked)}
            </div>
            <span className="text-xs font-mono text-delta-negative tabular-nums">
              vs {formatRupiah(networth.totalUnpaidDebtRp, isAmountsMasked)} debt
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-text-tertiary tabular-nums">
            <span>
              Cycle Due: {formatRupiah(networth.currentCycleDebtRp ?? networth.totalUnpaidDebtRp, isAmountsMasked)}
            </span>
            <span>
              Future Principal: {formatRupiah(networth.futureInstallmentPrincipalRp ?? 0, isAmountsMasked)}
            </span>
          </div>
        </div>
        <div className="space-y-1.5 pt-2 border-t border-border-subtle">
          {accounts.slice(0, 4).map((acc) => (
            <div key={acc.id} className="flex items-center justify-between text-xs">
              <span className="text-text-secondary truncate pr-2">{acc.name}</span>
              <span className="font-mono text-text-primary tabular-nums shrink-0">
                {formatRupiah(acc.balanceRp, isAmountsMasked)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2 (4 cols): Daily Spending Pace & Next-Cycle Charges (Tabular Mono) */}
      <div className="lg:col-span-4 rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span
            title={t("intel.paceAndCreepHint")}
            className="text-[11px] font-semibold text-text-tertiary font-sans inline-flex items-center gap-1.5"
          >
            <span>{t("intel.paceAndCreepTitle")}</span>
            <HelpCircle className="w-3.5 h-3.5 text-text-tertiary/70 shrink-0" />
          </span>
          <ShieldAlert className="w-4 h-4 text-text-tertiary" />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-xl font-semibold text-text-primary tabular-nums">
            {isPrePayday ? `Opens ${fmtShortIso(paycycle.paydayIso)}` : `${anomaly.burnVelocityIndex.toFixed(2)}x`}
          </div>
          <span className="text-xs font-mono text-text-tertiary tabular-nums">
            {isPrePayday
              ? `Day 0 · starts in ${paycycle.daysUntilCycleStart ?? 0}d`
              : `${anomaly.pctBudgetConsumed.toFixed(1)}% spent / ${anomaly.pctCycleElapsed.toFixed(1)}% elapsed`}
          </span>
        </div>
        <div className="flex items-center justify-between text-xs pt-2 border-t border-border-subtle">
          <span className="text-text-secondary">{t("intel.postCutoffCreep")}</span>
          <span className="font-mono font-medium text-caution tabular-nums">
            {formatRupiah(anomaly.postCutoffCreepRp, isAmountsMasked)}
          </span>
        </div>
        <div className="space-y-1 text-xs text-text-secondary">
          {anomaly.alerts.length === 0 ? (
            <div className="text-delta-positive">{t("intel.noAnomalies")}</div>
          ) : (
            anomaly.alerts.slice(0, 2).map((al, i) => (
              <div key={i} className="truncate text-[11px] text-text-secondary">
                • <span className="font-medium text-text-primary">{al.title}:</span> {al.description}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 3 (3 cols): Upcoming Monthly Relief (Tabular Mono) */}
      <div className="lg:col-span-3 rounded-lg border border-border bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span
            title={t("intel.nextUnlockHint")}
            className="text-[11px] font-semibold text-text-tertiary font-sans inline-flex items-center gap-1.5"
          >
            <span>{t("intel.nextUnlock")}</span>
            <HelpCircle className="w-3.5 h-3.5 text-text-tertiary/70 shrink-0" />
          </span>
          <TrendingUp className="w-4 h-4 text-delta-positive" />
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="font-mono text-xl font-semibold text-delta-positive tabular-nums">
            {firstUnlock
              ? `+${formatRupiah(firstUnlock.freedMonthlyRp, isAmountsMasked)}/mo`
              : formatRupiah(0, isAmountsMasked)}
          </div>
          <span className="text-xs font-mono text-text-secondary">
            {firstUnlock ? firstUnlock.unlockLabel : dynamicMilestone?.targetDateLabel ?? forecaster.spinjamFreedomDate}
          </span>
        </div>
        <div className="text-xs text-text-secondary leading-relaxed">
          {milestoneTitle}:{" "}
          <span className="font-mono text-text-primary font-medium">
            {dynamicMilestone?.targetDateLabel ?? forecaster.spinjamFreedomDate}
          </span>{" "}
          {debtopt.spinjamMonthlyTotalRp > 0
            ? `(Priority Loan ${formatRupiah(debtopt.spinjamMonthlyTotalRp, isAmountsMasked)}/mo). `
            : "· "}
          {t("intel.ageOfMoney")}:{" "}
          <span className="font-mono text-text-primary font-medium">{forecaster.pureSurvivalRunwayDays}d</span>.
        </div>
        {debtopt.unlockMilestones.length > 0 && (
          <div className="pt-1 border-t border-border-subtle space-y-1">
            {debtopt.unlockMilestones.slice(0, 2).map((ms) => (
              <div key={ms.unlockLabel} className="flex items-center justify-between text-[11px]">
                <span className="text-text-tertiary truncate pr-2">
                  {ms.unlockLabel} ({ms.finishedContracts.length})
                </span>
                <span className="font-mono text-delta-positive tabular-nums shrink-0">
                  +{formatRupiah(ms.freedMonthlyRp, isAmountsMasked)}/mo
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
