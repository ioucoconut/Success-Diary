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

  const { userId, scenario, audience, goal } = req.body;

  if (!userId || !scenario || !audience || !goal) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const { data: entries, error } = await supabase
      .from('journal_entries')
      .select('capability_tags, ai_analysis')
      .eq('user_id', userId);

    if (error) throw error;
    if (!entries || entries.length === 0) {
      return res.status(400).json({ error: '请先记录至少一条日记' });
    }

    const allTags = entries.flatMap(e => e.capability_tags || []);
    const allStrengths = entries.flatMap(e => e.ai_analysis?.strengths_found || []);
    const allValues = entries.map(e => e.ai_analysis?.value_to_others).filter(Boolean);

    const tagCount = {};
    allTags.forEach(tag => tagCount[tag] = (tagCount[tag] || 0) + 1);
    
    const strengthCount = {};
    allStrengths.forEach(s => strengthCount[s] = (strengthCount[s] || 0) + 1);

    const topStrengths = Object.entries(strengthCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    const prompt = `
生成个性化的价值主张。只返回有效的JSON，不要markdown，不要解释。

{
  "core_pitch": "string",
  "what_i_offer": ["string"],
  "conversation_hooks": ["string"],
  "watch_out_for": "string"
}

第一人称，自信，具体。用中文回复。

优势：${JSON.stringify(topStrengths)}。场景：${scenario}。目标人物：${audience}。目标：${goal}。能力标签：${Object.keys(tagCount).join(', ')}
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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Claude API 请求失败');
    }

    const result = JSON.parse(data.content[0].text);

    const { data: settings } = await supabase
      .from('user_settings')
      .select('pitch_cache')
      .eq('user_id', userId)
      .single();

    const pitchCache = settings?.pitch_cache || {};
    pitchCache[scenario] = {
      ...result,
      audience,
      goal,
      generated_at: new Date().toISOString()
    };

    await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        pitch_cache: pitchCache
      });

    res.json(result);

  } catch (error) {
    console.error('❌ 生成价值主张失败:', error);
    res.status(500).json({ error: error.message });
  }
};
