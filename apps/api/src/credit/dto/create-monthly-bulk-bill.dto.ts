import { IsString, IsOptional, IsNumber, Min, IsInt, Max } from 'class-validator';

export class CreateMonthlyBulkBillDto {
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

  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  year: number;
}
