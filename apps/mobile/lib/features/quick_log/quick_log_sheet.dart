import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:uuid/uuid.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_models.dart';
import '../cockpit/cockpit_provider.dart';

class QuickLogSheet extends ConsumerStatefulWidget {
  const QuickLogSheet({super.key});

  @override
  ConsumerState<QuickLogSheet> createState() => _QuickLogSheetState();
}

class _QuickLogSheetState extends ConsumerState<QuickLogSheet> {
  final _labelController = TextEditingController();
  final _amountController = TextEditingController();

  String _instrument = 'CASH'; // 'CASH' | 'PAYLATER' | 'CC' | 'INCOME'
  int _tenorMonths = 1;
  bool _holdPastCutoff = false;
  bool _submitting = false;
  bool _savedSuccess = false;
  CutoffPreviewResult? _cutoffPreview;
  Timer? _debounce;

  // Preserved across retries of the same sheet submission to guarantee zero double-charges
  late String _draftIdempotencyKey = 'mob_tx_${const Uuid().v4()}';

  @override
  void dispose() {
    _debounce?.cancel();
    _labelController.dispose();
    _amountController.dispose();
    super.dispose();
  }

  int get _parsedAmountRp {
    final digits = _amountController.text.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(digits) ?? 0;
  }

  void _scheduleSimulation() {
    _debounce?.cancel();
    if (_instrument != 'PAYLATER' && _instrument != 'CC') {
      setState(() => _cutoffPreview = null);
      return;
    }
    final amount = _parsedAmountRp;
    if (amount <= 0) {
      setState(() => _cutoffPreview = null);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 250), () async {
      final apiInstrument =
          _instrument == 'PAYLATER' ? 'SPAYLATER' : 'CREDIT_CARD';
      final result = await ref.read(cockpitProvider.notifier).simulateCutoff(
            instrument: apiInstrument,
            amountRp: amount,
            tenorMonths: _tenorMonths,
            holdPastCutoff: _holdPastCutoff,
          );
      if (mounted) {
        setState(() => _cutoffPreview = result);
      }
    });
  }

  Future<void> _submit() async {
    final label = _labelController.text.trim();
    final amount = _parsedAmountRp;
    if (label.isEmpty || amount <= 0 || _submitting) return;

    setState(() => _submitting = true);
    final isIncome = _instrument == 'INCOME';
    final ok = await ref.read(cockpitProvider.notifier).submitQuickTransaction(
          label: label,
          amountRp: amount,
          paymentMethod: isIncome ? 'CASH' : _instrument,
          type: isIncome ? 'INCOME' : 'DEDUCTION',
          tenorMonths: _tenorMonths,
          holdPastCutoff: _holdPastCutoff,
          idempotencyKey: _draftIdempotencyKey,
        );

    if (!mounted) return;
    if (ok) {
      setState(() {
        _submitting = false;
        _savedSuccess = true;
      });
      await Future<void>.delayed(const Duration(milliseconds: 420));
      if (mounted) Navigator.of(context).pop(true);
    } else {
      // Regenerate only after user alters form; keep key identical on network retry
      setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final cockpit = ref.watch(cockpitProvider);
    final isLocked = cockpit.boot?.period.isLocked ?? false;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.borderStrong,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              strings.quickLogTitle,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 14),
            if (isLocked) ...[
              ErpErrorBanner(
                message: strings.lockedReadOnlyNotice,
                isWarning: true,
              ),
              const SizedBox(height: 14),
            ],
            _InstrumentSegment(
              selected: _instrument,
              strings: strings,
              onSelect: (next) {
                ErpHaptics.selection();
                setState(() {
                  _instrument = next;
                  _draftIdempotencyKey = 'mob_tx_${const Uuid().v4()}';
                });
                _scheduleSimulation();
              },
            ),
            const SizedBox(height: 14),
            TextField(
              controller: _labelController,
              enabled: !isLocked && !_submitting,
              textInputAction: TextInputAction.next,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(
                labelText: strings.itemLabelPlaceholder,
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _amountController,
              enabled: !isLocked && !_submitting,
              keyboardType: TextInputType.number,
              onChanged: (_) {
                _draftIdempotencyKey = 'mob_tx_${const Uuid().v4()}';
                setState(() {});
                _scheduleSimulation();
              },
              style: AppTheme.tabularMono.copyWith(fontSize: 16),
              decoration: InputDecoration(labelText: strings.amountLabel),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                for (final delta in const [25000, 50000, 100000])
                  Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: ActionChip(
                      backgroundColor: AppColors.surfaceElevated,
                      side: const BorderSide(color: AppColors.border),
                      label: Text(
                        '+${delta ~/ 1000}k',
                        style: AppTheme.tabularMono.copyWith(fontSize: 12),
                      ),
                      onPressed: isLocked || _submitting
                          ? null
                          : () {
                              final nextVal = _parsedAmountRp + delta;
                              _amountController.text = nextVal.toString();
                              setState(() {});
                              _scheduleSimulation();
                            },
                    ),
                  ),
              ],
            ),
            if (_instrument == 'PAYLATER' || _instrument == 'CC') ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  for (final t in const [1, 3, 6])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text('${t}x'),
                        selected: _tenorMonths == t,
                        onSelected: (_) {
                          setState(() => _tenorMonths = t);
                          _scheduleSimulation();
                        },
                      ),
                    ),
                  const Spacer(),
                  Text(
                    'Hold Cutoff',
                    style: const TextStyle(
                      fontSize: 12,
                      color: AppColors.textSecondary,
                    ),
                  ),
                  Switch(
                    value: _holdPastCutoff,
                    activeThumbColor: AppColors.positive,
                    onChanged: (v) {
                      setState(() => _holdPastCutoff = v);
                      _scheduleSimulation();
                    },
                  ),
                ],
              ),
              if (_cutoffPreview != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.surfaceSubtle,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: _cutoffPreview!.verdict == 'OVER_LIMIT'
                          ? AppColors.negative
                          : AppColors.positive,
                    ),
                  ),
                  child: Text(
                    '${_cutoffPreview!.routingSummary} (${IdrFormatter.formatRp(_parsedAmountRp)})',
                    style: AppTheme.tabularMono.copyWith(
                      fontSize: 12,
                      color: _cutoffPreview!.verdict == 'OVER_LIMIT'
                          ? AppColors.negative
                          : AppColors.positive,
                    ),
                  ),
                ),
              ],
            ],
            const SizedBox(height: 18),
            SizedBox(
              height: 48,
              child: ElevatedButton(
                onPressed: isLocked ||
                        _submitting ||
                        _savedSuccess ||
                        _labelController.text.trim().isEmpty ||
                        _parsedAmountRp <= 0
                    ? null
                    : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF12332A),
                  foregroundColor: AppColors.textPrimary,
                  elevation: 0,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                    side: const BorderSide(color: AppColors.positive),
                  ),
                ),
                child: _savedSuccess
                    ? const Icon(Icons.check, color: AppColors.positive)
                    : _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.positive,
                            ),
                          )
                        : Text(strings.saveTransactionAction),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InstrumentSegment extends StatelessWidget {
  final String selected;
  final AppStrings strings;
  final ValueChanged<String> onSelect;

  const _InstrumentSegment({
    required this.selected,
    required this.strings,
    required this.onSelect,
  });

  @override
  Widget build(BuildContext context) {
    final options = <(String, String)>[
      ('CASH', strings.livingCashLabel),
      ('PAYLATER', 'SPayLater'),
      ('CC', 'Credit Card'),
      ('INCOME', strings.incomeLabel),
    ];

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceSubtle,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          for (final item in options)
            Expanded(
              child: InkWell(
                onTap: () => onSelect(item.$1),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  constraints: const BoxConstraints(minHeight: 40),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: selected == item.$1
                        ? AppColors.surfaceActive
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    item.$2,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: selected == item.$1
                          ? FontWeight.w600
                          : FontWeight.w400,
                      color: selected == item.$1
                          ? AppColors.textPrimary
                          : AppColors.textSecondary,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
