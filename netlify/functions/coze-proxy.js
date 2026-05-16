// Netlify Function: 扣子 API 代理
// 用于解决前端 CORS 问题

const COZE_API_BASE = 'https://api.coze.cn/v1';

// 扣子 Token (需要在 Netlify 后台设置环境变量)
const getCozeToken = () => {
  return process.env.COZE_TOKEN || process.env.VITE_COZE_TOKEN || '';
};

export default async function handler(req, res) {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只允许 POST 请求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getCozeToken();
  if (!token) {
    return res.status(500).json({ error: '未配置扣子 Token' });
  }

  try {
    // 解析请求体
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // 调用扣子 API
    const response = await fetch(`${COZE_API_BASE}/workflow/Run`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        workflow_id: body.workflow_id,
        parameters: body.parameters || {},
        files: body.files || [],
      }),
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: '代理请求失败' });
  }
}
