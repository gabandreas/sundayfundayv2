import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { LiabilityCategory } from '@prisma/client';

export class CreateLiabilityLineItemDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsEnum(LiabilityCategory)
  category: LiabilityCategory;

  @IsOptional()
  @IsString()
  merchantOrPlatform?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalAmount?: number;

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
  @IsInt()
  @Min(1)
  @Max(12)
  startMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  startYear?: number;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsBoolean()
  autoRouteByCutoff?: boolean;

  @IsOptional()
  @IsBoolean()
  holdPastCutoff?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  cutoffDay?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  @IsOptional()
  @IsString()
  parentContractId?: string;

  @IsOptional()
  @IsString()
  amountMode?: 'PRINCIPAL_SPLIT' | 'FIXED_MONTHLY';

  @IsOptional()
  @IsString()
  notes?: string;
}
