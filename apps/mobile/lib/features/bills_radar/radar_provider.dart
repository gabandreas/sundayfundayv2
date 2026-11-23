import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../../core/network/api_client.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_models.dart';
import '../cockpit/cockpit_provider.dart';
import 'radar_models.dart';

enum RadarFilter { all, unpaidBills, shiftedOnly }

class RadarState {
  final CashRadarDetail? detail;
  final WalletGuardCheckinStatus? savedCheckin;
  final bool isLoading;
  final bool isSubmitting;
  final RadarFilter filter;
  final String? errorMessage;

  const RadarState({
    this.detail,
    this.savedCheckin,
    this.isLoading = false,
    this.isSubmitting = false,
    this.filter = RadarFilter.all,
    this.errorMessage,
  });

  RadarState copyWith({
    CashRadarDetail? detail,
    WalletGuardCheckinStatus? savedCheckin,
    bool clearCheckin = false,
    bool? isLoading,
    bool? isSubmitting,
    RadarFilter? filter,
    String? errorMessage,
    bool clearError = false,
  }) {
    return RadarState(
      detail: detail ?? this.detail,
      savedCheckin: clearCheckin ? null : (savedCheckin ?? this.savedCheckin),
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      filter: filter ?? this.filter,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class RadarNotifier extends Notifier<RadarState> {
  final RadarState? _initialOverride;
  static const _uuid = Uuid();

  RadarNotifier([this._initialOverride]);

  @override
  RadarState build() => _initialOverride ?? const RadarState();

  Future<void> loadRadar({int? month, int? year}) async {
    final cockpitPeriod = ref.read(cockpitProvider).boot?.period;
    final targetMonth = month ?? cockpitPeriod?.month;
    final targetYear = year ?? cockpitPeriod?.year;

    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final client = ref.read(apiClientProvider);
      final query = <String, dynamic>{
        'month': ?targetMonth,
        'year': ?targetYear,
      };
      final results = await Future.wait([
        client.get<Map<String, dynamic>>(
          '/api/finance/cash-radar',
          queryParameters: query.isEmpty ? null : query,
        ),
        client.get<Map<String, dynamic>>(
          '/api/finance/wallet-guard',
          queryParameters: query.isEmpty ? null : query,
        ),
      ]);

      final radarDetail = CashRadarDetail.fromJson(results[0].data ?? const {});
      final wgData = results[1].data ?? const {};
      final rawCheckin = wgData['savedCheckin'];
      final savedCheckin = rawCheckin is Map
          ? WalletGuardCheckinStatus.fromJson(Map<String, dynamic>.from(rawCheckin))
          : null;

      state = state.copyWith(
        detail: radarDetail,
        savedCheckin: savedCheckin,
        clearCheckin: savedCheckin == null,
        isLoading: false,
      );
    } on NetworkOfflineException catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.message);
    } catch (e) {
      state = state.copyWith(isLoading: false, errorMessage: e.toString());
    }
  }

  void setFilter(RadarFilter filter) {
    ErpHaptics.selection();
    state = state.copyWith(filter: filter);
  }

  Future<bool> submitWalletCheckin({
    required int actualWalletBalance,
    String? note,
  }) async {
    final period = ref.read(cockpitProvider).boot?.period;
    final month = state.detail?.periodMonth ?? period?.month ?? DateTime.now().month;
    final year = state.detail?.periodYear ?? period?.year ?? DateTime.now().year;

    state = state.copyWith(isSubmitting: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
            '/api/finance/wallet-guard',
            idempotencyKey: _uuid.v4(),
            data: {
              'month': month,
              'year': year,
              'actualWalletBalance': actualWalletBalance,
              'persist': true,
              if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
            },
          );
      final data = res.data ?? const {};
      final rawSaved = data['savedCheckin'];
      final checkin = rawSaved is Map
          ? WalletGuardCheckinStatus.fromJson(Map<String, dynamic>.from(rawSaved))
          : null;

      ErpHaptics.medium();
      state = state.copyWith(
        savedCheckin: checkin,
        isSubmitting: false,
      );
      return true;
    } on ConflictMutationException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
      return false;
    } on ApiValidationException catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.message);
      return false;
    } catch (e) {
      state = state.copyWith(isSubmitting: false, errorMessage: e.toString());
      return false;
    }
  }

  Future<void> setBillSettlementState(
    BillLineItem bill,
    String nextSettlementState,
  ) async {
    final period = ref.read(cockpitProvider).boot?.period;
    if (period?.isLocked == true) return;
    if (bill.settlementState.toUpperCase() == nextSettlementState.toUpperCase()) {
      return;
    }

    ErpHaptics.selection();
    final key = _uuid.v4();
    try {
      await ref.read(apiClientProvider).patch<Map<String, dynamic>>(
            '/api/credit/line-items/${bill.id}/settlement-state',
            idempotencyKey: key,
            data: {'settlementState': nextSettlementState},
          );
      await ref.read(cockpitProvider.notifier).loadBoot(
            month: period?.month,
            year: period?.year,
          );
      await loadRadar(month: period?.month, year: period?.year);
    } catch (e) {
      state = state.copyWith(errorMessage: e.toString());
    }
  }
}

final radarProvider = NotifierProvider<RadarNotifier, RadarState>(
  RadarNotifier.new,
);
