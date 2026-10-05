-- Migration: Add predictive lead scoring columns for AI Marketing Beast Mode

ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS priority_reason TEXT DEFAULT NULL;

-- Create an index to quickly fetch the hottest leads
CREATE INDEX IF NOT EXISTS idx_leads_score ON public.leads(score DESC);
