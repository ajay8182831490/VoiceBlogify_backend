/*
  Warnings:

  - You are about to drop the column `subscriptionId` on the `Payment` table. All the data in the column will be lost.
  - Added the required column `payerId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `paymentId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_subscriptionId_fkey";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "subscriptionId",
ADD COLUMN     "payerId" TEXT NOT NULL,
ADD COLUMN     "paymentId" TEXT NOT NULL;
