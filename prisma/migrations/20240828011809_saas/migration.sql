/*
  Warnings:

  - You are about to drop the column `postUrn` on the `Token` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId,platform]` on the table `Token` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Token" DROP COLUMN "postUrn",
ADD COLUMN     "postUrns" TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "Token_userId_platform_key" ON "Token"("userId", "platform");
