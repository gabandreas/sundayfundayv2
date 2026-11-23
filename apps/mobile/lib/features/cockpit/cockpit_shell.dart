import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';
import '../../core/l10n/app_strings.dart';
import '../../core/widgets/erp_feedback.dart';
import '../auth/auth_state.dart';
import '../bills_radar/radar_provider.dart';
import '../bills_radar/radar_tab.dart';
import '../marquee/marquee_tab.dart';
import '../quick_log/quick_log_sheet.dart';
import '../settings/more_tab.dart';
import 'cockpit_provider.dart';
import 'cockpit_tab.dart';

class CockpitShell extends ConsumerStatefulWidget {
  const CockpitShell({super.key});

  @override
  ConsumerState<CockpitShell> createState() => _CockpitShellState();
}

class _CockpitShellState extends ConsumerState<CockpitShell> {
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      final cockpit = ref.read(cockpitProvider);
      if (cockpit.boot == null && !cockpit.isInitialLoading) {
        ref.read(cockpitProvider.notifier).loadBoot();
      }
    });
  }

  Future<void> _openQuickLog() async {
    ErpHaptics.light();
    if (!mounted) return;
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(14)),
        side: BorderSide(color: AppColors.border),
      ),
      builder: (_) => const QuickLogSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final strings = AppStrings.forLanguage(ref.watch(languageProvider));
    final cockpit = ref.watch(cockpitProvider);
    final radar = ref.watch(radarProvider);

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.canvas,
        surfaceTintColor: Colors.transparent,
        title: Text(
          strings.appName,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(2),
          child: ErpHairlineProgressBar(
            visible: cockpit.isSyncing || radar.isLoading,
          ),
        ),
        actions: [
          IconButton(
            onPressed: () =>
                ref.read(cockpitProvider.notifier).togglePrivacyMask(),
            icon: Icon(
              cockpit.privacyMask
                  ? Icons.visibility_off_outlined
                  : Icons.visibility_outlined,
              size: 19,
            ),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            tooltip: 'Mask Balances',
          ),
          IconButton(
            onPressed: () => ref.read(authProvider.notifier).signOut(),
            icon: const Icon(Icons.logout, size: 19),
            constraints: const BoxConstraints(minWidth: 48, minHeight: 48),
            tooltip: strings.signOutAction,
          ),
        ],
      ),
      body: SafeArea(
        child: IndexedStack(
          index: _tabIndex,
          children: [
            CockpitTab(onOpenRadarTab: () => setState(() => _tabIndex = 1)),
            const RadarTab(),
            const MarqueeTab(),
            const MoreTab(),
          ],
        ),
      ),
      floatingActionButton: (_tabIndex == 0 || _tabIndex == 1)
          ? FloatingActionButton(
              key: const Key('quick_log_fab'),
              backgroundColor: const Color(0xFF12332A),
              foregroundColor: AppColors.positive,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
                side: const BorderSide(color: AppColors.positive),
              ),
              onPressed: _openQuickLog,
              child: const Icon(Icons.add),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: NavigationBar(
        backgroundColor: AppColors.surfaceSubtle,
        indicatorColor: AppColors.surfaceActive,
        selectedIndex: _tabIndex,
        onDestinationSelected: (idx) {
          ErpHaptics.selection();
          setState(() => _tabIndex = idx);
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.space_dashboard_outlined),
            label: strings.cockpitTabLabel,
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
