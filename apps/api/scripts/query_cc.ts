import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCC() {
  const cc = await prisma.creditCardTransaction.findMany({
    where: { label: { in: ['Gemini AI Pro', 'New Balance 740 Grey Blue'] } }
  });
  console.log("CC Transactions:");
  for (const c of cc) {
    console.log(`- ${c.label}: type=${c.chargeType}, billMonth=${c.billingMonth}, billYear=${c.billingYear}, tenor=${c.tenor}, recurring=${c.isRecurring}`);
  }
}

checkCC().catch(console.error).finally(() => prisma.$disconnect());
