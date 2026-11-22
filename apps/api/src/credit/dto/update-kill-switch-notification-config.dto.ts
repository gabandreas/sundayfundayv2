import { IsBoolean, IsString, IsOptional } from 'class-validator';

export class UpdateKillSwitchNotificationConfigDto {
  @IsOptional()
  @IsString()
  killSwitchNotifyEmail?: string;

  @IsOptional()
  @IsString()
  killSwitchSmtpUser?: string;

  @IsOptional()
  @IsString()
  killSwitchSmtpAppPassword?: string;

  @IsOptional()
  @IsBoolean()
  clearSmtpPassword?: boolean;

  @IsOptional()
  @IsBoolean()
  resetSmtpConfig?: boolean;

  @IsOptional()
  @IsString()
  killSwitchWebhookUrl?: string;

  @IsOptional()
  @IsString()
  killSwitchWaPhone?: string;

  @IsOptional()
  @IsString()
  killSwitchWaApiKey?: string;

  @IsOptional()
  @IsBoolean()
  clearWaApiKey?: boolean;

  @IsOptional()
  @IsString()
  killSwitchCustomMessageTemplate?: string;
}
