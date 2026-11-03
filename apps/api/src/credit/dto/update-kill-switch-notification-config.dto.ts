import { IsString, IsOptional, IsEmail } from 'class-validator';

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
  @IsString()
  killSwitchWebhookUrl?: string;

  @IsOptional()
  @IsString()
  killSwitchWaPhone?: string;

  @IsOptional()
  @IsString()
  killSwitchWaApiKey?: string;

  @IsOptional()
  @IsString()
  killSwitchCustomMessageTemplate?: string;
}
