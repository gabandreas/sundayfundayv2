abstract final class IdrFormatter {
  static final RegExp _thousandsRegex = RegExp(r'\B(?=(\d{3})+(?!\d))');

  /// Formats a Rupiah integer/number for display only (never calculates math).
  static String formatRp(num amount, {bool masked = false}) {
    if (masked) return 'Rp •••••••';
    final rounded = amount.round();
    final isNegative = rounded < 0;
    final absDigits = rounded.abs().toString();
    final grouped = absDigits.replaceAllMapped(_thousandsRegex, (_) => '.');
    return isNegative ? '-Rp $grouped' : 'Rp $grouped';
  }
}
