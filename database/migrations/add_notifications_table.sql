-- ============================================================================
-- NOTIFICATIONS TABLE
-- ============================================================================
-- Stores in-app notifications for admin users
-- Used for signup alerts and other admin notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- admin user who should receive this
  type TEXT NOT NULL, -- 'signup', 'alert', 'warning', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB, -- flexible field for additional data (e.g., new user email, signup time)
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ
);

-- Index for quick lookup of unread notifications per user
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- Index for sorting by creation time
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- RLS Policies: Only admins can see notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view their notifications"
  ON notifications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.id = notifications.user_id
    )
  );

CREATE POLICY "Admins can update their notifications"
  ON notifications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.id = notifications.user_id
    )
  );

COMMENT ON TABLE notifications IS 'In-app notifications for admin users';
COMMENT ON COLUMN notifications.type IS 'Type of notification: signup, alert, warning, etc.';
COMMENT ON COLUMN notifications.metadata IS 'Flexible JSONB field for additional notification data';
