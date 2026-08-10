-- AlterTable
ALTER TABLE "users" ADD COLUMN "calendarToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_calendarToken_key" ON "users"("calendarToken");
