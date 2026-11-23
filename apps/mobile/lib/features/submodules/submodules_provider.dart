import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_provider.dart';
import 'submodules_models.dart';

class SubmodulesState {
  final List<LedgerTransactionItem> transactions;
  final SavingsOverviewModel? savingsOverview;
  final List<WishlistItemModel> wishlistItems;
  final WishlistAnalysisModel? wishlistAnalysis;
  final bool isLoadingLedger;
  final bool isLoadingSavings;
  final bool isLoadingWishlist;
  final bool isSimulatingWishlist;
  final String? errorMessage;

  const SubmodulesState({
    this.transactions = const [],
    this.savingsOverview,
    this.wishlistItems = const [],
    this.wishlistAnalysis,
    this.isLoadingLedger = false,
    this.isLoadingSavings = false,
    this.isLoadingWishlist = false,
    this.isSimulatingWishlist = false,
    this.errorMessage,
  });

  SubmodulesState copyWith({
    List<LedgerTransactionItem>? transactions,
    SavingsOverviewModel? savingsOverview,
    List<WishlistItemModel>? wishlistItems,
    WishlistAnalysisModel? wishlistAnalysis,
    bool? isLoadingLedger,
    bool? isLoadingSavings,
    bool? isLoadingWishlist,
    bool? isSimulatingWishlist,
    String? errorMessage,
    bool clearError = false,
  }) {
    return SubmodulesState(
      transactions: transactions ?? this.transactions,
      savingsOverview: savingsOverview ?? this.savingsOverview,
      wishlistItems: wishlistItems ?? this.wishlistItems,
      wishlistAnalysis: wishlistAnalysis ?? this.wishlistAnalysis,
      isLoadingLedger: isLoadingLedger ?? this.isLoadingLedger,
      isLoadingSavings: isLoadingSavings ?? this.isLoadingSavings,
      isLoadingWishlist: isLoadingWishlist ?? this.isLoadingWishlist,
      isSimulatingWishlist: isSimulatingWishlist ?? this.isSimulatingWishlist,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class SubmodulesNotifier extends Notifier<SubmodulesState> {
  final SubmodulesState? _initialOverride;

  SubmodulesNotifier([this._initialOverride]);

  @override
  SubmodulesState build() => _initialOverride ?? const SubmodulesState();

  Future<void> loadLedger({int? month, int? year}) async {
    final period = ref.read(cockpitProvider).boot?.period;
    final m = month ?? period?.month ?? DateTime.now().month;
    final y = year ?? period?.year ?? DateTime.now().year;

    state = state.copyWith(isLoadingLedger: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).get<dynamic>(
        '/api/finance/transactions',
        queryParameters: {'month': m, 'year': y},
      );
      final rawList = (res.data as List?) ?? const [];
      final items = rawList
          .whereType<Map>()
          .map((e) => LedgerTransactionItem.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      state = state.copyWith(transactions: items, isLoadingLedger: false);
    } catch (e) {
      state = state.copyWith(isLoadingLedger: false, errorMessage: e.toString());
    }
  }

  Future<void> loadSavings() async {
    state = state.copyWith(isLoadingSavings: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).get<Map<String, dynamic>>(
        '/api/savings/overview',
      );
      state = state.copyWith(
        savingsOverview: SavingsOverviewModel.fromJson(res.data ?? const {}),
        isLoadingSavings: false,
      );
    } catch (e) {
      state = state.copyWith(isLoadingSavings: false, errorMessage: e.toString());
    }
  }

  Future<void> loadWishlist() async {
    state = state.copyWith(isLoadingWishlist: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).get<dynamic>(
        '/api/wishlist',
      );
      final rawList = (res.data as List?) ?? const [];
      final items = rawList
          .whereType<Map>()
          .map((e) => WishlistItemModel.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      state = state.copyWith(wishlistItems: items, isLoadingWishlist: false);
    } catch (e) {
      state = state.copyWith(isLoadingWishlist: false, errorMessage: e.toString());
    }
  }

  Future<void> analyzeWishlistDraft({
    required int price,
    String fundingType = 'CASH',
    int? tenor,
  }) async {
    ErpHaptics.light();
    state = state.copyWith(isSimulatingWishlist: true, clearError: true);
    try {
      final res = await ref.read(apiClientProvider).post<Map<String, dynamic>>(
        '/api/wishlist/analyze-draft',
        data: {
          'price': price,
          'fundingType': fundingType,
          if (tenor != null && tenor > 0) 'tenor': tenor,
        },
      );
      state = state.copyWith(
        wishlistAnalysis: WishlistAnalysisModel.fromJson(res.data ?? const {}),
        isSimulatingWishlist: false,
      );
    } catch (e) {
      state = state.copyWith(
        isSimulatingWishlist: false,
        errorMessage: e.toString(),
      );
    }
  }
}

final submodulesProvider =
    NotifierProvider<SubmodulesNotifier, SubmodulesState>(
  SubmodulesNotifier.new,
);
