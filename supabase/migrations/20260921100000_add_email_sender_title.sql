-- Add email_sender_title column to organization_settings
ALTER TABLE public.organization_settings
ADD COLUMN IF NOT EXISTS email_sender_title TEXT;
