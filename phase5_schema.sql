-- ============================================================
-- PHASE 5: DATABASE OPTIMIZATIONS & SMART NOTIFICATIONS
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Smart Notifications: Add action columns
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS action_link TEXT,
ADD COLUMN IF NOT EXISTS action_label TEXT;

-- 2. Performance: Add indices to speed up queries
CREATE INDEX IF NOT EXISTS idx_lost_items_status ON lost_items(status);
CREATE INDEX IF NOT EXISTS idx_lost_items_created_at ON lost_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_found_items_status ON found_items(status);
CREATE INDEX IF NOT EXISTS idx_found_items_created_at ON found_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

-- Complete!
