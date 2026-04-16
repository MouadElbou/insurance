-- AlterTable: add jti column to refresh_tokens
-- Step 1: Add column as nullable first (existing rows need a value)
ALTER TABLE "refresh_tokens" ADD COLUMN "jti" TEXT;

-- Step 2: Backfill existing rows with a generated UUID
UPDATE "refresh_tokens" SET "jti" = gen_random_uuid()::text WHERE "jti" IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE "refresh_tokens" ALTER COLUMN "jti" SET NOT NULL;

-- Step 4: Add unique index
CREATE UNIQUE INDEX "refresh_tokens_jti_key" ON "refresh_tokens"("jti");
