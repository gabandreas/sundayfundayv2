import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/network/api_client.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_models.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_provider.dart';

import '../helpers/in_memory_vault.dart';

class _MockBootAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  bool returnOfflineError = false;
  int txPostCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    if (returnOfflineError) {
      throw DioException(
        requestOptions: options,
        type: DioExceptionType.connectionError,
        error: 'Network unreachable',
      );
    }

    if (options.path == '/api/finance/mobile-boot') {
      final reqMonth = int.tryParse(options.queryParameters['month']?.toString() ?? '') ?? 11;
      final reqYear = int.tryParse(options.queryParameters['year']?.toString() ?? '') ?? 2026;
      return ResponseBody.fromString(
        jsonEncode({
          'period': {
            'month': reqMonth,
            'year': reqYear,
            'status': reqMonth == 10 ? 'LOCKED' : 'DRAFT',
            'strategy': 'EARLIEST_OPEN_ACTIVE',
            'skippedLockedPeriod': reqMonth == 11,
          },
          'pacing': {
            'periodMonth': reqMonth,
            'periodYear': reqYear,
            'cycleDateLabel': '28 Oct - 26 Nov 2026',
            'cycleTemporalState': reqMonth == 12 ? 'PRE_PAYDAY' : 'ACTIVE',
            'daysUntilCycleStart': reqMonth == 12 ? 4 : 0,
            'daysInCycle': 30,
            'currentDayIndex': reqMonth == 12 ? 0 : 27,
            'daysRemaining': reqMonth == 12 ? 31 : 4,
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
            'tiers': [
              {'key': 'SAVINGS', 'label': 'Core Savings Reserve', 'targetRp': 1000000, 'actualRp': 6341, 'enabled': true},
              {'key': 'DISCRETIONARY', 'label': 'Flexible Surplus', 'targetRp': 1000000, 'actualRp': 250000, 'enabled': true},
            ],
          },
          'walletGuard': {
            'settlementSummary': {
              'totalDue': 4522976,
              'paidAmount': 1060900,
              'reservedAmount': 0,
              'unpaidAmount': 3462076,
              'bankHoldNeeded': 3462076,
            },
            'savedCheckin': null,
          },
          'bills': {
            'totalCount': 2,
            'unpaidCount': 1,
            'settledCount': 1,
            'items': [
              {'id': 1, 'title': 'SPayLater Coffee', 'category': 'PAYLATER', 'amount': 52000, 'dueDay': 25, 'isSettled': false, 'settlementState': 'UNPAID'},
              {'id': 2, 'title': 'Permata Card', 'category': 'CREDIT_CARD', 'amount': 1060900, 'dueDay': 11, 'isSettled': true, 'settlementState': 'PAID'},
            ],
          },
          'cashRadarSummary': {
            'lowestCashPointRp': 125000,
            'lowestCashDateIso': '2026-11-25',
            'lowestCashLabel': 'SPayLater Due',
            'isTightOrDeficit': false,
            'endingCashBufferRp': 160000,
            'eventCount': 5,
            'upcomingEvents': [],
          },
          'displayPreferences': {
            'defaultLanguage': 'en',
            'numberFormat': 'id-ID',
            'maskBalancesByDefault': false,
            'weekendWeightMultiplier': 1.5,
          },
          'mobileCapabilities': {
            'hasSecurityPin': true,
            'biometricDevicesCount': 1,
          },
        }),
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    }

    if (options.path == '/api/finance/cutoff-simulate') {
      return ResponseBody.fromString(
        jsonEncode({
          'startPeriodMonth': 12,
          'startPeriodYear': 2026,
          'startPeriodLabel': '12/2026',
          'firstDueDateIso': '2026-12-25',
          'cutoffDay': 15,
          'verdict': 'SAFE',
          'advice': 'Fits cleanly within your 12/2026 paycycle limit.',
          'routingSummary': 'Lands in 12/2026 (Due 25 Dec)',
          'dsrAfterPercent': 24.5,
        }),
        200,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    }

    if (options.path == '/api/finance/transactions') {
      txPostCount++;
      return ResponseBody.fromString(
        jsonEncode({'id': 888, 'amount': 52000}),
        201,
        headers: {Headers.contentTypeHeader: ['application/json']},
      );
    }

    return ResponseBody.fromString('{}', 200);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  test('CockpitNotifier loads mobile-boot verbatim, preserves cached state when offline, and toggles privacy mask', () async {
    final vault = InMemorySecureVault(accessToken: 'jwt-valid');
    final adapter = _MockBootAdapter();
    final client = ApiClient(vault: vault, adapter: adapter);

    final container = ProviderContainer(
      overrides: [
        secureVaultProvider.overrideWithValue(vault),
        apiClientProvider.overrideWithValue(client),
      ],
    );
    addTearDown(container.dispose);

    await container.read(cockpitProvider.notifier).loadBoot();
    final state = container.read(cockpitProvider);

    expect(state.boot, isNotNull);
    expect(state.boot!.period.month, 11);
    expect(state.boot!.period.isLocked, isFalse);
    expect(state.boot!.pacing.safeToSpendToday, 43636);
    expect(state.boot!.allocationSummary.tiers.first.label, 'Core Savings Reserve');
    expect(state.boot!.cashRadarSummary.lowestCashPointRp, 125000);
    expect(state.offlineMessage, isNull);

    // Offline period switch retains last synced boot cleanly without wiping numbers
    adapter.returnOfflineError = true;
    await container.read(cockpitProvider.notifier).switchPeriod(1);
    final offlineState = container.read(cockpitProvider);
    expect(offlineState.boot, isNotNull);
    expect(offlineState.offlineMessage, isNotNull);

    // Privacy toggle flips mask state
    expect(offlineState.privacyMask, isFalse);
    await container.read(cockpitProvider.notifier).togglePrivacyMask();
    expect(container.read(cockpitProvider).privacyMask, isTrue);
  });

  test('QuickLog idempotency key stays identical across retries of same draft and logs expense cleanly', () async {
    final vault = InMemorySecureVault(accessToken: 'jwt-valid');
    final adapter = _MockBootAdapter();
    final client = ApiClient(vault: vault, adapter: adapter);

    final container = ProviderContainer(
      overrides: [
        secureVaultProvider.overrideWithValue(vault),
        apiClientProvider.overrideWithValue(client),
      ],
    );
    addTearDown(container.dispose);

    await container.read(cockpitProvider.notifier).loadBoot();
    final preview = await container.read(cockpitProvider.notifier).simulateCutoff(
          instrument: 'SPAYLATER',
          amountRp: 120000,
          tenorMonths: 1,
          purchaseDateIso: '2026-11-23',
        );
    expect(preview, isA<CutoffPreviewResult>());
    expect(preview?.startPeriodLabel, '12/2026');
    expect(preview?.verdict, 'SAFE');

    final ok = await container.read(cockpitProvider.notifier).submitQuickTransaction(
          label: 'Americano & Pastry',
          amountRp: 52000,
          paymentMethod: 'PAYLATER',
          tenorMonths: 1,
          holdPastCutoff: false,
          idempotencyKey: 'mob-tx-fixed-key-1',
        );
    expect(ok, isTrue);
    final txReq = adapter.requests.lastWhere((r) => r.path == '/api/finance/transactions');
    expect(txReq.headers['Idempotency-Key'], 'mob-tx-fixed-key-1');
  });
}
