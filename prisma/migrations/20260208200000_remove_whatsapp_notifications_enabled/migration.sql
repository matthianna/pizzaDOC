-- Drop legacy WhatsApp preference column (WAHA integration removed)
ALTER TABLE "users" DROP COLUMN IF EXISTS "whatsappNotificationsEnabled";
