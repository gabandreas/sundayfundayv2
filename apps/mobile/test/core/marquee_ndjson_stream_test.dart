import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sundayfunday_mobile/core/l10n/app_strings.dart';
import 'package:sundayfunday_mobile/core/network/api_client.dart';
import 'package:sundayfunday_mobile/core/network/ndjson_stream_client.dart';
import 'package:sundayfunday_mobile/features/auth/auth_state.dart';
import 'package:sundayfunday_mobile/features/cockpit/cockpit_provider.dart';
import 'package:sundayfunday_mobile/features/marquee/marquee_provider.dart';

import '../helpers/in_memory_vault.dart';

class _MockMarqueeAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = [];
  int bootFetchCount = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);

    if (options.path == '/api/finance/mobile-boot') {
      bootFetchCount++;
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
              'reservedAmount': 0,
              'unpaidAmount': 3462076,
              'bankHoldNeeded': 3462076,
            },
          },
          'bills': {'items': []},
          'cashRadarSummary': {
            'lowestCashPointRp': 125000,
            'lowestCashDateIso': '2026-11-25',
            'isTightOrDeficit': false,
            'endingCashBufferRp': 160000,
            'eventCount': 4,
          },
          'displayPreferences': {'maskBalancesByDefault': false},
          'mobileCapabilities': {'hasSecurityPin': false, 'biometricDevicesCount': 0},
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/marquee/chat/stream') {
      final line1 = '${jsonEncode({
            'type': 'status',
            'phase': 'THINKING',
            'label': 'Reading intent',
            'detail': 'Checking Nov 2026 cycle',
            'timestamp': '2026-11-23T12:00:00.000Z',
          })}\n';
      final line2 = '${jsonEncode({
            'type': 'status',
            'phase': 'STAGING',
            'label': 'Staging entry',
            'detail': 'Preparing Living Cash entry Rp 50.000',
            'timestamp': '2026-11-23T12:00:01.000Z',
          })}\n';
      final finalLine = '${jsonEncode({
            'type': 'final',
            'data': {
              'ok': true,
              'tool': 'prepare_quick_transaction',
              'summary': 'Ready to log Coffee Rp 50.000 under Nov 2026.',
              'tierUsed': 'TIER1_NLU',
              'model': 'deterministic-nlu',
              'locale': 'en',
              'cards': [
                {'label': 'Amount', 'value': 'Rp 50.000', 'tone': 'default'},
                {'label': 'Cycle', 'value': 'NOV 2026', 'tone': 'positive'},
              ],
              'agentSteps': [
                {
                  'id': 's1',
                  'label': 'Prepared expense entry with statement cutoff routing',
                  'detail': 'Verified Nov 2026 cycle window',
                  'status': 'done',
                  'durationMs': 12,
                },
              ],
              'proactiveReminders': [
                {
                  'id': 'rem1',
                  'tone': 'caution',
                  'text': '4 days remaining in Nov 2026 cycle.',
                  'prompt': 'Summarize remaining Nov 2026 living cash',
                },
              ],
              'pendingAction': {
                'type': 'CONFIRM_EXPENSE',
                'title': 'Confirm Living Cash Entry',
                'payload': {
                  'label': 'Coffee',
                  'amount': 50000,
                  'paymentMethod': 'CASH',
                  'month': 11,
                  'year': 2026,
                },
              },
            },
          })}\n';

      // Split right inside multi-line bytes to stress test line assembly
      final rawBytes = utf8.encode('$line1$line2$finalLine');
      final mid1 = rawBytes.length ~/ 3;
      final mid2 = (rawBytes.length * 2) ~/ 3;
      final chunkStream = Stream<Uint8List>.fromIterable([
        Uint8List.fromList(rawBytes.sublist(0, mid1)),
        Uint8List.fromList(rawBytes.sublist(mid1, mid2)),
        Uint8List.fromList(rawBytes.sublist(mid2)),
      ]);

      return ResponseBody(
        chunkStream,
        200,
        headers: {'content-type': ['application/x-ndjson; charset=utf-8']},
      );
    }

    if (options.path == '/api/marquee/chat') {
      return ResponseBody.fromString(
        jsonEncode({
          'ok': true,
          'tool': 'prepare_quick_transaction',
          'summary': 'Logged Coffee Rp 50.000 cleanly to Nov 2026.',
          'tierUsed': 'CONFIRMED_EXECUTION',
          'model': 'deterministic-commit',
          'locale': 'en',
          'cards': [
            {'label': 'Saved', 'value': 'Rp 50.000', 'tone': 'positive'},
          ],
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/marquee/memory' && options.method == 'GET') {
      return ResponseBody.fromString(
        jsonEncode({
          'rules': [
            {
              'id': 'mem-1',
              'ruleText': 'Coffee goes to Living Cash',
              'merchantPattern': 'coffee',
              'defaultInstrument': 'CASH',
              'createdAt': '2026-11-20T00:00:00.000Z',
            },
          ],
        }),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    if (options.path == '/api/marquee/memory/mem-1' && options.method == 'DELETE') {
      return ResponseBody.fromString(
        jsonEncode({'ok': true}),
        200,
        headers: {'content-type': ['application/json']},
      );
    }

    return ResponseBody.fromString(jsonEncode({'ok': true}), 200);
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  group('NdjsonStreamClient byte stream decoding', () {
    test('reassembles split multi-byte UTF-8 JSON lines across chunk boundaries', () async {
      final first = jsonEncode({'type': 'status', 'label': 'Memeriksa 咖啡', 'phase': 'THINKING'});
      final second = jsonEncode({'type': 'final', 'data': {'ok': true, 'summary': 'Selesai'}});
      final encoded = utf8.encode('$first\n$second\n');

      // Cut directly inside multi-byte UTF-8 sequence ("咖啡")
      final chunks = <List<int>>[
        encoded.sublist(0, 38),
        encoded.sublist(38, 72),
        encoded.sublist(72),
      ];

      final decoded = await NdjsonStreamClient.parseByteStream(
        Stream<List<int>>.fromIterable(chunks),
      ).toList();

      expect(decoded.length, 2);
      expect(decoded[0]['type'], 'status');
      expect(decoded[0]['label'], 'Memeriksa 咖啡');
      expect(decoded[1]['type'], 'final');
      expect((decoded[1]['data'] as Map)['summary'], 'Selesai');
    });
  });

  group('MarqueeNotifier streaming & confirmation', () {
    test('streams status steps, parses pendingAction, confirms with Idempotency-Key & refreshes cockpit', () async {
      final adapter = _MockMarqueeAdapter();
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
      expect(adapter.bootFetchCount, 1);

      final marquee = container.read(marqueeProvider.notifier);
      await marquee.sendPrompt('Log coffee 50k', lang: AppLanguage.en);

      final state = container.read(marqueeProvider);
      expect(state.isStreaming, isFalse);
      expect(state.messages.length, 2);
      expect(state.messages.first.isUser, isTrue);
      final replyMsg = state.messages.last;
      expect(replyMsg.summary, contains('Coffee Rp 50.000'));
      expect(replyMsg.pendingAction, isNotNull);
      expect(replyMsg.pendingAction!.type, 'CONFIRM_EXPENSE');
      expect(replyMsg.actionExecuted, isFalse);
      expect(state.proactiveReminders.length, 1);

      await marquee.confirmPendingAction(replyMsg.id, replyMsg.pendingAction!);

      final confirmState = container.read(marqueeProvider);
      final updatedReply = confirmState.messages.firstWhere((m) => m.id == replyMsg.id);
      expect(updatedReply.actionExecuted, isTrue);
      expect(confirmState.messages.last.summary, contains('Logged Coffee'));

      final confirmReq = adapter.requests.firstWhere(
        (r) => r.path == '/api/marquee/chat' && r.method == 'POST',
      );
      expect(confirmReq.headers['Idempotency-Key'], isNotNull);
      expect((confirmReq.data as Map)['confirm'], isTrue);
      // Cockpit boot refreshed after confirmation mutation
      expect(adapter.bootFetchCount, greaterThanOrEqualTo(2));

      await marquee.loadMemoryRules();
      expect(container.read(marqueeProvider).memoryRules.length, 1);
      await marquee.deleteMemoryRule('mem-1');
      expect(container.read(marqueeProvider).memoryRules, isEmpty);
    });
  });
}
