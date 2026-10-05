-- Add company_profile to organization_settings for AI Assistant context
ALTER TABLE public.organization_settings ADD COLUMN IF NOT EXISTS company_profile TEXT;
