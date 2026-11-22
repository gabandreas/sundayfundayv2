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
    searchPlaceholder: "Filter manual by keyword (e.g. cutoff, 15th, bridge loan, sync balance, P1)...",
    noResults: "No manual sections or procedures match your search query.",
    sectionsLabel: "Core Operating Sections",
    checklistsTitle: "Interactive Operating Checklists",
    checklistsSubtitle: "Track routine reconciliation and close steps locally in this browser.",
    resetChecklist: "Reset",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "28th–26th Payday Cycle & Two-Priority Waterfall",
        summary: "How monthly cycles map paychecks to next-month bill due dates and allocate disposable surplus.",
        targetHref: "/allocations",
        targetLabel: "Open Allocations",
        blocks: [
          {
            heading: "Payday-to-Bill Cycle Convention",
            body: "Period M/YYYY is funded by the late-month paycheck (~27th/28th of month M) and runs until the day before period M+1's payout date. Bills due in calendar month M+1 are settled out of period M cashflow (e.g. OCT '26 covers 28 Oct–26 Nov and pays November bills).",
          },
          {
            heading: "Upfront Fixed Essentials",
            body: "Materialized credit & debt bills (PayLater, Credit Cards, Personal Debt) plus active routine quotas (Transport, Internet, Vape, Haircut) and the Daily Operational Living pool are reserved upfront before Priority allocation begins.",
            formula: "Disposable Pool = Total Pool Income - Total Debt & Bills - Routine Quotas - Daily Living Allocation",
          },
          {
            heading: "Priority 1 (Core Savings) & Priority 2 (Self-Reward)",
            body: "Remaining surplus fills Priority 1 Core Savings first up to your target cap, then spills into Priority 2 Self-Reward. Periods flagged with isManualOverride lock P1/P2/Daily Living values across automated recalculations.",
          },
        ],
      },
      {
        id: "daily-operations",
        code: "02",
        title: "Daily Operations: Log Expense vs Sync Balance",
        summary: "Choosing between real-time transaction logging and fast end-of-day wallet checkpoints.",
        targetHref: "/",
        targetLabel: "Open Overview",
        blocks: [
          {
            heading: "Log Expense (Itemized Entry)",
            body: "Use Log Expense whenever you want an explicit ledger row (category, merchant, note) deducted directly from the active cycle's Remaining Living Cash.",
          },
          {
            heading: "10-Second Sync Balance Checkpoint",
            body: "Compare your actual physical + bank wallet cash against system Remaining Living Cash. If actual cash is lower, a single Balance Checkpoint: Unitemized Daily Spend deduction reconciles the gap without inventing false itemized receipts.",
            formula: "Adjustment = System Remaining Living Cash - Actual Wallet Cash",
          },
          {
            heading: "Invariant Guarantee",
            body: "Sync Balance never alters Priority 1 Core Savings or Priority 2 Self-Reward, and under manual-override cycles uses actualDailyOperational directly as the living pool ceiling.",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "Liabilities, 15th/20th Cutoffs & Bridge Loans",
        summary: "Billing statement cutoff dates, dual-mode debt matrix editing, and liquidity bridge loans.",
        targetHref: "/credit",
        targetLabel: "Open Credit & Matrix",
        blocks: [
          {
            heading: "SPayLater (15th Cutoff) & Credit Card (20th Cutoff)",
            body: "SPayLater orders settled on day <= 15 hit that purchase month's statement (due 25th); orders > 15th or toggled Hold Past Cutoff roll into purchaseMonth + 1. Credit Card charges follow a 20th cutoff (due 11th).",
          },
          {
            heading: "Dual-Mode Debt Matrix",
            body: "Click any PayLater or Personal Debt cell in the 12-Month Matrix for instant inline editing, or open the side MatrixCellDrawer to itemize charges, split amounts across cutoffs, or delete individual items while maintaining 100% parity with MonthlyBulkBill.",
          },
          {
            heading: "Bridge Loans & Liquidity Injections",
            body: "Recording a Bridge Loan credits MonthlySnapshot.bridgeInflowAmount directly into total cash inflow without polluting recurring Payroll Extra Income or creating duplicate INCOME rows, while scheduling installments inside Personal & Informal Debt.",
            formula: "Total Cycle Inflow = Net Take-Home Pay + Extra Income + Bridge Inflow",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "P1 Borrow, Wishlist Simulator & Reports",
        summary: "Borrowing from Core Savings with next-cycle refund obligations, purchase modeling, and statement exports.",
        targetHref: "/reports",
        targetLabel: "Open Reports",
        blocks: [
          {
            heading: "Priority 1 Emergency Borrow & Refund",
            body: "Drawing cash from active Core Savings via Borrow P1 reduces current P1 immediately and writes an explicit P1_VAULT_REFUND item into next cycle's Personal & Informal Debt so the vault restores automatically on payday.",
          },
          {
            heading: "Wishlist Feasibility Comparator",
            body: "Test any Vault item or custom amount side-by-side across Path A (Cash from P2 Surplus), Path B (SPayLater 1x/3x/6x), and Path C (Credit Card 3x/6x/12x) using your chosen before/after cutoff timing to preview resulting Debt-to-Income Ratio.",
          },
          {
            heading: "4-Sheet Excel & A4 PDF Statements",
            body: "Reports generates a 4-sheet workbook (Executive Summary, Due-Date & Settlement Schedule, Active Contracts Burn-Down, Line-Item Audit Ledger) plus an A4 print stylesheet that strips chrome and prints multi-page tables cleanly.",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "Payroll Calendar, Formula DSL & Modular Preferences Studio",
        summary: "Two-stage corporate payroll schedule, custom formula rules, expandable sub-modules (?sub=), and 6-part table-driven Preferences Studio.",
        targetHref: "/preferences",
        targetLabel: "Open Preferences",
        blocks: [
          {
            heading: "Paycycle Horizon Law & Financial Planning Engines",
            body: "Every cycle anchors on Payslip Anchor -> HR Review Lag -> Payday(M) (with automatic holiday/weekend shift), funds daily living through Payday(M+1)-1, and covers Month M+1 maturities. Pure-integer calculation engines drive Cash vs Debt Runway, 3-Scenario 12M Wealth Forecasting, Daily Spending Pace & Next-Cycle Charges detection, Envelope Rollovers, Avalanche/Snowball Debt Optimization, KRL Commute Hourly Work-Cost, and Lock-Safe Bulk Statement Auto-Reconciliation.",
          },
          {
            heading: "Expandable Sub-Modules & 6-Part Preferences Studio",
            body: "Dense modules (/payroll, /allocations, /credit, /savings, /reports, /preferences) organize workflows into instant <15ms sub-modules (?sub=), while Overview (/) stays one cohesive vertical dashboard. Configure paycycle formulas, payment instrument cutoffs, cash accounts & vaults, routine rollover templates, and custom sidebar shortcuts directly inside Preferences.",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "Payday Wizard, Cash Radar, Active Contracts Hub & Marquee AI (Alt+M)",
        summary: "4-step monthly closing ritual, Lowest Cash Point calendar, SPinjam-first debt optimizer, and 3-tier deterministic AI Co-Pilot.",
        targetHref: "/marquee",
        targetLabel: "Open Marquee AI",
        blocks: [
          {
            heading: "3-State Daily Pacing & Smart Default Active Period",
            body: "The ERP automatically opens on your earliest open DRAFT cycle (EARLIEST_OPEN_ACTIVE), skipping locked periods. Before payday arrives, Daily Pacing enters PRE_PAYDAY (Day 0 + countdown + bridge callout), transitions to ACTIVE during the cycle window, and freezes at COMPLETED after cycle end.",
          },
          {
            heading: "Payday & Closing Wizard (/payday-wizard) & Cash Radar (/calendar)",
            body: "Run the 4-step payday checklist each month to confirm working days, lock the prior cycle, settle 11th/25th due bills, and confirm P1 vault deposits. Open Cash Radar & Calendar to inspect your deterministic Lowest Cash Point trough date before next payday.",
          },
          {
            heading: "Marquee 3-Tier AI Co-Pilot (Alt+M) & Headless Webhook",
            body: "Press Alt+M anywhere to open the top-layer Marquee drawer. Tier 1 trilingual NLU (EN/ID/ZH) parses Rupiah shorthands (45k, 85rb, 1.5jt, 3x) with zero latency; Tier 2 supports AES-256-GCM encrypted BYOK Gemini 3.8 Flash and Groq Llama 3.3 70B; Tier 3 exposes POST /api/marquee/webhook authenticated via X-Marquee-Token.",
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
          { id: "w1", text: "Inspect upcoming 15th (SPayLater) or 20th (Credit Card) cutoff transactions." },
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
    searchPlaceholder: "Cari panduan berdasarkan kata kunci (cth. cutoff, talangan, sync balance, P1)...",
    noResults: "Tidak ada bagian panduan yang cocok dengan kata kunci pencarian Anda.",
    sectionsLabel: "Bagian Operasional Inti",
    checklistsTitle: "Daftar Periksa (SOP) Interaktif",
    checklistsSubtitle: "Tandai langkah rekonsiliasi rutin dan tutup buku bulanan secara lokal di browser.",
    resetChecklist: "Atur Ulang",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "Siklus Gajian Tgl 28–26 & Waterfall 2-Prioritas",
        summary: "Bagaimana periode gaji memetakan pemasukan akhir bulan untuk melunasi tagihan bulan berikutnya.",
        targetHref: "/allocations",
        targetLabel: "Buka Alokasi",
        blocks: [
          {
            heading: "Konvensi Siklus Payday-to-Bill",
            body: "Periode M/YYYY didanai oleh gaji akhir bulan M (~tgl 27/28) hingga sehari sebelum gaji bulan M+1. Seluruh tagihan jatuh tempo bulan M+1 dibayar dari kas periode M.",
          },
          {
            heading: "Pengeluaran Tetap di Awal (Upfront Essentials)",
            body: "Tagihan kredit/utang terverifikasi (PayLater, Kartu Kredit, Utang Pribadi), kuota rutin (Transport, Internet, Vape, Potong Rambut), dan dana Operasional Harian disisihkan terlebih dahulu.",
            formula: "Sisa Dana Bebas = Total Pemasukan - Total Utang & Tagihan - Kuota Rutin - Anggaran Hidup Harian",
          },
          {
            heading: "Prioritas 1 (Tabungan Inti) & Prioritas 2 (Self-Reward)",
            body: "Surplus mengalir ke Tabungan Inti (P1) hingga batas target, lalu sisanya masuk ke P2 Self-Reward. Siklus dengan isManualOverride mengunci nilai P1/P2/Hidup saat kalkulasi ulang.",
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
            body: "Bandingkan total uang tunai + saldo rekening aktual Anda terhadap Sisa Kas Hidup di sistem. Selisih kurang otomatis dicatat sebagai Balance Checkpoint: Unitemized Daily Spend.",
            formula: "Penyesuaian = Sisa Kas Hidup Sistem - Saldo Aktual Dompet",
          },
          {
            heading: "Jaminan Integritas P1",
            body: "Sync Balance tidak pernah menggerus Tabungan Inti (P1) maupun P2, dan pada siklus override selalu memakai plafon actualDailyOperational yang telah ditetapkan.",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "Kewajiban, Cutoff Tgl 15/20 & Pinjaman Talangan",
        summary: "Aturan perpindahan siklus SPayLater/CC, edit matriks dua mode, dan suntikan likuiditas bridge loan.",
        targetHref: "/credit",
        targetLabel: "Buka Kredit & Matriks",
        blocks: [
          {
            heading: "SPayLater (Cutoff tgl 15) & Kartu Kredit (Cutoff tgl 20)",
            body: "Transaksi SPayLater <= tgl 15 masuk tagihan periode berjalan (jatuh tempo tgl 25 bulan depan); transaksi > tgl 15 atau ditandai Hold Past Cutoff bergeser ke periode M+1. Kartu Kredit memakai cutoff tgl 20 (jatuh tempo tgl 11).",
          },
          {
            heading: "Matriks Utang Dua Mode",
            body: "Klik angka sel PayLater atau Utang Pribadi untuk edit total seketika, atau buka drawer rincian untuk memecah tagihan melewati tanggal cutoff tanpa merusak paritas MonthlyBulkBill.",
          },
          {
            heading: "Pinjaman Talangan (Bridge Loan)",
            body: "Mencatat Bridge Loan menambah MonthlySnapshot.bridgeInflowAmount ke total dana masuk periode aktif tanpa mencemari komponen gaji Extra Income maupun membuat transaksi INCOME ganda.",
            formula: "Total Dana Masuk = Gaji Bersih + Pemasukan Tambahan + Suntikan Talangan (Bridge)",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "Pinjam P1, Simulasi Wishlist & Ekspor Laporan",
        summary: "Mekanisme darurat Pinjam P1 berjadwal, perbandingan opsi cicilan, dan cetak PDF A4 / Excel 4-Sheet.",
        targetHref: "/reports",
        targetLabel: "Buka Laporan",
        blocks: [
          {
            heading: "Pinjam & Pengembalian P1 (Vault Refund)",
            body: "Fitur Borrow P1 mengurangi tabungan P1 periode ini dan otomatis menanam kewajiban P1_VAULT_REFUND di Utang Pribadi periode berikutnya agar tabungan pulih saat gajian.",
          },
          {
            heading: "Komparator Kelayakan Wishlist",
            body: "Bandingkan pembelian Tunai (Surplus P2), SPayLater (1x/3x/6x), dan Kartu Kredit (3x/6x/12x) lengkap dengan simulasi tanggal sebelum/sesudah cutoff serta proyeksi Rasio Utang.",
          },
          {
            heading: "Excel 4-Sheet & Cetak PDF A4",
            body: "Halaman Laporan mengekspor workbook Excel 4-lembar lengkap serta mendukung Print / Save PDF dalam format kertas A4 multi-halaman bebas menu samping.",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "Kalender Gaji 2-Tahap, Studio Rumus & Preferensi Modular",
        summary: "Hukum cakrawala siklus gaji Payday(M) -> Payday(M+1)-1, sub-modul instan <15ms, dan tabel konfigurasi modular.",
        targetHref: "/preferences",
        targetLabel: "Buka Preferensi",
        blocks: [
          {
            heading: "Hukum Siklus Gaji & Mesin Kalkulasi Integer-Murni",
            body: "Setiap periode berjangkar dari Tanggal Slip Gaji -> Jedah Review -> Payday(M) hingga sehari sebelum Payday(M+1) dan mendanai jatuh tempo bulan M+1. Mesin kalkulasi menghitung Kas & Tabungan vs Utang, Proyeksi 12 Bulan 3-Skenario, Deteksi Laju Belanja & Tagihan Periode Berikutnya, Rollover Amplop, Optimasi Utang Avalanche/Snowball, Upah Per Jam Riil (termasuk KRL), serta Rekonsiliasi Mutasi Massal.",
          },
          {
            heading: "Sub-Modul Terstruktur & 6 Tabel Studio Preferensi",
            body: "Modul padat (/payroll, /allocations, /credit, /savings, /reports, /preferences) tersusun atas sub-modul instan (?sub=), sementara Ringkasan (/) tetap vertikal terpadu. Atur formula siklus, batas cutoff instrumen, saldo rekening aset, kebijakan rollover amplop, hingga pintasan menu sidebar kustom langsung di Preferensi.",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "Ritual Gaji, Radar Kas, Hub Kontrak Aktif & Marquee AI (Alt+M)",
        summary: "Checklist tutup buku 4-langkah, kalender Titik Kas Terendah, prioritas bunga SPinjam, dan asisten AI deterministik 3-lapis.",
        targetHref: "/marquee",
        targetLabel: "Buka Marquee AI",
        blocks: [
          {
            heading: "Pacing 3-Status & Periode Aktif Otomatis",
            body: "Sistem otomatis membuka periode DRAFT aktif paling awal (EARLIEST_OPEN_ACTIVE) setelah periode lama dikunci. Sebelum tanggal gajian tiba, kartu Pacing menampilkan PRE_PAYDAY (Hari 0 + hitung mundur), berubah menjadi ACTIVE saat siklus berjalan, dan COMPLETED saat siklus berakhir.",
          },
          {
            heading: "Ritual Gaji (/payday-wizard) & Radar Kas (/calendar)",
            body: "Jalankan 4 langkah ritual bulanan untuk memverifikasi hari kerja, mengunci siklus sebelumnya, melunasi tagihan tgl 11/25, dan mengonfirmasi setoran P1. Gunakan Radar Kas untuk memantau tanggal Titik Kas Terendah sebelum gajian berikutnya.",
          },
          {
            heading: "Asisten AI Marquee (Alt+M) & Webhook Tanpa Kepala",
            body: "Tekan Alt+M dari halaman mana saja untuk membuka laci Marquee. Tier 1 NLU memahami singkatan Rupiah (45k, 85rb, 1.5jt, 3x) secara instan; Tier 2 mendukung kunci terenkripsi AES-256-GCM Gemini 3.8 Flash / Groq; Tier 3 menyediakan POST /api/marquee/webhook dengan header X-Marquee-Token.",
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
    searchPlaceholder: "按关键词搜索手册（如 cutoff、bridge loan、sync balance、P1）...",
    noResults: "未找到与搜索条件匹配的手册章节或检查项。",
    sectionsLabel: "核心操作规范",
    checklistsTitle: "交互式日常操作检查单",
    checklistsSubtitle: "在本地浏览器记录您的每日、每周及发薪日对账完成进度。",
    resetChecklist: "重置",
    sections: [
      {
        id: "cycle-waterfall",
        code: "01",
        title: "28日至26日发薪周期与两级瀑布流分配",
        summary: "账期如何以月末发薪日划分以支付次月到期账单，并分配可支配盈余。",
        targetHref: "/allocations",
        targetLabel: "前往预算分配",
        blocks: [
          {
            heading: "发薪日对账单周期规则",
            body: "M/YYYY 账期由 M 月底薪资（约27/28日）注入，持续至 M+1 月发薪日前一日。日历月 M+1 到期的所有信用卡及分期账单均由第 M 账期现金流支付。",
          },
          {
            heading: "前置刚性支出与日常预算",
            body: "系统优先扣除已确认负债（PayLater、信用卡、个人借款）、固定日常配额（交通、网络、理发等）及每日生活运营资金池。",
            formula: "可分配盈余 = 周期总入账 - 负债账单总额 - 固定日常配额 - 日常运营资金池",
          },
          {
            heading: "核心储蓄 (P1) 与自我奖励 (P2)",
            body: "净盈余优先填充 P1 核心储蓄至目标上限，剩余部分归入 P2 自我奖励池。启用 isManualOverride 的历史或锁定期在重算时保持 P1/P2 与日常额度锁定。",
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
            body: "当需要保留商户分类与备注时，使用 Log Expense 记入流水账，系统实时扣减当前周期的剩余运营现金。",
          },
          {
            heading: "10秒余额校准 (Sync Balance)",
            body: "核对真实钱包/银行卡余额与系统剩余可用金额。若实际余额较低，系统生成一笔 Balance Checkpoint 扣减，避免手补琐碎账单。",
            formula: "校准差额 = 系统剩余运营现金 - 钱包实际余额",
          },
          {
            heading: "储蓄隔离保护",
            body: "Sync Balance 永远不会动用 P1 核心储蓄或 P2 奖励池，在手动锁定期内严格锚定 actualDailyOperational 上限。",
          },
        ],
      },
      {
        id: "liabilities-cutoffs",
        code: "03",
        title: "负债管理、15/20日账单截点与过桥借款",
        summary: "账单日滚动规则、双模式负债矩阵编辑及过桥资金处理机制。",
        targetHref: "/credit",
        targetLabel: "前往信用与矩阵",
        blocks: [
          {
            heading: "SPayLater (15日截点) 与 信用卡 (20日截点)",
            body: "15日及之前确认的 SPayLater 订单计入当期（次月25日还款）；15日之后或勾选延期的订单自动滚入下一账期。信用卡适用20日截点（11日还款）。",
          },
          {
            heading: "双模式 12 个月负债矩阵",
            body: "点击 PayLater 或个人负债单元格即可快速行内修改总额，或打开右侧抽屉拆分跨期金额、增删明细项并保持汇总表 100% 一致。",
          },
          {
            heading: "过桥借款 (Bridge Loan)",
            body: "登记过桥借款仅递增 MonthlySnapshot.bridgeInflowAmount 并自动排期到个人债务表，不污染薪酬页面的日常额外收入统计。",
            formula: "周期总入账 = 实发薪资 + 额外收入 + 过桥资金注入",
          },
        ],
      },
      {
        id: "savings-wishlist-reports",
        code: "04",
        title: "P1 应急预借、心愿单比较与报表导出",
        summary: "核心储蓄应急拆借回补规则、三方案消费测算以及 5表 Excel 与 A4 PDF 导出。",
        targetHref: "/reports",
        targetLabel: "前往财务报表",
        blocks: [
          {
            heading: "P1 核心储蓄借支与自动回补",
            body: "通过 Borrow P1 拆借资金会扣减本期储蓄，同时在下期个人借款中登记一笔 P1_VAULT_REFUND 返还义务。",
          },
          {
            heading: "心愿单可行性三方案对比",
            body: "支持直接载入心愿单商品或自定义金额，切换账单截点前后时间，实时对比现金 (P2)、SPayLater (1x/3x/6x) 与信用卡 (3x/6x/12x) 的负债率影响。",
          },
          {
            heading: "5 工作表 Excel 与 A4 行政报告",
            body: "报表中心支持一键导出含 4 个独立核心工作表的 .xlsx 档案，并配置标准 A4 多页无侧边栏打印样式。",
          },
        ],
      },
      {
        id: "go-engines-studio",
        code: "05",
        title: "两阶段发薪日历、公式工作室与模块化偏好设置",
        summary: "Payday(M) -> Payday(M+1)-1 薪资周期法则、瞬时 <15ms 子模块切换以及六大表格化系统设置。",
        targetHref: "/preferences",
        targetLabel: "打开偏好设置",
        blocks: [
          {
            heading: "薪资周期视野与纯整数财务分析引擎",
            body: "每个账期均从工资单公布日起经过审核延迟至 Payday(M) 覆盖至下次发薪日前一日的日常开销与 M+1 月到期债务。核心分析引擎实时计算现金与储蓄净额、12个月三情景预测、消费节奏与下期新增账单预警、信封结转、雪崩/雪球还债优化、通勤折算真实时薪及安全锁定防重入批量对账。",
          },
          {
            heading: "侧边栏子模块架构与六大偏好设置表",
            body: "核心高频功能模块采用左侧展开式子菜单（?sub=）零延迟切换，总览页 (/) 保持完整单页纵向视图。在偏好设置中可随时编辑周期公式、支付工具账单日、资产账户资金池、固定预算结转规则及自定义侧边栏快捷入口。",
          },
        ],
      },
      {
        id: "marquee-wizard-radar",
        code: "06",
        title: "发薪向导、现金雷达、在途合约中心与 Marquee AI 助手 (Alt+M)",
        summary: "四步发薪结账清单、最低现金点日历、SPinjam 高息优先策略以及三层确定性财务 AI 助手。",
        targetHref: "/marquee",
        targetLabel: "打开 Marquee AI",
        blocks: [
          {
            heading: "三态每日消费节奏与智能默认活动账期",
            body: "系统默认自动跳转至最早未锁定的 DRAFT 活跃账期（EARLIEST_OPEN_ACTIVE）。发薪日前处于 PRE_PAYDAY（第 0 天倒计时与过渡提示），周期内处于 ACTIVE，周期结束后进入 COMPLETED。",
          },
          {
            heading: "发薪与结账向导 (/payday-wizard) 及现金雷达 (/calendar)",
            body: "每月按四步清单核对出勤天数、锁定上一周期、清偿 11日/25日到期账单并确认 P1 储蓄划转。在现金雷达日历中可精准查看下次发薪前的最低现金谷值日期与金额。",
          },
          {
            heading: "Marquee 三层 AI 助手 (Alt+M) 与免登录 Webhook",
            body: "在任意页面按下 Alt+M 即可呼出原生顶层抽屉。Tier 1 三语 NLU 毫秒级解析印尼盾简写（45k、85rb、1.5jt、3x）；Tier 2 支持 AES-256-GCM 加密配置 Gemini 3.8 Flash 与 Groq；Tier 3 提供 X-Marquee-Token 验证的 POST /api/marquee/webhook 快捷记账接口。",
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
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-tertiary">
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
                className={`px-2.5 py-1 rounded-sm transition-colors cursor-pointer uppercase ${
                  locale === code
                    ? "bg-surface-active text-text-primary font-semibold"
                    : "text-text-tertiary hover:text-text-secondary"
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
          className="w-full pl-10 pr-4 py-2.5 rounded-md bg-surface border border-border text-xs font-sans text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent/60"
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
              <div className="text-[11px] font-mono uppercase tracking-wider text-text-tertiary">
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
                          <span className="text-[10px] font-mono text-accent uppercase tracking-widest">
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
                  <span className="text-[10px] font-mono text-accent uppercase tracking-widest">
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
                            <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary block">
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
