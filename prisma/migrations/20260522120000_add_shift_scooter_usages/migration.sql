-- CreateTable
CREATE TABLE "shift_scooter_usages" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scooterNumber" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_scooter_usages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shift_scooter_usages_shiftId_key" ON "shift_scooter_usages"("shiftId");

-- AddForeignKey
ALTER TABLE "shift_scooter_usages" ADD CONSTRAINT "shift_scooter_usages_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_scooter_usages" ADD CONSTRAINT "shift_scooter_usages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterEnum
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SCOOTER_USAGE_CREATE';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SCOOTER_USAGE_EDIT';
ALTER TYPE "AuditActionType" ADD VALUE IF NOT EXISTS 'SCOOTER_USAGE_DELETE';
