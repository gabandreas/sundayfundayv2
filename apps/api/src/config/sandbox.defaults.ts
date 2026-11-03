/**
 * sandbox.defaults.ts
 * Isolated Commercial Sandbox Dataset for STANDARD_GENERAL Mode.
 * Strictly separates demo/commercial testing from the Superadmin's authentic private data.
 */

export interface RoutineCategoryConfig {
  id: string;
  label: string;
  target: number;
  isCustom?: boolean;
  hidden?: boolean;
}

export interface SandboxTransaction {
  id: number;
  label: string;
  amount: number;
  type: 'INCOME' | 'DEDUCTION' | 'CREDIT_BILL';
  sourceType: string;
  date: string;
  fixedEssentialCategory?: string | null;
  routineCategoryId?: string | null;
}

export interface SandboxCreditItem {
  id: number;
  label: string;
  amount: number;
  monthlyAmount: number;
  tenor?: number;
  chargeType: 'INSTALLMENT' | 'RECURRING' | 'FULL';
  status: 'ACTIVE' | 'SETTLED' | 'CANCELLED';
  bankName?: string;
  cardName?: string;
}

export interface SandboxState {
  month: number;
  year: number;
  persona: {
    title: string;
    netSalary: number;
    paydayAnchor: number;
    dailyLivingBudget: number;
    coreSavingsTarget: number;
    selfRewardTarget: number;
  };
  routineCategories: RoutineCategoryConfig[];
  creditItems: SandboxCreditItem[];
  transactions: SandboxTransaction[];
  savingsVault: {
    balance: number;
    liquidCashBalance: number;
    investmentRdpuBalance: number;
    liquidSharePercent: number;
    rdpuSharePercent: number;
  };
}

export function buildDefaultSandboxState(month = 10, year = 2026): SandboxState {
  return {
    month,
    year,
    persona: {
      title: 'Corporate Standard Edition Commercial Demo Persona',
      netSalary: 10_000_000,
      paydayAnchor: 25,
      dailyLivingBudget: 3_000_000,
      coreSavingsTarget: 1_500_000,
      selfRewardTarget: 845_000,
    },
    routineCategories: [
      { id: 'housing', label: 'Housing & Rent', target: 2_000_000, isCustom: true },
      { id: 'transport', label: 'Transport & Fuel', target: 600_000, isCustom: false },
      { id: 'internet', label: 'Internet & Utilities', target: 450_000, isCustom: false },
      { id: 'vape', label: 'Subscriptions & Lifestyle', target: 300_000, isCustom: false },
    ],
    creditItems: [
      {
        id: 7001,
        label: 'MacBook Air M3 (Installment 4/12)',
        amount: 15_000_000,
        monthlyAmount: 1_250_000,
        tenor: 12,
        chargeType: 'INSTALLMENT',
        status: 'ACTIVE',
        bankName: 'BCA',
        cardName: 'Corporate Platinum Visa',
      },
      {
        id: 7002,
        label: 'Spotify Premium Family',
        amount: 55_000,
        monthlyAmount: 55_000,
        chargeType: 'RECURRING',
        status: 'ACTIVE',
        bankName: 'Mandiri',
        cardName: 'Corporate Platinum Visa',
      },
    ],
    transactions: [
      {
        id: 8001,
        label: 'MacBook Air M3 (Installment 4/12)',
        amount: 1_250_000,
        type: 'CREDIT_BILL',
        sourceType: 'CC_TRANSACTION',
        date: '2026-10-01',
      },
      {
        id: 8002,
        label: 'Spotify Premium Family',
        amount: 55_000,
        type: 'CREDIT_BILL',
        sourceType: 'CC_TRANSACTION',
        date: '2026-10-01',
      },
      {
        id: 8003,
        label: 'Weekly Organic Groceries & Supermarket',
        amount: 420_000,
        type: 'DEDUCTION',
        sourceType: 'MANUAL',
        date: '2026-10-27',
      },
      {
        id: 8004,
        label: 'Client Lunch Meeting & Coffee',
        amount: 85_000,
        type: 'DEDUCTION',
        sourceType: 'MANUAL',
        date: '2026-10-28',
      },
    ],
    savingsVault: {
      balance: 25_000_000,
      liquidCashBalance: 15_000_000,
      investmentRdpuBalance: 10_000_000,
      liquidSharePercent: 60,
      rdpuSharePercent: 40,
    },
  };
}
