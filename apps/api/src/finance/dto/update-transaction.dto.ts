import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  IsDateString,
  IsEnum,
  IsIn,
} from 'class-validator';
import { FixedEssentialCategory } from '@prisma/client';

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(FixedEssentialCategory)
  fixedEssentialCategory?: FixedEssentialCategory | null;

  @IsOptional()
  @IsIn(['CASH', 'PAYLATER', 'CC'])
  paymentMethod?: 'CASH' | 'PAYLATER' | 'CC';
}
