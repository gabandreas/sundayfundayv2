import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ResetClientPasswordDto {
  @IsString()
  @IsOptional()
  temporaryPassword?: string;

  @IsBoolean()
  @IsOptional()
  sendEmail?: boolean;

  @IsString()
  @IsOptional()
  locale?: string;
}
