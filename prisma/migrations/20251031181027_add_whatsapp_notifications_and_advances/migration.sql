-- Add whatsappNotificationsEnabled column if it doesn't exist (renamed from whatsappEnabled)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='whatsappNotificationsEnabled') THEN
        -- Try to rename from old column
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='users' AND column_name='whatsappEnabled') THEN
            ALTER TABLE "users" RENAME COLUMN "whatsappEnabled" TO "whatsappNotificationsEnabled";
        ELSE
            -- Add new column if neither exists
            ALTER TABLE "users" ADD COLUMN "whatsappNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;
        END IF;
    END IF;
END $$;

-- Create advances table for tracking employee advances
CREATE TABLE IF NOT EXISTS "advances" (
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

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'advances_userId_fkey'
    ) THEN
        ALTER TABLE "advances" ADD CONSTRAINT "advances_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;


