import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceName?: string;

  @IsIn(['IOS', 'ANDROID', 'HUAWEI_HARMONY', 'WEB'])
  @IsOptional()
  platform?: 'IOS' | 'ANDROID' | 'HUAWEI_HARMONY' | 'WEB';
}

export class LogoutDto {
  @IsString()
  @IsOptional()
  refreshToken?: string;
}

export class SetupPinDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Security PIN must be exactly 6 numeric digits.' })
  newPin!: string;
}

export class VerifyPinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Security PIN must be exactly 6 numeric digits.' })
  pin!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceId?: string;

  @IsString()
  @IsOptional()
  refreshToken?: string;

  @IsBoolean()
  @IsOptional()
  rotateSession?: boolean;
}

export class EnrollBiometricDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceName?: string;

  @IsIn(['IOS', 'ANDROID', 'HUAWEI_HARMONY'])
  @IsOptional()
  platform?: 'IOS' | 'ANDROID' | 'HUAWEI_HARMONY';

  @IsString()
  @IsOptional()
  @MaxLength(32)
  appVersion?: string;

  @IsString()
  @IsNotEmpty()
  publicKeyPem!: string;

  @IsIn(['ED25519', 'ECDSA_P256'])
  @IsOptional()
  keyAlgorithm?: 'ED25519' | 'ECDSA_P256';
}

export class BiometricChallengeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class VerifyBiometricDto {
  @IsString()
  @IsNotEmpty()
  challengeId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  signatureBase64!: string;

  @IsString()
  @IsOptional()
  @MaxLength(32)
  appVersion?: string;
}

export class SsoExchangeDto {
  @IsIn(['GOOGLE', 'APPLE', 'OIDC'])
  provider!: 'GOOGLE' | 'APPLE' | 'OIDC';

  @IsString()
  @IsNotEmpty()
  idToken!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  deviceName?: string;

  @IsIn(['IOS', 'ANDROID', 'HUAWEI_HARMONY', 'WEB'])
  @IsOptional()
  platform?: 'IOS' | 'ANDROID' | 'HUAWEI_HARMONY' | 'WEB';

  @IsString()
  @IsOptional()
  @MaxLength(32)
  appVersion?: string;
}
