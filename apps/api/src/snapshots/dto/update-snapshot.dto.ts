import { IsOptional, IsInt, IsNumber, Min, IsBoolean, IsDateString } from 'class-validator';

export class UpdateSnapshotDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  totalWorkingDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cafeteriaDeduction?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  bonusAmount?: number;

  @IsOptional()
  @IsNumber()
  salaryAdjustment?: number;

  @IsOptional()
  @IsBoolean()
  useDecemberProratedThr?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thrAmount?: number;

  @IsOptional()
  @IsDateString()
  payrollPayoutDate?: string;
}
