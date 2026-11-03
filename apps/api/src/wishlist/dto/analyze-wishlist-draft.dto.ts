import {
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsInt,
} from 'class-validator';
import { WishlistFundingType } from '@prisma/client';

export class AnalyzeWishlistDraftDto {
  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsEnum(WishlistFundingType)
  fundingType?: WishlistFundingType;

  @IsOptional()
  @IsInt()
  @Min(1)
  tenor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPayment?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  interestPercent?: number;
}
