-- 在 Supabase SQL Editor 中执行此脚本，创建对话记录表
-- 路径：Supabase 控制台 → SQL Editor → New query → 粘贴并 Run

-- 若使用默认 public schema（推荐）：
CREATE TABLE IF NOT EXISTS public.conversations (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  student_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  user_input TEXT NOT NULL,
  bot_reply TEXT NOT NULL,
  accuracy NUMERIC(5,2) NULL
);

-- 可选：为按学生、按智能体查询建索引
CREATE INDEX IF NOT EXISTS idx_conversations_student_id ON public.conversations (student_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id ON public.conversations (agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations (created_at DESC);

-- 方案A（跳转扣子官网后再同步）需要游标表：记录每个 bot 同步到哪条消息
CREATE TABLE IF NOT EXISTS public.coze_sync_state (
  bot_id TEXT PRIMARY KEY,
  last_message_created_at BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 允许 service_role 写入（Netlify Function 使用 SERVICE_ROLE_KEY，默认可写）
-- 若启用 RLS，需为 service_role 放行，例如：
-- ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role can do all" ON public.conversations FOR ALL TO service_role USING (true) WITH CHECK (true);
