/*
  Warnings:

  - You are about to drop the column `month` on the `CreditCardTransaction` table. All the data in the column will be lost.
  - You are about to drop the column `year` on the `CreditCardTransaction` table. All the data in the column will be lost.
  - Added the required column `billingMonth` to the `CreditCardTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `billingYear` to the `CreditCardTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `transactionDate` to the `CreditCardTransaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CreditCardTransaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionSourceType" AS ENUM ('MANUAL', 'CONTRACT', 'CC_TRANSACTION', 'BULK_BILL');

-- CreateEnum
CREATE TYPE "CreditCardChargeType" AS ENUM ('FULL', 'INSTALLMENT', 'RECURRING');

-- CreateEnum
CREATE TYPE "CreditCardStatus" AS ENUM ('ACTIVE', 'SETTLED', 'CANCELLED');

-- AlterTable
ALTER TABLE "CreditCardTransaction" DROP COLUMN "month",
DROP COLUMN "year",
ADD COLUMN     "billingMonth" INTEGER NOT NULL,
ADD COLUMN     "billingYear" INTEGER NOT NULL,
ADD COLUMN     "category" TEXT NOT NULL DEFAULT 'Subscription',
ADD COLUMN     "chargeType" "CreditCardChargeType" NOT NULL DEFAULT 'FULL',
ADD COLUMN     "isRecurring" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyAmount" DOUBLE PRECISION,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "status" "CreditCardStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "tenor" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "totalAmount" DOUBLE PRECISION,
ADD COLUMN     "transactionDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "sourceId" INTEGER,
ADD COLUMN     "sourceType" "TransactionSourceType" NOT NULL DEFAULT 'MANUAL';
