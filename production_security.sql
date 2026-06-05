-- ============================================================
-- FINAL AUDIT: PRODUCTION SECURITY & RLS POLICIES
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Enable RLS on all tables
ALTER TABLE lost_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE found_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Public can view active lost items" ON lost_items;
DROP POLICY IF EXISTS "Users can insert lost items" ON lost_items;
DROP POLICY IF EXISTS "Users can view their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert messages" ON messages;

-- 3. Create strict RLS Policies

-- LOST ITEMS
-- Anyone can read active lost items
CREATE POLICY "Public can view active lost items" ON lost_items
  FOR SELECT USING (status = 'active');
-- Only the owner can view their own resolved/draft items
CREATE POLICY "Users can view own lost items" ON lost_items
  FOR SELECT USING (auth.uid() = user_id);
-- Authenticated users can insert
CREATE POLICY "Users can insert lost items" ON lost_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only the owner can update
CREATE POLICY "Users can update own lost items" ON lost_items
  FOR UPDATE USING (auth.uid() = user_id);

-- FOUND ITEMS
-- Anyone can read active found items
CREATE POLICY "Public can view active found items" ON found_items
  FOR SELECT USING (status = 'active');
-- Only the owner can view their own
CREATE POLICY "Users can view own found items" ON found_items
  FOR SELECT USING (auth.uid() = user_id);
-- Authenticated users can insert
CREATE POLICY "Users can insert found items" ON found_items
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
-- Only the owner can update
CREATE POLICY "Users can update own found items" ON found_items
  FOR UPDATE USING (auth.uid() = user_id);

-- MATCHES
-- Users can view matches involving their items
CREATE POLICY "Users can view relevant matches" ON matches
  FOR SELECT USING (
    lost_item_id IN (SELECT id FROM lost_items WHERE user_id = auth.uid()) OR
    found_item_id IN (SELECT id FROM found_items WHERE user_id = auth.uid())
  );

-- MESSAGES
-- Users can only view messages where they are sender or receiver
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
-- Users can only insert messages as themselves
CREATE POLICY "Users can insert messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- NOTIFICATIONS
-- Users can only view and update their own notifications
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true); -- In a true production app, this would be restricted to service roles, but for client-side agents we allow insert.

-- CLAIMS
-- Users can view claims they made or claims made on their found items
CREATE POLICY "Users can view relevant claims" ON claims
  FOR SELECT USING (
    claimant_id = auth.uid() OR
    item_id IN (SELECT id FROM found_items WHERE user_id = auth.uid())
  );
-- Users can insert claims for themselves
CREATE POLICY "Users can insert claims" ON claims
  FOR INSERT WITH CHECK (auth.uid() = claimant_id);

-- AGENT LOGS
-- Anyone can view agent logs (for pipeline visualization)
CREATE POLICY "Public can view agent logs" ON agent_logs
  FOR SELECT USING (true);
-- Authenticated users can insert agent logs
CREATE POLICY "Users can insert agent logs" ON agent_logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 4. Enable Realtime for required tables
-- NOTE: You must also ensure these tables are checked in the Supabase Dashboard -> Database -> Replication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_logs;

-- Audit Complete.
