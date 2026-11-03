-- AlterEnum
ALTER TYPE "BudgetRevisionCategory" ADD VALUE IF NOT EXISTS 'CUSTOM_BUCKET';

-- AlterTable
ALTER TABLE "GlobalConfig" ADD COLUMN IF NOT EXISTS "payrollRulesJson" JSONB,
ADD COLUMN IF NOT EXISTS "allocationBucketsJson" JSONB,
ADD COLUMN IF NOT EXISTS "surplusSplitRulesJson" JSONB,
ADD COLUMN IF NOT EXISTS "financialPolicyJson" JSONB;

-- AlterTable
ALTER TABLE "MonthlySnapshot" ADD COLUMN IF NOT EXISTS "frozenRulesJson" JSONB,
ADD COLUMN IF NOT EXISTS "bucketRealizationsJson" JSONB;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "bucketKey" TEXT;

-- AlterTable
ALTER TABLE "BudgetRevision" ADD COLUMN IF NOT EXISTS "bucketKey" TEXT,
ADD COLUMN IF NOT EXISTS "bucketLabel" TEXT;

ALTER TABLE "BudgetRevision" ALTER COLUMN "category" DROP NOT NULL;
