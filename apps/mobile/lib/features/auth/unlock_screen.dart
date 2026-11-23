import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import 'auth_state.dart';

class UnlockScreen extends ConsumerStatefulWidget {
  const UnlockScreen({super.key});

  @override
  ConsumerState<UnlockScreen> createState() => _UnlockScreenState();
}

class _UnlockScreenState extends ConsumerState<UnlockScreen> {
  String _pin = '';

  static String _maskEmail(String? raw) {
    if (raw == null || !raw.contains('@')) return '';
    final parts = raw.split('@');
    final local = parts.first;
    final prefix = local.length <= 2 ? local : local.substring(0, 2);
    return '$prefix***@${parts.last}';
  }

  Future<void> _appendDigit(String digit) async {
    final auth = ref.read(authProvider);
    if (auth.busy || _pin.length >= 6) return;
    ErpHaptics.selection();
    final next = '$_pin$digit';
    setState(() => _pin = next);

    if (next.length == 6) {
      final ok = await ref.read(authProvider.notifier).unlockWithPin(next);
      if (!ok && mounted) {
        setState(() => _pin = '');
      }
    }
  }

  Future<void> _backspace() async {
    if (_pin.isEmpty || ref.read(authProvider).busy) return;
    ErpHaptics.selection();
    setState(() => _pin = _pin.substring(0, _pin.length - 1));
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final auth = ref.watch(authProvider);
    final masked = _maskEmail(auth.email);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            ErpHairlineProgressBar(visible: auth.busy),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 16,
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 360),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          strings.unlockTitle.toUpperCase(),
                          style: const TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 11,
                            letterSpacing: 1.1,
                            color: AppColors.textTertiary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          auth.displayName ?? strings.appName,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w600,
                            color: AppColors.textPrimary,
                          ),
                        ),
                        if (masked.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Text(
                            masked,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                        const SizedBox(height: 20),
                        Text(
                          strings.enterPinPrompt,
                          style: const TextStyle(
                            fontSize: 13,
                            color: AppColors.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(6, (idx) {
                            final filled = idx < _pin.length;
                            return Container(
                              width: 12,
                              height: 12,
                              margin: const EdgeInsets.symmetric(horizontal: 7),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: filled
                                    ? AppColors.positive
                                    : Colors.transparent,
                                border: Border.all(
                                  color: filled
                                      ? AppColors.positive
                                      : AppColors.borderStrong,
                                  width: 1.5,
                                ),
                              ),
                            );
                          }),
                        ),
                        if (auth.errorMessage != null) ...[
                          const SizedBox(height: 16),
                          ErpErrorBanner(message: auth.errorMessage!),
                        ],
                        const SizedBox(height: 24),
                        _PinKeypad(
                          onDigit: _appendDigit,
                          onBackspace: _backspace,
                          onBiometrics: auth.biometricEnrolled
                              ? () => ref
                                  .read(authProvider.notifier)
                                  .unlockWithBiometrics(strings.biometricReason)
                              : null,
                        ),
                        const SizedBox(height: 16),
                        if (auth.biometricEnrolled) ...[
                          SizedBox(
                            height: 48,
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: auth.busy
                                  ? null
                                  : () => ref
                                      .read(authProvider.notifier)
                                      .unlockWithBiometrics(
                                        strings.biometricReason,
                                      ),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.textPrimary,
                                side: const BorderSide(
                                  color: AppColors.positive,
                                ),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                              icon: const Icon(Icons.fingerprint, size: 18),
                              label: Text(strings.useBiometricsAction),
                            ),
                          ),
                          const SizedBox(height: 8),
                        ],
                        SizedBox(
                          height: 48,
                          child: TextButton(
                            onPressed: auth.busy
                                ? null
                                : () => ref
                                    .read(authProvider.notifier)
                                    .signOut(),
                            child: Text(
                              strings.switchAccountAction,
                              style: const TextStyle(
                                fontSize: 13,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _PinKeypad extends StatelessWidget {
  final ValueChanged<String> onDigit;
  final VoidCallback onBackspace;
  final VoidCallback? onBiometrics;

  const _PinKeypad({
    required this.onDigit,
    required this.onBackspace,
    this.onBiometrics,
  });

  @override
  Widget build(BuildContext context) {
    Widget keyButton(String label, VoidCallback onTap) {
      return SizedBox(
        width: 68,
        height: 56,
        child: Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: AppColors.border),
          ),
          child: InkWell(
            borderRadius: BorderRadius.circular(10),
            onTap: onTap,
            child: Center(
              child: Text(
                label,
                style: AppTheme.tabularMono.copyWith(
                  fontSize: 20,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      );
    }

    Widget actionKey({required Widget child, VoidCallback? onTap}) {
      return SizedBox(
        width: 68,
        height: 56,
        child: onTap == null
            ? const SizedBox.shrink()
            : Material(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(10),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: onTap,
                  child: Center(child: child),
                ),
              ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in const [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ]) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              keyButton(row[0], () => onDigit(row[0])),
              const SizedBox(width: 14),
              keyButton(row[1], () => onDigit(row[1])),
              const SizedBox(width: 14),
              keyButton(row[2], () => onDigit(row[2])),
            ],
          ),
          const SizedBox(height: 12),
        ],
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            actionKey(
              onTap: onBiometrics,
              child: const Icon(
                Icons.fingerprint,
                size: 24,
                color: AppColors.positive,
              ),
            ),
            const SizedBox(width: 14),
            keyButton('0', () => onDigit('0')),
            const SizedBox(width: 14),
            actionKey(
              onTap: onBackspace,
              child: const Icon(
                Icons.backspace_outlined,
                size: 20,
                color: AppColors.textSecondary,
              ),
            ),
          ],
        ),
      ],
    );
  }
}
