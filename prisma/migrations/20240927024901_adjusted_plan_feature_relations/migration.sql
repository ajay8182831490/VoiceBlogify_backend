/*
  Warnings:

  - You are about to drop the `Feature` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `dateOfCreation` on table `Post` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Feature" DROP CONSTRAINT "Feature_userId_fkey";

-- AlterTable
ALTER TABLE "Post" ALTER COLUMN "dateOfCreation" SET NOT NULL;

-- DropTable
DROP TABLE "Feature";

-- CreateTable
CREATE TABLE "PlanFeature" (
    "id" SERIAL NOT NULL,
    "plan" "Plan" NOT NULL,
    "featureName" TEXT NOT NULL,
    "description" TEXT,
    "limit" INTEGER NOT NULL,
    "billingCycle" "BillingCycle",
    "subscriptionId" TEXT,

    CONSTRAINT "PlanFeature_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PlanFeature" ADD CONSTRAINT "PlanFeature_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
