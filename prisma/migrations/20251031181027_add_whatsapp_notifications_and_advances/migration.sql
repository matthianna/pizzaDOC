-- Rename column whatsappEnabled to whatsappNotificationsEnabled
ALTER TABLE "users" RENAME COLUMN "whatsappEnabled" TO "whatsappNotificationsEnabled";

-- Create advances table for tracking employee advances
CREATE TABLE "advances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "advances_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraint
ALTER TABLE "advances" ADD CONSTRAINT "advances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

