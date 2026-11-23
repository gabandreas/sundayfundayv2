enum AppLanguage { en, id, zh }

class AppStrings {
  final String appName;
  final String safeToSpendLabel;
  final String signInAction;
  final String accountNameLabel;
  final String usernameLabel;
  final String passwordLabel;
  final String savingsSectionTitle;
  final String billsTabLabel;
  final String marqueeTabLabel;
  final String settingsTabLabel;

  const AppStrings({
    required this.appName,
    required this.safeToSpendLabel,
    required this.signInAction,
    required this.accountNameLabel,
    required this.usernameLabel,
    required this.passwordLabel,
    required this.savingsSectionTitle,
    required this.billsTabLabel,
    required this.marqueeTabLabel,
    required this.settingsTabLabel,
  });

  List<String> get allValues => [
        appName,
        safeToSpendLabel,
        signInAction,
        accountNameLabel,
        usernameLabel,
        passwordLabel,
        savingsSectionTitle,
        billsTabLabel,
        marqueeTabLabel,
        settingsTabLabel,
      ];

  static AppStrings forLanguage(AppLanguage lang) {
    switch (lang) {
      case AppLanguage.en:
        return const AppStrings(
          appName: 'Sunday Funday',
          safeToSpendLabel: 'Safe-to-Spend Today',
          signInAction: 'Sign In',
          accountNameLabel: 'Account Name',
          usernameLabel: 'Username',
          passwordLabel: 'Password',
          savingsSectionTitle: 'Savings & Emergency Fund',
          billsTabLabel: 'Bills & Radar',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: 'Settings',
        );
      case AppLanguage.id:
        return const AppStrings(
          appName: 'Sunday Funday',
          safeToSpendLabel: 'Saldo Aman Hari Ini',
          signInAction: 'Masuk',
          accountNameLabel: 'Nama Akun',
          usernameLabel: 'Username',
          passwordLabel: 'Kata Sandi',
          savingsSectionTitle: 'Tabungan & Dana Darurat',
          billsTabLabel: 'Tagihan & Radar',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: 'Pengaturan',
        );
      case AppLanguage.zh:
        return const AppStrings(
          appName: 'Sunday Funday',
          safeToSpendLabel: '今日安全支出',
          signInAction: '登录',
          accountNameLabel: '账户名',
          usernameLabel: '用户名',
          passwordLabel: '密码',
          savingsSectionTitle: '储蓄与应急基金',
          billsTabLabel: '账单与雷达',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: '设置',
        );
    }
  }
}
