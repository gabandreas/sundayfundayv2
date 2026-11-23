import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_provider.dart';
import 'submodules_provider.dart';

class SavingsScreen extends ConsumerStatefulWidget {
  const SavingsScreen({super.key});

  @override
  ConsumerState<SavingsScreen> createState() => _SavingsScreenState();
}

class _SavingsScreenState extends ConsumerState<SavingsScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(submodulesProvider.notifier).loadSavings();
    });
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final masked = ref.watch(cockpitProvider).privacyMask;
    final state = ref.watch(submodulesProvider);
    final overview = state.savingsOverview;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        title: Text(
          strings.savingsSectionTitle,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: ErpHairlineProgressBar(visible: state.isLoadingSavings),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.positive,
          backgroundColor: AppColors.surfaceElevated,
          onRefresh: () => ref.read(submodulesProvider.notifier).loadSavings(),
          child: overview == null
              ? ListView(
                  padding: const EdgeInsets.all(16),
                  children: const [
                    ErpSkeletonBox(height: 148, radius: 10),
                    SizedBox(height: 12),
                    ErpSkeletonBox(height: 120, radius: 10),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (state.errorMessage != null) ...[
                      ErpErrorBanner(message: state.errorMessage!),
                      const SizedBox(height: 10),
                    ],
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            strings.savingsSectionTitle.toUpperCase(),
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 10,
                              letterSpacing: 0.9,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            IdrFormatter.formatRp(
                              overview.totalBalanceRp,
                              masked: masked,
                            ),
                            style: AppTheme.displayFigure.copyWith(fontSize: 30),
                          ),
                          const SizedBox(height: 12),
                          const Divider(height: 1, color: AppColors.borderSubtle),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${strings.liquidCashLabel} (${overview.liquidSharePercent.toStringAsFixed(0)}%)',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      IdrFormatter.formatRp(
                                        overview.liquidCashRp,
                                        masked: masked,
                                      ),
                                      style: AppTheme.tabularMono.copyWith(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.end,
                                  children: [
                                    Text(
                                      '${strings.rdpuInvestLabel} (${overview.rdpuSharePercent.toStringAsFixed(0)}%)',
                                      style: const TextStyle(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      IdrFormatter.formatRp(
                                        overview.investmentRdpuRp,
                                        masked: masked,
                                      ),
                                      style: AppTheme.tabularMono.copyWith(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w600,
                                        color: AppColors.positive,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (overview.goals.isNotEmpty) ...[
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
                            for (var i = 0; i < overview.goals.length; i++) ...[
                              if (i > 0)
                                const Divider(
                                  height: 1,
                                  color: AppColors.borderSubtle,
                                ),
                              Padding(
                                padding: const EdgeInsets.all(14),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment:
                                          MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            overview.goals[i].name,
                                            style: const TextStyle(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.textPrimary,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          '${overview.goals[i].progressPercent.toStringAsFixed(0)}%',
                                          style: AppTheme.tabularMono.copyWith(
                                            fontSize: 12,
                                            color: AppColors.positive,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 8),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: (overview.goals[i].progressPercent /
                                                100)
                                            .clamp(0.0, 1.0),
                                        minHeight: 5,
                                        backgroundColor: AppColors.surfaceSubtle,
                                        valueColor:
                                            const AlwaysStoppedAnimation<Color>(
                                          AppColors.positive,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      '${IdrFormatter.formatRp(overview.goals[i].allocatedAmountRp, masked: masked)} / ${IdrFormatter.formatRp(overview.goals[i].targetAmountRp, masked: masked)}',
                                      style: AppTheme.tabularMono.copyWith(
                                        fontSize: 11,
                                        color: AppColors.textSecondary,
                                      ),
                                    ),
                                  ],
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
