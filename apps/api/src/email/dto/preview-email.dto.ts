import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class PreviewEmailTemplateDto {
  @IsIn([
    'monthly-statement',
    'cutoff-digest',
    'ledger-backup',
    'test-dispatch',
    'kill-switch',
  ])
  template:
    | 'monthly-statement'
    | 'cutoff-digest'
    | 'ledger-backup'
    | 'test-dispatch'
    | 'kill-switch';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(['all', 'locked'])
  scope?: 'all' | 'locked';

  @IsOptional()
  @IsIn(['EN', 'ID', 'ZH'])
  locale?: 'EN' | 'ID' | 'ZH';

  @IsOptional()
  @IsString()
  recipientEmail?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  killSwitchId?: number;
}
