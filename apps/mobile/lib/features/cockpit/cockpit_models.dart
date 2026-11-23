class PeriodInfo {
  final int month;
  final int year;
  final String status;
  final String strategy;
  final bool skippedLockedPeriod;

  const PeriodInfo({
    required this.month,
    required this.year,
    required this.status,
    required this.strategy,
    required this.skippedLockedPeriod,
  });

  bool get isLocked => status.toUpperCase() == 'LOCKED';

  String get shortLabel {
    const names = [
      '',
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    final mName = (month >= 1 && month <= 12) ? names[month] : '$month';
    return '$mName $year';
  }

  factory PeriodInfo.fromJson(Map<String, dynamic> json) {
    return PeriodInfo(
      month: (json['month'] as num?)?.toInt() ?? 11,
      year: (json['year'] as num?)?.toInt() ?? 2026,
      status: json['status']?.toString() ?? 'DRAFT',
      strategy: json['strategy']?.toString() ?? 'EARLIEST_OPEN_ACTIVE',
      skippedLockedPeriod: json['skippedLockedPeriod'] == true,
    );
  }
}

class PacingSnapshot {
  final int periodMonth;
  final int periodYear;
  final String cycleDateLabel;
  final String cycleTemporalState;
  final int daysUntilCycleStart;
  final int daysInCycle;
  final int currentDayIndex;
  final int daysRemaining;
  final int totalOperationalBudget;
  final int totalDailySpent;
  final int remainingBudget;
  final int safeToSpendToday;
  final int paceDeltaRp;
  final String pacingStatus;
  final bool isWeekendToday;
  final double weekendMultiplier;
  final int weekdaySafeRate;
  final int weekendSafeRate;

  const PacingSnapshot({
    required this.periodMonth,
    required this.periodYear,
    required this.cycleDateLabel,
    required this.cycleTemporalState,
    required this.daysUntilCycleStart,
    required this.daysInCycle,
    required this.currentDayIndex,
    required this.daysRemaining,
    required this.totalOperationalBudget,
    required this.totalDailySpent,
    required this.remainingBudget,
    required this.safeToSpendToday,
    required this.paceDeltaRp,
    required this.pacingStatus,
    required this.isWeekendToday,
    required this.weekendMultiplier,
    required this.weekdaySafeRate,
    required this.weekendSafeRate,
  });

  bool get isPrePayday => cycleTemporalState == 'PRE_PAYDAY';
  bool get isCompleted => cycleTemporalState == 'COMPLETED';

  factory PacingSnapshot.fromJson(Map<String, dynamic> json) {
    return PacingSnapshot(
      periodMonth: (json['periodMonth'] as num?)?.toInt() ?? 11,
      periodYear: (json['periodYear'] as num?)?.toInt() ?? 2026,
      cycleDateLabel: json['cycleDateLabel']?.toString() ?? '',
      cycleTemporalState: json['cycleTemporalState']?.toString() ?? 'ACTIVE',
      daysUntilCycleStart: (json['daysUntilCycleStart'] as num?)?.toInt() ?? 0,
      daysInCycle: (json['daysInCycle'] as num?)?.toInt() ?? 30,
      currentDayIndex: (json['currentDayIndex'] as num?)?.toInt() ?? 1,
      daysRemaining: (json['daysRemaining'] as num?)?.toInt() ?? 0,
      totalOperationalBudget:
          (json['totalOperationalBudget'] as num?)?.round() ?? 0,
      totalDailySpent: (json['totalDailySpent'] as num?)?.round() ?? 0,
      remainingBudget: (json['remainingBudget'] as num?)?.round() ?? 0,
      safeToSpendToday: (json['safeToSpendToday'] as num?)?.round() ?? 0,
      paceDeltaRp: (json['paceDeltaRp'] as num?)?.round() ?? 0,
      pacingStatus: json['pacingStatus']?.toString() ?? 'ON_TRACK',
      isWeekendToday: json['isWeekendToday'] == true,
      weekendMultiplier: (json['weekendMultiplier'] as num?)?.toDouble() ?? 1.5,
      weekdaySafeRate: (json['weekdaySafeRate'] as num?)?.round() ?? 0,
      weekendSafeRate: (json['weekendSafeRate'] as num?)?.round() ?? 0,
    );
  }
}

class AllocationTierItem {
  final String key;
  final String label;
  final int targetRp;
  final int actualRp;
  final bool enabled;

  const AllocationTierItem({
    required this.key,
    required this.label,
    required this.targetRp,
    required this.actualRp,
    required this.enabled,
  });

  factory AllocationTierItem.fromJson(Map<String, dynamic> json) {
    return AllocationTierItem(
      key: json['key']?.toString() ?? '',
      label: json['label']?.toString() ?? '',
      targetRp: (json['targetRp'] as num?)?.round() ?? 0,
      actualRp: (json['actualRp'] as num?)?.round() ?? 0,
      enabled: json['enabled'] != false,
    );
  }
}

class AllocationSummary {
  final int finalTotalIncome;
  final int totalDeductions;
  final int routineBillsTotal;
  final int dailyLivingTarget;
  final int dailyLivingFunded;
  final int coreSavingsTarget;
  final int coreSavingsActual;
  final int flexibleSurplusTarget;
  final int flexibleSurplusActual;
  final int deficitUncovered;
  final List<AllocationTierItem> tiers;

  const AllocationSummary({
    required this.finalTotalIncome,
    required this.totalDeductions,
    required this.routineBillsTotal,
    required this.dailyLivingTarget,
    required this.dailyLivingFunded,
    required this.coreSavingsTarget,
    required this.coreSavingsActual,
    required this.flexibleSurplusTarget,
    required this.flexibleSurplusActual,
    required this.deficitUncovered,
    required this.tiers,
  });

  factory AllocationSummary.fromJson(Map<String, dynamic> json) {
    final rawTiers = (json['tiers'] as List?) ?? const [];
    return AllocationSummary(
      finalTotalIncome: (json['finalTotalIncome'] as num?)?.round() ?? 0,
      totalDeductions: (json['totalDeductions'] as num?)?.round() ?? 0,
      routineBillsTotal: (json['routineBillsTotal'] as num?)?.round() ?? 0,
      dailyLivingTarget: (json['dailyLivingTarget'] as num?)?.round() ?? 0,
      dailyLivingFunded: (json['dailyLivingFunded'] as num?)?.round() ?? 0,
      coreSavingsTarget: (json['coreSavingsTarget'] as num?)?.round() ?? 0,
      coreSavingsActual: (json['coreSavingsActual'] as num?)?.round() ?? 0,
      flexibleSurplusTarget:
          (json['flexibleSurplusTarget'] as num?)?.round() ?? 0,
      flexibleSurplusActual:
          (json['flexibleSurplusActual'] as num?)?.round() ?? 0,
      deficitUncovered: (json['deficitUncovered'] as num?)?.round() ?? 0,
      tiers: rawTiers
          .whereType<Map>()
          .map((e) => AllocationTierItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class WalletGuardSummary {
  final int totalDueRp;
  final int paidAmountRp;
  final int unpaidAmountRp;
  final int bankHoldNeededRp;

  const WalletGuardSummary({
    required this.totalDueRp,
    required this.paidAmountRp,
    required this.unpaidAmountRp,
    required this.bankHoldNeededRp,
  });

  factory WalletGuardSummary.fromJson(Map<String, dynamic> json) {
    final settlement = (json['settlementSummary'] as Map?) ?? const {};
    return WalletGuardSummary(
      totalDueRp: (settlement['totalDue'] as num?)?.round() ?? 0,
      paidAmountRp: (settlement['paidAmount'] as num?)?.round() ?? 0,
      unpaidAmountRp: (settlement['unpaidAmount'] as num?)?.round() ?? 0,
      bankHoldNeededRp: (settlement['bankHoldNeeded'] as num?)?.round() ?? 0,
    );
  }
}

class BillLineItem {
  final int id;
  final String title;
  final String category;
  final int amount;
  final int dueDay;
  final bool isSettled;
  final String settlementState;

  const BillLineItem({
    required this.id,
    required this.title,
    required this.category,
    required this.amount,
    required this.dueDay,
    required this.isSettled,
    required this.settlementState,
  });

  factory BillLineItem.fromJson(Map<String, dynamic> json) {
    return BillLineItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      title: json['title']?.toString() ?? 'Bill Item',
      category: json['category']?.toString() ?? 'PAYLATER',
      amount: (json['amount'] as num?)?.round() ?? 0,
      dueDay: (json['dueDay'] as num?)?.toInt() ?? 25,
      isSettled: json['isSettled'] == true,
      settlementState: json['settlementState']?.toString() ?? 'UNPAID',
    );
  }
}

class CashRadarSummary {
  final int lowestCashPointRp;
  final String? lowestCashDateIso;
  final String? lowestCashLabel;
  final bool isTightOrDeficit;
  final int endingCashBufferRp;
  final int eventCount;

  const CashRadarSummary({
    required this.lowestCashPointRp,
    this.lowestCashDateIso,
    this.lowestCashLabel,
    required this.isTightOrDeficit,
    required this.endingCashBufferRp,
    required this.eventCount,
  });

  factory CashRadarSummary.fromJson(Map<String, dynamic> json) {
    return CashRadarSummary(
      lowestCashPointRp: (json['lowestCashPointRp'] as num?)?.round() ?? 0,
      lowestCashDateIso: json['lowestCashDateIso']?.toString(),
      lowestCashLabel: json['lowestCashLabel']?.toString(),
      isTightOrDeficit: json['isTightOrDeficit'] == true,
      endingCashBufferRp: (json['endingCashBufferRp'] as num?)?.round() ?? 0,
      eventCount: (json['eventCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class MobileBootPayload {
  final PeriodInfo period;
  final PacingSnapshot pacing;
  final AllocationSummary allocationSummary;
  final WalletGuardSummary walletGuard;
  final List<BillLineItem> bills;
  final CashRadarSummary cashRadarSummary;
  final bool maskBalancesByDefault;
  final bool hasSecurityPin;
  final int biometricDevicesCount;

  const MobileBootPayload({
    required this.period,
    required this.pacing,
    required this.allocationSummary,
    required this.walletGuard,
    required this.bills,
    required this.cashRadarSummary,
    required this.maskBalancesByDefault,
    required this.hasSecurityPin,
    required this.biometricDevicesCount,
  });

  int get unpaidBillsCount => bills.where((b) => !b.isSettled).length;

  factory MobileBootPayload.fromJson(Map<String, dynamic> json) {
    final billsContainer = (json['bills'] as Map?) ?? const {};
    final rawItems = (billsContainer['items'] as List?) ?? const [];
    final display = (json['displayPreferences'] as Map?) ?? const {};
    final caps = (json['mobileCapabilities'] as Map?) ?? const {};

    return MobileBootPayload(
      period: PeriodInfo.fromJson(
        Map<String, dynamic>.from((json['period'] as Map?) ?? const {}),
      ),
      pacing: PacingSnapshot.fromJson(
        Map<String, dynamic>.from((json['pacing'] as Map?) ?? const {}),
      ),
      allocationSummary: AllocationSummary.fromJson(
        Map<String, dynamic>.from(
          (json['allocationSummary'] as Map?) ?? const {},
        ),
      ),
      walletGuard: WalletGuardSummary.fromJson(
        Map<String, dynamic>.from((json['walletGuard'] as Map?) ?? const {}),
      ),
      bills: rawItems
          .whereType<Map>()
          .map((e) => BillLineItem.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      cashRadarSummary: CashRadarSummary.fromJson(
        Map<String, dynamic>.from(
          (json['cashRadarSummary'] as Map?) ?? const {},
        ),
      ),
      maskBalancesByDefault: display['maskBalancesByDefault'] == true,
      hasSecurityPin: caps['hasSecurityPin'] == true,
      biometricDevicesCount:
          (caps['biometricDevicesCount'] as num?)?.toInt() ?? 0,
    );
  }
}

class CutoffPreviewResult {
  final int startPeriodMonth;
  final int startPeriodYear;
  final String startPeriodLabel;
  final String firstDueDateIso;
  final int cutoffDay;
  final String verdict;
  final String advice;
  final String routingSummary;
  final double dsrAfterPercent;

  const CutoffPreviewResult({
    required this.startPeriodMonth,
    required this.startPeriodYear,
    required this.startPeriodLabel,
    required this.firstDueDateIso,
    required this.cutoffDay,
    required this.verdict,
    required this.advice,
    required this.routingSummary,
    required this.dsrAfterPercent,
  });

  factory CutoffPreviewResult.fromJson(Map<String, dynamic> json) {
    return CutoffPreviewResult(
      startPeriodMonth: (json['startPeriodMonth'] as num?)?.toInt() ?? 11,
      startPeriodYear: (json['startPeriodYear'] as num?)?.toInt() ?? 2026,
      startPeriodLabel: json['startPeriodLabel']?.toString() ?? '',
      firstDueDateIso: json['firstDueDateIso']?.toString() ?? '',
      cutoffDay: (json['cutoffDay'] as num?)?.toInt() ?? 25,
      verdict: json['verdict']?.toString() ?? 'SAFE',
      advice: json['advice']?.toString() ?? '',
      routingSummary: json['routingSummary']?.toString() ?? '',
      dsrAfterPercent: (json['dsrAfterPercent'] as num?)?.toDouble() ?? 0,
    );
  }
}
