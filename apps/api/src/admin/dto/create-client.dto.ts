import { IsEmail, IsNotEmpty, IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsOptional()
  accountName?: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  blueprintType?: string;

  @IsString()
  @IsOptional()
  lifeStagePreset?: string;

  @IsString()
  @IsOptional()
  uiDensityMode?: string;

  @IsBoolean()
  @IsOptional()
  initializeSnapshot?: boolean;
}

