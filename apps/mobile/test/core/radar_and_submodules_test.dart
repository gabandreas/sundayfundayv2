import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/network/api_client.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';
import 'package:sundayfunday_mobile/features/bills_radar/radar_provider.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_models.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_provider.dart';
import 'package:sundayfunday_mobile/features/submodules/submodules_provider.dart';

import '../helpers/in_memory_vault.dart';

class _MockRadarSubmodulesAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  String lastSettlementState = 'UNPAID';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);

    if (options.path == '/api/finance/mobile-boot') {
      return ResponseBody.fromString(
        jsonEncode({
          'period': {
            'month': 11,
            'year': 2026,
            'status': 'DRAFT',
            'strategy': 'EARLIEST_OPEN_ACTIVE',
            'skippedLockedPeriod': true,
          },
          'pacing': {
            'periodMonth': 11,
            'periodYear': 2026,
            'cycleDateLabel': '28 Oct - 26 Nov 2026',
            'cycleTemporalState': 'ACTIVE',
            'daysUntilCycleStart': 0,
            'daysInCycle': 30,
            'currentDayIndex': 27,
            'daysRemaining': 4,
            'totalOperationalBudget': 1720316,
            'totalDailySpent': 1560316,
            'remainingBudget': 160000,
            'safeToSpendToday': 43636,
            'paceDeltaRp': 0,
            'pacingStatus': 'ON_TRACK',
            'isWeekendToday': false,
            'weekendMultiplier': 1.5,
            'weekdaySafeRate': 43636,
            'weekendSafeRate': 65454,
          },
          'allocationSummary': {
            'finalTotalIncome': 5891000,
            'totalDeductions': 4522976,
            'routineBillsTotal': 400000,
            'dailyLivingTarget': 1720316,
            'dailyLivingFunded': 1720316,
            'coreSavingsTarget': 1000000,
            'coreSavingsActual': 6341,
            'flexibleSurplusTarget': 1000000,
            'flexibleSurplusActual': 250000,
            'deficitUncovered': 108633,
            'tiers': [],
          },
          'walletGuard': {
            'settlementSummary': {
              'totalDue': 4522976,
              'paidAmount': 1060900,
              'reservedAmount': lastSettlementState == 'RESERVED' ? 52000 : 0,
              'unpaidAmount': lastSettlementState == 'RESERVED' ? 3410076 : 3462076,
              'bankHoldNeeded': lastSettlementState == 'RESERVED' ? 3410076 : 3462076,
            },
          },
          'bills': {
            'items': [
              {
                'id': 1,
                'title': 'SPayLater Coffee',
                'category': 'PAYLATER',
                'amount': 52000,
                'dueDay': 25,
                'isSettled': lastSettlementState == 'PAID',
                'settlementState': lastSettlementState,
              },
            ],
          },
          'cashRadarSummary': {
            'lowestCashPointRp': 125000,
            'lowestCashDateIso': '2026-11-25',
            'lowestCashLabel': 'SPayLater Due',
            'isTightOrDeficit': false,
            'endingCashBufferRp': 160000,
            'eventCount': 2,
          },
          'displayPreferences': {'maskBalancesByDefault': false},
          'mobileCapabilities': {'hasSecurityPin': false, 'biometricDevicesCount': 0},
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/finance/cash-radar') {
      return ResponseBody.fromString(
        jsonEncode({
          'periodMonth': 11,
          'periodYear': 2026,
          'cycleStartIso': '2026-10-28',
          'cycleEndIso': '2026-11-26',
          'nextPaydayIso': '2026-11-27',
          'paydayInflowsRp': 5891000,
          'totalScheduledBillsRp': 4522976,
          'endingCashBufferRp': 160000,
          'lowestCashPoint': {
            'dateIso': '2026-11-25',
            'balanceRp': 125000,
            'contextLabel': 'SPayLater + SPinjam',
            'isTightOrDeficit': false,
          },
          'events': [
            {
              'id': 'evt-1',
              'dateIso': '2026-11-24',
              'nominalDateIso': '2026-11-25',
              'isBusinessDayShifted': true,
              'label': 'SPinjam Maturity',
              'category': 'CASH_LOAN',
              'signedAmountRp': -450000,
              'sliceLabel': '3 / 6',
              'isFinalSlice': false,
              'insideAllocatedPool': false,
            },
            {
              'id': 'evt-2',
              'dateIso': '2026-11-27',
              'nominalDateIso': '2026-11-27',
              'isBusinessDayShifted': false,
              'label': 'Payroll Credit',
              'category': 'INCOME',
              'signedAmountRp': 5891000,
              'insideAllocatedPool': false,
            },
          ],
          'dailySeries': [
            {
              'dateIso': '2026-11-23',
              'dayOfMonth': 23,
              'inActiveCycle': true,
              'isToday': true,
              'isWeekend': false,
              'openingBalanceRp': 620000,
              'inflowsRp': 0,
              'outflowsRp': 45000,
              'closingBalanceRp': 575000,
            },
            {
              'dateIso': '2026-11-25',
              'dayOfMonth': 25,
              'inActiveCycle': true,
              'isToday': false,
              'isWeekend': false,
              'openingBalanceRp': 575000,
              'inflowsRp': 0,
              'outflowsRp': 450000,
              'closingBalanceRp': 125000,
            },
            {
              'dateIso': '2026-11-26',
              'dayOfMonth': 26,
              'inActiveCycle': true,
              'isToday': false,
              'isWeekend': false,
              'openingBalanceRp': 125000,
              'inflowsRp': 35000,
              'outflowsRp': 0,
              'closingBalanceRp': 160000,
            },
          ],
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/finance/wallet-guard') {
      return ResponseBody.fromString(
        jsonEncode({
          'savedCheckin': {
            'actualWalletBalance': 4200000,
            'reservedBillsTotal': 3462076,
            'freeSpendableCash': 737924,
            'guardStatus': 'OPTIMAL',
            'checkedInAt': '2026-11-23T12:00:00.000Z',
            'note': 'BCA Check',
          },
          'guard': {
            'reservedBillsTotal': 3462076,
            'freeSpendableCash': 737924,
            'guardStatus': 'OPTIMAL',
          },
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/credit/line-items/1/settlement-state') {
      final body = options.data as Map<String, dynamic>;
      lastSettlementState = body['settlementState'] as String? ?? 'UNPAID';
      return ResponseBody.fromString(
        jsonEncode({'id': 1, 'settlementState': lastSettlementState}),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/finance/transactions') {
      return ResponseBody.fromString(
        jsonEncode([
          {
            'id': 10,
            'date': '2026-11-23T08:00:00.000Z',
            'label': 'Morning Coffee',
            'amount': 35000,
            'type': 'DEDUCTION',
            'sourceType': 'MANUAL',
            'paymentMethod': 'CASH',
          },
        ]),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/savings/overview') {
      return ResponseBody.fromString(
        jsonEncode({
          'kpi': {
            'totalVaultBalance': 14250000,
            'liquidCashBalance': 6250000,
            'investmentRdpuBalance': 8000000,
            'liquidSharePercent': 43.9,
            'rdpuSharePercent': 56.1,
            'avgMonthlySavingsP1': 1180000,
            'averageMonthlySavingsRatePercent': 18.5,
          },
          'goals': [
            {
              'id': 1,
              'name': 'Emergency Cushion 6M',
              'targetAmount': 25000000,
              'currentAllocatedAmount': 14250000,
              'progressPercent': 57.0,
              'remainingNeeded': 10750000,
              'isCompleted': false,
            },
          ],
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/wishlist') {
      return ResponseBody.fromString(
        jsonEncode([
          {
            'id': 3,
            'name': 'Desk Monitor Arm',
            'price': 850000,
            'fundingType': 'CASH',
            'status': 'PLANNING',
            'priority': 1,
          },
        ]),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/wishlist/analyze-draft') {
      return ResponseBody.fromString(
        jsonEncode({
          'cashStrategy': {
            'tier': 'SAVING_REQUIRED',
            'currentSelfReward': 250000,
            'shortfall': 600000,
            'estimatedMonthsToSave': 2,
            'monthlySavingsRate': 300000,
          },
          'installmentStrategy': {
            'tier': 'MANAGEABLE',
            'peakDebtRatio': 31.4,
            'newMonthlyInstallment': 283333,
            'projectedMonths': [],
          },
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    return ResponseBody.fromString(jsonEncode({}), 200);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('RadarNotifier & CashRadarDetail', () {
    test('loads radar trajectory, saves wallet guard check-in & toggles 3-state bill settlement', () async {
      final adapter = _MockRadarSubmodulesAdapter();
      final vault = InMemorySecureVault(accessToken: 'jwt-valid');
      final api = ApiClient(vault: vault, adapter: adapter, devicePlatform: 'ANDROID');

      final container = ProviderContainer(
        overrides: [
          secureVaultProvider.overrideWithValue(vault),
          apiClientProvider.overrideWithValue(api),
        ],
      );
      addTearDown(container.dispose);

      await container.read(cockpitProvider.notifier).loadBoot(month: 11, year: 2026);
      await container.read(radarProvider.notifier).loadRadar(month: 11, year: 2026);

      final radarState = container.read(radarProvider);
      expect(radarState.detail, isNotNull);
      expect(radarState.detail!.lowestBalanceRp, 125000);
      expect(radarState.detail!.dailySeries.length, 3);
      expect(radarState.detail!.events.first.isBusinessDayShifted, isTrue);

      await container.read(radarProvider.notifier).submitWalletCheckin(
            actualWalletBalance: 4200000,
            note: 'BCA Check',
          );
      final guardReq = adapter.requests.firstWhere(
        (r) => r.path == '/api/finance/wallet-guard' && r.method == 'POST',
      );
      expect(guardReq.headers['Idempotency-Key'], isNotNull);
      expect(container.read(radarProvider).savedCheckin?.guardStatus, 'OPTIMAL');

      const bill = BillLineItem(
        id: 1,
        title: 'SPayLater Coffee',
        category: 'PAYLATER',
        amount: 52000,
        dueDay: 25,
        isSettled: false,
        settlementState: 'UNPAID',
      );
      await container.read(radarProvider.notifier).setBillSettlementState(bill, 'RESERVED');
      final patchReq = adapter.requests.firstWhere(
        (r) => r.path == '/api/credit/line-items/1/settlement-state',
      );
      expect(patchReq.headers['Idempotency-Key'], isNotNull);
      expect((patchReq.data as Map)['settlementState'], 'RESERVED');
      expect(container.read(cockpitProvider).boot!.bills.first.settlementState, 'RESERVED');
    });
  });

  group('Submodules provider (Ledger, Savings, Wishlist)', () {
    test('loads ledger transactions, savings goals, and simulates wishlist affordability', () async {
      final adapter = _MockRadarSubmodulesAdapter();
      final vault = InMemorySecureVault(accessToken: 'jwt-valid');
      final api = ApiClient(vault: vault, adapter: adapter, devicePlatform: 'ANDROID');

      final container = ProviderContainer(
        overrides: [
          secureVaultProvider.overrideWithValue(vault),
          apiClientProvider.overrideWithValue(api),
        ],
      );
      addTearDown(container.dispose);

      await container.read(cockpitProvider.notifier).loadBoot(month: 11, year: 2026);
      final sub = container.read(submodulesProvider.notifier);

      await sub.loadLedger(month: 11, year: 2026);
      expect(container.read(submodulesProvider).transactions.single.label, 'Morning Coffee');

      await sub.loadSavings();
      final savings = container.read(submodulesProvider).savingsOverview!;
      expect(savings.totalBalanceRp, 14250000);
      expect(savings.goals.single.name, 'Emergency Cushion 6M');

      await sub.loadWishlist();
      expect(container.read(submodulesProvider).wishlistItems.single.name, 'Desk Monitor Arm');

      await sub.analyzeWishlistDraft(
        price: 850000,
        fundingType: 'INSTALLMENT',
        tenor: 3,
      );
      final sim = container.read(submodulesProvider).wishlistAnalysis!;
      expect(sim.cashStrategyTier, 'SAVING_REQUIRED');
      expect(sim.installmentRiskTier, 'MANAGEABLE');
      expect(sim.peakDebtRatioPercent, 31.4);
    });
  });
}
