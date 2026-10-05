-- Migration: Add notes column to leads table for manual sales rep annotations
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
