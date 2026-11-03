import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDeductions() {
  const bills = await prisma.monthlyBulkBill.findMany({
    where: { month: 10, year: 2026 }
  });
  console.log("October Bulk Bills:");
  for (const b of bills) {
    console.log(`- ${b.label}: Amount=${b.amount}, paylater=${b.paylaterAmount}, personalDebt=${b.personalDebtAmount}, CC=${b.creditCardAmount}`);
  }

  const transactions = await prisma.transaction.findMany({
    where: { snapshot: { month: 10, year: 2026 } }
  });
  let txTotal = 0;
  console.log("\nOctober Transactions:");
  for (const tx of transactions) {
    console.log(`- [${tx.type}] ${tx.label}: ${tx.amount} (Source: ${tx.sourceType} ${tx.sourceId})`);
    if (tx.type === 'DEDUCTION') txTotal += tx.amount;
  }
  console.log("Total DEDUCTION transactions:", txTotal);

  const cc = await prisma.creditCardTransaction.findMany({
    where: { billingMonth: 10, billingYear: 2026 }
  });
  console.log("\nOctober CC Transactions:");
  for (const c of cc) {
    console.log(`- ${c.label}: amount=${c.amount}, monthlyAmount=${c.monthlyAmount}`);
  }

  const sched = await prisma.scheduledBill.findMany({
    where: { isActive: true }
  });
  console.log("\nActive Scheduled Bills:");
  for (const s of sched) {
    console.log(`- ${s.label}: ${s.amount}`);
  }
}

checkDeductions().catch(console.error).finally(() => prisma.$disconnect());
