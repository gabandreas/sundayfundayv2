"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Settings, Loader2 } from "lucide-react";
import { GlobalConfig, updateGlobalConfig } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface ContractualBaseRateEditorProps {
  month: number;
  year: number;
  isLocked: boolean;
  config: GlobalConfig | null;
}

export function ContractualBaseRateEditor({
  month,
  year,
  isLocked,
  config,
}: ContractualBaseRateEditorProps) {
  const router = useRouter();

  const [baseSalary, setBaseSalary] = useState(
    (config?.baseSalary ?? 5300000).toString()
  );
  const [dailyAllowance, setDailyAllowance] = useState(
    (config?.dailyAllowance ?? 25000).toString()
  );
  const [laptopAllowance, setLaptopAllowance] = useState(
    (config?.laptopAllowance ?? 250000).toString()
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const parsedBaseSalary = parseInt(baseSalary, 10) || 0;
  const parsedDailyAllowance = parseInt(dailyAllowance, 10) || 0;
  const parsedLaptopAllowance = parseInt(laptopAllowance, 10) || 0;
  const bpjsPreview = Math.round(parsedBaseSalary * 0.03);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isLocked) return;

    if (parsedBaseSalary <= 0) {
      setErrorMsg("Base salary must be greater than Rp 0");
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await updateGlobalConfig({
        baseSalary: parsedBaseSalary,
        dailyAllowance: parsedDailyAllowance,
        laptopAllowance: parsedLaptopAllowance,
        recalculateDrafts: true,
        fromMonth: month,
        fromYear: year,
      } as any);

      if (!res.success) {
        throw new Error(res.error || "Failed to update contractual parameters");
      }

      setIsSuccess(true);
      setTimeout(() => setIsSuccess(false), 2500);
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-surface border border-border-subtle rounded-lg p-5 space-y-4">
      <div className="pb-3 border-b border-border-subtle flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-text-tertiary" />
            <h2 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
              Contractual Base Rates
            </h2>
          </div>
          <p className="text-xs font-sans text-text-tertiary mt-0.5">
            Employment contract baseline. Propagates forward to all active drafts.
          </p>
        </div>
        <span className="text-[10px] font-mono text-text-tertiary uppercase px-1.5 py-0.5 rounded bg-surface-subtle border border-border-subtle">
          From {month}/{year}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {/* Base Salary */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Base Salary (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="50000"
              value={baseSalary}
              onChange={(e) => setBaseSalary(e.target.value)}
              disabled={isLocked || isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-border-active disabled:opacity-50"
            />
          </div>

          {/* Daily Attendance Rate */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Daily Attendance Rate (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              value={dailyAllowance}
              onChange={(e) => setDailyAllowance(e.target.value)}
              disabled={isLocked || isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-border-active disabled:opacity-50"
            />
          </div>

          {/* Laptop Allowance */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Laptop Allowance (Rp)
            </label>
            <input
              type="number"
              min="0"
              step="10000"
              value={laptopAllowance}
              onChange={(e) => setLaptopAllowance(e.target.value)}
              disabled={isLocked || isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono tabular-nums text-text-primary focus:outline-none focus:border-border-active disabled:opacity-50"
            />
          </div>

          {/* BPJS Deduction Preview */}
          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              BPJS Deduction (3% Fixed)
            </label>
            <div className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono tabular-nums text-text-tertiary">
              {formatRupiah(bpjsPreview)}
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="text-xs font-sans py-2 px-3 rounded border bg-[rgba(224,108,83,0.08)] border-[rgba(224,108,83,0.25)] text-delta-negative">
            {errorMsg}
          </div>
        )}

        {!isLocked && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 px-4 rounded bg-surface-active hover:bg-border-active text-text-primary text-xs font-sans font-medium border border-border-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Updating Baseline & Recalculating Drafts...</span>
              </>
            ) : isSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
                <span className="text-delta-positive">Saved & Recalculated</span>
              </>
            ) : (
              <span>Save for This Month & Future Drafts</span>
            )}
          </button>
        )}
      </form>
    </div>
  );
}
