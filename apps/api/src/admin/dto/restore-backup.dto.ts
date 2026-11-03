import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum RestoreMode {
  VALIDATE_DRY_RUN = 'VALIDATE_DRY_RUN',
  RESTORE_OVERWRITE = 'RESTORE_OVERWRITE',
}

export class RestoreBackupDto {
  @IsEnum(RestoreMode)
  @IsNotEmpty()
  mode!: RestoreMode;

  @IsString()
  @IsOptional()
  confirmationText?: string;

  @IsString()
  @IsOptional()
  securityPin?: string;

  @IsNotEmpty()
  backup!: any;
}

