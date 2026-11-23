import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/network/api_client.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import 'cockpit_models.dart';

class CockpitState {
  final MobileBootPayload? boot;
  final bool isInitialLoading;
  final bool isSyncing;
  final bool privacyMask;
  final String? offlineMessage;
  final String? errorMessage;

  const CockpitState({
    this.boot,
    this.isInitialLoading = false,
    this.isSyncing = false,
    this.privacyMask = false,
    this.offlineMessage,
    this.errorMessage,
  });

  CockpitState copyWith({
    MobileBootPayload? boot,
    bool? isInitialLoading,
    bool? isSyncing,
    bool? privacyMask,
    String? offlineMessage,
    bool clearOffline = false,
    String? errorMessage,
    bool clearError = false,
  }) {
    return CockpitState(
      boot: boot ?? this.boot,
      isInitialLoading: isInitialLoading ?? this.isInitialLoading,
      isSyncing: isSyncing ?? this.isSyncing,
      privacyMask: privacyMask ?? this.privacyMask,
      offlineMessage: clearOffline ? null : (offlineMessage ?? this.offlineMessage),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class CockpitNotifier extends Notifier<CockpitState> {
  final CockpitState? _initialOverride;
  static const _uuid = Uuid();

  CockpitNotifier([this._initialOverride]);

  @override
  CockpitState build() => _initialOverride ?? const CockpitState();

  Future<void> loadBoot({int? month, int? year}) async {
    final hasExisting = state.boot != null;
    state = state.copyWith(
      isInitialLoading: !hasExisting,
      isSyncing: hasExisting,
      clearError: true,
    );

    try {
      final client = ref.read(apiClientProvider);
      final vault = ref.read(secureVaultProvider);
      final savedMask = await vault.readPrivacyMaskDefault();

      final query = <String, dynamic>{
        'month': ?month,
        'year': ?year,
      };
      final res = await client.get<Map<String, dynamic>>(
        '/api/finance/mobile-boot',
        queryParameters: query.isEmpty ? null : query,
      );
      final payload = MobileBootPayload.fromJson(res.data ?? const {});
      final effectiveMask = hasExisting
          ? state.privacyMask
          : (savedMask || payload.maskBalancesByDefault);

      state = CockpitState(
        boot: payload,
        isInitialLoading: false,
        isSyncing: false,
        privacyMask: effectiveMask,
      );
    } on NetworkOfflineException catch (e) {
      state = state.copyWith(
        isInitialLoading: false,
        isSyncing: false,
        offlineMessage: e.message,
      );
    } catch (e) {
      state = state.copyWith(
        isInitialLoading: false,
        isSyncing: false,
        errorMessage: hasExisting ? null : e.toString(),
        offlineMessage: hasExisting
            ? 'Unable to sync latest data. Showing cached snapshot.'
            : null,
      );
    }
  }

  Future<void> switchPeriod(int deltaMonths) async {
    final current = state.boot?.period;
    if (current == null) {
      await loadBoot();
      return;
    }
    ErpHaptics.selection();
    var m = current.month + deltaMonths;
    var y = current.year;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    while (m < 1) {
      m += 12;
      y -= 1;
    }
    await loadBoot(month: m, year: y);
  }

  Future<void> togglePrivacyMask() async {
    ErpHaptics.selection();
    final next = !state.privacyMask;
    state = state.copyWith(privacyMask: next);
    await ref.read(secureVaultProvider).savePrivacyMaskDefault(next);
  }

  Future<CutoffPreviewResult?> simulateCutoff({
    required String instrument,
    required int amountRp,
    int tenorMonths = 1,
    String? purchaseDateIso,
    bool holdPastCutoff = false,
  }) async {
    if (amountRp <= 0) return null;
    try {
      final client = ref.read(apiClientProvider);
      final dateStr =
          purchaseDateIso ?? DateTime.now().toIso8601String().substring(0, 10);
      final res = await client.post<Map<String, dynamic>>(
        '/api/finance/cutoff-simulate',
        data: {
          'instrument': instrument,
          'principalAmount': amountRp,
          'tenorMonths': tenorMonths,
          'purchaseDate': dateStr,
          'holdPastCutoff': holdPastCutoff,
        },
      );
      if (res.data == null) return null;
      return CutoffPreviewResult.fromJson(res.data!);
    } catch (_) {
      return null;
    }
  }

  Future<bool> submitQuickTransaction({
    required String label,
    required int amountRp,
    required String paymentMethod,
    String type = 'DEDUCTION',
    int tenorMonths = 1,
    bool holdPastCutoff = false,
    String? idempotencyKey,
  }) async {
    final period = state.boot?.period;
    if (period == null || period.isLocked) {
      return false;
    }
    try {
      final client = ref.read(apiClientProvider);
      final key = idempotencyKey ?? 'mob_tx_${_uuid.v4()}';
      await client.post<Map<String, dynamic>>(
        '/api/finance/transactions',
        idempotencyKey: key,
        data: {
          'month': period.month,
          'year': period.year,
          'type': type,
          'label': label.trim(),
          'amount': amountRp,
          'date': DateTime.now().toUtc().toIso8601String(),
          if (type == 'DEDUCTION') 'paymentMethod': paymentMethod,
          if (paymentMethod == 'PAYLATER' || paymentMethod == 'CC')
            'paylaterTenor': tenorMonths,
          if (paymentMethod == 'PAYLATER' || paymentMethod == 'CC')
            'holdPastCutoff': holdPastCutoff,
        },
      );
      ErpHaptics.medium();
      await loadBoot(month: period.month, year: period.year);
      return true;
    } catch (e) {
      ErpHaptics.error();
      state = state.copyWith(errorMessage: e.toString());
      return false;
    }
  }

  Future<bool> toggleBillSettled(BillLineItem item) async {
    final period = state.boot?.period;
    if (period == null || period.isLocked) return false;
    ErpHaptics.light();
    try {
      final client = ref.read(apiClientProvider);
      final nextState = item.isSettled ? 'UNPAID' : 'PAID';
      await client.patch<Map<String, dynamic>>(
        '/api/credit/line-items/${item.id}/settlement-state',
        idempotencyKey: 'mob_settle_${item.id}_${nextState}_${DateTime.now().millisecondsSinceEpoch ~/ 3000}',
        data: {'settlementState': nextState},
      );
      await loadBoot(month: period.month, year: period.year);
      return true;
    } catch (_) {
      return false;
    }
  }
}

final cockpitProvider = NotifierProvider<CockpitNotifier, CockpitState>(
  CockpitNotifier.new,
);
