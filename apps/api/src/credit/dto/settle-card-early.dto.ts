import { IsInt, Min, Max, IsOptional, IsIn, IsString } from 'class-validator';

export type EarlySettlementMode =
  | 'LUMP_SUM_CURRENT_PERIOD'
  | 'MARK_SETTLED_ONLY';

export class SettleCardEarlyDto {
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsOptional()
  @IsIn(['LUMP_SUM_CURRENT_PERIOD', 'MARK_SETTLED_ONLY'])
  settlementMode?: EarlySettlementMode;

  @IsOptional()
  @IsString()
  note?: string;
}
