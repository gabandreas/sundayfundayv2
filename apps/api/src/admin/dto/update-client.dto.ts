import { IsOptional, IsString } from 'class-validator';

export class UpdateClientDto {
  @IsString()
  @IsOptional()
  role?: string;

  @IsString()
  @IsOptional()
  status?: string; // 'ACTIVE' | 'SUSPENDED'

  @IsString()
  @IsOptional()
  blueprintType?: string;

  @IsString()
  @IsOptional()
  lifeStagePreset?: string;

  @IsString()
  @IsOptional()
  uiDensityMode?: string;

  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}

