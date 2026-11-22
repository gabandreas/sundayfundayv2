import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  Min,
  Max,
  IsOptional,
  IsEnum,
} from 'class-validator';

export class CreateBridgeLoanDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsOptional()
  @IsString()
  merchantOrPlatform?: string;

  @IsNumber()
  @Min(1)
  principalAmount: number;

  @IsNumber()
  @Min(1)
  monthlyInstallment: number;

  @IsInt()
  @Min(1)
  @Max(60)
  tenorMonths: number;

  @IsInt()
  @Min(1)
  @Max(12)
  inflowMonth: number;

  @IsInt()
  @Min(2000)
  inflowYear: number;

  @IsNumber()
  @Min(0)
  livingCashAllocation: number;

  @IsNumber()
  @Min(0)
  routineBillsAllocation: number;

  @IsOptional()
  @IsEnum(['TRANSPORT', 'INTERNET', 'VAPE', 'HAIRCUT'])
  routineCategorySlot?: 'TRANSPORT' | 'INTERNET' | 'VAPE' | 'HAIRCUT';

  @IsOptional()
  @IsString()
  routineSlotLabel?: string;

  @IsInt()
  @Min(1)
  @Max(12)
  firstInstallmentMonth: number;

  @IsInt()
  @Min(2000)
  firstInstallmentYear: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  earlyPayoffMonth?: number;

  @IsOptional()
  @IsInt()
  @Min(2000)
  earlyPayoffYear?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;
}

export class AccelerateBridgeLoanDto {
  @IsString()
  @IsNotEmpty()
  parentContractId: string;

  @IsInt()
  @Min(1)
  @Max(12)
  targetMonth: number;

  @IsInt()
  @Min(2000)
  targetYear: number;
}
