"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  GlobalConfig,
  IntelligenceBundleResponse,
  MonthlySnapshot,
  PayrollResult,
  fetchGlobalConfig,
  fetchIntelligenceBundle,
  fetchPayroll,
  fetchSnapshot,
  getCached,
  setCached,
} from "@/lib/api";
import { usePeriodSlice } from "@/hooks/usePeriodSlice";
import { useSubModule } from "@/hooks/useSubModule";
import { PAYROLL_SUB_KEYS, PayrollSubKey } from "@/lib/tabs";
import { useLanguage } from "@/context/LanguageContext";
import { usePeriod } from "@/context/PeriodContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { PageHeader } from "@/components/primitives/PageHeader";
import { SubModuleNav } from "@/components/primitives/SubModuleNav";
import { TrueHourlyLifeEnergyPanel } from "@/components/finance/ModuleGoPanels";
import { PayrollStatementTable } from "@/components/payroll/PayrollStatementTable";
import { PayrollCashflowHighlights } from "@/components/payroll/PayrollCashflowHighlights";
import { PayrollAdjustmentForm } from "@/components/payroll/PayrollAdjustmentForm";
import { PayrollArchetypeSelector } from "@/components/payroll/PayrollArchetypeSelector";
import { ContractualBaseRateEditor } from "@/components/payroll/ContractualBaseRateEditor";
import { QuickIncomeForm } from "@/components/payroll/QuickIncomeForm";
import { ThrBonusEstimatorCard } from "@/components/payroll/ThrBonusEstimatorCard";
import { PaydayTimelineSimulator } from "@/components/finance/PaydayTimelineSimulator";
import { PreBoundaryNotice } from "@/components/shell/PreBoundaryNotice";

export interface PayrollPeriodData {
  snapshot: MonthlySnapshot | null;
  payroll: PayrollResult | null;
  config: GlobalConfig | null;
}

interface PayrollClientViewProps {
  initialMonth: number;
  initialYear: number;
  initialData: PayrollPeriodData;
}

export function PayrollClientView({
  initialMonth,
  initialYear,
  initialData,
}: PayrollClientViewProps) {
  const { t } = useLanguage();
  const { refreshPeriod } = usePeriod();
  const { isBespokeWorkspace, isModuleEnabled } = usePerspective();
  const showCorporatePayroll = isBespokeWorkspace || isModuleEnabled("corporate_payroll");
  const [activeSub, selectSub] = useSubModule<PayrollSubKey>(PAYROLL_SUB_KEYS, "payslip");
  const [intel, setIntel] = useState<IntelligenceBundleResponse | null>(null);
  const [showManualThrEstimator, setShowManualThrEstimator] = useState(false);
  const { month, year, data, isPreBoundary } =
    usePeriodSlice<PayrollPeriodData>({
      initialMonth,
      initialYear,
      initialData,
      seedCache: (m, y, d) => {
        if (d.snapshot) setCached(`snapshot:${m}:${y}`, d.snapshot);
        if (d.payroll) setCached(`payroll:${m}:${y}`, d.payroll);
        if (d.config) setCached("globalConfig", d.config);
      },
      readFromCache: (m, y, prev) => {
        const snapshot = getCached<MonthlySnapshot | null>(`snapshot:${m}:${y}`);
        const payroll = getCached<PayrollResult | null>(`payroll:${m}:${y}`);
        if (snapshot === undefined || payroll === undefined) return undefined;
        const config = getCached<GlobalConfig | null>("globalConfig") ?? prev.config;
        return { snapshot, payroll, config };
      },
      fetchForPeriod: async (m, y) => {
        const [snapshot, payroll, config] = await Promise.all([
          fetchSnapshot(m, y),
          fetchPayroll(m, y),
          fetchGlobalConfig(),
        ]);
        if (config) setCached("globalConfig", config);
        return { snapshot, payroll, config };
      },
    });

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

  useEffect(() => {
    setShowManualThrEstimator(false);
  }, [month, year]);

  if (isPreBoundary) {
    return <PreBoundaryNotice month={month} year={year} />;
  }

  const { snapshot, payroll, config } = data;
  const isLocked = snapshot?.status === "LOCKED";
  const finalTotalIncome =
    payroll?.finalTotalIncome ?? snapshot?.finalTotalIncome ?? 0;
  const netSalaryIncome =
    payroll?.netSalaryIncome ?? snapshot?.netSalaryIncome ?? 0;
  const directPayrollDeductions =
    payroll?.directPayrollDeductions ?? snapshot?.directPayrollDeductions ?? 0;
  const bankTakeHomeSalary =
    payroll?.bankTakeHomeSalary ?? Math.max(0, netSalaryIncome - directPayrollDeductions);
  const extraIncome = payroll?.extraIncome ?? snapshot?.extraIncome ?? 0;
  const workingDays =
    payroll?.totalWorkingDays ?? snapshot?.totalWorkingDays ?? 0;
  const thrConfig = config?.studioConfig?.thrConfig ?? null;
  const thrPayoutMonth = thrConfig?.payoutMonth ?? 12;
  const thrEnabled = thrConfig?.enabled ?? true;
  const activeThrAmount = payroll?.thrAmount ?? snapshot?.thrAmount ?? 0;
  const showThrEstimator =
    showManualThrEstimator ||
    (thrEnabled && (month === thrPayoutMonth || activeThrAmount > 0));

  return (
    <div className="space-y-6 w-full max-w-full">
      <PageHeader
        title={showCorporatePayroll ? t("nav.payroll") : t("nav.standard.income")}
        subtitle={
          showCorporatePayroll
            ? "Calculated monthly payroll statement, multi-wave disbursement timeline, and true hourly life-energy cost."
            : "Monthly income baseline, recurring cash inflows, and payday schedule."
        }
        periodLabel={`${month}/${year}`}
        status={snapshot?.status ?? "DRAFT"}
        statusLabel={isLocked ? "Closed" : "Active Draft"}
      />

      {showCorporatePayroll && (
        <SubModuleNav
          items={[
            { key: "payslip", label: t("sub.payroll.payslip") },
            { key: "timeline", label: t("sub.payroll.timeline") },
            { key: "lifeenergy", label: t("sub.payroll.lifeenergy") },
          ]}
          activeKey={activeSub}
          onSelect={selectSub}
        />
      )}

      {(activeSub === "payslip" || !showCorporatePayroll) && (
        <div className="space-y-6">
          {showCorporatePayroll && <PayrollArchetypeSelector />}

          <section className="space-y-3">
            <div className="text-[11px] font-sans font-medium text-text-tertiary">
              Cashflow Highlights
            </div>
            <PayrollCashflowHighlights
              finalTotalIncome={finalTotalIncome}
              netSalaryIncome={netSalaryIncome}
              bankTakeHomeSalary={bankTakeHomeSalary}
              directPayrollDeductions={directPayrollDeductions}
              extraIncome={extraIncome}
              thrAmount={payroll?.thrAmount ?? snapshot?.thrAmount ?? 0}
              bonusAmount={payroll?.bonusAmount ?? snapshot?.bonusAmount ?? 0}
              workingDays={workingDays}
              isStandardMode={!showCorporatePayroll}
            />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {showCorporatePayroll && (
              <div className="lg:col-span-7 space-y-4">
                {payroll ? (
                  <PayrollStatementTable payroll={payroll} />
                ) : (
                  <div className="bg-surface border border-border-subtle rounded-lg p-6 text-center text-xs font-sans text-text-tertiary">
                    No payroll calculation found for period {month}/{year}.
                  </div>
                )}

                {showThrEstimator ? (
                  <ThrBonusEstimatorCard
                    key={`thr-estimator-${month}-${year}-${snapshot?.thrAmount ?? 0}`}
                    baseSalary={payroll?.baseSalary ?? config?.baseSalary ?? 0}
                    dailyAllowance={payroll?.dailyAllowance ?? config?.dailyAllowance ?? 0}
                    laptopAllowance={payroll?.laptopAllowance ?? config?.laptopAllowance ?? 0}
                    currentWorkingDays={workingDays}
                    currentSalaryAdjustment={snapshot?.salaryAdjustment ?? 0}
                    currentCafeteriaDeduction={snapshot?.cafeteriaDeduction ?? 0}
                    currentExtraIncome={extraIncome}
                    currentThrAmount={activeThrAmount}
                    currentMonth={month}
                    thrConfig={thrConfig}
                    directDeductionsTotal={directPayrollDeductions}
                  />
                ) : (
                  <div className="bg-surface border border-border-subtle rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-text-tertiary font-sans">
                      {thrEnabled
                        ? `${thrConfig?.label || "Holiday Bonus (THR)"} estimator activates automatically in month ${thrPayoutMonth}.`
                        : "Holiday Bonus (THR) estimator is disabled in Preferences."}
                    </span>
                    <div className="flex items-center gap-3">
                      {thrEnabled && (
                        <button
                          type="button"
                          onClick={() => setShowManualThrEstimator(true)}
                          className="font-sans text-[11px] font-medium text-accent hover:underline cursor-pointer"
                        >
                          Estimate {thrConfig?.label || "Holiday Bonus"}
                        </button>
                      )}
                      <Link
                        href="/preferences?sub=payroll"
                        className="font-sans text-[11px] text-text-secondary hover:text-text-primary hover:underline"
                      >
                        Configure in Preferences
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className={`${showCorporatePayroll ? "lg:col-span-5" : "lg:col-span-12"} space-y-5`}>
              {snapshot && showCorporatePayroll && (
                <PayrollAdjustmentForm
                  key={`payroll-form-${snapshot.id}-${month}-${year}`}
                  snapshotId={snapshot.id}
                  month={month}
                  year={year}
                  isLocked={isLocked}
                  initialWorkingDays={snapshot.totalWorkingDays ?? 0}
                  initialSalaryAdjustment={snapshot.salaryAdjustment ?? 0}
                  initialCafeteriaDeduction={snapshot.cafeteriaDeduction ?? 0}
                  initialBonusAmount={snapshot.bonusAmount ?? 0}
                  hasThr={(snapshot.thrAmount ?? 0) > 0}
                  initialThrAmount={snapshot.thrAmount ?? 0}
                  baseSalary={config?.baseSalary ?? 0}
                  initialPayrollPayoutDate={snapshot.payrollPayoutDate}
                  thrConfig={thrConfig}
                  templates={config?.payrollAdjustmentTemplates ?? []}
                  periodAdjustments={snapshot.payrollPeriodAdjustments ?? []}
                  onAdjusted={refreshPeriod}
                />
              )}

              {!showCorporatePayroll && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  <ContractualBaseRateEditor
                    key={`contract-rates-std-${month}-${year}`}
                    month={month}
                    year={year}
                    isLocked={isLocked}
                    config={config}
                    hideAllowances={true}
                  />
                  <QuickIncomeForm month={month} year={year} isLocked={isLocked} />
                </div>
              )}
            </div>
          </section>

          {showCorporatePayroll && (
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <ContractualBaseRateEditor
                key={`contract-rates-${month}-${year}`}
                month={month}
                year={year}
                isLocked={isLocked}
                config={config}
                hideAllowances={false}
              />

              <QuickIncomeForm month={month} year={year} isLocked={isLocked} />
            </section>
          )}
        </div>
      )}

      {showCorporatePayroll && activeSub === "timeline" && (
        <PaydayTimelineSimulator month={month} year={year} />
      )}

      {showCorporatePayroll && activeSub === "lifeenergy" && (
        <TrueHourlyLifeEnergyPanel intel={intel} />
      )}
    </div>
  );
}
