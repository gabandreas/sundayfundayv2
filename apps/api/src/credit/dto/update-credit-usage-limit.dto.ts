import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateCreditUsageLimitDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ccUsageLimit?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  paylaterUsageLimit?: number;

  @IsOptional()
  @IsBoolean()
  saveAsGlobalDefault?: boolean;
}
