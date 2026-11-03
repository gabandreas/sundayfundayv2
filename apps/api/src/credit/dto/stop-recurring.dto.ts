import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class StopRecurringDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  stopFromMonth!: number;

  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  stopFromYear!: number;
}
