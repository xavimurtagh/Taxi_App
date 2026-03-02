-- ============================================================================
-- Migration 006: Phase 3 — Polish & Scale Features
-- ============================================================================
-- Features: Push notifications, Ride scheduling, Multiple vehicle types,
--           Accessibility, In-app chat, Ride sharing/carpooling,
--           Driver referral program, Multi-language support, Offline sync
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Push Notification Preferences & History
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ride_updates BOOLEAN DEFAULT TRUE,
  chat_messages BOOLEAN DEFAULT TRUE,
  governance_updates BOOLEAN DEFAULT TRUE,
  promotions BOOLEAN DEFAULT FALSE,
  scheduled_ride_reminders BOOLEAN DEFAULT TRUE,
  referral_updates BOOLEAN DEFAULT TRUE,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  category VARCHAR(50) NOT NULL, -- ride, chat, governance, referral, scheduled, system
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX idx_notification_history_user ON notification_history(user_id, sent_at DESC);
CREATE INDEX idx_notification_history_unread ON notification_history(user_id) WHERE read = FALSE;

-- ---------------------------------------------------------------------------
-- 2. Ride Scheduling (book in advance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_address TEXT NOT NULL,
  dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
  dropoff_address TEXT NOT NULL,
  vehicle_type VARCHAR(20) DEFAULT 'economy',
  scheduled_time TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'scheduled'
    CHECK (status IN ('scheduled', 'reminder_sent', 'dispatching', 'matched', 'cancelled', 'expired')),
  ride_id UUID REFERENCES rides(id),
  estimated_fare DECIMAL(10,2),
  notes TEXT,
  accessibility_needed BOOLEAN DEFAULT FALSE,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB, -- { days: [1,3,5], end_date: '...' }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_rides_passenger ON scheduled_rides(passenger_id);
CREATE INDEX idx_scheduled_rides_time ON scheduled_rides(scheduled_time) WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_rides_status ON scheduled_rides(status);

-- ---------------------------------------------------------------------------
-- 3. Vehicle Type Configuration (dynamic pricing multipliers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_type_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key VARCHAR(30) UNIQUE NOT NULL, -- economy, comfort, xl, accessible, pool
  label VARCHAR(50) NOT NULL,
  description TEXT,
  price_multiplier DECIMAL(4,2) DEFAULT 1.0,
  min_capacity INT DEFAULT 1,
  max_capacity INT DEFAULT 4,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  features JSONB DEFAULT '[]', -- ['wifi', 'child_seat', 'pet_friendly']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO vehicle_type_configs (type_key, label, description, price_multiplier, max_capacity, icon, sort_order) VALUES
  ('economy', 'Economy', 'Affordable everyday rides', 1.0, 4, 'car-outline', 0),
  ('comfort', 'Comfort', 'Newer cars with extra legroom', 1.3, 4, 'car-sport', 1),
  ('xl', 'XL', 'Larger vehicles for groups', 1.5, 6, 'car', 2),
  ('accessible', 'Accessible', 'Wheelchair-accessible vehicles', 1.0, 4, 'accessibility', 3),
  ('pool', 'Pool', 'Share your ride and save', 0.7, 4, 'people', 4)
ON CONFLICT (type_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. Accessibility Features
-- ---------------------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS accessibility_needs JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;

-- accessibility_needs structure: { wheelchair: bool, visual_assistance: bool, hearing_assistance: bool, service_animal: bool }

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS accessibility_features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS shared_ride_id UUID,
  ADD COLUMN IF NOT EXISTS scheduled_ride_id UUID REFERENCES scheduled_rides(id);

ALTER TABLE driver_profiles
  ADD COLUMN IF NOT EXISTS accessibility_features JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS languages_spoken VARCHAR(10)[] DEFAULT ARRAY['en'];

-- accessibility_features for drivers: { wheelchair_ramp: bool, wheelchair_lift: bool, extra_space: bool, visual_aid_trained: bool }

-- ---------------------------------------------------------------------------
-- 5. In-app Chat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text'
    CHECK (message_type IN ('text', 'image', 'location', 'system')),
  metadata JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_ride ON chat_messages(ride_id, created_at);
CREATE INDEX idx_chat_messages_unread ON chat_messages(ride_id, sender_id) WHERE read = FALSE;

-- ---------------------------------------------------------------------------
-- 6. Ride Sharing / Carpooling
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shared_rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'open'
    CHECK (status IN ('open', 'full', 'in_progress', 'completed', 'cancelled')),
  route_geometry JSONB, -- encoded polyline or GeoJSON
  route_origin GEOGRAPHY(POINT, 4326),
  route_destination GEOGRAPHY(POINT, 4326),
  max_passengers INT DEFAULT 3,
  current_passengers INT DEFAULT 0,
  vehicle_type VARCHAR(20) DEFAULT 'pool',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shared_ride_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_ride_id UUID NOT NULL REFERENCES shared_rides(id) ON DELETE CASCADE,
  ride_id UUID NOT NULL REFERENCES rides(id),
  passenger_id UUID NOT NULL REFERENCES users(id),
  pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
  dropoff_location GEOGRAPHY(POINT, 4326) NOT NULL,
  pickup_order INT,
  dropoff_order INT,
  fare_share DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'picked_up', 'dropped_off', 'cancelled')),
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shared_rides_status ON shared_rides(status);
CREATE INDEX idx_shared_ride_participants_ride ON shared_ride_participants(shared_ride_id);
CREATE INDEX idx_shared_ride_participants_passenger ON shared_ride_participants(passenger_id);

-- ---------------------------------------------------------------------------
-- 7. Driver Referral Program
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES users(id),
  referred_id UUID NOT NULL REFERENCES users(id),
  referral_code VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'qualified', 'rewarded', 'expired')),
  rides_completed INT DEFAULT 0,
  rides_needed INT DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  UNIQUE(referrer_id, referred_id)
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  user_id UUID NOT NULL REFERENCES users(id),
  reward_type VARCHAR(30) NOT NULL CHECK (reward_type IN ('ride_credit', 'cash_bonus', 'fee_waiver')),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'credited', 'used', 'expired')),
  stripe_transfer_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  credited_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_code ON referrals(referral_code);
CREATE INDEX idx_referral_rewards_user ON referral_rewards(user_id);

-- ---------------------------------------------------------------------------
-- 8. Offline Sync Queue (for driver app)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'synced', 'failed')),
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_offline_sync_user ON offline_sync_queue(user_id) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 9. User ride credits (for referral rewards and promotions)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ride_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  remaining DECIMAL(10,2) NOT NULL,
  source VARCHAR(30) NOT NULL CHECK (source IN ('referral', 'promotion', 'refund', 'surplus')),
  source_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ride_credits_user ON ride_credits(user_id) WHERE remaining > 0;

-- ---------------------------------------------------------------------------
-- Update triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER update_notification_preferences_updated_at
    BEFORE UPDATE ON notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_scheduled_rides_updated_at
    BEFORE UPDATE ON scheduled_rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_vehicle_type_configs_updated_at
    BEFORE UPDATE ON vehicle_type_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER update_shared_rides_updated_at
    BEFORE UPDATE ON shared_rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add phase 3 platform config keys
INSERT INTO platform_config (key, value, data_type, category, description, governable) VALUES
  ('scheduled_ride_advance_hours', '168', 'number', 'operations', 'Max hours in advance a ride can be scheduled', TRUE),
  ('scheduled_ride_reminder_minutes', '30', 'number', 'operations', 'Minutes before pickup to send reminder', TRUE),
  ('pool_ride_discount_percent', '30', 'number', 'pricing', 'Discount percentage for pool/shared rides', TRUE),
  ('pool_ride_max_detour_percent', '25', 'number', 'operations', 'Max detour percentage for shared ride pickups', TRUE),
  ('referral_rides_needed', '5', 'number', 'operations', 'Rides needed to qualify referral reward', TRUE),
  ('referral_reward_amount', '10.00', 'number', 'pricing', 'Referral reward amount in USD', TRUE),
  ('referral_reward_type', 'ride_credit', 'string', 'operations', 'Type of referral reward: ride_credit, cash_bonus', TRUE),
  ('chat_enabled', 'true', 'boolean', 'operations', 'Enable in-app chat between driver and passenger', TRUE),
  ('max_scheduled_rides_per_user', '10', 'number', 'operations', 'Max active scheduled rides per user', TRUE)
ON CONFLICT (key) DO NOTHING;
