-- FirstHey: complete database setup.
--
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- It is safe to run any number of times, on a new or an existing database:
-- it only creates what is missing and never drops tables or deletes data.

-- ============================================================
-- 1. CORE TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.organization_settings (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_settings
    ADD COLUMN IF NOT EXISTS gemini_api_key TEXT,
    ADD COLUMN IF NOT EXISTS email_provider TEXT,
    ADD COLUMN IF NOT EXISTS email_user TEXT,
    ADD COLUMN IF NOT EXISTS email_password TEXT,
    ADD COLUMN IF NOT EXISTS email_from_name TEXT,
    ADD COLUMN IF NOT EXISTS email_sender_title TEXT,
    ADD COLUMN IF NOT EXISTS company_profile TEXT,
    ADD COLUMN IF NOT EXISTS zoho_client_id TEXT,
    ADD COLUMN IF NOT EXISTS zoho_client_secret TEXT,
    ADD COLUMN IF NOT EXISTS zoho_refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS zoho_api_url TEXT,
    ADD COLUMN IF NOT EXISTS zoho_accounts_url TEXT,
    ADD COLUMN IF NOT EXISTS zoho_campaign_key TEXT,
    ADD COLUMN IF NOT EXISTS zoho_campaigns_api_url TEXT;

-- The email_provider check from an older schema only allowed three values; drop it if present.
ALTER TABLE public.organization_settings DROP CONSTRAINT IF EXISTS organization_settings_email_provider_check;

CREATE TABLE IF NOT EXISTS public.exhibitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS captured_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    -- contact
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS company TEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS secondary_phone TEXT,
    ADD COLUMN IF NOT EXISTS website TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    -- event
    ADD COLUMN IF NOT EXISTS exhibition TEXT,
    ADD COLUMN IF NOT EXISTS stall TEXT,
    ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL,
    -- notes and AI context
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS context_summary JSONB,
    ADD COLUMN IF NOT EXISTS contact_fields JSONB,
    ADD COLUMN IF NOT EXISTS "cardImage" TEXT,
    -- status and CRM
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS crm_record_id TEXT,
    ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS priority_reason TEXT,
    -- email engagement
    ADD COLUMN IF NOT EXISTS is_opened BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS open_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS open_history JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS has_replied BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS reply_sentiment TEXT,
    ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_emails_opened INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_links_clicked INTEGER DEFAULT 0,
    -- email sequence
    ADD COLUMN IF NOT EXISTS sequence_status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS current_sequence_step INTEGER DEFAULT 0;

-- Older schemas limited these to a fixed list of values; replace with the current ones.
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_sequence_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_sequence_status_check
    CHECK (sequence_status IS NULL OR sequence_status IN ('active', 'paused', 'completed', 'bounced', 'unsubscribed'));

CREATE TABLE IF NOT EXISTS public.followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sequence_position INT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.followups
    ADD COLUMN IF NOT EXISTS subject TEXT,
    ADD COLUMN IF NOT EXISTS body TEXT,
    ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

ALTER TABLE public.followups DROP CONSTRAINT IF EXISTS followups_status_check;
ALTER TABLE public.followups ADD CONSTRAINT followups_status_check
    CHECK (status IN ('queued', 'due', 'sending', 'sent', 'send_failed', 'skipped', 'cancelled'));
ALTER TABLE public.followups DROP CONSTRAINT IF EXISTS followups_channel_check;
ALTER TABLE public.followups ADD CONSTRAINT followups_channel_check
    CHECK (channel IN ('email', 'whatsapp'));

-- One open or click per row, for per-email and per-exhibition analytics.
CREATE TABLE IF NOT EXISTS public.email_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    organization_id UUID,
    touch INT,
    event_type TEXT NOT NULL CHECK (event_type IN ('open', 'click')),
    link_key TEXT,
    ip TEXT,
    user_agent TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    zoho_campaign_key TEXT,
    zoho_list_key TEXT,
    zoho_list_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campaign_leads (
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (campaign_id, lead_id)
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_data JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.crm_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    target_system TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcript TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_exhibition ON public.leads(exhibition_id);
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_followups_lead ON public.followups(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_followups_schedule_status ON public.followups(scheduled_for, status);

-- One email row per position per lead, so overlapping runs can never queue the same email twice.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_followups_email_position
    ON public.followups(lead_id, sequence_position) WHERE channel = 'email';

-- Fast lookup of due emails for the sender job.
CREATE INDEX IF NOT EXISTS idx_followups_due
    ON public.followups(scheduled_for) WHERE status = 'queued' AND channel = 'email';

CREATE INDEX IF NOT EXISTS idx_email_events_lead ON public.email_events(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_org_type ON public.email_events(organization_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON public.campaigns(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON public.campaign_leads(lead_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org_read ON public.notifications(organization_id, is_read);

-- ============================================================
-- 3. ROW LEVEL SECURITY
-- The server uses the service-role key, which bypasses these rules;
-- they protect anything that talks to the database as a logged-in user.
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own org" ON public.organizations;
CREATE POLICY "Users view own org" ON public.organizations FOR SELECT
    USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users view own record" ON public.users;
CREATE POLICY "Users view own record" ON public.users FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Users manage own org settings" ON public.organization_settings;
CREATE POLICY "Users manage own org settings" ON public.organization_settings FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Org exhibitions access" ON public.exhibitions;
DROP POLICY IF EXISTS "Users can view their organization's exhibitions" ON public.exhibitions;
DROP POLICY IF EXISTS "Users can insert their organization's exhibitions" ON public.exhibitions;
DROP POLICY IF EXISTS "Users can update their organization's exhibitions" ON public.exhibitions;
DROP POLICY IF EXISTS "Users can delete their organization's exhibitions" ON public.exhibitions;
CREATE POLICY "Org exhibitions access" ON public.exhibitions FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users manage leads in own org" ON public.leads;
CREATE POLICY "Users manage leads in own org" ON public.leads FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Followups access policy" ON public.followups;
CREATE POLICY "Followups access policy" ON public.followups FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = followups.lead_id
          AND leads.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Email events access policy" ON public.email_events;
CREATE POLICY "Email events access policy" ON public.email_events FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Campaigns access policy" ON public.campaigns;
CREATE POLICY "Campaigns access policy" ON public.campaigns FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Campaign Leads access policy" ON public.campaign_leads;
CREATE POLICY "Campaign Leads access policy" ON public.campaign_leads FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.campaigns
        WHERE campaigns.id = campaign_leads.campaign_id
          AND campaigns.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Notifications access policy" ON public.notifications;
CREATE POLICY "Notifications access policy" ON public.notifications FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "CRM sync log access policy" ON public.crm_sync_log;
CREATE POLICY "CRM sync log access policy" ON public.crm_sync_log FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = crm_sync_log.lead_id
          AND leads.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    ));

DROP POLICY IF EXISTS "Recordings access policy" ON public.recordings;
CREATE POLICY "Recordings access policy" ON public.recordings FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.leads
        WHERE leads.id = recordings.lead_id
          AND leads.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
    ));

-- ============================================================
-- 4. SIGNUP: every new login gets an organization, a profile row and a settings row
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_org_id uuid;
BEGIN
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(new.raw_user_meta_data->>'company_name', 'My Organization'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.users (id, organization_id, role, email)
  VALUES (new.id, new_org_id, 'admin', new.email)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_new_organization_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.organization_settings (organization_id)
  VALUES (new.id)
  ON CONFLICT (organization_id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_organization_settings();

-- Give any existing organization a settings row.
INSERT INTO public.organization_settings (organization_id)
SELECT id FROM public.organizations
ON CONFLICT (organization_id) DO NOTHING;
