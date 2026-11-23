import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import 'auth_state.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _accountController = TextEditingController(text: 'cheeseburger');
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _pinController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _accountController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    await ref.read(authProvider.notifier).signIn(
          accountName: _accountController.text,
          username: _usernameController.text,
          password: _passwordController.text,
          securityPin: _pinController.text,
        );
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final strings = AppStrings.forLanguage(lang);
    final auth = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            ErpHairlineProgressBar(visible: auth.busy),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  _LanguageToggleGroup(
                    selected: lang,
                    onChanged: (next) {
                      ErpHaptics.selection();
                      ref.read(languageProvider.notifier).setLanguage(next);
                    },
                  ),
                ],
              ),
            ),
            Expanded(
              child: Center(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 12,
                  ),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            strings.workspaceHeader,
                            style: const TextStyle(
                              fontFamily: 'monospace',
                              fontSize: 11,
                              letterSpacing: 1.2,
                              color: AppColors.textTertiary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            strings.appName,
                            style: const TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 20),
                          TextField(
                            controller: _accountController,
                            textInputAction: TextInputAction.next,
                            decoration: InputDecoration(
                              labelText: strings.accountNameLabel,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _usernameController,
                            textInputAction: TextInputAction.next,
                            autocorrect: false,
                            decoration: InputDecoration(
                              labelText: strings.usernameLabel,
                            ),
                          ),
                          const SizedBox(height: 12),
                          TextField(
                            controller: _passwordController,
                            obscureText: _obscurePassword,
                            textInputAction: auth.requiresPin
                                ? TextInputAction.next
                                : TextInputAction.done,
                            onSubmitted: (_) {
                              if (!auth.busy) _submit();
                            },
                            decoration: InputDecoration(
                              labelText: strings.passwordLabel,
                              suffixIcon: IconButton(
                                onPressed: () => setState(
                                  () => _obscurePassword = !_obscurePassword,
                                ),
                                icon: Icon(
                                  _obscurePassword
                                      ? Icons.visibility_outlined
                                      : Icons.visibility_off_outlined,
                                  size: 18,
                                  color: AppColors.textSecondary,
                                ),
                              ),
                            ),
                          ),
                          AnimatedSize(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeOutCubic,
                            child: auth.requiresPin
                                ? Padding(
                                    padding: const EdgeInsets.only(top: 12),
                                    child: TextField(
                                      controller: _pinController,
                                      keyboardType: TextInputType.number,
                                      maxLength: 6,
                                      obscureText: true,
                                      decoration: InputDecoration(
                                        labelText: strings.securityPinLabel,
                                        counterText: '',
                                        helperText: strings.securityPinPrompt,
                                        helperMaxLines: 2,
                                      ),
                                    ),
                                  )
                                : const SizedBox.shrink(),
                          ),
                          if (auth.errorMessage != null) ...[
                            const SizedBox(height: 12),
                            ErpErrorBanner(message: auth.errorMessage!),
                          ],
                          const SizedBox(height: 18),
                          SizedBox(
                            height: 48,
                            child: ElevatedButton(
                              onPressed: auth.busy ? null : _submit,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF12332A),
                                foregroundColor: AppColors.textPrimary,
                                elevation: 0,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(6),
                                  side: const BorderSide(
                                    color: AppColors.positive,
                                  ),
                                ),
                              ),
                              child: Text(
                                auth.busy
                                    ? strings.signingInLabel
                                    : strings.signInAction,
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Divider(color: AppColors.borderSubtle),
                          const SizedBox(height: 12),
                          SizedBox(
                            height: 48,
                            child: OutlinedButton(
                              onPressed: auth.busy
                                  ? null
                                  : () => ref
                                      .read(authProvider.notifier)
                                      .signInDemoSandbox(),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.textSecondary,
                                side: const BorderSide(color: AppColors.border),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(6),
                                ),
                              ),
                              child: Text(strings.demoSandboxAction),
                            ),
                          ),
                        ],
                      ),
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

class _LanguageToggleGroup extends StatelessWidget {
  final AppLanguage selected;
  final ValueChanged<AppLanguage> onChanged;

  const _LanguageToggleGroup({
    required this.selected,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(6),
        side: const BorderSide(color: AppColors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final lang in AppLanguage.values)
            GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => onChanged(lang),
              child: Container(
                constraints: const BoxConstraints(minWidth: 48, minHeight: 44),
                alignment: Alignment.center,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                color: selected == lang
                    ? AppColors.surfaceActive
                    : Colors.transparent,
                child: Text(
                  lang.name.toUpperCase(),
                  style: TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 11,
                    fontWeight:
                        selected == lang ? FontWeight.w600 : FontWeight.w400,
                    color: selected == lang
                        ? AppColors.textPrimary
                        : AppColors.textSecondary,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
