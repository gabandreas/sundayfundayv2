"use client";

import React, { useState } from "react";
import { formatRupiah } from "@/lib/utils";
import { PayrollResult } from "@/lib/api";
import { usePerspective } from "@/context/PerspectiveContext";
import { usePrivacyMask } from "@/context/PrivacyMaskContext";
import { PrivacyEyeButton } from "@/components/shell/PrivacyEyeButton";
import { ChevronDown } from "lucide-react";

interface PayrollStatementTableProps {
  payroll: PayrollResult;
}

interface StatementLineItemProps {
  label: string;
  amount: string;
  note?: string;
  type?: "base" | "allowance" | "deduction" | "subtotal" | "total";
  highlight?: boolean;
}

function StatementLineItem({
  label,
  amount,
  note,
  type = "base",
  highlight = false,
}: StatementLineItemProps) {
  const getAmountColor = () => {
    switch (type) {
      case "allowance":
        return "text-delta-positive font-medium";
      case "deduction":
        return "text-delta-negative font-medium";
      case "subtotal":
        return "text-text-primary font-bold";
      case "total":
        return "text-delta-positive font-bold text-sm";
      default:
        return "text-text-primary font-medium";
    }
  };

  const getContainerStyle = () => {
    if (type === "total") {
      return "py-3 px-3.5 rounded bg-[rgba(16,183,141,0.06)] border border-[rgba(16,183,141,0.2)] my-2";
    }
    if (type === "subtotal") {
      return "py-2.5 px-3 rounded bg-surface-subtle border border-border-subtle my-1.5";
    }
    return "py-2.5 px-2 border-b border-border-subtle/70 hover:bg-surface-subtle/40 transition-colors";
  };

  return (
    <div className={`flex items-center justify-between text-xs font-sans ${getContainerStyle()}`}>
      <div className="flex-1 pr-4">
        <span className={`block ${highlight ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
          {label}
        </span>
        {note && <span className="text-[11px] text-text-tertiary block mt-0.5">{note}</span>}
      </div>
      <div className="text-right">
        <span className={`font-mono tabular-nums whitespace-nowrap ${getAmountColor()}`}>
          {amount}
        </span>
      </div>
    </div>
  );
}

export function PayrollStatementTable({ payroll }: PayrollStatementTableProps) {
  const { profileMode, payrollMode } = usePerspective();
  const { isAmountsMasked } = usePrivacyMask();
  const [showAdvancedCorporate, setShowAdvancedCorporate] = useState(false);
  const isStandardSimple =
    profileMode === "STANDARD_GENERAL" && payrollMode === "SIMPLE_FIXED_SALARY";

  const formatRp = (amt: number) => formatRupiah(amt, isAmountsMasked);

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
              Itemized Payroll Statement
            </h2>
            <PrivacyEyeButton size="xs" />
          </div>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            Breakdown of gross base, statutory deductions, allowances, and net distribution.
          </p>
        </div>
      </div>

      <div className="space-y-1">
        {/* SECTION: Gross Base Salary */}
        <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary pt-1 pb-1">
          Base Salary & Adjustments
        </div>
        <StatementLineItem
          label="Gross Base Salary"
          amount={formatRp(payroll.baseSalary)}
        />
        {payroll.salaryAdjustment !== 0 && (
          <StatementLineItem
            label="Salary Adjustment"
            amount={
              payroll.salaryAdjustment > 0
                ? `+${formatRp(payroll.salaryAdjustment)}`
                : formatRp(payroll.salaryAdjustment)
            }
            type={payroll.salaryAdjustment > 0 ? "allowance" : "deduction"}
          />
        )}
        <StatementLineItem
          label="Adjusted Gross Base"
          amount={formatRp(payroll.adjustedBaseSalary)}
          highlight={true}
        />

        {/* SECTION: Statutory Deductions & Allowances */}
        {isStandardSimple ? (
          <div className="py-2">
            <button
              type="button"
              onClick={() => setShowAdvancedCorporate((prev) => !prev)}
              className="text-[11px] font-sans text-accent hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>
                {showAdvancedCorporate ? "Hide" : "Show"} Attendance & Statutory Breakdown (BPJS, Laptop, Daily Allowance)
              </span>
              <ChevronDown
                className={`w-3 h-3 transition-transform ${
                  showAdvancedCorporate ? "rotate-180" : ""
                }`}
              />
            </button>
            {showAdvancedCorporate && (
              <div className="mt-2 space-y-1 pl-2 border-l border-border-subtle">
                <StatementLineItem
                  label="BPJS Deduction (3%)"
                  note="Statutory health and pension contribution"
                  amount={`-${formatRp(payroll.bpjsDeduction)}`}
                  type="deduction"
                />
                <StatementLineItem
                  label="Laptop Allowance"
                  note="Monthly technology stipend"
                  amount={`+${formatRp(payroll.laptopAllowance)}`}
                  type="allowance"
                />
                <StatementLineItem
                  label="Daily Allowance Total"
                  note={`${payroll.totalWorkingDays} attended working days @ ${formatRp(payroll.dailyAllowance)}/day`}
                  amount={`+${formatRp(payroll.totalDailyAllowance)}`}
                  type="allowance"
                />
                {payroll.cafeteriaDeduction > 0 && (
                  <StatementLineItem
                    label="Cafeteria Deduction"
                    note="Meal voucher and cafeteria charges"
                    amount={`-${formatRp(payroll.cafeteriaDeduction)}`}
                    type="deduction"
                  />
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary pt-3 pb-1">
              Statutory Deductions & Allowances
            </div>
            <StatementLineItem
              label="BPJS Deduction (3%)"
              note="Statutory health and pension contribution"
              amount={`-${formatRp(payroll.bpjsDeduction)}`}
              type="deduction"
            />
            <StatementLineItem
              label="Laptop Allowance"
              note="Monthly technology stipend"
              amount={`+${formatRp(payroll.laptopAllowance)}`}
              type="allowance"
            />
            <StatementLineItem
              label="Daily Allowance Total"
              note={`${payroll.totalWorkingDays} attended working days @ ${formatRp(payroll.dailyAllowance)}/day`}
              amount={`+${formatRp(payroll.totalDailyAllowance)}`}
              type="allowance"
            />
            {payroll.cafeteriaDeduction > 0 && (
              <StatementLineItem
                label="Cafeteria Deduction"
                note="Meal voucher and cafeteria charges"
                amount={`-${formatRp(payroll.cafeteriaDeduction)}`}
                type="deduction"
              />
            )}
          </>
        )}

        {/* SUB-TOTAL: Net Distributed Salary */}
        <div className="pt-2">
          <StatementLineItem
            label="Net Distributed Salary"
            note="Distributed to primary checking account"
            amount={formatRp(payroll.netSalaryIncome)}
            type="subtotal"
            highlight={true}
          />
        </div>

        {/* SECTION: Supplemental & Windfall Income */}
        {(payroll.bonusAmount > 0 || payroll.thrAmount > 0 || payroll.extraIncome > 0) && (
          <>
            <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary pt-3 pb-1">
              Supplemental & Windfall Income
            </div>
            {payroll.bonusAmount > 0 && (
              <StatementLineItem
                label="Performance Bonus"
                amount={`+${formatRp(payroll.bonusAmount)}`}
                type="allowance"
              />
            )}
            {payroll.thrAmount > 0 && (
              <StatementLineItem
                label="Tunjangan Hari Raya (THR)"
                note="Pro-rated religious holiday allowance"
                amount={`+${formatRp(payroll.thrAmount)}`}
                type="allowance"
              />
            )}
            {payroll.extraIncome > 0 && (
              <StatementLineItem
                label="Extra / Windfall Income"
                note="Logged freelance, dividends, or other receipts"
                amount={`+${formatRp(payroll.extraIncome)}`}
                type="allowance"
              />
            )}
          </>
        )}

        {/* GRAND TOTAL: Final Total Income */}
        <div className="pt-3">
          <StatementLineItem
            label="Final Total Take-Home Cashflow"
            note="Net distributed salary + bonus + THR + windfall"
            amount={formatRp(payroll.finalTotalIncome)}
            type="total"
            highlight={true}
          />
        </div>
      </div>
    </div>
  );
}
