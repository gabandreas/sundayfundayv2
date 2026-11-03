import { IsBoolean, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class AddTrustedIpDto {
  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

  @IsString()
  @IsNotEmpty()
  label!: string;
}

export class UpdateSecuritySettingsDto {
  @IsBoolean()
  @IsOptional()
  ipWhitelistEnforced?: boolean;

  @IsString()
  @IsOptional()
  securityPin?: string;

  @IsString()
  @IsOptional()
  password?: string;
}

export class UpdateOwnerCredentialsDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @IsOptional()
  newEmail?: string;

  @IsString()
  @IsOptional()
  newPassword?: string;

  @IsString()
  @IsOptional()
  @Length(6, 6, { message: 'Security PIN must be exactly 6 digits' })
  newSecurityPin?: string;
}
