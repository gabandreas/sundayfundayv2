-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BudgetRevisionCategory" ADD VALUE 'TRANSPORT';
ALTER TYPE "BudgetRevisionCategory" ADD VALUE 'INTERNET';
ALTER TYPE "BudgetRevisionCategory" ADD VALUE 'VAPE';
ALTER TYPE "BudgetRevisionCategory" ADD VALUE 'HAIRCUT';

-- AlterTable
ALTER TABLE "GlobalConfig" ADD COLUMN     "payrollPayoutDay" INTEGER NOT NULL DEFAULT 25;
