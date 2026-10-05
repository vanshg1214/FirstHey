-- Migration: Add Exhibitions Table
-- Run this in the SQL Editor of your Supabase project

-- 1. Create Exhibitions Table
CREATE TABLE IF NOT EXISTS public.exhibitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT,
    start_date DATE,
    end_date DATE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add exhibition_id to leads
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS exhibition_id UUID REFERENCES public.exhibitions(id) ON DELETE SET NULL;

-- 3. Enable RLS
ALTER TABLE public.exhibitions ENABLE ROW LEVEL SECURITY;

-- 4. Create basic RLS policies for exhibitions
CREATE POLICY "Users can view their organization's exhibitions"
    ON public.exhibitions FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their organization's exhibitions"
    ON public.exhibitions FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can update their organization's exhibitions"
    ON public.exhibitions FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their organization's exhibitions"
    ON public.exhibitions FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.users WHERE id = auth.uid()
        )
    );
