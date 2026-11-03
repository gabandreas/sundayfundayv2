import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  Max,
  Min,
} from 'class-validator';
import { SavingsInstrumentType } from '@prisma/client';

export enum SavingsTransactionType {
  TOPUP = 'TOPUP',
  WITHDRAWAL = 'WITHDRAWAL',
}

export class CreateSavingsTransactionDto {
  @IsEnum(SavingsTransactionType)
  type: SavingsTransactionType;

  /**
   * Always a positive number — the service signs it based on type:
   * TOPUP => stored as +amount, WITHDRAWAL => stored as -amount.
   */
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsString()
  @IsNotEmpty()
  label: string;

  /**
   * ISO 8601 date string. Stored as DateTime on the record.
   */
  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsEnum(SavingsInstrumentType)
  instrumentType?: SavingsInstrumentType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  periodYear?: number;
}

export class RebalanceSavingsDto {
  @IsEnum(SavingsInstrumentType)
  fromInstrument!: SavingsInstrumentType;

  @IsEnum(SavingsInstrumentType)
  toInstrument!: SavingsInstrumentType;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  note?: string;
}
