/**
 * Deterministically formats a period-linked Savings Vault deposit label so that
 * the canonical `(M/YYYY)` period attribution tag is always preserved even if
 * the user customizes the free-text description.
 */
export function formatPeriodVaultLabel(
  rawLabel: string | undefined,
  month?: number,
  year?: number,
): string {
  const trimmed = (rawLabel ?? '').trim();
  if (!month || !year) {
    return trimmed || 'Savings Vault Deposit';
  }

  const canonicalTag = `(${month}/${year})`;
  const baseLabel = trimmed || `P1 Savings Transfer ${canonicalTag}`;

  // Check if the label already contains `(month/year)`
  const escapedPeriod = new RegExp(`\\(\\s*0?${month}\\s*\\/\\s*${year}\\s*\\)`);
  if (escapedPeriod.test(baseLabel)) {
    return baseLabel;
  }

  return `${baseLabel} ${canonicalTag}`;
}

/**
 * Extracts all `(M/YYYY)` period attribution tags from a Savings Vault transaction label.
 */
export function extractPeriodTagFromLabel(
  label: string,
): { month: number; year: number } | null {
  if (!label) return null;
  const match = label.match(/\(\s*(1[0-2]|0?[1-9])\s*\/\s*(20\d{2})\s*\)/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12 || isNaN(year)) return null;
  return { month, year };
}

export type WealthFeasibilityStatus = 'FEASIBLE' | 'STRETCH' | 'UNREALISTIC';

export interface WealthTargetPlanInput {
  targetBalance: number;
  targetMonth: number;
  targetYear: number;
  currentBaseBalance: number;
  currentMonth: number;
  currentYear: number;
  finalTotalIncome: number;
  avgMonthlySavingsP1: number;
  maxMonthlySavableCapacity?: number;
}

export interface WealthTargetPlanResult {
  targetBalance: number;
  targetMonth: number;
  targetYear: number;
  currentBaseBalance: number;
  shortfallAmount: number;
  monthsRemaining: number;
  requiredMonthlySaving: number;
  pctOfIncome: number;
  status: WealthFeasibilityStatus;
  statusLabel: string;
  explanation: string;
  realisticCeiling: number;
  realisticCompletionMonthYear: string;
  realisticReachableAmount: number;
}

function formatRupiahId(val: number): string {
  return `Rp ${Math.round(val).toLocaleString('id-ID')}`;
}

/**
 * Calculates master savings wealth target timeline and performs an automatic sanity check
 * against net monthly income, current P1 savings pace, and contractual cashflow capacity.
 */
export function calculateWealthTargetPlan(
  input: WealthTargetPlanInput,
): WealthTargetPlanResult {
  const targetBalance = Math.max(0, input.targetBalance || 0);
  const currentBaseBalance = Math.max(0, input.currentBaseBalance || 0);
  const shortfallAmount = Math.max(0, targetBalance - currentBaseBalance);

  const monthsRemaining = Math.max(
    1,
    (input.targetYear - input.currentYear) * 12 +
      (input.targetMonth - input.currentMonth),
  );

  const requiredMonthlySaving =
    shortfallAmount > 0 ? Math.ceil(shortfallAmount / monthsRemaining) : 0;

  const netIncome = Math.max(0, input.finalTotalIncome || 0);
  const pctOfIncome =
    netIncome > 0
      ? Math.round((requiredMonthlySaving / netIncome) * 1000) / 10
      : 0;

  const avgP1 = Math.max(0, input.avgMonthlySavingsP1 || 0);
  const defaultCapacity = Math.max(avgP1, Math.round(netIncome * 0.25));
  const realisticCeiling =
    input.maxMonthlySavableCapacity !== undefined &&
    input.maxMonthlySavableCapacity > 0
      ? input.maxMonthlySavableCapacity
      : defaultCapacity;

  // Compute realistic alternative date and amount
  const realisticMonthsNeeded =
    realisticCeiling > 0 ? Math.ceil(shortfallAmount / realisticCeiling) : monthsRemaining * 2;
  const altSerial = input.currentYear * 12 + input.currentMonth + realisticMonthsNeeded;
  const altYear = Math.floor((altSerial - 1) / 12);
  const altMonth = ((altSerial - 1) % 12) + 1;
  const realisticCompletionMonthYear = `${altMonth}/${altYear}`;
  const realisticReachableAmount =
    currentBaseBalance + realisticCeiling * monthsRemaining;

  let status: WealthFeasibilityStatus = 'FEASIBLE';
  let statusLabel = 'Realistic & On Track';
  let explanation = '';

  if (requiredMonthlySaving === 0) {
    status = 'FEASIBLE';
    statusLabel = 'Goal Reached (100% Funded)';
    explanation = 'Target balance is already fully funded.';
  } else if (
    requiredMonthlySaving > realisticCeiling ||
    pctOfIncome > 50
  ) {
    status = 'UNREALISTIC';
    statusLabel = 'Unrealistic for Current Income & Obligations';
    explanation = `To reach ${formatRupiahId(targetBalance)} in ${monthsRemaining} months, you must save ${formatRupiahId(requiredMonthlySaving)}/month (${pctOfIncome}% of your ${formatRupiahId(netIncome)} paycheck). Exceeds contractual uncommitted cashflow (~${formatRupiahId(realisticCeiling)}/month) after mandatory debt bills and basic living costs. Realistic alternative: extend target date to ${realisticCompletionMonthYear} or adjust target to ${formatRupiahId(realisticReachableAmount)}.`;
  } else if (
    (avgP1 > 0 && requiredMonthlySaving > avgP1 * 1.5) ||
    pctOfIncome > 25
  ) {
    const gap = Math.max(0, requiredMonthlySaving - avgP1);
    status = 'STRETCH';
    statusLabel = 'Stretch Target — Requires Budget Adjustment or THR Boost';
    explanation = `Requires ${formatRupiahId(requiredMonthlySaving)}/month, which is ${formatRupiahId(gap)}/month above your current P1 savings pace. You will need to allocate part of your December THR surplus or trim discretionary spending.`;
  } else {
    status = 'FEASIBLE';
    statusLabel = 'Realistic & On Track';
    explanation = `Requires ${formatRupiahId(requiredMonthlySaving)}/month (${pctOfIncome}% of net income), which fits comfortably within your projected savings capacity.`;
  }

  return {
    targetBalance,
    targetMonth: input.targetMonth,
    targetYear: input.targetYear,
    currentBaseBalance,
    shortfallAmount,
    monthsRemaining,
    requiredMonthlySaving,
    pctOfIncome,
    status,
    statusLabel,
    explanation,
    realisticCeiling,
    realisticCompletionMonthYear,
    realisticReachableAmount,
  };
}
