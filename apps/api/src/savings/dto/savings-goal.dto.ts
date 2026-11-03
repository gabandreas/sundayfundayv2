import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsEnum,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SavingsInstrumentType } from '@prisma/client';

export class CreateSavingsGoalDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  targetAmount!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  targetYear!: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentAllocatedAmount?: number;
}

export class UpdateSavingsGoalDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  targetAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  targetYear?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  currentAllocatedAmount?: number;

  @IsOptional()
  @IsBoolean()
  isCompleted?: boolean;
}

export class ConfirmPeriodDepositDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsEnum(SavingsInstrumentType)
  instrumentType?: SavingsInstrumentType;
}
