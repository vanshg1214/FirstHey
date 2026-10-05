-- Migration: Initialize FirstHey Database Schema (Clean Slate)
-- Run this in the SQL Editor of your Supabase project

-- ==========================================
-- 1. CLEANUP (REMOVE LEGACY TABLES)
-- ==========================================
-- Drop existing tables to ensure a clean slate before creating the new schema.
-- Note: CASCADE will also drop dependent objects like foreign keys or views.

DROP TABLE IF EXISTS public.campaign_leads CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.crm_sync_log CASCADE;
DROP TABLE IF EXISTS public.recordings CASCADE;
DROP TABLE IF EXISTS public.card_scans CASCADE;
DROP TABLE IF EXISTS public.followups CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.instant_leads CASCADE;
DROP TABLE IF EXISTS public.exhibitions CASCADE;
DROP TABLE IF EXISTS public.organization_settings CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;

-- ==========================================
-- 2. CREATE NEW MINIMAL SCHEMA
-- ==========================================

-- Organizations (Multi-tenant support)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Settings (API keys, email configs)
CREATE TABLE public.organization_settings (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    gemini_api_key TEXT,
    email_user TEXT,
    email_password TEXT,
    email_from_name TEXT,
    email_provider TEXT,
    company_profile TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (Auth linking)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leads (Core functionality)
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    captured_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Contact Info
    name TEXT,
    company TEXT,
    title TEXT,
    email TEXT,
    phone TEXT,
    secondary_phone TEXT,
    website TEXT,
    
    -- Event Info
    exhibition TEXT,
    stall TEXT,
    
    -- AI Extracted Context
    notes TEXT,
    context_summary JSONB,
    
    -- Status & Tracking
    status TEXT DEFAULT 'pending',
    source TEXT DEFAULT 'manual',
    is_opened BOOLEAN DEFAULT false,
    open_count INTEGER DEFAULT 0,
    open_history JSONB DEFAULT '[]'::jsonb,
    
    -- Legacy compatibility (optional)
    contact_fields JSONB,
    cardImage TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Users can only see data for their organization)
CREATE POLICY "Users view own org" ON public.organizations FOR SELECT USING (id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users manage own org settings" ON public.organization_settings FOR ALL USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
CREATE POLICY "Users view own record" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users manage leads in own org" ON public.leads FOR ALL USING (organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid()));
