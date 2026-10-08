-- FirstHey: adds only what is missing. Safe to run more than once. Never drops or deletes data.

-- 1. Missing columns on existing tables
ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS crm_record_id TEXT,
    ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS priority_reason TEXT,
    ADD COLUMN IF NOT EXISTS reply_sentiment TEXT,
    ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "cardImage" TEXT;

ALTER TABLE public.followups
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- 2. Opens and clicks, one row each (powers Analytics and the lead's engagement summary)
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
CREATE INDEX IF NOT EXISTS idx_email_events_lead ON public.email_events(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_email_events_org_type ON public.email_events(organization_id, event_type, created_at);
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Email events access policy" ON public.email_events;
CREATE POLICY "Email events access policy" ON public.email_events FOR SELECT
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

-- 3. Replies and alerts (reply log, inbox notifications)
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
CREATE INDEX IF NOT EXISTS idx_notifications_org_read ON public.notifications(organization_id, is_read);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications access policy" ON public.notifications;
CREATE POLICY "Notifications access policy" ON public.notifications FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

-- 4. Voice recordings and transcripts
CREATE TABLE IF NOT EXISTS public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
    audio_url TEXT,
    transcript TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Recordings access policy" ON public.recordings;
CREATE POLICY "Recordings access policy" ON public.recordings FOR ALL
    USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = recordings.lead_id
        AND l.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())));

-- 5. CRM sync log
CREATE TABLE IF NOT EXISTS public.crm_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    target_system TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CRM sync log access policy" ON public.crm_sync_log;
CREATE POLICY "CRM sync log access policy" ON public.crm_sync_log FOR ALL
    USING (EXISTS (SELECT 1 FROM public.leads l WHERE l.id = crm_sync_log.lead_id
        AND l.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())));

-- 6. Campaigns
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
CREATE INDEX IF NOT EXISTS idx_campaigns_org_created ON public.campaigns(organization_id, created_at DESC);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaigns access policy" ON public.campaigns;
CREATE POLICY "Campaigns access policy" ON public.campaigns FOR ALL
    USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.campaign_leads (
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (campaign_id, lead_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_leads_lead ON public.campaign_leads(lead_id);
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Campaign Leads access policy" ON public.campaign_leads;
CREATE POLICY "Campaign Leads access policy" ON public.campaign_leads FOR ALL
    USING (EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_leads.campaign_id
        AND c.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())));

-- 7. Make the new tables visible to the API right away
NOTIFY pgrst, 'reload schema';
