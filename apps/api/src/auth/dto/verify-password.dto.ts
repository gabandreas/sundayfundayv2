import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyPasswordDto {
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password!: string;
}
