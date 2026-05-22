-- AlterTable: optional scooter number + worked by car
ALTER TABLE "shift_scooter_usages" ALTER COLUMN "scooterNumber" DROP NOT NULL;
ALTER TABLE "shift_scooter_usages" ADD COLUMN IF NOT EXISTS "usedAuto" BOOLEAN NOT NULL DEFAULT false;
