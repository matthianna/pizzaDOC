-- Remove legacy contact / WhatsApp columns from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "phoneNumber";
ALTER TABLE "users" DROP COLUMN IF EXISTS "whatsappNotificationsEnabled";
