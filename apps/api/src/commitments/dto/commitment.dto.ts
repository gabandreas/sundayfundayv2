import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const COMMITMENT_CATEGORIES = [
  'FORCE_MAJEURE',
  'EVENT_OUTING',
  'PENALTY_FEE',
  'ANNUAL_TAX',
  'MEDICAL',
  'GIFT',
  'OTHER',
] as const;

export const COMMITMENT_FUNDING_SOURCES = [
  'PAYCHECK_UPFRONT',
  'DISCRETIONARY',
  'EMERGENCY_BUFFER',
] as const;

export const COMMITMENT_STATUSES = ['UNPAID', 'RESERVED', 'PAID'] as const;

export class CreateCommitmentDto {
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
  @IsIn(COMMITMENT_CATEGORIES as unknown as string[])
  category?: string;

  @IsNumber()
  @Min(1)
  amount: number;

  @IsString()
  dueDate: string;

  @IsOptional()
  @IsIn(COMMITMENT_FUNDING_SOURCES as unknown as string[])
  fundingSource?: string;

  @IsOptional()
  @IsInt()
  tripEventId?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCommitmentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(COMMITMENT_CATEGORIES as unknown as string[])
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  amount?: number;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsIn(COMMITMENT_FUNDING_SOURCES as unknown as string[])
  fundingSource?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SetCommitmentStatusDto {
  @IsIn(COMMITMENT_STATUSES as unknown as string[])
  status: string;
}
