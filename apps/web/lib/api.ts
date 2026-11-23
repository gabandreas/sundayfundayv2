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
  isManualOverride?: boolean;
  lockedP1?: number | null;
  lockedP2?: number | null;
  bridgeInflowAmount?: number | null;
  oneOffBillsJson?: Array<{ slot: string; label: string; amount: number }> | null;
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
  cycleTemporalState?: "PRE_PAYDAY" | "ACTIVE" | "COMPLETED";
  daysUntilCycleStart?: number;
  daysInCycle: number;
  daysPassed: number;
  daysRemaining: number;
  currentDayIndex: number;
  totalOperationalBudget: number;
  totalDailySpent: number;
  remainingBudget: number;
  baselineDailyRate: number;
  safeToSpendToday: number;
  paceDeltaRp?: number;
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
  pocketsSummary?: {
    totalConfirmedSavingsRp: number;
    totalAllocatedRp: number;
    unallocatedPoolRp: number;
    pockets: SavingsPocketConfig[];
  };
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
  pocketsSummary?: {
    totalConfirmedSavingsRp: number;
    totalAllocatedRp: number;
    unallocatedPoolRp: number;
    pockets: SavingsPocketConfig[];
  } | null;
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

// ─────────────────────────────────────────────
// Zero-Latency SWR In-Memory Client Cache
// ─────────────────────────────────────────────

interface SwrCacheEntry<T> {
  data: T;
  timestamp: number;
}

const clientSwrCache = new Map<string, SwrCacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();
let cacheEpoch = 0;
const SWR_STALE_MS = 60 * 1000; // 60s TTL

export function getCached<T>(key: string): T | undefined {
  if (typeof window === "undefined") return undefined;
  const entry = clientSwrCache.get(key);
  return entry ? (entry.data as T) : undefined;
}

export function setCached<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  clientSwrCache.set(key, { data, timestamp: Date.now() });
}

export function invalidateCache(keyPattern?: string | RegExp): void {
  if (typeof window === "undefined") return;
  cacheEpoch += 1;
  if (!keyPattern) {
    clientSwrCache.clear();
    inFlightRequests.clear();
  } else {
    for (const key of Array.from(clientSwrCache.keys())) {
      if (typeof keyPattern === "string") {
        if (key.includes(keyPattern)) clientSwrCache.delete(key);
      } else if (keyPattern.test(key)) {
        clientSwrCache.delete(key);
      }
    }
    for (const key of Array.from(inFlightRequests.keys())) {
      if (typeof keyPattern === "string") {
        if (key.includes(keyPattern)) inFlightRequests.delete(key);
      } else if (keyPattern.test(key)) {
        inFlightRequests.delete(key);
      }
    }
  }
  window.dispatchEvent(new CustomEvent("erp:data-mutated"));
}

export interface OptimisticMatrixBulkPayload {
  month: number;
  year: number;
  field: "paylaterAmount" | "personalDebtAmount";
  value: number;
}

export interface OptimisticRoutineSpendPayload {
  month: number;
  year: number;
  category: string;
  label: string;
  amount: number;
}

export function dispatchOptimisticMatrixBulk(payload: OptimisticMatrixBulkPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("erp:optimistic-matrix-bulk", { detail: payload })
  );
}

export function dispatchOptimisticRoutineSpend(payload: OptimisticRoutineSpendPayload): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("erp:optimistic-routine-spend", { detail: payload })
  );
}

export function applyOptimisticMatrixBulkPatch(
  matrix: LiabilityMatrixResponse | null,
  payload: OptimisticMatrixBulkPayload
): LiabilityMatrixResponse | null {
  if (!matrix) return matrix;
  const colKey = `${payload.year}-${payload.month}`;
  const targetRow =
    payload.field === "paylaterAmount" ? matrix.payLaterRow : matrix.personalDebtRow;
  const prevCell = targetRow.cells[colKey] ?? { amount: 0, items: [] };
  const prevAmount = prevCell.amount ?? 0;
  const delta = payload.value - prevAmount;
  const nextTotals = {
    ...matrix.totalsPerMonth,
    [colKey]: Math.max(0, (matrix.totalsPerMonth[colKey] ?? 0) + delta),
  };

  const categoryMatch =
    payload.field === "paylaterAmount" ? "PAYLATER" : "PERSONAL_DEBT";
  const existingMonthItems = matrix.lineItemsPerMonth?.[colKey] ?? [];
  const otherItemsSum = existingMonthItems
    .filter((i) => {
      const sameBucket =
        payload.field === "paylaterAmount"
          ? i.category === "PAYLATER"
          : i.category === "PERSONAL_DEBT" || i.category === "P1_VAULT_REFUND";
      const isBaseline =
        payload.field === "paylaterAmount"
          ? i.parentContractId === "PL-BASE-2026" ||
            i.title === "Unitemized Statement Balance" ||
            i.title.startsWith("SPayLater Baseline")
          : i.parentContractId === "PD-BASE" ||
            i.title === "Unitemized Personal Debt" ||
            i.title.startsWith("Personal Debt Baseline") ||
            i.title === "Personal / Peer Obligation";
      return sameBucket && !isBaseline;
    })
    .reduce((sum, i) => sum + Math.round(i.monthlyAmount), 0);

  let updatedBaseline = false;
  const nextMonthItems = existingMonthItems.map((i) => {
    const isBaseline =
      payload.field === "paylaterAmount"
        ? i.category === "PAYLATER" &&
          (i.parentContractId === "PL-BASE-2026" ||
            i.title === "Unitemized Statement Balance" ||
            i.title.startsWith("SPayLater Baseline"))
        : i.category === categoryMatch &&
          (i.parentContractId === "PD-BASE" ||
            i.title === "Unitemized Personal Debt" ||
            i.title.startsWith("Personal Debt Baseline") ||
            i.title === "Personal / Peer Obligation");
    if (!isBaseline || updatedBaseline) return i;
    updatedBaseline = true;
    const nextBaselineAmt = Math.max(0, payload.value - otherItemsSum);
    return {
      ...i,
      monthlyAmount: nextBaselineAmt,
      principalAmount: i.tenorMonths === 1 ? nextBaselineAmt : i.principalAmount,
    };
  });

  const nextCells = {
    ...targetRow.cells,
    [colKey]: {
      ...prevCell,
      amount: payload.value,
    },
  };

  return {
    ...matrix,
    ...(payload.field === "paylaterAmount"
      ? { payLaterRow: { ...matrix.payLaterRow, cells: nextCells } }
      : { personalDebtRow: { ...matrix.personalDebtRow, cells: nextCells } }),
    lineItemsPerMonth: {
      ...matrix.lineItemsPerMonth,
      [colKey]: nextMonthItems,
    },
    totalsPerMonth: nextTotals,
  };
}

export function applyOptimisticRoutineSpendPatch(
  pacing: DailyPacing | null,
  transactions: Transaction[],
  payload: OptimisticRoutineSpendPayload
): { pacing: DailyPacing | null; transactions: Transaction[] } {
  const optimisticTx: Transaction = {
    id: -Date.now(),
    snapshotId: 0,
    type: "DEDUCTION",
    sourceType: "MANUAL",
    sourceId: null,
    fixedEssentialCategory: payload.category as FixedEssentialCategory,
    label: `${payload.label} Quota`,
    amount: Math.round(payload.amount),
    date: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };

  if (!pacing?.fixedEssentialsRealization) {
    return {
      pacing,
      transactions: [optimisticTx, ...transactions],
    };
  }

  let addedOverage = 0;
  let addedCovered = 0;
  const nextItems = pacing.fixedEssentialsRealization.items.map((item) => {
    if (item.category !== payload.category) return item;
    const nextSpent = item.spent + payload.amount;
    const nextCovered = Math.min(item.target, nextSpent);
    const nextOverage = Math.max(0, nextSpent - item.target);
    const nextRemaining = Math.max(0, item.target - nextSpent);
    addedOverage = nextOverage - item.overage;
    addedCovered = nextCovered - item.coveredByPool;
    return {
      ...item,
      spent: nextSpent,
      coveredByPool: nextCovered,
      overage: nextOverage,
      remainingPool: nextRemaining,
      utilizationPercent:
        item.target > 0 ? Math.min(100, Math.round((nextSpent / item.target) * 100)) : 100,
    };
  });

  const nextTotalSpent = pacing.fixedEssentialsRealization.totalSpent + payload.amount;
  const nextTotalCovered = pacing.fixedEssentialsRealization.totalCoveredByPool + addedCovered;
  const nextTotalOverage = pacing.fixedEssentialsRealization.totalOverage + addedOverage;
  const nextTotalRemaining = Math.max(
    0,
    pacing.fixedEssentialsRealization.totalRemainingPool - addedCovered
  );

  return {
    pacing: {
      ...pacing,
      totalDailySpent: pacing.totalDailySpent + addedOverage,
      remainingBudget: Math.max(0, pacing.remainingBudget - addedOverage),
      fixedEssentialsRealization: {
        ...pacing.fixedEssentialsRealization,
        items: nextItems,
        totalSpent: nextTotalSpent,
        totalCoveredByPool: nextTotalCovered,
        totalOverage: nextTotalOverage,
        totalRemainingPool: nextTotalRemaining,
      },
    },
    transactions: [optimisticTx, ...transactions],
  };
}

export async function swrFetch<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  ttlMs = SWR_STALE_MS
): Promise<T> {
  if (typeof window === "undefined") {
    return await fetcher();
  }

  const cached = clientSwrCache.get(cacheKey);
  const now = Date.now();

  // If cached and fresh, return immediately (<1ms)
  if (cached && now - cached.timestamp < ttlMs) {
    return cached.data as T;
  }

  // Deduplicate in-flight requests
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey)!;
  }

  const reqEpoch = cacheEpoch;

  // Stale-While-Revalidate: return stale data immediately and revalidate in background
  if (cached) {
    let bg!: Promise<any>;
    bg = (async () => {
      try {
        const fresh = await fetcher();
        if (reqEpoch === cacheEpoch) {
          clientSwrCache.set(cacheKey, { data: fresh, timestamp: Date.now() });
        }
      } catch {
        // preserve stale data on revalidation failure
      } finally {
        if (inFlightRequests.get(cacheKey) === bg) {
          inFlightRequests.delete(cacheKey);
        }
      }
    })();
    inFlightRequests.set(cacheKey, bg);
    return cached.data as T;
  }

  // Cold cache
  let p!: Promise<T>;
  p = (async () => {
    try {
      const fresh = await fetcher();
      if (reqEpoch === cacheEpoch) {
        clientSwrCache.set(cacheKey, { data: fresh, timestamp: Date.now() });
      }
      return fresh;
    } finally {
      if (inFlightRequests.get(cacheKey) === p) {
        inFlightRequests.delete(cacheKey);
      }
    }
  })();

  inFlightRequests.set(cacheKey, p);
  return await p;
}

export async function fetchSnapshotHorizon(
  startMonth = 10,
  startYear = 2026,
  count = 12
): Promise<MonthlySnapshot[]> {
  return swrFetch(`horizon:snapshots:${startYear}-${startMonth}:${count}`, async () => {
    const res = await fetch(
      `${API_URL}/api/snapshots/horizon?startMonth=${startMonth}&startYear=${startYear}&count=${count}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    const data = await handleResponse<{ periods?: MonthlySnapshot[] } | null>(res, null);
    const list = data?.periods ?? [];
    for (const snap of list) {
      if (snap && snap.month && snap.year) {
        setCached(`snapshot:${snap.month}:${snap.year}`, snap);
      }
    }
    return list;
  }, 5 * 60 * 1000);
}

export async function fetchPayrollHorizon(
  startMonth = 10,
  startYear = 2026,
  count = 12
): Promise<Array<{ month: number; year: number; payroll: PayrollResult }>> {
  return swrFetch(`horizon:payroll:${startYear}-${startMonth}:${count}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/payroll-horizon?startMonth=${startMonth}&startYear=${startYear}&count=${count}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    const data = await handleResponse<{
      periods?: Array<{ month: number; year: number; payroll: PayrollResult }>;
    } | null>(res, null);
    const list = data?.periods ?? [];
    for (const item of list) {
      if (item && item.month && item.year) {
        setCached(`payroll:${item.month}:${item.year}`, item.payroll);
      }
    }
    return list;
  }, 5 * 60 * 1000);
}

export async function prefetchPeriodData(month: number, year: number): Promise<void> {
  if (typeof window === "undefined") return;
  Promise.allSettled([
    fetchSnapshot(month, year),
    fetchPayroll(month, year),
    fetchPacing(month, year),
    fetchTransactions(month, year),
    fetchCardSummary(month, year),
    fetchCreditUsageLimit(month, year),
    fetchExecutiveReport(month, year, "all"),
    fetchSavingsVault(month, year),
  ]).catch(() => {});
}

export async function prefetchHorizonData(
  activeMonth: number,
  activeYear: number
): Promise<void> {
  if (typeof window === "undefined") return;
  const prevMonth = activeMonth === 1 ? 12 : activeMonth - 1;
  const prevYear = activeMonth === 1 ? activeYear - 1 : activeYear;
  const nextMonth = activeMonth === 12 ? 1 : activeMonth + 1;
  const nextYear = activeMonth === 12 ? activeYear + 1 : activeYear;

  Promise.allSettled([
    fetchSnapshotHorizon(10, 2026, 12),
    fetchPayrollHorizon(10, 2026, 12),
    fetchLiabilityMatrix(10, 2026, 12),
    fetchPacing(activeMonth, activeYear),
    fetchTransactions(activeMonth, activeYear),
    fetchPacing(prevMonth, prevYear),
    fetchTransactions(prevMonth, prevYear),
    fetchPacing(nextMonth, nextYear),
    fetchTransactions(nextMonth, nextYear),
    fetchCardSummary(activeMonth, activeYear),
    fetchCardSummary(prevMonth, prevYear),
    fetchCardSummary(nextMonth, nextYear),
    fetchCreditUsageLimit(activeMonth, activeYear),
    fetchCreditUsageLimit(prevMonth, prevYear),
    fetchCreditUsageLimit(nextMonth, nextYear),
    fetchCardTransactions(undefined, undefined, activeMonth, activeYear),
    fetchCardTransactions(undefined, undefined, prevMonth, prevYear),
    fetchCardTransactions(undefined, undefined, nextMonth, nextYear),
    fetchIntelligenceBundle(activeMonth, activeYear),
  ]).catch(() => {});
}

export interface DefaultActivePeriodResponse {
  month: number;
  year: number;
  strategy: "EARLIEST_OPEN_ACTIVE" | "CALENDAR_WINDOW";
  skippedLockedPeriod: boolean;
}

export async function fetchDefaultActivePeriod(): Promise<DefaultActivePeriodResponse | null> {
  return swrFetch("defaultActivePeriod", async () => {
    const res = await fetch(`${API_URL}/api/snapshots/default-period`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<DefaultActivePeriodResponse | null>(res, null);
  });
}

export async function fetchSnapshot(
  month: number,
  year: number
): Promise<MonthlySnapshot | null> {
  return swrFetch(`snapshot:${month}:${year}`, async () => {
    const res = await fetch(`${API_URL}/api/snapshots?month=${month}&year=${year}`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<MonthlySnapshot | null>(res, null);
  });
}

export async function fetchPacing(
  month: number,
  year: number
): Promise<DailyPacing | null> {
  return swrFetch(`pacing:${month}:${year}`, async () => {
    const res = await fetch(`${API_URL}/api/finance/pacing?month=${month}&year=${year}`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<DailyPacing | null>(res, null);
  });
}

export async function fetchTransactions(
  month: number,
  year: number
): Promise<Transaction[]> {
  return swrFetch(`transactions:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/transactions?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<Transaction[]>(res, []);
  });
}

export async function fetchSavingsVault(
  month?: number,
  year?: number
): Promise<SavingsVault | null> {
  const query =
    month !== undefined && year !== undefined
      ? `?month=${month}&year=${year}`
      : "";
  return swrFetch(`savings:${month ?? "all"}:${year ?? "all"}`, async () => {
    const res = await fetch(`${API_URL}/api/savings${query}`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<SavingsVault | null>(res, null);
  });
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
      headers: await getAuthHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { success: false, error: body.message || "Failed to resume recurring subscription" };
    }
    invalidateCache();
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
  return swrFetch(`payroll:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/payroll?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<PayrollResult | null>(res, null);
  });
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
  paymentMethod?: "CASH" | "PAYLATER" | "CC";
  paylaterTenor?: number;
  holdPastCutoff?: boolean;
  billingStartMonth?: number;
  billingStartYear?: number;
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
    invalidateCache();
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
    invalidateCache();
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
    fixedEssentialCategory?: "TRANSPORT" | "INTERNET" | "VAPE" | "HAIRCUT" | null;
    paymentMethod?: "CASH" | "PAYLATER" | "CC";
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
    invalidateCache();
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

export interface SmtpVerificationOutcome {
  ok: boolean;
  host: string;
  port: number;
  secure: boolean;
  fallbackUsed: boolean;
  verifiedAtIso: string;
  errorCode?: string | null;
  summary?: string | null;
  guidance?: string | null;
}

export interface KillSwitchNotificationConfig {
  profileEmail?: string | null;
  killSwitchNotifyEmail: string | null;
  killSwitchSmtpUser: string | null;
  hasSmtpPassword: boolean;
  killSwitchWebhookUrl: string | null;
  killSwitchWaPhone: string | null;
  hasWaApiKey: boolean;
  killSwitchCustomMessageTemplate: string | null;
  smtpVerification?: SmtpVerificationOutcome | null;
}

export interface UpdateKillSwitchNotificationConfigInput {
  killSwitchNotifyEmail?: string;
  killSwitchSmtpUser?: string;
  killSwitchSmtpAppPassword?: string;
  clearSmtpPassword?: boolean;
  resetSmtpConfig?: boolean;
  killSwitchWebhookUrl?: string;
  killSwitchWaPhone?: string;
  killSwitchWaApiKey?: string;
  clearWaApiKey?: boolean;
  killSwitchCustomMessageTemplate?: string;
}

export interface SendReminderResult {
  success: boolean;
  mode?: "SENT" | "ERROR" | "DRY_RUN_PREVIEW";
  configured?: boolean;
  fallbackUsed?: boolean;
  errorCode?: string;
  guidance?: string;
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

export type LiabilityCategory =
  | "PAYLATER"
  | "PERSONAL_DEBT"
  | "CREDIT_CARD"
  | "P1_VAULT_REFUND";

export type BillSettlementState = "UNPAID" | "RESERVED" | "PAID";

export interface LiabilityLineItemDto {
  id: number;
  userId: number;
  month: number;
  year: number;
  category: LiabilityCategory;
  title: string;
  merchantOrPlatform: string;
  principalAmount: number;
  monthlyAmount: number;
  tenorMonths: number;
  installmentIndex: number;
  cutoffDay: number;
  dueDay: number;
  isSettled: boolean;
  isAutoSettled?: boolean;
  settlementState?: BillSettlementState;
  dueDateIso?: string;
  parentContractId: string | null;
  notes: string | null;
}

export interface ActiveInstallmentPlanDto {
  id: string;
  source: "LINE_ITEM" | "CC_TRANSACTION" | "CREDIT_CONTRACT";
  category: string;
  title: string;
  merchantOrPlatform: string;
  principalAmount: number;
  monthlyInstallment: number;
  totalTenor: number;
  remainingPrincipal: number;
  payoffMonth: number;
  payoffYear: number;
  payoffDateLabel: string;
  parentContractId?: string | null;
  cardId?: number;
  canAccelerate: boolean;
  canSettleEarly: boolean;
  isIncludedInMatrixRows: boolean;
  cells: Record<string, { amount: number; sliceBadge?: string }>;
}

export interface LiabilityMatrixColumn {
  month: number;
  year: number;
  key: string;
  label: string;
  cycleWindow: string;
  paysDueMonth: string;
  isPayoutConfirmed: boolean;
}

export interface LiabilityMatrixCardItem {
  id: number;
  label: string;
  chargeType: string;
  amount: number;
  sliceBadge: string | null;
  endedAtLabel: string | null;
  isSettled?: boolean;
  isAutoSettled?: boolean;
  settlementState?: BillSettlementState;
  dueDateIso?: string;
}

export interface PeriodSettlementSummary {
  totalDue: number;
  paidAmount: number;
  reservedAmount: number;
  unpaidAmount: number;
  bankHoldNeeded: number;
}

export interface LiabilityMatrixResponse {
  columns: LiabilityMatrixColumn[];
  payLaterRow: {
    label: string;
    dueDay: number;
    cells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    >;
  };
  creditCardRow: {
    label: string;
    dueDay: number;
    cells: Record<string, { amount: number; items?: LiabilityMatrixCardItem[] }>;
  };
  personalDebtRow: {
    label: string;
    cells: Record<
      string,
      { bulkBillId?: number; amount: number; items?: LiabilityLineItemDto[] }
    >;
  };
  contractRows: Array<{
    id: number | string;
    label: string;
    monthlyInstallment: number;
    source?: "LINE_ITEM" | "CC_TRANSACTION" | "CREDIT_CONTRACT";
    category?: string;
    merchantOrPlatform?: string;
    totalTenor?: number;
    principalAmount?: number;
    remainingPrincipal?: number;
    payoffDateLabel?: string;
    parentContractId?: string | null;
    cardId?: number;
    canAccelerate?: boolean;
    canSettleEarly?: boolean;
    isIncludedInMatrixRows?: boolean;
    cells: Record<string, { amount: number; sliceBadge?: string }>;
  }>;
  activeInstallmentPlans: ActiveInstallmentPlanDto[];
  lineItemsPerMonth: Record<string, LiabilityLineItemDto[]>;
  totalsPerMonth: Record<string, number>;
  settlementSummaryPerMonth?: Record<string, PeriodSettlementSummary>;
}

export async function fetchLiabilityMatrix(
  startMonth = 10,
  startYear = 2026,
  count = 12
): Promise<LiabilityMatrixResponse | null> {
  return swrFetch(`matrix:${startMonth}:${startYear}:${count}`, async () => {
    const res = await fetch(
      `${API_URL}/api/credit/matrix?startMonth=${startMonth}&startYear=${startYear}&count=${count}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<LiabilityMatrixResponse | null>(res, null);
  });
}

export async function fetchCardSummary(
  month: number,
  year: number
): Promise<CreditCardSummary | null> {
  return swrFetch(`cardSummary:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/credit/cards/summary?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<CreditCardSummary | null>(res, null);
  });
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
  const cacheKey = `cardTransactions:${month ?? "all"}:${year ?? "all"}:${contextMonth ?? "none"}:${contextYear ?? "none"}`;
  return swrFetch(cacheKey, async () => {
    const res = await fetch(`${API_URL}/api/credit/cards${query}`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<CreditCardTransaction[]>(res, []);
  });
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
      invalidateCache();
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
      invalidateCache();
      return { success: true };
    }
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function fetchInstallmentPlans(): Promise<ActiveInstallmentPlanDto[]> {
  try {
    const res = await fetch(`${API_URL}/api/credit/installment-plans`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<ActiveInstallmentPlanDto[]>(res, []);
  } catch {
    return [];
  }
}

export async function fetchLineItems(params?: {
  month?: number;
  year?: number;
  category?: LiabilityCategory;
}): Promise<LiabilityLineItemDto[]> {
  try {
    const sp = new URLSearchParams();
    if (params?.month) sp.set("month", String(params.month));
    if (params?.year) sp.set("year", String(params.year));
    if (params?.category) sp.set("category", params.category);
    const query = sp.toString() ? `?${sp.toString()}` : "";
    const res = await fetch(`${API_URL}/api/credit/line-items${query}`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<LiabilityLineItemDto[]>(res, []);
  } catch {
    return [];
  }
}

export async function createLineItem(data: {
  title: string;
  category: LiabilityCategory;
  merchantOrPlatform?: string;
  totalAmount?: number;
  monthlyAmount?: number;
  tenorMonths?: number;
  startMonth?: number;
  startYear?: number;
  purchaseDate?: string;
  autoRouteByCutoff?: boolean;
  holdPastCutoff?: boolean;
  cutoffDay?: number;
  dueDay?: number;
  parentContractId?: string;
  amountMode?: "PRINCIPAL_SPLIT" | "FIXED_MONTHLY";
  notes?: string;
}): Promise<{ success: boolean; data?: LiabilityLineItemDto[]; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to add liability line item",
      };
    }
    invalidateCache();
    return { success: true, data: Array.isArray(body) ? body : [body] };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function shiftLineItem(
  id: number,
  data: {
    direction: "EARLIER" | "LATER";
    shiftAllRemainingInContract?: boolean;
    splitAmount?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items/${id}/shift`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to shift line item",
      };
    }
    invalidateCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function deleteLineItem(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items/${id}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to delete line item",
      };
    }
    invalidateCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function toggleLineItemSettled(
  id: number,
  isSettled: boolean
): Promise<{ success: boolean; data?: LiabilityLineItemDto; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items/${id}/settle`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ isSettled }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update payment status",
      };
    }
    invalidateCache();
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function setLineItemSettlementState(
  id: number,
  settlementState: BillSettlementState
): Promise<{ success: boolean; data?: LiabilityLineItemDto; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items/${id}/settlement-state`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ settlementState }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update settlement state",
      };
    }
    invalidateCache();
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function settleBulkLineItems(params: {
  month: number;
  year: number;
  category?: LiabilityCategory;
  isSettled?: boolean;
  settlementState?: BillSettlementState;
}): Promise<{
  success: boolean;
  data?: {
    updatedCount: number;
    month: number;
    year: number;
    isSettled: boolean;
    settlementState?: BillSettlementState;
  };
  error?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/credit/line-items/settle-bulk`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(params),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update bulk payment status",
      };
    }
    invalidateCache();
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function createBridgeLoan(data: {
  title: string;
  merchantOrPlatform?: string;
  principalAmount: number;
  monthlyInstallment: number;
  tenorMonths: number;
  inflowMonth: number;
  inflowYear: number;
  livingCashAllocation: number;
  routineBillsAllocation: number;
  routineCategorySlot?: "TRANSPORT" | "INTERNET" | "VAPE" | "HAIRCUT";
  routineSlotLabel?: string;
  firstInstallmentMonth: number;
  firstInstallmentYear: number;
  earlyPayoffMonth?: number;
  earlyPayoffYear?: number;
  dueDay?: number;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/bridge-loan`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to record bridge loan",
      };
    }
    invalidateCache();
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function accelerateBridgeLoan(data: {
  parentContractId: string;
  targetMonth: number;
  targetYear: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/credit/bridge-loan/accelerate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to accelerate payoff",
      };
    }
    invalidateCache();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}

export async function borrowFromP1Vault(
  snapshotId: number,
  data: {
    amount: number;
    destination: "SELF_REWARD" | "LIVING_CASH";
    refundMonth: number;
    refundYear: number;
    reason: string;
  }
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/snapshots/${snapshotId}/borrow-p1`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to borrow from P1 savings",
      };
    }
    invalidateCache();
    return { success: true, data: body };
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
    invalidateCache();
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
    invalidateCache();
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
  studioConfig?: ModularStudioConfig;
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
  evaluatedOptimalCeilingRp?: number;
  evaluatedSafeCeilingRp?: number;
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
  maturityMonth?: number;
  maturityYear?: number;
  ccDueDay?: number;
  paylaterDueDay?: number;
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
  return swrFetch(`creditUsageLimit:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/credit/usage-limit?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<CreditLimitCalculationResult | null>(res, null);
  });
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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
    headers: await getAuthHeaders(),
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
    invalidateCache();
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
    isOneOff?: boolean;
    oneOffLabel?: string;
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
    invalidateCache();
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
    const res = await fetch(url, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
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

    const res = await fetch(url, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
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
    invalidateCache();
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
    invalidateCache();
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
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<PaginatedAuditLogs>(res, { items: [], total: 0, page, limit, totalPages: 0 });
}

export async function fetchAuditSummary(): Promise<AuditSummary | null> {
  const res = await fetch(`${API_URL}/api/audit/summary`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<AuditSummary | null>(res, null);
}

export async function fetchAuditReport(): Promise<AuditEvaluationResult | null> {
  const res = await fetch(`${API_URL}/api/audit/report`, {
    headers: await getAuthHeaders(),
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
    headers: await getAuthHeaders(),
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
    overallDisciplineScore?: number;
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
  liabilityLineItems?: Array<{
    id: number;
    month: number;
    year: number;
    periodLabel: string;
    category: string;
    title: string;
    merchantOrPlatform: string;
    principalAmount: number;
    monthlyAmount: number;
    tenorMonths: number;
    installmentIndex: number;
    dueDay: number;
    dueDateIso: string;
    settlementState: BillSettlementState;
    isSettled: boolean;
    parentContractId: string | null;
    notes: string | null;
  }>;
  creditCardScheduleItems?: Array<{
    id: number;
    periodMonth: number;
    periodYear: number;
    periodLabel: string;
    label: string;
    chargeType: string;
    amount: number;
    sliceBadge: string | null;
    endedAtLabel: string | null;
    dueDateIso: string;
    settlementState: BillSettlementState;
    isSettled: boolean;
  }>;
  activeContractsSummary?: Array<{
    id: string;
    source: string;
    category: string;
    title: string;
    merchantOrPlatform: string;
    principalAmount: number;
    monthlyInstallment: number;
    totalTenor: number;
    remainingPrincipal: number;
    payoffMonth: number;
    payoffYear: number;
    payoffDateLabel: string;
  }>;
  settlementTotalsForSelectedPeriod?: PeriodSettlementSummary;
  horizonMetrics?: ExecutiveHorizonResult;
}

export async function fetchExecutiveReport(
  month: number,
  year: number,
  scope: ReportScope = "all"
): Promise<ExecutiveReportPayload | null> {
  return swrFetch(`executiveReport:${month}:${year}:${scope}`, async () => {
    const res = await fetch(
      `${API_URL}/api/reports?month=${month}&year=${year}&scope=${scope}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<ExecutiveReportPayload | null>(res, null);
  });
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
    invalidateCache();
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
      headers: await getAuthHeaders(),
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
      headers: await getAuthHeaders(),
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
    invalidateCache();
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
    invalidateCache();
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
    invalidateCache();
    return { success: true, data: body };
  } catch (error: any) {
    return { success: false, error: error.message || "Network error" };
  }
}


// ============================================================================
// PHASE 9: MULTI-TENANT AUTH & PLATFORM ADMIN API
// ============================================================================

export type UserRole =
  | "SUPERADMIN"
  | "USER"
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
    formulaLabel: "Debt-First Waterfall (Bills -> Routine -> Core Savings -> Flexible Surplus)",
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

function readClientCookieValue(name: string): string | null {
  if (typeof document === "undefined") return null;
  const prefix = `${name}=`;
  const parts = document.cookie.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith(prefix)) {
      try {
        return decodeURIComponent(trimmed.slice(prefix.length));
      } catch {
        return trimmed.slice(prefix.length);
      }
    }
  }
  return null;
}

export async function getAuthHeaders(initHeaders?: HeadersInit): Promise<HeadersInit> {
  const headers = new Headers(initHeaders || {});
  if (typeof window !== "undefined") {
    let token: string | null = null;
    let userJson: string | null = null;
    try {
      token = localStorage.getItem("erp_auth_token");
      userJson = localStorage.getItem("erp_auth_user");
    } catch {}
    if (!token) {
      try {
        token = sessionStorage.getItem("erp_auth_token");
        userJson = userJson || sessionStorage.getItem("erp_auth_user");
      } catch {}
    }
    if (!token) {
      token = readClientCookieValue("erp_auth_token");
    }
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    if (userJson) {
      try {
        const u = JSON.parse(userJson);
        if (u?.id) headers.set("x-user-id", String(u.id));
      } catch {}
    } else {
      const cookieUid = readClientCookieValue("erp_user_id");
      if (cookieUid) headers.set("x-user-id", cookieUid);
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

export async function updateProfile(payload: {
  email?: string;
  fullName?: string;
}): Promise<{ success: boolean; data?: AuthResponse; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/profile`, {
      method: "PATCH",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(body.message)
          ? body.message.join(", ")
          : body.message || "Failed to update profile",
      };
    }
    invalidateCache();
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
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

export interface EmailDispatchResult {
  status: "SENT" | "DRY_RUN_PREVIEW";
  configured: boolean;
  verified?: boolean;
  fallbackUsed?: boolean;
  host?: string;
  port?: number;
  recipientEmail: string;
  locale: "EN" | "ID" | "ZH";
  subject: string;
  messageId: string | null;
  attachmentNames: string[];
  attachmentSizesBytes: number[];
  checksumSha256?: string;
  htmlPreview: string;
  sentAtIso: string;
}

async function postEmailAction<TBody extends Record<string, any>>(
  endpoint: string,
  payload: TBody
): Promise<{
  success: boolean;
  data?: EmailDispatchResult;
  error?: string;
  errorCode?: string;
  guidance?: string;
}> {
  try {
    const res = await fetch(`${API_URL}/api/email/${endpoint}`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: Array.isArray(json.message)
          ? json.message.join(", ")
          : json.message || "Email dispatch request failed",
        errorCode: typeof json.errorCode === "string" ? json.errorCode : undefined,
        guidance: typeof json.guidance === "string" ? json.guidance : undefined,
      };
    }
    return { success: true, data: json };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

export async function sendMonthlyStatementEmail(params: {
  month?: number;
  year?: number;
  scope?: "all" | "locked";
  locale?: "EN" | "ID" | "ZH";
  recipientEmail?: string;
  dryRun?: boolean;
}) {
  return postEmailAction("monthly-statement", params);
}

export async function sendCutoffDigestEmail(params: {
  month?: number;
  year?: number;
  locale?: "EN" | "ID" | "ZH";
  recipientEmail?: string;
  dryRun?: boolean;
}) {
  return postEmailAction("cutoff-digest", params);
}

export async function sendLedgerBackupEmail(params: {
  month?: number;
  year?: number;
  locale?: "EN" | "ID" | "ZH";
  recipientEmail?: string;
  dryRun?: boolean;
}) {
  return postEmailAction("ledger-backup", params);
}

export async function sendTestEmailDispatch(params: {
  locale?: "EN" | "ID" | "ZH";
  recipientEmail?: string;
  dryRun?: boolean;
}) {
  return postEmailAction("test-dispatch", params);
}

export interface EmailStatusResponse {
  mode: "LIVE_SMTP" | "AUTH_ERROR" | "DRY_RUN_PREVIEW";
  configured: boolean;
  verified?: boolean;
  verificationStatus?: "VERIFIED" | "ERROR" | "UNCONFIGURED";
  verifiedAtIso?: string | null;
  fallbackUsed?: boolean;
  errorCode?: string | null;
  verificationError?: string | null;
  verificationGuidance?: string | null;
  host: string;
  port: number;
  secure: boolean;
  smtpUser: string;
  profileEmail?: string | null;
  platformFrom?: string;
  defaultRecipient: string;
  configuredRecipient: string;
  recipientEmail: string;
  hasSmtpPassword: boolean;
  hasAppPassword: boolean;
}

export async function fetchEmailStatus(): Promise<EmailStatusResponse | null> {
  const res = await fetch(`${API_URL}/api/email/status`, {
    headers: await getAuthHeaders(),
    cache: "no-store",
  });
  return handleResponse<EmailStatusResponse | null>(res, null);
}

export async function verifySmtpConnection(): Promise<EmailStatusResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/email/verify`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      cache: "no-store",
    });
    return handleResponse<EmailStatusResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function previewEmailTemplate(params: {
  template:
    | "monthly-statement"
    | "cutoff-digest"
    | "ledger-backup"
    | "test-dispatch"
    | "kill-switch";
  month?: number;
  year?: number;
  scope?: "all" | "locked";
  locale?: "EN" | "ID" | "ZH";
  recipientEmail?: string;
  killSwitchId?: number;
}) {
  return postEmailAction("preview", params);
}

// ---------------------------------------------------------------------------
// Hybrid Go Engine Bridge Endpoints
// ---------------------------------------------------------------------------

export type HybridInstrument =
  | "SPAYLATER"
  | "CREDIT_CARD"
  | "SPINJAM"
  | "PERSONAL_DEBT"
  | "CASH";

export interface CutoffScheduleSliceDto {
  index: number;
  totalTenor: number;
  sliceBadge: string;
  periodMonth: number;
  periodYear: number;
  periodLabel: string;
  dueMonth: number;
  dueYear: number;
  dueDay: number;
  dueDateIso: string;
  amount: number;
}

export interface CutoffSimulateResponse {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  instrument: HybridInstrument;
  amountMode: "PRINCIPAL_SPLIT" | "FIXED_MONTHLY";
  totalPrincipal: number;
  monthlySliceFirst: number;
  monthlySliceLast: number;
  tenorMonths: number;
  cutoffDay: number;
  dueDay: number;
  crossedCutoff: boolean;
  startPeriodMonth: number;
  startPeriodYear: number;
  startPeriodLabel: string;
  firstDueMonth: number;
  firstDueYear: number;
  firstDueDateIso: string;
  endPeriodMonth: number;
  endPeriodYear: number;
  endPeriodLabel: string;
  dsrBeforePercent: number;
  dsrAfterPercent: number;
  nextDsrAfterPercent: number;
  safeHeadroomRemaining: number;
  daysUntilCutoff: number;
  verdict: "SAFE" | "CAUTION" | "WAIT_PAST_CUTOFF" | "OVER_LIMIT";
  advice: string;
  routingSummary: string;
  slices: CutoffScheduleSliceDto[];
}

export interface TimelineEventDto {
  sequence: number;
  dateIso: string;
  label: string;
  category: string;
  waveGroup: string;
  signedAmount: number;
  runningBalance: number;
  isBridgeWindow: boolean;
  notes: string;
}

export interface TimelineSimulateResponse {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  events: TimelineEventDto[];
  wave1AvailableCash: number;
  preThrBridgeMinimumBalance: number;
  postThrBalance: number;
  postPaylaterRemainingBalance: number;
  spaylaterEarlyPayApplied: number;
  spaylaterRemainingAfterEarly: number;
  bridgeSafe: boolean;
  bridgeRiskMessage: string;
  baseline: {
    periodLabel: string;
    paycheckAmount: number;
    thrAmount: number;
    paylaterDue: number;
    creditCardDue: number;
    personalDebtDue: number;
    dailyLivingPool: number;
    routineBillsPool: number;
    coreSavingsTarget: number;
  };
}

export interface FreedCashflowMilestone {
  month: number;
  year: number;
  periodLabel: string;
  freedMonthlyRp: number;
  cumulativeFreedRp: number;
  endingContracts: string[];
}

export interface HorizonPeriodDriver {
  month: number;
  year: number;
  periodLabel: string;
  dsrPercent: number;
  netSavingsRatePct: number;
  effectiveDailyRate: number;
  momDebtDelta: number;
  momIncomeDelta: number;
  narrativeDriver: string;
}

export interface ExecutiveHorizonResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  selectedPeriodLabel: string;
  dsrPercent: number;
  netSavingsRatePercent: number;
  debtBurnDownVelocityRp: number;
  effectiveDailyLivingRate: number;
  totalActiveContracts: number;
  totalRemainingPrincipalRp: number;
  nextMilestoneLabel: string;
  freedUpMilestones: FreedCashflowMilestone[];
  periodDrivers: HorizonPeriodDriver[];
}

export interface ContractsBurndownResponse {
  horizon: ExecutiveHorizonResult;
  plans: ActiveInstallmentPlanDto[];
  contractRows: LiabilityMatrixResponse["contractRows"];
  totalMonthlyCommitmentRp: number;
  debtFreedomLabel: string;
}

export interface WalletGuardResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  remainingLivingCash: number;
  actualWalletBalance: number;
  reservedBillsTotal: number;
  freeSpendableCash: number;
  varianceVsLedger: number;
  guardStatus: "OPTIMAL" | "WATCH" | "SURVIVAL_GUARD";
  effectiveLivingBase: number;
  dailySafeFlat: number;
  dailySafeWeekday: number;
  dailySafeWeekend: number;
  safeToSpendToday: number;
  guidance: string;
}

export interface WalletGuardStatusResponse {
  pacing: DailyPacing;
  settlementSummary: PeriodSettlementSummary;
  savedCheckin: {
    actualWalletBalance: number;
    reservedBillsTotal: number;
    freeSpendableCash: number;
    guardStatus: "OPTIMAL" | "WATCH" | "SURVIVAL_GUARD";
    checkedInAt: string;
    note: string | null;
  } | null;
  guard: WalletGuardResult | null;
}

export async function simulateCutoffApi(payload: {
  title?: string;
  instrument: HybridInstrument;
  amountMode?: "PRINCIPAL_SPLIT" | "FIXED_MONTHLY";
  principalAmount: number;
  monthlyAmount?: number;
  tenorMonths?: number;
  purchaseDate?: string;
  dueDayOverride?: number;
  holdPastCutoff?: boolean;
  startMonthOverride?: number;
  startYearOverride?: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueShiftRule?: string;
  anchorDay?: number;
}): Promise<CutoffSimulateResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/finance/cutoff-simulate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    return handleResponse<CutoffSimulateResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function simulateTimelineApi(payload: {
  month: number;
  year: number;
  spaylaterEarlyPayAmount?: number;
  thrAmountOverride?: number;
  thrDateIso?: string;
  paycheckAmountOverride?: number;
}): Promise<TimelineSimulateResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/finance/timeline-simulate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    return handleResponse<TimelineSimulateResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function fetchContractsBurndown(
  month: number,
  year: number
): Promise<ContractsBurndownResponse | null> {
  return swrFetch(`contractsBurndown:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/contracts-burndown?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<ContractsBurndownResponse | null>(res, null);
  });
}

export async function fetchWalletGuardStatus(
  month: number,
  year: number
): Promise<WalletGuardStatusResponse | null> {
  return swrFetch(`walletGuard:${month}:${year}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/wallet-guard?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<WalletGuardStatusResponse | null>(res, null);
  });
}

export async function evaluateWalletGuardApi(payload: {
  month: number;
  year: number;
  actualWalletBalance: number;
  reservedBillsTotal?: number;
  persist?: boolean;
  note?: string;
}): Promise<WalletGuardStatusResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/finance/wallet-guard`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<WalletGuardStatusResponse | null>(res, null);
    if (payload.persist && data) {
      invalidateCache();
    }
    return data;
  } catch {
    return null;
  }
}

export async function fetchExecutiveHorizon(
  month: number,
  year: number,
  scope: ReportScope = "all"
): Promise<ExecutiveHorizonResult | null> {
  return swrFetch(`executiveHorizon:${month}:${year}:${scope}`, async () => {
    const res = await fetch(
      `${API_URL}/api/reports/executive-horizon?month=${month}&year=${year}&scope=${scope}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<ExecutiveHorizonResult | null>(res, null);
  });
}

// ───────────────────────────────────────────────────────────────────────────
// Modular Preferences Studio & 8-Engine Go Intelligence API Contracts
// ───────────────────────────────────────────────────────────────────────────

export interface SinkingFundConfigRow {
  id: string;
  name: string;
  targetAmountRp: number;
  currentSavedRp: number;
  monthsRemaining: number;
}

export interface PeriodScheduleOverride {
  payslipDateIso?: string;
  paydayDateIso?: string;
  workingDaysCount?: number;
  note?: string;
}

export interface FormulaDefinitions {
  takeHomeSalaryFormula: string;
  proratedThrFormula: string;
  waterfallAllocationFormula: string;
  debtSafeCeilingFormula: string;
  dailySafeToSpendFormula: string;
  trueHourlyWageFormula: string;
  forecasterFreedDebtToP1Formula: string;
}

export interface PaycycleFormulaConfig {
  defaultPeriodStrategy?: "EARLIEST_OPEN_ACTIVE" | "CALENDAR_WINDOW";
  paydayAnchorDay: number;
  payslipAnchorDay?: number;
  payslipShiftRule?: "SHIFT_PREVIOUS_FRIDAY" | "SHIFT_NEXT_WEEKDAY" | "EXACT_DAY" | string;
  reviewLagWorkingDays?: number;
  ledgerEpochMonth?: number;
  ledgerEpochYear?: number;
  shiftWeekendToFriday: boolean;
  periodOverrides?: Record<string, PeriodScheduleOverride>;
  holidayDatesIso?: string[];
  waterfallPriorityOrder: string[];
  p1TargetFloorRp: number;
  defaultDailyFoodBaselineRp: number;
  weekendWeightMultiplier: number;
  workdaysPerWeek: number;
  workHoursPerDay: number;
  dailyCommuteHours: number;
  rdpuAnnualYieldPct: number;
  emergencyFundTargetRp: number;
  variableShockPercent: number;
  attendanceCutoffStartDay?: number;
  attendanceCutoffEndDay?: number;
  bpjsRatePercent?: number;
  laptopAllowanceRp?: number;
  defaultDailyAllowanceRp?: number;
  thrJoinDateIso?: string;
  thrHolidayDateIso?: string;
  optimalDebtRatioPercent?: number;
  maxSafeDebtRatioPercent?: number;
  milestonePriorityOrder?: string[];
  formulas?: FormulaDefinitions;
  sinkingFunds: SinkingFundConfigRow[];
}

export interface InstrumentConfigRow {
  id: string;
  name: string;
  type: "PAYLATER" | "CREDIT_CARD" | "CASH_LOAN" | string;
  cutoffDay: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueDay: number;
  dueRule: "FIXED_DAY" | "DISBURSEMENT_DAY";
  dueShiftRule?: "EXACT_DAY" | "SHIFT_PREVIOUS_FRIDAY" | string;
  monthlyInterestPct: number;
  adminFeePct: number;
  creditLimitRp: number;
  utilizationWarnPct: number;
  lateFeeRule: string;
  active: boolean;
}

export interface AssetAccountConfigRow {
  id: string;
  name: string;
  institution: string;
  accountType: "OPERATIONAL_BANK" | "MONEY_MARKET_RDPU" | "CASH_WALLET" | "SAVINGS_VAULT" | string;
  balanceRp: number;
  annualYieldPct: number;
  includeInRunway: boolean;
  isPrimaryPayroll: boolean;
}

export interface RoutineTemplateConfigRow {
  id: string;
  slotKey: string;
  name: string;
  monthlyQuotaRp: number;
  targetDueDay: number;
  rolloverPolicy: "SWEEP_TO_P1" | "ROLLOVER_NEXT_MONTH";
  active: boolean;
}

export interface CustomSidebarShortcut {
  id: string;
  label: string;
  icon: string;
  targetHref: string;
  sectionGroup: "FINANCIAL_ENGINE" | "AUDIT_DECISION" | "SYSTEM";
}

export interface SidebarNavigationConfig {
  defaultLandingRoute: string;
  moduleOverrides: Record<string, { label?: string; hidden?: boolean; order?: number }>;
  customShortcuts: CustomSidebarShortcut[];
}

export interface PriorityTierConfig {
  key: "SAVINGS" | "DISCRETIONARY" | string;
  label: string;
  order: number;
  enabled: boolean;
}

export interface SavingsPocketConfig {
  id: string;
  key: string;
  name: string;
  category: "EMERGENCY_FUND" | "WISHLIST" | "SINKING_RESERVE" | "CUSTOM";
  allocatedRp: number;
  targetRp: number;
  notes?: string;
}

export interface DisplayPreferencesConfig {
  defaultLanguage: "en" | "id" | "zh";
  numberFormat: "id-ID" | "en-US";
  uiDensity: "COMMAND_COCKPIT" | "SIMPLE_CLARITY";
  hidePriorityCodesInUi: boolean;
}

export interface PrivacyPreferencesConfig {
  maskBalancesByDefault: boolean;
  requirePasswordToReveal: boolean;
}

export interface ModularStudioConfig {
  enableExternalAssetPortfolio?: boolean;
  actualP1VaultBalanceRp?: number | null;
  paycycleFormulaConfig: PaycycleFormulaConfig;
  instrumentsTable: InstrumentConfigRow[];
  assetAccountsTable: AssetAccountConfigRow[];
  routineTemplatesTable: RoutineTemplateConfigRow[];
  sidebarNavigationConfig: SidebarNavigationConfig;
  priorityTiers?: PriorityTierConfig[];
  savingsPockets?: SavingsPocketConfig[];
  displayPreferences?: DisplayPreferencesConfig;
  privacyPreferences?: PrivacyPreferencesConfig;
}

export function resolvePriorityTierLabel(
  studioConfig: ModularStudioConfig | null | undefined,
  key: "SAVINGS" | "DISCRETIONARY",
  fallback: string
): string {
  const hit = studioConfig?.priorityTiers?.find((t) => t.key === key);
  return hit?.label?.trim() || fallback;
}

export interface PaycycleHorizonEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  periodMonth: number;
  periodYear: number;
  periodCode: string;
  payslipDropIso?: string;
  paydayIso: string;
  paydayShiftedFromWeekend: boolean;
  reviewLagWorkingDays?: number;
  overrideApplied?: boolean;
  livingStartIso: string;
  livingEndIso: string;
  nextPaydayIso: string;
  maturityMonth: number;
  maturityYear: number;
  totalCycleDays: number;
  remainingDays: number;
  elapsedDays: number;
  remainingWeekdays: number;
  remainingWeekends: number;
  weekdaySafeRateRp: number;
  weekendSafeRateRp: number;
  flatDailyRateRp: number;
  weekendMultiplier: number;
  cycleTemporalState?: "PRE_PAYDAY" | "ACTIVE" | "COMPLETED";
  daysUntilCycleStart?: number;
}

export interface NetWorthTrajectoryPoint {
  month: number;
  year: number;
  label: string;
  projectedAssetsRp: number;
  remainingDebtRp: number;
  netWorthRp: number;
  monthlyYieldRp: number;
}

export interface NetWorthEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  liquidAssetsRp: number;
  totalAssetsRp: number;
  totalUnpaidDebtRp: number;
  currentCycleDebtRp?: number;
  futureInstallmentPrincipalRp?: number;
  payLaterPrincipalRp: number;
  creditCardPrincipalRp: number;
  personalDebtPrincipalRp: number;
  liquidNetWorthRp: number;
  totalNetWorthRp: number;
  assetToDebtCoveragePct: number;
  debtToAssetLeveragePct: number;
  monthlyRdpuYieldRp: number;
  trajectory: NetWorthTrajectoryPoint[];
}

export interface ForecasterEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  spinjamFreedomDate: string;
  lowDsrMilestoneDate: string;
  emergencyFundCompletionDate: string;
  pureSurvivalRunwayDays: number;
  projected6MWealthBaselineRp: number;
  projected12MWealthBaselineRp: number;
  projected6MWealthZeroLeakRp: number;
  projected12MWealthZeroLeakRp: number;
  projected12MWealthShockRp: number;
  series: Array<{
    month: number;
    year: number;
    label: string;
    baselineWealthRp: number;
    disciplinedWealthRp: number;
    shockWealthRp: number;
    dsrPercent: number;
    remainingPersonalDebtRp: number;
  }>;
}

export interface AnomalyEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  burnVelocityIndex: number;
  pctBudgetConsumed: number;
  pctCycleElapsed: number;
  velocityStatus: "SAFE" | "CAUTION" | "BURNING_FAST" | string;
  postCutoffCreepRp: number;
  subscriptionCreepRp: number;
  alertCount: number;
  alerts: Array<{
    code: string;
    severity: "INFO" | "CAUTION" | "CRITICAL" | string;
    title: string;
    description: string;
    amountRp: number;
  }>;
}

export interface EnvelopesEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  ageOfMoneyDays: number;
  bufferDays: number;
  totalUnspentSweepToP1Rp: number;
  totalUnspentRollForwardRp: number;
  totalSinkingMonthlyRp: number;
  envelopeEvaluations: Array<{
    id: string;
    name: string;
    allocatedRp: number;
    spentRp: number;
    unspentRp: number;
    rolloverPolicy: string;
    sweptToP1Rp: number;
    rolledNextCycleRp: number;
  }>;
  sinkingSchedules: Array<{
    id: string;
    name: string;
    targetAmountRp: number;
    currentSavedRp: number;
    remainingTargetRp: number;
    monthsRemaining: number;
    monthlySetAsideRp: number;
    dailySetAsideRp: number;
    progressPercent: number;
  }>;
}

export interface DebtOptEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  totalRemainingBalanceRp: number;
  totalCurrentMonthlyRp: number;
  extraLumpSumRp: number;
  strategies: Array<{
    strategy: "CONTRACTUAL" | "AVALANCHE" | "SNOWBALL" | string;
    priorityOrderNames: string[];
    estimatedInterestSavedRp: number;
    monthsShaved: number;
    immediateFreedMonthlyRp: number;
    summary: string;
  }>;
  unlockMilestones: Array<{
    unlockMonth: number;
    unlockYear: number;
    unlockLabel: string;
    freedMonthlyRp: number;
    spinjamOnlyFreedRp?: number;
    cumulativeFreedRp: number;
    finishedContracts: string[];
  }>;
  spinjamMonthlyTotalRp: number;
  spinjamFreedomLabel: string;
}

export interface LifeEnergyEngineResult {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  nominalHourlyWageRp: number;
  trueNetHourlyWageRp: number;
  totalMonthlyWorkHours: number;
  totalMonthlyCommuteHours: number;
  totalLifeEnergyHours: number;
  netIncomeAfterWorkCostRp: number;
  conversions: Array<{
    amountRp: number;
    workHoursRequired: number;
    workDaysRequired: number;
    pctOfMonthlyLifePct: number;
  }>;
}

export interface FormulaEvalResult {
  expression: string;
  valid: boolean;
  valueRp: number;
  valueFloat: number;
  usedTokens: string[];
  error?: string;
}

export interface FormulaSuiteResult {
  allValid: boolean;
  results: Record<string, FormulaEvalResult>;
}

export interface DynamicMilestoneSummary {
  code: string;
  targetDateLabel: string;
  remainingAmountRp: number;
  labelEn: string;
  labelId: string;
  labelZh: string;
}

export interface IntelligenceBundleResponse {
  month: number;
  year: number;
  periodCode: string;
  snapshotStatus: string;
  studioConfig: ModularStudioConfig;
  effectiveAssetAccounts?: AssetAccountConfigRow[];
  dynamicMilestone?: DynamicMilestoneSummary;
  formulaContext?: {
    variables: Record<string, number>;
    evaluation: FormulaSuiteResult;
  };
  paycycle: PaycycleHorizonEngineResult;
  networth: NetWorthEngineResult;
  forecaster: ForecasterEngineResult;
  anomaly: AnomalyEngineResult;
  envelopes: EnvelopesEngineResult;
  debtopt: DebtOptEngineResult;
  lifeenergy: LifeEnergyEngineResult;
}

export interface ReconcilerParsedRow {
  lineNumber: number;
  rawLine: string;
  dateIso: string;
  description: string;
  amountRp: number;
  instrument: string;
  inferredCategory: string;
  targetPeriodMonth: number;
  targetPeriodYear: number;
  targetPeriodCode: string;
  originalPeriodCode?: string;
  advancedFromLocked?: boolean;
  crossedCutoff: boolean;
  duplicateStatus: "NEW_ENTRY" | "AMOUNT_DATE_MATCH" | "EXACT_MATCH";
  matchedItemId?: number;
  matchedItemLabel?: string;
}

export interface ReconcilerParseResponse {
  engineSource?: "GO_BINARY" | "TS_MIRROR";
  totalLines: number;
  parsedCount: number;
  newEntryCount: number;
  duplicateCount: number;
  totalAmountRp: number;
  rows: ReconcilerParsedRow[];
}

export async function fetchIntelligenceBundle(
  month: number,
  year: number,
  extraLumpSum: number = 0
): Promise<IntelligenceBundleResponse | null> {
  return swrFetch(`intelligence:${month}:${year}:${extraLumpSum}`, async () => {
    const res = await fetch(
      `${API_URL}/api/finance/intelligence?month=${month}&year=${year}&extraLumpSum=${extraLumpSum}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    return handleResponse<IntelligenceBundleResponse | null>(res, null);
  });
}

export async function updateStudioConfigApi(
  patch: Partial<ModularStudioConfig>
): Promise<{ studioConfig: ModularStudioConfig; globalConfigId: number } | null> {
  const res = await fetch(`${API_URL}/api/config/studio`, {
    method: "PATCH",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(patch),
  });
  const data = await handleResponse<{ studioConfig: ModularStudioConfig; globalConfigId: number } | null>(res, null);
  invalidateCache();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("erp:studio-updated", { detail: data?.studioConfig }));
  }
  return data;
}

export async function parseReconcilerStatementApi(payload: {
  rawText: string;
  defaultMethod?: "CASH" | "PAYLATER" | "CREDIT_CARD";
  defaultYear?: number;
}): Promise<ReconcilerParseResponse | null> {
  const res = await fetch(`${API_URL}/api/finance/reconciler/parse`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse<ReconcilerParseResponse | null>(res, null);
}

export async function commitReconcilerRowsApi(rows: Array<{
  dateIso: string;
  description: string;
  amountRp: number;
  instrument: string;
  targetPeriodMonth: number;
  targetPeriodYear: number;
  inferredCategory?: string;
}>): Promise<{ committedCount: number; items: any[] } | null> {
  const res = await fetch(`${API_URL}/api/finance/reconciler/commit`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ rows }),
  });
  const data = await handleResponse<{ committedCount: number; items: any[] } | null>(res, null);
  invalidateCache();
  return data;
}

export const RESERVED_WORDS_CATALOG_LIST = [
  "BASE_SALARY",
  "WORK_DAYS",
  "DAILY_ALLOWANCE",
  "TRANSPORT_ALLOWANCE",
  "FIXED_ADDITIONS",
  "GROSS_PAY",
  "TAX_AND_BPJS",
  "NET_SALARY",
  "TENURE_MONTHS",
  "THR_MULTIPLIER",
  "THR_AMOUNT",
  "NET_INCOME",
  "PAYLATER_DEBT",
  "CC_DEBT",
  "SPINJAM_DEBT",
  "OTHER_DEBT",
  "TOTAL_DEBT",
  "ROUTINE_BILLS",
  "LIVING_BUDGET",
  "P1_FLOOR",
  "P1_SAVINGS",
  "P2_REWARD",
  "ELAPSED_DAYS",
  "CYCLE_DAYS",
  "REMAINING_DAYS",
  "WEEKEND_WEIGHT",
  "WORK_DAYS_PER_WEEK",
  "WORK_HOURS_PER_DAY",
  "COMMUTE_HOURS_PER_DAY",
  "OPTIMAL_DSR_PCT",
  "MAX_SAFE_DSR_PCT",
  "DAYS_IN_MONTH",
  "TX_DAY",
  "TX_MONTH",
  "TX_YEAR",
  "IS_LEAP_YEAR",
  "DUE_DAY",
  "PAYDAY_DAY",
] as const;

export function buildDefaultFormulasClient(): FormulaDefinitions {
  return {
    takeHomeSalaryFormula:
      "{BASE_SALARY} + ({WORK_DAYS} * {DAILY_ALLOWANCE}) + {TRANSPORT_ALLOWANCE} + {FIXED_ADDITIONS} - {TAX_AND_BPJS}",
    proratedThrFormula:
      "ROUND(({TENURE_MONTHS} / 12) * ({BASE_SALARY} + {FIXED_ADDITIONS}))",
    waterfallAllocationFormula:
      "MAX(0, {NET_INCOME} - {TOTAL_DEBT} - {ROUTINE_BILLS} - {LIVING_BUDGET})",
    debtSafeCeilingFormula:
      "MAX(0, {NET_INCOME} - {LIVING_BUDGET} - {ROUTINE_BILLS} - {SPINJAM_DEBT} - {OTHER_DEBT})",
    dailySafeToSpendFormula: "ROUND({LIVING_BUDGET} / MAX(1, {CYCLE_DAYS}))",
    trueHourlyWageFormula:
      "ROUND(({NET_SALARY} - {ROUTINE_BILLS}) / MAX(1, ({WORK_DAYS_PER_WEEK} * 4) * ({WORK_HOURS_PER_DAY} + {COMMUTE_HOURS_PER_DAY})))",
    forecasterFreedDebtToP1Formula: "ROUND(PCT({TOTAL_DEBT}, 70))",
  };
}

export function evaluateFormulaDslClient(
  expression: string,
  variables: Record<string, number>,
): FormulaEvalResult {
  const expr = String(expression || "").trim();
  if (!expr) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: [],
      error: "Formula expression cannot be empty",
    };
  }
  const allowedSet = new Set<string>(RESERVED_WORDS_CATALOG_LIST);
  type Tok =
    | { kind: "EOF" | "PLUS" | "MINUS" | "MUL" | "DIV" | "LPAREN" | "RPAREN" | "COMMA" | "GT" | "LT" | "GTE" | "LTE" | "EQ" }
    | { kind: "NUM"; num: number }
    | { kind: "VAR" | "IDENT"; text: string };
  const toks: Tok[] = [];
  const used = new Set<string>();
  let i = 0;
  try {
    while (i < expr.length) {
      const ch = expr[i];
      if (/\s/.test(ch)) {
        i++;
        continue;
      }
      if (ch === "+") { toks.push({ kind: "PLUS" }); i++; continue; }
      if (ch === "-") { toks.push({ kind: "MINUS" }); i++; continue; }
      if (ch === "*") { toks.push({ kind: "MUL" }); i++; continue; }
      if (ch === "/") { toks.push({ kind: "DIV" }); i++; continue; }
      if (ch === "(") { toks.push({ kind: "LPAREN" }); i++; continue; }
      if (ch === ")") { toks.push({ kind: "RPAREN" }); i++; continue; }
      if (ch === ",") { toks.push({ kind: "COMMA" }); i++; continue; }
      if (ch === ">") {
        if (expr[i + 1] === "=") { toks.push({ kind: "GTE" }); i += 2; }
        else { toks.push({ kind: "GT" }); i++; }
        continue;
      }
      if (ch === "<") {
        if (expr[i + 1] === "=") { toks.push({ kind: "LTE" }); i += 2; }
        else { toks.push({ kind: "LT" }); i++; }
        continue;
      }
      if (ch === "=" && expr[i + 1] === "=") {
        toks.push({ kind: "EQ" }); i += 2; continue;
      }
      if (ch === "{") {
        const close = expr.indexOf("}", i + 1);
        if (close === -1) throw new Error("Unclosed '{' in variable token");
        const name = expr.slice(i + 1, close).trim().toUpperCase();
        if (!allowedSet.has(name)) throw new Error(`Unknown reserved word {${name}}`);
        used.add(name);
        toks.push({ kind: "VAR", text: name });
        i = close + 1;
        continue;
      }
      if (/[0-9.]/.test(ch)) {
        const start = i;
        while (i < expr.length && /[0-9._]/.test(expr[i])) i++;
        const rawNum = expr.slice(start, i).replace(/_/g, "");
        const n = Number(rawNum);
        if (!Number.isFinite(n)) throw new Error(`Invalid number '${rawNum}'`);
        toks.push({ kind: "NUM", num: n });
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        const start = i;
        while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) i++;
        const ident = expr.slice(start, i).toUpperCase();
        if (expr[i] === "(") {
          toks.push({ kind: "IDENT", text: ident });
        } else {
          if (!allowedSet.has(ident)) throw new Error(`Unknown identifier '${ident}' — wrap variables in {${ident}}`);
          used.add(ident);
          toks.push({ kind: "VAR", text: ident });
        }
        continue;
      }
      throw new Error(`Unexpected character '${ch}'`);
    }
    toks.push({ kind: "EOF" });
    let pos = 0;
    const peek = () => toks[pos] ?? { kind: "EOF" as const };
    const next = () => toks[pos++] ?? { kind: "EOF" as const };

    const parseCmp = (): number => {
      let left = parseAdd();
      const k = peek().kind;
      if (k === "GT" || k === "LT" || k === "GTE" || k === "LTE" || k === "EQ") {
        next();
        const right = parseAdd();
        if (k === "GT") return left > right ? 1 : 0;
        if (k === "LT") return left < right ? 1 : 0;
        if (k === "GTE") return left >= right ? 1 : 0;
        if (k === "LTE") return left <= right ? 1 : 0;
        return Math.abs(left - right) < 1e-9 ? 1 : 0;
      }
      return left;
    };
    const parseAdd = (): number => {
      let left = parseMul();
      while (peek().kind === "PLUS" || peek().kind === "MINUS") {
        const op = next().kind;
        const right = parseMul();
        left = op === "PLUS" ? left + right : left - right;
      }
      return left;
    };
    const parseMul = (): number => {
      let left = parseUnary();
      while (peek().kind === "MUL" || peek().kind === "DIV") {
        const op = next().kind;
        const right = parseUnary();
        if (op === "DIV") {
          if (Math.abs(right) < 1e-12) throw new Error("Division by zero");
          left /= right;
        } else {
          left *= right;
        }
      }
      return left;
    };
    const parseUnary = (): number => {
      if (peek().kind === "PLUS") { next(); return parseUnary(); }
      if (peek().kind === "MINUS") { next(); return -parseUnary(); }
      return parsePrimary();
    };
    const parsePrimary = (): number => {
      const tok = next();
      if (tok.kind === "NUM") return tok.num;
      if (tok.kind === "VAR") return variables[tok.text] ?? 0;
      if (tok.kind === "LPAREN") {
        const v = parseCmp();
        if (next().kind !== "RPAREN") throw new Error("Expected ')'");
        return v;
      }
      if (tok.kind === "IDENT") {
        if (next().kind !== "LPAREN") throw new Error(`Expected '(' after ${tok.text}`);
        const args: number[] = [];
        if (peek().kind !== "RPAREN") {
          args.push(parseCmp());
          while (peek().kind === "COMMA") { next(); args.push(parseCmp()); }
        }
        if (next().kind !== "RPAREN") throw new Error(`Expected ')' after ${tok.text} arguments`);
        switch (tok.text) {
          case "ROUND": if (args.length !== 1) throw new Error("ROUND expects 1 arg"); return Math.round(args[0]);
          case "FLOOR": if (args.length !== 1) throw new Error("FLOOR expects 1 arg"); return Math.floor(args[0]);
          case "CEIL": if (args.length !== 1) throw new Error("CEIL expects 1 arg"); return Math.ceil(args[0]);
          case "MIN": if (args.length < 1) throw new Error("MIN expects >=1 args"); return Math.min(...args);
          case "MAX": if (args.length < 1) throw new Error("MAX expects >=1 args"); return Math.max(...args);
          case "CLAMP":
            if (args.length !== 3) throw new Error("CLAMP(val, min, max) expects 3 args");
            return Math.min(args[2], Math.max(args[1], args[0]));
          case "IF":
            if (args.length !== 3) throw new Error("IF(cond, t, f) expects 3 args");
            return args[0] !== 0 ? args[1] : args[2];
          case "PCT":
            if (args.length !== 2) throw new Error("PCT(base, pct) expects 2 args");
            return (args[0] * args[1]) / 100;
          default:
            throw new Error(`Unsupported function '${tok.text}'`);
        }
      }
      throw new Error("Unexpected token in formula");
    };
    const valueFloat = parseCmp();
    if (peek().kind !== "EOF") throw new Error("Unexpected trailing tokens");
    return {
      expression: expr,
      valid: true,
      valueRp: Math.round(valueFloat),
      valueFloat,
      usedTokens: Array.from(used),
    };
  } catch (err: any) {
    return {
      expression: expr,
      valid: false,
      valueRp: 0,
      valueFloat: 0,
      usedTokens: Array.from(used),
      error: err?.message || "Invalid formula syntax",
    };
  }
}

export async function evaluateFormulaSuiteApi(payload: {
  month?: number;
  year?: number;
  formulas: Record<string, string>;
  overrideVariables?: Record<string, number>;
}): Promise<{ variables: Record<string, number>; evaluation: FormulaSuiteResult } | null> {
  const res = await fetch(`${API_URL}/api/finance/formula/evaluate`, {
    method: "POST",
    headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  return handleResponse<{ variables: Record<string, number>; evaluation: FormulaSuiteResult } | null>(res, null);
}

// ============================================================================
// MARQUEE 3-TIER DETERMINISTIC AI CO-PILOT APIS (/api/marquee)
// ============================================================================

export type MarqueeAiProvider =
  | "TIER1_ONLY"
  | "GEMINI"
  | "GROQ"
  | "DEEPSEEK"
  | "OPENCODE"
  | "AUTO";

export interface MarqueeCardItem {
  label: string;
  value: string;
  tone?: "default" | "positive" | "caution" | "urgency";
}

export type MarqueePendingActionType =
  | "CONFIRM_EXPENSE"
  | "CONFIRM_SHIFT_LIABILITY"
  | "CONFIRM_SETTLE_LIABILITY"
  | "CONFIRM_BUDGET_REVISION"
  | "CONFIRM_SAVINGS_ACTION"
  | "CONFIRM_WISHLIST_ADD"
  | "CONFIRM_SUBSCRIPTION_ACTION";

export interface MarqueePendingAction {
  type: MarqueePendingActionType;
  title?: string;
  payload: Record<string, any>;
}

export interface MarqueeAgentStep {
  id: string;
  label: string;
  detail: string;
  status: "done" | "active";
  durationMs?: number;
}

export interface MarqueeStreamStatusEvent {
  type: "status";
  phase: "THINKING" | "HYDRATING" | "ANALYZING" | "STAGING";
  label: string;
  detail: string;
  timestamp: string;
}

export interface MarqueeProactiveReminder {
  id: string;
  tone: "default" | "caution" | "positive";
  text: string;
  prompt: string;
}

export interface MarqueeChatResponse {
  ok: boolean;
  tool: string;
  summary: string;
  cards: MarqueeCardItem[];
  pendingAction?: MarqueePendingAction;
  tierUsed:
    | "TIER1_NLU"
    | "TIER2_GEMINI"
    | "TIER2_GROQ"
    | "TIER2_DEEPSEEK"
    | "TIER2_OPENCODE"
    | "CONFIRMED_EXECUTION";
  model: string;
  locale: "en" | "id" | "zh";
  assistantPrefix?: string;
  reasoning?: string;
  agentSteps?: MarqueeAgentStep[];
  proactiveReminders?: MarqueeProactiveReminder[];
  hydratedContext?: {
    periodTag: string;
    cycleTemporalState: "PRE_PAYDAY" | "ACTIVE" | "COMPLETED";
    cycleDateLabel: string;
    activeRoute: string;
    activeSubTab: string | null;
    canonicalDueDays: number[];
  };
  data?: Record<string, unknown>;
}

export interface MarqueeConfigResponse {
  provider: MarqueeAiProvider;
  hasGeminiKey: boolean;
  geminiKeyPreview: string;
  hasGroqKey: boolean;
  groqKeyPreview: string;
  hasDeepseekKey: boolean;
  deepseekKeyPreview: string;
  deepseekModel: "deepseek-chat" | "deepseek-flash" | "deepseek-reasoner";
  hasOpencodeKey: boolean;
  opencodeKeyPreview: string;
  opencodeBaseUrl: string;
  opencodeModel: string;
  hasWebhookToken: boolean;
  webhookTokenPreview: string;
  webhookEnabled: boolean;
  geminiModel: string;
  groqModel: string;
}

export async function sendMarqueeChat(payload: {
  message: string;
  confirm?: boolean;
  pendingAction?: MarqueePendingAction;
  month?: number;
  year?: number;
  locale?: "en" | "id" | "zh";
  activeRoute?: string;
  activeSubTab?: string | null;
}): Promise<MarqueeChatResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/chat`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const data = await handleResponse<MarqueeChatResponse | null>(res, null);
    if (data?.tierUsed === "CONFIRMED_EXECUTION" || (payload.confirm && data?.ok)) {
      invalidateCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:data-mutated"));
      }
    }
    return data;
  } catch {
    return null;
  }
}

export async function sendMarqueeChatStream(
  payload: {
    message: string;
    confirm?: boolean;
    pendingAction?: MarqueePendingAction;
    month?: number;
    year?: number;
    locale?: "en" | "id" | "zh";
    activeRoute?: string;
    activeSubTab?: string | null;
  },
  onStatus?: (event: MarqueeStreamStatusEvent) => void,
): Promise<MarqueeChatResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/chat/stream`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    if (!res.ok || !res.body) {
      return sendMarqueeChat(payload);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalResponse: MarqueeChatResponse | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nlIdx = buffer.indexOf("\n");
      while (nlIdx !== -1) {
        const rawLine = buffer.slice(0, nlIdx).trim();
        buffer = buffer.slice(nlIdx + 1);
        if (rawLine) {
          try {
            const parsed = JSON.parse(rawLine);
            if (parsed?.type === "status") {
              onStatus?.(parsed as MarqueeStreamStatusEvent);
            } else if (parsed?.type === "final" && parsed?.data) {
              finalResponse = parsed.data as MarqueeChatResponse;
            }
          } catch {
            // ignore partial/malformed frame
          }
        }
        nlIdx = buffer.indexOf("\n");
      }
    }

    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim());
        if (parsed?.type === "final" && parsed?.data) {
          finalResponse = parsed.data as MarqueeChatResponse;
        }
      } catch {
        // ignore trailing fragment
      }
    }

    if (finalResponse?.tierUsed === "CONFIRMED_EXECUTION" || (payload.confirm && finalResponse?.ok)) {
      invalidateCache();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("erp:data-mutated"));
      }
    }
    return finalResponse ?? (await sendMarqueeChat(payload));
  } catch {
    return sendMarqueeChat(payload);
  }
}

export async function fetchMarqueeConfig(): Promise<MarqueeConfigResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/config`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    return handleResponse<MarqueeConfigResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function updateMarqueeConfig(payload: {
  provider?: MarqueeAiProvider;
  geminiApiKey?: string | null;
  groqApiKey?: string | null;
  deepseekApiKey?: string | null;
  deepseekModel?: "deepseek-chat" | "deepseek-flash" | "deepseek-reasoner";
  opencodeApiKey?: string | null;
  opencodeBaseUrl?: string | null;
  opencodeModel?: string | null;
  webhookEnabled?: boolean;
}): Promise<MarqueeConfigResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/config`, {
      method: "PUT",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    return handleResponse<MarqueeConfigResponse | null>(res, null);
  } catch {
    return null;
  }
}

export async function rotateMarqueeWebhookToken(): Promise<{
  token: string;
  webhookTokenPreview: string;
} | null> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/webhook-token/rotate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
    });
    return handleResponse<{ token: string; webhookTokenPreview: string } | null>(res, null);
  } catch {
    return null;
  }
}

export interface MarqueeMemoryRule {
  id: string;
  ruleText: string;
  merchantPattern?: string;
  defaultInstrument?: "CASH" | "PAYLATER" | "CREDIT_CARD";
  createdAt: string;
}

export async function fetchMarqueeMemory(): Promise<MarqueeMemoryRule[]> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/memory`, {
      headers: await getAuthHeaders(),
      cache: "no-store",
    });
    const body = await handleResponse<{ rules?: MarqueeMemoryRule[] } | null>(res, null);
    return Array.isArray(body?.rules) ? body.rules : [];
  } catch {
    return [];
  }
}

export async function deleteMarqueeMemory(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_URL}/api/marquee/memory/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface CashRadarSubItemDto {
  title: string;
  amountRp: number;
  sliceLabel: string;
}

export interface CashRadarEventDto {
  id: string;
  dateIso: string;
  nominalDateIso: string;
  isBusinessDayShifted: boolean;
  label: string;
  category: string;
  signedAmountRp: number;
  sliceLabel: string;
  isFinalSlice: boolean;
  notes: string;
  insideAllocatedPool?: boolean;
  subItems?: CashRadarSubItemDto[];
}

export interface CashRadarDayPointDto {
  dateIso: string;
  dayOfMonth: number;
  inActiveCycle: boolean;
  isToday: boolean;
  isWeekend: boolean;
  openingBalanceRp: number;
  inflowsRp: number;
  outflowsRp: number;
  closingBalanceRp: number;
  events: CashRadarEventDto[];
}

export interface CashRadarResponse {
  periodMonth: number;
  periodYear: number;
  cycleStartIso: string;
  cycleEndIso: string;
  nextPaydayIso: string;
  paydayInflowsRp: number;
  totalScheduledBillsRp: number;
  endingCashBufferRp: number;
  lowestCashPoint: {
    dateIso: string;
    balanceRp: number;
    contextLabel: string;
    isTightOrDeficit: boolean;
  };
  events: CashRadarEventDto[];
  dailySeries: CashRadarDayPointDto[];
  engineSource?: string;
}

export async function fetchCashRadar(
  month: number,
  year: number
): Promise<CashRadarResponse | null> {
  const key = `cash_radar:${year}-${month}`;
  if (typeof window !== "undefined") {
    const hit = getCached<CashRadarResponse>(key);
    if (hit) return hit;
  }
  try {
    const res = await fetch(
      `${API_URL}/api/finance/cash-radar?month=${month}&year=${year}`,
      { headers: await getAuthHeaders(), cache: "no-store" }
    );
    const parsed = await handleResponse<CashRadarResponse | null>(res, null);
    if (parsed && typeof window !== "undefined") {
      setCached(key, parsed);
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface SavingsPocketsSaveResponse {
  totalConfirmedSavingsRp: number;
  totalAllocatedRp: number;
  unallocatedPoolRp: number;
  pockets: SavingsPocketConfig[];
}

export async function saveSavingsPockets(
  pockets: SavingsPocketConfig[]
): Promise<{ success: boolean; data?: SavingsPocketsSaveResponse; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/savings/pockets`, {
      method: "PUT",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ pockets }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body?.message || "Failed to update savings pockets" };
    }
    invalidateCache("savings");
    invalidateCache("config");
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

export async function changeAccountPassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/auth/change-password`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body?.message || "Password update failed" };
    }
    return { success: true, message: body?.message || "Password updated cleanly." };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}

export interface ScenarioSimulationRequest {
  month?: number;
  year?: number;
  extraMonthlySavingsRp?: number;
  oneTimeBonusRp?: number;
  monthlyLivingDeltaRp?: number;
  extraDebtPrepaymentRp?: number;
  variableShockPercent?: number;
}

export interface ScenarioSimulationResponse {
  period: { month: number; year: number };
  inputs: {
    extraMonthlySavingsRp: number;
    oneTimeBonusRp: number;
    monthlyLivingDeltaRp: number;
    extraDebtPrepaymentRp: number;
    variableShockPercent: number;
  };
  baseline: {
    projected6MWealthRp: number;
    projected12MWealthRp: number;
    freedomDate: string;
    lowDsrDate: string;
    emergencyCompletionDate: string;
    runwayDays: number;
  };
  simulated: {
    projected6MWealthRp: number;
    projected12MWealthRp: number;
    freedomDate: string;
    lowDsrDate: string;
    emergencyCompletionDate: string;
    runwayDays: number;
  };
  net12MDeltaRp: number;
  runwayDeltaDays: number;
  series: Array<{
    month: number;
    year: number;
    label: string;
    baselineWealthRp: number;
    simulatedWealthRp: number;
    disciplinedWealthRp: number;
    shockWealthRp: number;
    baselineDsrPercent: number;
    simulatedDsrPercent: number;
    remainingPersonalDebtRp: number;
  }>;
  debtStrategies: Array<{
    strategy: string;
    immediateFreedMonthlyRp: number;
    estimatedInterestSavedRp: number;
    monthsShaved: number;
    summary: string;
  }>;
}

export async function simulateScenario(
  payload: ScenarioSimulationRequest
): Promise<{ success: boolean; data?: ScenarioSimulationResponse; error?: string }> {
  try {
    const res = await fetch(`${API_URL}/api/finance/scenarios/simulate`, {
      method: "POST",
      headers: await getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body?.message || "Scenario simulation failed" };
    }
    return { success: true, data: body };
  } catch (err: any) {
    return { success: false, error: err?.message || "Network error" };
  }
}
