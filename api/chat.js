export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: { message: 'GROQ_API_KEY environment variable is not configured.' } 
      });
    }

    const payload = req.body || {};

    // List of decommissioned or unsupported Groq models to automatically upgrade
    const DECOMMISSIONED_MODELS = [
      'gemma2-9b-it',
      'gemma-7b-it',
      'llama2-70b-4096',
      'llama3-8b-8192',
      'llama3-70b-8192',
      'mixtral-8x7b-32768'
    ];

    const defaultModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    if (!payload.model || DECOMMISSIONED_MODELS.includes(String(payload.model).toLowerCase())) {
      payload.model = defaultModel;
    }

    let response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    let data = await response.json();

    // If Groq returns a decommissioned model error, retry once with the fallback model
    if (data.error && data.error.message && data.error.message.includes('decommissioned')) {
      payload.model = defaultModel;
      response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      data = await response.json();
    }

    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}

