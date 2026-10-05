-- Add Organization Settings table for SaaS BYOK model
CREATE TABLE public.organization_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE UNIQUE,
    gemini_api_key TEXT,
    email_provider TEXT DEFAULT 'gmail' CHECK (email_provider IN ('gmail', 'smtp', 'resend')),
    email_user TEXT,
    email_password TEXT,
    email_from_name TEXT,
    zoho_client_id TEXT,
    zoho_client_secret TEXT,
    zoho_refresh_token TEXT,
    zoho_api_url TEXT DEFAULT 'https://www.zohoapis.com',
    zoho_accounts_url TEXT DEFAULT 'https://accounts.zoho.com',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS Policies
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own organization settings" ON public.organization_settings
    FOR SELECT USING (
        organization_id = public.get_user_org_id()
    );

CREATE POLICY "Admins can update their organization settings" ON public.organization_settings
    FOR ALL USING (
        organization_id = public.get_user_org_id() AND public.get_user_role() = 'admin'
    );

-- Create a trigger to automatically create a settings row when a new organization is created
CREATE OR REPLACE FUNCTION public.handle_new_organization_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_organization_settings();

-- Backfill existing organizations
INSERT INTO public.organization_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;
