import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail({}, { message: 'Please enter a valid email address.' })
  @MaxLength(160)
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Display name cannot be empty.' })
  @MaxLength(120)
  fullName?: string;
}
