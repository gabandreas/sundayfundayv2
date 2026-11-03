"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePerspective } from "@/context/PerspectiveContext";
import { FormulaEngineType, FormulaParams } from "@/lib/api";

const FORMULA_ENGINES: Array<{
  key: FormulaEngineType;
  title: string;
  badge: string;
  description: string;
}> = [
  {
    key: "DEBT_FIRST_WATERFALL",
    title: "Debt-First Waterfall",
    badge: "CANONICAL DEFAULT",
    description:
      "Mandatory Bills & Routine Envelopes + Daily Living upfront, then Priority 1 Core Savings, then Priority 2 Self-Reward.",
  },
  {
    key: "SAVINGS_FIRST_LOCK",
    title: "Savings-First Lock",
    badge: "PAY YOURSELF FIRST",
    description:
      "Locks Core Savings (% of Net Income or fixed IDR) immediately after mandatory bills, then funds Routine Envelopes & Daily Living.",
  },
  {
    key: "PERCENTAGE_SPLIT",
    title: "Percentage Split (50/30/20)",
    badge: "PROPORTIONAL",
    description:
      "Splits Net Income proportionally across Needs (Bills + Living), Wants (Discretionary), and Savings.",
  },
  {
    key: "RETIREMENT_DRAWDOWN",
    title: "Retirement & Passive Drawdown",
    badge: "GOLDEN AGE",
    description:
      "Combines monthly Pension/Passive Inflow with a planned Vault Drawdown, prioritizing Healthcare & Utility Envelopes.",
  },
];

export function FormulaEngineSelectorCard() {
  const { user } = useAuth();
  const {
    formulaEngineType,
    formulaParamsJson,
    setFormulaEngine,
  } = usePerspective();

  const [selectedEngine, setSelectedEngine] =
    useState<FormulaEngineType>(formulaEngineType);
  const [savingsLockPercent, setSavingsLockPercent] = useState<number>(
    formulaParamsJson?.savingsLockPercent ?? 20
  );
  const [needsPercent, setNeedsPercent] = useState<number>(
    formulaParamsJson?.needsPercent ?? 50
  );
  const [wantsPercent, setWantsPercent] = useState<number>(
    formulaParamsJson?.wantsPercent ?? 30
  );
  const [savingsPercent, setSavingsPercent] = useState<number>(
    formulaParamsJson?.savingsPercent ?? 20
  );
  const [monthlyVaultDrawdown, setMonthlyVaultDrawdown] = useState<number>(
    formulaParamsJson?.monthlyVaultDrawdown ?? 2000000
  );
  const [healthcareReserveTarget, setHealthcareReserveTarget] = useState<number>(
    formulaParamsJson?.healthcareReserveTarget ?? 500000
  );
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setSelectedEngine(formulaEngineType);
    if (formulaParamsJson) {
      if (formulaParamsJson.savingsLockPercent !== undefined)
        setSavingsLockPercent(formulaParamsJson.savingsLockPercent);
      if (formulaParamsJson.needsPercent !== undefined)
        setNeedsPercent(formulaParamsJson.needsPercent);
      if (formulaParamsJson.wantsPercent !== undefined)
        setWantsPercent(formulaParamsJson.wantsPercent);
      if (formulaParamsJson.savingsPercent !== undefined)
        setSavingsPercent(formulaParamsJson.savingsPercent);
      if (formulaParamsJson.monthlyVaultDrawdown !== undefined)
        setMonthlyVaultDrawdown(formulaParamsJson.monthlyVaultDrawdown);
      if (formulaParamsJson.healthcareReserveTarget !== undefined)
        setHealthcareReserveTarget(formulaParamsJson.healthcareReserveTarget);
    }
  }, [formulaEngineType, formulaParamsJson]);

  const isOwnerProtected = user?.id === 1 && user?.role === "PLATFORM_OWNER";

  const handleApplyEngine = async () => {
    if (isOwnerProtected && selectedEngine !== "DEBT_FIRST_WATERFALL") {
      setStatusMessage(
        "Platform Owner (User #1) canonical snapshots are protected on DEBT_FIRST_WATERFALL. Switch to Demo Sandbox or a Client Account to test alternative engines."
      );
      return;
    }

    setIsSaving(true);
    try {
      const nextParams: FormulaParams = {
        ...(formulaParamsJson || {}),
        savingsLockMode: "PERCENT",
        savingsLockPercent,
        needsPercent,
        wantsPercent,
        savingsPercent,
        monthlyVaultDrawdown,
        healthcareReserveTarget,
      };
      await setFormulaEngine(selectedEngine, nextParams);
      setStatusMessage(`Active allocation engine set to ${selectedEngine}.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="bg-surface border border-border rounded-md p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            Multi-Formula Allocation Engine
          </div>
          <h2 className="text-sm font-semibold text-text-primary mt-0.5">
            Active Cashflow Distribution Algorithm
          </h2>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-mono rounded border border-border bg-surface-subtle text-text-secondary">
          {formulaEngineType}
        </span>
      </div>

      {statusMessage && (
        <div className="px-3.5 py-2 rounded border border-border-strong bg-surface-subtle text-xs font-mono text-text-primary">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {FORMULA_ENGINES.map((eng) => {
          const isSelected = selectedEngine === eng.key;
          return (
            <button
              key={eng.key}
              type="button"
              onClick={() => setSelectedEngine(eng.key)}
              className={`p-3.5 rounded border text-left transition-colors flex flex-col justify-between ${
                isSelected
                  ? "border-text-primary bg-surface-subtle"
                  : "border-border bg-surface hover:bg-surface-subtle/50"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-text-primary">
                    {eng.title}
                  </span>
                </div>
                <span className="inline-block mt-1 text-[9px] font-mono px-1.5 py-0.5 rounded border border-border text-text-tertiary">
                  {eng.badge}
                </span>
                <p className="text-[11px] text-text-tertiary mt-2 leading-relaxed">
                  {eng.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Parameter Controls for Selected Engine */}
      {selectedEngine === "SAVINGS_FIRST_LOCK" && (
        <div className="p-3.5 rounded border border-border-subtle bg-surface-subtle/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-xs text-text-secondary font-medium">
              Locked Core Savings (% of Net Income):
            </label>
            <input
              type="number"
              min={5}
              max={70}
              value={savingsLockPercent}
              onChange={(e) => setSavingsLockPercent(Number(e.target.value))}
              className="w-20 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
            />
            <span className="text-xs font-mono text-text-tertiary">%</span>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleApplyEngine}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-background hover:opacity-90 transition-opacity"
          >
            {isSaving ? "Applying..." : "Apply Savings-First Lock"}
          </button>
        </div>
      )}

      {selectedEngine === "PERCENTAGE_SPLIT" && (
        <div className="p-3.5 rounded border border-border-subtle bg-surface-subtle/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary">Needs %:</label>
              <input
                type="number"
                min={10}
                max={80}
                value={needsPercent}
                onChange={(e) => setNeedsPercent(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary">Wants %:</label>
              <input
                type="number"
                min={0}
                max={70}
                value={wantsPercent}
                onChange={(e) => setWantsPercent(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-text-secondary">Savings %:</label>
              <input
                type="number"
                min={0}
                max={70}
                value={savingsPercent}
                onChange={(e) => setSavingsPercent(Number(e.target.value))}
                className="w-16 px-2 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleApplyEngine}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-background hover:opacity-90 transition-opacity"
          >
            {isSaving ? "Applying..." : "Apply Percentage Split"}
          </button>
        </div>
      )}

      {selectedEngine === "RETIREMENT_DRAWDOWN" && (
        <div className="p-3.5 rounded border border-border-subtle bg-surface-subtle/40 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary">
                Planned Monthly Vault Drawdown (IDR):
              </label>
              <input
                type="number"
                step={100000}
                min={0}
                value={monthlyVaultDrawdown}
                onChange={(e) => setMonthlyVaultDrawdown(Number(e.target.value))}
                className="w-32 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-secondary">
                Healthcare Reserve (IDR):
              </label>
              <input
                type="number"
                step={100000}
                min={0}
                value={healthcareReserveTarget}
                onChange={(e) =>
                  setHealthcareReserveTarget(Number(e.target.value))
                }
                className="w-28 px-2.5 py-1 text-xs font-mono rounded border border-border bg-surface text-text-primary"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleApplyEngine}
            className="px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-background hover:opacity-90 transition-opacity"
          >
            {isSaving ? "Applying..." : "Apply Retirement Drawdown"}
          </button>
        </div>
      )}

      {selectedEngine === "DEBT_FIRST_WATERFALL" &&
        formulaEngineType !== "DEBT_FIRST_WATERFALL" && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleApplyEngine}
              className="px-3.5 py-1.5 rounded text-xs font-medium bg-text-primary text-background hover:opacity-90 transition-opacity"
            >
              {isSaving ? "Applying..." : "Restore Debt-First Waterfall"}
            </button>
          </div>
        )}
    </section>
  );
}

