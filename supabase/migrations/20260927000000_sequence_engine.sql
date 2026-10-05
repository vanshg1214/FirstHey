-- Support for the automatic 14-day follow-up sequence.

ALTER TABLE public.followups
    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;

-- One email row per position per lead, so two overlapping runs can never queue the same touch twice.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_followups_email_position
    ON public.followups(lead_id, sequence_position)
    WHERE channel = 'email';

-- Fast lookup of due emails for the cron job.
CREATE INDEX IF NOT EXISTS idx_followups_due
    ON public.followups(scheduled_for)
    WHERE status = 'queued' AND channel = 'email';
