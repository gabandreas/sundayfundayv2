import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class UpdateMonthlyBulkBillDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  paylaterAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  personalDebtAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  creditCardAmount?: number;
}
