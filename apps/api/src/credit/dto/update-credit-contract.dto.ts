import { IsString, IsOptional, IsNumber, Min, IsBoolean } from 'class-validator';

export class UpdateCreditContractDto {
  @IsString()
  @IsOptional()
  label?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  principalAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  monthlyInstallment?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
