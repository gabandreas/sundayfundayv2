import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import 'cockpit_models.dart';
import 'cockpit_provider.dart';

class CockpitTab extends ConsumerWidget {
  final VoidCallback onOpenRadarTab;

  const CockpitTab({super.key, required this.onOpenRadarTab});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final state = ref.watch(cockpitProvider);
    final boot = state.boot;

    if (boot == null) {
      if (state.errorMessage != null) {
        return ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ErpErrorBanner(message: state.errorMessage!),
            const SizedBox(height: 12),
            SizedBox(
              height: 48,
              child: OutlinedButton(
                onPressed: () => ref.read(cockpitProvider.notifier).loadBoot(),
                child: const Text('Retry'),
              ),
            ),
          ],
        );
      }
      return const _CockpitLoadingSkeleton();
    }

    final masked = state.privacyMask;
    final period = boot.period;
    final pacing = boot.pacing;
    final alloc = boot.allocationSummary;

    return RefreshIndicator(
      color: AppColors.positive,
      backgroundColor: AppColors.surfaceElevated,
      onRefresh: () => ref
          .read(cockpitProvider.notifier)
          .loadBoot(month: period.month, year: period.year),
      child: AnimatedOpacity(
        opacity: state.isSyncing ? 0.62 : 1.0,
        duration: const Duration(milliseconds: 160),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
          children: [
            if (state.offlineMessage != null) ...[
              ErpErrorBanner(message: state.offlineMessage!, isWarning: true),
              const SizedBox(height: 12),
            ],
            _PeriodSwitcherBar(
              period: period,
              lockedLabel: strings.lockedBadge,
              onPrev: () => ref.read(cockpitProvider.notifier).switchPeriod(-1),
              onNext: () => ref.read(cockpitProvider.notifier).switchPeriod(1),
            ),
            const SizedBox(height: 14),
            _HeroSafeToSpendCard(
              strings: strings,
              pacing: pacing,
              masked: masked,
            ),
            const SizedBox(height: 14),
            _CashflowBreakdownCard(
              strings: strings,
              alloc: alloc,
              masked: masked,
            ),
            const SizedBox(height: 14),
            _RadarAndBillsTeaser(
              strings: strings,
              boot: boot,
              masked: masked,
              onTap: onOpenRadarTab,
            ),
          ],
        ),
      ),
    );
  }
}

class _CockpitLoadingSkeleton extends StatelessWidget {
  const _CockpitLoadingSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        ErpSkeletonBox(height: 44, radius: 8),
        SizedBox(height: 14),
        ErpSkeletonBox(height: 176, radius: 10),
        SizedBox(height: 14),
        ErpSkeletonBox(height: 164, radius: 10),
        SizedBox(height: 14),
        ErpSkeletonBox(height: 92, radius: 10),
      ],
    );
  }
}

class _PeriodSwitcherBar extends StatelessWidget {
  final PeriodInfo period;
  final String lockedLabel;
  final VoidCallback onPrev;
  final VoidCallback onNext;

  const _PeriodSwitcherBar({
    required this.period,
    required this.lockedLabel,
    required this.onPrev,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 48,
      padding: const EdgeInsets.symmetric(horizontal: 6),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          IconButton(
            onPressed: onPrev,
            icon: const Icon(Icons.chevron_left, size: 20),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  period.shortLabel,
                  style: AppTheme.tabularMono.copyWith(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.6,
                  ),
                ),
                if (period.isLocked) ...[
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0x22E59B2C),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: AppColors.caution),
                    ),
                    child: Text(
                      lockedLabel,
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        color: AppColors.caution,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          IconButton(
            onPressed: onNext,
            icon: const Icon(Icons.chevron_right, size: 20),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
          ),
        ],
      ),
    );
  }
}

class _HeroSafeToSpendCard extends StatelessWidget {
  final AppStrings strings;
  final PacingSnapshot pacing;
  final bool masked;

  const _HeroSafeToSpendCard({
    required this.strings,
    required this.pacing,
    required this.masked,
  });

  @override
  Widget build(BuildContext context) {
    final progress = pacing.daysInCycle > 0
        ? (pacing.currentDayIndex / pacing.daysInCycle).clamp(0.0, 1.0)
        : 0.0;

    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  strings.safeToSpendLabel.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    letterSpacing: 0.9,
                    color: AppColors.textTertiary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                pacing.isPrePayday
                    ? 'STARTS +${pacing.daysUntilCycleStart}D'
                    : pacing.isCompleted
                        ? 'COMPLETED'
                        : 'DAY ${pacing.currentDayIndex}/${pacing.daysInCycle}',
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 11,
                  color: pacing.isPrePayday
                      ? AppColors.caution
                      : AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            IdrFormatter.formatRp(pacing.safeToSpendToday, masked: masked),
            style: AppTheme.displayFigure.copyWith(
              color: pacing.remainingBudget <= 0 && !pacing.isPrePayday
                  ? AppColors.negative
                  : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            pacing.cycleDateLabel,
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(2),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 4,
              backgroundColor: AppColors.borderSubtle,
              valueColor: AlwaysStoppedAnimation<Color>(
                pacing.isPrePayday ? AppColors.caution : AppColors.positive,
              ),
            ),
          ),
          const SizedBox(height: 14),
          Container(
            padding: const EdgeInsets.only(top: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: AppColors.borderSubtle)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: _MetricColumn(
                    label: strings.weekdayRateLabel,
                    value: IdrFormatter.formatRp(
                      pacing.weekdaySafeRate,
                      masked: masked,
                    ),
                  ),
                ),
                Container(width: 1, height: 30, color: AppColors.borderSubtle),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 14),
                    child: _MetricColumn(
                      label: strings.weekendRateLabel,
                      value: IdrFormatter.formatRp(
                        pacing.weekendSafeRate,
                        masked: masked,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CashflowBreakdownCard extends StatelessWidget {
  final AppStrings strings;
  final AllocationSummary alloc;
  final bool masked;

  const _CashflowBreakdownCard({
    required this.strings,
    required this.alloc,
    required this.masked,
  });

  @override
  Widget build(BuildContext context) {
    Widget rowItem(String label, int amount, {Color? valueColor}) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                ),
              ),
            ),
            Text(
              IdrFormatter.formatRp(amount, masked: masked),
              style: AppTheme.tabularMono.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: valueColor ?? AppColors.textPrimary,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: [
          rowItem(
            strings.totalIncomeLabel,
            alloc.finalTotalIncome,
            valueColor: AppColors.positive,
          ),
          const Divider(height: 1, color: AppColors.borderSubtle),
          rowItem(strings.billsAndDebtLabel, -alloc.totalDeductions),
          const Divider(height: 1, color: AppColors.borderSubtle),
          rowItem(strings.routineBillsLabel, -alloc.routineBillsTotal),
          const Divider(height: 1, color: AppColors.borderSubtle),
          rowItem(strings.dailyLivingLabel, alloc.dailyLivingFunded),
          for (final tier in alloc.tiers.where((t) => t.enabled)) ...[
            const Divider(height: 1, color: AppColors.borderSubtle),
            rowItem(tier.label, tier.actualRp),
          ],
          if (alloc.deficitUncovered > 0) ...[
            const Divider(height: 1, color: AppColors.borderSubtle),
            rowItem(
              'Budget Shortfall',
              alloc.deficitUncovered,
              valueColor: AppColors.negative,
            ),
          ],
        ],
      ),
    );
  }
}

class _RadarAndBillsTeaser extends StatelessWidget {
  final AppStrings strings;
  final MobileBootPayload boot;
  final bool masked;
  final VoidCallback onTap;

  const _RadarAndBillsTeaser({
    required this.strings,
    required this.boot,
    required this.masked,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final radar = boot.cashRadarSummary;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: _MetricColumn(
                label: strings.unpaidBillsLabel,
                value: '${boot.unpaidBillsCount} / ${boot.bills.length}',
              ),
            ),
            Container(width: 1, height: 34, color: AppColors.borderSubtle),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(left: 14),
                child: _MetricColumn(
                  label: strings.lowestCashPointLabel,
                  value: IdrFormatter.formatRp(
                    radar.lowestCashPointRp,
                    masked: masked,
                  ),
                  valueColor: radar.isTightOrDeficit
                      ? AppColors.negative
                      : AppColors.textPrimary,
                ),
              ),
            ),
            const Icon(
              Icons.chevron_right,
              size: 18,
              color: AppColors.textTertiary,
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricColumn extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _MetricColumn({
    required this.label,
    required this.value,
    this.valueColor,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: AppColors.textTertiary),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: AppTheme.tabularMono.copyWith(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: valueColor ?? AppColors.textPrimary,
          ),
        ),
      ],
    );
  }
}
