import { IsOptional, IsEnum } from 'class-validator';
import { WishlistStatus } from '@prisma/client';

export class QueryWishlistDto {
  @IsOptional()
  @IsEnum(WishlistStatus)
  status?: WishlistStatus;
}
