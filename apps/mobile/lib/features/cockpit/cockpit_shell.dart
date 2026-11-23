import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/formatters/idr_formatter.dart';
import '../../core/l10n/app_strings.dart';
import '../auth/auth_state.dart';

class CockpitShell extends ConsumerStatefulWidget {
  const CockpitShell({super.key});

  @override
  ConsumerState<CockpitShell> createState() => _CockpitShellState();
}

class _CockpitShellState extends ConsumerState<CockpitShell> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        title: Text(
          strings.appName,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        actions: [
          IconButton(
            onPressed: () => ref.read(authProvider.notifier).signOut(),
            icon: const Icon(Icons.logout, size: 18),
            tooltip: 'Sign out',
          ),
        ],
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
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
                      strings.safeToSpendLabel.toUpperCase(),
                      style: const TextStyle(
                        fontFamily: 'monospace',
                        fontSize: 11,
                        letterSpacing: 0.9,
                        color: AppColors.textTertiary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      IdrFormatter.formatRp(0),
                      style: AppTheme.displayFigure,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      auth.email ?? 'Pocket Cockpit ready for Phase 3.',
                      style: const TextStyle(
                        fontSize: 12,
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        backgroundColor: AppColors.surfaceSubtle,
        indicatorColor: AppColors.surfaceActive,
        selectedIndex: _tabIndex,
        onDestinationSelected: (idx) => setState(() => _tabIndex = idx),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.space_dashboard_outlined),
            label: 'Cockpit',
          ),
          NavigationDestination(
            icon: const Icon(Icons.calendar_today_outlined),
            label: strings.billsTabLabel,
          ),
          NavigationDestination(
            icon: const Icon(Icons.chat_bubble_outline),
            label: strings.marqueeTabLabel,
          ),
          NavigationDestination(
            icon: const Icon(Icons.tune_outlined),
            label: strings.settingsTabLabel,
          ),
        ],
      ),
    );
  }
}
