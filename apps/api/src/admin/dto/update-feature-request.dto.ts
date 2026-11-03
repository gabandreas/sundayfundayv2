import { IsInt, IsOptional, IsString } from 'class-validator';

export class UpdateFeatureRequestDto {
  @IsString()
  @IsOptional()
  status?: string; // 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED_QUOTED' | 'IMPLEMENTED'

  @IsString()
  @IsOptional()
  adminNotes?: string;

  @IsInt()
  @IsOptional()
  estimatedSetupFee?: number;
}

