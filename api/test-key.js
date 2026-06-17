module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiKey } = req.body;

  if (!apiKey) {
    return res.status(400).json({ success: false, message: '请提供 API Key' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      })
    });

    if (response.ok) {
      res.json({ success: true, message: 'API Key 有效' });
    } else {
      const data = await response.json();
      res.json({ success: false, message: data.error?.message || 'API Key 无效' });
    }
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};
