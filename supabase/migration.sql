-- Deutsch Master Supabase Database Migration
-- Version: 1
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url TEXT,
    provider TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. USER PROGRESS TABLE (Main learning state)
-- ============================================================
CREATE TABLE user_progress (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}',
    version BIGINT NOT NULL DEFAULT 1,
    device_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one progress record per user
CREATE UNIQUE INDEX idx_user_progress_user_id ON user_progress(user_id);

-- ============================================================
-- 3. SYNC QUEUE TABLE (Offline-first sync operations)
-- ============================================================
CREATE TABLE sync_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL, -- 'upsert_progress', 'delete_progress', etc.
    payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_sync_queue_user_status ON sync_queue(user_id, status);
CREATE INDEX idx_sync_queue_created ON sync_queue(created_at);

-- ============================================================
-- 4. DEVICES TABLE (Track user devices for sync diagnostics)
-- ============================================================
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    device_name TEXT,
    platform TEXT, -- 'web', 'android', 'ios', 'pwa', 'electron'
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_devices_user_device ON devices(user_id, device_id);

-- ============================================================
-- 5. AUTH EVENTS TABLE (Audit log for security)
-- ============================================================
CREATE TABLE auth_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL, -- 'sign_in', 'sign_up', 'sign_out', 'password_reset', 'mfa_challenge'
    provider TEXT, -- 'google', 'facebook', 'email', 'phone', 'apple'
    ip_address INET,
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_events_user ON auth_events(user_id);
CREATE INDEX idx_auth_events_created ON auth_events(created_at);

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all user-owned tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_events ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only access their own profile
CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles_delete_own" ON profiles
    FOR DELETE USING (auth.uid() = id);

-- User Progress: users can only access their own progress
CREATE POLICY "user_progress_select_own" ON user_progress
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user_progress_insert_own" ON user_progress
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "user_progress_update_own" ON user_progress
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "user_progress_delete_own" ON user_progress
    FOR DELETE USING (auth.uid() = user_id);

-- Sync Queue: users can only access their own queue
CREATE POLICY "sync_queue_select_own" ON sync_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sync_queue_insert_own" ON sync_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sync_queue_update_own" ON sync_queue
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "sync_queue_delete_own" ON sync_queue
    FOR DELETE USING (auth.uid() = user_id);

-- Devices: users can only access their own devices
CREATE POLICY "devices_select_own" ON devices
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "devices_insert_own" ON devices
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "devices_update_own" ON devices
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "devices_delete_own" ON devices
    FOR DELETE USING (auth.uid() = user_id);

-- Auth Events: users can only see their own events (optional - admin can see all via service role)
CREATE POLICY "auth_events_select_own" ON auth_events
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================================
-- 7. TRIGGERS & FUNCTIONS
-- ============================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url, provider)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        NEW.raw_user_meta_data->>'avatar_url',
        COALESCE(NEW.raw_app_meta_data->>'provider', 'email')
    );
    RETURN NEW;
EXCEPTION WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_progress_updated_at
    BEFORE UPDATE ON user_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 8. HELPER FUNCTIONS
-- ============================================================

-- Get or create user progress (upsert helper)
CREATE OR REPLACE FUNCTION public.get_or_create_user_progress(p_user_id UUID, p_initial_state JSONB DEFAULT '{}')
RETURNS TABLE (id BIGINT, user_id UUID, state JSONB, version BIGINT, updated_at TIMESTAMPTZ) AS $$
BEGIN
    INSERT INTO public.user_progress (user_id, state, version)
    VALUES (p_user_id, p_initial_state, 1)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN QUERY
    SELECT up.id, up.user_id, up.state, up.version, up.updated_at
    FROM public.user_progress up
    WHERE up.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic progress update with version checking (optimistic locking)
CREATE OR REPLACE FUNCTION public.update_user_progress(
    p_user_id UUID,
    p_state JSONB,
    p_expected_version BIGINT,
    p_device_id TEXT
)
RETURNS TABLE (success BOOLEAN, new_version BIGINT, current_state JSONB, current_version BIGINT) AS $$
DECLARE
    v_current_version BIGINT;
    v_current_state JSONB;
BEGIN
    -- Get current version and state
    SELECT version, state INTO v_current_version, v_current_state
    FROM public.user_progress
    WHERE user_id = p_user_id;

    IF NOT FOUND THEN
        -- No progress yet, create it
        INSERT INTO public.user_progress (user_id, state, version, device_id)
        VALUES (p_user_id, p_state, 1, p_device_id)
        RETURNING version, state INTO v_current_version, v_current_state;
        RETURN QUERY SELECT TRUE, v_current_version, v_current_state, v_current_version;
    END IF;

    -- Check version for optimistic locking
    IF p_expected_version IS NOT NULL AND v_current_version != p_expected_version THEN
        RETURN QUERY SELECT FALSE, v_current_version, v_current_state, v_current_version;
    END IF;

    -- Update with incremented version
    UPDATE public.user_progress
    SET state = p_state,
        version = v_current_version + 1,
        device_id = p_device_id,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING version, state INTO v_current_version, v_current_state;

    RETURN QUERY SELECT TRUE, v_current_version, v_current_state, v_current_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_user_progress_updated ON user_progress(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(user_id);

-- ============================================================
-- 10. GRANT PERMISSIONS (for anon role via RLS)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_progress TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON sync_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON devices TO anon;
GRANT SELECT ON auth_events TO anon;

GRANT USAGE ON SEQUENCE user_progress_id_seq TO anon;
GRANT USAGE ON SEQUENCE sync_queue_id_seq TO anon;
GRANT USAGE ON SEQUENCE auth_events_id_seq TO anon;