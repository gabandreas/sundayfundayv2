const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export type FixedEssentialCategory =
  | "TRANSPORT"
  | "INTERNET"
  | "VAPE"
  | "HAIRCUT";

export type SavingsInstrumentType = "LIQUID_CASH" | "INVESTMENT_RDPU";

export interface FixedEssentialItemRealization {
  category: FixedEssentialCategory;
  label: string;
  target: number;
  spent: number;
  coveredByPool: number;
  overage: number;
  remainingPool: number;
  utilizationPercent: number;
}

export interface FixedEssentialsRealizationSummary {
  items: FixedEssentialItemRealization[];
  totalTarget: number;
  totalSpent: number;
  totalCoveredByPool: number;
  totalOverage: number;
  totalRemainingPool: number;
}

export interface Transaction {
  id: number;
  snapshotId: number;
  type: "INCOME" | "DEDUCTION" | "CREDIT_BILL";
  sourceType:
    | "MANUAL"
    | "CONTRACT"
    | "CC_TRANSACTION"
    | "BULK_BILL"
    | "PERSONAL_DEBT"
    | "OPERATIONAL_REFUND";
  sourceId: number | null;
  fixedEssentialCategory?: FixedEssentialCategory | null;
  label: string;
  amount: number;
  date: string;
  createdAt: string;
}

export type BudgetRevisionCategory =
  | "SAVINGS"
  | "DAILY_OPERATIONAL"
  | "SELF_REWARD"
  | "BUFFER"
  | "TRANSPORT"
  | "INTERNET"
  | "VAPE"
  | "HAIRCUT";

export interface BudgetRevision {
  id: number;
  snapshotId: number;
  month: number;
  year: number;
  category: BudgetRevisionCategory;
  previousValue: number;
  newValue: number;
  difference: number;
  reason: string;
  createdAt: string;
}

export interface MonthlySnapshot {
  id: number;
  month: number;
  year: number;
  status: "DRAFT" | "LOCKED";
  salaryAdjustment: number;
  totalWorkingDays: number;
  cafeteriaDeduction: number;
  thrAmount: number;
  bonusAmount: number;
  dailyOperational: number;
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  savings: number;
  selfRewardTarget: number;
  bufferPocket: number;
  ccUsageLimit?: number;
  paylaterUsageLimit?: number;
  payrollPayoutDate?: string | null;
  isPayoutDateConfirmed?: boolean;
  netSalaryIncome: number | null;
  extraIncome: number | null;
  finalTotalIncome: number | null;
  totalDeductions: number | null;
  actualDailyOperational: number | null;
  actualSavings: number | null;
  selfReward: number | null;
  deficitUncovered: number | null;
  survivalPocket: number | null;
  frozenRulesJson?: any | null;
  bucketRealizationsJson?: BucketRealization[] | null;
  transactions?: Transaction[];
  budgetRevisions?: BudgetRevision[];
}

export interface DailyPacing {
  periodMonth: number;
  periodYear: number;
  cycleStartDate: string;
  cycleEndDate: string;
  cycleDateLabel: string;
  isEndDateConfirmed: boolean;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  currentDayIndex: number;
  totalOperationalBudget: number;
  totalDailySpent: number;
  remainingBudget: number;
  baselineDailyRate: number;
  safeToSpendToday: number;
  pacingRatio: number;
  pacingPercentage: number;
  pacingStatus: "ON_TRACK" | "CAUTION" | "BURNING_FAST" | "DEFICIT_RISK";
  isWeekendToday?: boolean;
  weekendMultiplier?: number;
  remainingWeekdays?: number;
  remainingWeekendDays?: number;
  remainingWeightedUnits?: number;
  weekdaySafeRate?: number;
  weekendSafeRate?: number;
  weightedSafeToSpendToday?: number;
  rollingWeeklyEnvelope?: number;
  averageDailyBurnSoFar?: number;
  projectedEndOfCycleRemaining?: number;
  fixedEssentialsRealization?: FixedEssentialsRealizationSummary;
  operationalRefundsTotal?: number;
}

export interface SavingsMilestone {
  months: number;
  targetAmount: number;
  progressPercent: number;
  isAchieved: boolean;
}

export interface UntransferredLockedPeriod {
  month: number;
  year: number;
  actualSavings: number;
  transferredAmount: number;
  untransferredAmount: number;
  suggestedLabel: string;
}

export interface SavingsPeriodLedgerItem {
  month: number;
  year: number;
  status: "LOCKED" | "DRAFT";
  monthlyTarget: number;
  actualSavings: number;
  depositedAmount: number;
  pendingTransfer: number;
  isFullyDeposited: boolean;
}

export interface EnrichedSavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAllocatedAmount: number;
  targetMonth: number;
  targetYear: number;
  category: string;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  progressPercent: number;
  remainingNeeded: number;
  monthsUntilTarget: number;
  requiredMonthlyContribution: number;
  projectedMonthsAtPace: number | null;
  projectedCompletionDate: string | null;
  isReadyToBuy?: boolean;
  wishlistItemId?: number | null;
  linkedWishlistItem?: {
    id: number;
    name: string;
    price: number;
    status: string;
  } | null;
}

export type WealthFeasibilityStatus = "FEASIBLE" | "STRETCH" | "UNREALISTIC";

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

export interface WealthTargetConfig {
  targetWealthAmount: number;
  targetWealthMonth: number;
  targetWealthYear: number;
  targetWealthBase: "CONFIRMED_VAULT" | "PLANNED_P1";
}

export interface FinancialCapacity {
  currentPeriodNetIncome: number;
  routineBills: number;
  dailyOp: number;
  deductions: number;
  maxMonthlySavableCapacity: number;
}

export interface SavingsOverviewResult {
  kpi: {
    totalVaultBalance: number;
    liquidCashBalance: number;
    investmentRdpuBalance: number;
    liquidSharePercent: number;
    rdpuSharePercent: number;
    totalPlanned2026P1: number;
    avgMonthlySavingsP1: number;
    averageMonthlySavingsRatePercent: number;
  };
  accumulationLedger: SavingsPeriodLedgerItem[];
  goals: EnrichedSavingsGoal[];
  financialCapacity?: FinancialCapacity;
  wealthTargetConfig?: WealthTargetConfig;
  wealthTargetPlan?: WealthTargetPlanResult;
}

export interface SavingsVault {
  balance: number;
  liquidCashBalance?: number;
  investmentRdpuBalance?: number;
  liquidSharePercent?: number;
  rdpuSharePercent?: number;
  monthlyLivingExpenseBaseline: number;
  runwayMonths: number;
  milestones: SavingsMilestone[];
  transactions: Array<{
    id: number;
    type?: "TOPUP" | "WITHDRAWAL";
    instrumentType?: SavingsInstrumentType;
    amount: number;
    label: string;
    date: string;
    createdAt?: string;
  }>;
  periodDepositsByPeriod?: Record<string, number>;
  untransferredLockedPeriods?: UntransferredLockedPeriod[];
  overview?: SavingsOverviewResult;
}

export interface CreditContract {
  id: number;
  label: string;
  principalAmount: number;
  monthlyInstallment: number;
  totalTenor: number;
  remainingTenor: number;
  startMonth?: number;
  startYear?: number;
  isActive: boolean;
  elapsedTenor?: number;
  tenorProgressPercent?: number;
  payoffMonth?: number;
  payoffYear?: number;
  payoffDateLabel?: string;
  remainingPrincipal?: number;
}

async function handleResponse<T>(res: Response, notFoundFallback: T): Promise<T> {
  if (res.status === 404 || res.status === 401) {
    return notFoundFallback;
  }
  if (!res.ok) {
    let detail = "";
    try {
      const errJson = await res.json();
      detail = errJson.message || errJson.error || JSON.stringify(errJson);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`API Error [${res.status}]: ${detail || res.statusText}`);
  }
  return await res.json();
}

export async function fetchSnapshot(
  month: number,
  year: number
): Promise<MonthlySnapshot | null> {
  const res = await fetch(`${API_URL}/api/snapshots?month=${month}&year=${year}`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<MonthlySnapshot | null>(res, null);
}

export async function fetchPacing(
  month: number,
  year: number
): Promise<DailyPacing | null> {
  const res = await fetch(`${API_URL}/api/finance/pacing?month=${month}&year=${year}`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<DailyPacing | null>(res, null);
}

export async function fetchTransactions(
  month: number,
  year: number
): Promise<Transaction[]> {
  const res = await fetch(
    `${API_URL}/api/finance/transactions?month=${month}&year=${year}`,
    { headers: await getAuthHeaders(), cache: "no-store" }
  );
  return handleResponse<Transaction[]>(res, []);
}

export async function fetchSavingsVault(
  month?: number,
  year?: number
): Promise<SavingsVault | null> {
  const query =
    month !== undefined && year !== undefined
      ? `?month=${month}&year=${year}`
      : "";
  const res = await fetch(`${API_URL}/api/savings${query}`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<SavingsVault | null>(res, null);
}

export async function createSavingsTransaction(data: {
  type: "TOPUP" | "WITHDRAWAL";
  amount: number;
  label: string;
  date: string;
  instrumentType?: SavingsInstrumentType;
  periodMonth?: number;
  periodYear?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to create savings transaction" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function rebalanceSavingsInstrument(data: {
  fromInstrument: SavingsInstrumentType;
  toInstrument: SavingsInstrumentType;
  amount: number;
  note?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/rebalance`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to rebalance savings vault",
      };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function deleteSavingsTransaction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to delete savings transaction" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchSavingsOverview(): Promise<SavingsOverviewResult | null> {
  const res = await fetch(`${API_URL}/api/savings/overview`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<SavingsOverviewResult | null>(res, null);
}

export async function confirmPeriodDeposit(data: {
  month: number;
  year: number;
  amount: number;
  instrumentType?: SavingsInstrumentType;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/confirm-period-deposit`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to confirm period deposit" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchSavingsGoals(): Promise<EnrichedSavingsGoal[]> {
  const res = await fetch(`${API_URL}/api/savings/goals`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<EnrichedSavingsGoal[]>(res, []);
}

export async function createSavingsGoal(data: {
  name: string;
  targetAmount: number;
  targetMonth: number;
  targetYear: number;
  category?: string;
  currentAllocatedAmount?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/goals`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to create savings goal" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function updateSavingsGoal(
  id: number,
  data: Partial<{
    name: string;
    targetAmount: number;
    targetMonth: number;
    targetYear: number;
    category: string;
    currentAllocatedAmount: number;
    isCompleted: boolean;
  }>
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/goals/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to update savings goal" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function deleteSavingsGoal(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/goals/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to delete savings goal" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function saveWealthTarget(data: {
  targetAmount: number;
  targetMonth: number;
  targetYear: number;
  targetBase?: "CONFIRMED_VAULT" | "PLANNED_P1";
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/wealth-target`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to save wealth target",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function stopRecurringCardSubscription(
  id: number,
  stopFromMonth: number,
  stopFromYear: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards/${id}/stop-recurring`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ stopFromMonth, stopFromYear }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to stop recurring subscription" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function resumeRecurringCardSubscription(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards/${id}/resume-recurring`, {
      method: "PATCH",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to resume recurring subscription" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchContracts(): Promise<CreditContract[]> {
  const res = await fetch(`${API_URL}/api/credit/contracts?isActive=true`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<CreditContract[]>(res, []);
}

export interface PayrollResult {
  baseSalary: number;
  salaryAdjustment: number;
  adjustedBaseSalary: number;
  bpjsDeduction: number;
  laptopAllowance: number;
  netBasePayroll: number;
  totalWorkingDays: number;
  dailyAllowance: number;
  totalDailyAllowance: number;
  netSalaryIncome: number;
  extraIncome: number;
  finalTotalIncome: number;
  thrAmount: number;
  bonusAmount: number;
  cafeteriaDeduction: number;
}

export async function fetchPayroll(
  month: number,
  year: number
): Promise<PayrollResult | null> {
  const res = await fetch(
    `${API_URL}/api/finance/payroll?month=${month}&year=${year}`,
    { headers: await getAuthHeaders(), cache: "no-store" }
  );
  return handleResponse<PayrollResult | null>(res, null);
}

export async function closeSnapshot(
  id: number,
  options?: {
    vaultTopupAmount?: number;
    vaultTopupLabel?: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${id}/close`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(options ?? {}),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.message || `Failed to close period (${res.status})` };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function recalculateSnapshot(
  id: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${id}/recalculate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.message || `Failed to recalculate snapshot (${res.status})` };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function reopenSnapshot(
  id: number
): Promise<{ success: boolean; data?: MonthlySnapshot; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${id}/reopen`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || `Failed to reopen period (${res.status})`,
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function evaluateAutoClosePeriods(): Promise<{
  success: boolean;
  data?: { autoClosedCount: number; checkedCount: number; autoClosedPeriods: Array<{ id: number; month: number; year: number }> };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/evaluate-auto-close`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to evaluate auto-close",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export interface UpdateSnapshotInput {
  totalWorkingDays?: number;
  cafeteriaDeduction?: number;
  bonusAmount?: number;
  salaryAdjustment?: number;
  useDecemberProratedThr?: boolean;
  thrAmount?: number;
  payrollPayoutDate?: string;
}

export async function updateSnapshot(
  id: number,
  data: UpdateSnapshotInput
): Promise<MonthlySnapshot | null> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("updateSnapshot error:", error);
    return null;
  }
}

export async function createIncomeTransaction(data: {
  month: number;
  year: number;
  label: string;
  amount: number;
  date: string;
}): Promise<Transaction | null> {
  try {
    const res = await fetch(`${API_URL}/api/finance/transactions`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...data,
        type: "INCOME",
      }),
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch (error) {
    console.error("createIncomeTransaction error:", error);
    return null;
  }
}

export async function createExpenseTransaction(data: {
  month: number;
  year: number;
  label: string;
  amount: number;
  date: string;
  fixedEssentialCategory?: FixedEssentialCategory;
  bucketKey?: string;
  isOperationalRefund?: boolean;
}): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/transactions`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        ...data,
        type: data.isOperationalRefund ? "INCOME" : "DEDUCTION",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to record expense" };
    }
    const tx = await res.json();
    return { success: true, data: tx };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function deleteFinanceTransaction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/transactions/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to delete transaction" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function updateFinanceTransaction(
  id: number,
  data: {
    label?: string;
    amount?: number;
    date?: string;
  }
): Promise<{ success: boolean; data?: Transaction; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/transactions/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to update transaction",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


// ----------------------------------------------------
// Credit & Liabilities Types & Client Functions
// ----------------------------------------------------

export interface CardInstallmentProgress {
  isInstallment: boolean;
  currentSliceIndex: number | null;
  totalTenor: number;
  paidSlicesThroughTarget: number;
  remainingSlicesAfterTarget: number;
  remainingSlicesIncludingTarget: number;
  monthlyInstallmentAmount: number;
  totalPrincipalAmount: number;
  remainingPrincipalIncludingTarget: number;
  remainingPrincipalAfterTarget: number;
  badgeLabel: string | null;
  canSettleEarly: boolean;
}

export interface CreditCardTransaction {
  id: number;
  label: string;
  amount: number;
  totalAmount?: number | null;
  chargeType: "FULL" | "INSTALLMENT" | "RECURRING";
  category: string;
  isRecurring: boolean;
  tenor: number | null;
  monthlyAmount: number | null;
  transactionDate: string;
  billingMonth: number;
  billingYear: number;
  endedAtMonth?: number | null;
  endedAtYear?: number | null;
  endedAtLabel?: string | null;
  isActive?: boolean;
  stoppedAtMonth?: number | null;
  stoppedAtYear?: number | null;
  dueInPeriod?: number;
  installmentProgress?: CardInstallmentProgress;
  status: "ACTIVE" | "SETTLED" | "CANCELLED";
  notes: string | null;
  promoLabel?: string | null;
  promoEndDate?: string | null;
  postPromoNormalAmount?: number | null;
  killSwitchEnabled?: boolean;
  providerCancelUrl?: string | null;
  providerCancelConfirmed?: boolean;
  createdAt: string;
}

export interface KillSwitchItem {
  id: number;
  userId: number;
  label: string;
  amount: number;
  promoLabel: string | null;
  promoEndDate: string | null;
  postPromoNormalAmount: number | null;
  killSwitchEnabled: boolean;
  providerCancelUrl: string | null;
  providerCancelConfirmed: boolean;
  isRecurring: boolean;
  isActive: boolean;
  stoppedAtMonth: number | null;
  stoppedAtYear: number | null;
  daysUntilExpiry: number | null;
  monthlyPenaltyDelta: number;
  alertState: "SILENT" | "ACTION_REQUIRED" | "CONFIRMED_SAFE";
  statusLabel: "ARMED" | "CRITICAL" | "SAFE" | "INACTIVE";
  lastKillSwitchNotifiedAt?: string | null;
}

export interface KillSwitchNotificationConfig {
  killSwitchNotifyEmail: string | null;
  killSwitchSmtpUser: string | null;
  hasSmtpPassword: boolean;
  killSwitchWebhookUrl: string | null;
  killSwitchWaPhone: string | null;
  hasWaApiKey: boolean;
  killSwitchCustomMessageTemplate: string | null;
}

export interface UpdateKillSwitchNotificationConfigInput {
  killSwitchNotifyEmail?: string;
  killSwitchSmtpUser?: string;
  killSwitchSmtpAppPassword?: string;
  killSwitchWebhookUrl?: string;
  killSwitchWaPhone?: string;
  killSwitchWaApiKey?: string;
  killSwitchCustomMessageTemplate?: string;
}

export interface SendReminderResult {
  success: boolean;
  channels: {
    email: boolean;
    webhook: boolean;
    emailError?: string;
    webhookError?: string;
  };
  message: string;
  whatsappUrl?: string | null;
  notifiedAt?: string;
  error?: string;
}

export interface KillSwitchConfig {
  killSwitchLeadDays: number;
  killSwitchBannerEnabled: boolean;
}

export interface KillSwitchResponse {
  config: KillSwitchConfig;
  items: KillSwitchItem[];
}

export interface CreateKillSwitchInput {
  label: string;
  amount: number;
  promoLabel?: string;
  promoEndDate: string;
  postPromoNormalAmount: number;
  killSwitchEnabled?: boolean;
  providerCancelUrl?: string;
  billingMonth?: number;
  billingYear?: number;
}

export interface UpdateKillSwitchInput {
  label?: string;
  amount?: number;
  promoLabel?: string;
  promoEndDate?: string;
  postPromoNormalAmount?: number;
  killSwitchEnabled?: boolean;
  providerCancelUrl?: string;
  providerCancelConfirmed?: boolean;
  autoStopAfterPromo?: boolean;
}

export interface CreditCardSummary {
  creditLimit: number;
  statementCutoffDay: number;
  paymentDueDay: number;
  currentCycleDue: number;
  totalOutstandingBalance: number;
  utilizationPercent: number;
}

export interface LiabilityMatrixColumn {
  month: number;
  year: number;
  key: string;
  label: string;
}

export interface LiabilityMatrixCardItem {
  id: number;
  label: string;
  chargeType: string;
  amount: number;
  sliceBadge: string | null;
  endedAtLabel: string | null;
}

export interface LiabilityMatrixResponse {
  columns: LiabilityMatrixColumn[];
  payLaterRow: {
    label: string;
    dueDay: number;
    cells: Record<string, { bulkBillId?: number; amount: number }>;
  };
  creditCardRow: {
    label: string;
    dueDay: number;
    cells: Record<string, { amount: number; items?: LiabilityMatrixCardItem[] }>;
  };
  personalDebtRow: {
    label: string;
    cells: Record<string, { bulkBillId?: number; amount: number }>;
  };
  contractRows: Array<{
    id: number;
    label: string;
    monthlyInstallment: number;
    cells: Record<string, { amount: number; sliceBadge?: string }>;
  }>;
  totalsPerMonth: Record<string, number>;
}

export async function fetchLiabilityMatrix(
  startMonth = 7,
  startYear = 2026,
  count = 12
): Promise<LiabilityMatrixResponse | null> {
  const res = await fetch(
    `${API_URL}/api/credit/matrix?startMonth=${startMonth}&startYear=${startYear}&count=${count}`,
    { headers: await getAuthHeaders(), cache: "no-store" }
  );
  return handleResponse<LiabilityMatrixResponse | null>(res, null);
}

export async function fetchCardSummary(
  month: number,
  year: number
): Promise<CreditCardSummary | null> {
  const res = await fetch(
    `${API_URL}/api/credit/cards/summary?month=${month}&year=${year}`,
    { headers: await getAuthHeaders(), cache: "no-store" }
  );
  return handleResponse<CreditCardSummary | null>(res, null);
}

export async function fetchCardTransactions(
  month?: number,
  year?: number,
  contextMonth?: number,
  contextYear?: number
): Promise<CreditCardTransaction[]> {
  const params = new URLSearchParams();
  if (month !== undefined) params.set("month", String(month));
  if (year !== undefined) params.set("year", String(year));
  if (contextMonth !== undefined) params.set("contextMonth", String(contextMonth));
  if (contextYear !== undefined) params.set("contextYear", String(contextYear));
  const query = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${API_URL}/api/credit/cards${query}`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<CreditCardTransaction[]>(res, []);
}

export async function createCardCharge(data: {
  label: string;
  amount: number;
  chargeType: "FULL" | "INSTALLMENT" | "RECURRING";
  category: string;
  transactionDate: string;
  isRecurring?: boolean;
  tenor?: number;
  monthlyAmount?: number;
  endedAtMonth?: number;
  endedAtYear?: number;
  notes?: string;
}): Promise<{ success: boolean; error?: string; data?: CreditCardTransaction }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return { success: false, error: body.message || "Failed to create card charge" };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function updateCardCharge(
  id: number,
  data: {
    label?: string;
    endedAtMonth?: number | null;
    endedAtYear?: number | null;
    status?: "ACTIVE" | "SETTLED" | "CANCELLED";
    notes?: string;
  }
): Promise<{ success: boolean; error?: string; data?: CreditCardTransaction }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update card charge",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function settleCardInstallmentEarly(
  id: number,
  data: {
    month: number;
    year: number;
    settlementMode?: "LUMP_SUM_CURRENT_PERIOD" | "MARK_SETTLED_ONLY";
    note?: string;
  }
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards/${id}/settle-early`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to settle installment early",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function deleteCardCharge(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/cards/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json();
      return { success: false, error: body.message || "Failed to delete card charge" };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function updateBulkBillCell(data: {
  id?: number;
  month: number;
  year: number;
  field: "paylaterAmount" | "personalDebtAmount";
  value: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = await getAuthHeaders({
      "Content-Type": "application/json",
    });
    if (data.id) {
      const res = await fetch(`${API_URL}/api/credit/bulk-bills/${data.id}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          [data.field]: data.value,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.message || "Failed to update bulk bill cell" };
      }
      return { success: true };
    } else {
      const res = await fetch(`${API_URL}/api/credit/bulk-bills`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          month: data.month,
          year: data.year,
          [data.field]: data.value,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        return { success: false, error: body.message || "Failed to create bulk bill cell" };
      }
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchKillSwitches(): Promise<KillSwitchResponse | null> {
  const res = await fetch(`${API_URL}/api/credit/kill-switches`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<KillSwitchResponse | null>(res, null);
}

export async function createKillSwitch(
  data: CreateKillSwitchInput
): Promise<{ success: boolean; data?: KillSwitchItem; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/kill-switches`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to create subscription kill-switch",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function updateKillSwitch(
  id: number,
  data: UpdateKillSwitchInput
): Promise<{ success: boolean; data?: KillSwitchItem; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/kill-switches/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update subscription kill-switch",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchKillSwitchNotificationConfig(): Promise<KillSwitchNotificationConfig | null> {
  const res = await fetch(`${API_URL}/api/credit/kill-switches/notification-config`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<KillSwitchNotificationConfig | null>(res, null);
}

export async function updateKillSwitchNotificationConfig(
  data: UpdateKillSwitchNotificationConfigInput
): Promise<{ success: boolean; data?: KillSwitchNotificationConfig; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/kill-switches/notification-config`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update notification settings",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function sendKillSwitchReminder(
  id: number
): Promise<SendReminderResult> {
  try {
    const res = await fetch(`${API_URL}/api/credit/kill-switches/${id}/send-reminder`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        channels: { email: false, webhook: false },
        message: "",
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to send reminder",
      };
    }
    return body;
  } catch (error: any) {
    return {
      success: false,
      channels: { email: false, webhook: false },
      message: "",
      error: error.message || "Network error sending reminder",
    };
  }
}

export type PayrollFormulaType =
  | "FIXED_AMOUNT"
  | "PERCENT_OF_BASE"
  | "RATE_PER_WORKING_DAY"
  | "PRORATED_MONTHS_OF_BASE";

export interface PayrollComponentRule {
  id: string;
  label: string;
  direction: "ADDITION" | "DEDUCTION";
  formulaType: PayrollFormulaType;
  value: number;
  isActive: boolean;
}

export type BucketFormulaType =
  | "FIXED_AMOUNT"
  | "PERCENT_OF_NET_INCOME"
  | "PERCENT_OF_DISPOSABLE_AFTER_DEBT"
  | "DAILY_RATE_TIMES_CYCLE_DAYS"
  | "REMAINDER_OVERFLOW";

export type BucketGroup =
  | "FIXED_ESSENTIAL"
  | "DAILY_OPERATIONAL"
  | "BUFFER"
  | "SAVINGS_P1"
  | "SELF_REWARD_P2";

export interface AllocationBucketRule {
  id: string;
  label: string;
  group: BucketGroup;
  priorityTier: number;
  formulaType: BucketFormulaType;
  value: number;
  minFloorRp?: number;
  maxCapRp?: number;
  isActive: boolean;
}

export interface SurplusSplitItem {
  bucketId: string;
  percent: number;
}

export interface SurplusSplitRules {
  splits: SurplusSplitItem[];
}

export interface FinancialPolicyConfig {
  optimalDebtRatioPercent: number;
  maxSafeDebtRatioPercent: number;
  targetSavingsRatePercent: number;
  criticalOperationalFloorRp: number;
  runwayMilestoneMonths: number[];
}

export interface BucketRealization {
  bucketId: string;
  label: string;
  group: BucketGroup;
  priorityTier: number;
  formulaType: BucketFormulaType;
  formulaValue: number;
  baselineTarget: number;
  revisedTarget: number;
  fundedAmount: number;
  loggedSpend: number;
  remainingBudget: number;
  capHit?: "MIN_FLOOR" | "MAX_CAP";
}

export type ProfileMode = "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL";
export type PayrollMode =
  | "BESPOKE_ATTENDANCE"
  | "SIMPLE_FIXED_SALARY"
  | "VARIABLE_FREELANCE"
  | "PENSION_PASSIVE";

export type LifeStagePreset =
  | "SUPERADMIN_BESPOKE"
  | "STUDENT_FIRST_JOBBER"
  | "CORPORATE_PROFESSIONAL"
  | "FREELANCER_VARIABLE"
  | "FAMILY_HOUSEHOLD"
  | "RETIREE_GOLDEN_AGE";

export type UiDensityMode = "COMMAND_COCKPIT" | "SIMPLE_CLARITY";

export type FormulaEngineType =
  | "DEBT_FIRST_WATERFALL"
  | "SAVINGS_FIRST_LOCK"
  | "PERCENTAGE_SPLIT"
  | "RETIREMENT_DRAWDOWN";

export type ModuleKey =
  | "overview"
  | "income"
  | "allocations"
  | "ledger"
  | "preferences"
  | "corporate_payroll"
  | "credit_liabilities"
  | "savings_vault"
  | "wishlist_simulator"
  | "discipline_audit"
  | "advanced_analytics"
  | "executive_reports";

export const ALL_MODULE_KEYS: ModuleKey[] = [
  "overview",
  "income",
  "allocations",
  "ledger",
  "preferences",
  "corporate_payroll",
  "credit_liabilities",
  "savings_vault",
  "wishlist_simulator",
  "discipline_audit",
  "advanced_analytics",
  "executive_reports",
];

export interface CustomIncomeDeductionRow {
  id: string;
  label: string;
  amount: number;
  direction: "INCOME" | "DEDUCTION";
}

export interface FormulaParams {
  savingsLockMode?: "FIXED" | "PERCENT";
  savingsLockPercent?: number;
  savingsLockFixedIdr?: number;
  needsPercent?: number;
  wantsPercent?: number;
  savingsPercent?: number;
  monthlyVaultDrawdown?: number;
  healthcareReserveTarget?: number;
  customPayrollRows?: CustomIncomeDeductionRow[];
}

export interface CustomRoutineLabels {
  transport?: string;
  internet?: string;
  vape?: string;
  haircut?: string;
  [key: string]: string | undefined;
}

export interface GlobalConfig {
  id: number;
  userId?: number;
  baseSalary: number;
  dailyAllowance: number;
  laptopAllowance: number;
  dailyOperational: number;
  transport: number;
  internet: number;
  vape: number;
  haircut: number;
  baseSavings: number;
  creditLimit: number;
  creditStatementDay: number;
  creditDueDay: number;
  payrollPayoutDay?: number;
  ccUsageLimit?: number;
  paylaterUsageLimit?: number;
  payrollRulesJson?: any;
  allocationBucketsJson?: any;
  surplusSplitRulesJson?: any;
  financialPolicyJson?: any;
  payrollRules?: PayrollComponentRule[];
  allocationBuckets?: AllocationBucketRule[];
  surplusSplitRules?: SurplusSplitRules;
  financialPolicy?: FinancialPolicyConfig;
  autoCloseEnabled?: boolean;
  autoCloseAfterDays?: number;
  activeTrackingStartMonth?: number;
  activeTrackingStartYear?: number;
  targetWealthAmount?: number;
  targetWealthMonth?: number;
  targetWealthYear?: number;
  targetWealthBase?: string;
  profileMode?: ProfileMode;
  onboardingCompleted?: boolean;
  customRoutineLabelsJson?: CustomRoutineLabels | null;
  customRoutineCategoriesJson?: RoutineCategoryConfig[] | null;
  payrollMode?: PayrollMode;
  lifeStagePreset?: LifeStagePreset;
  uiDensityMode?: UiDensityMode;
  enabledModulesJson?: ModuleKey[] | null;
  formulaEngineType?: FormulaEngineType;
  formulaParamsJson?: FormulaParams | null;
  killSwitchLeadDays?: number;
  killSwitchBannerEnabled?: boolean;
  recalculateDrafts?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreditLimitStatus =
  | "UNSET"
  | "OK"
  | "APPROACHING_LIMIT"
  | "EXCEEDED";

export type OptimalBindingConstraint =
  | "DEBT_RATIO_20"
  | "CASHFLOW_SAVINGS_PROTECTION";

export type SafeBindingConstraint =
  | "DEBT_RATIO_35"
  | "CASHFLOW_DEFICIT_PROTECTION";

export interface InstrumentLimitEvaluation {
  usage: number;
  limit: number;
  utilizationPercent: number;
  remainingBeforeLimit: number;
  exceededBy: number;
  status: CreditLimitStatus;
}

export interface CreditCeilingBreakdown {
  totalIncome: number;
  upfrontEssentialsAndOperational: number;
  dailyOperationalTarget: number;
  fixedExpenses: number;
  bufferPocket: number;
  savingsTarget: number;
  manualDeductions: number;
  contractInstallments: number;
  personalDebtAmount: number;
  fixedLockedDebt: number;
  optimalTotalDebtCeiling: number;
  manageableTotalDebtCeiling: number;
  ratioBasedOptimalRevolvingCeiling: number;
  ratioBasedSafeRevolvingCeiling: number;
  maxCashflowBeforeSavingsSlash: number;
  maxCashflowBeforeDeficit: number;
  recommendedOptimalCombinedCeiling: number;
  recommendedSafeCombinedCeiling: number;
  optimalBindingConstraint: OptimalBindingConstraint;
  safeBindingConstraint: SafeBindingConstraint;
  remainingSafeHeadroomForCc: number;
  remainingSafeHeadroomForPaylater: number;
  remainingOptimalHeadroomForCc: number;
  remainingOptimalHeadroomForPaylater: number;
}

export interface CreditLimitCalculationResult {
  month: number;
  year: number;
  isSnapshotPersisted: boolean;
  snapshotStatus: "DRAFT" | "LOCKED" | "UNINITIALIZED";
  bankCreditLimit: number;
  ccEvaluation: InstrumentLimitEvaluation;
  paylaterEvaluation: InstrumentLimitEvaluation;
  currentCombinedRevolvingUsage: number;
  totalPeriodDebt: number;
  currentDebtRatioPercent: number;
  isSafeCeilingExceeded: boolean;
  isOptimalCeilingExceeded: boolean;
  isAnyConfiguredLimitExceeded: boolean;
  ceilingBreakdown: CreditCeilingBreakdown;
}

export async function fetchCreditUsageLimit(
  month: number,
  year: number
): Promise<CreditLimitCalculationResult | null> {
  const res = await fetch(
    `${API_URL}/api/credit/usage-limit?month=${month}&year=${year}`,
    { cache: "no-store" }
  );
  return handleResponse<CreditLimitCalculationResult | null>(res, null);
}

export async function updateCreditUsageLimit(data: {
  month: number;
  year: number;
  ccUsageLimit?: number;
  paylaterUsageLimit?: number;
  saveAsGlobalDefault?: boolean;
}): Promise<{
  success: boolean;
  data?: CreditLimitCalculationResult;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/credit/usage-limit`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update credit usage limits",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function fetchGlobalConfig(): Promise<GlobalConfig | null> {
  try {
    const res = await fetch(`${API_URL}/api/config`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<GlobalConfig | null>(res, null);
  } catch {
    return null;
  }
}

export async function updateGlobalConfig(
  data: Partial<Omit<GlobalConfig, "id" | "createdAt" | "updatedAt">>
): Promise<{ success: boolean; error?: string; data?: GlobalConfig }> {
  try {
    const res = await fetch(`${API_URL}/api/config`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to update configuration",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function syncConfigToPeriod(
  month?: number,
  year?: number
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${API_URL}/api/config/sync-to-period`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ month, year }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to sync configuration",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function simulateModularRules(payload: {
  income?: number;
  baseSalary?: number;
  debts?: number;
  cycleDays?: number;
  totalWorkingDays?: number;
  payrollRules?: any[];
  allocationBuckets?: any[];
  surplusSplitRules?: any;
  financialPolicy?: any;
}): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${API_URL}/api/config/simulate-rules`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to simulate rules",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function restoreDefaultRules(): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${API_URL}/api/config/restore-defaults`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to restore defaults",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


// ─────────────────────────────────────────────
// Custom Module & Rule Requests
// ─────────────────────────────────────────────

export interface CustomFeatureRequest {
  id: number;
  title: string;
  category:
    | "CUSTOM_PAYROLL_FORMULA"
    | "CUSTOM_WATERFALL_RULE"
    | "BANK_EXPORT_INTEGRATION"
    | "BESPOKE_MODULE";
  currentWorkflowDescription: string;
  desiredBehavior: string;
  priority: "NORMAL" | "HIGH_BUSINESS_CRITICAL";
  status: "SUBMITTED" | "IN_REVIEW" | "APPROVED_QUOTED" | "IMPLEMENTED";
  adminNotes?: string | null;
  estimatedSetupFee?: number | null;
  createdAt: string;
  updatedAt: string;
}

export async function fetchCustomRequests(): Promise<CustomFeatureRequest[]> {
  const res = await fetch(`${API_URL}/api/config/custom-requests`, {
    cache: "no-store",
  });
  return handleResponse<CustomFeatureRequest[]>(res, []);
}

export async function createCustomRequest(data: {
  title: string;
  category: string;
  currentWorkflowDescription: string;
  desiredBehavior: string;
  priority?: string;
}): Promise<{ success: boolean; data?: CustomFeatureRequest; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/config/custom-requests`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to submit request",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function updateCustomRequest(
  id: number,
  data: Partial<{
    title: string;
    category: string;
    currentWorkflowDescription: string;
    desiredBehavior: string;
    priority: string;
    status: string;
    adminNotes: string;
    estimatedSetupFee: number;
  }>
): Promise<{ success: boolean; data?: CustomFeatureRequest; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/config/custom-requests/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to update request",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function deleteCustomRequest(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/config/custom-requests/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: body.message || "Failed to delete request",
      };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function resyncSnapshotRules(
  snapshotId: number
): Promise<{ success: boolean; error?: string; data?: any }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${snapshotId}/resync-rules`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to resync rules",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function createBudgetRevision(
  snapshotId: number,
  data: {
    category?: BudgetRevisionCategory;
    bucketKey?: string;
    bucketLabel?: string;
    newValue: number;
    reason: string;
  }
): Promise<{ success: boolean; data?: { revision: BudgetRevision; snapshot: MonthlySnapshot }; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${snapshotId}/budget-revision`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to revise budget target",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export interface BudgetRevisionPreview {
  category?: BudgetRevisionCategory;
  bucketKey?: string;
  bucketLabel?: string;
  previousValue: number;
  newValue: number;
  difference: number;
  projected: {
    actualDailyOperational: number;
    actualSavings: number;
    actualSelfReward: number;
    deficitUncovered: number;
    survivalPocket: number;
    safeToSpendToday: number;
    pacingStatus: string;
    baselineDailyRate: number;
  };
}

export async function previewBudgetRevision(
  snapshotId: number,
  data: {
    category?: BudgetRevisionCategory;
    bucketKey?: string;
    bucketLabel?: string;
    newValue: number;
  }
): Promise<{ success: boolean; data?: BudgetRevisionPreview; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${snapshotId}/budget-revision/preview`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to preview budget revision",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function fetchBudgetRevisions(
  snapshotId: number
): Promise<BudgetRevision[]> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${snapshotId}/budget-revisions`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      return [];
    }
    return res.json();
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// Wishlist Types & Client API
// ─────────────────────────────────────────────

export type WishlistFundingType = "CASH" | "INSTALLMENT";
export type WishlistStatus = "PLANNING" | "READY" | "PURCHASED";
export type CashStrategyTier = "INSTANT_EXECUTION" | "SAVING_REQUIRED";
export type InstallmentRiskTier = "OPTIMAL" | "MANAGEABLE" | "HIGH_RISK";

export interface WishlistItem {
  id: number;
  name: string;
  price: number;
  fundingType: WishlistFundingType;
  provider?: string | null;
  tenor?: number | null;
  monthlyPayment?: number | null;
  interestPercent?: number | null;
  targetMonth?: number | null;
  targetYear?: number | null;
  status: WishlistStatus;
  notes?: string | null;
  priority: number;
  savingsGoalId?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWishlistItemPayload {
  name: string;
  price: number;
  fundingType?: WishlistFundingType;
  provider?: string;
  tenor?: number;
  monthlyPayment?: number;
  interestPercent?: number;
  targetMonth?: number;
  targetYear?: number;
  status?: WishlistStatus;
  notes?: string;
  priority?: number;
}

export interface AnalyzeWishlistDraftPayload {
  price: number;
  fundingType?: WishlistFundingType;
  tenor?: number;
  monthlyPayment?: number;
  interestPercent?: number;
}

export interface CashStrategyAnalysis {
  tier: CashStrategyTier;
  currentSelfReward: number;
  shortfall: number;
  estimatedMonthsToSave: number;
  monthlySavingsRate: number;
}

export interface MonthlyDebtProjection {
  month: number;
  year: number;
  existingDebt: number;
  newDebt: number;
  totalDebt: number;
  debtRatio: number;
}

export interface InstallmentStrategyAnalysis {
  tier: InstallmentRiskTier;
  peakDebtRatio: number;
  newMonthlyInstallment: number;
  projectedMonths: MonthlyDebtProjection[];
}

export interface WishlistAnalysisResult {
  cashStrategy: CashStrategyAnalysis;
  installmentStrategy?: InstallmentStrategyAnalysis;
}

export async function fetchWishlistItems(status?: WishlistStatus): Promise<WishlistItem[]> {
  try {
    const url = status
      ? `${API_URL}/api/wishlist?status=${encodeURIComponent(status)}`
      : `${API_URL}/api/wishlist`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function createWishlistItem(
  data: CreateWishlistItemPayload
): Promise<{ success: boolean; data?: WishlistItem; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/wishlist`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to create wishlist item",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function updateWishlistItem(
  id: number,
  data: Partial<CreateWishlistItemPayload>
): Promise<{ success: boolean; data?: WishlistItem; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/wishlist/${id}`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to update wishlist item",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function deleteWishlistItem(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/wishlist/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to delete wishlist item",
      };
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function analyzeWishlistDraft(
  data: AnalyzeWishlistDraftPayload,
  month?: number,
  year?: number
): Promise<{ success: boolean; data?: WishlistAnalysisResult; error?: string }> {
  try {
    let url = `${API_URL}/api/wishlist/analyze-draft`;
    const params = new URLSearchParams();
    if (month) params.append("month", String(month));
    if (year) params.append("year", String(year));
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to analyze purchase",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function analyzeWishlistItem(
  id: number,
  month?: number,
  year?: number
): Promise<{ success: boolean; data?: WishlistAnalysisResult; error?: string }> {
  try {
    let url = `${API_URL}/api/wishlist/${id}/analyze`;
    const params = new URLSearchParams();
    if (month) params.append("month", String(month));
    if (year) params.append("year", String(year));
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url, { cache: "no-store" });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to analyze wishlist item",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function convertWishlistToContract(
  id: number
): Promise<{ success: boolean; data?: { contract: CreditContract; item: WishlistItem }; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/wishlist/${id}/convert-to-contract`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to convert item to contract",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function trackWishlistAsSavingsGoal(
  id: number
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/wishlist/${id}/track-as-savings-goal`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message) ? body.message.join(", ") : body.message || "Failed to track wishlist item as savings goal",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------

export type AuditCategory =
  | "OPERATIONAL_BUDGET"
  | "SELF_REWARD"
  | "DEBT_BURDEN"
  | "SAVINGS"
  | "INFORMAL_DEBT"
  | "DEFICIT"
  | "SAVINGS_VAULT";

export type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface AuditLog {
  id: number;
  action: string;
  category: AuditCategory;
  summary: string;
  details: string | null;
  month: number | null;
  year: number | null;
  severity: AuditSeverity;
  createdAt: string;
}

export interface PaginatedAuditLogs {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type FlagType = "GREEN" | "RED";
export type HealthStatus = "EXCELLENT" | "GOOD" | "CAUTION" | "CRITICAL";
export type OperationalBudgetStatus = "HEALTHY" | "TIGHT" | "CRITICAL";

export interface AuditFlag {
  id: string;
  category: AuditCategory;
  type: FlagType;
  title: string;
  description: string;
  amount?: number;
  month?: number;
  year?: number;
}

export interface OperationalAuditEntry {
  month: number;
  year: number;
  targetAmount: number;
  actualAmount: number;
  shortfall: number;
  isDeficit: boolean;
  status: OperationalBudgetStatus;
}

export interface SelfRewardAuditEntry {
  month: number;
  year: number;
  targetAmount: number;
  actualAmount: number;
  isAchieved: boolean;
  streakWithoutReward: number;
}

export interface DebtBurdenAuditEntry {
  month: number;
  year: number;
  totalIncome: number;
  totalBills: number;
  debtRatio: number;
  isHeavyBurden: boolean;
  ccUsage: number;
  ccUsageLimit: number;
  paylaterUsage: number;
  paylaterUsageLimit: number;
  isCreditLimitConfigured: boolean;
  isCreditLimitExceeded: boolean;
}

export interface SavingsAuditEntry {
  month: number;
  year: number;
  targetSavings: number;
  actualSavings: number;
  isMet: boolean;
}

export interface AuditEvaluationResult {
  healthScorecard: {
    disciplineScore: number;
    healthStatus: HealthStatus;
    totalGreenFlags: number;
    totalRedFlags: number;
    totalChecks: number;
  };
  operationalAudit: OperationalAuditEntry[];
  selfRewardAudit: SelfRewardAuditEntry[];
  debtBurdenAudit: DebtBurdenAuditEntry[];
  savingsAudit: SavingsAuditEntry[];
  flags: AuditFlag[];
}

export interface AuditSummary {
  disciplineScore: number;
  healthStatus: HealthStatus;
  totalGreenFlags: number;
  totalRedFlags: number;
  totalChecks: number;
  flags: AuditFlag[];
}

export async function fetchAuditLogs(
  page: number = 1,
  limit: number = 20,
  month?: number,
  year?: number,
  category?: AuditCategory,
  severity?: AuditSeverity
): Promise<PaginatedAuditLogs> {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (month !== undefined) query.append("month", month.toString());
  if (year !== undefined) query.append("year", year.toString());
  if (category) query.append("category", category);
  if (severity) query.append("severity", severity);

  const res = await fetch(`${API_URL}/api/audit?${query.toString()}`, {
    cache: "no-store",
  });
  return handleResponse<PaginatedAuditLogs>(res, { items: [], total: 0, page, limit, totalPages: 0 });
}

export async function fetchAuditSummary(): Promise<AuditSummary | null> {
  const res = await fetch(`${API_URL}/api/audit/summary`, {
    cache: "no-store",
  });
  return handleResponse<AuditSummary | null>(res, null);
}

export async function fetchAuditReport(): Promise<AuditEvaluationResult | null> {
  const res = await fetch(`${API_URL}/api/audit/report`, {
    cache: "no-store",
  });
  return handleResponse<AuditEvaluationResult | null>(res, null);
}

// -----------------------------------------------------------------------------
// Analytics
// -----------------------------------------------------------------------------

export type AnalyticsScope = "all" | "locked";

export type MacroCategoryKey =
  | "LIABILITIES_DEBT"
  | "DAILY_OPERATIONAL"
  | "FIXED_ESSENTIALS"
  | "CORE_SAVINGS"
  | "SELF_REWARD_SURPLUS"
  | "BUFFER_POCKET";

export interface AnalyticsKpis {
  averageMonthlyIncome: number;
  averageMonthlySavings: number;
  aggregateSavingsRate: number;
  savingsRateTarget: number;
  savingsRateStatus: "OPTIMAL" | "BELOW_TARGET";
  cumulativeVaultInflow: number;
  cumulativeVaultOutflow: number;
  netVaultBalance: number;
  cumulativePlannedSavings: number;
  cumulativeSavingsTarget: number;
  vaultRealizationRatePercent: number;
  untransferredPlannedSavings: number;
  totalIncomeAcrossPeriods: number;
  totalOutflowAcrossPeriods: number;
  totalLiabilitiesAcrossPeriods: number;
  totalCreditBillsAcrossPeriods: number;
  totalEssentialAndFixedAcrossPeriods: number;
  totalOperationalAndFixedAcrossPeriods: number;
  totalSelfRewardAcrossPeriods: number;
  totalRetainedAndSurplusAcrossPeriods: number;
  overallDebtRatioPercent: number;
  overallCreditDebtRatioPercent: number;
}

export interface CashflowPeriodEntry {
  month: number;
  year: number;
  periodLabel: string;
  status: "DRAFT" | "LOCKED";
  totalIncome: number;
  totalLiabilitiesAndDeductions: number;
  creditBillsAmount: number;
  manualDeductionsAmount: number;
  essentialOutflow: number;
  operationalAndFixedOutflow: number;
  actualDailyOperational: number;
  fixedExpenses: number;
  bufferPocket: number;
  totalOutflow: number;
  actualSavings: number;
  savingsTarget: number;
  selfRewardSurplus: number;
  totalRetainedAndSurplus: number;
  deficitUncovered: number;
  savingsRatePercent: number;
  debtRatioPercent: number;
  creditDebtRatioPercent: number;
}

export interface CategorySubItem {
  key: string;
  label: string;
  amount: number;
  shareOfCategoryPercent: number;
  shareOfIncomePercent: number;
}

export interface CategoryDistributionEntry {
  key: MacroCategoryKey;
  label: string;
  totalAmount: number;
  monthlyAverage: number;
  shareOfIncomePercent: number;
  shareOfOutflowPercent: number;
  subItems: CategorySubItem[];
}

export interface TrajectoryMilestone {
  month: number;
  year: number;
  periodLabel: string;
  debtRatioPercent: number;
  savingsRatePercent: number;
  totalLiabilitiesAndDeductions: number;
  totalRetainedAndSurplus: number;
}

export interface TrajectorySummary {
  peakDebtPeriod: TrajectoryMilestone | null;
  lowestDebtPeriod: TrajectoryMilestone | null;
  debtSafeInflectionPeriod: TrajectoryMilestone | null;
  surplusCrossoverPeriod: TrajectoryMilestone | null;
  firstPeriodDebtRatioPercent: number;
  lastPeriodDebtRatioPercent: number;
  debtRatioDeltaPts: number;
}

export interface AnalyticsReportResult {
  scope: AnalyticsScope;
  periodCount: number;
  lockedCount: number;
  draftCount: number;
  totalAvailableSnapshotsCount: number;
  lockedSnapshotsCount: number;
  dateRangeLabel: string;
  kpis: AnalyticsKpis;
  cashflowSeries: CashflowPeriodEntry[];
  categoryDistribution: CategoryDistributionEntry[];
  trajectorySummary: TrajectorySummary;
}

export async function fetchAnalytics(
  scope: AnalyticsScope = "all"
): Promise<AnalyticsReportResult | null> {
  const res = await fetch(`${API_URL}/api/analytics?scope=${scope}`, {
    cache: "no-store",
  });
  return handleResponse<AnalyticsReportResult | null>(res, null);
}


// -----------------------------------------------------------------------------
// Executive Reports & Cash Reconciliation (Step 5)
// -----------------------------------------------------------------------------

export type ReportScope = "all" | "locked";

export interface AllocationDiffRow {
  categoryKey:
    | "DAILY_OPERATIONAL"
    | "TRANSPORT"
    | "INTERNET"
    | "VAPE"
    | "HAIRCUT"
    | "BUFFER"
    | "SAVINGS"
    | "SELF_REWARD";
  label: string;
  tier: "UPFRONT_OPERATIONAL" | "UPFRONT_FIXED" | "UPFRONT_BUFFER" | "P1_SAVINGS" | "P2_REWARD";
  baselineTarget: number;
  revisedTarget: number;
  revisionDelta: number;
  revisionCount: number;
  actualOutcome: number;
  fundingVariance: number;
}

export interface ItemizedReportCreditCardCharge {
  id: number;
  label: string;
  category: string;
  chargeType: "FULL" | "INSTALLMENT" | "RECURRING";
  chargeTypeLabel: string;
  sliceBadge: string | null;
  totalAmount: number;
  dueAmount: number;
  remainingPrincipalAfterPeriod: number;
  billingMonth: number;
  billingYear: number;
  isNewThisPeriod: boolean;
  endedAtLabel: string | null;
  transactionDate: string;
}

export interface ItemizedReportDailyExpense {
  id: number;
  label: string;
  amount: number;
  signedAmount: number;
  date: string;
  kind:
    | "OPERATIONAL_EXPENSE"
    | "FIXED_ESSENTIAL_EXPENSE"
    | "OPERATIONAL_REFUND";
  kindLabel: string;
  fixedEssentialCategory: string | null;
  fixedEssentialCategoryLabel: string | null;
}

export interface RoutineBillRealizationRow {
  categoryKey: "TRANSPORT" | "INTERNET" | "VAPE" | "HAIRCUT";
  label: string;
  initialPlan: number;
  revisedBudget: number;
  revisionDelta: number;
  revisionCount: number;
  loggedRealization: number;
  coveredByPool: number;
  remainingPool: number;
  overage: number;
  statusLabel: string;
}

export interface CostDriverItem {
  key: string;
  label: string;
  amount: number;
  shareOfIncomePercent: number;
  detail: string;
}

export interface MonthSpikeItem {
  key: string;
  label: string;
  previousAmount: number;
  currentAmount: number;
  deltaAmount: number;
  deltaPercent: number | null;
  explanation: string;
}

export interface MoneyDriversAndSpikes {
  previousPeriodLabel: string | null;
  biggestCostDriversHeadline: string;
  costDrivers: CostDriverItem[];
  monthOverMonthHeadline: string;
  spikes: MonthSpikeItem[];
  budgetRevisionSummaryText: string | null;
}

export interface PaydayExecutionChecklist {
  creditDueDay: number;
  paylaterDueDay: number;
  step1SetAsideForDebt: {
    totalAmount: number;
    paylaterAmount: number;
    creditCardAmount: number;
    personalDebtAmount: number;
    contractInstallmentsAmount: number;
  };
  step2KeepInOperationalAccount: {
    totalAmount: number;
    fixedRoutinePoolAmount: number;
    fundedDailyLivingAmount: number;
    bufferPocketAmount: number;
  };
  step3TransferToSavingsVault: {
    fundedP1Savings: number;
    realizedInVault: number;
    pendingTransferAmount: number;
    transferStatus: "TRANSFERRED" | "PARTIAL" | "PENDING" | "NO_SAVINGS_FUNDED";
    statusLabel: string;
  };
  step4FreeSelfRewardAllowance: {
    fundedP2Allowance: number;
  };
}

export interface MoneyCycleStep4DailyLiving {
  initialPlan: number;
  currentMonthlyCap: number;
  fundedAmount: number;
  grossDailyExpensesLogged: number;
  fixedEssentialOverage: number;
  operationalRefundsOffset: number;
  netDailySpendUsed: number;
  remainingOperationalCash: number;
  safeToSpendToday: number;
  baselineDailyRate: number;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  cycleDateLabel: string;
  isEndDateConfirmed: boolean;
  pacingStatus: string;
  itemizedDailyExpenses: ItemizedReportDailyExpense[];
}

export interface MoneyCycleStep5SavingsBottomLine {
  p1Target: number;
  p1Baseline: number;
  p1Funded: number;
  realizedInVaultTotal: number;
  realizedInVaultLiquidCash: number;
  realizedInVaultInvestmentRdpu: number;
  untransferredP1Savings: number;
  vaultTotalBalance: number;
  vaultLiquidCashBalance: number;
  vaultInvestmentRdpuBalance: number;
  p2Target: number;
  p2Funded: number;
  netSavedAndLeftover: number;
  isDeficit: boolean;
  deficitUncovered: number;
  verdictStatus: "SURPLUS" | "BREAKEVEN" | "DEFICIT";
  verdictHeadline: string;
  verdictDescription: string;
}

export interface MonthlyClosingStatement {
  month: number;
  year: number;
  periodLabel: string;
  workingDaysWindowLabel: string;
  status: "DRAFT" | "LOCKED" | "UNINITIALIZED";
  generatedAtIso: string;
  payroll: PayrollResult & {
    incomeTransactions: Array<{
      id: number;
      label: string;
      amount: number;
      date: string;
    }>;
  };
  upfrontAndWaterfall: {
    paylaterBills: number;
    creditCardBills: number;
    personalDebtBills: number;
    contractInstallments: number;
    totalCreditBills: number;
    manualDeductions: number;
    totalDeductions: number;
    fixedEssentialsBaseline: number;
    fixedEssentialsRevised: number;
    fixedEssentialsActual: number;
    dailyOperationalBaseline: number;
    dailyOperationalRevised: number;
    actualDailyOperational: number;
    bufferPocketBaseline: number;
    bufferPocketRevised: number;
    actualBufferPocket: number;
    savingsBaseline: number;
    savingsRevised: number;
    actualSavings: number;
    selfRewardBaseline: number;
    selfRewardRevised: number;
    actualSelfReward: number;
    availableFunds: number;
    deficitUncovered: number;
    isDeficit: boolean;
    netRetainedSurplus: number;
    allocationDiffRows: AllocationDiffRow[];
  };
  pacing: DailyPacing;
  governance: {
    disciplineScore: number;
    greenCount: number;
    yellowCount: number;
    redCount: number;
    ccUsage: number;
    ccUsageLimit: number;
    paylaterUsage: number;
    paylaterUsageLimit: number;
    budgetRevisionCount: number;
    realizedVaultDeposit: number;
    untransferredP1Savings: number;
  };
  moneyCycle: {
    kpis: {
      totalMoneyIn: number;
      netPaycheck: number;
      extraInflow: number;
      totalDebtAndBillsPaid: number;
      debtShareOfIncomePercent: number;
      livingAndRoutineSpend: number;
      livingShareOfIncomePercent: number;
      netSavedAndLeftover: number;
    };
    driversAndSpikes: MoneyDriversAndSpikes;
    paydayChecklist: PaydayExecutionChecklist;
    itemizedCreditCardCharges: ItemizedReportCreditCardCharge[];
    routineBillsRealization: {
      rows: RoutineBillRealizationRow[];
      totalInitialPlan: number;
      totalRevisedBudget: number;
      totalLoggedRealization: number;
      totalRemainingPool: number;
      totalOverage: number;
    };
    dailyLiving: MoneyCycleStep4DailyLiving;
    savingsBottomLine: MoneyCycleStep5SavingsBottomLine;
  };
}

export interface ComparativePeriodRow {
  month: number;
  year: number;
  periodLabel: string;
  status: "DRAFT" | "LOCKED";
  finalTotalIncome: number;
  creditBillsAmount: number;
  manualDeductionsAmount: number;
  fixedEssentialsAmount: number;
  actualDailyOperational: number;
  bufferPocketAmount: number;
  routineAndDailyLivingAmount: number;
  actualSavings: number;
  selfReward: number;
  deficitUncovered: number;
  creditDebtRatioPercent: number;
  savingsRatePercent: number;
  disciplineScore: number;
  realizedVaultAmount: number;
  incomeMoMDelta: number | null;
  incomeMoMPercent: number | null;
  creditBillsMoMDelta: number | null;
  savingsMoMDelta: number | null;
  disciplineMoMDelta: number | null;
  changeVsLastMonthSummary: string;
}

export interface MultiPeriodComparativeStatement {
  scope: ReportScope;
  periodCount: number;
  periods: ComparativePeriodRow[];
  totals: {
    totalIncome: number;
    totalCreditBills: number;
    totalManualDeductions: number;
    totalFixedEssentials: number;
    totalDailyOperational: number;
    totalBufferPocket: number;
    totalSavings: number;
    totalSelfReward: number;
    totalRealizedVault: number;
    averageCreditDebtRatioPercent: number;
    averageSavingsRatePercent: number;
    averageDisciplineScore: number;
  };
}

export interface AmortizationSliceDetail {
  label: string;
  amount: number;
  sliceBadge: string;
  isFinalSlice: boolean;
  sourceKind: "CC_INSTALLMENT" | "CONTRACT";
}

export interface AmortizationSubscriptionDetail {
  label: string;
  amount: number;
  endedAtLabel: string | null;
  isFinalMonth: boolean;
}

export interface AmortizationMonthRow {
  month: number;
  year: number;
  periodLabel: string;
  paylaterAmount: number;
  creditCardAmount: number;
  personalDebtAmount: number;
  contractInstallmentsAmount: number;
  totalLiabilityDue: number;
  cumulativeSettledPercent: number;
  activeInstallmentSlices: AmortizationSliceDetail[];
  activeSubscriptions: AmortizationSubscriptionDetail[];
  droppingOffAfterThisMonth: string[];
}

export interface LiabilityAmortizationSchedule {
  startMonth: number;
  startYear: number;
  months: AmortizationMonthRow[];
  summary: {
    total12MonthObligations: number;
    totalPaylater12M: number;
    totalCreditCard12M: number;
    totalPersonalDebt12M: number;
    totalContracts12M: number;
    peakMonthLabel: string;
    peakMonthAmount: number;
    firstDebtFreeMonthLabel: string | null;
  };
}

export interface DossierRevisionItem {
  id: number;
  month: number;
  year: number;
  periodLabel: string;
  category: string;
  categoryLabel: string;
  previousValue: number;
  newValue: number;
  difference: number;
  reason: string;
  createdAt: string;
}

export interface DossierPeriodAuditItem {
  month: number;
  year: number;
  periodLabel: string;
  status: "DRAFT" | "LOCKED";
  disciplineScore: number;
  greenCount: number;
  redCount: number;
  flags: AuditFlag[];
}

export interface DossierGovernanceLogItem {
  id: number;
  action: string;
  actionLabel: string;
  category: string;
  categoryLabel: string;
  severity: string;
  summary: string;
  details: string | null;
  month: number | null;
  year: number | null;
  createdAt: string;
}

export interface BudgetRevisionAndDisciplineDossier {
  revisions: DossierRevisionItem[];
  periodAudits: DossierPeriodAuditItem[];
  recentGovernanceLogs: DossierGovernanceLogItem[];
}

export interface ProjectedMonthLiquidity {
  monthOffset: number;
  month: number;
  year: number;
  periodLabel: string;
  sourceMode: "EXISTING_SNAPSHOT" | "MASTER_BASELINE_PROJECTION";
  expectedPaydayDateIso: string;
  expectedPaydayLabel: string;
  cycleDateLabel: string;
  projectedNetSalaryIncome: number;
  projectedExtraIncome: number;
  projectedFinalTotalIncome: number;
  projectedFixedEssentials: number;
  projectedDailyOperationalTarget: number;
  projectedBufferPocket: number;
  liabilities: {
    contractsTotal: number;
    scheduledBillsTotal: number;
    creditCardsTotal: number;
    bulkBillsTotal: number;
    projectedTotalDeductions: number;
    debtRatioPercent: number;
    debtStatus: string;
    activeInstallmentItems: Array<{
      label: string;
      amount: number;
      sliceBadge: string;
      isFinalSlice: boolean;
    }>;
    endingSubscriptions: Array<{
      label: string;
      amount: number;
      endedAtLabel: string;
    }>;
  };
  waterfall: {
    availableFundsBeforeWaterfall: number;
    p1SavingsTarget: number;
    projectedFundedSavings: number;
    projectedSelfRewardSurplus: number;
    projectedDailyOperational: number;
    projectedDeficitUncovered: number;
    isDeficit: boolean;
  };
  liquidityStatus:
    | "HEALTHY_SURPLUS"
    | "SAVINGS_COMPRESSED"
    | "DEFICIT_SQUEEZE";
  isLiquiditySqueeze: boolean;
  recommendedP1SavingsReduction: number;
  squeezeBannerText: string | null;
}

export interface ExecutiveLiquidityForecastReport {
  basePeriod: {
    month: number;
    year: number;
    periodLabel: string;
  };
  horizonMonths: number;
  months: ProjectedMonthLiquidity[];
  summary: {
    totalProjectedIncome3M: number;
    totalProjectedDeductions3M: number;
    totalProjectedSavings3M: number;
    totalProjectedFreeCashflow3M: number;
    squeezeMonthsCount: number;
    maxRecommendedSavingsReduction: number;
    expiringInstallmentsNext3M: number;
    monthlyCashflowReliefFromExpiring: number;
    headlineAdvisory: string;
  };
}

export interface ExecutiveReportPayload {
  selectedMonth: number;
  selectedYear: number;
  scope: ReportScope;
  profileMode?: "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL";
  closingStatement: MonthlyClosingStatement;
  comparativeStatement: MultiPeriodComparativeStatement;
  amortizationSchedule: LiabilityAmortizationSchedule;
  dossier: BudgetRevisionAndDisciplineDossier;
  liquidityForecast?: ExecutiveLiquidityForecastReport;
}

export async function fetchExecutiveReport(
  month: number,
  year: number,
  scope: ReportScope = "all"
): Promise<ExecutiveReportPayload | null> {
  const res = await fetch(
    `${API_URL}/api/reports?month=${month}&year=${year}&scope=${scope}`,
    { cache: "no-store" }
  );
  return handleResponse<ExecutiveReportPayload | null>(res, null);
}

export type SurplusResolutionMode =
  | "INCREASE_OPERATIONAL_TARGET"
  | "RECORD_INCOME_ADJUSTMENT"
  | "RECORD_OPERATIONAL_REFUND";

export type DiscrepancyDirection = "MATCHED" | "SHORTFALL" | "SURPLUS";

export type ReconciliationActionType =
  | "NO_OP"
  | "RECORD_DEDUCTION_ADJUSTMENT"
  | "REVISE_OPERATIONAL_TARGET"
  | "RECORD_INCOME_ADJUSTMENT"
  | "RECORD_OPERATIONAL_REFUND";

export interface ReconciliationStateMetrics {
  finalTotalIncome: number;
  totalDeductions: number;
  dailyOperationalTarget: number;
  actualDailyOperational: number;
  totalDailySpent: number;
  remainingBudget: number;
  safeToSpendToday: number;
  baselineDailyRate: number;
  pacingStatus: DailyPacing["pacingStatus"];
  actualSavings: number;
  selfReward: number;
  deficitUncovered: number;
  isDeficit: boolean;
}

export interface CashReconciliationPreview {
  periodMonth: number;
  periodYear: number;
  snapshotStatus: "DRAFT" | "LOCKED" | "UNINITIALIZED";
  systemRemainingBudget: number;
  actualRealBalance: number;
  includesUnspentRoutinePool?: boolean;
  remainingRoutineBillsPool?: number;
  effectiveOperationalCashBalance?: number;
  varianceAmount: number;
  adjustmentAmount: number;
  discrepancyDirection: DiscrepancyDirection;
  surplusResolutionMode: SurplusResolutionMode;
  resolvedActionType: ReconciliationActionType;
  daysRemaining: number;
  cycleDateLabel: string;
  current: ReconciliationStateMetrics;
  projected: ReconciliationStateMetrics;
  impact: {
    triggersWaterfallDeficit: boolean;
    worsensWaterfallDeficit: boolean;
    reducesPriority1Savings: boolean;
    savingsReductionAmount: number;
    reducesPriority2SelfReward: boolean;
    selfRewardReductionAmount: number;
    warnings: string[];
  };
}

export async function previewCashReconciliation(data: {
  month: number;
  year: number;
  actualRealBalance: number;
  surplusResolutionMode?: SurplusResolutionMode;
  includesUnspentRoutinePool?: boolean;
}): Promise<{ success: boolean; data?: CashReconciliationPreview; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/reconcile-balance/preview`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to preview cash reconciliation",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function executeCashReconciliation(data: {
  month: number;
  year: number;
  actualRealBalance: number;
  surplusResolutionMode?: SurplusResolutionMode;
  includesUnspentRoutinePool?: boolean;
  note?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/reconcile`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to execute cash reconciliation",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}



export interface GlobalSearchResultItem {
  id: number;
  snapshotId: number;
  month: number;
  year: number;
  snapshotStatus: "DRAFT" | "LOCKED";
  type: "INCOME" | "DEDUCTION" | "CREDIT_BILL";
  sourceType:
    | "MANUAL"
    | "CONTRACT"
    | "CC_TRANSACTION"
    | "BULK_BILL"
    | "PERSONAL_DEBT"
    | "OPERATIONAL_REFUND";
  fixedEssentialCategory: FixedEssentialCategory | null;
  label: string;
  amount: number;
  date: string;
}

export interface GlobalSearchResponse {
  query: string;
  totalMatches: number;
  totalDeductionsMatched: number;
  totalIncomeMatched: number;
  items: GlobalSearchResultItem[];
}

export async function searchGlobalTransactions(params: {
  q?: string;
  type?: string;
  sourceType?: string;
  fixedEssentialCategory?: string;
  limit?: number;
}): Promise<GlobalSearchResponse | null> {
  try {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.type) sp.set("type", params.type);
    if (params.sourceType) sp.set("sourceType", params.sourceType);
    if (params.fixedEssentialCategory)
      sp.set("fixedEssentialCategory", params.fixedEssentialCategory);
    if (params.limit) sp.set("limit", String(params.limit));
    const res = await fetch(`${API_URL}/api/finance/search?${sp.toString()}`, {
      cache: "no-store",
    });
    return handleResponse<GlobalSearchResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function exportDatabaseBackup(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/config/backup`, {
      cache: "no-store",
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: body.message || "Failed to export ERP backup",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


export async function restoreDatabaseBackup(payload: {
  confirmPhrase: string;
  backup: any;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/config/restore`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to restore ERP backup",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export interface RoutineCategoryConfig {
  id: string;
  label: string;
  target: number;
  isCustom?: boolean;
  hidden?: boolean;
}

export async function resetDemoSandbox(): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/auth/reset-demo`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: body.message || "Failed to reset demo sandbox",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchRoutineCategories(): Promise<RoutineCategoryConfig[]> {
  try {
    const res = await fetch(`${API_URL}/api/config/routine-categories`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function addRoutineCategory(payload: {
  label: string;
  target: number;
}): Promise<{
  success: boolean;
  data?: RoutineCategoryConfig[];
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/config/routine-categories`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to add routine category",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function removeRoutineCategory(
  id: string
): Promise<{
  success: boolean;
  data?: RoutineCategoryConfig[];
  error?: string;
}> {
  try {
    const res = await fetch(
      `${API_URL}/api/config/routine-categories/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: await getAuthHeaders(),
      }
    );
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: body.message || "Failed to remove routine category",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function initializeNewPeriod(payload: {
  month: number;
  year: number;
}): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json();
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to initialize new period",
      };
    }
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


// ============================================================================
// PHASE 9: MULTI-TENANT AUTH & PLATFORM ADMIN API
// ============================================================================

export type UserRole =
  | "PLATFORM_OWNER"
  | "BESPOKE_CLIENT"
  | "STANDARD_MEMBER"
  | "DEMO_SANDBOX";

export type UserStatus = "ACTIVE" | "SUSPENDED";

export type BlueprintType = "SUPERADMIN_BESPOKE" | "STANDARD_GENERAL";

export interface AuthenticatedUser {
  id: number;
  accountName?: string;
  username?: string;
  email: string;
  fullName: string;
  role: UserRole;
  blueprintType: BlueprintType;
  lifeStagePreset?: LifeStagePreset;
  uiDensityMode?: UiDensityMode;
  status: UserStatus;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken?: string;
  expiresIn?: number;
  user?: AuthenticatedUser;
  requiresPin?: boolean;
  detectedIp?: string;
  message?: string;
}

export interface AdminUserSummary {
  id: number;
  accountName?: string;
  username?: string;
  email: string;
  fullName: string;
  role: UserRole;
  blueprintType: BlueprintType;
  lifeStagePreset?: LifeStagePreset;
  uiDensityMode?: UiDensityMode;
  status: UserStatus;
  snapshotCount: number;
  createdAt: string;
}

export interface ModuleRegistryItem {
  key: ModuleKey;
  label: string;
  route: string;
  isCore: boolean;
  description: string;
}

export const MODULE_REGISTRY_CATALOG: ModuleRegistryItem[] = [
  {
    key: "overview",
    label: "Overview Dashboard",
    route: "/",
    isCore: true,
    description: "Real-time daily pacing, waterfall summary, and cycle health.",
  },
  {
    key: "corporate_payroll",
    label: "Payroll & Income",
    route: "/payroll",
    isCore: false,
    description: "Salary, allowances, freelance streams, pension inflows, and THR.",
  },
  {
    key: "allocations",
    label: "Budget & Allocations",
    route: "/allocations",
    isCore: true,
    description: "Selectable formula engines (Waterfall, Savings Lock, 50/30/20, Drawdown) and routine envelopes.",
  },
  {
    key: "credit_liabilities",
    label: "Credits & Debts",
    route: "/credits",
    isCore: false,
    description: "12-month liability matrix, credit cards, PayLater, and installment contracts.",
  },
  {
    key: "savings_vault",
    label: "Savings & Goals",
    route: "/savings",
    isCore: false,
    description: "Dual-instrument vault (Liquid Cash & RDPU), goal tracking, and wealth target planner.",
  },
  {
    key: "wishlist_simulator",
    label: "Wishlist Simulator",
    route: "/wishlist",
    isCore: false,
    description: "Cash vs. installment affordability simulator and debt-ratio guard.",
  },
  {
    key: "ledger",
    label: "Transactions Ledger",
    route: "/ledger",
    isCore: true,
    description: "Unified cash movement history, bank CSV import, and balance reconciliation.",
  },
  {
    key: "discipline_audit",
    label: "Discipline Audit",
    route: "/audit",
    isCore: false,
    description: "100-point financial discipline scorecard and immutable governance log.",
  },
  {
    key: "advanced_analytics",
    label: "Analytics & Velocity",
    route: "/analytics",
    isCore: false,
    description: "Multi-month cashflow velocity, debt burn-down, and net worth trajectory.",
  },
  {
    key: "executive_reports",
    label: "Executive Reports",
    route: "/reports",
    isCore: false,
    description: "Printable monthly closing statement, comparative statement, and 3-month liquidity forecast.",
  },
  {
    key: "preferences",
    label: "Preferences & Modules",
    route: "/preferences",
    isCore: true,
    description: "Self-service module manager, UI density switcher, and bespoke rule request studio.",
  },
];

export interface LifeStagePresetMeta {
  id: LifeStagePreset;
  title: string;
  ageRange: string;
  subtitle: string;
  formulaEngineType: FormulaEngineType;
  formulaLabel: string;
  uiDensityMode: UiDensityMode;
  enabledModules: ModuleKey[];
  routineCategories: Array<{ id: string; label: string; target: number }>;
  defaultSalary: number;
  defaultDailyLiving: number;
  defaultSavings: number;
}

export const LIFE_STAGE_PRESET_CATALOG: LifeStagePresetMeta[] = [
  {
    id: "STUDENT_FIRST_JOBBER",
    title: "Student / First-Jobber",
    ageRange: "Ages 18–24",
    subtitle: "Allowance or entry salary with Pay-Yourself-First savings lock and zero corporate payroll clutter.",
    formulaEngineType: "SAVINGS_FIRST_LOCK",
    formulaLabel: "Savings-First Lock (20% Locked First)",
    uiDensityMode: "COMMAND_COCKPIT",
    enabledModules: [
      "overview",
      "income",
      "corporate_payroll",
      "allocations",
      "ledger",
      "savings_vault",
      "wishlist_simulator",
      "preferences",
    ],
    routineCategories: [
      { id: "transport", label: "Kos / Boarding & Utilities", target: 1500000 },
      { id: "internet", label: "Campus Commute & Transit", target: 400000 },
      { id: "vape", label: "Mobile Data & Subscriptions", target: 250000 },
      { id: "haircut", label: "Study Materials & Personal Care", target: 200000 },
    ],
    defaultSalary: 5000000,
    defaultDailyLiving: 1800000,
    defaultSavings: 1000000,
  },
  {
    id: "CORPORATE_PROFESSIONAL",
    title: "Corporate Professional",
    ageRange: "Ages 24–40",
    subtitle: "Full-suite ERP with corporate payroll, credit card & PayLater matrix, savings vault, and audit.",
    formulaEngineType: "DEBT_FIRST_WATERFALL",
    formulaLabel: "Debt-First Waterfall (Bills -> Routine -> P1 Savings -> P2 Reward)",
    uiDensityMode: "COMMAND_COCKPIT",
    enabledModules: [...ALL_MODULE_KEYS],
    routineCategories: [
      { id: "transport", label: "Housing & Utilities", target: 2000000 },
      { id: "internet", label: "Commute & Fuel", target: 600000 },
      { id: "vape", label: "Internet & Subscriptions", target: 400000 },
      { id: "haircut", label: "Personal Care & Grooming", target: 250000 },
    ],
    defaultSalary: 10000000,
    defaultDailyLiving: 3000000,
    defaultSavings: 1500000,
  },
  {
    id: "FREELANCER_VARIABLE",
    title: "Freelancer / Creator / Variable Earner",
    ageRange: "Ages 22–45",
    subtitle: "Multi-client project payouts with Percentage Split (50/30/20) and tax reserve buckets.",
    formulaEngineType: "PERCENTAGE_SPLIT",
    formulaLabel: "Percentage Split (50% Needs / 30% Wants / 20% Savings)",
    uiDensityMode: "COMMAND_COCKPIT",
    enabledModules: [
      "overview",
      "income",
      "corporate_payroll",
      "allocations",
      "ledger",
      "credit_liabilities",
      "savings_vault",
      "wishlist_simulator",
      "advanced_analytics",
      "preferences",
    ],
    routineCategories: [
      { id: "transport", label: "Tax Reserve & BPJS Mandiri", target: 1000000 },
      { id: "internet", label: "Software, Cloud & Fiber Internet", target: 750000 },
      { id: "vape", label: "Studio / Workspace & Utilities", target: 1500000 },
      { id: "haircut", label: "Client Meetings & Mobility", target: 500000 },
    ],
    defaultSalary: 12000000,
    defaultDailyLiving: 3500000,
    defaultSavings: 2400000,
  },
  {
    id: "FAMILY_HOUSEHOLD",
    title: "Family & Household CFO",
    ageRange: "Ages 30–55",
    subtitle: "Dual-income household, KPR/auto installments, school tuition, groceries, and executive reporting.",
    formulaEngineType: "DEBT_FIRST_WATERFALL",
    formulaLabel: "Debt-First Waterfall (Household Bills -> Education -> Family Reserve)",
    uiDensityMode: "COMMAND_COCKPIT",
    enabledModules: [...ALL_MODULE_KEYS],
    routineCategories: [
      { id: "transport", label: "Mortgage / Housing & Maintenance", target: 4500000 },
      { id: "internet", label: "Children Education & Daycare", target: 2500000 },
      { id: "vape", label: "Household Groceries & Utilities", target: 3000000 },
      { id: "haircut", label: "Family Health & Insurance", target: 1200000 },
    ],
    defaultSalary: 20000000,
    defaultDailyLiving: 4500000,
    defaultSavings: 3000000,
  },
  {
    id: "RETIREE_GOLDEN_AGE",
    title: "Golden Age / Retiree",
    ageRange: "Ages 55–70+",
    subtitle: "Simple Clarity high-contrast layout with Pension + Vault Drawdown and healthcare priority envelopes.",
    formulaEngineType: "RETIREMENT_DRAWDOWN",
    formulaLabel: "Retirement Drawdown (Pension + Vault Drawdown -> Healthcare & Living)",
    uiDensityMode: "SIMPLE_CLARITY",
    enabledModules: [
      "overview",
      "income",
      "corporate_payroll",
      "allocations",
      "ledger",
      "savings_vault",
      "executive_reports",
      "preferences",
    ],
    routineCategories: [
      { id: "transport", label: "Healthcare, Checkups & Supplements", target: 1500000 },
      { id: "internet", label: "Home Electricity, Water & Care", target: 1000000 },
      { id: "vape", label: "Family Gifts & Community", target: 600000 },
      { id: "haircut", label: "Daily Mobility & Leisure", target: 400000 },
    ],
    defaultSalary: 6000000,
    defaultDailyLiving: 2500000,
    defaultSavings: 500000,
  },
];

export interface TrustedIpRecord {
  id: number;
  ipAddress: string;
  label: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SecuritySettings {
  ipWhitelistEnforced: boolean;
  detectedClientIp: string;
  hasSecurityPin?: boolean;
  isDefaultPassword?: boolean;
  isDefaultPin?: boolean;
  ownerEmail?: string;
  trustedIps: TrustedIpRecord[];
}

export async function getAuthHeaders(initHeaders?: HeadersInit): Promise<HeadersInit> {
  const headers = new Headers(initHeaders || {});
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("erp_auth_token");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    const userJson = localStorage.getItem("erp_auth_user");
    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        if (u?.id) headers.set("x-user-id", String(u.id));
      } catch {}
    }
  } else {
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      const token = cookieStore.get("erp_auth_token")?.value;
      if (token) {
        headers.set("Authorization", `Bearer ${decodeURIComponent(token)}`);
      }
      const userId = cookieStore.get("erp_user_id")?.value;
      if (userId) {
        headers.set("x-user-id", userId);
      }
    } catch {}
  }
  return headers;
}

export async function loginUser(payload: {
  accountName?: string;
  username?: string;
  email?: string;
  password: string;
  securityPin?: string;
  trustIp?: boolean;
  ipLabel?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to sign in");
  }
  return data;
}

export async function refreshSessionToken(): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: "POST",
    headers: await getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to refresh session");
  }
  return data;
}

export async function fetchSessionInfo(): Promise<{
  valid: boolean;
  remainingSeconds: number;
  exp?: number;
  user?: AuthenticatedUser;
}> {
  const res = await fetch(`${API_URL}/api/auth/session`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to get session status");
  }
  return data;
}

export async function loginDemoUser(): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/demo-login`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to launch Demo Sandbox");
  }
  return data;
}

export async function verifyAccountPassword(password: string): Promise<{ verified: boolean }> {
  const res = await fetch(`${API_URL}/api/auth/verify-password`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Invalid account password.");
  }
  return data;
}

export async function registerMember(payload: {
  email: string;
  password: string;
  fullName: string;
  lifeStagePreset?: LifeStagePreset;
  uiDensityMode?: UiDensityMode;
  initialSalary?: number;
  dailyLivingBudget?: number;
  coreSavingsTarget?: number;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Registration failed");
  }
  return data;
}

export async function fetchMe(): Promise<{ user: AuthenticatedUser | null; isUnauthorized?: boolean }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      return { user: null, isUnauthorized: true };
    }
    if (!res.ok) {
      return { user: null, isUnauthorized: false };
    }
    const user = await res.json();
    return { user, isUnauthorized: false };
  } catch {
    return { user: null, isUnauthorized: false };
  }
}



// ─────────────────────────────────────────────
// PLATFORM ADMIN CONSOLE APIS (/api/admin)
// ─────────────────────────────────────────────

export async function fetchAdminUsers(): Promise<AdminUserSummary[]> {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Failed to fetch client accounts");
  }
  return await res.json();
}

export async function createAdminClient(payload: {
  email: string;
  fullName: string;
  role: UserRole;
  blueprintType: BlueprintType;
  lifeStagePreset?: LifeStagePreset;
  uiDensityMode?: UiDensityMode;
  password?: string;
  tempPassword?: string;
  initializeSnapshot?: boolean;
  initializeFirstPeriod?: boolean;
  initialSalary?: number;
}): Promise<AuthenticatedUser> {
  const res = await fetch(`${API_URL}/api/admin/clients`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      ...payload,
      password: payload.password || payload.tempPassword || "SundayFunday#2026",
      initializeSnapshot: payload.initializeSnapshot ?? payload.initializeFirstPeriod ?? true,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to create client account");
  }
  return data;
}

export async function updateAdminClient(
  id: number,
  payload: {
    fullName?: string;
    role?: UserRole;
    blueprintType?: BlueprintType;
    lifeStagePreset?: LifeStagePreset;
    uiDensityMode?: UiDensityMode;
    status?: UserStatus;
    password?: string;
    newPassword?: string;
  }
): Promise<AuthenticatedUser> {
  const res = await fetch(`${API_URL}/api/admin/clients/${id}`, {
    method: "PATCH",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      ...payload,
      ...(payload.password || payload.newPassword
        ? { password: payload.password || payload.newPassword }
        : {}),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update client account");
  }
  return data;
}

export async function fetchAdminUserConfig(userId: number): Promise<GlobalConfig> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/config`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load user config");
  }
  return await res.json();
}

export async function updateAdminUserConfig(
  userId: number,
  payload: Partial<GlobalConfig>
): Promise<GlobalConfig> {
  const res = await fetch(`${API_URL}/api/admin/users/${userId}/config`, {
    method: "PATCH",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update user config");
  }
  return data;
}

export async function fetchAdminFeatureRequests(): Promise<CustomFeatureRequest[]> {
  const res = await fetch(`${API_URL}/api/admin/feature-requests`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load feature requests");
  }
  return await res.json();
}

export async function updateAdminFeatureRequest(
  id: number,
  payload: {
    status?: "SUBMITTED" | "IN_REVIEW" | "APPROVED_QUOTED" | "IMPLEMENTED";
    estimatedSetupFee?: number | null;
    adminNotes?: string | null;
  }
): Promise<CustomFeatureRequest> {
  const res = await fetch(`${API_URL}/api/admin/feature-requests/${id}`, {
    method: "PATCH",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update request");
  }
  return data;
}

export async function fetchAdminSecuritySettings(): Promise<SecuritySettings> {
  const res = await fetch(`${API_URL}/api/admin/security/settings`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error("Failed to load security settings");
  }
  return await res.json();
}

export async function addAdminTrustedIp(payload: {
  ipAddress: string;
  label: string;
}): Promise<TrustedIpRecord> {
  const res = await fetch(`${API_URL}/api/admin/security/trusted-ips`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to whitelist IP address");
  }
  return data;
}

export async function removeAdminTrustedIp(id: number): Promise<{ success: boolean }> {
  const res = await fetch(`${API_URL}/api/admin/security/trusted-ips/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error("Failed to remove IP");
  }
  return await res.json();
}

export async function updateAdminSecuritySettings(payload: {
  ipWhitelistEnforced?: boolean;
  newSecurityPin?: string;
  newPassword?: string;
}): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_URL}/api/admin/security/settings`, {
    method: "PATCH",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update security settings");
  }
  return data;
}

export function getAdminBackupDownloadUrl(): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("erp_auth_token") : "";
  return `${API_URL}/api/admin/backup/export${token ? `?token=${encodeURIComponent(token)}` : ""}`;
}

export interface RestoreDryRunSummary {
  users: number;
  globalConfigs: number;
  monthlySnapshots: number;
  transactions: number;
  creditCardTransactions: number;
  monthlyBulkBills: number;
  savingsDeposits: number;
  savingsGoals: number;
  wishlistItems: number;
  auditLogs: number;
  customFeatureRequests: number;
  trustedIpAddresses: number;
  creditContracts: number;
  scheduledBills: number;
  budgetRevisions: number;
}

export interface RestoreBackupResult {
  success?: boolean;
  valid?: boolean;
  mode: "VALIDATE_DRY_RUN" | "RESTORE_OVERWRITE";
  summary?: RestoreDryRunSummary;
  restoredCounts?: RestoreDryRunSummary;
  message?: string;
  restoredAt?: string;
}

export async function restoreAdminBackup(payload: {
  mode: "VALIDATE_DRY_RUN" | "RESTORE_OVERWRITE";
  confirmationText?: string;
  securityPin?: string;
  backup: any;
}): Promise<RestoreBackupResult> {
  const res = await fetch(`${API_URL}/api/admin/backup/restore`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to restore backup");
  }
  return data;
}

export async function updateAdminCredentials(payload: {
  currentPassword: string;
  newEmail?: string;
  newPassword?: string;
  newSecurityPin?: string;
}): Promise<{ success: boolean; message: string; user?: any }> {
  const res = await fetch(`${API_URL}/api/admin/security/credentials`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to update credentials");
  }
  return data;
}

// ─────────────────────────────────────────────
// SUPERADMIN SQL QUERY STUDIO APIS (/api/admin/sql)
// ─────────────────────────────────────────────

export interface SqlTableColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: any;
}

export interface SqlTableSummary {
  tableName: string;
  rowCount: number;
  primaryKey: string;
  columns: SqlTableColumn[];
}

export interface SqlQueryResult {
  success: boolean;
  mode: string;
  executionTimeMs: number;
  rowCount: number;
  rows: any[];
  fields: string[];
  error?: string;
}

export interface SqlRecordsResponse {
  tableName: string;
  primaryKey: string;
  columns: SqlTableColumn[];
  page: number;
  limit: number;
  totalRows: number;
  totalPages: number;
  rows: any[];
}

export async function fetchSqlTables(): Promise<SqlTableSummary[]> {
  const res = await fetch(`${API_URL}/api/admin/sql/tables`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || "Failed to fetch SQL tables");
  }
  return data;
}

export async function executeSqlQuery(payload: {
  sql: string;
  mode?: "READ_ONLY" | "DRY_RUN_ROLLBACK" | "EXECUTE_COMMIT";
}): Promise<SqlQueryResult> {
  const res = await fetch(`${API_URL}/api/admin/sql/query`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.message?.error || data.message || "Failed to execute SQL query";
    const err = new Error(errorMsg);
    (err as any).data = data;
    throw err;
  }
  return data;
}

export async function fetchSqlRecords(
  tableName: string,
  params?: {
    page?: number;
    limit?: number;
    userId?: number;
    search?: string;
    orderBy?: string;
    orderDir?: string;
  }
): Promise<SqlRecordsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.userId !== undefined) query.set("userId", String(params.userId));
  if (params?.search) query.set("search", params.search);
  if (params?.orderBy) query.set("orderBy", params.orderBy);
  if (params?.orderDir) query.set("orderDir", params.orderDir);

  const res = await fetch(
    `${API_URL}/api/admin/sql/records/${encodeURIComponent(tableName)}?${query.toString()}`,
    {
      headers: await getAuthHeaders(),
      cache: "no-store",
    }
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || `Failed to fetch records from "${tableName}"`);
  }
  return data;
}

export async function createSqlRecord(
  tableName: string,
  data: Record<string, any>
): Promise<any> {
  const res = await fetch(
    `${API_URL}/api/admin/sql/records/${encodeURIComponent(tableName)}`,
    {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to insert record into "${tableName}"`);
  }
  return json;
}

export async function updateSqlRecord(
  tableName: string,
  id: any,
  data: Record<string, any>
): Promise<any> {
  const res = await fetch(
    `${API_URL}/api/admin/sql/records/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to update record in "${tableName}"`);
  }
  return json;
}

export async function deleteSqlRecord(
  tableName: string,
  id: any
): Promise<{ success: boolean; deletedId: any; tableName: string; message: string }> {
  const res = await fetch(
    `${API_URL}/api/admin/sql/records/${encodeURIComponent(tableName)}/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: await getAuthHeaders(),
    }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || `Failed to delete record from "${tableName}"`);
  }
  return json;
}
