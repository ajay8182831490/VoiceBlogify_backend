/*
  Warnings:

  - The values [FREE_TRIAL,BASIC] on the enum `Plan` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[userId,platform]` on the table `Token` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `Feature` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'PREMIUM');
ALTER TABLE "Feature" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
COMMIT;

-- AlterTable
ALTER TABLE "Feature" ADD COLUMN     "userId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blogCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "profilepic" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Token_userId_platform_key" ON "Token"("userId", "platform");

-- AddForeignKey
ALTER TABLE "Feature" ADD CONSTRAINT "Feature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
