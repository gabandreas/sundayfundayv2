class RadarEvent {
  final String id;
  final String dateIso;
  final String nominalDateIso;
  final bool isBusinessDayShifted;
  final String label;
  final String category;
  final int signedAmountRp;
  final String? sliceLabel;
  final bool isFinalSlice;
  final String? notes;
  final bool insideAllocatedPool;

  const RadarEvent({
    required this.id,
    required this.dateIso,
    required this.nominalDateIso,
    required this.isBusinessDayShifted,
    required this.label,
    required this.category,
    required this.signedAmountRp,
    this.sliceLabel,
    this.isFinalSlice = false,
    this.notes,
    this.insideAllocatedPool = false,
  });

  factory RadarEvent.fromJson(Map<String, dynamic> json) {
    final dateIso = json['dateIso']?.toString() ?? '';
    return RadarEvent(
      id: json['id']?.toString() ?? '',
      dateIso: dateIso,
      nominalDateIso: json['nominalDateIso']?.toString() ?? dateIso,
      isBusinessDayShifted: json['isBusinessDayShifted'] == true,
      label: json['label']?.toString() ?? 'Cash Event',
      category: json['category']?.toString() ?? 'OTHER',
      signedAmountRp: (json['signedAmountRp'] as num?)?.round() ?? 0,
      sliceLabel: json['sliceLabel']?.toString(),
      isFinalSlice: json['isFinalSlice'] == true,
      notes: json['notes']?.toString(),
      insideAllocatedPool: json['insideAllocatedPool'] == true,
    );
  }
}

class RadarDayPoint {
  final String dateIso;
  final int dayOfMonth;
  final bool inActiveCycle;
  final bool isToday;
  final bool isWeekend;
  final int openingBalanceRp;
  final int inflowsRp;
  final int outflowsRp;
  final int closingBalanceRp;

  const RadarDayPoint({
    required this.dateIso,
    required this.dayOfMonth,
    required this.inActiveCycle,
    required this.isToday,
    required this.isWeekend,
    required this.openingBalanceRp,
    required this.inflowsRp,
    required this.outflowsRp,
    required this.closingBalanceRp,
  });

  factory RadarDayPoint.fromJson(Map<String, dynamic> json) {
    return RadarDayPoint(
      dateIso: json['dateIso']?.toString() ?? '',
      dayOfMonth: (json['dayOfMonth'] as num?)?.toInt() ?? 1,
      inActiveCycle: json['inActiveCycle'] != false,
      isToday: json['isToday'] == true,
      isWeekend: json['isWeekend'] == true,
      openingBalanceRp: (json['openingBalanceRp'] as num?)?.round() ?? 0,
      inflowsRp: (json['inflowsRp'] as num?)?.round() ?? 0,
      outflowsRp: (json['outflowsRp'] as num?)?.round() ?? 0,
      closingBalanceRp: (json['closingBalanceRp'] as num?)?.round() ?? 0,
    );
  }
}

class CashRadarDetail {
  final int periodMonth;
  final int periodYear;
  final String cycleStartIso;
  final String cycleEndIso;
  final String nextPaydayIso;
  final int paydayInflowsRp;
  final int totalScheduledBillsRp;
  final int endingCashBufferRp;
  final int lowestBalanceRp;
  final String? lowestDateIso;
  final String? lowestContextLabel;
  final bool isTightOrDeficit;
  final List<RadarEvent> events;
  final List<RadarDayPoint> dailySeries;

  const CashRadarDetail({
    required this.periodMonth,
    required this.periodYear,
    required this.cycleStartIso,
    required this.cycleEndIso,
    required this.nextPaydayIso,
    required this.paydayInflowsRp,
    required this.totalScheduledBillsRp,
    required this.endingCashBufferRp,
    required this.lowestBalanceRp,
    this.lowestDateIso,
    this.lowestContextLabel,
    required this.isTightOrDeficit,
    required this.events,
    required this.dailySeries,
  });

  factory CashRadarDetail.fromJson(Map<String, dynamic> json) {
    final trough = (json['lowestCashPoint'] as Map?) ?? const {};
    final rawEvents = (json['events'] as List?) ?? const [];
    final rawSeries = (json['dailySeries'] as List?) ?? const [];
    return CashRadarDetail(
      periodMonth: (json['periodMonth'] as num?)?.toInt() ?? 11,
      periodYear: (json['periodYear'] as num?)?.toInt() ?? 2026,
      cycleStartIso: json['cycleStartIso']?.toString() ?? '',
      cycleEndIso: json['cycleEndIso']?.toString() ?? '',
      nextPaydayIso: json['nextPaydayIso']?.toString() ?? '',
      paydayInflowsRp: (json['paydayInflowsRp'] as num?)?.round() ?? 0,
      totalScheduledBillsRp: (json['totalScheduledBillsRp'] as num?)?.round() ?? 0,
      endingCashBufferRp: (json['endingCashBufferRp'] as num?)?.round() ?? 0,
      lowestBalanceRp: (trough['balanceRp'] as num?)?.round() ?? 0,
      lowestDateIso: trough['dateIso']?.toString(),
      lowestContextLabel: trough['contextLabel']?.toString(),
      isTightOrDeficit: trough['isTightOrDeficit'] == true,
      events: rawEvents
          .whereType<Map>()
          .map((e) => RadarEvent.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
      dailySeries: rawSeries
          .whereType<Map>()
          .map((e) => RadarDayPoint.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class WalletGuardCheckinStatus {
  final int actualWalletBalance;
  final int reservedBillsTotal;
  final int freeSpendableCash;
  final String guardStatus;
  final String checkedInAt;
  final String? note;

  const WalletGuardCheckinStatus({
    required this.actualWalletBalance,
    required this.reservedBillsTotal,
    required this.freeSpendableCash,
    required this.guardStatus,
    required this.checkedInAt,
    this.note,
  });

  factory WalletGuardCheckinStatus.fromJson(Map<String, dynamic> json) {
    return WalletGuardCheckinStatus(
      actualWalletBalance: (json['actualWalletBalance'] as num?)?.round() ?? 0,
      reservedBillsTotal: (json['reservedBillsTotal'] as num?)?.round() ?? 0,
      freeSpendableCash: (json['freeSpendableCash'] as num?)?.round() ?? 0,
      guardStatus: json['guardStatus']?.toString() ?? 'OPTIMAL',
      checkedInAt: json['checkedInAt']?.toString() ?? '',
      note: json['note']?.toString(),
    );
  }
}
