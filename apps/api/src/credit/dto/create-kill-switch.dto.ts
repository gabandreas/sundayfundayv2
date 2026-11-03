import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
} from 'class-validator';

export class CreateKillSwitchDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  promoLabel?: string;

  @IsDateString()
  @IsNotEmpty()
  promoEndDate: string;

  @IsNumber()
  @Min(0)
  postPromoNormalAmount: number;

  @IsBoolean()
  @IsOptional()
  killSwitchEnabled?: boolean;

  @IsString()
  @IsOptional()
  providerCancelUrl?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  billingMonth?: number;

  @IsInt()
  @Min(2000)
  @IsOptional()
  billingYear?: number;
}
