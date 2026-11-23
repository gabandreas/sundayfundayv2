import 'dart:math' as math;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_models.dart';
import '../cockpit/cockpit_provider.dart';
import 'radar_models.dart';
import 'radar_provider.dart';

class RadarTab extends ConsumerStatefulWidget {
  const RadarTab({super.key});

  @override
  ConsumerState<RadarTab> createState() => _RadarTabState();
}

class _RadarTabState extends ConsumerState<RadarTab> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final radar = ref.read(radarProvider);
      if (radar.detail == null && !radar.isLoading) {
        ref.read(radarProvider.notifier).loadRadar();
      }
    });
  }

  Future<void> _openWalletCheckinSheet(
    BuildContext context,
    AppStrings strings,
    WalletGuardCheckinStatus? existing,
  ) async {
    ErpHaptics.light();
    final controller = TextEditingController(
      text: existing != null ? '${existing.actualWalletBalance}' : '',
    );
    final noteController = TextEditingController(text: existing?.note ?? '');

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
        side: BorderSide(color: AppColors.border),
      ),
      builder: (sheetCtx) {
        return Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.of(sheetCtx).viewInsets.bottom + 20,
          ),
          child: Consumer(
            builder: (context, ref, _) {
              final state = ref.watch(radarProvider);
              return Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    strings.walletCheckinAction,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: controller,
                    keyboardType: TextInputType.number,
                    autofocus: true,
                    decoration: InputDecoration(
                      labelText: strings.walletBalanceLabel,
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: noteController,
                    decoration: InputDecoration(
                      labelText: strings.itemLabelPlaceholder,
                    ),
                  ),
                  if (state.errorMessage != null) ...[
                    const SizedBox(height: 8),
                    ErpErrorBanner(message: state.errorMessage!),
                  ],
                  const SizedBox(height: 14),
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.positive,
                        foregroundColor: AppColors.canvas,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      onPressed: state.isSubmitting
                          ? null
                          : () async {
                              final digits = controller.text
                                  .replaceAll(RegExp(r'[^0-9]'), '');
                              final parsed = int.tryParse(digits);
                              if (parsed == null) return;
                              final ok = await ref
                                  .read(radarProvider.notifier)
                                  .submitWalletCheckin(
                                    actualWalletBalance: parsed,
                                    note: noteController.text,
                                  );
                              if (ok && sheetCtx.mounted) {
                                Navigator.of(sheetCtx).pop();
                              }
                            },
                      child: Text(
                        strings.walletCheckinAction,
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );

    controller.dispose();
    noteController.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<CockpitState>(cockpitProvider, (prev, next) {
      final pM = prev?.boot?.period.month;
      final pY = prev?.boot?.period.year;
      final nM = next.boot?.period.month;
      final nY = next.boot?.period.year;
      if (nM != null && nY != null && (pM != nM || pY != nY)) {
        ref.read(radarProvider.notifier).loadRadar(month: nM, year: nY);
      }
    });

    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final cockpit = ref.watch(cockpitProvider);
    final radarState = ref.watch(radarProvider);
    final boot = cockpit.boot;

    if (boot == null || (radarState.detail == null && radarState.isLoading)) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: const [
          ErpSkeletonBox(height: 168, radius: 10),
          SizedBox(height: 12),
          ErpSkeletonBox(height: 120, radius: 10),
          SizedBox(height: 12),
          ErpSkeletonBox(height: 180, radius: 10),
        ],
      );
    }

    final masked = cockpit.privacyMask;
    final detail = radarState.detail;
    final isLocked = boot.period.isLocked;
    final events = (detail?.events ?? const <RadarEvent>[]).where((e) {
      if (radarState.filter == RadarFilter.shiftedOnly) {
        return e.isBusinessDayShifted;
      }
      return true;
    }).toList();

    final bills = boot.bills.where((b) {
      if (radarState.filter == RadarFilter.unpaidBills) {
        return !b.isSettled;
      }
      return true;
    }).toList();

    return RefreshIndicator(
      color: AppColors.positive,
      backgroundColor: AppColors.surfaceElevated,
      onRefresh: () async {
        await ref.read(cockpitProvider.notifier).loadBoot(
              month: boot.period.month,
              year: boot.period.year,
            );
        await ref.read(radarProvider.notifier).loadRadar(
              month: boot.period.month,
              year: boot.period.year,
            );
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
        children: [
          if (radarState.errorMessage != null) ...[
            ErpErrorBanner(message: radarState.errorMessage!),
            const SizedBox(height: 10),
          ],
          _RadarTrajectoryCard(
            strings: strings,
            masked: masked,
            detail: detail,
            fallbackSummary: boot.cashRadarSummary,
            periodLabel: boot.period.shortLabel,
          ),
          const SizedBox(height: 12),
          _WalletGuardCard(
            strings: strings,
            masked: masked,
            checkin: radarState.savedCheckin,
            bankHoldNeededRp: boot.walletGuard.bankHoldNeededRp,
            onCheckin: isLocked
                ? null
                : () => _openWalletCheckinSheet(
                      context,
                      strings,
                      radarState.savedCheckin,
                    ),
          ),
          const SizedBox(height: 14),
          _FilterBar(
            selected: radarState.filter,
            strings: strings,
            onChanged: (f) => ref.read(radarProvider.notifier).setFilter(f),
          ),
          const SizedBox(height: 12),
          if (radarState.filter != RadarFilter.unpaidBills && events.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Text(
                strings.cashEventsHeader,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11,
                  letterSpacing: 0.9,
                  color: AppColors.textTertiary,
                ),
              ),
            ),
            Material(
              color: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: AppColors.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < events.length; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, color: AppColors.borderSubtle),
                    _RadarEventRow(event: events[i], masked: masked),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],
          if (radarState.filter != RadarFilter.shiftedOnly && bills.isNotEmpty) ...[
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    strings.billsAndDebtLabel.toUpperCase(),
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      letterSpacing: 0.9,
                      color: AppColors.textTertiary,
                    ),
                  ),
                  Text(
                    '${boot.unpaidBillsCount} ${strings.unpaidBillsLabel.toLowerCase()}',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Material(
              color: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
                side: const BorderSide(color: AppColors.border),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                children: [
                  for (var i = 0; i < bills.length; i++) ...[
                    if (i > 0)
                      const Divider(height: 1, color: AppColors.borderSubtle),
                    _BillSettlementRow(
                      bill: bills[i],
                      masked: masked,
                      isLocked: isLocked,
                      strings: strings,
                      onSelectState: (nextState) => ref
                          .read(radarProvider.notifier)
                          .setBillSettlementState(bills[i], nextState),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _RadarTrajectoryCard extends StatelessWidget {
  final AppStrings strings;
  final bool masked;
  final CashRadarDetail? detail;
  final CashRadarSummary fallbackSummary;
  final String periodLabel;

  const _RadarTrajectoryCard({
    required this.strings,
    required this.masked,
    required this.detail,
    required this.fallbackSummary,
    required this.periodLabel,
  });

  @override
  Widget build(BuildContext context) {
    final lowestRp = detail?.lowestBalanceRp ?? fallbackSummary.lowestCashPointRp;
    final lowestDate = detail?.lowestDateIso ?? fallbackSummary.lowestCashDateIso ?? '-';
    final isTight = detail?.isTightOrDeficit ?? fallbackSummary.isTightOrDeficit;
    final endingBuffer =
        detail?.endingCashBufferRp ?? fallbackSummary.endingCashBufferRp;
    final series = detail?.dailySeries ?? const <RadarDayPoint>[];

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: isTight ? AppColors.urgency : AppColors.border,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  strings.lowestCashPointLabel.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 10,
                    letterSpacing: 0.9,
                    color: AppColors.textTertiary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                periodLabel,
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 11,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(
                child: Text(
                  IdrFormatter.formatRp(lowestRp, masked: masked),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: AppTheme.displayFigure.copyWith(
                    fontSize: 28,
                    color: isTight ? AppColors.negative : AppColors.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                lowestDate,
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 12,
                  color: AppColors.textSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 92,
            width: double.infinity,
            child: CustomPaint(
              key: const Key('radar_sparkline_canvas'),
              painter: _RadarSparklinePainter(
                points: series,
                lowestDateIso: lowestDate,
                masked: masked,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: Text(
                  strings.endingBufferLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                IdrFormatter.formatRp(endingBuffer, masked: masked),
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: endingBuffer >= 0 ? AppColors.positive : AppColors.negative,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _RadarSparklinePainter extends CustomPainter {
  final List<RadarDayPoint> points;
  final String? lowestDateIso;
  final bool masked;

  const _RadarSparklinePainter({
    required this.points,
    required this.lowestDateIso,
    required this.masked,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final bgPaint = Paint()
      ..color = AppColors.surfaceSubtle
      ..style = PaintingStyle.fill;
    canvas.drawRRect(
      RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(6)),
      bgPaint,
    );

    if (points.length < 2) {
      final flatPaint = Paint()
        ..color = AppColors.borderStrong
        ..strokeWidth = 1.5;
      final midY = size.height / 2;
      canvas.drawLine(Offset(10, midY), Offset(size.width - 10, midY), flatPaint);
      return;
    }

    const padX = 10.0;
    const padY = 14.0;
    final plotW = math.max(1.0, size.width - padX * 2);
    final plotH = math.max(1.0, size.height - padY * 2);

    var minVal = points.first.closingBalanceRp.toDouble();
    var maxVal = minVal;
    for (final p in points) {
      final v = p.closingBalanceRp.toDouble();
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
    if ((maxVal - minVal).abs() < 1) {
      maxVal += 100000;
      minVal -= 100000;
    }

    double toX(int i) => padX + (i / (points.length - 1)) * plotW;
    double toY(double val) {
      if (masked) return padY + plotH * 0.5;
      final norm = (val - minVal) / (maxVal - minVal);
      return padY + (1 - norm) * plotH;
    }

    // Subtle zero horizontal line if 0 sits inside domain
    if (!masked && minVal < 0 && maxVal > 0) {
      final zeroY = toY(0);
      final zeroPaint = Paint()
        ..color = AppColors.urgency.withValues(alpha: 0.45)
        ..strokeWidth = 1;
      canvas.drawLine(Offset(padX, zeroY), Offset(size.width - padX, zeroY), zeroPaint);
    }

    final linePath = Path();
    final fillPath = Path();
    for (var i = 0; i < points.length; i++) {
      final x = toX(i);
      final y = toY(points[i].closingBalanceRp.toDouble());
      if (i == 0) {
        linePath.moveTo(x, y);
        fillPath.moveTo(x, size.height - padY);
        fillPath.lineTo(x, y);
      } else {
        linePath.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
      if (i == points.length - 1) {
        fillPath.lineTo(x, size.height - padY);
        fillPath.close();
      }
    }

    final fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          AppColors.positive.withValues(alpha: 0.20),
          AppColors.positive.withValues(alpha: 0.0),
        ],
      ).createShader(Offset.zero & size);
    canvas.drawPath(fillPath, fillPaint);

    final strokePaint = Paint()
      ..color = AppColors.positive
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeJoin = StrokeJoin.round
      ..strokeCap = StrokeCap.round;
    canvas.drawPath(linePath, strokePaint);

    for (var i = 0; i < points.length; i++) {
      final p = points[i];
      final x = toX(i);
      final y = toY(p.closingBalanceRp.toDouble());

      if (p.isToday) {
        final dashPaint = Paint()
          ..color = AppColors.textTertiary.withValues(alpha: 0.55)
          ..strokeWidth = 1;
        for (double dy = 4; dy < size.height - 4; dy += 6) {
          canvas.drawLine(Offset(x, dy), Offset(x, math.min(dy + 3, size.height - 4)), dashPaint);
        }
        canvas.drawCircle(Offset(x, y), 4.5, Paint()..color = AppColors.positive);
        canvas.drawCircle(
          Offset(x, y),
          4.5,
          Paint()
            ..color = AppColors.canvas
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1.5,
        );
      } else if (lowestDateIso != null && p.dateIso == lowestDateIso && !masked) {
        canvas.drawCircle(Offset(x, y), 4.0, Paint()..color = AppColors.negative);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _RadarSparklinePainter oldDelegate) =>
      oldDelegate.points != points ||
      oldDelegate.lowestDateIso != lowestDateIso ||
      oldDelegate.masked != masked;
}

class _WalletGuardCard extends StatelessWidget {
  final AppStrings strings;
  final bool masked;
  final WalletGuardCheckinStatus? checkin;
  final int bankHoldNeededRp;
  final VoidCallback? onCheckin;

  const _WalletGuardCard({
    required this.strings,
    required this.masked,
    required this.checkin,
    required this.bankHoldNeededRp,
    required this.onCheckin,
  });

  @override
  Widget build(BuildContext context) {
    final guardStatus = checkin?.guardStatus;
    final Color statusColor;
    switch (guardStatus) {
      case 'OPTIMAL':
        statusColor = AppColors.positive;
        break;
      case 'WATCH':
        statusColor = AppColors.caution;
        break;
      case 'SURVIVAL_GUARD':
        statusColor = AppColors.urgency;
        break;
      default:
        statusColor = AppColors.textSecondary;
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (guardStatus != null) ...[
                  Text(
                    guardStatus,
                    style: TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      letterSpacing: 0.7,
                      color: statusColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    strings.freeSpendableLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    IdrFormatter.formatRp(
                      checkin!.freeSpendableCash,
                      masked: masked,
                    ),
                    style: AppTheme.tabularMono.copyWith(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: statusColor,
                    ),
                  ),
                ] else ...[
                  Text(
                    strings.bankHoldNeededLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    IdrFormatter.formatRp(bankHoldNeededRp, masked: masked),
                    style: AppTheme.tabularMono.copyWith(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 10),
          SizedBox(
            height: 40,
            child: OutlinedButton(
              onPressed: onCheckin,
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.textPrimary,
                side: const BorderSide(color: AppColors.borderStrong),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
                padding: const EdgeInsets.symmetric(horizontal: 12),
              ),
              child: Text(
                strings.walletCheckinAction,
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterBar extends StatelessWidget {
  final RadarFilter selected;
  final AppStrings strings;
  final ValueChanged<RadarFilter> onChanged;

  const _FilterBar({
    required this.selected,
    required this.strings,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final options = <(RadarFilter, String)>[
      (RadarFilter.all, 'All'),
      (RadarFilter.unpaidBills, strings.unpaidBillsLabel),
      (RadarFilter.shiftedOnly, 'Shifted'),
    ];

    return Wrap(
      spacing: 8,
      runSpacing: 6,
      children: [
        for (final opt in options)
          ChoiceChip(
            label: Text(opt.$2),
            selected: selected == opt.$1,
            onSelected: (_) => onChanged(opt.$1),
            selectedColor: AppColors.surfaceActive,
            backgroundColor: AppColors.surfaceSubtle,
            side: BorderSide(
              color: selected == opt.$1
                  ? AppColors.borderStrong
                  : AppColors.border,
            ),
            labelStyle: TextStyle(
              fontSize: 12,
              color: selected == opt.$1
                  ? AppColors.textPrimary
                  : AppColors.textSecondary,
            ),
          ),
      ],
    );
  }
}

class _RadarEventRow extends StatelessWidget {
  final RadarEvent event;
  final bool masked;

  const _RadarEventRow({required this.event, required this.masked});

  String _shortDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('dd MMM').format(parsed);
  }

  @override
  Widget build(BuildContext context) {
    final isInflow = event.signedAmountRp >= 0;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
      child: Row(
        children: [
          SizedBox(
            width: 54,
            child: Text(
              _shortDate(event.dateIso),
              style: AppTheme.tabularMono.copyWith(
                fontSize: 11,
                color: AppColors.textTertiary,
              ),
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        event.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ),
                    if (event.isBusinessDayShifted) ...[
                      const SizedBox(width: 6),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.caution.withValues(alpha: 0.16),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: AppColors.caution.withValues(alpha: 0.45),
                          ),
                        ),
                        child: const Text(
                          'H-1',
                          style: TextStyle(
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
                if (event.sliceLabel != null || event.isBusinessDayShifted)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      [
                        if (event.sliceLabel != null) event.sliceLabel!,
                        if (event.isBusinessDayShifted)
                          'Due ${event.nominalDateIso}',
                      ].join(' • '),
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 10,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '${isInflow ? '+' : ''}${IdrFormatter.formatRp(event.signedAmountRp, masked: masked)}',
            style: AppTheme.tabularMono.copyWith(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isInflow ? AppColors.positive : AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _BillSettlementRow extends StatelessWidget {
  final BillLineItem bill;
  final bool masked;
  final bool isLocked;
  final AppStrings strings;
  final ValueChanged<String> onSelectState;

  const _BillSettlementRow({
    required this.bill,
    required this.masked,
    required this.isLocked,
    required this.strings,
    required this.onSelectState,
  });

  @override
  Widget build(BuildContext context) {
    final current = bill.settlementState.toUpperCase();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      bill.title,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Due ${bill.dueDay} • ${bill.category}',
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        color: AppColors.textTertiary,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                IdrFormatter.formatRp(bill.amount, masked: masked),
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              _StateButton(
                label: strings.settlementPaidLabel,
                selected: current == 'PAID',
                activeColor: AppColors.positive,
                enabled: !isLocked,
                onTap: () => onSelectState('PAID'),
              ),
              const SizedBox(width: 6),
              _StateButton(
                label: strings.settlementReservedLabel,
                selected: current == 'RESERVED',
                activeColor: AppColors.caution,
                enabled: !isLocked,
                onTap: () => onSelectState('RESERVED'),
              ),
              const SizedBox(width: 6),
              _StateButton(
                label: strings.settlementUnpaidLabel,
                selected: current == 'UNPAID',
                activeColor: AppColors.textSecondary,
                enabled: !isLocked,
                onTap: () => onSelectState('UNPAID'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StateButton extends StatelessWidget {
  final String label;
  final bool selected;
  final Color activeColor;
  final bool enabled;
  final VoidCallback onTap;

  const _StateButton({
    required this.label,
    required this.selected,
    required this.activeColor,
    required this.enabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          height: 32,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: selected
                ? activeColor.withValues(alpha: 0.16)
                : AppColors.surfaceSubtle,
            borderRadius: BorderRadius.circular(6),
            border: Border.all(
              color: selected ? activeColor : AppColors.border,
            ),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 11,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
              color: selected ? activeColor : AppColors.textSecondary,
            ),
          ),
        ),
      ),
    );
  }
}
