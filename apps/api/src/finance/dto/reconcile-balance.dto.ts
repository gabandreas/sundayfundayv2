import {
  IsInt,
  Min,
  Max,
  IsOptional,
  IsIn,
  IsString,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import type { SurplusResolutionMode } from '../../calculator/reconciliation';

export class PreviewReconcileBalanceDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  actualRealBalance!: number;

  @IsOptional()
  @IsIn([
    'INCREASE_OPERATIONAL_TARGET',
    'RECORD_INCOME_ADJUSTMENT',
    'RECORD_OPERATIONAL_REFUND',
  ])
  surplusResolutionMode?: SurplusResolutionMode;

  @IsOptional()
  @IsBoolean()
  includesUnspentRoutinePool?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  note?: string;
}

export class ExecuteReconcileBalanceDto extends PreviewReconcileBalanceDto {}
