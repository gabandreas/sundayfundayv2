-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('DRAFT', 'LOCKED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'DEDUCTION', 'CREDIT_BILL');

-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "baseSalary" DOUBLE PRECISION NOT NULL,
    "dailyAllowance" DOUBLE PRECISION NOT NULL,
    "laptopAllowance" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlySnapshot" (
    "id" SERIAL NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" "SnapshotStatus" NOT NULL DEFAULT 'DRAFT',
    "salaryAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalWorkingDays" INTEGER NOT NULL,
    "cafeteriaDeduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "thrAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalaryIncome" DOUBLE PRECISION,
    "extraIncome" DOUBLE PRECISION,
    "finalTotalIncome" DOUBLE PRECISION,
    "totalDeductions" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditContract" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "principalAmount" DOUBLE PRECISION NOT NULL,
    "monthlyInstallment" DOUBLE PRECISION NOT NULL,
    "totalTenor" INTEGER NOT NULL,
    "remainingTenor" INTEGER NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledBill" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "dueDayOfMonth" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCardTransaction" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCardTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyBulkBill" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyBulkBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavingsManualTransaction" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavingsManualTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isPurchased" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRevision" (
    "id" SERIAL NOT NULL,
    "snapshotId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" DOUBLE PRECISION NOT NULL,
    "newValue" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" SERIAL NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonthlySnapshot_month_year_key" ON "MonthlySnapshot"("month", "year");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MonthlySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MonthlySnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
