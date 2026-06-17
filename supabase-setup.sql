-- Users are handled by Supabase Auth (no extra users table needed)

-- 日记条目表
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  raw_text TEXT NOT NULL,
  ai_analysis JSONB,
  capability_tags TEXT[],
  is_starred BOOLEAN DEFAULT FALSE,
  pinned_moments JSONB DEFAULT '[]',
  -- pinned_moments 结构:
  -- [{ "text": "string", "source": "ai" | "user", "pinned_at": "timestamp" }]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户设置表
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  anthropic_api_key TEXT,
  preferred_model TEXT DEFAULT 'claude-sonnet-4-6',
  dark_mode BOOLEAN DEFAULT FALSE,
  aggregate_cache JSONB,
  aggregate_updated_at TIMESTAMPTZ,
  pitch_cache JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX idx_journal_entries_user_date ON journal_entries(user_id, date);

-- 行级安全策略
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);
