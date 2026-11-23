import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/auth/auth_state.dart';
import '../features/auth/login_screen.dart';
import '../features/cockpit/cockpit_shell.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isAuthed = auth.status == AuthStatus.authenticated;
      final onLogin = state.matchedLocation == '/login';
      if (!isAuthed && !onLogin) return '/login';
      if (isAuthed && onLogin) return '/cockpit';
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/cockpit',
        builder: (context, state) => const CockpitShell(),
      ),
    ],
  );
});
