-- 004_push_subscriptions.sql
-- Web Push subscriptions table for browser notification support

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can insert their own subscriptions
CREATE POLICY "Users insert own subscriptions" ON push_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own subscriptions
CREATE POLICY "Users select own subscriptions" ON push_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can delete their own subscriptions (unsubscribe)
CREATE POLICY "Users delete own subscriptions" ON push_subscriptions
  FOR DELETE USING (auth.uid() = user_id);
