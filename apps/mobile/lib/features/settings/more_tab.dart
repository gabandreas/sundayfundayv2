import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../cockpit/cockpit_provider.dart';

class MoreTab extends ConsumerWidget {
  const MoreTab({super.key});

  Future<void> _showSetupPinDialog(
    BuildContext context,
    WidgetRef ref,
    AppStrings strings,
  ) async {
    final pwController = TextEditingController();
    final pinController = TextEditingController();
    String? errorMsg;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (context, setState) => AlertDialog(
            backgroundColor: AppColors.surface,
            title: Text(
              strings.setupPinAction,
              style: const TextStyle(fontSize: 16, color: AppColors.textPrimary),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: pwController,
                  obscureText: true,
                  decoration: InputDecoration(labelText: strings.passwordLabel),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: pinController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  obscureText: true,
                  decoration: InputDecoration(
                    labelText: strings.securityPinLabel,
                    counterText: '',
                  ),
                ),
                if (errorMsg != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    errorMsg!,
                    style: const TextStyle(fontSize: 12, color: AppColors.negative),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(dialogCtx).pop(),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () async {
                  try {
                    await ref.read(apiClientProvider).post<Map<String, dynamic>>(
                      '/api/auth/pin/setup',
                      data: {
                        'currentPassword': pwController.text,
                        'newPin': pinController.text.trim(),
                      },
                    );
                    await ref.read(secureVaultProvider).saveHasSecurityPin(true);
                    if (dialogCtx.mounted) Navigator.of(dialogCtx).pop();
                  } catch (e) {
                    setState(() => errorMsg = e.toString());
                  }
                },
                child: const Text('Save PIN'),
              ),
            ],
          ),
        );
      },
    );
    pwController.dispose();
    pinController.dispose();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lang = ref.watch(languageProvider);
    final strings = AppStrings.forLanguage(lang);
    final auth = ref.watch(authProvider);
    final cockpit = ref.watch(cockpitProvider);

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
      children: [
        Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  strings.financialToolsTitle.toUpperCase(),
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    letterSpacing: 0.9,
                    color: AppColors.textTertiary,
                  ),
                ),
                const SizedBox(height: 6),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(
                    Icons.receipt_long_outlined,
                    size: 20,
                    color: AppColors.textSecondary,
                  ),
                  title: Text(strings.ledgerMenuTitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ErpHaptics.light();
                    context.push('/ledger');
                  },
                ),
                const Divider(height: 1, color: AppColors.borderSubtle),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(
                    Icons.savings_outlined,
                    size: 20,
                    color: AppColors.positive,
                  ),
                  title: Text(strings.savingsSectionTitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ErpHaptics.light();
                    context.push('/savings');
                  },
                ),
                const Divider(height: 1, color: AppColors.borderSubtle),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(
                    Icons.calculate_outlined,
                    size: 20,
                    color: AppColors.textSecondary,
                  ),
                  title: Text(strings.wishlistMenuTitle),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    ErpHaptics.light();
                    context.push('/wishlist');
                  },
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 14),
        Material(
          color: AppColors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
            side: const BorderSide(color: AppColors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
              Text(
                strings.securitySettingsTitle.toUpperCase(),
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 11,
                  letterSpacing: 0.9,
                  color: AppColors.textTertiary,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                auth.displayName ?? strings.appName,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textPrimary,
                ),
              ),
              if (auth.email != null) ...[
                const SizedBox(height: 2),
                Text(
                  auth.email!,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
              const SizedBox(height: 14),
              const Divider(height: 1, color: AppColors.borderSubtle),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(strings.biometricEnrollAction),
                subtitle: Text(
                  auth.biometricEnrolled ? 'Enrolled on this device' : 'Off',
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),
                trailing: const Icon(Icons.fingerprint, color: AppColors.positive),
                onTap: () => ref.read(authProvider.notifier).enrollBiometrics(),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(strings.setupPinAction),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _showSetupPinDialog(context, ref, strings),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Mask Balances'),
                value: cockpit.privacyMask,
                activeThumbColor: AppColors.positive,
                onChanged: (_) =>
                    ref.read(cockpitProvider.notifier).togglePrivacyMask(),
              ),
              const Divider(height: 1, color: AppColors.borderSubtle),
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Language',
                      style: TextStyle(fontSize: 14, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 8),
                    SegmentedButton<AppLanguage>(
                      segments: const [
                        ButtonSegment(value: AppLanguage.en, label: Text('EN')),
                        ButtonSegment(value: AppLanguage.id, label: Text('ID')),
                        ButtonSegment(value: AppLanguage.zh, label: Text('ZH')),
                      ],
                      selected: {lang},
                      onSelectionChanged: (sel) => ref
                          .read(languageProvider.notifier)
                          .setLanguage(sel.first),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          height: 48,
          child: OutlinedButton(
            onPressed: () => ref.read(authProvider.notifier).signOut(),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.negative,
              side: const BorderSide(color: AppColors.border),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
            ),
            child: Text(strings.signOutAction),
          ),
        ),
      ],
    );
  }
}
