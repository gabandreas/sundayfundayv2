import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

abstract interface class SecureVault {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<String?> readSessionId();
  Future<void> saveSessionTokens({
    required String accessToken,
    String? refreshToken,
    String? sessionId,
  });
  Future<void> clearSession({bool preserveDeviceBinding = false});

  Future<String> getOrCreateDeviceId();
  Future<String?> readBiometricSeed();
  Future<void> saveBiometricSeed(String seedBase64);
  Future<bool> isBiometricEnrolled();
  Future<void> setBiometricEnrolled(bool enabled);

  Future<bool> readHasSecurityPin();
  Future<void> saveHasSecurityPin(bool value);

  Future<void> saveUserHint({String? accountName, String? username});
  Future<({String? accountName, String? username})> readUserHint();

  Future<String?> readPreferredLanguage();
  Future<void> savePreferredLanguage(String code);

  Future<bool> readPrivacyMaskDefault();
  Future<void> savePrivacyMaskDefault(bool enabled);
}

class FlutterSecureVault implements SecureVault {
  static const String _accessTokenKey = 'sundayfunday_access_token';
  static const String _refreshTokenKey = 'sundayfunday_refresh_token';
  static const String _sessionIdKey = 'sundayfunday_session_id';
  static const String _deviceIdKey = 'sundayfunday_device_id';
  static const String _bioSeedKey = 'sundayfunday_bio_seed';
  static const String _bioEnrolledKey = 'sundayfunday_bio_enrolled';
  static const String _hasPinKey = 'sundayfunday_has_pin';
  static const String _lastAccountKey = 'sundayfunday_last_account';
  static const String _lastUserKey = 'sundayfunday_last_username';
  static const String _langKey = 'sundayfunday_lang';
  static const String _privacyMaskKey = 'sundayfunday_privacy_mask';

  final FlutterSecureStorage _storage;

  FlutterSecureVault([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  Future<String?> _safeRead(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (_) {
      return null;
    }
  }

  Future<void> _safeWrite(String key, String value) async {
    try {
      await _storage.write(key: key, value: value);
    } catch (_) {
      // Avoid crashing widget tests without platform channels
    }
  }

  Future<void> _safeDelete(String key) async {
    try {
      await _storage.delete(key: key);
    } catch (_) {}
  }

  @override
  Future<String?> readAccessToken() => _safeRead(_accessTokenKey);

  @override
  Future<String?> readRefreshToken() => _safeRead(_refreshTokenKey);

  @override
  Future<String?> readSessionId() => _safeRead(_sessionIdKey);

  @override
  Future<void> saveSessionTokens({
    required String accessToken,
    String? refreshToken,
    String? sessionId,
  }) async {
    await _safeWrite(_accessTokenKey, accessToken);
    if (refreshToken != null) {
      await _safeWrite(_refreshTokenKey, refreshToken);
    }
    if (sessionId != null) {
      await _safeWrite(_sessionIdKey, sessionId);
    }
  }

  @override
  Future<void> clearSession({bool preserveDeviceBinding = false}) async {
    await _safeDelete(_accessTokenKey);
    await _safeDelete(_refreshTokenKey);
    await _safeDelete(_sessionIdKey);
    if (!preserveDeviceBinding) {
      await _safeDelete(_bioSeedKey);
      await _safeDelete(_bioEnrolledKey);
      await _safeDelete(_hasPinKey);
    }
  }

  @override
  Future<String> getOrCreateDeviceId() async {
    final existing = await _safeRead(_deviceIdKey);
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }
    final generated = 'mob_${const Uuid().v4()}';
    await _safeWrite(_deviceIdKey, generated);
    return generated;
  }

  @override
  Future<String?> readBiometricSeed() => _safeRead(_bioSeedKey);

  @override
  Future<void> saveBiometricSeed(String seedBase64) async {
    await _safeWrite(_bioSeedKey, seedBase64);
    await _safeWrite(_bioEnrolledKey, 'true');
  }

  @override
  Future<bool> isBiometricEnrolled() async =>
      (await _safeRead(_bioEnrolledKey)) == 'true';

  @override
  Future<void> setBiometricEnrolled(bool enabled) async {
    await _safeWrite(_bioEnrolledKey, enabled ? 'true' : 'false');
    if (!enabled) {
      await _safeDelete(_bioSeedKey);
    }
  }

  @override
  Future<bool> readHasSecurityPin() async =>
      (await _safeRead(_hasPinKey)) == 'true';

  @override
  Future<void> saveHasSecurityPin(bool value) async {
    await _safeWrite(_hasPinKey, value ? 'true' : 'false');
  }

  @override
  Future<void> saveUserHint({String? accountName, String? username}) async {
    if (accountName != null) await _safeWrite(_lastAccountKey, accountName);
    if (username != null) await _safeWrite(_lastUserKey, username);
  }

  @override
  Future<({String? accountName, String? username})> readUserHint() async {
    final acc = await _safeRead(_lastAccountKey);
    final usr = await _safeRead(_lastUserKey);
    return (accountName: acc, username: usr);
  }

  @override
  Future<String?> readPreferredLanguage() => _safeRead(_langKey);

  @override
  Future<void> savePreferredLanguage(String code) => _safeWrite(_langKey, code);

  @override
  Future<bool> readPrivacyMaskDefault() async =>
      (await _safeRead(_privacyMaskKey)) == 'true';

  @override
  Future<void> savePrivacyMaskDefault(bool enabled) =>
      _safeWrite(_privacyMaskKey, enabled ? 'true' : 'false');
}
