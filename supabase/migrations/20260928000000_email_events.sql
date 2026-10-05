-- One row per open or click, so engagement can be analysed per email, per lead,
-- per exhibition and per campaign. leads.open_count / open_history stay as a quick summary.

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
CREATE POLICY "Email events access policy" ON public.email_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leads
            WHERE leads.id = email_events.lead_id
              AND leads.organization_id IN (SELECT organization_id FROM public.users WHERE id = auth.uid())
        )
    );

ALTER TABLE public.leads
    ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_clicked_at TIMESTAMPTZ DEFAULT NULL;
