import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { CreditCardStatus } from '@prisma/client';

export class UpdateCreditCardTransactionDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(1)
  @Max(12)
  endedAtMonth?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(2000)
  @Max(2100)
  endedAtYear?: number | null;

  @IsOptional()
  @IsEnum(CreditCardStatus)
  status?: CreditCardStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
