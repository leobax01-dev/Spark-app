// api/higgsfield.js — restored to version that achieved 21% render

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });

  try {
    const { imageBase64, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    const authHeader = `Key ${apiKey}`;

    const body = {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
    };

    if (imageBase64) {
      body.start_image_url = `data:image/jpeg;base64,${imageBase64}`;
    }

    console.log('POST to: https://platform.higgsfield.ai/higgsfield-ai/soul/standard');
    console.log('Has image:', !!imageBase64, 'prompt:', prompt.slice(0, 80));

    const response = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', responseText.slice(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!response.ok) {
      console.error('Error:', response.status, responseText.slice(0, 400));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
