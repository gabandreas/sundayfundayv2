-- AlterTable
ALTER TABLE "MonthlySnapshot" ADD COLUMN     "isPayoutDateConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payrollPayoutDate" TIMESTAMP(3);
