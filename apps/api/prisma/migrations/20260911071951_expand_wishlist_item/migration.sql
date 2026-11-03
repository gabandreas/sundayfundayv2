/*
  Warnings:

  - You are about to drop the column `isPurchased` on the `WishlistItem` table. All the data in the column will be lost.
  - You are about to drop the column `label` on the `WishlistItem` table. All the data in the column will be lost.
  - You are about to drop the column `targetAmount` on the `WishlistItem` table. All the data in the column will be lost.
  - Added the required column `name` to the `WishlistItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `WishlistItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "WishlistFundingType" AS ENUM ('CASH', 'INSTALLMENT');

-- CreateEnum
CREATE TYPE "WishlistStatus" AS ENUM ('PLANNING', 'READY', 'PURCHASED');

-- AlterTable
ALTER TABLE "WishlistItem" DROP COLUMN "isPurchased",
DROP COLUMN "label",
DROP COLUMN "targetAmount",
ADD COLUMN     "fundingType" "WishlistFundingType" NOT NULL DEFAULT 'CASH',
ADD COLUMN     "interestPercent" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "monthlyPayment" DOUBLE PRECISION,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "price" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "status" "WishlistStatus" NOT NULL DEFAULT 'PLANNING',
ADD COLUMN     "targetMonth" INTEGER,
ADD COLUMN     "targetYear" INTEGER,
ADD COLUMN     "tenor" INTEGER;
