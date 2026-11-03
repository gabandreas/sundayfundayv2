import { IsString, IsNotEmpty, IsNumber, IsPositive, IsInt, Min, Max } from 'class-validator';

export class CreateScheduledBillDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  /**
   * Monthly amount. Must be a positive number.
   */
  @IsNumber()
  @IsPositive()
  amount: number;

  /**
   * Day of the month this bill is due (1–28 to stay safe across all months).
   */
  @IsInt()
  @Min(1)
  @Max(28)
  dueDayOfMonth: number;
}
