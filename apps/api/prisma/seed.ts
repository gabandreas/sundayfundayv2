import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, TransactionType, TransactionSourceType } from '@prisma/client';
import { formatBulkBillTransactionLabel } from '../src/credit/credit.service';
import { calculateTotalDeductions, calculateWaterfall } from '../src/calculator/waterfall';

if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...vals] = trimmed.split('=');
        process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  }
}

const prisma = new PrismaClient();
const CONFIRMATION_FLAG = '--i-understand-this-wipes-live-data';

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    console.error(`\n[FATAL] prisma/seed.ts wipes all live data!`);
    console.error(`To run this script, you MUST pass the explicit flag: ${CONFIRMATION_FLAG}\n`);
    process.exit(1);
  }

  console.log('Seeding development database...');

  // 1. Clean existing records
  await prisma.transaction.deleteMany();
  await prisma.monthlyBulkBill.deleteMany();
  await prisma.creditCardTransaction.deleteMany();
  await prisma.creditContract.deleteMany();
  await prisma.savingsManualTransaction.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.monthlySnapshot.deleteMany();
  await prisma.globalConfig.deleteMany();

  // 2. Global Config
  const config = await prisma.globalConfig.create({
    data: {
      baseSalary: 18_500_000,
      dailyAllowance: 50_000,
      laptopAllowance: 800_000,
      dailyOperational: 4_200_000,
      transport: 600_000,
      internet: 450_000,
      vape: 300_000,
      haircut: 150_000,
      baseSavings: 5_000_000,
      creditLimit: 7_000_000,
      creditStatementDay: 20,
      creditDueDay: 11,
    },
  });
  console.log('Created GlobalConfig:', config.id);

  // 3. Contracts
  const c1 = await prisma.creditContract.create({
    data: {
      label: 'KPR Bank Mandiri - Cicilan Pokok & Bunga',
      principalAmount: 102_000_000,
      monthlyInstallment: 4_250_000,
      totalTenor: 24,
      remainingTenor: 24,
      startMonth: 1,
      startYear: 2026,
      isActive: true,
    },
  });

  const c2 = await prisma.creditContract.create({
    data: {
      label: 'Digimap - MacBook Pro M3 Pro 0% BCA',
      principalAmount: 25_200_000,
      monthlyInstallment: 2_100_000,
      totalTenor: 12,
      remainingTenor: 12,
      startMonth: 7,
      startYear: 2026,
      isActive: true,
    },
  });

  // 4. Bulk Bills (Breakdown by PayLater, Personal Debt)
  const b1 = await prisma.monthlyBulkBill.create({
    data: {
      label: 'Monthly Bulk Bill',
      paylaterAmount: 1_150_000,
      personalDebtAmount: 453_000,
      creditCardAmount: 0,
      amount: 1_603_000,
      month: 9,
      year: 2026,
    },
  });

  // Also seed July & August bulk bills for rolling matrix realism
  await prisma.monthlyBulkBill.create({
    data: {
      label: 'Monthly Bulk Bill',
      paylaterAmount: 850_000,
      personalDebtAmount: 500_000,
      creditCardAmount: 0,
      amount: 1_350_000,
      month: 8,
      year: 2026,
    },
  });

  await prisma.monthlyBulkBill.create({
    data: {
      label: 'Monthly Bulk Bill',
      paylaterAmount: 920_000,
      personalDebtAmount: 500_000,
      creditCardAmount: 0,
      amount: 1_420_000,
      month: 7,
      year: 2026,
    },
  });

  // Credit Card Transactions (Active)
  await prisma.creditCardTransaction.create({
    data: {
      label: 'iBox - AppleCare+ Protection Plan (0% Cicilan)',
      amount: 1_800_000,
      totalAmount: 1_800_000,
      monthlyAmount: 300_000,
      chargeType: 'INSTALLMENT',
      tenor: 6,
      category: 'Electronics',
      transactionDate: new Date('2026-08-15'),
      billingMonth: 8,
      billingYear: 2026,
      status: 'ACTIVE',
      notes: 'Cicilan 6 bulan kartu kredit BCA',
    },
  });

  await prisma.creditCardTransaction.create({
    data: {
      label: 'Netflix & Spotify Premium Family',
      amount: 250_000,
      chargeType: 'RECURRING',
      isRecurring: true,
      category: 'Subscription',
      transactionDate: new Date('2026-07-01'),
      billingMonth: 7,
      billingYear: 2026,
      status: 'ACTIVE',
      notes: 'Langganan bulanan otomatis',
    },
  });

  await prisma.creditCardTransaction.create({
    data: {
      label: 'Uniqlo PIM - Pakaian Kerja & Jaket',
      amount: 890_000,
      chargeType: 'FULL',
      category: 'Apparel',
      transactionDate: new Date('2026-09-05'),
      billingMonth: 9,
      billingYear: 2026,
      status: 'ACTIVE',
      notes: 'Bayar penuh tanggal 11',
    },
  });

  // 5. Create 9/2026 Snapshot
  const snapshot = await prisma.monthlySnapshot.create({
    data: {
      month: 9,
      year: 2026,
      status: 'DRAFT',
      salaryAdjustment: 0,
      totalWorkingDays: 0,
      cafeteriaDeduction: 0,
      thrAmount: 0,
      bonusAmount: 0,
      dailyOperational: config.dailyOperational,
      transport: config.transport,
      internet: config.internet,
      vape: config.vape,
      haircut: config.haircut,
      savings: config.baseSavings,
      selfRewardTarget: 0,
      bufferPocket: 0,
      netSalaryIncome: 18_745_000,
      extraIncome: 0,
      finalTotalIncome: 18_745_000,
      totalDeductions: 7_953_000,
      actualDailyOperational: 4_200_000,
      actualSavings: 5_000_000,
      selfReward: 92_000,
      deficitUncovered: 0,
      survivalPocket: 5_700_000,
    },
  });

  // 6. Materialize Liabilities into Transactions
  await prisma.transaction.create({
    data: {
      snapshotId: snapshot.id,
      type: TransactionType.CREDIT_BILL,
      sourceType: TransactionSourceType.CONTRACT,
      sourceId: c1.id,
      label: c1.label,
      amount: c1.monthlyInstallment,
      date: new Date('2026-09-01'),
    },
  });

  await prisma.transaction.create({
    data: {
      snapshotId: snapshot.id,
      type: TransactionType.CREDIT_BILL,
      sourceType: TransactionSourceType.CONTRACT,
      sourceId: c2.id,
      label: c2.label,
      amount: c2.monthlyInstallment,
      date: new Date('2026-09-01'),
    },
  });

  await prisma.transaction.create({
    data: {
      snapshotId: snapshot.id,
      type: TransactionType.CREDIT_BILL,
      sourceType: TransactionSourceType.BULK_BILL,
      sourceId: b1.id,
      label: formatBulkBillTransactionLabel(b1),
      amount: b1.amount,
      date: new Date('2026-09-01'),
    },
  });


  // 7. Manual Transactions for realistic overview
  const manualExpenses = [
    { label: 'Kopi & Sarapan Pagi', amount: 45_000, date: new Date('2026-09-02') },
    { label: 'Makan Siang Tim', amount: 85_000, date: new Date('2026-09-05') },
    { label: 'Bensin & Parkir Kantor', amount: 50_000, date: new Date('2026-09-08') },
    { label: 'Minimarket Kebutuhan Harian', amount: 120_000, date: new Date('2026-09-10') },
  ];

  for (const exp of manualExpenses) {
    await prisma.transaction.create({
      data: {
        snapshotId: snapshot.id,
        type: TransactionType.DEDUCTION,
        sourceType: TransactionSourceType.MANUAL,
        label: exp.label,
        amount: exp.amount,
        date: exp.date,
      },
    });
  }

  // 7b. Authoritative recalculation of snapshot derived fields from all seeded transactions
  const seededTransactions = await prisma.transaction.findMany({
    where: { snapshotId: snapshot.id },
  });
  const totalDeductions = calculateTotalDeductions(seededTransactions);
  const fixedExpenses =
    snapshot.transport + snapshot.internet + snapshot.vape + snapshot.haircut;
  const waterfall = calculateWaterfall({
    finalTotalIncome: snapshot.finalTotalIncome ?? 18_745_000,
    totalDeductions,
    savingsTarget: snapshot.savings,
    selfRewardTarget: snapshot.selfRewardTarget,
    dailyOperationalTarget: snapshot.dailyOperational,
    fixedExpenses,
    bufferPocket: snapshot.bufferPocket,
  });

  await prisma.monthlySnapshot.update({
    where: { id: snapshot.id },
    data: {
      totalDeductions,
      actualDailyOperational: waterfall.actualDailyOperational,
      actualSavings: waterfall.actualSavings,
      selfReward: waterfall.actualSelfReward,
      deficitUncovered: waterfall.deficitUncovered,
      survivalPocket: waterfall.survivalPocket,
    },
  });

  // 8. Savings Transactions
  await prisma.savingsManualTransaction.deleteMany();
  await prisma.savingsManualTransaction.createMany({
    data: [
      {
        label: 'Setoran Dana Cadangan Pokok',
        amount: 10_000_000,
        date: new Date('2026-07-01'),
      },
      {
        label: 'Alokasi Tabungan Payroll Juli',
        amount: 3_000_000,
        date: new Date('2026-07-28'),
      },
      {
        label: 'Alokasi Tabungan Payroll Agustus',
        amount: 2_000_000,
        date: new Date('2026-08-28'),
      },
    ],
  });

  console.log(`Database seeded successfully! Snapshot ID: ${snapshot.id} for 9/2026 with finalTotalIncome: 18,745,000`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
