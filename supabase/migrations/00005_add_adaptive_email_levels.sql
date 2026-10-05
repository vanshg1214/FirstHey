-- Migration 00005: Add adaptive email levels to followups table
ALTER TABLE followups
ADD COLUMN IF NOT EXISTS email_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS subject_level INTEGER DEFAULT 1;

-- Backfill existing followups
UPDATE followups
SET email_level = sequence_position, subject_level = 1
WHERE email_level IS NULL OR subject_level IS NULL;
