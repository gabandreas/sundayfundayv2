import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class SavingsPocketItemDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  key?: string;

  @IsString()
  name: string;

  @IsIn(['EMERGENCY_FUND', 'WISHLIST', 'SINKING_RESERVE', 'CUSTOM'])
  category: 'EMERGENCY_FUND' | 'WISHLIST' | 'SINKING_RESERVE' | 'CUSTOM';

  @IsNumber()
  @Min(0)
  allocatedRp: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  targetRp?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class SaveSavingsPocketsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavingsPocketItemDto)
  pockets: SavingsPocketItemDto[];
}
