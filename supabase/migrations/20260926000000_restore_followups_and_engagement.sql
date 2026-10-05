-- The minimal-schema migration (20260917000000_init_firsthey.sql) drops public.followups
-- and the engagement columns on leads, but the app still logs sent emails to followups
-- and reads reply/sequence state. Restore them (idempotent) so the email pipeline works.

CREATE TABLE IF NOT EXISTS public.followups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    sequence_position INT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'due', 'sending', 'sent', 'send_failed', 'skipped', 'cancelled')),
    subject TEXT,
    body TEXT,
    scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ,
    opened BOOLEAN DEFAULT false,
    opened_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_followups_lead ON public.followups(lead_id, created_at);
CREATE INDEX IF NOT EXISTS idx_followups_schedule_status ON public.followups(scheduled_for, status);

ALTER TABLE public.followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Followups access policy" ON public.followups;
CREATE POLICY "Followups access policy" ON public.followups
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = followups.lead_id
              AND leads.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
        )
    );

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS has_replied BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS sequence_status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS current_sequence_step INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_engagement_at TIMESTAMPTZ DEFAULT NULL;
