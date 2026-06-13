export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  try {
    // Strengthen the system prompt to enforce valid JSON output
    const systemPrompt = (req.body.system || '') +
      '\n\nCRITICAL: Your entire response must be a single valid JSON object. ' +
      'Do not include any text before or after the JSON. ' +
      'Do not use markdown code fences. ' +
      'Escape all special characters inside string values: ' +
      'use \\n for newlines, \\" for quotes, \\\\ for backslashes. ' +
      'Never include raw newlines or unescaped quotes inside JSON string values.';

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2000,
        system: systemPrompt,
        messages: req.body.messages || [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    const preview = data?.content?.[0]?.text?.slice(0, 120) || '';
    console.log('Claude response preview:', preview);

    return res.status(200).json(data);
  } catch (error) {
    console.error('Claude proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
