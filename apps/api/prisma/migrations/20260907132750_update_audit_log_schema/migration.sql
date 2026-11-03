/*
  Warnings:

  - You are about to drop the column `detail` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entity` on the `AuditLog` table. All the data in the column will be lost.
  - You are about to drop the column `entityId` on the `AuditLog` table. All the data in the column will be lost.
  - Added the required column `category` to the `AuditLog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `summary` to the `AuditLog` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AuditCategory" AS ENUM ('TRANSACTIONS', 'LIABILITIES', 'SAVINGS', 'SETTINGS', 'BUDGET');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('INFO', 'WARNING', 'DEFICIT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "AuditLog" DROP COLUMN "detail",
DROP COLUMN "entity",
DROP COLUMN "entityId",
ADD COLUMN     "category" "AuditCategory" NOT NULL,
ADD COLUMN     "details" TEXT,
ADD COLUMN     "month" INTEGER,
ADD COLUMN     "severity" "AuditSeverity" NOT NULL DEFAULT 'INFO',
ADD COLUMN     "summary" TEXT NOT NULL,
ADD COLUMN     "year" INTEGER;
