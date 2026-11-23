import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/app/app.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';
import 'package:sundayfunday_mobile/features/bills_radar/radar_models.dart';
import 'package:sundayfunday_mobile/features/bills_radar/radar_provider.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_models.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_provider.dart';
import 'package:sundayfunday_mobile/features/marquee/marquee_models.dart';
import 'package:sundayfunday_mobile/features/marquee/marquee_provider.dart';
import 'package:sundayfunday_mobile/features/marquee/marquee_tab.dart';
import 'package:sundayfunday_mobile/features/submodules/submodules_models.dart';
import 'package:sundayfunday_mobile/features/submodules/submodules_provider.dart';

import '../helpers/in_memory_vault.dart';

class _StaticSubmodulesNotifier extends SubmodulesNotifier {
  _StaticSubmodulesNotifier(super.initial);

  @override
  Future<void> loadLedger({int? month, int? year}) async {}

  @override
  Future<void> loadSavings() async {}

  @override
  Future<void> loadWishlist() async {}
}

MobileBootPayload _bootFixture() => const MobileBootPayload(
      period: PeriodInfo(
        month: 11,
        year: 2026,
        status: 'DRAFT',
        strategy: 'EARLIEST_OPEN_ACTIVE',
        skippedLockedPeriod: true,
      ),
      pacing: PacingSnapshot(
        periodMonth: 11,
        periodYear: 2026,
        cycleDateLabel: '28 Oct - 26 Nov 2026',
        cycleTemporalState: 'ACTIVE',
        daysUntilCycleStart: 0,
        daysInCycle: 30,
        currentDayIndex: 27,
        daysRemaining: 4,
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
      allocationSummary: AllocationSummary(
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
        tiers: [],
      ),
      walletGuard: WalletGuardSummary(
        totalDueRp: 4522976,
        paidAmountRp: 1060900,
        unpaidAmountRp: 3462076,
        bankHoldNeededRp: 3462076,
      ),
      bills: [
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
      cashRadarSummary: CashRadarSummary(
        lowestCashPointRp: 125000,
        lowestCashDateIso: '2026-11-25',
        lowestCashLabel: 'SPayLater Due',
        isTightOrDeficit: false,
        endingCashBufferRp: 160000,
        eventCount: 2,
      ),
      maskBalancesByDefault: false,
      hasSecurityPin: false,
      biometricDevicesCount: 0,
    );

CashRadarDetail _radarFixture() => const CashRadarDetail(
      periodMonth: 11,
      periodYear: 2026,
      cycleStartIso: '2026-10-28',
      cycleEndIso: '2026-11-26',
      nextPaydayIso: '2026-11-27',
      paydayInflowsRp: 5891000,
      totalScheduledBillsRp: 4522976,
      endingCashBufferRp: 160000,
      lowestBalanceRp: 125000,
      lowestDateIso: '2026-11-25',
      lowestContextLabel: 'SPayLater Due',
      isTightOrDeficit: false,
      events: [
        RadarEvent(
          id: 'e1',
          dateIso: '2026-11-24',
          nominalDateIso: '2026-11-25',
          isBusinessDayShifted: true,
          label: 'SPinjam Maturity',
          category: 'CASH_LOAN',
          signedAmountRp: -450000,
          sliceLabel: '3 / 6',
          isFinalSlice: false,
          insideAllocatedPool: false,
        ),
      ],
      dailySeries: [
        RadarDayPoint(
          dateIso: '2026-11-23',
          dayOfMonth: 23,
          inActiveCycle: true,
          isToday: true,
          isWeekend: false,
          openingBalanceRp: 620000,
          inflowsRp: 0,
          outflowsRp: 45000,
          closingBalanceRp: 575000,
        ),
        RadarDayPoint(
          dateIso: '2026-11-25',
          dayOfMonth: 25,
          inActiveCycle: true,
          isToday: false,
          isWeekend: false,
          openingBalanceRp: 575000,
          inflowsRp: 0,
          outflowsRp: 450000,
          closingBalanceRp: 125000,
        ),
      ],
    );

MarqueeState _marqueeFixture() => const MarqueeState(
      isStreaming: false,
      proactiveReminders: [
        MarqueeProactiveReminder(
          id: 'r1',
          tone: 'caution',
          text: '4 days remaining in Nov 2026 cycle.',
          prompt: 'Summarize remaining living cash',
        ),
      ],
      messages: [
        MarqueeMessage(
          id: 'm1',
          isUser: false,
          summary: 'Ready to log **Coffee Rp 50.000** under Nov 2026.',
          cards: [
            MarqueeCardItem(label: 'Amount', value: 'Rp 50.000', tone: 'default'),
          ],
          agentSteps: [
            MarqueeAgentStep(
              id: 's1',
              label: 'Verified Nov 2026 cycle',
              detail: 'Checked cutoff day 25',
              status: 'done',
              durationMs: 14,
            ),
          ],
          pendingAction: MarqueePendingAction(
            type: 'CONFIRM_EXPENSE',
            title: 'Confirm Living Cash Entry',
            payload: {'label': 'Coffee', 'amount': 50000},
          ),
        ),
      ],
    );

void main() {
  for (final size in const [Size(360, 780), Size(430, 932)]) {
    testWidgets(
      'Radar, Marquee, and More submodules render cleanly without overflow on ${size.width.toInt()}x${size.height.toInt()}',
      (tester) async {
        await tester.binding.setSurfaceSize(size);
        addTearDown(() => tester.binding.setSurfaceSize(null));

        final vault = InMemorySecureVault(accessToken: 'jwt-valid');
        final boot = _bootFixture();
        final radar = _radarFixture();

        await tester.pumpWidget(
          ProviderScope(
            overrides: [
              secureVaultProvider.overrideWithValue(vault),
              authProvider.overrideWith(
                () => AuthNotifier(
                  const AuthState(
                    status: AuthStatus.authenticated,
                    displayName: 'Guest Sandbox',
                    email: 'guest@sundayfunday.app',
                  ),
                ),
              ),
              cockpitProvider.overrideWith(
                () => CockpitNotifier(CockpitState(boot: boot)),
              ),
              radarProvider.overrideWith(
                () => RadarNotifier(
                  RadarState(
                    detail: radar,
                    savedCheckin: const WalletGuardCheckinStatus(
                      actualWalletBalance: 4200000,
                      reservedBillsTotal: 3462076,
                      freeSpendableCash: 737924,
                      guardStatus: 'OPTIMAL',
                      checkedInAt: '2026-11-23T12:00:00Z',
                      note: 'BCA',
                    ),
                  ),
                ),
              ),
              marqueeProvider.overrideWith(
                () => MarqueeNotifier(_marqueeFixture()),
              ),
              submodulesProvider.overrideWith(
                () => _StaticSubmodulesNotifier(
                  const SubmodulesState(
                    transactions: [
                      LedgerTransactionItem(
                        id: 10,
                        dateIso: '2026-11-23T08:00:00Z',
                        label: 'Morning Coffee',
                        amountRp: 35000,
                        type: 'DEDUCTION',
                        sourceType: 'MANUAL',
                        paymentMethod: 'CASH',
                      ),
                    ],
                    savingsOverview: SavingsOverviewModel(
                      totalBalanceRp: 14250000,
                      liquidCashRp: 6250000,
                      investmentRdpuRp: 8000000,
                      liquidSharePercent: 43.9,
                      rdpuSharePercent: 56.1,
                      avgMonthlySavingsRp: 1180000,
                      avgSavingsRatePercent: 18.5,
                      goals: [
                        SavingsGoalModel(
                          id: 1,
                          name: 'Emergency Cushion 6M',
                          targetAmountRp: 25000000,
                          allocatedAmountRp: 14250000,
                          progressPercent: 57.0,
                          remainingNeededRp: 10750000,
                          isCompleted: false,
                        ),
                      ],
                    ),
                    wishlistItems: [
                      WishlistItemModel(
                        id: 3,
                        name: 'Desk Monitor Arm',
                        priceRp: 850000,
                        fundingType: 'CASH',
                        status: 'PLANNING',
                        priority: 1,
                      ),
                    ],
                  ),
                ),
              ),
            ],
            child: const SundayFundayApp(),
          ),
        );
        await tester.pumpAndSettle();

        // Navigate to Bills & Radar tab (Quick Log FAB stays visible)
        await tester.tap(find.text('Bills & Radar'));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('quick_log_fab')), findsOneWidget);
        expect(find.byKey(const Key('radar_sparkline_canvas')), findsOneWidget);
        expect(find.text('H-1'), findsOneWidget);
        expect(find.text('SPinjam Maturity'), findsOneWidget);
        expect(find.text('OPTIMAL'), findsOneWidget);
        expect(tester.takeException(), isNull);

        // Navigate to Marquee AI tab (Quick Log FAB hides so Send button is unobstructed, and **bold** strips asterisks)
        await tester.tap(find.text('Marquee AI'));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('quick_log_fab')), findsNothing);
        expect(find.byType(MarqueeTab), findsOneWidget);
        expect(find.text('Confirm Living Cash Entry'), findsOneWidget);
        expect(find.textContaining('**', findRichText: true), findsNothing);
        expect(find.textContaining('Coffee Rp 50.000', findRichText: true), findsAtLeastNWidgets(1));
        expect(tester.takeException(), isNull);

        // Navigate to More tab and verify submodule push routes
        await tester.tap(find.text('More'));
        await tester.pumpAndSettle();

        expect(find.byKey(const Key('quick_log_fab')), findsNothing);

        expect(find.text('Cycle Ledger'), findsOneWidget);
        expect(find.text('Savings & Emergency Fund'), findsOneWidget);
        expect(find.text('Wishlist Check'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.tap(find.text('Cycle Ledger'));
        await tester.pumpAndSettle();
        expect(find.text('Morning Coffee'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pageBack();
        await tester.pumpAndSettle();

        await tester.tap(find.text('Savings & Emergency Fund'));
        await tester.pumpAndSettle();
        expect(find.text('Emergency Cushion 6M'), findsOneWidget);
        expect(tester.takeException(), isNull);

        await tester.pageBack();
        await tester.pumpAndSettle();

        await tester.tap(find.text('Wishlist Check'));
        await tester.pumpAndSettle();
        expect(find.text('Desk Monitor Arm'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
