import 'package:sundayfunday_mobile/core/storage/secure_vault.dart';

class InMemorySecureVault implements SecureVault {
  String? accessToken;
  String? refreshToken;
  String? sessionId;
  String? deviceId;
  String? biometricSeedBase64;
  bool biometricEnrolled;
  bool hasSecurityPin;
  String? lastUsername;
  String? lastAccountName;
  String? preferredLanguage;
  bool privacyMaskDefault;

  InMemorySecureVault({
    this.accessToken,
    this.refreshToken,
    this.sessionId,
    this.deviceId = 'test-device-1',
    this.biometricEnrolled = false,
    this.hasSecurityPin = false,
    this.privacyMaskDefault = false,
  });

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<String?> readSessionId() async => sessionId;

  @override
  Future<void> saveSessionTokens({
    required String accessToken,
    String? refreshToken,
    String? sessionId,
  }) async {
    this.accessToken = accessToken;
    if (refreshToken != null) this.refreshToken = refreshToken;
    if (sessionId != null) this.sessionId = sessionId;
  }

  @override
  Future<void> clearSession({bool preserveDeviceBinding = false}) async {
    accessToken = null;
    refreshToken = null;
    sessionId = null;
    if (!preserveDeviceBinding) {
      biometricEnrolled = false;
      biometricSeedBase64 = null;
      hasSecurityPin = false;
    }
  }

  @override
  Future<String> getOrCreateDeviceId() async => deviceId ??= 'test-device-1';

  @override
  Future<String?> readBiometricSeed() async => biometricSeedBase64;

  @override
  Future<void> saveBiometricSeed(String seedBase64) async {
    biometricSeedBase64 = seedBase64;
    biometricEnrolled = true;
  }

  @override
  Future<bool> isBiometricEnrolled() async => biometricEnrolled;

  @override
  Future<void> setBiometricEnrolled(bool enabled) async {
    biometricEnrolled = enabled;
    if (!enabled) biometricSeedBase64 = null;
  }

  @override
  Future<bool> readHasSecurityPin() async => hasSecurityPin;

  @override
  Future<void> saveHasSecurityPin(bool value) async {
    hasSecurityPin = value;
  }

  @override
  Future<void> saveUserHint({String? accountName, String? username}) async {
    lastAccountName = accountName;
    lastUsername = username;
  }

  @override
  Future<({String? accountName, String? username})> readUserHint() async =>
      (accountName: lastAccountName, username: lastUsername);

  @override
  Future<String?> readPreferredLanguage() async => preferredLanguage;

  @override
  Future<void> savePreferredLanguage(String code) async {
    preferredLanguage = code;
  }

  @override
  Future<bool> readPrivacyMaskDefault() async => privacyMaskDefault;

  @override
  Future<void> savePrivacyMaskDefault(bool enabled) async {
    privacyMaskDefault = enabled;
  }
}
