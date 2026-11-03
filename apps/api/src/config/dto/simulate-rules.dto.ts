import { IsOptional, IsNumber, Min } from 'class-validator';

export class SimulateRulesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  income?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  debts?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  cycleDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalWorkingDays?: number;

  @IsOptional()
  payrollRules?: any[];

  @IsOptional()
  allocationBuckets?: any[];

  @IsOptional()
  surplusSplitRules?: any;

  @IsOptional()
  financialPolicy?: any;
}
