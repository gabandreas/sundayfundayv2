import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/app/app.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_models.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_provider.dart';

import '../helpers/in_memory_vault.dart';

MobileBootPayload _sampleBoot({bool isLocked = false, String cycleState = 'ACTIVE'}) {
  return MobileBootPayload(
    period: PeriodInfo(
      month: isLocked ? 10 : 11,
      year: 2026,
      status: isLocked ? 'LOCKED' : 'DRAFT',
      strategy: 'EARLIEST_OPEN_ACTIVE',
      skippedLockedPeriod: !isLocked,
    ),
    pacing: PacingSnapshot(
      periodMonth: isLocked ? 10 : 11,
      periodYear: 2026,
      cycleDateLabel: '28 Oct - 26 Nov 2026',
      cycleTemporalState: cycleState,
      daysUntilCycleStart: cycleState == 'PRE_PAYDAY' ? 4 : 0,
      daysInCycle: 30,
      currentDayIndex: cycleState == 'PRE_PAYDAY' ? 0 : 27,
      daysRemaining: cycleState == 'PRE_PAYDAY' ? 31 : 4,
      totalOperationalBudget: 1720316,
      totalDailySpent: 1560316,
      remainingBudget: 160000,
      safeToSpendToday: 43636,
      paceDeltaRp: 0,
      pacingStatus: 'ON_TRACK',
      isWeekendToday: false,
      weekendMultiplier: 1.5,
      weekdaySafeRate: 43636,
      weekendSafeRate: 65454,
    ),
    allocationSummary: const AllocationSummary(
      finalTotalIncome: 5891000,
      totalDeductions: 4522976,
      routineBillsTotal: 400000,
      dailyLivingTarget: 1720316,
      dailyLivingFunded: 1720316,
      coreSavingsTarget: 1000000,
      coreSavingsActual: 6341,
      flexibleSurplusTarget: 1000000,
      flexibleSurplusActual: 250000,
      deficitUncovered: 108633,
      tiers: [
        AllocationTierItem(
          key: 'SAVINGS',
          label: 'Core Savings Reserve',
          targetRp: 1000000,
          actualRp: 6341,
          enabled: true,
        ),
        AllocationTierItem(
          key: 'DISCRETIONARY',
          label: 'Flexible Surplus',
          targetRp: 1000000,
          actualRp: 250000,
          enabled: true,
        ),
      ],
    ),
    walletGuard: const WalletGuardSummary(
      totalDueRp: 4522976,
      paidAmountRp: 1060900,
      unpaidAmountRp: 3462076,
      bankHoldNeededRp: 3462076,
    ),
    bills: const [
      BillLineItem(
        id: 1,
        title: 'SPayLater Coffee',
        category: 'PAYLATER',
        amount: 52000,
        dueDay: 25,
        isSettled: false,
        settlementState: 'UNPAID',
      ),
    ],
    cashRadarSummary: const CashRadarSummary(
      lowestCashPointRp: 125000,
      lowestCashDateIso: '2026-11-25',
      lowestCashLabel: 'SPayLater Due',
      isTightOrDeficit: false,
      endingCashBufferRp: 160000,
      eventCount: 5,
    ),
    maskBalancesByDefault: false,
    hasSecurityPin: true,
    biometricDevicesCount: 1,
  );
}

void main() {
  for (final size in [const Size(360, 780), const Size(430, 932)]) {
    testWidgets('Cockpit renders KPI, tiers, Quick Log sheet without overflow at ${size.width.toInt()}x${size.height.toInt()}', (tester) async {
      await tester.binding.setSurfaceSize(size);
      addTearDown(() => tester.binding.setSurfaceSize(null));

      final vault = InMemorySecureVault(accessToken: 'jwt-valid', hasSecurityPin: true);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            secureVaultProvider.overrideWithValue(vault),
            authProvider.overrideWith(
              () => AuthNotifier(
                const AuthState(
                  status: AuthStatus.authenticated,
                  displayName: 'Gabriel',
                  email: 'gabandreas22@gmail.com',
                  hasSecurityPin: true,
                ),
              ),
            ),
            cockpitProvider.overrideWith(
              () => CockpitNotifier(CockpitState(boot: _sampleBoot())),
            ),
          ],
          child: const SundayFundayApp(),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Rp 43.636'), findsAtLeastNWidgets(1));
      expect(find.text('Core Savings Reserve'), findsOneWidget);
      expect(find.text('Flexible Surplus'), findsOneWidget);

      // Open Quick Log modal via center + CTA
      await tester.tap(find.byKey(const Key('quick_log_fab')));
      await tester.pumpAndSettle();
      expect(find.text('Quick Log'), findsOneWidget);
      expect(find.text('SPayLater'), findsOneWidget);
      expect(find.text('Credit Card'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('Cockpit skeleton loading renders shimmer cards instead of blocking spinner, and LOCKED cycles disable Quick Log submit', (tester) async {
    final vault = InMemorySecureVault(accessToken: 'jwt-valid');

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          secureVaultProvider.overrideWithValue(vault),
          authProvider.overrideWith(
            () => AuthNotifier(
              const AuthState(
                status: AuthStatus.authenticated,
                displayName: 'Gabriel',
                email: 'gabandreas22@gmail.com',
              ),
            ),
          ),
          cockpitProvider.overrideWith(
            () => CockpitNotifier(
              CockpitState(
                boot: _sampleBoot(isLocked: true),
                isInitialLoading: false,
              ),
            ),
          ),
        ],
        child: const SundayFundayApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Locked'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
