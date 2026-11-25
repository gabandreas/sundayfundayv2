import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const EVENT_TYPES = [
  'DAY_OUTING',
  'WEEKEND_TRIP',
  'VACATION',
  'CONCERT_EVENT',
] as const;

export const EVENT_TIERS = ['CONSERVATIVE', 'BALANCED', 'MAX_SAFE'] as const;

export const EVENT_EXPENSE_CATEGORIES = [
  'FOOD_DRINK',
  'LOCAL_TRANSPORT',
  'ACTIVITIES',
  'CONTINGENCY',
] as const;

export class OptimizeTripEventDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2025)
  @Max(2035)
  year: number;

  @IsIn(EVENT_TYPES as unknown as string[])
  eventType: string;

  @IsInt()
  @Min(1)
  @Max(30)
  durationDays: number;

  @IsOptional()
  @IsString()
  startDateIso?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prepaidCommittedRp?: number;
}

export class CreateTripEventDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2025)
  @Max(2035)
  year: number;

  @IsString()
  title: string;

  @IsOptional()
  @IsIn(EVENT_TYPES as unknown as string[])
  eventType?: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsNumber()
  @Min(0)
  plannedCapRp: number;

  @IsOptional()
  @IsIn(EVENT_TIERS as unknown as string[])
  recommendedTier?: string;

  @IsOptional()
  @IsIn(['DISCRETIONARY', 'EMERGENCY_BUFFER', 'PAYCHECK_UPFRONT'])
  fundingSource?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prepaidAmountRp?: number;

  @IsOptional()
  @IsBoolean()
  createPrepaidCommitment?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTripEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(EVENT_TYPES as unknown as string[])
  eventType?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plannedCapRp?: number;

  @IsOptional()
  @IsIn(EVENT_TIERS as unknown as string[])
  recommendedTier?: string;

  @IsOptional()
  @IsIn(['PLANNING', 'ACTIVE', 'COMPLETED'])
  status?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateTripExpenseDto {
  @IsString()
  date: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsIn(EVENT_EXPENSE_CATEGORIES as unknown as string[])
  category?: string;

  @IsNumber()
  @Min(1)
  amountRp: number;

  @IsOptional()
  @IsBoolean()
  isSharedAdvance?: boolean;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reimbursedAmountRp?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateTripExpenseDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsIn(EVENT_EXPENSE_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amountRp?: number;

  @IsOptional()
  @IsBoolean()
  isSharedAdvance?: boolean;

  @IsOptional()
  @IsString()
  counterpartyName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reimbursedAmountRp?: number;

  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;
}

export class CloseSweepTripEventDto {
  @IsIn(['CORE_SAVINGS', 'DISCRETIONARY'])
  destination: 'CORE_SAVINGS' | 'DISCRETIONARY';
}
