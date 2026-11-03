import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateCustomRequestDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsIn([
    'CUSTOM_PAYROLL_FORMULA',
    'CUSTOM_WATERFALL_RULE',
    'BANK_EXPORT_INTEGRATION',
    'BESPOKE_MODULE',
  ])
  category: string;

  @IsString()
  @IsNotEmpty()
  currentWorkflowDescription: string;

  @IsString()
  @IsNotEmpty()
  desiredBehavior: string;

  @IsOptional()
  @IsString()
  @IsIn(['NORMAL', 'HIGH_BUSINESS_CRITICAL'])
  priority?: string;
}

