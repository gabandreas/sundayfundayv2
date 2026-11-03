import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { BudgetRevisionCategory } from '@prisma/client';

export class CreateBudgetRevisionDto {
  @IsOptional()
  @IsEnum(BudgetRevisionCategory)
  category?: BudgetRevisionCategory;

  @IsOptional()
  @IsString()
  bucketKey?: string;

  @IsOptional()
  @IsString()
  bucketLabel?: string;

  @IsNumber({}, { message: 'newValue must be a number' })
  @Min(0, { message: 'newValue cannot be negative' })
  newValue: number;

  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MinLength(3, { message: 'reason must be at least 3 characters' })
  reason: string;
}
