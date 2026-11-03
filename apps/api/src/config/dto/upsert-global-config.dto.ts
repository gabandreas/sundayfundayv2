import { IsNumber, IsPositive, IsOptional, Min, Max, IsBoolean, IsString } from 'class-validator';

export class UpsertGlobalConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSalary?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  laptopAllowance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  dailyOperational?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transport?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  internet?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vape?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  haircut?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  baseSavings?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  creditLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  creditStatementDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  creditDueDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(31)
  payrollPayoutDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  ccUsageLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paylaterUsageLimit?: number;

  @IsOptional()
  payrollRulesJson?: any;

  @IsOptional()
  allocationBucketsJson?: any;

  @IsOptional()
  surplusSplitRulesJson?: any;

  @IsOptional()
  financialPolicyJson?: any;

  @IsOptional()
  @IsBoolean()
  autoCloseEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  autoCloseAfterDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  activeTrackingStartMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(2025)
  activeTrackingStartYear?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetWealthAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  targetWealthMonth?: number;

  @IsOptional()
  @IsNumber()
  @Min(2025)
  targetWealthYear?: number;

  @IsOptional()
  @IsString()
  targetWealthBase?: string;

  @IsOptional()
  @IsString()
  profileMode?: string;

  @IsOptional()
  @IsBoolean()
  onboardingCompleted?: boolean;

  @IsOptional()
  customRoutineLabelsJson?: any;

  @IsOptional()
  @IsString()
  payrollMode?: string;

  @IsOptional()
  @IsString()
  lifeStagePreset?: string;

  @IsOptional()
  @IsString()
  uiDensityMode?: string;

  @IsOptional()
  enabledModulesJson?: any;

  @IsOptional()
  @IsString()
  formulaEngineType?: string;

  @IsOptional()
  formulaParamsJson?: any;

  @IsOptional()
  customRoutineCategoriesJson?: any;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(90)
  killSwitchLeadDays?: number;

  @IsOptional()
  @IsBoolean()
  killSwitchBannerEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  recalculateDrafts?: boolean;

  @IsOptional()
  @IsNumber()
  fromMonth?: number;

  @IsOptional()
  @IsNumber()
  fromYear?: number;
}
