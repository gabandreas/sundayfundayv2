import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class SecureVault {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> saveSessionTokens({
    required String accessToken,
    String? refreshToken,
  });
  Future<void> clearSession();
}

class FlutterSecureVault implements SecureVault {
  static const String _accessTokenKey = 'sundayfunday_access_token';
  static const String _refreshTokenKey = 'sundayfunday_refresh_token';

  final FlutterSecureStorage _storage;

  FlutterSecureVault([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> saveSessionTokens({
    required String accessToken,
    String? refreshToken,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
  }

  @override
  Future<void> clearSession() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
  }
}
