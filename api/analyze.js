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

  const { text, userId, entryDate, apiKeyOverride } = req.body;

  if (!text || !userId || !entryDate) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    const apiKey = apiKeyOverride || process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ error: '未配置 Anthropic API Key' });
    }

    const prompt = `
你是一位专业的职业教练和优势分析专家。用户会用中文随意描述他们的一天。从叙述中提取潜在能力。只返回有效的JSON对象，不要markdown，不要解释。

{
  "strengths_found": ["string"],
  "key_moment": "string",
  "capability_tags": ["string"],
  "value_to_others": "string"
}

要具体、有根据，引用实际细节。用中文回复。

${text}
    `.trim();

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
    
    await supabase
      .from('journal_entries')
      .upsert({
        user_id: userId,
        date: entryDate,
        raw_text: text,
        ai_analysis: result,
        capability_tags: result.capability_tags
      });

    res.json(result);

  } catch (error) {
    console.error('❌ 分析失败:', error);
    res.status(500).json({ error: error.message });
  }
};
