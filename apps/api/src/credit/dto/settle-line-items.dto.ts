import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LiabilityCategory } from '@prisma/client';

export type BillSettlementState = 'UNPAID' | 'RESERVED' | 'PAID';

export class SettleLineItemDto {
  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;

  @IsOptional()
  @IsIn(['UNPAID', 'RESERVED', 'PAID'])
  settlementState?: BillSettlementState;
}

export class SettleBulkLineItemsDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number;

  @IsOptional()
  @IsEnum(LiabilityCategory)
  category?: LiabilityCategory;

  @IsOptional()
  @IsBoolean()
  isSettled?: boolean;

  @IsOptional()
  @IsIn(['UNPAID', 'RESERVED', 'PAID'])
  settlementState?: BillSettlementState;
}
