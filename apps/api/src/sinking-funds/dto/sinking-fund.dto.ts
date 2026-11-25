import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateSinkingFundDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsNumber()
  @Min(1)
  targetAmountRp: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  savedAmountRp?: number;

  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth: number;

  @IsInt()
  @Min(2025)
  @Max(2040)
  targetYear: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateSinkingFundDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  targetAmountRp?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  savedAmountRp?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2025)
  @Max(2040)
  targetYear?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContributeSinkingFundDto {
  @IsNumber()
  @Min(1)
  amountRp: number;
}
