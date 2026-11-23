import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/security/biometric_auth_service.dart';
import '../../core/storage/secure_vault.dart';
import '../../core/widgets/erp_feedback.dart';

enum AuthStatus { unauthenticated, locked, authenticated }

class AuthState {
  final AuthStatus status;
  final String? displayName;
  final String? email;
  final String? accountName;
  final String? username;
  final bool busy;
  final String? errorMessage;
  final bool requiresPin;
  final bool hasSecurityPin;
  final bool biometricEnrolled;
  final bool biometricAvailable;
  final bool bootstrapped;

  const AuthState({
    this.status = AuthStatus.unauthenticated,
    this.displayName,
    this.email,
    this.accountName,
    this.username,
    this.busy = false,
    this.errorMessage,
    this.requiresPin = false,
    this.hasSecurityPin = false,
    this.biometricEnrolled = false,
    this.biometricAvailable = false,
    this.bootstrapped = false,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? displayName,
    String? email,
    String? accountName,
    String? username,
    bool? busy,
    String? errorMessage,
    bool? requiresPin,
    bool? hasSecurityPin,
    bool? biometricEnrolled,
    bool? biometricAvailable,
    bool? bootstrapped,
  }) {
    return AuthState(
      status: status ?? this.status,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      accountName: accountName ?? this.accountName,
      username: username ?? this.username,
      busy: busy ?? this.busy,
      errorMessage: errorMessage,
      requiresPin: requiresPin ?? this.requiresPin,
      hasSecurityPin: hasSecurityPin ?? this.hasSecurityPin,
      biometricEnrolled: biometricEnrolled ?? this.biometricEnrolled,
      biometricAvailable: biometricAvailable ?? this.biometricAvailable,
      bootstrapped: bootstrapped ?? this.bootstrapped,
    );
  }
}

final secureVaultProvider = Provider<SecureVault>((ref) => FlutterSecureVault());

final biometricGatewayProvider = Provider<BiometricGateway>(
  (ref) => LocalAuthBiometricGateway(),
);

final deviceKeyManagerProvider = Provider<DeviceKeyManager>(
  (ref) => DeviceKeyManager(vault: ref.watch(secureVaultProvider)),
);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    vault: ref.watch(secureVaultProvider),
    onSessionExpired: () {
      ref.read(authProvider.notifier).handleSessionExpired();
    },
  );
});

class LanguageNotifier extends Notifier<AppLanguage> {
  @override
  AppLanguage build() => AppLanguage.en;

  Future<void> loadSavedLanguage() async {
    final code = await ref.read(secureVaultProvider).readPreferredLanguage();
    if (code != null) {
      state = AppLanguageCode.fromCode(code);
    }
  }

  Future<void> setLanguage(AppLanguage lang) async {
    state = lang;
    await ref.read(secureVaultProvider).savePreferredLanguage(lang.code);
  }
}

final languageProvider = NotifierProvider<LanguageNotifier, AppLanguage>(
  LanguageNotifier.new,
);

class AuthNotifier extends Notifier<AuthState> {
  final AuthState? _initialOverride;

  AuthNotifier([this._initialOverride]);

  @override
  AuthState build() => _initialOverride ?? const AuthState();

  String _devicePlatformLabel() {
    if (kIsWeb) return 'WEB';
    if (Platform.isIOS) return 'IOS';
    return 'ANDROID';
  }

  String _deviceModelLabel() {
    if (kIsWeb) return 'Web Browser';
    return Platform.isIOS ? 'iPhone' : 'Android Device';
  }

  Future<void> bootstrapSession() async {
    if (_initialOverride != null || state.bootstrapped) return;
    final vault = ref.read(secureVaultProvider);
    final bioGateway = ref.read(biometricGatewayProvider);

    final [refreshToken, hasPin, bioEnrolled, bioAvail, hint] =
        await Future.wait<dynamic>([
      vault.readRefreshToken(),
      vault.readHasSecurityPin(),
      vault.isBiometricEnrolled(),
      bioGateway.isAvailable(),
      vault.readUserHint(),
    ]);

    final hintRecord = hint as ({String? accountName, String? username});
    final hasRt = refreshToken is String && refreshToken.isNotEmpty;

    if (!hasRt) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        biometricAvailable: bioAvail == true,
        accountName: hintRecord.accountName,
        username: hintRecord.username,
        bootstrapped: true,
      );
      return;
    }

    if (hasPin == true || bioEnrolled == true) {
      state = state.copyWith(
        status: AuthStatus.locked,
        displayName: hintRecord.username ?? 'Sunday Funday',
        accountName: hintRecord.accountName,
        username: hintRecord.username,
        hasSecurityPin: hasPin == true,
        biometricEnrolled: bioEnrolled == true,
        biometricAvailable: bioAvail == true,
        bootstrapped: true,
      );
      return;
    }

    // Attempt silent session probe when no local PIN/biometric gate configured
    try {
      final client = ref.read(apiClientProvider);
      final meRes = await client.get<Map<String, dynamic>>('/api/auth/me');
      final user = meRes.data ?? const {};
      state = state.copyWith(
        status: AuthStatus.authenticated,
        displayName: user['fullName']?.toString(),
        email: user['email']?.toString(),
        accountName: user['accountName']?.toString(),
        username: user['username']?.toString(),
        biometricAvailable: bioAvail == true,
        bootstrapped: true,
      );
    } catch (_) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        biometricAvailable: bioAvail == true,
        bootstrapped: true,
      );
    }
  }

  Future<void> signIn({
    required String accountName,
    required String username,
    required String password,
    String? securityPin,
  }) async {
    state = state.copyWith(busy: true, errorMessage: null);
    try {
      final client = ref.read(apiClientProvider);
      final vault = ref.read(secureVaultProvider);
      final deviceId = await vault.getOrCreateDeviceId();

      final response = await client.post<Map<String, dynamic>>(
        '/api/auth/login',
        data: {
          if (accountName.trim().isNotEmpty) 'accountName': accountName.trim(),
          'username': username.trim(),
          'password': password,
          if (securityPin != null && securityPin.trim().isNotEmpty)
            'securityPin': securityPin.trim(),
          'deviceId': deviceId,
          'deviceName': _deviceModelLabel(),
          'platform': _devicePlatformLabel(),
          'appVersion': '1.0.0',
        },
      );

      final body = response.data ?? const {};
      if (body['requiresPin'] == true) {
        state = state.copyWith(
          busy: false,
          requiresPin: true,
          errorMessage: body['message']?.toString(),
        );
        return;
      }

      await _applySessionPayload(body);
    } on RateLimitedException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
    } on UnauthorizedSessionException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
    } on ApiValidationException catch (e) {
      state = state.copyWith(busy: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(
        busy: false,
        errorMessage: 'Unable to reach API server. Check connection.',
      );
    }
  }

  Future<void> signInDemoSandbox() async {
    state = state.copyWith(busy: true, errorMessage: null);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.post<Map<String, dynamic>>(
        '/api/auth/demo-login',
      );
      await _applySessionPayload(response.data ?? const {});
    } catch (_) {
      state = state.copyWith(
        busy: false,
        errorMessage: 'Unable to start demo session. Check connection.',
      );
    }
  }

  Future<void> unlockWithBiometrics(String localizedReason) async {
    state = state.copyWith(busy: true, errorMessage: null);
    try {
      final bio = ref.read(biometricGatewayProvider);
      final vault = ref.read(secureVaultProvider);
      final keyManager = ref.read(deviceKeyManagerProvider);
      final client = ref.read(apiClientProvider);

      final approved = await bio.authenticate(localizedReason);
      if (!approved) {
        state = state.copyWith(busy: false);
        return;
      }

      final refreshToken = await vault.readRefreshToken();
      if (refreshToken == null || refreshToken.isEmpty) {
        state = state.copyWith(
          status: AuthStatus.unauthenticated,
          busy: false,
          errorMessage: 'Session expired. Sign in again.',
        );
        return;
      }

      final deviceId = await vault.getOrCreateDeviceId();
      final chalRes = await client.post<Map<String, dynamic>>(
        '/api/auth/biometric/challenge',
        data: {'deviceId': deviceId, 'refreshToken': refreshToken},
      );
      final chal = chalRes.data ?? const {};
      final challengeId = chal['challengeId']?.toString() ?? '';
      final signingPayload = chal['signingPayload']?.toString() ?? '';
      if (challengeId.isEmpty || signingPayload.isEmpty) {
        state = state.copyWith(
          busy: false,
          errorMessage: 'Biometric challenge failed.',
        );
        return;
      }

      final sigBase64 = await keyManager.signChallengePayload(signingPayload);
      final verifyRes = await client.post<Map<String, dynamic>>(
        '/api/auth/biometric/verify',
        data: {
          'challengeId': challengeId,
          'deviceId': deviceId,
          'signatureBase64': sigBase64,
          'appVersion': '1.0.0',
        },
      );

      ErpHaptics.medium();
      await _applySessionPayload(verifyRes.data ?? const {});
    } on RateLimitedException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
    } on UnauthorizedSessionException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(
        busy: false,
        errorMessage: 'Biometric verification failed. Use your 6-digit PIN.',
      );
    }
  }

  Future<bool> unlockWithPin(String pin) async {
    state = state.copyWith(busy: true, errorMessage: null);
    try {
      final vault = ref.read(secureVaultProvider);
      final client = ref.read(apiClientProvider);
      final deviceId = await vault.getOrCreateDeviceId();
      final refreshToken = await vault.readRefreshToken();

      final response = await client.post<Map<String, dynamic>>(
        '/api/auth/pin/verify',
        data: {
          'pin': pin,
          'deviceId': deviceId,
          'refreshToken': ?refreshToken,
          'rotateSession': refreshToken != null,
        },
      );

      final body = response.data ?? const {};
      if (body['accessToken'] is String) {
        await _applySessionPayload(body);
      } else {
        ErpHaptics.medium();
        state = state.copyWith(
          status: AuthStatus.authenticated,
          busy: false,
          errorMessage: null,
        );
      }
      return true;
    } on RateLimitedException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
      return false;
    } on UnauthorizedSessionException catch (e) {
      ErpHaptics.error();
      state = state.copyWith(busy: false, errorMessage: e.message);
      return false;
    } catch (_) {
      state = state.copyWith(
        busy: false,
        errorMessage: 'PIN verification failed. Try again.',
      );
      return false;
    }
  }

  Future<bool> enrollBiometrics() async {
    try {
      final vault = ref.read(secureVaultProvider);
      final keyManager = ref.read(deviceKeyManagerProvider);
      final client = ref.read(apiClientProvider);
      final deviceId = await vault.getOrCreateDeviceId();

      final pem = await keyManager.generateAndStoreKeyPair();
      await client.post<Map<String, dynamic>>(
        '/api/auth/biometric/enroll',
        data: {
          'deviceId': deviceId,
          'deviceName': _deviceModelLabel(),
          'platform': _devicePlatformLabel(),
          'appVersion': '1.0.0',
          'publicKeyPem': pem,
          'keyAlgorithm': 'ED25519',
        },
      );

      state = state.copyWith(biometricEnrolled: true);
      return true;
    } catch (_) {
      return false;
    }
  }

  void lockIfEnrolled() {
    if (state.status != AuthStatus.authenticated) return;
    if (state.hasSecurityPin || state.biometricEnrolled) {
      state = state.copyWith(status: AuthStatus.locked, errorMessage: null);
    }
  }

  void handleSessionExpired() {
    state = AuthState(
      status: AuthStatus.unauthenticated,
      bootstrapped: true,
      accountName: state.accountName,
      username: state.username,
      biometricAvailable: state.biometricAvailable,
    );
  }

  Future<void> signOut() async {
    final vault = ref.read(secureVaultProvider);
    final refreshToken = await vault.readRefreshToken();
    try {
      await ref.read(apiClientProvider).post(
        '/api/auth/logout',
        data: {'refreshToken': ?refreshToken},
      );
    } catch (_) {
      // Best-effort remote revoke; local vault is always wiped cleanly
    }
    await vault.clearSession();
    state = AuthState(
      status: AuthStatus.unauthenticated,
      bootstrapped: true,
      biometricAvailable: state.biometricAvailable,
    );
  }

  Future<void> _applySessionPayload(Map<String, dynamic> body) async {
    final token = body['accessToken'] as String?;
    if (token == null || token.isEmpty) {
      state = state.copyWith(
        busy: false,
        errorMessage: body['message']?.toString() ?? 'Sign in failed.',
      );
      return;
    }

    final vault = ref.read(secureVaultProvider);
    final bioAvail = await ref.read(biometricGatewayProvider).isAvailable();
    final hasPin = body['hasSecurityPin'] == true;
    final user = (body['user'] as Map?) ?? const {};
    final accountName = user['accountName']?.toString();
    final username = user['username']?.toString();

    await vault.saveSessionTokens(
      accessToken: token,
      refreshToken: body['refreshToken']?.toString(),
      sessionId: body['sessionId']?.toString(),
    );
    await vault.saveHasSecurityPin(hasPin);
    await vault.saveUserHint(accountName: accountName, username: username);
    final bioEnrolled = await vault.isBiometricEnrolled();

    ErpHaptics.light();
    state = AuthState(
      status: AuthStatus.authenticated,
      displayName: user['fullName']?.toString() ?? state.displayName,
      email: user['email']?.toString() ?? state.email,
      accountName: accountName ?? state.accountName,
      username: username ?? state.username,
      hasSecurityPin: hasPin,
      biometricEnrolled: bioEnrolled,
      biometricAvailable: bioAvail,
      bootstrapped: true,
    );
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);
