require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('capability_tags, ai_analysis, pinned_moments')
      .eq('user_id', userId);

    if (error) throw error;
    if (!entries || entries.length < 3) {
      return res.status(400).json({ error: '至少需要3条日记才能进行聚合分析' });
    }

    const allTags = entries.flatMap(e => e.capability_tags || []);
    const allStrengths = entries.flatMap(e => e.ai_analysis?.strengths_found || []);
    const allKeyMoments = entries.map(e => e.ai_analysis?.key_moment).filter(Boolean);
    
    const pinnedMoments = entries.flatMap(e => e.pinned_moments?.map(m => m.text) || []);

    const tagCount = {};
    allTags.forEach(tag => tagCount[tag] = (tagCount[tag] || 0) + 1);
    
    const strengthCount = {};
    allStrengths.forEach(s => strengthCount[s] = (strengthCount[s] || 0) + 1);
    
    pinnedMoments.forEach(moment => {
      const words = moment.split(/[\s，。！？、]+/);
      words.forEach(word => {
        if (word.length >= 2) {
          strengthCount[word] = (strengthCount[word] || 0) + 2;
        }
      });
    });

    const prompt = `
你正在分析一系列日记条目，以识别深层能力模式。只返回有效的JSON，不要markdown，不要解释。

{
  "top_strengths": [{ "name": "string", "evidence_count": number, "description": "string" }],
  "signature_style": "string",
  "blind_spots": ["string"],
  "growth_arc": "string"
}

用中文回复。

这是来自${entries.length}条日记条目的所有capability_tags和key_moments：

能力标签（出现次数）：${JSON.stringify(tagCount)}

优势发现（出现次数）：${JSON.stringify(strengthCount)}

关键瞬间：
${allKeyMoments.join('\n- ')}

重要时刻（权重3倍）：
${pinnedMoments.join('\n- ')}
    `.trim();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: '未配置 Anthropic API Key' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 2048,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Claude API 请求失败');
    }

    const result = JSON.parse(data.content[0].text);

    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        aggregate_cache: result,
        aggregate_updated_at: new Date().toISOString()
      });

    res.json(result);

  } catch (error) {
    console.error('❌ 聚合分析失败:', error);
    res.status(500).json({ error: error.message });
  }
};
