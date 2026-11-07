"use client";

import React from "react";
import { MetricCard } from "@/components/primitives/MetricCard";
import { formatRupiah } from "@/lib/utils";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";

interface PayrollCashflowHighlightsProps {
  finalTotalIncome: number;
  netSalaryIncome: number;
  extraIncome: number;
  workingDays: number;
}

export function PayrollCashflowHighlights({
  finalTotalIncome,
  netSalaryIncome,
  extraIncome,
  workingDays,
}: PayrollCashflowHighlightsProps) {
  const { isAmountsMasked } = usePrivacyMask();

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* Centerpiece: Final Total Income */}
      <div className="col-span-5">
        <MetricCard
          label="Final Total Income"
          value={formatRupiah(finalTotalIncome, isAmountsMasked)}
          footer="Net distributed salary + bonuses + THR + windfall"
          isCenterpiece={true}
          statusVariant="default"
        />
      </div>

      {/* Net Distributed Base */}
      <div className="col-span-3">
        <MetricCard
          label="Net Distributed Salary"
          value={formatRupiah(netSalaryIncome, isAmountsMasked)}
          footer="Base payroll + daily allowances - BPJS"
          statusVariant="default"
        />
      </div>

      {/* Windfall / Extra */}
      <div className="col-span-2">
        <MetricCard
          label="Extra / Windfall"
          value={formatRupiah(extraIncome, isAmountsMasked)}
          footer="Freelance & bonuses"
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
