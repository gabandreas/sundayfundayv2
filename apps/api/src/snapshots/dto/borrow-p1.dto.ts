import {
  IsNumber,
  Min,
  IsEnum,
  IsInt,
  Max,
  IsString,
  IsNotEmpty,
} from 'class-validator';

export class BorrowFromP1Dto {
  @IsNumber()
  @Min(1)
  amount: number;

  @IsEnum(['SELF_REWARD', 'LIVING_CASH'])
  destination: 'SELF_REWARD' | 'LIVING_CASH';

  @IsInt()
  @Min(1)
  @Max(12)
  refundMonth: number;

  @IsInt()
  @Min(2000)
  refundYear: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
