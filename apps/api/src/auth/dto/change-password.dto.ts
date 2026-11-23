import { IsOptional, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(10, { message: 'New password must be at least 10 characters long.' })
  newPassword!: string;

  @IsString()
  @IsOptional()
  confirmPassword?: string;
}
