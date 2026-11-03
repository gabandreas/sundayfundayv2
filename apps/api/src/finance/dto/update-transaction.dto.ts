import { IsOptional, IsString, IsNumber, Min, IsDateString } from 'class-validator';

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;
}
