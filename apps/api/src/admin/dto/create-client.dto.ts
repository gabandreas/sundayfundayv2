import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

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
  @IsOptional()
  password?: string;

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

  @IsInt()
  @Min(0)
  @IsOptional()
  initialMonthlyIncome?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  @IsOptional()
  paydayAnchorDay?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  enabledModules?: string[];

  @IsBoolean()
  @IsOptional()
  sendWelcomeEmail?: boolean;

  @IsString()
  @IsOptional()
  locale?: string;

  @IsBoolean()
  @IsOptional()
  mustChangePassword?: boolean;
}
