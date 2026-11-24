import { DEFAULT_STANDARD_ROUTINE_LABELS } from '../auth/auth.types';

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
  attendanceCutoffStartDay?: number;
  attendanceCutoffEndDay?: number;
  bpjsRatePercent?: number;
  laptopAllowanceRp?: number;
  defaultDailyAllowanceRp?: number;
  thrJoinDateIso?: string;
  thrHolidayDateIso?: string;
  optimalDebtRatioPercent?: number;
  maxSafeDebtRatioPercent?: number;
  milestonePriorityOrder: string[];
  formulas: FormulaDefinitions;
  sinkingFunds: SinkingFundConfigRow[];
}

export interface InstrumentConfigRow {
  id: string;
  name: string;
  type: 'PAYLATER' | 'CREDIT_CARD' | 'CASH_LOAN' | string;
  cutoffDay: number;
  cutoffFormula?: string;
  cutoffBoundaryInclusive?: boolean;
  preCutoffOffsetMonths?: number;
  postCutoffOffsetMonths?: number;
  dueDay: number;
  dueRule: 'FIXED_DAY' | 'DISBURSEMENT_DAY';
  dueShiftRule?: 'EXACT_DAY' | 'SHIFT_PREVIOUS_FRIDAY' | string;
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

export interface PriorityTierConfig {
  key: 'SAVINGS' | 'DISCRETIONARY' | string;
  label: string;
  order: number;
  enabled: boolean;
}

export interface SavingsPocketConfig {
  id: string;
  key: string;
  name: string;
  category: 'EMERGENCY_FUND' | 'WISHLIST' | 'SINKING_RESERVE' | 'CUSTOM';
  allocatedRp: number;
  targetRp: number;
  notes?: string;
}

export interface DisplayPreferencesConfig {
  defaultLanguage: 'en' | 'id' | 'zh';
  numberFormat: 'id-ID' | 'en-US';
  uiDensity: 'COMMAND_COCKPIT' | 'SIMPLE_CLARITY';
  hidePriorityCodesInUi: boolean;
}

export interface PrivacyPreferencesConfig {
  maskBalancesByDefault: boolean;
  requirePasswordToReveal: boolean;
}

export interface ThrConfig {
  enabled: boolean;
  label: string;
  joinDateIso: string;
  holidayDateIso: string;
  payoutMonth: number;
  calculationMode: 'FULL_BASE' | 'PRORATED_CALENDAR_DAYS' | 'PRORATED_MONTHS' | 'CUSTOM';
  includeFixedAllowances: boolean;
}

export interface OverviewPreferencesConfig {
  defaultPacingMode: 'FLAT' | 'WEIGHTED_1_5X';
  showDiscretionaryCard: boolean;
}

export interface ModularStudioConfig {
  enableExternalAssetPortfolio: boolean;
  actualP1VaultBalanceRp?: number | null;
  paycycleFormulaConfig: PaycycleFormulaConfig;
  instrumentsTable: InstrumentConfigRow[];
  assetAccountsTable: AssetAccountConfigRow[];
  routineTemplatesTable: RoutineTemplateConfigRow[];
  sidebarNavigationConfig: SidebarNavigationConfig;
  priorityTiers: PriorityTierConfig[];
  savingsPockets: SavingsPocketConfig[];
  displayPreferences: DisplayPreferencesConfig;
  privacyPreferences: PrivacyPreferencesConfig;
  thrConfig: ThrConfig;
  overviewPreferences: OverviewPreferencesConfig;
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
      'ROUND(({TENURE_MONTHS} / 12) * {BASE_SALARY})',
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
  const isBespokeOwner = userId === 1;
  const isSandbox = userId === 2;

  return {
    enableExternalAssetPortfolio: isSandbox,
    actualP1VaultBalanceRp: null,
    paycycleFormulaConfig: {
      defaultPeriodStrategy: 'EARLIEST_OPEN_ACTIVE',
      paydayAnchorDay: isBespokeOwner
        ? (legacyConfig?.payrollPayoutDay ?? 27)
        : isSandbox
          ? 25
          : (legacyConfig?.payrollPayoutDay && legacyConfig.payrollPayoutDay > 0
              ? legacyConfig.payrollPayoutDay
              : 1),
      payslipAnchorDay: 25,
      payslipShiftRule: 'SHIFT_PREVIOUS_FRIDAY',
      reviewLagWorkingDays: 2,
      ledgerEpochMonth: 11,
      ledgerEpochYear: 2026,
      holidayDatesIso: ['2026-12-25', '2027-01-01'],
      periodOverrides: isBespokeOwner
        ? {
            '10/2026': {
              payslipDateIso: '2026-09-24',
              paydayDateIso: '2026-09-28',
              note: 'Sep 28 Payday',
            },
            '11/2026': {
              payslipDateIso: '2026-10-23',
              paydayDateIso: '2026-10-28',
              note: 'Oct 28 Payday',
            },
            '12/2026': {
              payslipDateIso: '2026-11-25',
              paydayDateIso: '2026-11-27',
              note: 'Nov 27 Payday',
            },
            '01/2027': {
              payslipDateIso: '2026-12-23',
              paydayDateIso: '2026-12-28',
              note: 'Holiday Schedule',
            },
            '02/2027': {
              payslipDateIso: '2027-01-25',
              paydayDateIso: '2027-01-27',
              note: 'Jan 27 Payday',
            },
            '03/2027': {
              payslipDateIso: '2027-02-25',
              paydayDateIso: '2027-02-26',
              note: 'Feb EOM Banking Clamp',
            },
            '04/2027': {
              payslipDateIso: '2027-03-25',
              paydayDateIso: '2027-03-29',
              note: 'Mar 29 Payday',
            },
            '05/2027': {
              payslipDateIso: '2027-04-23',
              paydayDateIso: '2027-04-27',
              note: 'Apr 27 Payday',
            },
            '06/2027': {
              payslipDateIso: '2027-05-25',
              paydayDateIso: '2027-05-27',
              note: 'May 27 Payday',
            },
            '07/2027': {
              payslipDateIso: '2027-06-25',
              paydayDateIso: '2027-06-29',
              note: 'Fri Jun 25 Payslip -> Tue Jun 29 Payday',
            },
            '08/2027': {
              payslipDateIso: '2027-07-23',
              paydayDateIso: '2027-07-27',
              note: 'Fri Jul 23 Payslip -> Tue Jul 27 Payday',
            },
            '09/2027': {
              payslipDateIso: '2027-08-25',
              paydayDateIso: '2027-08-27',
              note: 'Wed Aug 25 Payslip -> Fri Aug 27 Payday',
            },
            '10/2027': {
              payslipDateIso: '2027-09-24',
              paydayDateIso: '2027-09-28',
              note: 'Fri Sep 24 Payslip -> Tue Sep 28 Payday',
            },
          }
        : {},
      shiftWeekendToFriday: true,
      waterfallPriorityOrder: [
        'DEBT_OBLIGATIONS',
        'FIXED_ROUTINE_BILLS',
        'DAILY_OPERATIONAL',
        'CORE_SAVINGS_P1',
        'SELF_REWARD_P2',
      ],
      p1TargetFloorRp: isBespokeOwner
        ? (legacyConfig?.baseSavings ?? 1_000_000)
        : isSandbox
          ? 1_500_000
          : (legacyConfig?.baseSavings ?? 0),
      defaultDailyFoodBaselineRp: isSandbox
        ? 3_000_000
        : (legacyConfig?.dailyOperational && legacyConfig.dailyOperational > 0
            ? legacyConfig.dailyOperational
            : 1_500_000),
      weekendWeightMultiplier: 1.5,
      workdaysPerWeek: 5,
      workHoursPerDay: 8,
      dailyCommuteHours: isBespokeOwner ? 2 : 1,
      rdpuAnnualYieldPct: isSandbox ? 4.75 : 0,
      emergencyFundTargetRp: isBespokeOwner
        ? 15_000_000
        : isSandbox
          ? 20_000_000
          : 10_000_000,
      variableShockPercent: 15,
      forecasterFreedDebtToP1Pct: 70,
      attendanceCutoffStartDay: 16,
      attendanceCutoffEndDay: 15,
      bpjsRatePercent: isBespokeOwner ? 3 : 0,
      laptopAllowanceRp: isBespokeOwner ? 250_000 : 0,
      defaultDailyAllowanceRp: isBespokeOwner ? 25_000 : 0,
      thrJoinDateIso: isBespokeOwner ? '2026-04-06' : '',
      thrHolidayDateIso: isBespokeOwner ? '2026-12-25' : '',
      optimalDebtRatioPercent: 20,
      maxSafeDebtRatioPercent: 35,
      milestonePriorityOrder: isBespokeOwner
        ? [
            'SPINJAM_ZERO',
            'PAYLATER_INSTALLMENTS_ZERO',
            'SAVINGS_RESERVE_FOCUS',
          ]
        : ['SAVINGS_RESERVE_FOCUS'],
      formulas: buildDefaultFormulas(),
      sinkingFunds:
        isBespokeOwner || isSandbox
          ? [
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
            ]
          : [],
    },
    instrumentsTable: isBespokeOwner
      ? [
          {
            id: 'inst_spaylater',
            name: 'Shopee SPayLater',
            type: 'PAYLATER',
            cutoffDay: 15,
            cutoffFormula: 'DAYS_IN_MONTH - 15',
            cutoffBoundaryInclusive: true,
            preCutoffOffsetMonths: 0,
            postCutoffOffsetMonths: 1,
            dueDay: 25,
            dueRule: 'FIXED_DAY',
            dueShiftRule: 'EXACT_DAY',
            monthlyInterestPct: 2.95,
            adminFeePct: 1.0,
            creditLimitRp:
              legacyConfig?.paylaterUsageLimit && legacyConfig.paylaterUsageLimit > 0
                ? legacyConfig.paylaterUsageLimit
                : 6_000_000,
            utilizationWarnPct: 50,
            lateFeeRule: '5% of overdue statement',
            active: true,
          },
          {
            id: 'inst_permata_cc',
            name: 'Bank Permata Credit Card',
            type: 'CREDIT_CARD',
            cutoffDay: legacyConfig?.creditStatementDay ?? 25,
            cutoffFormula: String(legacyConfig?.creditStatementDay ?? 25),
            cutoffBoundaryInclusive: false,
            preCutoffOffsetMonths: 1,
            postCutoffOffsetMonths: 2,
            dueDay: legacyConfig?.creditDueDay ?? 11,
            dueRule: 'FIXED_DAY',
            dueShiftRule: 'SHIFT_PREVIOUS_FRIDAY',
            monthlyInterestPct: 1.75,
            adminFeePct: 0,
            creditLimitRp: legacyConfig?.creditLimit ?? 7_000_000,
            utilizationWarnPct: 40,
            lateFeeRule:
              '1% up to Rp 100.000 cap (0% if paid in full by 11th; H-1 working day if weekend/holiday)',
            active: true,
          },
          {
            id: 'inst_spinjam',
            name: 'Shopee SPinjam',
            type: 'CASH_LOAN',
            cutoffDay: 0,
            cutoffFormula: '',
            cutoffBoundaryInclusive: false,
            preCutoffOffsetMonths: 1,
            postCutoffOffsetMonths: 1,
            dueDay: 0,
            dueRule: 'DISBURSEMENT_DAY',
            dueShiftRule: 'EXACT_DAY',
            monthlyInterestPct: 3.95,
            adminFeePct: 1.0,
            creditLimitRp: 5_000_000,
            utilizationWarnPct: 30,
            lateFeeRule: '5% of monthly installment',
            active: true,
          },
        ]
      : isSandbox
        ? [
            {
              id: 'inst_sandbox_paylater',
              name: 'Installment Credit Line',
              type: 'PAYLATER',
              cutoffDay: 15,
              cutoffFormula: 'DAYS_IN_MONTH - 15',
              cutoffBoundaryInclusive: true,
              preCutoffOffsetMonths: 0,
              postCutoffOffsetMonths: 1,
              dueDay: 25,
              dueRule: 'FIXED_DAY',
              dueShiftRule: 'EXACT_DAY',
              monthlyInterestPct: 2.95,
              adminFeePct: 1.0,
              creditLimitRp: 5_000_000,
              utilizationWarnPct: 50,
              lateFeeRule: '5% of overdue statement',
              active: true,
            },
            {
              id: 'inst_sandbox_cc',
              name: 'Corporate Platinum Visa',
              type: 'CREDIT_CARD',
              cutoffDay: legacyConfig?.creditStatementDay ?? 25,
              cutoffFormula: String(legacyConfig?.creditStatementDay ?? 25),
              cutoffBoundaryInclusive: false,
              preCutoffOffsetMonths: 1,
              postCutoffOffsetMonths: 2,
              dueDay: legacyConfig?.creditDueDay ?? 11,
              dueRule: 'FIXED_DAY',
              dueShiftRule: 'SHIFT_PREVIOUS_FRIDAY',
              monthlyInterestPct: 1.75,
              adminFeePct: 0,
              creditLimitRp: 15_000_000,
              utilizationWarnPct: 40,
              lateFeeRule: '1% up to Rp 100.000 cap (0% if paid in full by due date)',
              active: true,
            },
          ]
        : [],
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
            name: 'Core Savings Demo Account',
            institution: 'Internal Reserve',
            accountType: 'SAVINGS_VAULT',
            balanceRp: 6_000_000,
            annualYieldPct: 4.75,
            includeInRunway: true,
            isPrimaryPayroll: false,
          },
        ]
      : [],
    routineTemplatesTable: isBespokeOwner
      ? [
          {
            id: 'tpl_transport',
            slotKey: 'transport',
            name: 'KRL Commuter Transport',
            monthlyQuotaRp:
              legacyConfig?.transport && legacyConfig.transport > 0
                ? legacyConfig.transport
                : 300_000,
            targetDueDay: 1,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_internet',
            slotKey: 'internet',
            name: 'Mobile Data Quota',
            monthlyQuotaRp:
              legacyConfig?.internet && legacyConfig.internet > 0
                ? legacyConfig.internet
                : 125_000,
            targetDueDay: 25,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_vape',
            slotKey: 'vape',
            name: 'Vape Supplies',
            monthlyQuotaRp:
              legacyConfig?.vape && legacyConfig.vape > 0
                ? legacyConfig.vape
                : 150_000,
            targetDueDay: 15,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_haircut',
            slotKey: 'haircut',
            name: 'Haircut & Grooming',
            monthlyQuotaRp:
              legacyConfig?.haircut && legacyConfig.haircut > 0
                ? legacyConfig.haircut
                : 75_000,
            targetDueDay: 14,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
        ]
      : [
          {
            id: 'tpl_transport',
            slotKey: 'transport',
            name: DEFAULT_STANDARD_ROUTINE_LABELS.transport,
            monthlyQuotaRp: isSandbox
              ? 500_000
              : (legacyConfig?.transport && legacyConfig.transport > 0
                  ? legacyConfig.transport
                  : 0),
            targetDueDay: 1,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_internet',
            slotKey: 'internet',
            name: DEFAULT_STANDARD_ROUTINE_LABELS.internet,
            monthlyQuotaRp: isSandbox
              ? 350_000
              : (legacyConfig?.internet && legacyConfig.internet > 0
                  ? legacyConfig.internet
                  : 0),
            targetDueDay: 25,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_vape',
            slotKey: 'vape',
            name: DEFAULT_STANDARD_ROUTINE_LABELS.vape,
            monthlyQuotaRp: isSandbox
              ? 500_000
              : (legacyConfig?.vape && legacyConfig.vape > 0
                  ? legacyConfig.vape
                  : 0),
            targetDueDay: 15,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
          {
            id: 'tpl_haircut',
            slotKey: 'haircut',
            name: DEFAULT_STANDARD_ROUTINE_LABELS.haircut,
            monthlyQuotaRp: isSandbox
              ? 150_000
              : (legacyConfig?.haircut && legacyConfig.haircut > 0
                  ? legacyConfig.haircut
                  : 0),
            targetDueDay: 14,
            rolloverPolicy: 'SWEEP_TO_P1',
            active: true,
          },
        ],
    sidebarNavigationConfig: {
      defaultLandingRoute: '/',
      moduleOverrides: {},
      customShortcuts: [],
    },
    priorityTiers: [
      {
        key: 'SAVINGS',
        label: 'Core Savings Reserve',
        order: 1,
        enabled: true,
      },
      {
        key: 'DISCRETIONARY',
        label: 'Discretionary',
        order: 2,
        enabled: true,
      },
    ],
    savingsPockets: [
      {
        id: 'pocket_emergency',
        key: 'EMERGENCY_FUND',
        name: 'Emergency Fund',
        category: 'EMERGENCY_FUND',
        allocatedRp: 0,
        targetRp: 4_500_000,
        notes: 'Core cash reserve covering essential living months.',
      },
      {
        id: 'pocket_wishlist',
        key: 'WISHLIST_RESERVE',
        name: 'Wishlist Reserve',
        category: 'WISHLIST',
        allocatedRp: 0,
        targetRp: 0,
        notes: 'Saved portion set aside for upcoming planned purchases.',
      },
      {
        id: 'pocket_sinking',
        key: 'SINKING_RESERVE',
        name: 'Annual & Sinking Reserve',
        category: 'SINKING_RESERVE',
        allocatedRp: 0,
        targetRp: 0,
        notes: 'Periodic taxes, servicing, and irregular expenses.',
      },
    ],
    displayPreferences: {
      defaultLanguage: 'en',
      numberFormat: 'id-ID',
      uiDensity: 'COMMAND_COCKPIT',
      hidePriorityCodesInUi: true,
    },
    privacyPreferences: {
      maskBalancesByDefault: true,
      requirePasswordToReveal: true,
    },
    thrConfig: {
      enabled: isBespokeOwner,
      label: 'THR & Religious Holiday Bonus',
      joinDateIso: isBespokeOwner ? '2026-04-06' : '',
      holidayDateIso: isBespokeOwner ? '2026-12-25' : '',
      payoutMonth: 12,
      calculationMode: 'PRORATED_CALENDAR_DAYS',
      includeFixedAllowances: false,
    },
    overviewPreferences: {
      defaultPacingMode: 'FLAT',
      showDiscretionaryCard: true,
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
      ? raw.instrumentsTable.map((row: InstrumentConfigRow) => {
          if (!row) return row;
          const isLegacyCc20 = row.type === 'CREDIT_CARD' && row.cutoffDay === 20;
          const nextCutoffDay = isLegacyCc20 ? 25 : row.cutoffDay;
          if (row.type === 'PAYLATER' || row.id === 'inst_spaylater') {
            return {
              ...row,
              cutoffFormula: row.cutoffFormula ?? 'DAYS_IN_MONTH - 15',
              cutoffBoundaryInclusive:
                typeof row.cutoffBoundaryInclusive === 'boolean'
                  ? row.cutoffBoundaryInclusive
                  : true,
              preCutoffOffsetMonths:
                typeof row.preCutoffOffsetMonths === 'number'
                  ? row.preCutoffOffsetMonths
                  : 0,
              postCutoffOffsetMonths:
                typeof row.postCutoffOffsetMonths === 'number'
                  ? row.postCutoffOffsetMonths
                  : 1,
              dueShiftRule: row.dueShiftRule ?? 'EXACT_DAY',
            };
          }
          if (row.type === 'CREDIT_CARD') {
            return {
              ...row,
              cutoffDay: nextCutoffDay,
              cutoffFormula:
                row.cutoffFormula ??
                String(nextCutoffDay > 0 ? nextCutoffDay : 25),
              cutoffBoundaryInclusive:
                typeof row.cutoffBoundaryInclusive === 'boolean'
                  ? row.cutoffBoundaryInclusive
                  : false,
              preCutoffOffsetMonths:
                typeof row.preCutoffOffsetMonths === 'number'
                  ? row.preCutoffOffsetMonths
                  : 1,
              postCutoffOffsetMonths:
                typeof row.postCutoffOffsetMonths === 'number'
                  ? row.postCutoffOffsetMonths
                  : 2,
              dueShiftRule: row.dueShiftRule ?? 'SHIFT_PREVIOUS_FRIDAY',
            };
          }
          return {
            ...row,
            cutoffFormula: row.cutoffFormula ?? '',
            cutoffBoundaryInclusive:
              typeof row.cutoffBoundaryInclusive === 'boolean'
                ? row.cutoffBoundaryInclusive
                : false,
            preCutoffOffsetMonths:
              typeof row.preCutoffOffsetMonths === 'number'
                ? row.preCutoffOffsetMonths
                : 1,
            postCutoffOffsetMonths:
              typeof row.postCutoffOffsetMonths === 'number'
                ? row.postCutoffOffsetMonths
                : 1,
            dueShiftRule: row.dueShiftRule ?? 'EXACT_DAY',
          };
        })
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
      customShortcuts: (
        Array.isArray(raw?.sidebarNavigationConfig?.customShortcuts)
          ? raw.sidebarNavigationConfig.customShortcuts
          : defaults.sidebarNavigationConfig.customShortcuts
      ).filter(
        (s: CustomSidebarShortcut) =>
          s &&
          s.id !== 'shortcut_spinjam_freedom' &&
          !String(s.targetHref || '').includes('focus=spinjam'),
      ),
    },
    priorityTiers:
      Array.isArray(raw?.priorityTiers) && raw.priorityTiers.length > 0
        ? raw.priorityTiers.map((t: PriorityTierConfig, i: number) => ({
            key: String(t?.key || `TIER_${i + 1}`),
            label: String(t?.label || `Tier ${i + 1}`),
            order: Number.isFinite(Number(t?.order)) ? Number(t.order) : i + 1,
            enabled: t?.enabled !== false,
          }))
        : defaults.priorityTiers,
    savingsPockets:
      Array.isArray(raw?.savingsPockets) && raw.savingsPockets.length > 0
        ? raw.savingsPockets.map((p: SavingsPocketConfig, i: number) => ({
            id: String(p?.id || `pocket_${i + 1}`),
            key: String(p?.key || p?.id || `POCKET_${i + 1}`),
            name: String(p?.name || `Pocket ${i + 1}`),
            category:
              p?.category === 'EMERGENCY_FUND' ||
              p?.category === 'WISHLIST' ||
              p?.category === 'SINKING_RESERVE' ||
              p?.category === 'CUSTOM'
                ? p.category
                : 'CUSTOM',
            allocatedRp: Math.max(0, Math.round(Number(p?.allocatedRp) || 0)),
            targetRp: Math.max(0, Math.round(Number(p?.targetRp) || 0)),
            notes: p?.notes ? String(p.notes) : undefined,
          }))
        : defaults.savingsPockets,
    displayPreferences: {
      defaultLanguage:
        raw?.displayPreferences?.defaultLanguage === 'id' ||
        raw?.displayPreferences?.defaultLanguage === 'zh'
          ? raw.displayPreferences.defaultLanguage
          : defaults.displayPreferences.defaultLanguage,
      numberFormat:
        raw?.displayPreferences?.numberFormat === 'en-US'
          ? 'en-US'
          : defaults.displayPreferences.numberFormat,
      uiDensity:
        raw?.displayPreferences?.uiDensity === 'SIMPLE_CLARITY'
          ? 'SIMPLE_CLARITY'
          : defaults.displayPreferences.uiDensity,
      hidePriorityCodesInUi:
        typeof raw?.displayPreferences?.hidePriorityCodesInUi === 'boolean'
          ? raw.displayPreferences.hidePriorityCodesInUi
          : defaults.displayPreferences.hidePriorityCodesInUi,
    },
    privacyPreferences: {
      maskBalancesByDefault:
        typeof raw?.privacyPreferences?.maskBalancesByDefault === 'boolean'
          ? raw.privacyPreferences.maskBalancesByDefault
          : defaults.privacyPreferences.maskBalancesByDefault,
      requirePasswordToReveal:
        typeof raw?.privacyPreferences?.requirePasswordToReveal === 'boolean'
          ? raw.privacyPreferences.requirePasswordToReveal
          : defaults.privacyPreferences.requirePasswordToReveal,
    },
    thrConfig: {
      enabled:
        typeof raw?.thrConfig?.enabled === 'boolean'
          ? raw.thrConfig.enabled
          : defaults.thrConfig.enabled,
      label: String(raw?.thrConfig?.label || defaults.thrConfig.label),
      joinDateIso:
        typeof raw?.thrConfig?.joinDateIso === 'string'
          ? raw.thrConfig.joinDateIso
          : defaults.thrConfig.joinDateIso,
      holidayDateIso:
        typeof raw?.thrConfig?.holidayDateIso === 'string'
          ? raw.thrConfig.holidayDateIso
          : defaults.thrConfig.holidayDateIso,
      payoutMonth:
        Number.isFinite(Number(raw?.thrConfig?.payoutMonth)) &&
        Number(raw.thrConfig.payoutMonth) >= 1 &&
        Number(raw.thrConfig.payoutMonth) <= 12
          ? Math.round(Number(raw.thrConfig.payoutMonth))
          : defaults.thrConfig.payoutMonth,
      calculationMode:
        raw?.thrConfig?.calculationMode === 'FULL_BASE' ||
        raw?.thrConfig?.calculationMode === 'PRORATED_CALENDAR_DAYS' ||
        raw?.thrConfig?.calculationMode === 'PRORATED_MONTHS' ||
        raw?.thrConfig?.calculationMode === 'CUSTOM'
          ? raw.thrConfig.calculationMode
          : defaults.thrConfig.calculationMode,
      includeFixedAllowances:
        typeof raw?.thrConfig?.includeFixedAllowances === 'boolean'
          ? raw.thrConfig.includeFixedAllowances
          : defaults.thrConfig.includeFixedAllowances,
    },
    overviewPreferences: {
      defaultPacingMode:
        raw?.overviewPreferences?.defaultPacingMode === 'WEIGHTED_1_5X'
          ? 'WEIGHTED_1_5X'
          : defaults.overviewPreferences.defaultPacingMode,
      showDiscretionaryCard:
        typeof raw?.overviewPreferences?.showDiscretionaryCard === 'boolean'
          ? raw.overviewPreferences.showDiscretionaryCard
          : defaults.overviewPreferences.showDiscretionaryCard,
    },
  };
}
