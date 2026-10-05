-- Add address column to leads for mailing/sticker label generation
ALTER TABLE public.leads
ADD COLUMN IF NOT EXISTS address TEXT;
