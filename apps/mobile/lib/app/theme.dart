import 'package:material_ui/material_ui.dart';

abstract final class AppColors {
  static const Color canvas = Color(0xFF0C0E14);
  static const Color surfaceSubtle = Color(0xFF11141C);
  static const Color surface = Color(0xFF161922);
  static const Color surfaceElevated = Color(0xFF1D222E);
  static const Color surfaceActive = Color(0xFF242A38);

  static const Color borderSubtle = Color(0xFF1F2430);
  static const Color border = Color(0xFF282E3D);
  static const Color borderStrong = Color(0xFF384054);

  static const Color textPrimary = Color(0xFFF3F4F6);
  static const Color textSecondary = Color(0xFF9CA3AF);
  static const Color textTertiary = Color(0xFF6B7280);

  static const Color positive = Color(0xFF10B78D);
  static const Color negative = Color(0xFFE06C53);
  static const Color caution = Color(0xFFE59B2C);
  static const Color urgency = Color(0xFFFF3838);
}

abstract final class AppTheme {
  static const TextStyle tabularMono = TextStyle(
    fontFamily: 'monospace',
    fontFeatures: [FontFeature.tabularFigures()],
    color: AppColors.textPrimary,
  );

  static const TextStyle displayFigure = TextStyle(
    fontFamily: 'serif',
    fontSize: 34,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.6,
    color: AppColors.textPrimary,
  );

  static ThemeData dark() {
    const scheme = ColorScheme.dark(
      primary: AppColors.positive,
      onPrimary: AppColors.canvas,
      secondary: AppColors.surfaceElevated,
      onSecondary: AppColors.textPrimary,
      surface: AppColors.surface,
      onSurface: AppColors.textPrimary,
      error: AppColors.urgency,
      onError: AppColors.textPrimary,
      outline: AppColors.border,
    );

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.canvas,
      dividerColor: AppColors.borderSubtle,
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(10)),
          side: BorderSide(color: AppColors.border, width: 1),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surfaceSubtle,
        isDense: true,
        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(6)),
          borderSide: BorderSide(color: AppColors.border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(6)),
          borderSide: BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.all(Radius.circular(6)),
          borderSide: BorderSide(color: AppColors.positive),
        ),
        labelStyle: TextStyle(color: AppColors.textSecondary, fontSize: 13),
      ),
    );
  }
}
