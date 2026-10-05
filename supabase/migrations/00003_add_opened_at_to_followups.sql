-- Add opened_at column to followups table to track exact time recipient opened the email
ALTER TABLE public.followups ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
