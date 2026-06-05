-- ============================================================
-- AI CLAIM VERIFICATION SYSTEM — DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Drop existing claims table if any
DROP TABLE IF EXISTS claims CASCADE;

-- Create Claims Table (all columns needed by ClaimItem.jsx & AdminDashboard.jsx)
CREATE TABLE claims (
  id                  UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  item_id             UUID NOT NULL,
  item_type           TEXT NOT NULL CHECK (item_type IN ('lost', 'found')),
  claimant_id         UUID NOT NULL,
  owner_id            UUID,
  questions           JSONB DEFAULT '[]',
  answers             JSONB DEFAULT '[]',
  verification_score  INTEGER,
  ai_verdict          TEXT CHECK (ai_verdict IN ('verified', 'likely', 'uncertain', 'suspicious')),
  ai_reasoning        TEXT,
  per_question_scores JSONB DEFAULT '[]',
  status              TEXT NOT NULL DEFAULT 'pending_questions'
                      CHECK (status IN ('pending_questions', 'pending_review', 'approved', 'rejected')),
  reviewed_at         TIMESTAMP WITH TIME ZONE,
  created_at          TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Disable RLS so the app can read/write freely
ALTER TABLE claims DISABLE ROW LEVEL SECURITY;

-- Enable Realtime for live admin updates
ALTER PUBLICATION supabase_realtime ADD TABLE claims;

-- Indexes for faster queries
CREATE INDEX idx_claims_claimant_id ON claims(claimant_id);
CREATE INDEX idx_claims_item_id ON claims(item_id);
CREATE INDEX idx_claims_status ON claims(status);

-- Done! ✅ The AI Claim Verification System is ready.
