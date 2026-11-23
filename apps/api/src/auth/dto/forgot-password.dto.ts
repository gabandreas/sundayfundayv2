import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @IsIn(['en', 'id', 'zh', 'EN', 'ID', 'ZH'])
  @IsOptional()
  locale?: string;
}
