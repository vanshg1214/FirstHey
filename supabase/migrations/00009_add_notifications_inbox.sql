-- Add reply tracking columns to leads
ALTER TABLE leads 
ADD COLUMN IF NOT EXISTS has_replied BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reply_sentiment TEXT;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- e.g., 'reply_received', 'system_alert'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_data JSONB DEFAULT '{}'::jsonb, -- Store draft rebuttals and raw replies here
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for quick fetching by organization and unread status
CREATE INDEX IF NOT EXISTS idx_notifications_org_read 
ON notifications(organization_id, is_read);
