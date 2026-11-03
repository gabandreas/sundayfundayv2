import React from "react";
import {
  LayoutDashboard,
  Wallet,
  ArrowDownNarrowWide,
  CreditCard,
  PiggyBank,
  ReceiptText,
  BookmarkCheck,
  ShieldCheck,
  BarChart3,
  Sliders,
} from "lucide-react";
import { MetricCard } from "@/components/primitives/MetricCard";
import { DeltaBadge } from "@/components/primitives/DeltaBadge";
import { DataTableRow, DataTableHeader } from "@/components/primitives/DataTableRow";
import { SidebarNavItem } from "@/components/primitives/SidebarNavItem";
import { MiniTrendChart } from "@/components/primitives/MiniTrendChart";

export default function ComponentDevShowcasePage() {
  return (
    <div className="max-w-7xl space-y-10">
      {/* Page Header — restrained, technical */}
      <header className="border-b border-border-subtle pb-5">
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-tertiary bg-surface-subtle border border-border-subtle rounded">
            INTERNAL SPEC
          </span>
          <span className="font-mono text-xs text-text-tertiary">Phase 0 Primitive Validation</span>
        </div>
        <h1 className="text-xl font-medium tracking-tight text-text-primary mt-2">
          Design System Primitives
        </h1>
        <p className="text-xs text-text-secondary mt-1 font-sans">
          Validation of typographic hierarchy, shifted delta hues, restrained dark slate surfaces, and unadorned indicators.
        </p>
      </header>

      {/* 1. TYPOGRAPHY & CENTERPIECE METRIC CARDS */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-text-primary">
              1. MetricCard Anatomy
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Centerpiece numbers use the Mercury-inspired Newsreader serif display face; secondary figures use strict tabular monospace figures.
            </p>
          </div>
          <span className="text-[11px] font-mono text-text-tertiary">
            display: Newsreader · mono: JetBrains Mono
          </span>
        </div>

        {/* Asymmetric layout: Centerpieces have prominent presence, secondary have compact utility */}
        <div className="grid grid-cols-12 gap-5">
          {/* Centerpiece 1: Safe to Spend Today */}
          <div className="col-span-4">
            <MetricCard
              label="SAFE-TO-SPEND TODAY"
              value="Rp 85.000"
              subvalue="target: Rp 140.000"
              isCenterpiece={true}
              delta={{
                variant: "positive",
                value: "+12.4%",
                period: "vs yesterday",
                direction: "up",
              }}
              chart={
                <MiniTrendChart
                  daysInCycle={30}
                  currentDay={11}
                  targetDailyBudget={140000}
                  statusVariant="default"
                />
              }
            />
          </div>

          {/* Centerpiece 2: Total Liquid Balance */}
          <div className="col-span-4">
            <MetricCard
              label="TOTAL LIQUID BALANCE"
              value="Rp 42.850.000"
              subvalue="cash + savings"
              isCenterpiece={true}
              delta={{
                variant: "positive",
                value: "+Rp 3.500.000",
                period: "vs Aug 2026",
                direction: "up",
              }}
              chart={
                <div className="text-[11px] font-mono text-text-tertiary flex justify-between pt-1">
                  <span>EMERGENCY: Rp 30.000.000</span>
                  <span className="text-delta-positive font-medium">100% FUNDED</span>
                </div>
              }
            />
          </div>

          {/* Centerpiece 3: Discipline Score */}
          <div className="col-span-4">
            <MetricCard
              label="DISCIPLINE AUDIT SCORE"
              value="88/100"
              subvalue="grade: A"
              isCenterpiece={true}
              delta={{
                variant: "positive",
                value: "+6 pts",
                period: "vs last cycle",
                direction: "up",
              }}
              footer={
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-text-tertiary">6 GREEN · 1 AMBER · 0 RED</span>
                  <span className="text-delta-positive font-medium">DISCIPLINED</span>
                </div>
              }
            />
          </div>

          {/* Secondary Card 1: Monthly Net Income (Standard Sans/Mono) */}
          <div className="col-span-4">
            <MetricCard
              label="SEPTEMBER NET PAYROLL"
              value="Rp 24.500.000"
              subvalue="adjusted base"
              isCenterpiece={false}
              delta={{
                variant: "neutral",
                value: "Rp 0",
                period: "fixed baseline",
                direction: "flat",
              }}
              footer={
                <div className="text-[11px] font-mono text-text-tertiary">
                  LAPTOP ALLOWANCE: Rp 800.000 INCLUDED
                </div>
              }
            />
          </div>

          {/* Secondary Card 2: Debt Ratio & Active Installments (Caution State) */}
          <div className="col-span-4">
            <MetricCard
              label="ACTIVE DEBT INSTALLMENTS"
              value="Rp 4.250.000"
              subvalue="17.3% of income"
              isCenterpiece={false}
              statusVariant="caution"
              delta={{
                variant: "caution",
                value: "+Rp 450.000",
                period: "bulk bill due",
                direction: "up",
              }}
              footer={
                <div className="text-[11px] font-mono text-caution">
                  PAYLATER ACCUMULATING · CUT-OFF 20TH
                </div>
              }
            />
          </div>

          {/* Secondary Card 3: Deficit Risk (Urgency Accent State) */}
          <div className="col-span-4">
            <MetricCard
              label="UNCOVERED DEFICIT"
              value="Rp 1.420.000"
              subvalue="shortfall"
              isCenterpiece={false}
              statusVariant="urgency"
              statusLabel="DEFICIT RISK"
              delta={{
                variant: "urgency",
                value: "DEFICIT STATE",
                period: "action required",
              }}
              footer={
                <div className="text-[11px] font-mono text-urgency">
                  TRANSITION TO LOCKED BLOCKED
                </div>
              }
            />
          </div>
        </div>
      </section>

      {/* 2. DELTA BADGES & COLOR LOGIC */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            2. Shifted Delta Color System & Indicators
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Shifted off standard primary hues: calmer emerald-teal (positive), terracotta/rust (negative), muted amber (caution), and reserved vermilion (urgency). All icons are direct and unadorned.
          </p>
        </div>

        <div className="p-4 rounded-lg border border-border bg-surface flex flex-wrap items-center gap-4">
          <DeltaBadge
            variant="positive"
            value="+12.4%"
            period="vs last month"
            direction="up"
          />
          <DeltaBadge
            variant="negative"
            value="-8.6%"
            period="below baseline"
            direction="down"
          />
          <DeltaBadge
            variant="caution"
            value="+24.2%"
            period="burn rate high"
          />
          <DeltaBadge
            variant="urgency"
            value="DEFICIT"
            period="snapshot uncloseable"
          />
          <DeltaBadge
            variant="neutral"
            value="0.0%"
            period="flat"
            direction="flat"
          />
        </div>
      </section>

      {/* 3. DATA TABLE ROW PRIMITIVE */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            3. DataTable Row Primitive
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Strict tabular numeric alignment (`tabular-nums`) with monospace currency figures, clean divider rhythm, and realistic Rupiah ledger rows.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-surface overflow-hidden">
          <DataTableHeader />
          <DataTableRow
            date="11 Sep 2026"
            title="PT Teknologi Nusantara — Gaji Pokok Sep 2026"
            subtitle="Payroll baseline + laptop allowance Rp 800.000"
            category="INCOME"
            badge={{ text: "RECORDED", variant: "positive" }}
            amount="+Rp 18.500.000"
            type="income"
          />
          <DataTableRow
            date="11 Sep 2026"
            title="Tunjangan Makan & Operasional Harian"
            subtitle="22 hari kerja x Rp 100.000 / hari"
            category="INCOME"
            badge={{ text: "RECORDED", variant: "positive" }}
            amount="+Rp 2.200.000"
            type="income"
          />
          <DataTableRow
            date="10 Sep 2026"
            title="KPR Bank Mandiri — Cicilan Pokok & Bunga"
            subtitle="Auto-debit via Payroll checking account"
            category="CREDIT_BILL"
            tenorInfo="14/24 bln"
            badge={{ text: "ACTIVE", variant: "default" }}
            amount="-Rp 4.250.000"
            type="deduction"
          />
          <DataTableRow
            date="08 Sep 2026"
            title="Digimap — MacBook Pro M3 Pro Cicilan 0%"
            subtitle="BCA Visa Platinum auto-installment"
            category="CREDIT_BILL"
            tenorInfo="3/12 bln"
            badge={{ text: "ACTIVE", variant: "default" }}
            amount="-Rp 2.100.000"
            type="deduction"
          />
          <DataTableRow
            date="05 Sep 2026"
            title="Tokopedia PayLater — Tagihan Belanja Bulanan"
            subtitle="Informal bulk debt — cut-off payment due Sep 25"
            category="BULK_BILL"
            badge={{ text: "DUE 25 SEP", variant: "caution" }}
            amount="-Rp 1.150.000"
            type="expense"
          />
          <DataTableRow
            date="03 Sep 2026"
            title="Tabungan Prioritas 1 — Dana Darurat & Investasi"
            subtitle="Waterfall priority 1 allocation to high-yield account"
            category="SAVINGS"
            badge={{ text: "LOCKED", variant: "positive" }}
            amount="-Rp 3.500.000"
            type="deduction"
          />
        </div>
      </section>

      {/* 4. SIDEBAR NAV ITEMS */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            4. Sidebar Navigation Item
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Icon + label pairing, active state soft pill highlight, direct unadorned iconography.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 p-3 rounded-lg border border-border bg-surface-subtle space-y-1">
            <span className="text-[10px] font-mono text-text-tertiary px-3 py-1 block tracking-wider uppercase">
              NAVIGATION SPEC
            </span>
            <SidebarNavItem
              label="Overview"
              href="#"
              icon={LayoutDashboard}
              isActive={true}
            />
            <SidebarNavItem
              label="Payroll & Income"
              href="#"
              icon={Wallet}
              isActive={false}
            />
            <SidebarNavItem
              label="Waterfall Allocations"
              href="#"
              icon={ArrowDownNarrowWide}
              isActive={false}
            />
            <SidebarNavItem
              label="Liabilities & Credit"
              href="#"
              icon={CreditCard}
              isActive={false}
              badge="3 ACTIVE"
              badgeVariant="neutral"
            />
            <SidebarNavItem
              label="Savings & Reservoirs"
              href="#"
              icon={PiggyBank}
              isActive={false}
            />
            <SidebarNavItem
              label="Transaction Ledger"
              href="#"
              icon={ReceiptText}
              isActive={false}
            />
            <SidebarNavItem
              label="Wishlist Simulator"
              href="#"
              icon={BookmarkCheck}
              isActive={false}
            />
            <SidebarNavItem
              label="Discipline Audit"
              href="#"
              icon={ShieldCheck}
              isActive={false}
              badge="88/100"
              badgeVariant="neutral"
            />
            <SidebarNavItem
              label="Analytics"
              href="#"
              icon={BarChart3}
              isActive={false}
            />
            <SidebarNavItem
              label="Preferences"
              href="#"
              icon={Sliders}
              isActive={false}
            />
          </div>

          <div className="col-span-8 p-5 rounded-lg border border-border bg-surface flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider font-mono">
                Sidebar Design Integrity
              </h3>
              <ul className="mt-3 space-y-2 text-xs text-text-secondary font-sans">
                <li className="flex items-start gap-2">
                  <span className="text-delta-positive font-mono font-bold">✓</span>
                  <span><strong>Active highlight:</strong> Uses soft pill highlight (<code className="font-mono text-[11px] text-text-primary bg-surface-subtle px-1 py-0.5 rounded">bg-surface-active</code>), not bright saturated fills or gradient bars.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-delta-positive font-mono font-bold">✓</span>
                  <span><strong>No icon badges:</strong> Icons are directly placed at 16x16 with 1.8 stroke, never wrapped in pastel circles.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-delta-positive font-mono font-bold">✓</span>
                  <span><strong>No motion slop:</strong> Static state toggle without bouncing or expanding accordions.</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-border-subtle text-[11px] font-mono text-text-tertiary">
              Route: /dev/components · Ready for visual screenshot review
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
