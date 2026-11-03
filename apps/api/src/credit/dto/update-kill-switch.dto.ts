import {
  IsString,
  IsNumber,
  Min,
  IsOptional,
  IsDateString,
  IsBoolean,
} from 'class-validator';

export class UpdateKillSwitchDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  promoLabel?: string;

  @IsDateString()
  @IsOptional()
  promoEndDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  postPromoNormalAmount?: number;

  @IsBoolean()
  @IsOptional()
  killSwitchEnabled?: boolean;

  @IsString()
  @IsOptional()
  providerCancelUrl?: string;

  @IsBoolean()
  @IsOptional()
  providerCancelConfirmed?: boolean;

  @IsBoolean()
  @IsOptional()
  autoStopAfterPromo?: boolean;
}
