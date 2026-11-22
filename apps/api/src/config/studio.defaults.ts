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
  defaultPeriodStrategy?: 'EARLIEST_OPEN_ACTIVE' | 'CALENDAR_WINDOW';
  paydayAnchorDay: number;
  payslipAnchorDay: number;
  payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY' | 'SHIFT_NEXT_WEEKDAY' | 'EXACT_DAY';
  reviewLagWorkingDays: number;
  ledgerEpochMonth: number;
  ledgerEpochYear: number;
  holidayDatesIso: string[];
  periodOverrides: Record<string, PeriodScheduleOverride>;
  shiftWeekendToFriday: boolean;
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
  forecasterFreedDebtToP1Pct: number;
  milestonePriorityOrder: string[];
  formulas: FormulaDefinitions;
  sinkingFunds: SinkingFundConfigRow[];
}

export interface InstrumentConfigRow {
  id: string;
  name: string;
  type: 'PAYLATER' | 'CREDIT_CARD' | 'CASH_LOAN' | string;
  cutoffDay: number;
  dueDay: number;
  dueRule: 'FIXED_DAY' | 'DISBURSEMENT_DAY';
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
  accountType: 'OPERATIONAL_BANK' | 'MONEY_MARKET_RDPU' | 'CASH_WALLET' | 'SAVINGS_VAULT' | string;
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
  rolloverPolicy: 'SWEEP_TO_P1' | 'ROLLOVER_NEXT_MONTH';
  active: boolean;
}

export interface ModuleNavOverride {
  label?: string;
  hidden?: boolean;
  order?: number;
}

export interface CustomSidebarShortcut {
  id: string;
  label: string;
  icon: string;
  targetHref: string;
  sectionGroup: 'FINANCIAL_ENGINE' | 'AUDIT_DECISION' | 'SYSTEM';
}

export interface SidebarNavigationConfig {
  defaultLandingRoute: string;
  moduleOverrides: Record<string, ModuleNavOverride>;
  customShortcuts: CustomSidebarShortcut[];
}

export interface ModularStudioConfig {
  enableExternalAssetPortfolio: boolean;
  actualP1VaultBalanceRp?: number | null;
  paycycleFormulaConfig: PaycycleFormulaConfig;
  instrumentsTable: InstrumentConfigRow[];
  assetAccountsTable: AssetAccountConfigRow[];
  routineTemplatesTable: RoutineTemplateConfigRow[];
  sidebarNavigationConfig: SidebarNavigationConfig;
}

const FABRICATED_U1_ASSET_IDS = new Set([
  'acc_bca_payroll',
  'acc_blu_rdpu',
  'acc_cash_wallet',
  'acc_p1_vault',
]);

export function buildDefaultFormulas(): FormulaDefinitions {
  return {
    takeHomeSalaryFormula:
      '{BASE_SALARY} + ({WORK_DAYS} * {DAILY_ALLOWANCE}) + {TRANSPORT_ALLOWANCE} + {FIXED_ADDITIONS} - {TAX_AND_BPJS}',
    proratedThrFormula:
      'ROUND(({TENURE_MONTHS} / 12) * ({BASE_SALARY} + {FIXED_ADDITIONS}))',
    waterfallAllocationFormula:
      'MAX(0, {NET_INCOME} - {TOTAL_DEBT} - {ROUTINE_BILLS} - {LIVING_BUDGET})',
    debtSafeCeilingFormula:
      'MAX(0, {NET_INCOME} - {LIVING_BUDGET} - {ROUTINE_BILLS} - {SPINJAM_DEBT} - {OTHER_DEBT})',
    dailySafeToSpendFormula: 'ROUND({LIVING_BUDGET} / MAX(1, {CYCLE_DAYS}))',
    trueHourlyWageFormula:
      'ROUND(({NET_SALARY} - {ROUTINE_BILLS}) / MAX(1, ({WORK_DAYS_PER_WEEK} * 4) * ({WORK_HOURS_PER_DAY} + {COMMUTE_HOURS_PER_DAY})))',
    forecasterFreedDebtToP1Formula: 'ROUND(PCT({TOTAL_DEBT}, 70))',
  };
}

export function buildDefaultStudioConfig(
  userId: number = 1,
  legacyConfig?: Partial<{
    payrollPayoutDay: number;
    baseSavings: number;
    dailyOperational: number;
    transport: number;
    internet: number;
    vape: number;
    haircut: number;
    creditLimit: number;
    creditStatementDay: number;
    creditDueDay: number;
    paylaterUsageLimit: number;
    ccUsageLimit: number;
  }>,
): ModularStudioConfig {
  const isSandbox = userId === 2;

  return {
    enableExternalAssetPortfolio: isSandbox,
    actualP1VaultBalanceRp: null,
    paycycleFormulaConfig: {
      defaultPeriodStrategy: 'EARLIEST_OPEN_ACTIVE',
      paydayAnchorDay: isSandbox ? 27 : (legacyConfig?.payrollPayoutDay ?? 27),
      payslipAnchorDay: 25,
      payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY',
      reviewLagWorkingDays: 2,
      ledgerEpochMonth: 11,
      ledgerEpochYear: 2026,
      holidayDatesIso: ['2026-12-25', '2027-01-01'],
      periodOverrides: isSandbox
        ? {}
        : {
            '11/2026': {
              payslipDateIso: '2026-10-23',
              paydayDateIso: '2026-10-28',
              note: 'Oct 28 Payday',
            },
            '01/2027': {
              payslipDateIso: '2026-12-23',
              paydayDateIso: '2026-12-28',
              note: 'Holiday Schedule',
            },
          },
      shiftWeekendToFriday: true,
      waterfallPriorityOrder: [
        'DEBT_OBLIGATIONS',
        'FIXED_ROUTINE_BILLS',
        'DAILY_OPERATIONAL',
        'CORE_SAVINGS_P1',
        'SELF_REWARD_P2',
      ],
      p1TargetFloorRp: isSandbox ? 1_500_000 : (legacyConfig?.baseSavings ?? 1_000_000),
      defaultDailyFoodBaselineRp: isSandbox
        ? 3_000_000
        : (legacyConfig?.dailyOperational && legacyConfig.dailyOperational > 0
            ? legacyConfig.dailyOperational
            : 1_500_000),
      weekendWeightMultiplier: 1.5,
      workdaysPerWeek: 5,
      workHoursPerDay: 8,
      dailyCommuteHours: isSandbox ? 1 : 2,
      rdpuAnnualYieldPct: isSandbox ? 4.75 : 0,
      emergencyFundTargetRp: isSandbox ? 20_000_000 : 15_000_000,
      variableShockPercent: 15,
      forecasterFreedDebtToP1Pct: 70,
      milestonePriorityOrder: [
        'SPINJAM_ZERO',
        'PAYLATER_INSTALLMENTS_ZERO',
        'ALL_DEBT_FREE_P1_FOCUS',
      ],
      formulas: buildDefaultFormulas(),
      sinkingFunds: [
        {
          id: 'sf_device_maintenance',
          name: 'Workstation & Device Service',
          targetAmountRp: 1_200_000,
          currentSavedRp: 400_000,
          monthsRemaining: 4,
        },
        {
          id: 'sf_annual_tax',
          name: 'Annual Personal Reserve',
          targetAmountRp: 2_400_000,
          currentSavedRp: 600_000,
          monthsRemaining: 6,
        },
      ],
    },
    instrumentsTable: [
      {
        id: 'inst_spaylater',
        name: 'Shopee SPayLater',
        type: 'PAYLATER',
        cutoffDay: 15,
        dueDay: 25,
        dueRule: 'FIXED_DAY',
        monthlyInterestPct: 2.95,
        adminFeePct: 1.0,
        creditLimitRp: isSandbox ? 5_000_000 : (legacyConfig?.paylaterUsageLimit && legacyConfig.paylaterUsageLimit > 0 ? legacyConfig.paylaterUsageLimit : 6_000_000),
        utilizationWarnPct: 50,
        lateFeeRule: '5% of overdue statement',
        active: true,
      },
      {
        id: 'inst_permata_cc',
        name: isSandbox ? 'Corporate Platinum Visa' : 'Bank Permata Credit Card',
        type: 'CREDIT_CARD',
        cutoffDay: legacyConfig?.creditStatementDay ?? 25,
        dueDay: legacyConfig?.creditDueDay ?? 11,
        dueRule: 'FIXED_DAY',
        monthlyInterestPct: 1.75,
        adminFeePct: 0,
        creditLimitRp: isSandbox ? 15_000_000 : (legacyConfig?.creditLimit ?? 7_000_000),
        utilizationWarnPct: 40,
        lateFeeRule: '1% up to Rp 100.000 cap (0% if paid in full by 11th; H-1 working day if weekend/holiday)',
        active: true,
      },
      {
        id: 'inst_spinjam',
        name: 'Shopee SPinjam',
        type: 'CASH_LOAN',
        cutoffDay: 0,
        dueDay: 0,
        dueRule: 'DISBURSEMENT_DAY',
        monthlyInterestPct: 3.95,
        adminFeePct: 1.0,
        creditLimitRp: 5_000_000,
        utilizationWarnPct: 30,
        lateFeeRule: '5% of monthly installment',
        active: true,
      },
    ],
    assetAccountsTable: isSandbox
      ? [
          {
            id: 'acc_sb_bca',
            name: 'BCA Corporate Payroll Demo',
            institution: 'BCA',
            accountType: 'OPERATIONAL_BANK',
            balanceRp: 8_500_000,
            annualYieldPct: 0.1,
            includeInRunway: true,
            isPrimaryPayroll: true,
          },
          {
            id: 'acc_sb_rdpu',
            name: 'Money Market Mutual Fund (RDPU Demo)',
            institution: 'blu / Batavia Demo',
            accountType: 'MONEY_MARKET_RDPU',
            balanceRp: 10_000_000,
            annualYieldPct: 4.75,
            includeInRunway: true,
            isPrimaryPayroll: false,
          },
          {
            id: 'acc_sb_cash',
            name: 'Daily Cash Wallet Demo',
            institution: 'Physical Wallet',
            accountType: 'CASH_WALLET',
            balanceRp: 500_000,
            annualYieldPct: 0,
            includeInRunway: true,
            isPrimaryPayroll: false,
          },
          {
            id: 'acc_sb_p1',
            name: 'Core Savings P1 Vault Demo',
            institution: 'Internal P1 Reserve',
            accountType: 'SAVINGS_VAULT',
            balanceRp: 6_000_000,
            annualYieldPct: 4.75,
            includeInRunway: true,
            isPrimaryPayroll: false,
          },
        ]
      : [],
    routineTemplatesTable: [
      {
        id: 'tpl_transport',
        slotKey: 'transport',
        name: 'KRL Commuter Transport',
        monthlyQuotaRp: isSandbox ? 500_000 : (legacyConfig?.transport && legacyConfig.transport > 0 ? legacyConfig.transport : 300_000),
        targetDueDay: 1,
        rolloverPolicy: 'SWEEP_TO_P1',
        active: true,
      },
      {
        id: 'tpl_internet',
        slotKey: 'internet',
        name: 'Mobile Data Quota',
        monthlyQuotaRp: isSandbox ? 350_000 : (legacyConfig?.internet && legacyConfig.internet > 0 ? legacyConfig.internet : 125_000),
        targetDueDay: 25,
        rolloverPolicy: 'SWEEP_TO_P1',
        active: true,
      },
      {
        id: 'tpl_vape',
        slotKey: 'vape',
        name: 'Vape Supplies',
        monthlyQuotaRp: isSandbox ? 500_000 : (legacyConfig?.vape && legacyConfig.vape > 0 ? legacyConfig.vape : 150_000),
        targetDueDay: 15,
        rolloverPolicy: 'SWEEP_TO_P1',
        active: true,
      },
      {
        id: 'tpl_haircut',
        slotKey: 'haircut',
        name: 'Haircut & Grooming',
        monthlyQuotaRp: isSandbox ? 150_000 : (legacyConfig?.haircut && legacyConfig.haircut > 0 ? legacyConfig.haircut : 75_000),
        targetDueDay: 14,
        rolloverPolicy: 'SWEEP_TO_P1',
        active: true,
      },
    ],
    sidebarNavigationConfig: {
      defaultLandingRoute: '/',
      moduleOverrides: {},
      customShortcuts: [
        {
          id: 'shortcut_spinjam_freedom',
          label: 'SPinjam Payoff Watch',
          icon: 'TrendingDown',
          targetHref: '/credit?sub=contracts',
          sectionGroup: 'AUDIT_DECISION',
        },
      ],
    },
  };
}

export function resolveStudioConfig(
  userId: number,
  formulaParamsJson: any,
  legacyConfig?: any,
): ModularStudioConfig {
  const defaults = buildDefaultStudioConfig(userId, legacyConfig);
  const raw =
    formulaParamsJson && typeof formulaParamsJson === 'object'
      ? formulaParamsJson.studioConfig ?? formulaParamsJson
      : {};

  const isSandbox = userId === 2;
  const rawAccounts: AssetAccountConfigRow[] = Array.isArray(raw?.assetAccountsTable)
    ? raw.assetAccountsTable
    : defaults.assetAccountsTable;
  const cleanedAccounts = isSandbox
    ? rawAccounts
    : rawAccounts.filter((acc) => acc && !FABRICATED_U1_ASSET_IDS.has(String(acc.id || '')));

  const rawEnablePortfolio =
    typeof raw?.enableExternalAssetPortfolio === 'boolean'
      ? raw.enableExternalAssetPortfolio
      : defaults.enableExternalAssetPortfolio;

  const rawActualP1 =
    raw?.actualP1VaultBalanceRp === null ||
    typeof raw?.actualP1VaultBalanceRp === 'number'
      ? raw.actualP1VaultBalanceRp
      : defaults.actualP1VaultBalanceRp;

  return {
    enableExternalAssetPortfolio: rawEnablePortfolio,
    actualP1VaultBalanceRp: rawActualP1,
    paycycleFormulaConfig: {
      ...defaults.paycycleFormulaConfig,
      ...(raw?.paycycleFormulaConfig && typeof raw.paycycleFormulaConfig === 'object'
        ? raw.paycycleFormulaConfig
        : {}),
      holidayDatesIso: Array.isArray(raw?.paycycleFormulaConfig?.holidayDatesIso)
        ? raw.paycycleFormulaConfig.holidayDatesIso
        : defaults.paycycleFormulaConfig.holidayDatesIso,
      periodOverrides:
        raw?.paycycleFormulaConfig?.periodOverrides &&
        typeof raw.paycycleFormulaConfig.periodOverrides === 'object'
          ? {
              ...defaults.paycycleFormulaConfig.periodOverrides,
              ...raw.paycycleFormulaConfig.periodOverrides,
            }
          : defaults.paycycleFormulaConfig.periodOverrides,
      formulas: {
        ...defaults.paycycleFormulaConfig.formulas,
        ...(raw?.paycycleFormulaConfig?.formulas &&
        typeof raw.paycycleFormulaConfig.formulas === 'object'
          ? raw.paycycleFormulaConfig.formulas
          : {}),
      },
      milestonePriorityOrder: Array.isArray(raw?.paycycleFormulaConfig?.milestonePriorityOrder)
        ? raw.paycycleFormulaConfig.milestonePriorityOrder
        : defaults.paycycleFormulaConfig.milestonePriorityOrder,
      sinkingFunds: Array.isArray(raw?.paycycleFormulaConfig?.sinkingFunds)
        ? raw.paycycleFormulaConfig.sinkingFunds
        : defaults.paycycleFormulaConfig.sinkingFunds,
    },
    instrumentsTable: Array.isArray(raw?.instrumentsTable) && raw.instrumentsTable.length > 0
      ? raw.instrumentsTable.map((row: InstrumentConfigRow) =>
          row && row.type === 'CREDIT_CARD' && row.cutoffDay === 20
            ? { ...row, cutoffDay: 25 }
            : row,
        )
      : defaults.instrumentsTable,
    assetAccountsTable: cleanedAccounts,
    routineTemplatesTable:
      Array.isArray(raw?.routineTemplatesTable) && raw.routineTemplatesTable.length > 0
        ? raw.routineTemplatesTable
        : defaults.routineTemplatesTable,
    sidebarNavigationConfig: {
      defaultLandingRoute:
        raw?.sidebarNavigationConfig?.defaultLandingRoute ||
        defaults.sidebarNavigationConfig.defaultLandingRoute,
      moduleOverrides:
        raw?.sidebarNavigationConfig?.moduleOverrides &&
        typeof raw.sidebarNavigationConfig.moduleOverrides === 'object'
          ? raw.sidebarNavigationConfig.moduleOverrides
          : defaults.sidebarNavigationConfig.moduleOverrides,
      customShortcuts: Array.isArray(raw?.sidebarNavigationConfig?.customShortcuts)
        ? raw.sidebarNavigationConfig.customShortcuts
        : defaults.sidebarNavigationConfig.customShortcuts,
    },
  };
}
