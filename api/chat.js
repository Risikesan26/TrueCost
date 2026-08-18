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

    // List of candidate models to fallback to in order if requested model does not exist or lacks access
    const FALLBACK_MODELS = [
      'llama-3.3-70b-versatile',
      'llama-3.1-70b-versatile',
      'llama-3.1-8b-instant',
      'llama-3.3-70b-specdec',
      'llama3-70b-8192',
      'llama3-8b-8192',
      'gemma2-9b-it'
    ];

    const requestedModel = payload.model || process.env.GROQ_MODEL;
    const modelsToTry = [requestedModel, ...FALLBACK_MODELS].filter(Boolean);
    const uniqueModels = [...new Set(modelsToTry)];

    let lastData = null;
    let lastStatus = 500;

    for (const model of uniqueModels) {
      const currentPayload = { ...payload, model };
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(currentPayload)
      });

      const data = await response.json();

      if (response.ok && !data.error) {
        return res.status(200).json(data);
      }

      lastData = data;
      lastStatus = response.status;

      const errMsg = (data.error?.message || '').toLowerCase();
      const isModelError = errMsg.includes('model') || 
                           errMsg.includes('decommissioned') || 
                           errMsg.includes('exist') || 
                           errMsg.includes('access') ||
                           data.error?.code === 'model_not_found';

      if (!isModelError) {
        // Stop retrying if the error is non-model related (e.g. invalid API key)
        break;
      }
    }

    return res.status(lastStatus).json(lastData || { error: { message: 'Failed to communicate with AI model.' } });

  } catch (err) {
    return res.status(500).json({ error: { message: err.message } });
  }
}


