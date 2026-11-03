import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsInt,
  Max,
  IsEnum,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { TransactionType, FixedEssentialCategory } from '@prisma/client';

export class CreateTransactionDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  @IsEnum(FixedEssentialCategory)
  fixedEssentialCategory?: FixedEssentialCategory;

  @IsOptional()
  @IsString()
  bucketKey?: string;

  @IsOptional()
  @IsBoolean()
  isOperationalRefund?: boolean;
}
