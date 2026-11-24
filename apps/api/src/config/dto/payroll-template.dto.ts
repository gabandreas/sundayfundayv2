import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PayrollAdjustmentCalcType,
  PayrollAdjustmentStage,
} from '@prisma/client';

export class CreatePayrollTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  code?: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsEnum(PayrollAdjustmentStage)
  stage!: PayrollAdjustmentStage;

  @IsOptional()
  @IsEnum(PayrollAdjustmentCalcType)
  calcType?: PayrollAdjustmentCalcType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultAmount?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}

export class UpdatePayrollTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsEnum(PayrollAdjustmentStage)
  stage?: PayrollAdjustmentStage;

  @IsOptional()
  @IsEnum(PayrollAdjustmentCalcType)
  calcType?: PayrollAdjustmentCalcType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultAmount?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  notes?: string;
}
