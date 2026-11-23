import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_provider.dart';
import 'submodules_provider.dart';

class LedgerScreen extends ConsumerStatefulWidget {
  const LedgerScreen({super.key});

  @override
  ConsumerState<LedgerScreen> createState() => _LedgerScreenState();
}

class _LedgerScreenState extends ConsumerState<LedgerScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(submodulesProvider.notifier).loadLedger();
    });
  }

  String _formatDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('dd MMM').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final cockpit = ref.watch(cockpitProvider);
    final state = ref.watch(submodulesProvider);
    final masked = cockpit.privacyMask;
    final periodLabel = cockpit.boot?.period.shortLabel ?? '';

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        title: Text(
          periodLabel.isNotEmpty
              ? '${strings.ledgerMenuTitle} • $periodLabel'
              : strings.ledgerMenuTitle,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: ErpHairlineProgressBar(visible: state.isLoadingLedger),
        ),
      ),
      body: SafeArea(
        child: RefreshIndicator(
          color: AppColors.positive,
          backgroundColor: AppColors.surfaceElevated,
          onRefresh: () => ref.read(submodulesProvider.notifier).loadLedger(),
          child: state.isLoadingLedger && state.transactions.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(16),
                  children: const [
                    ErpSkeletonBox(height: 64, radius: 10),
                    SizedBox(height: 10),
                    ErpSkeletonBox(height: 64, radius: 10),
                    SizedBox(height: 10),
                    ErpSkeletonBox(height: 64, radius: 10),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (state.errorMessage != null) ...[
                      ErpErrorBanner(message: state.errorMessage!),
                      const SizedBox(height: 10),
                    ],
                    if (state.transactions.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: const Text(
                          'No recorded ledger entries for this period.',
                          style: TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                      )
                    else
                      Material(
                        color: AppColors.surface,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                          side: const BorderSide(color: AppColors.border),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          children: [
                            for (var i = 0; i < state.transactions.length; i++) ...[
                              if (i > 0)
                                const Divider(
                                  height: 1,
                                  color: AppColors.borderSubtle,
                                ),
                              ListTile(
                                title: Text(
                                  state.transactions[i].label,
                                  style: const TextStyle(
                                    fontSize: 13,
                                    color: AppColors.textPrimary,
                                  ),
                                ),
                                subtitle: Text(
                                  '${_formatDate(state.transactions[i].dateIso)} • ${state.transactions[i].paymentMethod ?? state.transactions[i].sourceType}',
                                  style: const TextStyle(
                                    fontFamily: 'monospace',
                                    fontSize: 11,
                                    color: AppColors.textTertiary,
                                  ),
                                ),
                                trailing: Text(
                                  '${state.transactions[i].isIncome ? '+' : '-'}${IdrFormatter.formatRp(state.transactions[i].amountRp, masked: masked)}',
                                  style: AppTheme.tabularMono.copyWith(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: state.transactions[i].isIncome
                                        ? AppColors.positive
                                        : AppColors.textPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
        ),
      ),
    );
  }
}
