-- Create Campaigns Tables

-- 1. CAMPAIGNS
CREATE TABLE public.campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. CAMPAIGN_LEADS (Many-to-Many linking leads to campaigns)
CREATE TABLE public.campaign_leads (
    campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (campaign_id, lead_id)
);

-- Indexes for performance
CREATE INDEX idx_campaigns_org_created ON public.campaigns(organization_id, created_at DESC);
CREATE INDEX idx_campaign_leads_campaign ON public.campaign_leads(campaign_id);
CREATE INDEX idx_campaign_leads_lead ON public.campaign_leads(lead_id);

-- Enable Row-Level Security (RLS)
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;

-- Add tracking columns to followups if they don't exist
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS opened BOOLEAN DEFAULT false;

-- RLS Policies

-- Campaigns: RLS scoped by organization_id
CREATE POLICY "Campaigns access policy" ON public.campaigns
    FOR ALL USING (
        organization_id = public.get_user_org_id()
    );

-- Campaign Leads: RLS scoped by linking through campaigns and checking org
CREATE POLICY "Campaign Leads access policy" ON public.campaign_leads
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.campaigns
            WHERE campaigns.id = campaign_leads.campaign_id 
              AND campaigns.organization_id = public.get_user_org_id()
        )
    );
