-- ============================================================
-- 个人价值智能系统 - Supabase 数据库配置
-- ============================================================
-- 在 Supabase SQL Editor 中依次执行以下命令

-- 1. 启用 UUID 扩展（如果尚未启用）
extension uuid-ossp;

-- 2. 日记条目表
CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TIMESTAMPTZ DEFAULT NOW(),
  raw_text TEXT,
  ai_analysis JSONB,
  capability_tags TEXT[],
  strengths_found TEXT[],
  evidence_snippet TEXT,
  energy_source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 聚合分析表
CREATE TABLE IF NOT EXISTS aggregated_analysis (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  top_strengths JSONB,
  signature_style TEXT,
  blind_spots TEXT[],
  growth_arc TEXT,
  value_pattern TEXT,
  energy_pattern TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 启用行级安全策略 (RLS)
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregated_analysis ENABLE ROW LEVEL SECURITY;

-- 5. 日记条目访问策略
CREATE POLICY "Users can only access their own entries"
  ON journal_entries FOR ALL
  USING (auth.uid() = user_id);

-- 6. 聚合分析访问策略
CREATE POLICY "Users can only access their own analysis"
  ON aggregated_analysis FOR ALL
  USING (auth.uid() = user_id);

-- 7. 创建触发器自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_aggregated_analysis_updated_at
  BEFORE UPDATE ON aggregated_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
