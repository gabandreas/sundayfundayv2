import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/auth/auth_state.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/unlock_screen.dart';
import '../features/cockpit/cockpit_shell.dart';
import '../features/submodules/ledger_screen.dart';
import '../features/submodules/savings_screen.dart';
import '../features/submodules/wishlist_screen.dart';

CustomTransitionPage<T> _fadeTransitionPage<T>(
  GoRouterState state,
  Widget child,
) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 160),
    transitionsBuilder: (context, animation, secondaryAnimation, child) =>
        FadeTransition(opacity: animation, child: child),
  );
}

CustomTransitionPage<T> _slideTransitionPage<T>(
  GoRouterState state,
  Widget child,
) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 220),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final tween = Tween<Offset>(
        begin: const Offset(0.08, 0),
        end: Offset.zero,
      ).chain(CurveTween(curve: Curves.easeOutCubic));
      return FadeTransition(
        opacity: animation,
        child: SlideTransition(position: animation.drive(tween), child: child),
      );
    },
  );
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final auth = ref.watch(authProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final loc = state.matchedLocation;
      switch (auth.status) {
        case AuthStatus.unauthenticated:
          return loc == '/login' ? null : '/login';
        case AuthStatus.locked:
          return loc == '/unlock' ? null : '/unlock';
        case AuthStatus.authenticated:
          if (loc == '/login' || loc == '/unlock') {
            return '/cockpit';
          }
          return null;
      }
    },
    routes: [
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) =>
            _fadeTransitionPage(state, const LoginScreen()),
      ),
      GoRoute(
        path: '/unlock',
        pageBuilder: (context, state) =>
            _fadeTransitionPage(state, const UnlockScreen()),
      ),
      GoRoute(
        path: '/cockpit',
        pageBuilder: (context, state) =>
            _fadeTransitionPage(state, const CockpitShell()),
      ),
      GoRoute(
        path: '/ledger',
        pageBuilder: (context, state) =>
            _slideTransitionPage(state, const LedgerScreen()),
      ),
      GoRoute(
        path: '/savings',
        pageBuilder: (context, state) =>
            _slideTransitionPage(state, const SavingsScreen()),
      ),
      GoRoute(
        path: '/wishlist',
        pageBuilder: (context, state) =>
            _slideTransitionPage(state, const WishlistScreen()),
      ),
    ],
  );
});
