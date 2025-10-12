-- AlterTable shift_limits: Replace minStaff and maxStaff with requiredStaff
-- Migration to simplify shift limits to use a single "required staff" field

-- Step 1: Add new requiredStaff column with default value
ALTER TABLE "shift_limits" ADD COLUMN "requiredStaff" INTEGER NOT NULL DEFAULT 1;

-- Step 2: Copy data from minStaff to requiredStaff (use minStaff as the baseline)
UPDATE "shift_limits" SET "requiredStaff" = "minStaff";

-- Step 3: Drop old columns
ALTER TABLE "shift_limits" DROP COLUMN "minStaff";
ALTER TABLE "shift_limits" DROP COLUMN "maxStaff";

