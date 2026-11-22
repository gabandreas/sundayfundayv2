import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SendMonthlyStatementEmailDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(['all', 'locked'])
  scope?: 'all' | 'locked';

  @IsOptional()
  @IsIn(['EN', 'ID', 'ZH'])
  locale?: 'EN' | 'ID' | 'ZH';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class SendDigestOrBackupEmailDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsIn(['EN', 'ID', 'ZH'])
  locale?: 'EN' | 'ID' | 'ZH';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

export class SendTestEmailDto {
  @IsOptional()
  @IsIn(['EN', 'ID', 'ZH'])
  locale?: 'EN' | 'ID' | 'ZH';

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
