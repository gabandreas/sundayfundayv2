DO $$ BEGIN
  CREATE TYPE "PayrollAdjustmentStage" AS ENUM ('PRE_NET_EARNING', 'PRE_NET_DEDUCTION', 'POST_NET_DEDUCTION');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayrollAdjustmentCalcType" AS ENUM ('FIXED', 'PERCENT_OF_BASE', 'PER_WORKING_DAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "MonthlySnapshot" ADD COLUMN IF NOT EXISTS "directPayrollDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MonthlySnapshot" ADD COLUMN IF NOT EXISTS "customPayrollAdditions" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "MonthlySnapshot" ADD COLUMN IF NOT EXISTS "customPayrollDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PayrollAdjustmentTemplate" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "code" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "stage" "PayrollAdjustmentStage" NOT NULL,
  "calcType" "PayrollAdjustmentCalcType" NOT NULL DEFAULT 'FIXED',
  "defaultAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "isRecurring" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollAdjustmentTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollAdjustmentTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PayrollAdjustmentTemplate_userId_code_key" ON "PayrollAdjustmentTemplate"("userId", "code");
CREATE INDEX IF NOT EXISTS "PayrollAdjustmentTemplate_userId_isActive_idx" ON "PayrollAdjustmentTemplate"("userId", "isActive");

CREATE TABLE IF NOT EXISTS "PayrollPeriodAdjustment" (
  "id" SERIAL NOT NULL,
  "userId" INTEGER NOT NULL,
  "snapshotId" INTEGER NOT NULL,
  "templateId" INTEGER,
  "label" TEXT NOT NULL,
  "stage" "PayrollAdjustmentStage" NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PayrollPeriodAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PayrollPeriodAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayrollPeriodAdjustment_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MonthlySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PayrollPeriodAdjustment_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PayrollAdjustmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PayrollPeriodAdjustment_snapshotId_stage_idx" ON "PayrollPeriodAdjustment"("snapshotId", "stage");
CREATE INDEX IF NOT EXISTS "PayrollPeriodAdjustment_userId_snapshotId_idx" ON "PayrollPeriodAdjustment"("userId", "snapshotId");
