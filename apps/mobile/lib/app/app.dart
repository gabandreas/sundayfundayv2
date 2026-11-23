import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../features/auth/auth_state.dart';
import 'router.dart';
import 'theme.dart';

class SundayFundayApp extends ConsumerStatefulWidget {
  const SundayFundayApp({super.key});

  @override
  ConsumerState<SundayFundayApp> createState() => _SundayFundayAppState();
}

class _SundayFundayAppState extends ConsumerState<SundayFundayApp>
    with WidgetsBindingObserver {
  static const Duration _backgroundLockGrace = Duration(seconds: 45);
  DateTime? _pausedAt;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    Future.microtask(() async {
      await ref.read(languageProvider.notifier).loadSavedLanguage();
      await ref.read(authProvider.notifier).bootstrapSession();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive) {
      _pausedAt ??= DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      final paused = _pausedAt;
      _pausedAt = null;
      if (paused != null &&
          DateTime.now().difference(paused) >= _backgroundLockGrace) {
        ref.read(authProvider.notifier).lockIfEnrolled();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'Sunday Funday',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.dark(),
      routerConfig: router,
    );
  }
}
