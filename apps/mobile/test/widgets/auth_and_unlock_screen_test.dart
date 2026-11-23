import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/app/app.dart';
import 'package:sundayfunday_mobile/core/security/biometric_auth_service.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';

import '../helpers/in_memory_vault.dart';

class _FakeBiometricGateway implements BiometricGateway {
  int promptCount = 0;

  @override
  Future<bool> authenticate(String reason) async {
    promptCount++;
    return true;
  }

  @override
  Future<bool> isAvailable() async => true;
}

void main() {
  for (final size in [const Size(360, 780), const Size(430, 932)]) {
    testWidgets('LoginScreen renders trilingual switches and demo option without overflow at ${size.width.toInt()}x${size.height.toInt()}', (tester) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final vault = InMemorySecureVault();
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            secureVaultProvider.overrideWithValue(vault),
            biometricGatewayProvider.overrideWithValue(_FakeBiometricGateway()),
          ],
          child: const SundayFundayApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sunday Funday'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);

      // Switch to Indonesian inline before login
      await tester.tap(find.text('ID'));
      await tester.pumpAndSettle();
      expect(find.text('Masuk'), findsOneWidget);

      // Switch to Simplified Chinese
      await tester.tap(find.text('ZH'));
      await tester.pumpAndSettle();
      expect(find.text('登录'), findsOneWidget);

      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('locked startup with enrolled session opens UnlockScreen with 6-digit PIN keypad & biometric trigger', (tester) async {
    final vault = InMemorySecureVault(
      accessToken: 'existing-jwt',
      refreshToken: 'sf_rt_existing',
      sessionId: 'sid-existing',
      deviceId: 'iphone-15',
    )
      ..biometricEnrolled = true
      ..hasSecurityPin = true
      ..lastAccountName = 'cheeseburger'
      ..lastUsername = 'cheeseburger';

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureVaultProvider.overrideWithValue(vault),
          biometricGatewayProvider.overrideWithValue(_FakeBiometricGateway()),
          authProvider.overrideWith(
            () => AuthNotifier(
              const AuthState(
                status: AuthStatus.locked,
                displayName: 'Gabriel',
                email: 'gabandreas22@gmail.com',
                hasSecurityPin: true,
                biometricEnrolled: true,
              ),
            ),
          ),
        ],
        child: const SundayFundayApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Gabriel'), findsOneWidget);
    expect(find.text('Use Biometrics'), findsOneWidget);
    expect(find.text('1'), findsOneWidget);
    expect(find.text('9'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
