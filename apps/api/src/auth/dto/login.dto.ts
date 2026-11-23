import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  securityPin?: string;

  @IsBoolean()
  @IsOptional()
  trustIp?: boolean;

  @IsString()
  @IsOptional()
  ipLabel?: string;

  @IsString()
  @IsOptional()
  deviceId?: string;

  @IsString()
  @IsOptional()
  deviceName?: string;

  @IsIn(['IOS', 'ANDROID', 'HUAWEI_HARMONY', 'WEB'])
  @IsOptional()
  platform?: 'IOS' | 'ANDROID' | 'HUAWEI_HARMONY' | 'WEB';

  @IsString()
  @IsOptional()
  appVersion?: string;
}
