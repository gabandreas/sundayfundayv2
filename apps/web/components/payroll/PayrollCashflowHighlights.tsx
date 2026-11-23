"use client";

import React from "react";
import { MetricCard } from "@/components/primitives/MetricCard";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PayrollCashflowHighlightsProps {
  finalTotalIncome: number;
  netSalaryIncome: number;
  extraIncome: number;
  thrAmount?: number;
  bonusAmount?: number;
  workingDays: number;
  isStandardMode?: boolean;
}

export function PayrollCashflowHighlights({
  finalTotalIncome,
  netSalaryIncome,
  extraIncome,
  thrAmount = 0,
  bonusAmount = 0,
  workingDays,
  isStandardMode = false,
}: PayrollCashflowHighlightsProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const supplementalTotal = Math.round((thrAmount || 0) + (bonusAmount || 0) + (extraIncome || 0));
  const hasThrOrBonus = !isStandardMode && (thrAmount > 0 || bonusAmount > 0);

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Centerpiece: Final Total Income */}
      <div className={isStandardMode ? "col-span-4" : "col-span-4"}>
        <MetricCard
          label={isStandardMode ? "Monthly Total Income" : "Final Total Income"}
          amount={finalTotalIncome}
          value={formatRupiah(finalTotalIncome, isAmountsMasked)}
          hasCurrency={true}
          footer={
            isStandardMode
              ? "Base monthly income + extra inflows"
              : "Net distributed salary + bonuses + THR + windfall"
          }
          isCenterpiece={true}
          statusVariant="default"
        />
      </div>

      {/* Net Distributed Base */}
      <div className={isStandardMode ? "col-span-4" : "col-span-3"}>
        <MetricCard
          label={isStandardMode ? "Base Monthly Income" : "Net Distributed Salary"}
          amount={netSalaryIncome}
          value={formatRupiah(netSalaryIncome, isAmountsMasked)}
          hasCurrency={true}
          footer={
            isStandardMode
              ? "Recurring fixed base income"
              : "Base payroll + daily allowances - BPJS"
          }
          statusVariant="default"
        />
      </div>

      {/* Windfall / Extra / THR */}
      <div className={isStandardMode ? "col-span-4" : "col-span-3"}>
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
        />
      </div>

      {/* Working Days (Corporate Attendance Payroll only) */}
      {!isStandardMode && (
        <div className="col-span-2">
          <MetricCard
            label="Working Days"
            value={`${workingDays} days`}
            footer="Attended office days"
            statusVariant="default"
          />
        </div>
      )}
    </div>
  );
}
