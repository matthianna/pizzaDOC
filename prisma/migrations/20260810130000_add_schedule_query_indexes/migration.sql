-- CreateIndex
CREATE INDEX "shifts_userId_idx" ON "shifts"("userId");

-- CreateIndex
CREATE INDEX "shifts_scheduleId_idx" ON "shifts"("scheduleId");

-- CreateIndex
CREATE INDEX "substitutions_shiftId_idx" ON "substitutions"("shiftId");

-- CreateIndex
CREATE INDEX "substitutions_status_deadline_idx" ON "substitutions"("status", "deadline");

-- CreateIndex
CREATE INDEX "substitutions_requesterId_idx" ON "substitutions"("requesterId");

-- CreateIndex
CREATE INDEX "worked_hours_userId_idx" ON "worked_hours"("userId");

-- CreateIndex
CREATE INDEX "worked_hours_status_idx" ON "worked_hours"("status");
