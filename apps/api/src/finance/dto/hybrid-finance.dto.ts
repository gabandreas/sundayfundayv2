import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class SimulateCutoffDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsIn(['SPAYLATER', 'CREDIT_CARD', 'SPINJAM', 'PERSONAL_DEBT', 'CASH'])
  instrument: 'SPAYLATER' | 'CREDIT_CARD' | 'SPINJAM' | 'PERSONAL_DEBT' | 'CASH';

  @IsOptional()
  @IsIn(['PRINCIPAL_SPLIT', 'FIXED_MONTHLY'])
  amountMode?: 'PRINCIPAL_SPLIT' | 'FIXED_MONTHLY';

  @IsNumber()
  @Min(0)
  principalAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyAmount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  tenorMonths?: number;

  @IsOptional()
  @IsString()
  purchaseDate?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDayOverride?: number;

  @IsOptional()
  @IsBoolean()
  holdPastCutoff?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  startMonthOverride?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  startYearOverride?: number;

  @IsOptional()
  @IsString()
  cutoffFormula?: string;

  @IsOptional()
  @IsBoolean()
  cutoffBoundaryInclusive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  preCutoffOffsetMonths?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  postCutoffOffsetMonths?: number;

  @IsOptional()
  @IsString()
  dueShiftRule?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  anchorDay?: number;
}

export class SimulateTimelineDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  spaylaterEarlyPayAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thrAmountOverride?: number;

  @IsOptional()
  @IsString()
  thrDateIso?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paycheckAmountOverride?: number;
}

export class WalletGuardEvaluateDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsNumber()
  @Min(0)
  actualWalletBalance: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reservedBillsTotal?: number;

  @IsOptional()
  @IsBoolean()
  persist?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}

export class ParseReconcilerDto {
  @IsString()
  rawText: string;

  @IsOptional()
  @IsIn(['CASH', 'PAYLATER', 'CREDIT_CARD'])
  defaultMethod?: 'CASH' | 'PAYLATER' | 'CREDIT_CARD';

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  defaultYear?: number;
}

export class CommitReconcilerRowDto {
  @IsString()
  dateIso: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  amountRp: number;

  @IsIn(['CASH', 'PAYLATER', 'CREDIT_CARD', 'CASH_LOAN'])
  instrument: 'CASH' | 'PAYLATER' | 'CREDIT_CARD' | 'CASH_LOAN';

  @IsInt()
  @Min(1)
  @Max(12)
  targetPeriodMonth: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  targetPeriodYear: number;

  @IsOptional()
  @IsString()
  inferredCategory?: string;
}

export class CommitReconcilerDto {
  rows: CommitReconcilerRowDto[];
}

export class EvaluateFormulaSuiteDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsObject()
  formulas: Record<string, string>;

  @IsOptional()
  @IsObject()
  overrideVariables?: Record<string, number>;
}

export class SimulateScenarioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsNumber()
  extraMonthlySavingsRp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  oneTimeBonusRp?: number;

  @IsOptional()
  @IsNumber()
  monthlyLivingDeltaRp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraDebtPrepaymentRp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  variableShockPercent?: number;
}

export class StressTestScenarioDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(40)
  incomeVolatilityPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  expenseShockProbPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(50)
  expenseShockMagnitudePct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(25)
  unexpectedEmergencyProbPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unexpectedEmergencyCostRp?: number;

  @IsOptional()
  @IsInt()
  @Min(200)
  @Max(10000)
  trials?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySurplusOverrideRp?: number;
}
