import { IsIn, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class CompleteFirstLoginPasswordDto {
  @IsString()
  @MinLength(10, { message: 'New password must be at least 10 characters long.' })
  newPassword!: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword!: string;

  @IsIn(['en', 'id', 'zh', 'EN', 'ID', 'ZH'])
  @IsOptional()
  locale?: string;
}
