-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "mediumUserId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "RefreshToken" TEXT,
ADD COLUMN     "lastActiveDay" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
