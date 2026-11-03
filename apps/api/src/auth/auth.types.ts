export type UserRole =
  | 'PLATFORM_OWNER'
  | 'BESPOKE_CLIENT'
  | 'STANDARD_MEMBER'
  | 'DEMO_SANDBOX';

export type UserStatus = 'ACTIVE' | 'SUSPENDED';

export type BlueprintType =
  | 'SUPERADMIN_BESPOKE'
  | 'BESPOKE_CUSTOM'
  | 'STANDARD_GENERAL';

export type LifeStagePreset =
  | 'SUPERADMIN_BESPOKE'
  | 'STUDENT_FIRST_JOBBER'
  | 'CORPORATE_PROFESSIONAL'
  | 'FREELANCER_VARIABLE'
  | 'FAMILY_HOUSEHOLD'
  | 'RETIREE_GOLDEN_AGE';

export type UiDensityMode = 'COMMAND_COCKPIT' | 'SIMPLE_CLARITY';

export type FormulaEngineType =
  | 'DEBT_FIRST_WATERFALL'
  | 'SAVINGS_FIRST_LOCK'
  | 'PERCENTAGE_SPLIT'
  | 'RETIREMENT_DRAWDOWN';

export type ModuleKey =
  | 'overview'
  | 'income'
  | 'allocations'
  | 'ledger'
  | 'preferences'
  | 'corporate_payroll'
  | 'credit_liabilities'
  | 'savings_vault'
  | 'wishlist_simulator'
  | 'discipline_audit'
  | 'advanced_analytics'
  | 'executive_reports';

export const ALL_MODULE_KEYS: ModuleKey[] = [
  'overview',
  'income',
  'allocations',
  'ledger',
  'preferences',
  'corporate_payroll',
  'credit_liabilities',
  'savings_vault',
  'wishlist_simulator',
  'discipline_audit',
  'advanced_analytics',
  'executive_reports',
];

export interface AuthenticatedUser {
  id: number;
  accountName: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  blueprintType: BlueprintType;
  lifeStagePreset: LifeStagePreset;
  uiDensityMode: UiDensityMode;
  ipWhitelistEnforced: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LifeStagePresetConfig {
  lifeStagePreset: LifeStagePreset;
  formulaEngineType: FormulaEngineType;
  formulaParamsJson: Record<string, any>;
  uiDensityMode: UiDensityMode;
  payrollMode: string;
  enabledModules: ModuleKey[];
  customRoutineLabels: Record<string, string>;
}

export function getLifeStagePresetDefaults(
  preset: string = 'CORPORATE_PROFESSIONAL',
): LifeStagePresetConfig {
  switch (preset) {
    case 'STUDENT_FIRST_JOBBER':
      return {
        lifeStagePreset: 'STUDENT_FIRST_JOBBER',
        formulaEngineType: 'PERCENTAGE_SPLIT',
        formulaParamsJson: { needsPct: 50, wantsPct: 30, savingsPct: 20 },
        uiDensityMode: 'COMMAND_COCKPIT',
        payrollMode: 'SIMPLE_FIXED_SALARY',
        enabledModules: [
          'overview',
          'income',
          'allocations',
          'ledger',
          'preferences',
          'savings_vault',
          'wishlist_simulator',
        ],
        customRoutineLabels: {
          transport: 'Transport',
          internet: 'Data & Subscriptions',
          vape: 'Boarding / Kos',
          haircut: 'Personal Care',
        },
      };

    case 'FREELANCER_VARIABLE':
      return {
        lifeStagePreset: 'FREELANCER_VARIABLE',
        formulaEngineType: 'SAVINGS_FIRST_LOCK',
        formulaParamsJson: {
          lockedSavingsMode: 'PERCENT',
          lockedSavingsPercent: 25,
        },
        uiDensityMode: 'COMMAND_COCKPIT',
        payrollMode: 'SIMPLE_FIXED_SALARY',
        enabledModules: [
          'overview',
          'income',
          'allocations',
          'ledger',
          'preferences',
          'credit_liabilities',
          'savings_vault',
          'discipline_audit',
          'advanced_analytics',
          'executive_reports',
        ],
        customRoutineLabels: {
          transport: 'Client & Transport',
          internet: 'Internet & Comms',
          vape: 'Workspace & Software',
          haircut: 'Health & Insurance',
        },
      };

    case 'FAMILY_HOUSEHOLD':
      return {
        lifeStagePreset: 'FAMILY_HOUSEHOLD',
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        formulaParamsJson: {},
        uiDensityMode: 'COMMAND_COCKPIT',
        payrollMode: 'SIMPLE_FIXED_SALARY',
        enabledModules: [...ALL_MODULE_KEYS],
        customRoutineLabels: {
          transport: 'Groceries & Utilities',
          internet: 'Children & Education',
          vape: 'Mortgage / Housing',
          haircut: 'Family Healthcare & Insurance',
        },
      };

    case 'RETIREE_GOLDEN_AGE':
      return {
        lifeStagePreset: 'RETIREE_GOLDEN_AGE',
        formulaEngineType: 'RETIREMENT_DRAWDOWN',
        formulaParamsJson: {
          monthlyDrawdownAmount: 2000000,
          healthcareEnvelopeTarget: 1000000,
        },
        uiDensityMode: 'SIMPLE_CLARITY',
        payrollMode: 'SIMPLE_FIXED_SALARY',
        enabledModules: [
          'overview',
          'income',
          'allocations',
          'ledger',
          'preferences',
          'savings_vault',
          'advanced_analytics',
        ],
        customRoutineLabels: {
          transport: 'Healthcare & Medication',
          internet: 'Home Utilities',
          vape: 'Family & Giving',
          haircut: 'Daily Comfort',
        },
      };

    case 'SUPERADMIN_BESPOKE':
      return {
        lifeStagePreset: 'SUPERADMIN_BESPOKE',
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        formulaParamsJson: {},
        uiDensityMode: 'COMMAND_COCKPIT',
        payrollMode: 'BESPOKE_ATTENDANCE',
        enabledModules: [...ALL_MODULE_KEYS],
        customRoutineLabels: {
          transport: 'Transport',
          internet: 'Internet & Connectivity',
          vape: 'Vape Supplies',
          haircut: 'Haircut & Grooming',
        },
      };

    case 'CORPORATE_PROFESSIONAL':
    default:
      return {
        lifeStagePreset: 'CORPORATE_PROFESSIONAL',
        formulaEngineType: 'DEBT_FIRST_WATERFALL',
        formulaParamsJson: {},
        uiDensityMode: 'COMMAND_COCKPIT',
        payrollMode: 'SIMPLE_FIXED_SALARY',
        enabledModules: [...ALL_MODULE_KEYS],
        customRoutineLabels: {
          transport: 'Transport & Commute',
          internet: 'Internet & Utilities',
          vape: 'Subscriptions & Lifestyle',
          haircut: 'Personal Care',
        },
      };
  }
}
