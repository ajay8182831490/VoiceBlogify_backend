/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `PlanFeature` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndDate` on the `Subscription` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "PlanFeature" DROP CONSTRAINT "PlanFeature_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "payerId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PlanFeature" DROP COLUMN "subscriptionId";

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "endDate",
DROP COLUMN "isActive",
DROP COLUMN "trialEndDate";
