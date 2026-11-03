import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @IsOptional()
  lifeStagePreset?: string;

  @IsString()
  @IsOptional()
  uiDensityMode?: string;

  @IsNumber()
  @IsOptional()
  initialSalary?: number;

  @IsNumber()
  @IsOptional()
  dailyLivingBudget?: number;

  @IsNumber()
  @IsOptional()
  coreSavingsTarget?: number;
}
