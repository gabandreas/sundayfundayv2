"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckSquare, RotateCcw, Search, Square, ArrowUpRight } from "lucide-react";
import { LocaleCode, useLanguage } from "@/context/LanguageContext";

interface GuideBlock {
  heading: string;
  body: string;
  formula?: string;
}

interface GuideSection {
  id: string;
  code: string;
  title: string;
  summary: string;
  targetHref: string;
  targetLabel: string;
  blocks: GuideBlock[];
}

interface ChecklistGroup {
  id: string;
  cadence: string;
  title: string;
  items: { id: string; text: string }[];
}

interface LocalizedGuideContent {
  title: string;
  subtitle: string;
  searchPlaceholder: string;
  noResults: string;
  sectionsLabel: string;
  checklistsTitle: string;
  checklistsSubtitle: string;
  resetChecklist: string;
  sections: GuideSection[];
  checklists: ChecklistGroup[];
}

const GUIDE_CONTENT: Record<LocaleCode, LocalizedGuideContent> = {
  en: {
    title: "Operations Manual & Domain Guide",
    subtitle: "Operating procedures, cycle conventions, cutoff boundaries, and audit workflows for Sunday Funday ERP.",
    searchPlaceholder: "Filter manual by keyword (e.g. cutoff, 15th, bridge loan, sync balance, savings)...",
    noResults: "No manual sections or procedures match your search query.",
    sectionsLabel: "Core Operating Sections",
    checklistsTitle: "Interactive Operating Checklists",
    checklistsSubtitle: "Track routine reconciliation and close steps locally in this browser.",
    resetChecklist: "Reset",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "Payday-to-Payday Cycle & Surplus Waterfall",
        summary: "How monthly cycles align paychecks to maturity month obligations and allocate disposable surplus.",
        targetHref: "/allocations",
        targetLabel: "Open Monthly Plan",
        blocks: [
          {
            heading: "Maturity-Month Cycle Convention",
            body: "Each named period M/YYYY starts on the prior month's payday and runs until the day before this month's payday, funding obligations maturing within month M (e.g. Nov 2026 runs 28 Oct–26 Nov and pays November bills).",
          },
          {
            heading: "Upfront Fixed Essentials",
            body: "Materialized credit & debt bills (PayLater, Credit Cards, Personal Debt) plus active routine quotas (Transport, Internet, etc.) and the Daily Living pool are reserved upfront before surplus allocation begins.",
            formula: "Disposable Pool = Total Pool Income - Total Debt & Bills - Routine Quotas - Daily Living Allocation",
          },
          {
            heading: "Core Savings Reserve & Discretionary",
            body: "Remaining surplus fills Core Savings Reserve first up to your target cap, then spills into Discretionary. Locked or manual-override cycles keep historical living and savings caps fixed across automated recalculations.",
          },
        ],
      },
      {
        id: "daily-operations",
        code: "02",
        title: "Daily Operations: Log Expense vs Bank Balance Sync",
        summary: "Choosing between real-time transaction logging and fast bank balance updates.",
        targetHref: "/",
        targetLabel: "Open Overview",
        blocks: [
          {
            heading: "Log Expense (Itemized Entry)",
            body: "Use Log Expense whenever you want an explicit ledger row (category, merchant, note) deducted directly from the active cycle's Remaining Spending Balance.",
          },
          {
            heading: "Bank Balance Sync",
            body: "Compare your actual bank balance against your system Remaining Spending Balance. If actual balance is lower, a single Balance Adjustment reconciles the gap without inventing false itemized receipts.",
            formula: "Adjustment = System Remaining Balance - Actual Bank Balance",
          },
          {
            heading: "Invariant Guarantee",
            body: "Sync Balance never alters Core Savings Reserve or Discretionary funds, and under manual-override cycles anchors directly on your set daily operational pool.",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "Liabilities, Statement Cutoffs & Bridge Loans",
        summary: "Billing statement cutoff dates, dual-mode schedule editing, and liquidity bridge loans.",
        targetHref: "/credit",
        targetLabel: "Open Installments & Bills",
        blocks: [
          {
            heading: "PayLater (M-15d Cutoff) & Credit Card (25th Cutoff)",
            body: "PayLater closes dynamically on daysInMonth(M) - 15 (15th in 30d months, 16th in 31d months, due 25th). Credit Card billing closes per your configured cutoff day (default 25th, due 11th of the following month).",
          },
          {
            heading: "Dual-Mode Bill Schedule",
            body: "Click any PayLater or Personal Debt cell in the Bill Schedule for instant inline editing, or open the side detail drawer to itemize charges, split amounts across cutoffs, or delete items.",
          },
          {
            heading: "Bridge Loans & Liquidity Injections",
            body: "Recording a Bridge Loan credits total cash inflow directly without polluting recurring Payroll Extra Income or creating duplicate income rows, while scheduling installments inside Personal & Informal Debt.",
            formula: "Total Cycle Inflow = Net Take-Home Pay + Extra Income + Bridge Inflow",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "Temporary Savings Advance, Wishlist & Reports",
        summary: "Borrowing from Core Savings with scheduled repayments, purchase modeling, and statement exports.",
        targetHref: "/reports",
        targetLabel: "Open Reports",
        blocks: [
          {
            heading: "Temporary Savings Advance & Automatic Repayment",
            body: "Drawing cash from active Core Savings reduces current cycle savings immediately and writes an explicit repayment item into your chosen future Personal & Informal Debt cycle so savings restore on payday.",
          },
          {
            heading: "Wishlist Affordability Comparator",
            body: "Test any saved Wishlist item or custom amount side-by-side across Cash (Discretionary), PayLater (1x/3x/6x), and Credit Card (3x/6x/12x) using before/after cutoff timing to preview resulting Debt-to-Income Ratio.",
          },
          {
            heading: "4-Sheet Excel & A4 PDF Statements",
            body: "Reports generates a 4-sheet workbook (Executive Summary, Due-Date & Settlement Schedule, Active Contracts Burn-Down, Line-Item Audit Ledger) plus an A4 print stylesheet.",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "Payroll Calendar, Statement Import, Scenario Lab & Preferences",
        summary: "Two-stage corporate payroll schedule, CSV statement import (/import), 12-month what-if simulation (/scenarios), and 6-tab Preferences.",
        targetHref: "/preferences",
        targetLabel: "Open Preferences",
        blocks: [
          {
            heading: "Paycycle Horizon Law & Go Calculation Engines",
            body: "Every cycle anchors on Payslip Drop -> HR Review Lag -> Payday (with automatic holiday/weekend shift) and funds daily living through the day before next payday. Integer-safe Go engines drive Cash vs Debt Runway, Scenario Simulation, Burn Pace alerts, Envelope Rollovers, and CSV Auto-Reconciliation.",
          },
          {
            heading: "6-Tab Preferences Studio",
            body: "Configure formula rules, priority naming, payment instruments & bank accounts, routine rollover templates, display language & password security, promo kill-switch alerts & SMTP, and full JSON backup/restore.",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "Payday & Closing, Cash Calendar & Marquee (Alt+M)",
        summary: "4-step monthly closing checklist, Lowest Cash Point calendar, debt payoff optimizer, and AI assistant.",
        targetHref: "/marquee",
        targetLabel: "Open Marquee AI",
        blocks: [
          {
            heading: "3-State Daily Pacing & Active Period Detection",
            body: "The ERP automatically opens on your earliest open draft cycle, skipping closed cycles. Before payday arrives, Daily Pacing enters PRE_PAYDAY (Day 0 + countdown), transitions to ACTIVE during the window, and settles after cycle end.",
          },
          {
            heading: "Payday & Closing (/payday-wizard) & Cash Calendar (/calendar)",
            body: "Run the 4-step payday checklist each month to confirm working days, close the prior cycle, settle scheduled bills, and confirm Core Savings deposits. Use Cash Calendar to inspect your Lowest Cash Point date before next payday.",
          },
          {
            heading: "Marquee AI Co-Pilot (Alt+M) & Webhook",
            body: "Press Alt+M anywhere to open the Marquee drawer. Supports fast deterministic NLU in EN/ID/ZH plus live LLM reasoning (DeepSeek / Gemini / Groq) and authenticated webhook logging.",
          },
        ],
      },
    ],
    checklists: [
      {
        id: "daily-sop",
        cadence: "DAILY",
        title: "Daily Reconciliation SOP",
        items: [
          { id: "d1", text: "Check Safe-to-Spend Today & Remaining Days on Overview." },
          { id: "d2", text: "Log major discretionary purchases or run 10-second Sync Balance before sleep." },
          { id: "d3", text: "Confirm pacing stays ON_TRACK and avoid unplanned paylater checkouts." },
        ],
      },
      {
        id: "weekly-sop",
        cadence: "WEEKLY",
        title: "Weekly Cutoff & Ledger Audit",
        items: [
          { id: "w1", text: "Inspect upcoming SPayLater (15th/16th) or Permata Credit Card (25th) cutoff transactions." },
          { id: "w2", text: "Review Transaction Ledger entries and remove any accidental test/duplicate entries." },
          { id: "w3", text: "Check Active Contracts & MatrixCellDrawer totals in Credit & Liabilities." },
        ],
      },
      {
        id: "payday-sop",
        cadence: "MONTHLY",
        title: "Payday Close & Cycle Rollover",
        items: [
          { id: "m1", text: "Verify attendance days (16th–15th cutoff) and net salary on Payroll & Income." },
          { id: "m2", text: "Confirm next month Routine Bills Quota (remove finished one-off bills)." },
          { id: "m3", text: "Review Discipline Audit score and archive A4 PDF / 4-sheet Excel statement." },
        ],
      },
    ],
  },
  id: {
    title: "Panduan Operasional & Aturan Domain",
    subtitle: "Prosedur harian, konvensi siklus gaji, batas tanggal tagihan (cutoff), dan alur audit Sunday Funday ERP.",
    searchPlaceholder: "Cari panduan berdasarkan kata kunci (cth. cutoff, talangan, sync balance, tabungan)...",
    noResults: "Tidak ada bagian panduan yang cocok dengan kata kunci pencarian Anda.",
    sectionsLabel: "Bagian Operasional Inti",
    checklistsTitle: "Daftar Periksa (SOP) Interaktif",
    checklistsSubtitle: "Tandai langkah rekonsiliasi rutin dan tutup buku bulanan secara lokal di browser.",
    resetChecklist: "Atur Ulang",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "Siklus Gajian-ke-Gajian & Urutan Alokasi Surplus",
        summary: "Bagaimana periode gaji memetakan pemasukan untuk melunasi tagihan bulan jatuh tempo terkait.",
        targetHref: "/allocations",
        targetLabel: "Buka Rencana Bulanan",
        blocks: [
          {
            heading: "Konvensi Siklus Bulan Jatuh Tempo",
            body: "Periode bernama M/YYYY dimulai pada hari gajian bulan M-1 dan berjalan hingga sehari sebelum gajian bulan M, mendanai kewajiban yang jatuh tempo di bulan M (mis. Nov 2026 berjalan 28 Okt–26 Nov).",
          },
          {
            heading: "Pengeluaran Tetap di Awal",
            body: "Tagihan kredit/utang terverifikasi (PayLater, Kartu Kredit, Utang Pribadi), kuota rutin, dan dana Operasional Harian disisihkan terlebih dahulu sebelum pembagian tabungan dan surplus.",
            formula: "Sisa Dana Bebas = Total Pemasukan - Total Utang & Tagihan - Kuota Rutin - Anggaran Hidup Harian",
          },
          {
            heading: "Tabungan Inti & Surplus Fleksibel",
            body: "Surplus mengalir ke Tabungan Inti hingga batas target, lalu sisanya masuk ke Surplus Fleksibel. Siklus yang dikunci atau di-override menjaga nilai anggaran historis tetap utuh saat hitung ulang.",
          },
        ],
      },
      {
        id: "daily-operations",
        code: "02",
        title: "Operasional Harian: Catat Pengeluaran vs Sync Balance",
        summary: "Kapan mencatat transaksi satu per satu dan kapan menggunakan kalibrasi saldo dompet 10 detik.",
        targetHref: "/",
        targetLabel: "Buka Ringkasan",
        blocks: [
          {
            heading: "Catat Pengeluaran (Log Expense)",
            body: "Gunakan tombol Catat Pengeluaran saat ingin membukukan transaksi spesifik lengkap dengan catatan agar langsung memotong Sisa Kas Hidup.",
          },
          {
            heading: "Kalibrasi Saldo 10 Detik (Sync Balance)",
            body: "Bandingkan total uang tunai + saldo rekening aktual Anda terhadap Sisa Kas Hidup di sistem. Selisih kurang otomatis dicatat sebagai penyesuaian saldo tanpa merekayasa struk fiktif.",
            formula: "Penyesuaian = Sisa Kas Hidup Sistem - Saldo Aktual Dompet",
          },
          {
            heading: "Jaminan Isolasi Tabungan",
            body: "Sync Balance tidak pernah menggerus Tabungan Inti maupun Surplus Fleksibel, dan pada siklus override selalu memakai plafon harian yang telah ditetapkan.",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "Kewajiban, Cutoff Tagihan & Pinjaman Talangan",
        summary: "Aturan perpindahan siklus PayLater/Kartu Kredit, edit jadwal tagihan, dan suntikan bridge loan.",
        targetHref: "/credit",
        targetLabel: "Buka Cicilan & Tagihan",
        blocks: [
          {
            heading: "PayLater (Cutoff M-15 hari) & Kartu Kredit (Cutoff tgl 25)",
            body: "PayLater tutup buku otomatis pada hari ke-(jumlahHariBulan - 15) dengan jatuh tempo tgl 25. Kartu Kredit memakai tanggal cutoff pada Preferensi dengan jatuh tempo bulan berikutnya.",
          },
          {
            heading: "Jadwal Tagihan Dua Mode",
            body: "Klik angka sel PayLater atau Utang Pribadi untuk edit total seketika, atau buka panel rincian untuk memecah item melewati tanggal cutoff.",
          },
          {
            heading: "Pinjaman Talangan (Bridge Loan)",
            body: "Mencatat Bridge Loan menambah dana masuk siklus aktif tanpa mencemari komponen gaji ekstra maupun membuat baris transaksi ganda.",
            formula: "Total Dana Masuk = Gaji Bersih + Pemasukan Tambahan + Suntikan Talangan",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "Talangan Tabungan, Simulasi Wishlist & Laporan",
        summary: "Mekanisme talangan sementara dari Tabungan Inti, perbandingan opsi cicilan, dan ekspor PDF/Excel.",
        targetHref: "/reports",
        targetLabel: "Buka Laporan",
        blocks: [
          {
            heading: "Talangan & Pengembalian Tabungan Inti",
            body: "Menarik sementara dari Tabungan Inti mengurangi tabungan periode ini dan otomatis menanam kewajiban pengembalian di Utang Pribadi periode berikutnya agar tabungan pulih saat gajian.",
          },
          {
            heading: "Komparator Kelayakan Wishlist",
            body: "Bandingkan pembelian Tunai dari Surplus Fleksibel, PayLater (1x/3x/6x), dan Kartu Kredit (3x/6x/12x) lengkap dengan simulasi tanggal cutoff dan proyeksi Rasio Utang.",
          },
          {
            heading: "Excel 4-Sheet & Cetak PDF A4",
            body: "Halaman Laporan mengekspor workbook Excel 4-lembar lengkap serta mendukung cetak PDF A4 rapi.",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "Kalender Gaji 2-Tahap, Impor Mutasi, Lab Skenario & Preferensi",
        summary: "Siklus Payday-ke-Payday, impor CSV mutasi (/import), simulasi skenario 12 bulan (/scenarios), dan 6 tab pengaturan.",
        targetHref: "/preferences",
        targetLabel: "Buka Preferensi",
        blocks: [
          {
            heading: "Hukum Siklus Gaji & Mesin Kalkulasi Go",
            body: "Setiap periode berjangkar dari tanggal slip gaji hingga hari transfer aktual (dengan penyesuaian akhir pekan). Mesin Go menghitung proyeksi kekayaan, deteksi laju belanja, rollover amplop, optimasi utang, upah per jam riil, dan rekonsiliasi mutasi CSV.",
          },
          {
            heading: "Preferensi Modular 6-Tab",
            body: "Atur rumus siklus, nama tingkat prioritas, metode pembayaran, rekening aset, template tagihan rutin, ubah kata sandi & bahasa, pengingat promo + SMTP, serta cadangan JSON database.",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "Hari Gajian & Tutup Siklus, Kalender Arus Kas & Marquee (Alt+M)",
        summary: "Checklist tutup buku 4-langkah, kalender Titik Kas Terendah, prioritas bunga pinjaman, dan asisten AI.",
        targetHref: "/marquee",
        targetLabel: "Buka Marquee AI",
        blocks: [
          {
            heading: "Pacing 3-Status & Periode Aktif Otomatis",
            body: "Sistem otomatis membuka siklus DRAFT terawal setelah siklus sebelumnya dikunci. Sebelum gajian tiba status berada pada PRE_PAYDAY, lalu aktif saat siklus berjalan.",
          },
          {
            heading: "Hari Gajian & Tutup Siklus (/payday-wizard) & Kalender Arus Kas (/calendar)",
            body: "Jalankan 4 langkah checklist bulanan untuk memverifikasi hari kerja, mengunci siklus sebelumnya, melunasi tagihan jatuh tempo, dan mengonfirmasi setoran tabungan.",
          },
          {
            heading: "Asisten AI Marquee (Alt+M) & Webhook",
            body: "Tekan Alt+M dari mana saja untuk membuka laci Marquee dengan NLU cepat (EN/ID/ZH) dan integrasi LLM live.",
          },
        ],
      },
    ],
    checklists: [
      {
        id: "daily-sop",
        cadence: "HARIAN",
        title: "SOP Rekonsiliasi Harian",
        items: [
          { id: "d1", text: "Cek batas aman belanja hari ini & sisa hari kerja pada halaman Ringkasan." },
          { id: "d2", text: "Catat pengeluaran besar atau lakukan Sync Balance 10 detik sebelum istirahat." },
          { id: "d3", text: "Pastikan status pacing tetap ON_TRACK sebelum menambah belanja konsumtif." },
        ],
      },
      {
        id: "weekly-sop",
        cadence: "MINGGUAN",
        title: "Audit Cutoff & Buku Besar Mingguan",
        items: [
          { id: "w1", text: "Periksa transaksi mendekati tanggal cutoff 15 (SPayLater) dan 20 (Kartu Kredit)." },
          { id: "w2", text: "Audit Buku Transaksi untuk memastikan tidak ada catatan ganda." },
          { id: "w3", text: "Tinjau rincian item pada Matriks Utang 12-Bulan & Kontrak Cicilan." },
        ],
      },
      {
        id: "payday-sop",
        cadence: "BULANAN",
        title: "Tutup Buku & Pergantian Siklus Gajian",
        items: [
          { id: "m1", text: "Verifikasi jumlah hari masuk (cutoff 16–15) dan gaji bersih pada Gaji & Pemasukan." },
          { id: "m2", text: "Pastikan Kuota Tagihan Rutin periode baru bersih dari tagihan satu kali (one-off)." },
          { id: "m3", text: "Periksa skor Audit Disiplin dan unduh arsip Excel (.xlsx) / PDF A4." },
        ],
      },
    ],
  },
  zh: {
    title: "系统操作手册与领域规则指南",
    subtitle: "Sunday Funday 个人财务 ERP 的账期规则、账单日逻辑、对账流程与月结标准。",
    searchPlaceholder: "按关键词搜索手册（如 cutoff、bridge loan、sync balance、储蓄）...",
    noResults: "未找到与搜索条件匹配的手册章节或检查项。",
    sectionsLabel: "核心操作规范",
    checklistsTitle: "交互式日常操作检查单",
    checklistsSubtitle: "在本地浏览器记录您的每日、每周及发薪日对账完成进度。",
    resetChecklist: "重置",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "发薪日至发薪日周期与盈余分配顺序",
        summary: "账期如何按账单到期月份对齐现金流，并依次分配核心储蓄与灵活盈余。",
        targetHref: "/allocations",
        targetLabel: "前往月度分配计划",
        blocks: [
          {
            heading: "到期月归属周期规则",
            body: "周期 M/YYYY 从上月发薪日起至本月发薪日前一日止，用于支付本月 M 内的全部到期账单（如 11/2026 覆盖 10月28日至11月26日）。",
          },
          {
            heading: "前置刚性支出与日常预算",
            body: "系统优先扣除已确认负债（PayLater、信用卡、个人借款）、固定日常配额及每日生活运营资金池。",
            formula: "可分配盈余 = 周期总入账 - 负债账单总额 - 固定日常配额 - 日常运营资金池",
          },
          {
            heading: "核心储蓄与灵活盈余",
            body: "净盈余优先填充核心储蓄至目标上限，剩余部分归入灵活盈余池。已锁定或手动覆写周期保持核心储蓄与日常额度锁定。",
          },
        ],
      },
      {
        id: "daily-operations",
        code: "02",
        title: "日常操作：逐笔记录 vs 10秒余额同步",
        summary: "明确何时记录明细交易，何时使用钱包余额校准消除小额漏记误差。",
        targetHref: "/",
        targetLabel: "前往总览",
        blocks: [
          {
            heading: "记录消费 (Log Expense)",
            body: "当需要保留商户分类与备注时，使用记录支出记入流水账，系统实时扣减当前周期的剩余运营现金。",
          },
          {
            heading: "10秒余额校准 (Sync Balance)",
            body: "核对真实钱包/银行卡余额与系统剩余可用金额。若实际余额较低，系统生成一笔余额校准扣减，避免手补琐碎账单。",
            formula: "校准差额 = 系统剩余运营现金 - 钱包实际余额",
          },
          {
            heading: "储蓄隔离保护",
            body: "余额同步永远不会动用核心储蓄或灵活盈余池，在手动锁定期内严格锚定既定日常预算上限。",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "负债管理、账单截点与过桥借款",
        summary: "账单日滚动规则、双模式日程表编辑及过桥资金处理机制。",
        targetHref: "/credit",
        targetLabel: "前往分期与账单",
        blocks: [
          {
            heading: "PayLater 与信用卡账单截点",
            body: "PayLater 在每月天数减 15 日结账（次月25日到期）；信用卡按预设账单日结账（次月11日到期）。",
          },
          {
            heading: "双模式账单日程表",
            body: "点击 PayLater 或个人负债单元格即可行内修改总额，或打开侧边抽屉拆分跨期金额、增删明细项。",
          },
          {
            heading: "过桥借款 (Bridge Loan)",
            body: "登记过桥借款仅计入周期总入账并自动排期到个人债务表，不污染薪酬页面的额外收入统计。",
            formula: "周期总入账 = 实发薪资 + 额外收入 + 过桥资金注入",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "临时储蓄预支、心愿单比较与报表导出",
        summary: "核心储蓄应急拆借回补规则、三方案消费测算以及 Excel 与 A4 PDF 导出。",
        targetHref: "/reports",
        targetLabel: "前往财务报表",
        blocks: [
          {
            heading: "核心储蓄借支与自动回补",
            body: "临时预支会扣减本期储蓄，同时在下期个人借款中登记一笔应还回补义务。",
          },
          {
            heading: "心愿单可行性三方案对比",
            body: "支持对比灵活现金、PayLater (1x/3x/6x) 与信用卡 (3x/6x/12x) 在截点前后的负债率影响。",
          },
          {
            heading: "4 工作表 Excel 与 A4 行政报告",
            body: "报表中心支持一键导出含 4 个工作表的 .xlsx 文件及标准 A4 打印视图。",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "发薪日历、账单导入、情景实验室与 6 Tab 系统设置",
        summary: "发薪周期法则、CSV 对账导入 (/import)、12个月情景预测 (/scenarios) 与模块化系统设置。",
        targetHref: "/preferences",
        targetLabel: "打开系统设置",
        blocks: [
          {
            heading: "薪资周期与 Go 纯整数计算引擎",
            body: "核心引擎实时驱动净值趋势、12个月情景预测、支出速度警报、信封结转、雪崩还债优化及账单批量对账导入。",
          },
          {
            heading: "6 大系统设置面板",
            body: "随时自定义公式与优先级标签、支付方式与账户、固定预算模板、语言显示与修改密码、订阅提醒及数据备份恢复。",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "发薪与结账、现金流日历与 Marquee 助手 (Alt+M)",
        summary: "四步发薪结账清单、最低现金点日历与三层确定性财务助手。",
        targetHref: "/marquee",
        targetLabel: "打开 Marquee",
        blocks: [
          {
            heading: "三态消费节奏与智能默认账期",
            body: "系统自动跳转至最早未锁定的草稿账期，在发薪前展示预备状态与倒计时。",
          },
          {
            heading: "发薪与结账 (/payday-wizard) 与现金流日历 (/calendar)",
            body: "每月按四步清单核对出勤天数、结转上一周期、清偿到期账单并确认储蓄划转。",
          },
          {
            heading: "Marquee AI 助手 (Alt+M)",
            body: "随时按 Alt+M 呼出顶层抽屉，支持三语快速记账解析及实时大模型问答。",
          },
        ],
      },
    ],
    checklists: [
      {
        id: "daily-sop",
        cadence: "每日",
        title: "每日睡前对账 SOP",
        items: [
          { id: "d1", text: "在总览页确认今日安全消费限额及剩余天数。" },
          { id: "d2", text: "补录大额消费或执行 10 秒 Sync Balance 校准实际余额。" },
          { id: "d3", text: "确认消费速度保持在 ON_TRACK 状态，避免冲动分期。" },
        ],
      },
      {
        id: "weekly-sop",
        cadence: "每周",
        title: "每周账单截点与流水审计",
        items: [
          { id: "w1", text: "检查临近 15 日 (SPayLater) 与 20 日 (信用卡) 的账单跨期标记。" },
          { id: "w2", text: "浏览交易流水账，核销误操作或重复录入记录。" },
          { id: "w3", text: "核对 12 个月负债矩阵与生效中的分期合约余额。" },
        ],
      },
      {
        id: "payday-sop",
        cadence: "每月",
        title: "发薪日关账与新周期启动",
        items: [
          { id: "m1", text: "在薪酬页面核对 16–15 日考勤出勤天数与净到账薪资。" },
          { id: "m2", text: "确认新周期固定账单配额中已清除上期一次性账单。" },
          { id: "m3", text: "查看纪律审计评分并归档 4 表 Excel 或 A4 PDF 财务报表。" },
        ],
      },
    ],
  },
};

const STORAGE_KEY = "erp_guide_sop_checks_v1";

export function UserGuideClientView({ month, year }: { month: number; year: number }) {
  const { locale, setLocale } = useLanguage();
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCheckedMap(JSON.parse(saved));
      }
    } catch {
      // Ignore storage failures
    }
  }, []);

  const toggleCheck = (key: string) => {
    setCheckedMap((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  };

  const resetChecklistGroup = (group: ChecklistGroup) => {
    setCheckedMap((prev) => {
      const next = { ...prev };
      for (const item of group.items) {
        delete next[`${group.id}:${item.id}`];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures
      }
      return next;
    });
  };

  const content = GUIDE_CONTENT[locale] ?? GUIDE_CONTENT.en;
  const query = searchQuery.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    if (!query) return content.sections;
    return content.sections.filter(
      (sec) =>
        sec.title.toLowerCase().includes(query) ||
        sec.summary.toLowerCase().includes(query) ||
        sec.blocks.some(
          (b) =>
            b.heading.toLowerCase().includes(query) ||
            b.body.toLowerCase().includes(query) ||
            (b.formula?.toLowerCase().includes(query) ?? false)
        )
    );
  }, [content.sections, query]);

  const filteredChecklists = useMemo(() => {
    if (!query) return content.checklists;
    return content.checklists.filter(
      (grp) =>
        grp.title.toLowerCase().includes(query) ||
        grp.cadence.toLowerCase().includes(query) ||
        grp.items.some((it) => it.text.toLowerCase().includes(query))
    );
  }, [content.checklists, query]);

  const hrefWithPeriod = (base: string) => `${base}?month=${month}&year=${year}`;

  return (
    <div className="w-full max-w-full space-y-6 pb-10">
      {/* Header & Language Switch + Search */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-text-tertiary">
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            <span>Sunday Funday · Standard Operating Procedures</span>
          </div>
          <h1 className="font-display text-3xl font-normal tracking-tight text-text-primary">
            {content.title}
          </h1>
          <p className="text-xs font-sans text-text-secondary max-w-2xl">
            {content.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <div className="inline-flex rounded border border-border bg-surface p-0.5 text-[11px] font-mono">
            {(["en", "id", "zh"] as LocaleCode[]).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer ${
 locale === code
 ?"bg-surface-active text-text-primary font-semibold"
 :"text-text-tertiary hover:text-text-secondary"
 }`}
              >
                {code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={content.searchPlaceholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-md bg-surface border border-border text-xs font-sans text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus:border-accent/60"
        />
      </div>

      {filteredSections.length === 0 && filteredChecklists.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-10 text-center text-xs font-sans text-text-tertiary">
          {content.noResults}
        </div>
      ) : (
        <>
          {/* Operating Sections */}
          {filteredSections.length > 0 && (
            <div className="space-y-4">
              <div className="text-[11px] font-mono text-text-tertiary">
                {content.sectionsLabel}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredSections.map((section) => (
                  <section
                    key={section.id}
                    className="rounded-lg border border-border bg-surface p-5 space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border-subtle">
                        <div>
                          <span className="text-[10px] font-mono text-accent tracking-normal">
                            Section {section.code}
                          </span>
                          <h2 className="text-sm font-semibold font-sans text-text-primary mt-0.5">
                            {section.title}
                          </h2>
                          <p className="text-xs font-sans text-text-tertiary mt-1">
                            {section.summary}
                          </p>
                        </div>
                        <Link
                          href={hrefWithPeriod(section.targetHref)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-surface-subtle hover:bg-surface-active text-[11px] font-mono text-text-secondary hover:text-text-primary transition-colors shrink-0"
                        >
                          <span>{section.targetLabel}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </Link>
                      </div>

                      <div className="space-y-3">
                        {section.blocks.map((block, idx) => (
                          <div key={idx} className="space-y-1">
                            <h3 className="text-xs font-semibold font-sans text-text-primary">
                              {block.heading}
                            </h3>
                            <p className="text-xs font-sans text-text-secondary leading-relaxed">
                              {block.body}
                            </p>
                            {block.formula && (
                              <div className="mt-1.5 px-3 py-1.5 rounded bg-surface-subtle border border-border-subtle font-mono text-[11px] text-text-primary">
                                {block.formula}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* Section 5: Interactive Checklists */}
          {filteredChecklists.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border pt-5">
                <div>
                  <span className="text-[10px] font-mono text-accent tracking-normal">
                    Section 05
                  </span>
                  <h2 className="text-sm font-semibold font-sans text-text-primary">
                    {content.checklistsTitle}
                  </h2>
                  <p className="text-xs font-sans text-text-tertiary">
                    {content.checklistsSubtitle}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {filteredChecklists.map((group) => {
                  const completedCount = group.items.filter(
                    (it) => Boolean(checkedMap[`${group.id}:${it.id}`])
                  ).length;
                  const totalCount = group.items.length;

                  return (
                    <div
                      key={group.id}
                      className="rounded-lg border border-border bg-surface p-4 space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border-subtle">
                          <div>
                            <span className="text-[10px] font-mono text-text-tertiary block">
                              {group.cadence} · {completedCount}/{totalCount}
                            </span>
                            <h3 className="text-xs font-semibold font-sans text-text-primary mt-0.5">
                              {group.title}
                            </h3>
                          </div>
                          {completedCount > 0 && (
                            <button
                              type="button"
                              onClick={() => resetChecklistGroup(group)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border-subtle text-[10px] font-mono text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>{content.resetChecklist}</span>
                            </button>
                          )}
                        </div>

                        <div className="space-y-2">
                          {group.items.map((item) => {
                            const key = `${group.id}:${item.id}`;
                            const isChecked = Boolean(checkedMap[key]);
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleCheck(key)}
                                className="w-full text-left flex items-start gap-2.5 p-2 rounded hover:bg-surface-subtle transition-colors cursor-pointer"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-delta-positive shrink-0 mt-0.5" />
                                ) : (
                                  <Square className="w-4 h-4 text-text-tertiary shrink-0 mt-0.5" />
                                )}
                                <span
                                  className={`text-xs font-sans leading-snug ${
                                    isChecked
                                      ? "line-through text-text-tertiary"
                                      : "text-text-secondary"
                                  }`}
                                >
                                  {item.text}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
