"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  WishlistFundingType,
  AnalyzeWishlistDraftPayload,
  CreateWishlistItemPayload,
  createWishlistItem,
  analyzeWishlistDraft,
  WishlistAnalysisResult,
} from "@/lib/api";
import { formatRupiah } from "@/lib/utils";
import { RefreshCw, Check, Calculator, BookmarkPlus } from "lucide-react";

interface WishlistPlannerFormProps {
  currentMonth: number;
  currentYear: number;
  onAnalysisResult: (result: WishlistAnalysisResult | null) => void;
  setIsLoadingAnalysis: (isLoading: boolean) => void;
  setAnalysisError: (err: string | null) => void;
}

export function WishlistPlannerForm({
  currentMonth,
  currentYear,
  onAnalysisResult,
  setIsLoadingAnalysis,
  setAnalysisError,
}: WishlistPlannerFormProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [priceStr, setPriceStr] = useState("");
  const [fundingType, setFundingType] = useState<WishlistFundingType>("CASH");
  const [provider, setProvider] = useState("");
  const [tenorStr, setTenorStr] = useState("6");
  const [monthlyPaymentStr, setMonthlyPaymentStr] = useState("");
  const [interestPercentStr, setInterestPercentStr] = useState("0");
  const [targetMonth, setTargetMonth] = useState(String(currentMonth));
  const [targetYear, setTargetYear] = useState(String(currentYear));
  const [notes, setNotes] = useState("");

  const [isSimulating, setIsSimulating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const priceNum = parseFloat(priceStr);
  const isValidPrice = !isNaN(priceNum) && priceNum > 0;
  const tenorNum = parseInt(tenorStr, 10);
  const monthlyPaymentNum = monthlyPaymentStr ? parseFloat(monthlyPaymentStr) : undefined;
  const interestNum = interestPercentStr ? parseFloat(interestPercentStr) : 0;

  // Auto-calculate suggested monthly payment if price and tenor are provided and user hasn't overridden
  const handlePriceChange = (val: string) => {
    setPriceStr(val);
    const p = parseFloat(val);
    if (!isNaN(p) && p > 0 && fundingType === "INSTALLMENT") {
      const t = parseInt(tenorStr, 10) || 1;
      setMonthlyPaymentStr(String(Math.round(p / t)));
    }
  };

  const handleTenorChange = (val: string) => {
    setTenorStr(val);
    const t = parseInt(val, 10);
    if (!isNaN(t) && t > 0 && isValidPrice) {
      setMonthlyPaymentStr(String(Math.round(priceNum / t)));
    }
  };

  const handleFundingTypeChange = (type: WishlistFundingType) => {
    setFundingType(type);
    if (type === "INSTALLMENT" && isValidPrice && !monthlyPaymentStr) {
      const t = parseInt(tenorStr, 10) || 1;
      setMonthlyPaymentStr(String(Math.round(priceNum / t)));
    }
  };

  const handleSimulate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      setFormError("Item name is required.");
      return;
    }
    if (!isValidPrice) {
      setFormError("Please enter a valid price amount.");
      return;
    }

    setFormError(null);
    setIsSimulating(true);
    setIsLoadingAnalysis(true);
    setAnalysisError(null);

    const payload: AnalyzeWishlistDraftPayload = {
      price: priceNum,
      fundingType,
      tenor: fundingType === "INSTALLMENT" ? tenorNum : undefined,
      monthlyPayment: fundingType === "INSTALLMENT" ? monthlyPaymentNum : undefined,
      interestPercent: fundingType === "INSTALLMENT" ? interestNum : undefined,
    };

    try {
      const monthNum = parseInt(targetMonth, 10) || currentMonth;
      const yearNum = parseInt(targetYear, 10) || currentYear;
      const res = await analyzeWishlistDraft(payload, monthNum, yearNum);
      if (res.success && res.data) {
        onAnalysisResult(res.data);
      } else {
        setAnalysisError(res.error || "Failed to analyze purchase.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to analyze purchase.";
      setAnalysisError(msg);
    } finally {
      setIsSimulating(false);
      setIsLoadingAnalysis(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!name.trim()) {
      setFormError("Item name is required.");
      return;
    }
    if (!isValidPrice) {
      setFormError("Please enter a valid price amount.");
      return;
    }

    setFormError(null);
    setIsSaving(true);

    const payload: CreateWishlistItemPayload = {
      name: name.trim(),
      price: priceNum,
      fundingType,
      provider: provider.trim() || undefined,
      tenor: fundingType === "INSTALLMENT" ? tenorNum : undefined,
      monthlyPayment: fundingType === "INSTALLMENT" ? monthlyPaymentNum : undefined,
      interestPercent: fundingType === "INSTALLMENT" ? interestNum : undefined,
      targetMonth: parseInt(targetMonth, 10) || undefined,
      targetYear: parseInt(targetYear, 10) || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const res = await createWishlistItem(payload);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        startTransition(() => {
          router.refresh();
        });
      } else {
        setFormError(res.error || "Failed to save wishlist item.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save item.";
      setFormError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-surface p-5 space-y-4">
      <div className="pb-3 border-b border-border-subtle">
        <h3 className="text-sm font-semibold font-sans text-text-primary tracking-tight">
          Purchase Parameters
        </h3>
        <p className="text-xs font-sans text-text-tertiary mt-0.5">
          Define item target and financing structure to test against current cashflow.
        </p>
      </div>

      <form onSubmit={handleSimulate} className="space-y-4">
        {/* Row 1: Item Name */}
        <div>
          <label
            htmlFor="item-name-input"
            className="block text-[11px] font-sans font-medium text-text-secondary mb-1"
          >
            Item Name <span className="text-delta-negative">*</span>
          </label>
          <input
            id="item-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. MacBook Pro M3, Herman Miller Chair"
            className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active transition-colors"
            required
          />
        </div>

        {/* Row 2: Price & Funding Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="item-price-input"
              className="block text-[11px] font-sans font-medium text-text-secondary mb-1"
            >
              Estimated Price (Rp) <span className="text-delta-negative">*</span>
            </label>
            <input
              id="item-price-input"
              type="number"
              min="0"
              step="1"
              value={priceStr}
              onChange={(e) => handlePriceChange(e.target.value)}
              placeholder="e.g. 15000000"
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active transition-colors"
              required
            />
            {isValidPrice && (
              <span className="text-[10px] font-mono text-text-tertiary mt-1 block">
                {formatRupiah(priceNum)}
              </span>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-sans font-medium text-text-secondary mb-1">
              Funding Vehicle
            </label>
            <div className="grid grid-cols-2 gap-1.5 p-0.5 rounded bg-surface-subtle border border-border-subtle">
              <button
                type="button"
                id="funding-type-cash"
                onClick={() => handleFundingTypeChange("CASH")}
                className={`py-1 text-xs font-sans font-medium rounded transition-colors ${
                  fundingType === "CASH"
                    ? "bg-surface-active text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                id="funding-type-installment"
                onClick={() => handleFundingTypeChange("INSTALLMENT")}
                className={`py-1 text-xs font-sans font-medium rounded transition-colors ${
                  fundingType === "INSTALLMENT"
                    ? "bg-surface-active text-text-primary shadow-sm"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                Installment
              </button>
            </div>
          </div>
        </div>

        {/* Conditional Installment Parameters */}
        {fundingType === "INSTALLMENT" && (
          <div className="p-3 rounded bg-surface-subtle/50 border border-border-subtle space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
              Financing Specifications
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label
                  htmlFor="installment-provider"
                  className="block text-[10px] font-sans text-text-tertiary mb-1"
                >
                  Provider / Card
                </label>
                <input
                  id="installment-provider"
                  type="text"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="e.g. BCA, Tokopedia"
                  className="w-full bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-border-active"
                />
              </div>

              <div>
                <label
                  htmlFor="installment-tenor"
                  className="block text-[10px] font-sans text-text-tertiary mb-1"
                >
                  Tenor (Months)
                </label>
                <select
                  id="installment-tenor"
                  value={tenorStr}
                  onChange={(e) => handleTenorChange(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active"
                >
                  <option value="1">1 month (Full)</option>
                  <option value="3">3 months</option>
                  <option value="6">6 months</option>
                  <option value="9">9 months</option>
                  <option value="12">12 months</option>
                  <option value="18">18 months</option>
                  <option value="24">24 months</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="installment-monthly-payment"
                  className="block text-[10px] font-sans text-text-tertiary mb-1"
                >
                  Monthly Payment (Rp)
                </label>
                <input
                  id="installment-monthly-payment"
                  type="number"
                  min="0"
                  step="1"
                  value={monthlyPaymentStr}
                  onChange={(e) => setMonthlyPaymentStr(e.target.value)}
                  placeholder="e.g. 2500000"
                  className="w-full bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="installment-interest"
                className="block text-[10px] font-sans text-text-tertiary mb-1"
              >
                Nominal Interest % (Informational)
              </label>
              <input
                id="installment-interest"
                type="number"
                min="0"
                step="0.1"
                value={interestPercentStr}
                onChange={(e) => setInterestPercentStr(e.target.value)}
                className="w-28 bg-surface border border-border-subtle rounded px-2.5 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active"
              />
            </div>
          </div>
        )}

        {/* Row 3: Target Execution Period */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="target-month-select"
              className="block text-[11px] font-sans font-medium text-text-secondary mb-1"
            >
              Target Month
            </label>
            <select
              id="target-month-select"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-border-active"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                <option key={m} value={m}>
                  {new Date(2000, m - 1).toLocaleString("en-US", { month: "long" })} ({m})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="target-year-input"
              className="block text-[11px] font-sans font-medium text-text-secondary mb-1"
            >
              Target Year
            </label>
            <input
              id="target-year-input"
              type="number"
              min="2024"
              max="2035"
              value={targetYear}
              onChange={(e) => setTargetYear(e.target.value)}
              className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-border-active"
            />
          </div>
        </div>

        {/* Row 4: Notes */}
        <div>
          <label
            htmlFor="item-notes-input"
            className="block text-[11px] font-sans font-medium text-text-secondary mb-1"
          >
            Planning Notes (Optional)
          </label>
          <textarea
            id="item-notes-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Wait for year-end discount, trade in old device"
            className="w-full bg-surface-subtle border border-border-subtle rounded px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-border-active resize-none"
          />
        </div>

        {/* Form Error Message */}
        {formError && (
          <div className="p-2.5 rounded bg-[rgba(255,56,56,0.08)] border border-[rgba(255,56,56,0.25)] text-xs text-delta-negative">
            {formError}
          </div>
        )}

        {/* Form Action Buttons */}
        <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
          <button
            type="submit"
            disabled={isSimulating}
            className="px-4 py-1.5 text-xs font-sans font-medium text-white bg-accent hover:bg-accent-hover rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSimulating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Simulating...</span>
              </>
            ) : (
              <>
                <Calculator className="w-3.5 h-3.5 text-white/80" />
                <span>Simulate Purchase</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSaveToVault}
            disabled={isSaving}
            className="px-3.5 py-1.5 text-xs font-sans font-medium text-text-primary bg-surface-subtle hover:bg-surface-active border border-border-subtle rounded transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-delta-positive" />
                <span>Saved to Vault</span>
              </>
            ) : (
              <>
                <BookmarkPlus className="w-3.5 h-3.5 text-text-tertiary" />
                <span>Save to Vault</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
