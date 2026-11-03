import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';

export class UpdateCustomRequestDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  @IsIn([
    'CUSTOM_PAYROLL_FORMULA',
    'CUSTOM_WATERFALL_RULE',
    'BANK_EXPORT_INTEGRATION',
    'BESPOKE_MODULE',
  ])
  category?: string;

  @IsOptional()
  @IsString()
  currentWorkflowDescription?: string;

  @IsOptional()
  @IsString()
  desiredBehavior?: string;

  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'HIGH_BUSINESS_CRITICAL'])
  priority?: string;

  @IsOptional()
  @IsString()
  @IsIn(['SUBMITTED', 'IN_REVIEW', 'APPROVED_QUOTED', 'IMPLEMENTED'])
  status?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedSetupFee?: number;
}

