-- AlterEnum
ALTER TYPE "TransactionSourceType" ADD VALUE IF NOT EXISTS 'OPERATIONAL_REFUND';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FixedEssentialCategory" AS ENUM ('TRANSPORT', 'INTERNET', 'VAPE', 'HAIRCUT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SavingsInstrumentType" AS ENUM ('LIQUID_CASH', 'INVESTMENT_RDPU');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "fixedEssentialCategory" "FixedEssentialCategory";

-- AlterTable
ALTER TABLE "CreditCardTransaction" ADD COLUMN IF NOT EXISTS "endedAtMonth" INTEGER,
ADD COLUMN IF NOT EXISTS "endedAtYear" INTEGER;

-- AlterTable
ALTER TABLE "SavingsManualTransaction" ADD COLUMN IF NOT EXISTS "instrumentType" "SavingsInstrumentType" NOT NULL DEFAULT 'LIQUID_CASH';
