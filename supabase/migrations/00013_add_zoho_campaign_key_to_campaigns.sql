-- Migration: Add zoho_campaign_key to campaigns table

ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS zoho_campaign_key TEXT DEFAULT NULL;
