import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:sundayfunday_mobile/app/theme.dart';
import 'package:sundayfunday_mobile/core/formatters/idr_formatter.dart';

void main() {
  group('AppTheme & Color Tokens', () {
    test('matches web Linear/Ramp/Mercury dark charcoal-slate palette', () {
      expect(AppColors.canvas, const Color(0xFF0C0E14));
      expect(AppColors.surface, const Color(0xFF161922));
      expect(AppColors.surfaceElevated, const Color(0xFF1D222E));
      expect(AppColors.border, const Color(0xFF282E3D));
      expect(AppColors.textPrimary, const Color(0xFFF3F4F6));
      expect(AppColors.positive, const Color(0xFF10B78D));
      expect(AppColors.negative, const Color(0xFFE06C53));
      expect(AppColors.caution, const Color(0xFFE59B2C));
      expect(AppColors.urgency, const Color(0xFFFF3838));
    });

    test('builds dark theme with crisp slate scaffold and borderless bloat removal', () {
      final theme = AppTheme.dark();
      expect(theme.brightness, Brightness.dark);
      expect(theme.scaffoldBackgroundColor, AppColors.canvas);
    });
  });

  group('IdrFormatter', () {
    test('formats positive, zero, negative, and masked IDR amounts cleanly', () {
      expect(IdrFormatter.formatRp(0), 'Rp 0');
      expect(IdrFormatter.formatRp(750000), 'Rp 750.000');
      expect(IdrFormatter.formatRp(-83341), '-Rp 83.341');
      expect(IdrFormatter.formatRp(5904000), 'Rp 5.904.000');
      expect(IdrFormatter.formatRp(750000, masked: true), 'Rp •••••••');
    });
  });
}
