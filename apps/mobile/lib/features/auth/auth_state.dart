import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/app_strings.dart';
import '../../core/network/api_client.dart';
import '../../core/storage/secure_vault.dart';

enum AuthStatus { unauthenticated, authenticated }

class AuthState {
  final AuthStatus status;
  final String? displayName;
  final String? email;
  final bool busy;
  final String? errorMessage;

  const AuthState({
    this.status = AuthStatus.unauthenticated,
    this.displayName,
    this.email,
    this.busy = false,
    this.errorMessage,
  });

  AuthState copyWith({
    AuthStatus? status,
    String? displayName,
    String? email,
    bool? busy,
    String? errorMessage,
  }) {
    return AuthState(
      status: status ?? this.status,
      displayName: displayName ?? this.displayName,
      email: email ?? this.email,
      busy: busy ?? this.busy,
      errorMessage: errorMessage,
    );
  }
}

final secureVaultProvider = Provider<SecureVault>((ref) => FlutterSecureVault());

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(vault: ref.watch(secureVaultProvider));
});

class LanguageNotifier extends Notifier<AppLanguage> {
  @override
  AppLanguage build() => AppLanguage.en;

  void setLanguage(AppLanguage lang) => state = lang;
}

final languageProvider = NotifierProvider<LanguageNotifier, AppLanguage>(
  LanguageNotifier.new,
);

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  Future<void> signIn({
    required String accountName,
    required String username,
    required String password,
  }) async {
    state = state.copyWith(busy: true, errorMessage: null);
    try {
      final client = ref.read(apiClientProvider);
      final vault = ref.read(secureVaultProvider);
      final response = await client.post<Map<String, dynamic>>(
        '/api/auth/login',
        data: {
          if (accountName.trim().isNotEmpty) 'accountName': accountName.trim(),
          'username': username.trim(),
          'password': password,
        },
      );

      final body = response.data ?? const {};
      final token = body['accessToken'] as String?;
      if (token == null || token.isEmpty) {
        state = state.copyWith(
          busy: false,
          errorMessage: body['message']?.toString() ?? 'Sign in failed.',
        );
        return;
      }

      await vault.saveSessionTokens(accessToken: token);
      final user = (body['user'] as Map?) ?? const {};
      state = AuthState(
        status: AuthStatus.authenticated,
        displayName: user['fullName']?.toString(),
        email: user['email']?.toString(),
      );
    } on RateLimitedException catch (e) {
      state = state.copyWith(busy: false, errorMessage: e.message);
    } on UnauthorizedSessionException catch (e) {
      state = state.copyWith(busy: false, errorMessage: e.message);
    } catch (_) {
      state = state.copyWith(
        busy: false,
        errorMessage: 'Unable to reach API server. Check connection.',
      );
    }
  }

  Future<void> signOut() async {
    await ref.read(secureVaultProvider).clearSession();
    state = const AuthState();
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(
  AuthNotifier.new,
);
