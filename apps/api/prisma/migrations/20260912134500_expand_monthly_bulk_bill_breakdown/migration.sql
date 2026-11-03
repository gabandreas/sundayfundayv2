-- AlterTable
ALTER TABLE "MonthlyBulkBill" ADD COLUMN     "creditCardAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paylaterAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "personalDebtAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "label" SET DEFAULT 'Monthly Bulk Bill',
ALTER COLUMN "amount" SET DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyBulkBill_month_year_key" ON "MonthlyBulkBill"("month", "year");
