require('dotenv').config();

const AI_MODELS = {
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    modelName: 'glm-4',
    apiKey: process.env.GLM_API_KEY
  }
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { modelId, prompt } = req.body;
  const model = AI_MODELS[modelId];

  if (!model || !model.apiKey) {
    return res.status(400).json({ error: '该模型未配置或缺少 API Key' });
  }

  try {
    const response = await fetch(model.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`
      },
      body: JSON.stringify({
        model: model.modelName,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '大模型 API 请求失败');
    }

    const replyText = data.choices[0].message.content;
    res.json({ text: replyText });

  } catch (error) {
    console.error('❌ 后端代理报错:', error);
    res.status(500).json({ error: error.message });
  }
};