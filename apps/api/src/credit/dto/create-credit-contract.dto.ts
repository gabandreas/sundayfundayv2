import { IsString, IsNotEmpty, IsNumber, Min, IsInt, Max } from 'class-validator';

export class CreateCreditContractDto {
  @IsString()
  @IsNotEmpty()
  label: string;

  @IsNumber()
  @Min(0)
  principalAmount: number;

  @IsNumber()
  @Min(0)
  monthlyInstallment: number;

  @IsInt()
  @Min(1)
  totalTenor: number;

  @IsInt()
  @Min(1)
  @Max(12)
  startMonth: number;

  @IsInt()
  @Min(2000)
  startYear: number;
}
