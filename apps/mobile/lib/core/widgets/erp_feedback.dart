import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../app/theme.dart';

/// Binding-safe haptic helper so pure-Dart unit tests never fail on uninitialized ServicesBinding
/// and UI transitions/sheets never block awaiting platform channel roundtrips.
abstract final class ErpHaptics {
  static bool _canFire() {
    try {
      ServicesBinding.instance;
      return true;
    } catch (_) {
      return false;
    }
  }

  static void selection() {
    if (!_canFire()) return;
    unawaited(HapticFeedback.selectionClick().catchError((_) {}));
  }

  static void light() {
    if (!_canFire()) return;
    unawaited(HapticFeedback.lightImpact().catchError((_) {}));
  }

  static void medium() {
    if (!_canFire()) return;
    unawaited(HapticFeedback.mediumImpact().catchError((_) {}));
  }

  static void error() {
    if (!_canFire()) return;
    unawaited(HapticFeedback.vibrate().catchError((_) {}));
  }
}

/// 2px top progress strip shown during network sync or period switches without blocking the screen.
class ErpHairlineProgressBar extends StatelessWidget {
  final bool visible;

  const ErpHairlineProgressBar({super.key, required this.visible});

  @override
  Widget build(BuildContext context) {
    return AnimatedOpacity(
      opacity: visible ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 180),
      child: SizedBox(
        height: 2,
        child: visible
            ? const LinearProgressIndicator(
                minHeight: 2,
                backgroundColor: Colors.transparent,
                valueColor: AlwaysStoppedAnimation<Color>(AppColors.positive),
              )
            : const SizedBox.shrink(),
      ),
    );
  }
}

/// Dark charcoal-slate shimmer placeholder mirroring exact card geometry.
class ErpSkeletonBox extends StatefulWidget {
  final double? width;
  final double height;
  final double radius;

  const ErpSkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.radius = 6,
  });

  @override
  State<ErpSkeletonBox> createState() => _ErpSkeletonBoxState();
}

class _ErpSkeletonBoxState extends State<ErpSkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final color = Color.lerp(
          AppColors.surfaceSubtle,
          AppColors.surfaceElevated,
          _controller.value,
        );
        return Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(widget.radius),
          ),
        );
      },
    );
  }
}

class ErpErrorBanner extends StatelessWidget {
  final String message;
  final bool isWarning;

  const ErpErrorBanner({
    super.key,
    required this.message,
    this.isWarning = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isWarning ? AppColors.caution : AppColors.negative;
    final tint = isWarning ? const Color(0x22E59B2C) : const Color(0x24E06C53);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: tint,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: accent),
      ),
      child: Text(
        message,
        style: TextStyle(fontSize: 12, color: accent, height: 1.35),
      ),
    );
  }
}
