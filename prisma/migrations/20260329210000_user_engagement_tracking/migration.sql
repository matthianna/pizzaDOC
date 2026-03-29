-- AlterTable
ALTER TABLE "users" ADD COLUMN "notificationPermissionReported" TEXT,
ADD COLUMN "notificationPermissionReportedAt" TIMESTAMP(3),
ADD COLUMN "clientPushSubscribedReported" BOOLEAN,
ADD COLUMN "clientPushSubscribedReportedAt" TIMESTAMP(3),
ADD COLUMN "engagementPwaSnoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "engagementPwaSnoozedUntil" TIMESTAMP(3),
ADD COLUMN "engagementPushSnoozeCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "engagementPushSnoozedUntil" TIMESTAMP(3);
