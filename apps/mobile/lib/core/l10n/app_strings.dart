enum AppLanguage { en, id, zh }

extension AppLanguageCode on AppLanguage {
  String get code => name;

  static AppLanguage fromCode(String? value) {
    switch (value?.toLowerCase()) {
      case 'id':
        return AppLanguage.id;
      case 'zh':
        return AppLanguage.zh;
      default:
        return AppLanguage.en;
    }
  }
}

class AppStrings {
  final String appName;
  final String workspaceHeader;
  final String safeToSpendLabel;
  final String signInAction;
  final String signingInLabel;
  final String demoSandboxAction;
  final String accountNameLabel;
  final String usernameLabel;
  final String passwordLabel;
  final String securityPinLabel;
  final String securityPinPrompt;
  final String ssoUnavailableHint;
  final String unlockTitle;
  final String enterPinPrompt;
  final String useBiometricsAction;
  final String switchAccountAction;
  final String biometricReason;
  final String invalidCredentialsError;
  final String rateLimitedError;
  final String offlineError;
  final String savingsSectionTitle;
  final String billsTabLabel;
  final String marqueeTabLabel;
  final String settingsTabLabel;
  final String cockpitTabLabel;
  final String signOutAction;
  final String quickLogTitle;
  final String lockedBadge;
  final String lockedReadOnlyNotice;
  final String livingCashLabel;
  final String incomeLabel;
  final String totalIncomeLabel;
  final String billsAndDebtLabel;
  final String routineBillsLabel;
  final String dailyLivingLabel;
  final String weekdayRateLabel;
  final String weekendRateLabel;
  final String lowestCashPointLabel;
  final String unpaidBillsLabel;
  final String itemLabelPlaceholder;
  final String amountLabel;
  final String saveTransactionAction;
  final String biometricEnrollAction;
  final String setupPinAction;
  final String securitySettingsTitle;
  final String walletCheckinAction;
  final String walletBalanceLabel;
  final String freeSpendableLabel;
  final String bankHoldNeededLabel;
  final String cashEventsHeader;
  final String endingBufferLabel;
  final String settlementPaidLabel;
  final String settlementReservedLabel;
  final String settlementUnpaidLabel;
  final String marqueeInputHint;
  final String marqueeMemoryTitle;
  final String marqueeEmptyPrompt;
  final String marqueeExecuteAction;
  final String marqueeExecutedBadge;
  final String financialToolsTitle;
  final String ledgerMenuTitle;
  final String wishlistMenuTitle;
  final String wishlistPriceLabel;
  final String wishlistSimulateAction;
  final String liquidCashLabel;
  final String rdpuInvestLabel;

  const AppStrings({
    required this.appName,
    required this.workspaceHeader,
    required this.safeToSpendLabel,
    required this.signInAction,
    required this.signingInLabel,
    required this.demoSandboxAction,
    required this.accountNameLabel,
    required this.usernameLabel,
    required this.passwordLabel,
    required this.securityPinLabel,
    required this.securityPinPrompt,
    required this.ssoUnavailableHint,
    required this.unlockTitle,
    required this.enterPinPrompt,
    required this.useBiometricsAction,
    required this.switchAccountAction,
    required this.biometricReason,
    required this.invalidCredentialsError,
    required this.rateLimitedError,
    required this.offlineError,
    required this.savingsSectionTitle,
    required this.billsTabLabel,
    required this.marqueeTabLabel,
    required this.settingsTabLabel,
    required this.cockpitTabLabel,
    required this.signOutAction,
    required this.quickLogTitle,
    required this.lockedBadge,
    required this.lockedReadOnlyNotice,
    required this.livingCashLabel,
    required this.incomeLabel,
    required this.totalIncomeLabel,
    required this.billsAndDebtLabel,
    required this.routineBillsLabel,
    required this.dailyLivingLabel,
    required this.weekdayRateLabel,
    required this.weekendRateLabel,
    required this.lowestCashPointLabel,
    required this.unpaidBillsLabel,
    required this.itemLabelPlaceholder,
    required this.amountLabel,
    required this.saveTransactionAction,
    required this.biometricEnrollAction,
    required this.setupPinAction,
    required this.securitySettingsTitle,
    required this.walletCheckinAction,
    required this.walletBalanceLabel,
    required this.freeSpendableLabel,
    required this.bankHoldNeededLabel,
    required this.cashEventsHeader,
    required this.endingBufferLabel,
    required this.settlementPaidLabel,
    required this.settlementReservedLabel,
    required this.settlementUnpaidLabel,
    required this.marqueeInputHint,
    required this.marqueeMemoryTitle,
    required this.marqueeEmptyPrompt,
    required this.marqueeExecuteAction,
    required this.marqueeExecutedBadge,
    required this.financialToolsTitle,
    required this.ledgerMenuTitle,
    required this.wishlistMenuTitle,
    required this.wishlistPriceLabel,
    required this.wishlistSimulateAction,
    required this.liquidCashLabel,
    required this.rdpuInvestLabel,
  });

  List<String> get allValues => [
        appName,
        workspaceHeader,
        safeToSpendLabel,
        signInAction,
        signingInLabel,
        demoSandboxAction,
        accountNameLabel,
        usernameLabel,
        passwordLabel,
        securityPinLabel,
        securityPinPrompt,
        ssoUnavailableHint,
        unlockTitle,
        enterPinPrompt,
        useBiometricsAction,
        switchAccountAction,
        biometricReason,
        invalidCredentialsError,
        rateLimitedError,
        offlineError,
        savingsSectionTitle,
        billsTabLabel,
        marqueeTabLabel,
        settingsTabLabel,
        cockpitTabLabel,
        signOutAction,
        quickLogTitle,
        lockedBadge,
        lockedReadOnlyNotice,
        livingCashLabel,
        incomeLabel,
        totalIncomeLabel,
        billsAndDebtLabel,
        routineBillsLabel,
        dailyLivingLabel,
        weekdayRateLabel,
        weekendRateLabel,
        lowestCashPointLabel,
        unpaidBillsLabel,
        itemLabelPlaceholder,
        amountLabel,
        saveTransactionAction,
        biometricEnrollAction,
        setupPinAction,
        securitySettingsTitle,
        walletCheckinAction,
        walletBalanceLabel,
        freeSpendableLabel,
        bankHoldNeededLabel,
        cashEventsHeader,
        endingBufferLabel,
        settlementPaidLabel,
        settlementReservedLabel,
        settlementUnpaidLabel,
        marqueeInputHint,
        marqueeMemoryTitle,
        marqueeEmptyPrompt,
        marqueeExecuteAction,
        marqueeExecutedBadge,
        financialToolsTitle,
        ledgerMenuTitle,
        wishlistMenuTitle,
        wishlistPriceLabel,
        wishlistSimulateAction,
        liquidCashLabel,
        rdpuInvestLabel,
      ];

  static AppStrings forLanguage(AppLanguage lang) {
    switch (lang) {
      case AppLanguage.en:
        return const AppStrings(
          appName: 'Sunday Funday',
          workspaceHeader: 'PERSONAL FINANCE ERP',
          safeToSpendLabel: 'Safe-to-Spend Today',
          signInAction: 'Sign In',
          signingInLabel: 'Signing in...',
          demoSandboxAction: 'Try Demo Sandbox',
          accountNameLabel: 'Account Name',
          usernameLabel: 'Username or Email',
          passwordLabel: 'Password',
          securityPinLabel: '6-Digit Security PIN',
          securityPinPrompt: 'Unrecognized IP detected. Enter your 6-digit Security PIN.',
          ssoUnavailableHint: 'SSO providers can be enabled in server environment settings.',
          unlockTitle: 'Session Locked',
          enterPinPrompt: 'Enter 6-digit App PIN to unlock',
          useBiometricsAction: 'Use Biometrics',
          switchAccountAction: 'Switch Account',
          biometricReason: 'Unlock your Sunday Funday ledger',
          invalidCredentialsError: 'Invalid credentials. Check account name, username, and password.',
          rateLimitedError: 'Too many failed attempts. Wait 15 minutes before retrying.',
          offlineError: 'Unable to reach API server. Check connection.',
          savingsSectionTitle: 'Savings & Emergency Fund',
          billsTabLabel: 'Bills & Radar',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: 'More',
          cockpitTabLabel: 'Cockpit',
          signOutAction: 'Sign out',
          quickLogTitle: 'Quick Log',
          lockedBadge: 'Locked',
          lockedReadOnlyNotice: 'This cycle is closed and read-only.',
          livingCashLabel: 'Living Cash',
          incomeLabel: 'Income',
          totalIncomeLabel: 'Net Income',
          billsAndDebtLabel: 'Debt & Bills',
          routineBillsLabel: 'Routine Bills',
          dailyLivingLabel: 'Living Pool',
          weekdayRateLabel: 'Weekday / day',
          weekendRateLabel: 'Weekend / day',
          lowestCashPointLabel: 'Lowest Cash Point',
          unpaidBillsLabel: 'Unpaid Bills',
          itemLabelPlaceholder: 'Item description (e.g. Coffee)',
          amountLabel: 'Amount (Rp)',
          saveTransactionAction: 'Save Transaction',
          biometricEnrollAction: 'Enable Biometric Unlock',
          setupPinAction: 'Configure 6-Digit PIN',
          securitySettingsTitle: 'Device Security & Preferences',
          walletCheckinAction: 'Wallet Check-In',
          walletBalanceLabel: 'Actual Bank & Wallet Balance (Rp)',
          freeSpendableLabel: 'Free Spendable Cash',
          bankHoldNeededLabel: 'Held for Bills',
          cashEventsHeader: 'SCHEDULED EVENTS',
          endingBufferLabel: 'Ending Cash Buffer',
          settlementPaidLabel: 'Paid',
          settlementReservedLabel: 'Reserved',
          settlementUnpaidLabel: 'Unpaid',
          marqueeInputHint: 'Ask Marquee or type an expense...',
          marqueeMemoryTitle: 'Learned Rules & Preferences',
          marqueeEmptyPrompt:
              'Ask about daily pacing, cutoff routing, or log an entry in plain words.',
          marqueeExecuteAction: 'Confirm & Apply',
          marqueeExecutedBadge: 'Applied',
          financialToolsTitle: 'Ledgers & Planning',
          ledgerMenuTitle: 'Cycle Ledger',
          wishlistMenuTitle: 'Wishlist Check',
          wishlistPriceLabel: 'Item Price (Rp)',
          wishlistSimulateAction: 'Simulate Impact',
          liquidCashLabel: 'Liquid Cash',
          rdpuInvestLabel: 'RDPU Allocation',
        );
      case AppLanguage.id:
        return const AppStrings(
          appName: 'Sunday Funday',
          workspaceHeader: 'ERP KEUANGAN PRIBADI',
          safeToSpendLabel: 'Saldo Aman Hari Ini',
          signInAction: 'Masuk',
          signingInLabel: 'Memverifikasi...',
          demoSandboxAction: 'Coba Mode Demo',
          accountNameLabel: 'Nama Akun',
          usernameLabel: 'Username atau Email',
          passwordLabel: 'Kata Sandi',
          securityPinLabel: 'PIN Keamanan 6 Digit',
          securityPinPrompt: 'IP baru terdeteksi. Masukkan 6 digit PIN Keamanan Anda.',
          ssoUnavailableHint: 'Login SSO akan aktif setelah client ID dikonfigurasi di server.',
          unlockTitle: 'Sesi Terkunci',
          enterPinPrompt: 'Masukkan 6 digit PIN untuk membuka',
          useBiometricsAction: 'Gunakan Biometrik',
          switchAccountAction: 'Ganti Akun',
          biometricReason: 'Buka kunci buku kas Sunday Funday Anda',
          invalidCredentialsError: 'Kredensial tidak cocok. Periksa nama akun, username, dan kata sandi.',
          rateLimitedError: 'Terlalu banyak percobaan gagal. Tunggu 15 menit sebelum mencoba lagi.',
          offlineError: 'Server API tidak terjangkau. Periksa koneksi internet Anda.',
          savingsSectionTitle: 'Tabungan & Dana Darurat',
          billsTabLabel: 'Tagihan & Radar',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: 'Lainnya',
          cockpitTabLabel: 'Kokpit',
          signOutAction: 'Keluar',
          quickLogTitle: 'Catat Cepat',
          lockedBadge: 'Terkunci',
          lockedReadOnlyNotice: 'Siklus ini sudah ditutup dan hanya bisa dibaca.',
          livingCashLabel: 'Dana Harian',
          incomeLabel: 'Pemasukan',
          totalIncomeLabel: 'Pemasukan Bersih',
          billsAndDebtLabel: 'Cicilan & Tagihan',
          routineBillsLabel: 'Tagihan Rutin',
          dailyLivingLabel: 'Dana Hidup',
          weekdayRateLabel: 'Hari Kerja / hari',
          weekendRateLabel: 'Akhir Pekan / hari',
          lowestCashPointLabel: 'Titik Saldo Terendah',
          unpaidBillsLabel: 'Belum Dibayar',
          itemLabelPlaceholder: 'Keterangan (mis. Kopi)',
          amountLabel: 'Nominal (Rp)',
          saveTransactionAction: 'Simpan Transaksi',
          biometricEnrollAction: 'Aktifkan Kunci Biometrik',
          setupPinAction: 'Atur PIN 6 Digit',
          securitySettingsTitle: 'Keamanan Perangkat & Preferensi',
          walletCheckinAction: 'Cek Saldo Dompet',
          walletBalanceLabel: 'Saldo Bank & Dompet Aktual (Rp)',
          freeSpendableLabel: 'Sisa Uang Bebas Pakai',
          bankHoldNeededLabel: 'Ditahan untuk Tagihan',
          cashEventsHeader: 'AGENDA ARUS KAS',
          endingBufferLabel: 'Sisa Kas Akhir Siklus',
          settlementPaidLabel: 'Lunas',
          settlementReservedLabel: 'Disisihkan',
          settlementUnpaidLabel: 'Belum',
          marqueeInputHint: 'Tanya Marquee atau catat transaksi...',
          marqueeMemoryTitle: 'Aturan & Preferensi Tersimpan',
          marqueeEmptyPrompt:
              'Tanyakan laju harian, simulasi cicilan, atau catat pengeluaran.',
          marqueeExecuteAction: 'Konfirmasi & Simpan',
          marqueeExecutedBadge: 'Tersimpan',
          financialToolsTitle: 'Buku Kas & Rencana',
          ledgerMenuTitle: 'Mutasi Siklus',
          wishlistMenuTitle: 'Simulasi Wishlist',
          wishlistPriceLabel: 'Harga Barang (Rp)',
          wishlistSimulateAction: 'Simulasikan Dampak',
          liquidCashLabel: 'Kas Likuid',
          rdpuInvestLabel: 'Instrumen RDPU',
        );
      case AppLanguage.zh:
        return const AppStrings(
          appName: 'Sunday Funday',
          workspaceHeader: '个人财务 ERP',
          safeToSpendLabel: '今日安全支出',
          signInAction: '登录',
          signingInLabel: '正在登录...',
          demoSandboxAction: '试用演示沙盒',
          accountNameLabel: '账户名',
          usernameLabel: '用户名或邮箱',
          passwordLabel: '密码',
          securityPinLabel: '6 位安全 PIN 码',
          securityPinPrompt: '检测到新网络地址，请输入您的 6 位安全 PIN 码。',
          ssoUnavailableHint: '在服务器配置客户端凭据后即可启用 SSO。',
          unlockTitle: '会话已锁定',
          enterPinPrompt: '输入 6 位应用 PIN 码以解锁',
          useBiometricsAction: '使用生物识别',
          switchAccountAction: '切换账户',
          biometricReason: '解锁您的 Sunday Funday 账本',
          invalidCredentialsError: '凭据无效，请检查账户名、用户名与密码。',
          rateLimitedError: '尝试次数过多，请等待 15 分钟后再试。',
          offlineError: '无法连接 API 服务器，请检查网络连接。',
          savingsSectionTitle: '储蓄与应急基金',
          billsTabLabel: '账单与雷达',
          marqueeTabLabel: 'Marquee AI',
          settingsTabLabel: '更多',
          cockpitTabLabel: '驾驶舱',
          signOutAction: '退出登录',
          quickLogTitle: '快速记账',
          lockedBadge: '已锁定',
          lockedReadOnlyNotice: '该周期已锁定为只读状态。',
          livingCashLabel: '日常现金',
          incomeLabel: '收入',
          totalIncomeLabel: '净收入',
          billsAndDebtLabel: '账单与债务',
          routineBillsLabel: '日常固定账单',
          dailyLivingLabel: '生活预算池',
          weekdayRateLabel: '工作日 / 日均',
          weekendRateLabel: '周末 / 日均',
          lowestCashPointLabel: '最低现金节点',
          unpaidBillsLabel: '待付账单',
          itemLabelPlaceholder: '消费说明（例：咖啡）',
          amountLabel: '金额 (Rp)',
          saveTransactionAction: '保存记录',
          biometricEnrollAction: '启用生物识别解锁',
          setupPinAction: '设置 6 位 PIN 码',
          securitySettingsTitle: '设备安全与偏好设置',
          walletCheckinAction: '钱包余额核对',
          walletBalanceLabel: '实际银行与钱包余额 (Rp)',
          freeSpendableLabel: '可自由支配余额',
          bankHoldNeededLabel: '账单预留金额',
          cashEventsHeader: '现金流日程',
          endingBufferLabel: '周期末现金结余',
          settlementPaidLabel: '已付',
          settlementReservedLabel: '已预留',
          settlementUnpaidLabel: '未付',
          marqueeInputHint: '询问 Marquee 或记录消费...',
          marqueeMemoryTitle: '偏好与记忆规则',
          marqueeEmptyPrompt: '询问每日花销节奏、分期试算或直接输入记账内容。',
          marqueeExecuteAction: '确认并执行',
          marqueeExecutedBadge: '已执行',
          financialToolsTitle: '账簿与规划',
          ledgerMenuTitle: '周期流水明细',
          wishlistMenuTitle: '心愿单试算',
          wishlistPriceLabel: '物品价格 (Rp)',
          wishlistSimulateAction: '试算财务影响',
          liquidCashLabel: '活期现金',
          rdpuInvestLabel: '货币基金配置',
        );
    }
  }
}
