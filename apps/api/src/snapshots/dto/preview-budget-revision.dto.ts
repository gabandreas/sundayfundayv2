import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { BudgetRevisionCategory } from '@prisma/client';

export class PreviewBudgetRevisionDto {
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
}
