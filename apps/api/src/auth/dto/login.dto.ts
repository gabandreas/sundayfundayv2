import { IsEmail, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

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
}

