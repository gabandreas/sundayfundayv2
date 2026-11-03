import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsInt,
  IsDateString,
  IsBoolean,
} from 'class-validator';
import { CreditCardChargeType } from '@prisma/client';

export class CreateCreditCardTransactionDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  totalAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyAmount?: number;

  @IsEnum(CreditCardChargeType)
  @IsOptional()
  chargeType?: CreditCardChargeType;

  @IsInt()
  @Min(1)
  @IsOptional()
  tenor?: number;

  @IsString()
  @IsOptional()
  category?: string;

  @IsDateString()
  @IsNotEmpty()
  transactionDate: string;

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  endedAtMonth?: number;

  @IsInt()
  @Min(2000)
  @IsOptional()
  endedAtYear?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
