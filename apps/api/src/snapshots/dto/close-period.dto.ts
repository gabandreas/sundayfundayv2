import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ClosePeriodDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  vaultTopupAmount?: number;

  @IsOptional()
  @IsString()
  vaultTopupLabel?: string;
}
