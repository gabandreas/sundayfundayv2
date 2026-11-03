/*
  Warnings:

  - You are about to drop the column `field` on the `BudgetRevision` table. All the data in the column will be lost.
  - You are about to drop the column `oldValue` on the `BudgetRevision` table. All the data in the column will be lost.
  - Added the required column `category` to the `BudgetRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `difference` to the `BudgetRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `month` to the `BudgetRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `previousValue` to the `BudgetRevision` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `BudgetRevision` table without a default value. This is not possible if the table is not empty.
  - Made the column `reason` on table `BudgetRevision` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "BudgetRevisionCategory" AS ENUM ('SAVINGS', 'DAILY_OPERATIONAL', 'SELF_REWARD', 'BUFFER');

-- DropForeignKey
ALTER TABLE "BudgetRevision" DROP CONSTRAINT "BudgetRevision_snapshotId_fkey";

-- AlterTable
ALTER TABLE "BudgetRevision" DROP COLUMN "field",
DROP COLUMN "oldValue",
ADD COLUMN     "category" "BudgetRevisionCategory" NOT NULL,
ADD COLUMN     "difference" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "previousValue" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "year" INTEGER NOT NULL,
ALTER COLUMN "reason" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "MonthlySnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
