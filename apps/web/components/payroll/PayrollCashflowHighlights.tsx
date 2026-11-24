"use client";

import React from "react";
import { MetricCard } from "@/components/primitives/MetricCard";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PayrollCashflowHighlightsProps {
  finalTotalIncome: number;
  netSalaryIncome: number;
  bankTakeHomeSalary?: number;
  directPayrollDeductions?: number;
  extraIncome: number;
  thrAmount?: number;
  bonusAmount?: number;
  workingDays: number;
  isStandardMode?: boolean;
}

export function PayrollCashflowHighlights({
  finalTotalIncome,
  netSalaryIncome,
  bankTakeHomeSalary,
  directPayrollDeductions = 0,
  extraIncome,
  thrAmount = 0,
  bonusAmount = 0,
  workingDays,
  isStandardMode = false,
}: PayrollCashflowHighlightsProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const supplementalTotal = Math.round((thrAmount || 0) + (bonusAmount || 0) + (extraIncome || 0));
  const hasThrOrBonus = !isStandardMode && (thrAmount > 0 || bonusAmount > 0);
  const hasDirectDeductions = directPayrollDeductions > 0;
  const displayedNetTakeHome = bankTakeHomeSalary ?? netSalaryIncome;

  return (
    <div
      className={
        isStandardMode
          ? "grid grid-cols-3 gap-4"
          : "grid grid-cols-[minmax(0,1.34fr)_minmax(0,1.16fr)_minmax(0,1.16fr)_minmax(0,0.78fr)] gap-4"
      }
    >
      {/* Centerpiece: Final Total Income */}
      <div className="min-w-0">
        <MetricCard
          label={isStandardMode ? "Monthly Total Income" : "Total Cycle Inflow"}
          amount={finalTotalIncome}
          value={formatRupiah(finalTotalIncome, isAmountsMasked)}
          hasCurrency={true}
          footer={
            isStandardMode
              ? "Base monthly income + extra inflows"
              : "Bank transfer + bonuses + holiday allowance + extra"
          }
          isCenterpiece={true}
          statusVariant="default"
          className="!p-4"
        />
      </div>

      {/* Transferred to Bank / Slip Net Pay */}
      <div className="min-w-0">
        <MetricCard
          label={
            isStandardMode
              ? "Base Monthly Income"
              : hasDirectDeductions
                ? "Transferred to Bank"
                : "Slip Net Pay"
          }
          amount={displayedNetTakeHome}
          value={formatRupiah(displayedNetTakeHome, isAmountsMasked)}
          hasCurrency={true}
          footer={
            isStandardMode
              ? "Recurring fixed base income"
              : hasDirectDeductions
                ? `Slip Net ${formatRupiah(netSalaryIncome, isAmountsMasked)} · -${formatRupiah(directPayrollDeductions, isAmountsMasked)} direct deductions`
                : "Base salary + allowances - statutory deductions"
          }
          statusVariant="default"
          className="!p-4"
        />
      </div>

      {/* Windfall / Extra / THR */}
      <div className="min-w-0">
        <MetricCard
          label={hasThrOrBonus ? "THR, Bonus & Windfall" : "Extra / Windfall"}
          amount={supplementalTotal}
          value={formatRupiah(supplementalTotal, isAmountsMasked)}
          hasCurrency={true}
          footer={
            hasThrOrBonus
              ? `THR ${formatRupiah(thrAmount, isAmountsMasked)} + extras`
              : "Freelance, side income & bonuses"
          }
          statusVariant="default"
          className="!p-4"
        />
      </div>

      {/* Working Days (Corporate Attendance Payroll only) */}
      {!isStandardMode && (
        <div className="min-w-0">
          <MetricCard
            label="Working Days"
            value={`${workingDays} days`}
            footer="Attended office days"
            statusVariant="default"
            className="!p-4"
          />
        </div>
      )}
    </div>
  );
}
