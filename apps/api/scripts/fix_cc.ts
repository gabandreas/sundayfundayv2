import { PrismaClient, CreditCardStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function fixData() {
  await prisma.creditCardTransaction.updateMany({
    where: { label: { in: ['Gemini AI Pro', 'New Balance 740 Grey Blue'] } },
    data: { status: CreditCardStatus.CANCELLED }
  });
  console.log("Updated CC transactions to CANCELLED.");
}

fixData().catch(console.error).finally(() => prisma.$disconnect());
