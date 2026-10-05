-- Add exhibition and stall to leads table
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS exhibition TEXT,
ADD COLUMN IF NOT EXISTS stall TEXT;
