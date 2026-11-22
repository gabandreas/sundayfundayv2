"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";

export type LocaleCode = "en" | "id" | "zh";

const STORAGE_KEY = "erp_locale";

const EN_DICT = {
  // Brand & Shell
  "app.title": "Sunday Funday",
  "app.subtitle": "Personal Finance ERP",
  "nav.section.engine": "Financial Engine",
  "nav.section.audit": "Audit & Decision",
  "nav.section.system": "System",
  "nav.navigation": "Navigation",
  "nav.modules": "Modules",
  "nav.overview": "Overview",
  "nav.paydayWizard": "Payday & Closing Wizard",
  "nav.cashRadar": "Cash Radar & Calendar",
  "nav.payroll": "Payroll & Income",
  "nav.allocations": "Allocations",
  "nav.credit": "Credit & Liabilities",
  "nav.savings": "Savings & Vaults",
  "nav.ledger": "Transaction Ledger",
  "nav.marquee": "Marquee AI",
  "nav.wishlist": "Wishlist Simulator",
  "nav.audit": "Discipline Audit",
  "nav.analytics": "Analytics",
  "nav.reports": "Reports & Statements",
  "nav.subscriptions": "Subscriptions & Recurring",
  "nav.guide": "User Guide",
  "nav.preferences": "Preferences",
  "nav.admin": "Platform Admin",

  // Header & Route categories
  "cat.dashboard": "Dashboard",
  "cat.engine": "Engine",
  "cat.decision": "Decision",
  "cat.audit": "Audit",
  "cat.system": "System",
  "cat.spec": "Spec",
  "cat.view": "View",
  "header.adminSql": "Superadmin SQL Query Studio",
  "header.openMenu": "Open navigation menu",
  "header.closeMenu": "Close navigation menu",

  // Auth / Login
  "auth.eyebrow": "Sunday Funday ERP",
  "auth.signInTitle": "Sign in to ERP Workspace",
  "auth.pinTitle": "Security PIN Verification",
  "auth.lockedPrefix": "Session Locked",
  "auth.signInSubtitle": "Single-user cash flow, debt & waterfall control",
  "auth.sessionExpired": "Session expired due to inactivity. Enter your password to unlock.",
  "auth.username": "Username or Email",
  "auth.usernamePlaceholder": "Enter username",
  "auth.password": "Password",
  "auth.passwordPlaceholder": "Enter password",
  "auth.quickReAuth": "Quick Re-Auth",
  "auth.securityPin": "6-Digit Security PIN",
  "auth.securityPinHint": "Enter the 6-digit PIN configured for this workspace.",
  "auth.deviceLabel": "Device / Location Label",
  "auth.devicePlaceholder": "e.g. Home Workstation",
  "auth.trustIp": "Trust and permanently whitelist this IP address",
  "auth.backToLogin": "Back to credential login",
  "auth.authenticating": "Authenticating...",
  "auth.transitioning": "Opening workspace...",
  "auth.verifyPin": "Verify PIN & Access Workspace",
  "auth.unlockSession": "Unlock Session",
  "auth.signInBtn": "Sign in to Workspace",
  "auth.switchAccount": "Sign in with a different account",
  "auth.demoEyebrow": "Interactive Evaluation Sandbox",
  "auth.demoBtn": "Explore General Sandbox (Demo)",
  "auth.securityNote": "Scrypt + HMAC-SHA256 JWT Gate",
  "auth.securityVersion": "Enterprise Hardened",

  // Credit & Matrix
  "credit.tab.overview": "Credit Limit & Matrix",
  "credit.tab.cards": "Credit Cards",
  "credit.tab.contracts": "Installment Contracts",
  "credit.tab.killSwitches": "Kill Switches & Alerts",
  "credit.limitTitle": "Credit & Debt Ceiling Control",
  "credit.limitDesc": "Period debt cap based on take-home pay and 35% safe threshold.",
  "credit.btn.optimal": "Use Optimal Ceiling",
  "credit.btn.safe": "Use Safe Ceiling",
  "credit.btn.configure": "Configure Period Limits",
  "credit.matrix.title": "12-Month Rolling Debt Matrix",
  "credit.matrix.subtitle": "Click any PayLater or Personal Debt value to edit directly, or inspect line items.",
  "credit.matrix.currentPeriod": "Current Period",
  "credit.matrix.simulator": "Safe-Spend Simulator",
  "credit.matrix.bridgeLoan": "Record Bridge Loan",
  "credit.matrix.sourceCol": "Liability Source",
  "credit.matrix.paylater": "PayLater Bills",
  "credit.matrix.paylaterSub": "Due 25th (cutoff 15th)",
  "credit.matrix.cc": "Credit Card Charges",
  "credit.matrix.ccSub": "Due 11th (cutoff 20th)",
  "credit.matrix.personal": "Personal & Informal Debt",
  "credit.matrix.personalSub": "Loans & P1 vault refunds",
  "credit.matrix.totalDue": "Total Liabilities Due",

  // Reports
  "reports.title": "Financial Reports",
  "reports.subtitle": "Period-by-period cash flow statement, waterfall verification, and 3-month liquidity runway.",
  "reports.downloadExcel": "Download Excel (.xlsx)",
  "reports.exportingExcel": "Generating Excel...",
  "reports.printPdf": "Print / Save PDF",
  "reports.kpi.moneyIn": "Money In",
  "reports.kpi.debtBills": "Debt & Credit Bills",
  "reports.kpi.livingCash": "Daily Living Cash",
  "reports.kpi.netSaved": "Net Saved",
  "reports.tab.cycle": "Monthly Cash Flow",
  "reports.tab.forecast": "3-Month Forecast",
  "reports.tab.audit": "Discipline & Audit",
  "reports.tab.edits": "Budget Edits",
  "reports.allocationStrip": "Paycheck Allocation Ratio",

  // Overview Cards
  "overview.safeToSpend": "SAFE-TO-SPEND TODAY",
  "overview.upcomingLivingPool": "UPCOMING LIVING POOL",
  "overview.cycleCompletedLabel": "CYCLE COMPLETED",
  "overview.projectedDailyRate": "Projected daily rate",
  "overview.startsInDays": "STARTS IN",
  "overview.daysUnit": "DAYS",
  "overview.prePaydayPlan": "Pre-Payday Plan",
  "overview.aheadOfPace": "ahead of pace",
  "overview.overPace": "over pace",
  "overview.bridgeUntilPayday": "days until payday — log today's pocket cash in Wallet Check-In",
  "overview.status.onTrack": "ON TRACK",
  "overview.status.caution": "CAUTION",
  "overview.status.burningFast": "BURNING FAST",
  "overview.status.deficitRisk": "DEFICIT RISK",
  "overview.daysLeft": "days left",
  "overview.weekdayRate": "Weekday Safe Rate",
  "overview.weekendRate": "Weekend Safe Rate",
  "overview.remainingCash": "Remaining Living Cash",
  "overview.checkpointTitle": "10-Second Balance Checkpoint",
  "overview.syncBalance": "Sync Balance",
  "overview.cashflowSummary": "CASHFLOW SUMMARY",
  "overview.totalNetIncome": "Total Net Income (Payroll + Adjustments)",
  "overview.materializedDebt": "Bills & Debt Paid First",
  "overview.netBaseline": "Cash Left After Bills",
  "overview.routineBills": "LIVING & ROUTINE BILLS",
  "overview.remainingBillsQuota": "Remaining Bills Quota",
  "overview.totalMonthlyBudget": "Total Monthly Budget",
  "overview.dailyFoodLiving": "Daily Food & Living Budget",
  "overview.partiallyFunded": "Partially Funded",
  "overview.unfunded": "Unfunded",
  "overview.fundedOfTarget": "Funded",
  "overview.coreSavings": "Core Savings (P1)",
  "overview.forwardBorrowP1": "Forward-Borrow P1",
  "overview.viewVault": "View Vault & Goals",
  "overview.selfRewardBuffer": "Self-Reward & Buffer (P2)",
  "overview.emergencyBuffer": "Emergency Buffer",
  "overview.recordExpense": "Record Expense",
  "overview.dailySpend": "Daily Spend",
  "overview.routineBill": "Routine Bill",
  "overview.refundSplit": "Refund / Split",
  "overview.recentTransactions": "RECENT TRANSACTIONS",

  // Matrix Cell Drawer
  "drawer.totalScheduled": "Total Scheduled",
  "drawer.remainingUnpaid": "Remaining Unpaid",
  "drawer.periodLocked": "Period Locked",
  "drawer.safeHeadroom": "Safe PayLater Headroom",
  "drawer.itemizedBreakdown": "Itemized Breakdown",
  "drawer.lumpSumOverride": "Lump-Sum Override",
  "drawer.itemizedObligations": "Itemized Obligations",
  "drawer.addItem": "Add Item / Installment",
  "drawer.closeForm": "Close Form",
  "drawer.earlier": "Earlier",
  "drawer.later": "Later",

  // Humanized Shortfall Alert
  "deficit.title": "Budget Shortfall",
  "deficit.prefix": "Planned bills, daily living, and savings exceed this cycle's take-home pay by",
  "deficit.suffix": "Period closing is paused until planned spending is reduced, target buckets are adjusted, or extra income is logged.",

  // Humanized Single-Line Badges
  "badge.emergencyCashDeposit": "Emergency Cash Deposit",
  "badge.rdpuDeposit": "RDPU Investment Deposit",
  "badge.emergencyWithdrawal": "Emergency Cash Withdrawal",
  "badge.rdpuWithdrawal": "RDPU Investment Withdrawal",
  "badge.p1CoreSavings": "P1 Core Savings",
  "badge.paylaterSettlement": "PayLater Settlement",
  "badge.creditCardBill": "Credit Card Statement",
  "badge.personalDebt": "Personal Loan",
  "badge.routineBill": "Routine Bill",
  "badge.dailyLiving": "Daily Living",
  "badge.incomeInflow": "Income Inflow",
  "badge.operationalRefund": "Refund Offset",
  "badge.installment": "Installment",

  // Expandable Sub-Modules
  "sub.payroll.payslip": "Salary & Payslip",
  "sub.payroll.timeline": "Payday Split-Bill Planner",
  "sub.payroll.lifeenergy": "Hourly Wage & Work-Cost",
  "sub.allocations.waterfall": "Waterfall & Quota Planner",
  "sub.allocations.envelopes": "Envelope Rollover & Sinking Funds",
  "sub.allocations.revisions": "Budget Revisions & Locks",
  "sub.credit.matrix": "12-Month Liability Matrix",
  "sub.credit.contracts": "Active Contracts & Payoff Optimizer",
  "sub.credit.simulator": "Billing Cutoff Advisor",
  "sub.credit.reconciler": "Bulk Statement Reconciler",
  "sub.savings.networth": "Cash vs Debt Ledger",
  "sub.savings.forecaster": "12-Month Debt-Free Outlook",
  "sub.savings.vault": "P1 Vault & Forward-Borrow Ledger",
  "sub.reports.executive": "Executive Waterfall & Health Ratios",
  "sub.reports.variance": "MoM Variance & Drill-Down Audit",
  "sub.reports.audit": "Discipline Audit & Edits Log",
  "sub.reports.export": "4-Sheet Excel & Email Dispatch",
  "sub.preferences.formula": "Two-Stage Payroll & Formula Studio",
  "sub.preferences.instruments": "Instruments & Cutoff Rules",
  "sub.preferences.accounts": "Cash & Asset Accounts",
  "sub.preferences.templates": "Routine Envelopes & Templates",
  "sub.preferences.navigation": "Sidebar & Custom Menu Builder",
  "sub.preferences.notifications": "Email, SMTP & Security Guard",
  "sub.preferences.ai": "Marquee AI Co-Pilot & Webhook",

  // Financial Intelligence & Outlook Labels (Humanized)
  "intel.paycycleWindow": "Active Paycycle Window",
  "intel.maturitiesLabel": "Maturities Funded",
  "intel.realNetWorth": "Cash & Savings vs. Debt",
  "intel.liquidAssets": "Cash & Savings Balances",
  "intel.remainingDebt": "Total Unpaid Debt",
  "intel.ageOfMoney": "Savings Runway",
  "intel.bufferDays": "Buffer Runway",
  "intel.debtFreedom": "Next Payoff Target",
  "intel.burnVelocity": "Daily Spending Pace",
  "intel.postCutoffCreep": "Next-Cycle New Charges",
  "intel.nextUnlock": "Upcoming Monthly Relief (Finishing Installments)",
  "intel.workHoursCost": "Work Hours",
  "intel.trueHourlyWage": "True Net Hourly Wage",
  "intel.outlookTitle": "Savings, Spending Pace & Debt Payoff Outlook",
  "intel.cashVsDebtTitle": "Cash & Savings vs. Remaining Debt",
  "intel.cashVsDebtHint": "Compares liquid cash + Core Savings P1 (plus optional external assets) against total remaining debt.",
  "intel.savingsRunwayHint": "Estimated days your current cash & savings reserve covers at your current daily spending pace.",
  "intel.burnVelocityHint": "Compares % of living budget spent against % of paycycle elapsed (1.00x = on pace).",
  "intel.paceAndCreepTitle": "Daily Spending Pace & Next-Cycle Charges",
  "intel.paceAndCreepHint": "Measures live daily burn pace plus new PayLater/Card charges billed after cutoff into next cycle.",
  "intel.nextUnlockHint": "Monthly obligation relief unlocked as installment contracts finish over the coming cycles.",
  "intel.paceNormal": "On Pace",
  "intel.paceCaution": "Slightly Fast",
  "intel.paceHigh": "Elevated Pace",
  "intel.noAnomalies": "No spending spikes or unexpected next-cycle drift detected.",
} as const;

export type TranslationKey = keyof typeof EN_DICT;

const ID_DICT: Record<TranslationKey, string> = {
  "app.title": "Sunday Funday",
  "app.subtitle": "ERP Keuangan Pribadi",
  "nav.section.engine": "Mesin Keuangan",
  "nav.section.audit": "Audit & Keputusan",
  "nav.section.system": "Sistem",
  "nav.navigation": "Navigasi",
  "nav.modules": "Modul",
  "nav.overview": "Ringkasan",
  "nav.paydayWizard": "Ritual Gaji & Tutup Siklus",
  "nav.cashRadar": "Radar Kas & Kalender",
  "nav.payroll": "Gaji & Pemasukan",
  "nav.allocations": "Alokasi Anggaran",
  "nav.credit": "Kredit & Kewajiban",
  "nav.savings": "Tabungan & Brankas",
  "nav.ledger": "Buku Transaksi",
  "nav.marquee": "Marquee AI",
  "nav.wishlist": "Simulasi Wishlist",
  "nav.audit": "Audit Disiplin",
  "nav.analytics": "Analitik",
  "nav.reports": "Laporan Keuangan",
  "nav.subscriptions": "Langganan & Berulang",
  "nav.guide": "Panduan Pengguna",
  "nav.preferences": "Preferensi",
  "nav.admin": "Admin Platform",

  "cat.dashboard": "Dasbor",
  "cat.engine": "Mesin",
  "cat.decision": "Keputusan",
  "cat.audit": "Audit",
  "cat.system": "Sistem",
  "cat.spec": "Spek",
  "cat.view": "Tampilan",
  "header.adminSql": "Studio Kueri SQL Superadmin",
  "header.openMenu": "Buka menu navigasi",
  "header.closeMenu": "Tutup menu navigasi",

  "auth.eyebrow": "Sunday Funday ERP",
  "auth.signInTitle": "Masuk ke Ruang Kerja ERP",
  "auth.pinTitle": "Verifikasi PIN Keamanan",
  "auth.lockedPrefix": "Sesi Terkunci",
  "auth.signInSubtitle": "Kontrol arus kas, utang, dan alokasi gaji",
  "auth.sessionExpired": "Sesi berakhir karena tidak aktif. Masukkan kata sandi untuk membuka kunci.",
  "auth.username": "Nama Pengguna atau Email",
  "auth.usernamePlaceholder": "Masukkan nama pengguna",
  "auth.password": "Kata Sandi",
  "auth.passwordPlaceholder": "Masukkan kata sandi",
  "auth.quickReAuth": "Autentikasi Ulang Cepat",
  "auth.securityPin": "PIN Keamanan 6-Digit",
  "auth.securityPinHint": "Masukkan 6-digit PIN yang terdaftar untuk ruang kerja ini.",
  "auth.deviceLabel": "Label Perangkat / Lokasi",
  "auth.devicePlaceholder": "cth. Komputer Rumah",
  "auth.trustIp": "Percayai dan simpan alamat IP ini secara permanen",
  "auth.backToLogin": "Kembali ke login kredensial",
  "auth.authenticating": "Memverifikasi...",
  "auth.transitioning": "Membuka ruang kerja...",
  "auth.verifyPin": "Verifikasi PIN & Masuk",
  "auth.unlockSession": "Buka Kunci Sesi",
  "auth.signInBtn": "Masuk ke Ruang Kerja",
  "auth.switchAccount": "Masuk dengan akun lain",
  "auth.demoEyebrow": "Sandbox Evaluasi Interaktif",
  "auth.demoBtn": "Buka Sandbox Umum (Demo)",
  "auth.securityNote": "Gerbang JWT HMAC-SHA256 + Scrypt",
  "auth.securityVersion": "Keamanan Teruji",

  "credit.tab.overview": "Limit & Matriks Kredit",
  "credit.tab.cards": "Kartu Kredit",
  "credit.tab.contracts": "Kontrak Cicilan",
  "credit.tab.killSwitches": "Kill Switch & Peringatan",
  "credit.limitTitle": "Kontrol Plafon Utang & Kredit",
  "credit.limitDesc": "Batas tagihan periode berdasarkan penghasilan bersih dan ambang aman 35%.",
  "credit.btn.optimal": "Gunakan Batas Optimal",
  "credit.btn.safe": "Gunakan Batas Aman",
  "credit.btn.configure": "Atur Batas Periode",
  "credit.matrix.title": "Matriks Utang Bergulir 12-Bulan",
  "credit.matrix.subtitle": "Klik angka PayLater atau Utang Pribadi untuk edit cepat, atau kelola rincian item.",
  "credit.matrix.currentPeriod": "Periode Aktif",
  "credit.matrix.simulator": "Simulasi Belanja Aman",
  "credit.matrix.bridgeLoan": "Catat Pinjaman Talangan",
  "credit.matrix.sourceCol": "Sumber Kewajiban",
  "credit.matrix.paylater": "Tagihan PayLater",
  "credit.matrix.paylaterSub": "Jatuh tempo tgl 25 (cutoff 15)",
  "credit.matrix.cc": "Tagihan Kartu Kredit",
  "credit.matrix.ccSub": "Jatuh tempo tgl 11 (cutoff 20)",
  "credit.matrix.personal": "Utang Pribadi & Informal",
  "credit.matrix.personalSub": "Pinjaman & pengembalian P1",
  "credit.matrix.totalDue": "Total Kewajiban Jatuh Tempo",

  "reports.title": "Laporan Keuangan",
  "reports.subtitle": "Laporan arus kas periode, verifikasi waterfall gaji, dan proyeksi likuiditas 3 bulan.",
  "reports.downloadExcel": "Unduh Excel (.xlsx)",
  "reports.exportingExcel": "Menyusun Excel...",
  "reports.printPdf": "Cetak / Simpan PDF",
  "reports.kpi.moneyIn": "Pemasukan Total",
  "reports.kpi.debtBills": "Tagihan Utang & Kredit",
  "reports.kpi.livingCash": "Dana Operasional Harian",
  "reports.kpi.netSaved": "Tabungan Bersih",
  "reports.tab.cycle": "Arus Kas Bulanan",
  "reports.tab.forecast": "Proyeksi 3-Bulan",
  "reports.tab.audit": "Audit & Disiplin",
  "reports.tab.edits": "Riwayat Revisi",
  "reports.allocationStrip": "Proporsi Alokasi Gaji",

  "overview.safeToSpend": "AMAN DIBELANJAKAN HARI INI",
  "overview.upcomingLivingPool": "DANA HIDUP MENDATANG",
  "overview.cycleCompletedLabel": "SIKLUS SELESAI",
  "overview.projectedDailyRate": "Estimasi kuota harian",
  "overview.startsInDays": "MULAI DALAM",
  "overview.daysUnit": "HARI",
  "overview.prePaydayPlan": "Rencana Pra-Gajian",
  "overview.aheadOfPace": "lebih hemat",
  "overview.overPace": "di atas kuota",
  "overview.bridgeUntilPayday": "hari menuju gajian — pantau saldo tunai di Wallet Check-In",
  "overview.status.onTrack": "SESUAI JALUR",
  "overview.status.caution": "WASPADA",
  "overview.status.burningFast": "BOROS CEPAT",
  "overview.status.deficitRisk": "RISIKO DEFISIT",
  "overview.daysLeft": "hari tersisa",
  "overview.weekdayRate": "Batas Harian Kerja",
  "overview.weekendRate": "Batas Akhir Pekan",
  "overview.remainingCash": "Sisa Kas Hidup",
  "overview.checkpointTitle": "Sinkronisasi Saldo 10-Detik",
  "overview.syncBalance": "Sinkronkan Saldo",
  "overview.cashflowSummary": "RINGKASAN ARUS KAS",
  "overview.totalNetIncome": "Total Pemasukan Bersih (Gaji + Tambahan)",
  "overview.materializedDebt": "Kewajiban & Utang Terjadwal (Di Awal)",
  "overview.netBaseline": "Basis Waterfall Bersih",
  "overview.routineBills": "BIAYA HIDUP & TAGIHAN RUTIN",
  "overview.remainingBillsQuota": "Sisa Kuota Tagihan",
  "overview.totalMonthlyBudget": "Total Anggaran Bulanan",
  "overview.dailyFoodLiving": "Anggaran Makan & Hidup Harian",
  "overview.partiallyFunded": "Terdanai Sebagian",
  "overview.unfunded": "Belum Terdanai",
  "overview.fundedOfTarget": "Terdanai",
  "overview.coreSavings": "Tabungan Inti (P1)",
  "overview.forwardBorrowP1": "Pinjam Muka P1",
  "overview.viewVault": "Lihat Brankas & Target",
  "overview.selfRewardBuffer": "Self-Reward & Cadangan (P2)",
  "overview.emergencyBuffer": "Dana Cadangan Darurat",
  "overview.recordExpense": "Catat Pengeluaran",
  "overview.dailySpend": "Belanja Harian",
  "overview.routineBill": "Tagihan Rutin",
  "overview.refundSplit": "Refund / Patungan",
  "overview.recentTransactions": "TRANSAKSI TERBARU",

  "drawer.totalScheduled": "Total Terjadwal",
  "drawer.remainingUnpaid": "Sisa Belum Lunas",
  "drawer.periodLocked": "Periode Terkunci",
  "drawer.safeHeadroom": "Batas Aman PayLater",
  "drawer.itemizedBreakdown": "Rincian Per Item",
  "drawer.lumpSumOverride": "Edit Total Langsung",
  "drawer.itemizedObligations": "Daftar Kewajiban",
  "drawer.addItem": "Tambah Item / Cicilan",
  "drawer.closeForm": "Tutup Form",
  "drawer.earlier": "Majukan",
  "drawer.later": "Undurkan",

  "deficit.title": "Anggaran Kurang",
  "deficit.prefix": "Total tagihan, biaya hidup harian, dan target tabungan melebihi gaji bersih siklus ini sebesar",
  "deficit.suffix": "Penutupan periode ditunda hingga pengeluaran dikurangi, target kategori disesuaikan, atau ada pemasukan tambahan.",

  "badge.emergencyCashDeposit": "Setoran Dana Darurat",
  "badge.rdpuDeposit": "Setoran Reksa Dana RDPU",
  "badge.emergencyWithdrawal": "Penarikan Dana Darurat",
  "badge.rdpuWithdrawal": "Pencairan Reksa Dana RDPU",
  "badge.p1CoreSavings": "Tabungan Inti P1",
  "badge.paylaterSettlement": "Pelunasan PayLater",
  "badge.creditCardBill": "Tagihan Kartu Kredit",
  "badge.personalDebt": "Pinjaman Pribadi",
  "badge.routineBill": "Tagihan Rutin",
  "badge.dailyLiving": "Belanja Harian",
  "badge.incomeInflow": "Pemasukan",
  "badge.operationalRefund": "Penyesuaian Refund",
  "badge.installment": "Cicilan",

  "sub.payroll.payslip": "Mesin Gaji & Slip",
  "sub.payroll.timeline": "Linimasa & Split-Pay",
  "sub.payroll.lifeenergy": "Upah Riil & Jam Kerja",
  "sub.allocations.waterfall": "Waterfall & Kuota Rutin",
  "sub.allocations.envelopes": "Rollover Amplop & Sinking Fund",
  "sub.allocations.revisions": "Revisi Anggaran & Kunci",
  "sub.credit.matrix": "Matriks Kewajiban 12-Bulan",
  "sub.credit.contracts": "Kontrak & Optimasi Pelunasan",
  "sub.credit.simulator": "Simulasi Cutoff & Belanja Aman",
  "sub.credit.reconciler": "Rekonsiliasi Mutasi Massal",
  "sub.savings.networth": "Kekayaan Bersih & Aset Riil",
  "sub.savings.forecaster": "Proyeksi Kekayaan 12-Bulan",
  "sub.savings.vault": "Brankas P1 & Pinjam Muka",
  "sub.reports.executive": "Ringkasan Waterfall & Rasio",
  "sub.reports.variance": "Varians MoM & Audit Detail",
  "sub.reports.audit": "Audit Disiplin & Riwayat Revisi",
  "sub.reports.export": "Ekspor 4-Sheet Excel & Email",
  "sub.preferences.formula": "Formula Siklus Gaji & Waterfall",
  "sub.preferences.instruments": "Tabel Instrumen & Tanggal Cutoff",
  "sub.preferences.accounts": "Tabel Rekening Aset & Dana",
  "sub.preferences.templates": "Template Amplop & Kuota Rutin",
  "sub.preferences.navigation": "Menu Sidebar & Pintasan Kustom",
  "sub.preferences.notifications": "Email, SMTP & Penjaga Keamanan",
  "sub.preferences.ai": "Asisten AI Marquee & Webhook",

  "intel.paycycleWindow": "Siklus Gaji Aktif",
  "intel.maturitiesLabel": "Tagihan Jatuh Tempo",
  "intel.realNetWorth": "Kas & Tabungan vs Utang",
  "intel.liquidAssets": "Saldo Kas & Tabungan",
  "intel.remainingDebt": "Sisa Kewajiban Utang",
  "intel.ageOfMoney": "Ketahanan Tabungan",
  "intel.bufferDays": "Cadangan Kas",
  "intel.debtFreedom": "Target Pelunasan",
  "intel.burnVelocity": "Laju Pengeluaran Harian",
  "intel.postCutoffCreep": "Tagihan Baru Siklus Berikutnya",
  "intel.nextUnlock": "Keringanan Bulanan Berikutnya (Cicilan Lunas)",
  "intel.workHoursCost": "Jam Kerja",
  "intel.trueHourlyWage": "Upah Bersih Per Jam Riil",
  "intel.outlookTitle": "Prospek Tabungan, Laju Belanja & Pelunasan Utang",
  "intel.cashVsDebtTitle": "Kas & Tabungan vs. Sisa Utang",
  "intel.cashVsDebtHint": "Membandingkan kas likuid + Tabungan P1 (serta aset eksternal opsional) terhadap sisa utang aktif.",
  "intel.savingsRunwayHint": "Perkiraan jumlah hari cadangan kas & tabungan cukup menopang belanja pada laju saat ini.",
  "intel.burnVelocityHint": "Membandingkan persentase anggaran terpakai terhadap persentase siklus berjalan (1.00x = tepat laju).",
  "intel.paceAndCreepTitle": "Laju Pengeluaran Harian & Beban Siklus Berikutnya",
  "intel.paceAndCreepHint": "Memantau kecepatan belanja harian ditambah tagihan baru PayLater/Kartu Kredit setelah tanggal cutoff.",
  "intel.nextUnlockHint": "Arus kas bulanan yang terbuka kembali ketika cicilan kontrak selesai dalam beberapa siklus ke depan.",
  "intel.paceNormal": "Sesuai Jalur",
  "intel.paceCaution": "Agak Cepat",
  "intel.paceHigh": "Tinggi / Waspada",
  "intel.noAnomalies": "Tidak ada lonjakan belanja atau beban tak terduga pada siklus ini.",
};

const ZH_DICT: Record<TranslationKey, string> = {
  "app.title": "Sunday Funday",
  "app.subtitle": "个人财务 ERP",
  "nav.section.engine": "财务引擎",
  "nav.section.audit": "审计与决策",
  "nav.section.system": "系统",
  "nav.navigation": "导航",
  "nav.modules": "模块",
  "nav.overview": "总览",
  "nav.paydayWizard": "发薪与结账向导",
  "nav.cashRadar": "现金雷达与日历",
  "nav.payroll": "薪酬与收入",
  "nav.allocations": "预算分配",
  "nav.credit": "信用与负债",
  "nav.savings": "储蓄与金库",
  "nav.ledger": "交易流水账",
  "nav.marquee": "Marquee AI 助手",
  "nav.wishlist": "心愿单模拟器",
  "nav.audit": "纪律审计",
  "nav.analytics": "数据分析",
  "nav.reports": "财务报表",
  "nav.subscriptions": "订阅与周期支出",
  "nav.guide": "使用指南",
  "nav.preferences": "偏好设置",
  "nav.admin": "平台管理",

  "cat.dashboard": "仪表盘",
  "cat.engine": "核心引擎",
  "cat.decision": "决策",
  "cat.audit": "审计",
  "cat.system": "系统",
  "cat.spec": "规范",
  "cat.view": "视图",
  "header.adminSql": "超级管理员 SQL 查询台",
  "header.openMenu": "打开导航菜单",
  "header.closeMenu": "关闭导航菜单",

  "auth.eyebrow": "Sunday Funday ERP",
  "auth.signInTitle": "登录 ERP 工作区",
  "auth.pinTitle": "安全 PIN 码验证",
  "auth.lockedPrefix": "会话已锁定",
  "auth.signInSubtitle": "个人现金流、债务追踪与瀑布流预算系统",
  "auth.sessionExpired": "会话因长时间未操作已过期，请输入密码解锁。",
  "auth.username": "用户名或邮箱",
  "auth.usernamePlaceholder": "输入用户名",
  "auth.password": "密码",
  "auth.passwordPlaceholder": "输入密码",
  "auth.quickReAuth": "快速重新验证",
  "auth.securityPin": "6 位安全 PIN 码",
  "auth.securityPinHint": "请输入此工作区配置的 6 位安全 PIN 码。",
  "auth.deviceLabel": "设备 / 位置标签",
  "auth.devicePlaceholder": "例如：家庭工作站",
  "auth.trustIp": "信任并永久将此 IP 加入白名单",
  "auth.backToLogin": "返回账号密码登录",
  "auth.authenticating": "验证身份中...",
  "auth.transitioning": "正在进入工作区...",
  "auth.verifyPin": "验证 PIN 并进入工作区",
  "auth.unlockSession": "解锁会话",
  "auth.signInBtn": "登录工作区",
  "auth.switchAccount": "使用其他账号登录",
  "auth.demoEyebrow": "交互式评估沙盒",
  "auth.demoBtn": "体验通用演示沙盒 (Demo)",
  "auth.securityNote": "Scrypt + HMAC-SHA256 JWT 安全门控",
  "auth.securityVersion": "企业级安全加固",

  "credit.tab.overview": "额度与负债矩阵",
  "credit.tab.cards": "信用卡",
  "credit.tab.contracts": "分期合约",
  "credit.tab.killSwitches": "熔断开关与预警",
  "credit.limitTitle": "信用与债务上限控制",
  "credit.limitDesc": "基于实发薪资与 35% 安全负债红线计算周期信用上限。",
  "credit.btn.optimal": "采用最优上限",
  "credit.btn.safe": "采用安全上限",
  "credit.btn.configure": "配置周期限额",
  "credit.matrix.title": "12 个月滚动债务矩阵",
  "credit.matrix.subtitle": "点击任意 PayLater 或个人债务金额即可行内编辑，或打开明细抽屉。",
  "credit.matrix.currentPeriod": "当前周期",
  "credit.matrix.simulator": "安全消费模拟器",
  "credit.matrix.bridgeLoan": "记录过桥借款",
  "credit.matrix.sourceCol": "负债来源",
  "credit.matrix.paylater": "PayLater 账单",
  "credit.matrix.paylaterSub": "每月25日到期（15日账单日）",
  "credit.matrix.cc": "信用卡账单",
  "credit.matrix.ccSub": "每月11日到期（20日账单日）",
  "credit.matrix.personal": "个人及非正式借款",
  "credit.matrix.personalSub": "借款及 P1 储蓄回补",
  "credit.matrix.totalDue": "本期应还负债总计",

  "reports.title": "财务报告与报表",
  "reports.subtitle": "分期现金流对账表、薪酬分配验证及 3 个月流动性预测。",
  "reports.downloadExcel": "导出 Excel (.xlsx)",
  "reports.exportingExcel": "生成 Excel 中...",
  "reports.printPdf": "打印 / 保存 PDF",
  "reports.kpi.moneyIn": "周期总收入",
  "reports.kpi.debtBills": "债务与信用账单",
  "reports.kpi.livingCash": "日常运营现金",
  "reports.kpi.netSaved": "净储蓄",
  "reports.tab.cycle": "月度现金流",
  "reports.tab.forecast": "3 个月预测",
  "reports.tab.audit": "纪律与审计",
  "reports.tab.edits": "预算修订记录",
  "reports.allocationStrip": "薪酬分配比例",

  "overview.safeToSpend": "今日安全可用额度",
  "overview.upcomingLivingPool": "待开启生活预算池",
  "overview.cycleCompletedLabel": "周期已结束",
  "overview.projectedDailyRate": "预计每日额度",
  "overview.startsInDays": "距发薪还有",
  "overview.daysUnit": "天",
  "overview.prePaydayPlan": "发薪前预算规划",
  "overview.aheadOfPace": "低于日均节奏",
  "overview.overPace": "超出日均节奏",
  "overview.bridgeUntilPayday": "天后发薪 — 可在钱包核对记录当前现金",
  "overview.status.onTrack": "进度正常",
  "overview.status.caution": "注意控制",
  "overview.status.burningFast": "消耗过快",
  "overview.status.deficitRisk": "赤字风险",
  "overview.daysLeft": "天剩余",
  "overview.weekdayRate": "工作日日均限额",
  "overview.weekendRate": "周末日均限额",
  "overview.remainingCash": "剩余运营现金",
  "overview.checkpointTitle": "10 秒余额校准",
  "overview.syncBalance": "同步余额",
  "overview.cashflowSummary": "现金流摘要",
  "overview.totalNetIncome": "周期净总收入（薪酬 + 调整）",
  "overview.materializedDebt": "刚性负债与账单（优先扣除）",
  "overview.netBaseline": "瀑布流可分配基准",
  "overview.routineBills": "日常生活与固定账单",
  "overview.remainingBillsQuota": "固定账单剩余额度",
  "overview.totalMonthlyBudget": "月度预算总额",
  "overview.dailyFoodLiving": "每日餐饮及生活预算",
  "overview.partiallyFunded": "部分资金",
  "overview.unfunded": "未分配资金",
  "overview.fundedOfTarget": "已分配",
  "overview.coreSavings": "核心储蓄 (P1)",
  "overview.forwardBorrowP1": "预借 P1 储蓄",
  "overview.viewVault": "查看储蓄罐与目标",
  "overview.selfRewardBuffer": "自我奖励与应急缓冲 (P2)",
  "overview.emergencyBuffer": "应急缓冲金",
  "overview.recordExpense": "记录支出",
  "overview.dailySpend": "日常消费",
  "overview.routineBill": "固定账单",
  "overview.refundSplit": "退款 / AA分摊",
  "overview.recentTransactions": "近期交易明细",

  "drawer.totalScheduled": "本期应还总额",
  "drawer.remainingUnpaid": "尚未结清",
  "drawer.periodLocked": "周期已锁定",
  "drawer.safeHeadroom": "PayLater 安全余量",
  "drawer.itemizedBreakdown": "逐笔明细",
  "drawer.lumpSumOverride": "直接修改总额",
  "drawer.itemizedObligations": "分项债务列表",
  "drawer.addItem": "新增条目 / 分期",
  "drawer.closeForm": "收起表单",
  "drawer.earlier": "提前一期",
  "drawer.later": "延后一期",

  "deficit.title": "预算缺口",
  "deficit.prefix": "本期账单、日常开销与储蓄目标超出净收入",
  "deficit.suffix": "在削减计划支出、调整目标预算或记录额外收入之前，周期结转将保持锁定。",

  "badge.emergencyCashDeposit": "应急资金存入",
  "badge.rdpuDeposit": "货币基金存入",
  "badge.emergencyWithdrawal": "应急资金取出",
  "badge.rdpuWithdrawal": "货币基金赎回",
  "badge.p1CoreSavings": "P1 核心储蓄",
  "badge.paylaterSettlement": "PayLater 账单结算",
  "badge.creditCardBill": "信用卡账单",
  "badge.personalDebt": "个人借款",
  "badge.routineBill": "固定账单",
  "badge.dailyLiving": "日常开销",
  "badge.incomeInflow": "收入入账",
  "badge.operationalRefund": "退款冲抵",
  "badge.installment": "分期",

  "sub.payroll.payslip": "薪酬与工资条引擎",
  "sub.payroll.timeline": "多波段现金流与拆单",
  "sub.payroll.lifeenergy": "真实时薪与时间成本",
  "sub.allocations.waterfall": "瀑布流与固定预算额度",
  "sub.allocations.envelopes": "信封结转与专项准备金",
  "sub.allocations.revisions": "预算修订与锁定记录",
  "sub.credit.matrix": "12 个月负债矩阵",
  "sub.credit.contracts": "在途合约与还款策略优化",
  "sub.credit.simulator": "账单日截点与消费模拟",
  "sub.credit.reconciler": "银行流水批量解析对账",
  "sub.savings.networth": "真实净资产与账户分布",
  "sub.savings.forecaster": "12 个月财富与现金流预测",
  "sub.savings.vault": "P1 储蓄罐与预支明细",
  "sub.reports.executive": "高管瀑布流与健康指标",
  "sub.reports.variance": "环比差异与逐项审计",
  "sub.reports.audit": "纪律审计与修订日志",
  "sub.reports.export": "4 表 Excel 导出与邮件发送",
  "sub.preferences.formula": "薪资周期与瀑布流公式",
  "sub.preferences.instruments": "支付工具与账单日规则表",
  "sub.preferences.accounts": "资产账户与资金池配置表",
  "sub.preferences.templates": "常规信封与结转模板表",
  "sub.preferences.navigation": "侧边栏导航与自定义快捷入口",
  "sub.preferences.notifications": "邮件、SMTP 与安全阈值",
  "sub.preferences.ai": "Marquee AI 助手与 Webhook",

  "intel.paycycleWindow": "当前薪资周期",
  "intel.maturitiesLabel": "覆盖到期账单",
  "intel.realNetWorth": "现金储蓄与负债净额",
  "intel.liquidAssets": "现金与储蓄余额",
  "intel.remainingDebt": "未清偿债务总额",
  "intel.ageOfMoney": "储蓄续航天数",
  "intel.bufferDays": "现金缓冲",
  "intel.debtFreedom": "下一清零目标",
  "intel.burnVelocity": "每日消费节奏",
  "intel.postCutoffCreep": "下期新增账单",
  "intel.nextUnlock": "下阶段月度释压（分期结清）",
  "intel.workHoursCost": "工时",
  "intel.trueHourlyWage": "扣除通勤真实时薪",
  "intel.outlookTitle": "储蓄、消费节奏与债务清偿展望",
  "intel.cashVsDebtTitle": "现金及储蓄与剩余债务对比",
  "intel.cashVsDebtHint": "将可用现金与核心储蓄 P1（及可选外部资产）对比未还债务总额。",
  "intel.savingsRunwayHint": "按当前每日支出速度，现有现金与储蓄预计可维持的天数。",
  "intel.burnVelocityHint": "将生活预算已消耗比例对比当前周期已过天数比例（1.00x = 节奏正常）。",
  "intel.paceAndCreepTitle": "每日消费节奏与下期新增账单",
  "intel.paceAndCreepHint": "监控实时日均消费速率以及过账单日转入下周期的新增信用消费。",
  "intel.nextUnlockHint": "随着现有分期合约陆续结清，未来各月可释放的月度现金流。",
  "intel.paceNormal": "节奏正常",
  "intel.paceCaution": "略微偏快",
  "intel.paceHigh": "支出偏高",
  "intel.noAnomalies": "本周期暂未检测到异常高额支出或过账单日激增。",
};

const DICTIONARIES: Record<LocaleCode, Record<TranslationKey, string>> = {
  en: EN_DICT,
  id: ID_DICT,
  zh: ZH_DICT,
};

interface LanguageContextValue {
  locale: LocaleCode;
  language: "EN" | "ID" | "ZH";
  setLocale: (locale: LocaleCode) => void;
  t: (key: TranslationKey, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  language: "EN",
  setLocale: () => {},
  t: (key, fallback) => EN_DICT[key] ?? fallback ?? key,
});

const PHRASE_MAP: Record<string, { id: string; zh: string }> = {
  "12-Month Rolling Debt Matrix": { id: "Matriks Kewajiban 12-Bulan", zh: "12 个月滚动负债矩阵" },
  "Credit & Debt Ceiling Control": { id: "Kontrol Plafon Kredit & Utang", zh: "信用额度与负债上限控制" },
  "Configure Period Limits": { id: "Atur Batas Periode", zh: "配置本期额度" },
  "Use Optimal Ceiling": { id: "Gunakan Plafon Optimal", zh: "采用最优上限" },
  "Use Safe Ceiling": { id: "Gunakan Plafon Aman", zh: "采用安全上限" },
  "Safe-Spend Simulator": { id: "Simulator Belanja Aman", zh: "安全消费模拟器" },
  "Record Bridge Loan": { id: "Catat Pinjaman Talangan", zh: "记录过桥借款" },
  "PayLater Bills": { id: "Tagihan PayLater", zh: "PayLater 先享后付账单" },
  "Credit Card Charges": { id: "Tagihan Kartu Kredit", zh: "信用卡账单" },
  "Personal & Informal Debt": { id: "Utang Pribadi & Informal", zh: "个人及非正式借款" },
  "Total Liabilities Due": { id: "Total Kewajiban Jatuh Tempo", zh: "到期应还负债合计" },
  "Payday & THR Split-Bill Planner": { id: "Perencana Pembagian Gaji & THR", zh: "发薪与奖金分流规划" },
  "Ledger Activity & Cashflow Breakdown": { id: "Aktivitas Transaksi & Arus Kas", zh: "流水明细与现金流拆解" },
  "Bill Settlement Checklist": { id: "Daftar Pelunasan Tagihan", zh: "账单清偿核对清单" },
  "Interactive Living Quota Planner": { id: "Perencana Kuota Biaya Hidup Interaktif", zh: "交互式生活配额规划器" },
  "Daily Food & Living Quota": { id: "Kuota Harian Makan & Hidup", zh: "日常饮食与生活配额" },
  "Apply Quota": { id: "Terapkan Kuota", zh: "应用配额修订" },
  "Projected P1": { id: "Proyeksi Tabungan P1", zh: "预计 P1 储蓄" },
  "Projected P2": { id: "Proyeksi P2", zh: "预计 P2 余额" },
  "Deficit Risk": { id: "Risiko Defisit", zh: "赤字风险" },
  "Budget Revision Audit History": { id: "Riwayat Audit Revisi Anggaran", zh: "预算修订审计历史" },
  "Purchase Feasibility Comparator": { id: "Komparator Kelayakan Pembelian", zh: "购买可行性对比" },
  "Simulate Prepayment": { id: "Simulasi Pelunasan Dipercepat", zh: "模拟提前还款" },
  "Parse & Auto-Route": { id: "Analisis & Rute Otomatis", zh: "解析并自动归期" },
  "Commit Selected Rows": { id: "Simpan Baris Terpilih", zh: "提交所选流水" },
  "Save Configuration": { id: "Simpan Konfigurasi", zh: "保存配置" },
  "Reset to Default": { id: "Kembalikan ke Bawaan", zh: "恢复默认设置" },
  "Verify Live": { id: "Verifikasi Mesin", zh: "实时校验" },
  "Enable External Asset Portfolio": { id: "Aktifkan Portofolio Aset Eksternal", zh: "启用外部资产组合" },
  "Save Accounts": { id: "Simpan Rekening", zh: "保存账户" },
  "Save Table": { id: "Simpan Tabel", zh: "保存表格" },
  "Add Instrument": { id: "Tambah Instrumen", zh: "新增支付工具" },
  "Add Account": { id: "Tambah Rekening", zh: "新增资产账户" },
  "Add Shortcut": { id: "Tambah Pintasan", zh: "添加快捷方式" },
  "Save Navigation": { id: "Simpan Navigasi", zh: "保存导航" },
  "Record Expense": { id: "Catat Pengeluaran", zh: "记录支出" },
  "Sync Balance": { id: "Sinkronkan Saldo", zh: "同步钱包余额" },
  "Remaining Living Cash": { id: "Sisa Kas Hidup", zh: "剩余生活现金" },
  "Core Savings (P1)": { id: "Tabungan Inti (P1)", zh: "核心储蓄 (P1)" },
  "Self-Reward & Buffer (P2)": { id: "Self-Reward & Cadangan (P2)", zh: "自我奖励与缓冲 (P2)" },
  "Purchase Simulator & Debt Impact": { id: "Simulator Pembelian & Dampak Utang", zh: "购买模拟与负债影响" },
  "Discipline Scorecard": { id: "Kartu Skor Disiplin", zh: "纪律评分卡" },
  "Monthly Cashflow & Spending Pace": { id: "Arus Kas & Laju Belanja Bulanan", zh: "月度现金流与支出趋势" },
  "Tracked Cash & Asset Accounts": { id: "Rekening Kas & Aset Terpantau", zh: "现金与资产账户明细" },
  "Cash & Debt Balance Outlook": { id: "Proyeksi Saldo Kas & Utang", zh: "现金与债务余额展望" },
  "Routine Envelope Rollover Policy Editor": { id: "Editor Kebijakan Rollover Amplop Rutin", zh: "固定信封结转策略编辑器" },
  "Periodic Bill Set-Asides": { id: "Jadwal Dana Cadangan Berkala", zh: "专项储备金计划" },
  "Active Installment Plans": { id: "Daftar Cicilan Aktif", zh: "当前分期计划" },
  "Savings & Vaults": { id: "Tabungan & Brankas", zh: "储蓄与金库" },
  "Cash & Savings Balances": { id: "Saldo Kas & Tabungan", zh: "现金与储蓄余额" },
  "Unpaid Debt Principal": { id: "Pokok Utang Belum Lunas", zh: "未还债务本金" },
  "Debt-to-Asset Leverage": { id: "Rasio Utang terhadap Aset", zh: "资产负债杠杆率" },
  "All Unspent Envelopes Sweep to P1": { id: "Sisa Amplop Masuk P1", zh: "剩余额度转入 P1" },
  "Total Monthly Budget": { id: "Total Anggaran Bulanan", zh: "月度预算总额" },
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleCode>("en");
  const writtenNodesRef = useRef<WeakMap<Text, { orig: string; written: string }>>(new WeakMap());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as LocaleCode | null;
      if (saved === "en" || saved === "id" || saved === "zh") {
        setLocaleState(saved);
        document.documentElement.lang = saved;
      }
    } catch {}
  }, []);

  const setLocale = useCallback((next: LocaleCode) => {
    setLocaleState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      document.documentElement.lang = next;
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    let rafId = 0;

    const applyTranslation = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const txt = node as Text;
        const parent = txt.parentElement;
        if (!parent) continue;
        const tag = parent.tagName;
        if (
          tag === "SCRIPT" ||
          tag === "STYLE" ||
          tag === "CODE" ||
          tag === "PRE" ||
          parent.closest("[data-no-translate='true']")
        ) {
          continue;
        }
        const curVal = txt.nodeValue ?? "";
        const rec = writtenNodesRef.current.get(txt);
        const origRaw = rec && curVal === rec.written ? rec.orig : curVal;
        const origTrim = origRaw.trim();
        if (!origTrim) continue;

        if (locale === "en") {
          if (rec && curVal === rec.written) {
            txt.nodeValue = rec.orig;
            rec.written = rec.orig;
          }
          continue;
        }

        const hit = PHRASE_MAP[origTrim];
        if (hit) {
          const targetStr = locale === "id" ? hit.id : hit.zh;
          const replaced = origRaw.replace(origTrim, targetStr);
          writtenNodesRef.current.set(txt, { orig: origRaw, written: replaced });
          if (curVal !== replaced) {
            txt.nodeValue = replaced;
          }
        }
      }
    };

    const scheduleApply = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(applyTranslation);
    };

    applyTranslation();
    const observer = new MutationObserver(() => {
      if (locale !== "en") scheduleApply();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [locale]);

  const t = useCallback(
    (key: TranslationKey, fallback?: string): string => {
      const dict = DICTIONARIES[locale] ?? EN_DICT;
      return dict[key] ?? EN_DICT[key] ?? fallback ?? key;
    },
    [locale]
  );

  const language = locale.toUpperCase() as "EN" | "ID" | "ZH";

  return (
    <LanguageContext.Provider value={{ locale, language, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
