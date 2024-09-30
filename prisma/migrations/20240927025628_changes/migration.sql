/*
  Warnings:

  - The values [BUSINESS] on the enum `Plan` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Plan_new" AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'BUIsNESS');
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TABLE "PlanFeature" ALTER COLUMN "plan" TYPE "Plan_new" USING ("plan"::text::"Plan_new");
ALTER TYPE "Plan" RENAME TO "Plan_old";
ALTER TYPE "Plan_new" RENAME TO "Plan";
DROP TYPE "Plan_old";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'FREE';
COMMIT;
