class LedgerTransactionItem {
  final int id;
  final String dateIso;
  final String label;
  final int amountRp;
  final String type;
  final String sourceType;
  final String? paymentMethod;

  const LedgerTransactionItem({
    required this.id,
    required this.dateIso,
    required this.label,
    required this.amountRp,
    required this.type,
    required this.sourceType,
    this.paymentMethod,
  });

  bool get isIncome => type.toUpperCase() == 'INCOME';

  factory LedgerTransactionItem.fromJson(Map<String, dynamic> json) {
    return LedgerTransactionItem(
      id: (json['id'] as num?)?.toInt() ?? 0,
      dateIso: json['date']?.toString() ?? '',
      label: json['label']?.toString() ?? 'Entry',
      amountRp: (json['amount'] as num?)?.round() ?? 0,
      type: json['type']?.toString() ?? 'DEDUCTION',
      sourceType: json['sourceType']?.toString() ?? 'MANUAL',
      paymentMethod: json['paymentMethod']?.toString(),
    );
  }
}

class SavingsGoalModel {
  final int id;
  final String name;
  final int targetAmountRp;
  final int allocatedAmountRp;
  final double progressPercent;
  final int remainingNeededRp;
  final bool isCompleted;

  const SavingsGoalModel({
    required this.id,
    required this.name,
    required this.targetAmountRp,
    required this.allocatedAmountRp,
    required this.progressPercent,
    required this.remainingNeededRp,
    required this.isCompleted,
  });

  factory SavingsGoalModel.fromJson(Map<String, dynamic> json) {
    return SavingsGoalModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? 'Savings Goal',
      targetAmountRp: (json['targetAmount'] as num?)?.round() ?? 0,
      allocatedAmountRp: (json['currentAllocatedAmount'] as num?)?.round() ?? 0,
      progressPercent: (json['progressPercent'] as num?)?.toDouble() ?? 0,
      remainingNeededRp: (json['remainingNeeded'] as num?)?.round() ?? 0,
      isCompleted: json['isCompleted'] == true,
    );
  }
}

class SavingsOverviewModel {
  final int totalBalanceRp;
  final int liquidCashRp;
  final int investmentRdpuRp;
  final double liquidSharePercent;
  final double rdpuSharePercent;
  final int avgMonthlySavingsRp;
  final double avgSavingsRatePercent;
  final List<SavingsGoalModel> goals;

  const SavingsOverviewModel({
    required this.totalBalanceRp,
    required this.liquidCashRp,
    required this.investmentRdpuRp,
    required this.liquidSharePercent,
    required this.rdpuSharePercent,
    required this.avgMonthlySavingsRp,
    required this.avgSavingsRatePercent,
    required this.goals,
  });

  factory SavingsOverviewModel.fromJson(Map<String, dynamic> json) {
    final kpi = (json['kpi'] as Map?) ?? const {};
    final rawGoals = (json['goals'] as List?) ?? const [];
    return SavingsOverviewModel(
      totalBalanceRp: (kpi['totalVaultBalance'] as num?)?.round() ?? 0,
      liquidCashRp: (kpi['liquidCashBalance'] as num?)?.round() ?? 0,
      investmentRdpuRp: (kpi['investmentRdpuBalance'] as num?)?.round() ?? 0,
      liquidSharePercent: (kpi['liquidSharePercent'] as num?)?.toDouble() ?? 100,
      rdpuSharePercent: (kpi['rdpuSharePercent'] as num?)?.toDouble() ?? 0,
      avgMonthlySavingsRp: (kpi['avgMonthlySavingsP1'] as num?)?.round() ?? 0,
      avgSavingsRatePercent:
          (kpi['averageMonthlySavingsRatePercent'] as num?)?.toDouble() ?? 0,
      goals: rawGoals
          .whereType<Map>()
          .map((e) => SavingsGoalModel.fromJson(Map<String, dynamic>.from(e)))
          .toList(),
    );
  }
}

class WishlistItemModel {
  final int id;
  final String name;
  final int priceRp;
  final String fundingType;
  final String status;
  final int? tenor;
  final int priority;

  const WishlistItemModel({
    required this.id,
    required this.name,
    required this.priceRp,
    required this.fundingType,
    required this.status,
    this.tenor,
    required this.priority,
  });

  factory WishlistItemModel.fromJson(Map<String, dynamic> json) {
    return WishlistItemModel(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name']?.toString() ?? 'Item',
      priceRp: (json['price'] as num?)?.round() ?? 0,
      fundingType: json['fundingType']?.toString() ?? 'CASH',
      status: json['status']?.toString() ?? 'PLANNING',
      tenor: (json['tenor'] as num?)?.toInt(),
      priority: (json['priority'] as num?)?.toInt() ?? 0,
    );
  }
}

class WishlistAnalysisModel {
  final String cashStrategyTier;
  final int currentRewardPoolRp;
  final int shortfallRp;
  final int estimatedMonthsToSave;
  final String? installmentRiskTier;
  final double? peakDebtRatioPercent;
  final int? newMonthlyInstallmentRp;

  const WishlistAnalysisModel({
    required this.cashStrategyTier,
    required this.currentRewardPoolRp,
    required this.shortfallRp,
    required this.estimatedMonthsToSave,
    this.installmentRiskTier,
    this.peakDebtRatioPercent,
    this.newMonthlyInstallmentRp,
  });

  factory WishlistAnalysisModel.fromJson(Map<String, dynamic> json) {
    final cash = (json['cashStrategy'] as Map?) ?? const {};
    final inst = json['installmentStrategy'] as Map?;
    return WishlistAnalysisModel(
      cashStrategyTier: cash['tier']?.toString() ?? 'SAVING_REQUIRED',
      currentRewardPoolRp: (cash['currentSelfReward'] as num?)?.round() ?? 0,
      shortfallRp: (cash['shortfall'] as num?)?.round() ?? 0,
      estimatedMonthsToSave:
          (cash['estimatedMonthsToSave'] as num?)?.round() ?? 0,
      installmentRiskTier: inst?['tier']?.toString(),
      peakDebtRatioPercent: (inst?['peakDebtRatio'] as num?)?.toDouble(),
      newMonthlyInstallmentRp:
          (inst?['newMonthlyInstallment'] as num?)?.round(),
    );
  }
}
