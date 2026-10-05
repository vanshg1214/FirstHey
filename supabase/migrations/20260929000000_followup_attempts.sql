-- Retry counter so a temporary send error (rate limit, network) retries later
-- instead of being treated as a bounce.
ALTER TABLE public.followups
    ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
