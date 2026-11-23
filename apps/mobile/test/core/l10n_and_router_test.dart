import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/app/app.dart';
import 'package:sundayfunday_mobile/core/l10n/app_strings.dart';

void main() {
  group('AppStrings trilingual parity & anti-slop guard', () {
    test('provides EN, ID, ZH labels using canonical banking terminology', () {
      for (final lang in AppLanguage.values) {
        final strings = AppStrings.forLanguage(lang);
        expect(strings.appName, 'Sunday Funday');
        expect(strings.safeToSpendLabel.isNotEmpty, isTrue);
        expect(strings.signInAction.isNotEmpty, isTrue);

        for (final value in strings.allValues) {
          expect(value.contains('Vault'), isFalse);
          expect(value.contains('Reservoir'), isFalse);
          expect(value.contains('Forward-Borrow'), isFalse);
        }
      }

      expect(
        AppStrings.forLanguage(AppLanguage.en).savingsSectionTitle,
        'Savings & Emergency Fund',
      );
      expect(
        AppStrings.forLanguage(AppLanguage.id).savingsSectionTitle,
        'Tabungan & Dana Darurat',
      );
      expect(
        AppStrings.forLanguage(AppLanguage.zh).savingsSectionTitle,
        '储蓄与应急基金',
      );
    });
  });

  group('Root App & Auth Gate smoke test', () {
    testWidgets('unauthenticated startup lands on clean login gate', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: SundayFundayApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Sunday Funday'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
    });
  });
}
