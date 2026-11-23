import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_provider.dart';
import 'submodules_provider.dart';

class WishlistScreen extends ConsumerStatefulWidget {
  const WishlistScreen({super.key});

  @override
  ConsumerState<WishlistScreen> createState() => _WishlistScreenState();
}

class _WishlistScreenState extends ConsumerState<WishlistScreen> {
  final TextEditingController _priceController = TextEditingController();
  String _fundingType = 'CASH';
  int _tenor = 3;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(submodulesProvider.notifier).loadWishlist();
    });
  }

  @override
  void dispose() {
    _priceController.dispose();
    super.dispose();
  }

  void _runSimulation() {
    final digits = _priceController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final price = int.tryParse(digits);
    if (price == null || price <= 0) return;
    ref.read(submodulesProvider.notifier).analyzeWishlistDraft(
          price: price,
          fundingType: _fundingType,
          tenor: _fundingType == 'INSTALLMENT' ? _tenor : null,
        );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final masked = ref.watch(cockpitProvider).privacyMask;
    final state = ref.watch(submodulesProvider);
    final analysis = state.wishlistAnalysis;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        title: Text(
          strings.wishlistMenuTitle,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: ErpHairlineProgressBar(
            visible: state.isLoadingWishlist || state.isSimulatingWishlist,
          ),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.positive,
          backgroundColor: AppColors.surfaceElevated,
          onRefresh: () => ref.read(submodulesProvider.notifier).loadWishlist(),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      controller: _priceController,
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: strings.wishlistPriceLabel,
                      ),
                    ),
                    const SizedBox(height: 12),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'CASH', label: Text('Cash')),
                        ButtonSegment(value: 'INSTALLMENT', label: Text('Installment')),
                      ],
                      selected: {_fundingType},
                      onSelectionChanged: (sel) =>
                          setState(() => _fundingType = sel.first),
                    ),
                    if (_fundingType == 'INSTALLMENT') ...[
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          for (final t in const [3, 6, 12]) ...[
                            if (t != 3) const SizedBox(width: 8),
                            ChoiceChip(
                              label: Text('${t}x'),
                              selected: _tenor == t,
                              onSelected: (_) => setState(() => _tenor = t),
                            ),
                          ],
                        ],
                      ),
                    ],
                    const SizedBox(height: 12),
                    SizedBox(
                      height: 44,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.positive,
                          foregroundColor: AppColors.canvas,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                        onPressed:
                            state.isSimulatingWishlist ? null : _runSimulation,
                        child: Text(
                          strings.wishlistSimulateAction,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                      ),
                    ),
                    if (analysis != null) ...[
                      const SizedBox(height: 14),
                      const Divider(height: 1, color: AppColors.borderSubtle),
                      const SizedBox(height: 12),
                      Text(
                        'Cash: ${analysis.cashStrategyTier}',
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Shortfall: ${IdrFormatter.formatRp(analysis.shortfallRp, masked: masked)} • ${analysis.estimatedMonthsToSave} mo',
                        style: AppTheme.tabularMono.copyWith(
                          fontSize: 12,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      if (analysis.installmentRiskTier != null) ...[
                        const SizedBox(height: 6),
                        Text(
                          'Installment: ${analysis.installmentRiskTier} • Peak DSR ${(analysis.peakDebtRatioPercent ?? 0).toStringAsFixed(1)}%',
                          style: AppTheme.tabularMono.copyWith(
                            fontSize: 12,
                            color: analysis.installmentRiskTier == 'HIGH_RISK'
                                ? AppColors.urgency
                                : AppColors.caution,
                          ),
                        ),
                      ],
                    ],
                  ],
                ),
              ),
              if (state.wishlistItems.isNotEmpty) ...[
                const SizedBox(height: 14),
                Material(
                  color: AppColors.surface,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: const BorderSide(color: AppColors.border),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      for (var i = 0; i < state.wishlistItems.length; i++) ...[
                        if (i > 0)
                          const Divider(height: 1, color: AppColors.borderSubtle),
                        ListTile(
                          title: Text(
                            state.wishlistItems[i].name,
                            style: const TextStyle(
                              fontSize: 13,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          subtitle: Text(
                            '${state.wishlistItems[i].fundingType} • ${state.wishlistItems[i].status}',
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          trailing: Text(
                            IdrFormatter.formatRp(
                              state.wishlistItems[i].priceRp,
                              masked: masked,
                            ),
                            style: AppTheme.tabularMono.copyWith(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
