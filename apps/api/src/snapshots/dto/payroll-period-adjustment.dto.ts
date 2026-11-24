import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PayrollAdjustmentStage } from '@prisma/client';

export class CreatePayrollPeriodAdjustmentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  templateId?: number;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsEnum(PayrollAdjustmentStage)
  stage!: PayrollAdjustmentStage;

  @IsNumber()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}
