-- AlterTable
ALTER TABLE "GlobalConfig" ADD COLUMN     "ccUsageLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paylaterUsageLimit" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "MonthlySnapshot" ADD COLUMN     "ccUsageLimit" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paylaterUsageLimit" INTEGER NOT NULL DEFAULT 0;
