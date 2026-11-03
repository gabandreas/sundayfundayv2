import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  IsOptional,
  IsEnum,
  IsInt,
  Max,
} from 'class-validator';
import { WishlistFundingType, WishlistStatus } from '@prisma/client';

export class CreateWishlistItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsEnum(WishlistFundingType)
  fundingType?: WishlistFundingType;

  @IsOptional()
  @IsString()
  provider?: string;

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

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  targetYear?: number;

  @IsOptional()
  @IsEnum(WishlistStatus)
  status?: WishlistStatus;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
