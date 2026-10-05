-- Migration: Scalability & Queue Infrastructure for Advanced Drip Engine

-- Create a robust job queue table for email dispatch
CREATE TABLE IF NOT EXISTS public.email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    followup_id UUID REFERENCES public.followups(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    locked_at TIMESTAMPTZ DEFAULT NULL, -- For worker concurrency locking
    
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    error_log TEXT DEFAULT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast polling of due jobs
CREATE INDEX IF NOT EXISTS idx_email_queue_poll 
ON public.email_queue(scheduled_for, status, locked_at) 
WHERE status = 'queued';

-- Add sequence tracking to leads table to manage 36-step sequences
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS current_sequence_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sequence_status TEXT DEFAULT 'active' CHECK (sequence_status IN ('active', 'paused', 'completed', 'bounced', 'unsubscribed')),
ADD COLUMN IF NOT EXISTS total_emails_sent INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_emails_opened INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_links_clicked INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ DEFAULT NULL;

-- Enable RLS on new table
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view queue for their organization"
    ON public.email_queue FOR SELECT
    USING (organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
    ));

CREATE POLICY "Users can manage queue for their organization"
    ON public.email_queue FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM public.users WHERE id = auth.uid()
    ));
