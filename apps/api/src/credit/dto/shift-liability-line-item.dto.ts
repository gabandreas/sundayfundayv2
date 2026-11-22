import {
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  Min,
} from 'class-validator';

export class ShiftLiabilityLineItemDto {
  @IsEnum(['EARLIER', 'LATER'])
  direction: 'EARLIER' | 'LATER';

  @IsOptional()
  @IsBoolean()
  shiftAllRemainingInContract?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  splitAmount?: number;
}
