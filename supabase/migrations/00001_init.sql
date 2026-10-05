-- Create database schema for Exhibition Lead Capture & AI CRM

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ORGANIZATIONS
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    zoho_org_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. USERS (extends Supabase Auth Users)
CREATE TABLE public.users (
    id UUID PRIMARY KEY, -- matches auth.users.id
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('rep', 'admin')),
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. LEADS
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    captured_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'capturing' CHECK (status IN ('capturing', 'extracted', 'confirmed', 'synced', 'needs_attention')),
    contact_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
    context_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
    crm_record_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. RECORDINGS (1:1 with Lead)
CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE UNIQUE,
    audio_url TEXT,
    transcript TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. CARD_SCANS (1:1 with Lead)
CREATE TABLE public.card_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE UNIQUE,
    image_url TEXT,
    extracted_fields JSONB DEFAULT '{}'::jsonb NOT NULL,
    confidence NUMERIC DEFAULT 1.0 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 6. FOLLOWUPS
CREATE TABLE public.followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sequence_position INT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'due', 'sending', 'sent', 'send_failed', 'skipped')),
    subject TEXT,
    body TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 7. CRM_SYNC_LOG
CREATE TABLE public.crm_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    target_system TEXT NOT NULL, -- 'zoho' or 'sheets'
    status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
    error_message TEXT,
    synced_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_leads_org_created ON public.leads(organization_id, created_at DESC);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_crm_id ON public.leads(crm_record_id);
CREATE INDEX idx_followups_schedule_status ON public.followups(scheduled_for, status);

-- Enable Row-Level Security (RLS) on all tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_org_id()
RETURNS UUID AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- RLS Policies

-- Users: Access their own organization record
CREATE POLICY "Users can view their own organization" ON public.organizations
    FOR SELECT USING (
        id = public.get_user_org_id()
    );

CREATE POLICY "Admins can edit their organization" ON public.organizations
    FOR UPDATE USING (
        id = public.get_user_org_id() AND public.get_user_role() = 'admin'
    );

-- Users Profile
CREATE POLICY "Users can view users within same organization" ON public.users
    FOR SELECT USING (
        organization_id = public.get_user_org_id()
    );

CREATE POLICY "Admins can manage users within same organization" ON public.users
    FOR ALL USING (
        organization_id = public.get_user_org_id() AND public.get_user_role() = 'admin'
    );

-- Leads: RLS scoped by organization_id
CREATE POLICY "Leads access policy" ON public.leads
    FOR ALL USING (
        organization_id = public.get_user_org_id()
    );

-- Recordings
CREATE POLICY "Recordings access policy" ON public.recordings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = recordings.lead_id 
              AND leads.organization_id = public.get_user_org_id()
        )
    );

-- Card Scans
CREATE POLICY "Card scans access policy" ON public.card_scans
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = card_scans.lead_id 
              AND leads.organization_id = public.get_user_org_id()
        )
    );

-- Followups
CREATE POLICY "Followups access policy" ON public.followups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = followups.lead_id 
              AND leads.organization_id = public.get_user_org_id()
        )
    );

-- CRM Sync Log
CREATE POLICY "CRM sync log access policy" ON public.crm_sync_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = crm_sync_log.lead_id 
              AND leads.organization_id = public.get_user_org_id()
        )
    );
