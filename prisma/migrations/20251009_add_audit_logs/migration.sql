-- CreateEnum
CREATE TYPE "AuditActionType" AS ENUM (
  'SCHEDULE_GENERATE',
  'SCHEDULE_DELETE',
  'SHIFT_ADD',
  'SHIFT_DELETE',
  'SHIFT_EDIT',
  'USER_CREATE',
  'USER_DELETE',
  'USER_EDIT',
  'HOURS_APPROVE',
  'HOURS_REJECT',
  'HOURS_EDIT',
  'ABSENCE_CREATE',
  'ABSENCE_DELETE',
  'ABSENCE_EDIT',
  'SUBSTITUTION_APPROVE',
  'SUBSTITUTION_REJECT',
  'DATABASE_RESET',
  'DATABASE_BACKUP',
  'SETTINGS_CHANGE'
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userUsername" TEXT NOT NULL,
    "action" "AuditActionType" NOT NULL,
    "description" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

