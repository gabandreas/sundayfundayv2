"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle } from "lucide-react";
import { GlobalConfig, updateGlobalConfig } from "@/lib/api";
import { formatRupiah } from "@/lib/utils";

interface GlobalConfigFormProps {
  initialConfig: GlobalConfig;
}

interface FormFieldErrors {
  baseSalary?: string;
  dailyAllowance?: string;
  laptopAllowance?: string;
  dailyOperational?: string;
  transport?: string;
  internet?: string;
  vape?: string;
  haircut?: string;
  baseSavings?: string;
  creditLimit?: string;
  creditStatementDay?: string;
  creditDueDay?: string;
  payrollPayoutDay?: string;
  ccUsageLimit?: string;
  paylaterUsageLimit?: string;
  general?: string;
}

export function GlobalConfigForm({ initialConfig }: GlobalConfigFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState({
    baseSalary: initialConfig.baseSalary.toString(),
    dailyAllowance: initialConfig.dailyAllowance.toString(),
    laptopAllowance: initialConfig.laptopAllowance.toString(),
    dailyOperational: initialConfig.dailyOperational.toString(),
    transport: initialConfig.transport.toString(),
    internet: initialConfig.internet.toString(),
    vape: initialConfig.vape.toString(),
    haircut: initialConfig.haircut.toString(),
    baseSavings: initialConfig.baseSavings.toString(),
    creditLimit: (initialConfig.creditLimit ?? 7000000).toString(),
    creditStatementDay: (initialConfig.creditStatementDay ?? 20).toString(),
    creditDueDay: (initialConfig.creditDueDay ?? 11).toString(),
    payrollPayoutDay: (initialConfig.payrollPayoutDay ?? 25).toString(),
    ccUsageLimit: (initialConfig.ccUsageLimit ?? 0).toString(),
    paylaterUsageLimit: (initialConfig.paylaterUsageLimit ?? 0).toString(),
  });

  const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: FormFieldErrors = {};

    const baseSalary = parseFloat(formData.baseSalary);
    const dailyAllowance = parseFloat(formData.dailyAllowance);
    const laptopAllowance = parseFloat(formData.laptopAllowance);
    const dailyOperational = parseFloat(formData.dailyOperational);
    const transport = parseFloat(formData.transport);
    const internet = parseFloat(formData.internet);
    const vape = parseFloat(formData.vape);
    const haircut = parseFloat(formData.haircut);
    const baseSavings = parseFloat(formData.baseSavings);
    const creditLimit = parseFloat(formData.creditLimit);
    const creditStatementDay = parseInt(formData.creditStatementDay, 10);
    const creditDueDay = parseInt(formData.creditDueDay, 10);
    const payrollPayoutDay = parseInt(formData.payrollPayoutDay, 10);
    const ccUsageLimit = parseInt(formData.ccUsageLimit, 10);
    const paylaterUsageLimit = parseInt(formData.paylaterUsageLimit, 10);

    if (isNaN(baseSalary) || baseSalary <= 0) {
      errors.baseSalary = "Base salary must be greater than 0";
    }
    if (isNaN(dailyAllowance) || dailyAllowance <= 0) {
      errors.dailyAllowance = "Daily allowance must be greater than 0";
    }
    if (isNaN(laptopAllowance) || laptopAllowance < 0) {
      errors.laptopAllowance = "Laptop allowance cannot be negative";
    }
    if (isNaN(dailyOperational) || dailyOperational < 0) {
      errors.dailyOperational = "Daily operational pocket cannot be negative";
    }
    if (isNaN(transport) || transport < 0) {
      errors.transport = "Transport baseline cannot be negative";
    }
    if (isNaN(internet) || internet < 0) {
      errors.internet = "Internet baseline cannot be negative";
    }
    if (isNaN(vape) || vape < 0) {
      errors.vape = "Vape baseline cannot be negative";
    }
    if (isNaN(haircut) || haircut < 0) {
      errors.haircut = "Haircut baseline cannot be negative";
    }
    if (isNaN(baseSavings) || baseSavings < 0) {
      errors.baseSavings = "Base savings cannot be negative";
    }
    if (isNaN(creditLimit) || creditLimit <= 0) {
      errors.creditLimit = "Credit limit must be greater than 0";
    }
    if (isNaN(creditStatementDay) || creditStatementDay < 1 || creditStatementDay > 31) {
      errors.creditStatementDay = "Statement cutoff day must be between 1 and 31";
    }
    if (isNaN(creditDueDay) || creditDueDay < 1 || creditDueDay > 31) {
      errors.creditDueDay = "Payment due day must be between 1 and 31";
    }
    if (isNaN(payrollPayoutDay) || payrollPayoutDay < 1 || payrollPayoutDay > 31) {
      errors.payrollPayoutDay = "Payroll payout day must be between 1 and 31";
    }
    if (isNaN(ccUsageLimit) || ccUsageLimit < 0) {
      errors.ccUsageLimit = "Credit card monthly usage limit cannot be negative";
    }
    if (isNaN(paylaterUsageLimit) || paylaterUsageLimit < 0) {
      errors.paylaterUsageLimit = "PayLater monthly usage limit cannot be negative";
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    setIsSubmitting(true);
    setFieldErrors({});

    const payload = {
      baseSalary: parseFloat(formData.baseSalary),
      dailyAllowance: parseFloat(formData.dailyAllowance),
      laptopAllowance: parseFloat(formData.laptopAllowance),
      dailyOperational: parseFloat(formData.dailyOperational),
      transport: parseFloat(formData.transport),
      internet: parseFloat(formData.internet),
      vape: parseFloat(formData.vape),
      haircut: parseFloat(formData.haircut),
      baseSavings: parseFloat(formData.baseSavings),
      creditLimit: parseFloat(formData.creditLimit),
      creditStatementDay: parseInt(formData.creditStatementDay, 10),
      creditDueDay: parseInt(formData.creditDueDay, 10),
      payrollPayoutDay: parseInt(formData.payrollPayoutDay, 10),
      ccUsageLimit: parseInt(formData.ccUsageLimit, 10) || 0,
      paylaterUsageLimit: parseInt(formData.paylaterUsageLimit, 10) || 0,
    };

    const res = await updateGlobalConfig(payload);

    setIsSubmitting(false);

    if (res.success) {
      setIsSuccess(true);
      router.refresh();
      setTimeout(() => setIsSuccess(false), 2500);
    } else {
      setFieldErrors({
        general: res.error || "Failed to update configuration baseline",
      });
    }
  };

  const handleReset = () => {
    setFormData({
      baseSalary: initialConfig.baseSalary.toString(),
      dailyAllowance: initialConfig.dailyAllowance.toString(),
      laptopAllowance: initialConfig.laptopAllowance.toString(),
      dailyOperational: initialConfig.dailyOperational.toString(),
      transport: initialConfig.transport.toString(),
      internet: initialConfig.internet.toString(),
      vape: initialConfig.vape.toString(),
      haircut: initialConfig.haircut.toString(),
      baseSavings: initialConfig.baseSavings.toString(),
      creditLimit: (initialConfig.creditLimit ?? 7000000).toString(),
      creditStatementDay: (initialConfig.creditStatementDay ?? 20).toString(),
      creditDueDay: (initialConfig.creditDueDay ?? 11).toString(),
      payrollPayoutDay: (initialConfig.payrollPayoutDay ?? 25).toString(),
      ccUsageLimit: (initialConfig.ccUsageLimit ?? 0).toString(),
      paylaterUsageLimit: (initialConfig.paylaterUsageLimit ?? 0).toString(),
    });
    setFieldErrors({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* General Error Banner */}
      {fieldErrors.general && (
        <div className="p-3.5 rounded-lg border bg-[rgba(224,108,83,0.10)] border-[rgba(224,108,83,0.30)] text-xs font-sans text-delta-negative flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.8} />
          <span>{fieldErrors.general}</span>
        </div>
      )}

      {/* Section 1: Compensation & Payroll Baselines */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="border-b border-border-subtle pb-3">
          <h2 className="text-xs font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            1. Compensation & Payroll Baselines
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Default employment earnings and daily attendance allowances used in payroll generation.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {/* Base Salary */}
          <div>
            <label htmlFor="baseSalary" className="block text-xs font-sans text-text-secondary mb-1">
              Gross Base Salary (IDR)
            </label>
            <input
              id="baseSalary"
              type="number"
              value={formData.baseSalary}
              onChange={(e) => handleChange("baseSalary", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.baseSalary) || 0)}
              </span>
              {fieldErrors.baseSalary && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.baseSalary}</span>
              )}
            </div>
          </div>

          {/* Daily Allowance */}
          <div>
            <label htmlFor="dailyAllowance" className="block text-xs font-sans text-text-secondary mb-1">
              Daily Attendance Allowance (IDR/day)
            </label>
            <input
              id="dailyAllowance"
              type="number"
              value={formData.dailyAllowance}
              onChange={(e) => handleChange("dailyAllowance", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.dailyAllowance) || 0)} / day
              </span>
              {fieldErrors.dailyAllowance && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.dailyAllowance}</span>
              )}
            </div>
          </div>

          {/* Laptop Allowance */}
          <div>
            <label htmlFor="laptopAllowance" className="block text-xs font-sans text-text-secondary mb-1">
              Laptop Equipment Allowance (IDR)
            </label>
            <input
              id="laptopAllowance"
              type="number"
              value={formData.laptopAllowance}
              onChange={(e) => handleChange("laptopAllowance", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.laptopAllowance) || 0)}
              </span>
              {fieldErrors.laptopAllowance && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.laptopAllowance}</span>
              )}
            </div>
          </div>

          {/* Payroll Payout Day */}
          <div>
            <label htmlFor="payrollPayoutDay" className="block text-xs font-sans text-text-secondary mb-1">
              Payroll Payout Day (Day of Month)
            </label>
            <input
              id="payrollPayoutDay"
              type="number"
              min="1"
              max="31"
              value={formData.payrollPayoutDay}
              onChange={(e) => handleChange("payrollPayoutDay", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex flex-col mt-1">
              <span className="text-[10px] font-sans text-text-tertiary leading-tight">
                Used only to mark payday on the pacing chart — does not affect any calculation
              </span>
              {fieldErrors.payrollPayoutDay && (
                <span className="text-[11px] font-sans text-delta-negative mt-0.5">{fieldErrors.payrollPayoutDay}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Fixed Essentials & Operational Baseline */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="border-b border-border-subtle pb-3">
          <h2 className="text-xs font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            2. Fixed Essentials & Operational Baseline
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Living budget targets and four fixed commitments provisioned to newly initialized periods.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Daily Operational Pocket */}
          <div className="col-span-3 pb-2 border-b border-border-subtle">
            <label htmlFor="dailyOperational" className="block text-xs font-sans text-text-secondary mb-1 font-medium">
              Daily Operational Budget Baseline (IDR/month)
            </label>
            <div className="flex gap-4 items-center">
              <div className="flex-1">
                <input
                  id="dailyOperational"
                  type="number"
                  value={formData.dailyOperational}
                  onChange={(e) => handleChange("dailyOperational", e.target.value)}
                  disabled={isSubmitting}
                  className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
                />
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-mono text-text-primary font-semibold tabular-nums">
                  {formatRupiah(parseFloat(formData.dailyOperational) || 0)}
                </span>
                <span className="text-[11px] font-mono text-text-tertiary block">
                  ~{formatRupiah(Math.round((parseFloat(formData.dailyOperational) || 0) / 30))}/day baseline rate
                </span>
              </div>
            </div>
            {fieldErrors.dailyOperational && (
              <p className="text-[11px] font-sans text-delta-negative mt-1">{fieldErrors.dailyOperational}</p>
            )}
          </div>

          {/* Transport */}
          <div>
            <label htmlFor="transport" className="block text-xs font-sans text-text-secondary mb-1">
              Transport (IDR/month)
            </label>
            <input
              id="transport"
              type="number"
              value={formData.transport}
              onChange={(e) => handleChange("transport", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.transport) || 0)}
              </span>
              {fieldErrors.transport && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.transport}</span>
              )}
            </div>
          </div>

          {/* Internet */}
          <div>
            <label htmlFor="internet" className="block text-xs font-sans text-text-secondary mb-1">
              Internet (IDR/month)
            </label>
            <input
              id="internet"
              type="number"
              value={formData.internet}
              onChange={(e) => handleChange("internet", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.internet) || 0)}
              </span>
              {fieldErrors.internet && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.internet}</span>
              )}
            </div>
          </div>

          {/* Vape */}
          <div>
            <label htmlFor="vape" className="block text-xs font-sans text-text-secondary mb-1">
              Vape (IDR/month)
            </label>
            <input
              id="vape"
              type="number"
              value={formData.vape}
              onChange={(e) => handleChange("vape", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.vape) || 0)}
              </span>
              {fieldErrors.vape && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.vape}</span>
              )}
            </div>
          </div>

          {/* Haircut */}
          <div>
            <label htmlFor="haircut" className="block text-xs font-sans text-text-secondary mb-1">
              Haircut (IDR/month)
            </label>
            <input
              id="haircut"
              type="number"
              value={formData.haircut}
              onChange={(e) => handleChange("haircut", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.haircut) || 0)}
              </span>
              {fieldErrors.haircut && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.haircut}</span>
              )}
            </div>
          </div>

          {/* Base Savings Target */}
          <div className="col-span-2">
            <label htmlFor="baseSavings" className="block text-xs font-sans text-text-secondary mb-1 font-medium">
              Target Baseline Savings (IDR/month)
            </label>
            <input
              id="baseSavings"
              type="number"
              value={formData.baseSavings}
              onChange={(e) => handleChange("baseSavings", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.baseSavings) || 0)} (Priority 1 Core Savings Target)
              </span>
              {fieldErrors.baseSavings && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.baseSavings}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Credit Facility & Billing Cycle */}
      <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <div className="border-b border-border-subtle pb-3">
          <h2 className="text-xs font-semibold tracking-wider text-text-tertiary uppercase font-sans">
            3. Credit Facility & Billing Schedule
          </h2>
          <p className="text-xs font-sans text-text-secondary mt-0.5">
            Master card limit and billing cycle calendar parameters used for cutoff date allocation.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Credit Limit */}
          <div>
            <label htmlFor="creditLimit" className="block text-xs font-sans text-text-secondary mb-1">
              Master Credit Limit (IDR)
            </label>
            <input
              id="creditLimit"
              type="number"
              value={formData.creditLimit}
              onChange={(e) => handleChange("creditLimit", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.creditLimit) || 0)}
              </span>
              {fieldErrors.creditLimit && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.creditLimit}</span>
              )}
            </div>
          </div>

          {/* Statement Cutoff Day */}
          <div>
            <label htmlFor="creditStatementDay" className="block text-xs font-sans text-text-secondary mb-1">
              Statement Cutoff Day (1–31)
            </label>
            <input
              id="creditStatementDay"
              type="number"
              min={1}
              max={31}
              value={formData.creditStatementDay}
              onChange={(e) => handleChange("creditStatementDay", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-sans text-text-tertiary">
                Day {formData.creditStatementDay} of month (cycle cutoff)
              </span>
              {fieldErrors.creditStatementDay && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.creditStatementDay}</span>
              )}
            </div>
          </div>

          {/* Payment Due Day */}
          <div>
            <label htmlFor="creditDueDay" className="block text-xs font-sans text-text-secondary mb-1">
              Payment Due Day (1–31)
            </label>
            <input
              id="creditDueDay"
              type="number"
              min={1}
              max={31}
              value={formData.creditDueDay}
              onChange={(e) => handleChange("creditDueDay", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-sans text-text-tertiary">
                Day {formData.creditDueDay} of month (bill due)
              </span>
              {fieldErrors.creditDueDay && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.creditDueDay}</span>
              )}
            </div>
          </div>
        </div>

        {/* Default Monthly Usage Caps for New Draft Periods */}
        <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border-subtle">
          <div>
            <label htmlFor="ccUsageLimit" className="block text-xs font-sans text-text-secondary mb-1">
              Default Credit Card Monthly Usage Cap (IDR)
            </label>
            <input
              id="ccUsageLimit"
              type="number"
              min={0}
              value={formData.ccUsageLimit}
              onChange={(e) => handleChange("ccUsageLimit", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.ccUsageLimit) || 0)} (0 = Unset; copied to new DRAFT periods)
              </span>
              {fieldErrors.ccUsageLimit && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.ccUsageLimit}</span>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="paylaterUsageLimit" className="block text-xs font-sans text-text-secondary mb-1">
              Default PayLater Monthly Usage Cap (IDR)
            </label>
            <input
              id="paylaterUsageLimit"
              type="number"
              min={0}
              value={formData.paylaterUsageLimit}
              onChange={(e) => handleChange("paylaterUsageLimit", e.target.value)}
              disabled={isSubmitting}
              className="w-full bg-surface-subtle border border-border-subtle focus:border-border-strong text-text-primary font-mono text-sm px-3 py-2 rounded outline-none tabular-nums"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
                {formatRupiah(parseFloat(formData.paylaterUsageLimit) || 0)} (0 = Unset; copied to new DRAFT periods)
              </span>
              {fieldErrors.paylaterUsageLimit && (
                <span className="text-[11px] font-sans text-delta-negative">{fieldErrors.paylaterUsageLimit}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          disabled={isSubmitting}
          className="px-4 py-2 rounded text-xs font-sans font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover border border-border-subtle transition-colors cursor-pointer disabled:opacity-50"
        >
          Reset to Stored Baseline
        </button>

        <button
          type="submit"
          id="save-preferences-btn"
          disabled={isSubmitting}
          className="inline-flex items-center gap-1.5 px-6 py-2 rounded bg-surface-active hover:bg-border-active text-text-primary text-xs font-sans font-medium border border-border-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSubmitting ? (
            <span>Saving Configuration...</span>
          ) : isSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-delta-positive" strokeWidth={1.8} />
              <span className="text-delta-positive">Configuration Saved</span>
            </>
          ) : (
            <span>Save Configuration</span>
          )}
        </button>
      </div>
    </form>
  );
}
