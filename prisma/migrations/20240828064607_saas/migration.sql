/*
  Warnings:

  - Added the required column `expiryTime` to the `Token` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "expiryTime" TIMESTAMP(3) NOT NULL;
