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
}

export function PayrollCashflowHighlights({
  finalTotalIncome,
  netSalaryIncome,
  extraIncome,
  thrAmount = 0,
  bonusAmount = 0,
  workingDays,
}: PayrollCashflowHighlightsProps) {
  const { isAmountsMasked } = usePrivacyMask();
  const supplementalTotal = Math.round((thrAmount || 0) + (bonusAmount || 0) + (extraIncome || 0));
  const hasThrOrBonus = thrAmount > 0 || bonusAmount > 0;

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Centerpiece: Final Total Income */}
      <div className="col-span-4">
        <MetricCard
          label="Final Total Income"
          amount={finalTotalIncome}
          value={formatRupiah(finalTotalIncome, isAmountsMasked)}
          hasCurrency={true}
          footer="Net distributed salary + bonuses + THR + windfall"
          isCenterpiece={true}
          statusVariant="default"
        />
      </div>

      {/* Net Distributed Base */}
      <div className="col-span-3">
        <MetricCard
          label="Net Distributed Salary"
          amount={netSalaryIncome}
          value={formatRupiah(netSalaryIncome, isAmountsMasked)}
          hasCurrency={true}
          footer="Base payroll + daily allowances - BPJS"
          statusVariant="default"
        />
      </div>

      {/* Windfall / Extra / THR */}
      <div className="col-span-3">
        <MetricCard
          label={hasThrOrBonus ? "THR, Bonus & Windfall" : "Extra / Windfall"}
          amount={supplementalTotal}
          value={formatRupiah(supplementalTotal, isAmountsMasked)}
          hasCurrency={true}
          footer={
            hasThrOrBonus
              ? `THR ${formatRupiah(thrAmount, isAmountsMasked)} + extras`
              : "Freelance & bonuses"
          }
          statusVariant="default"
        />
      </div>

      {/* Working Days */}
      <div className="col-span-2">
        <MetricCard
          label="Working Days"
          value={`${workingDays} days`}
          footer="Attended office days"
          statusVariant="default"
        />
      </div>
    </div>
  );
}
