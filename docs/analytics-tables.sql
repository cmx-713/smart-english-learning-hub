-- 在 Supabase SQL Editor 中执行此脚本，将统计表创建在 english_hub schema 下
-- 路径：Supabase 控制台 → SQL Editor → New query → 粘贴并 Run

-- ─────────────────────────────────────────────────────────
-- 前置：确认 english_hub schema 已存在
-- ─────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS english_hub;

-- ─────────────────────────────────────────────────────────
-- 1. user_profiles：注册用户档案（含学校/学院/身份信息）
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS english_hub.user_profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name            TEXT,
  student_id           TEXT,
  school_name          TEXT,        -- 学校名称（校外用户必填）
  college_name         TEXT,        -- 学院名称（选填）
  user_role            TEXT DEFAULT 'student',  -- 'student' | 'teacher'
  real_contact_email   TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- 行级安全：本人可读/写自己的 profile；service_role 完全访问
ALTER TABLE english_hub.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own profile"
  ON english_hub.user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "users insert own profile"
  ON english_hub.user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users update own profile"
  ON english_hub.user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "service role full access on user_profiles"
  ON english_hub.user_profiles FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- 2. page_views：页面访问统计
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS english_hub.page_views (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  viewed_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE english_hub.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users insert page_views"
  ON english_hub.page_views FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service role full access on page_views"
  ON english_hub.page_views FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- 3. agent_calls：智能体调用统计
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS english_hub.agent_calls (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  agent_id     TEXT NOT NULL,
  agent_title  TEXT,
  called_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_calls_agent_id ON english_hub.agent_calls (agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_calls_called_at ON english_hub.agent_calls (called_at DESC);

ALTER TABLE english_hub.agent_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users insert agent_calls"
  ON english_hub.agent_calls FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "service role full access on agent_calls"
  ON english_hub.agent_calls FOR ALL
  TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────────────────────────────────────
-- 4. 暴露 english_hub schema 给 Supabase API（必须执行）
-- ─────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA english_hub TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA english_hub TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA english_hub TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA english_hub
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA english_hub
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;

-- ─────────────────────────────────────────────────────────
-- 5. 数据迁移：将已有注册用户回填到 user_profiles
--    （school_name / college_name 为空，不影响已有账号使用）
-- ─────────────────────────────────────────────────────────
INSERT INTO english_hub.user_profiles (id, full_name, student_id, real_contact_email, created_at)
SELECT
  id,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'student_id',
  raw_user_meta_data->>'real_contact_email',
  created_at
FROM auth.users
ON CONFLICT (id) DO NOTHING;
