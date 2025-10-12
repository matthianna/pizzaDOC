-- AlterTable shift_start_time_distributions: Add dayOfWeek column
-- Migration to add day-specific start time distributions

-- Step 1: Add dayOfWeek column with default value 0 (will be updated)
ALTER TABLE "shift_start_time_distributions" ADD COLUMN "dayOfWeek" INTEGER NOT NULL DEFAULT 0;

-- Step 2: Drop old unique constraint
DROP INDEX IF EXISTS "shift_start_time_distributions_shiftType_role_startTime_key";

-- Step 3: Create new unique constraint with dayOfWeek
CREATE UNIQUE INDEX "shift_start_time_distributions_dayOfWeek_shiftType_role_startTime_key" 
ON "shift_start_time_distributions"("dayOfWeek", "shiftType", "role", "startTime");

