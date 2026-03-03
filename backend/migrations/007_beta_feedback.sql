-- ============================================================================
-- Migration 007: Beta Feedback & Bug Reporting System
-- ============================================================================
-- Features: User feedback collection, bug reports, feature requests,
--           UX feedback, admin management, community voting on features
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Beta Feedback Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('bug', 'feature_request', 'ux_feedback', 'general')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'in_progress', 'resolved', 'wont_fix')),
  app_version VARCHAR(20),
  platform VARCHAR(20), -- ios, android, web
  device_info JSONB DEFAULT '{}',
  screenshot_urls TEXT[],
  metadata JSONB DEFAULT '{}',
  admin_notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX idx_beta_feedback_user ON beta_feedback(user_id, created_at DESC);
CREATE INDEX idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX idx_beta_feedback_severity ON beta_feedback(severity);
CREATE INDEX idx_beta_feedback_platform ON beta_feedback(platform);
CREATE INDEX idx_beta_feedback_created ON beta_feedback(created_at DESC);

-- ---------------------------------------------------------------------------
-- 3. Updated_at trigger
-- ---------------------------------------------------------------------------
-- The update_updated_at_column() function already exists from migration 006.
-- We only create the trigger for the beta_feedback table.
DO $$ BEGIN
  CREATE TRIGGER update_beta_feedback_updated_at
    BEFORE UPDATE ON beta_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
