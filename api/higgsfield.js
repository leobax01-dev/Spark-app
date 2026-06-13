// api/higgsfield.js — Higgsfield image-to-video proxy

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) {
    console.error('HIGGSFIELD_API_KEY not set');
    return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });
  }

  try {
    const { imageBase64, prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const body = {
      model: 'dop-turbo',
      prompt: prompt,
      aspect_ratio: '9:16',
      duration: 5,
    };

    if (imageBase64) {
      body.input_images = [{
        type: 'base64',
        data: imageBase64,
        media_type: 'image/jpeg',
      }];
    }

    // Higgsfield v2 uses "Key YOUR_KEY" not "Bearer YOUR_KEY"
    const authHeader = apiKey.startsWith('hf-')
      ? `Bearer ${apiKey}`
      : `Key ${apiKey}`;

    console.log('Higgsfield request — auth type:', apiKey.startsWith('hf-') ? 'Bearer' : 'Key');
    console.log('Prompt preview:', prompt.slice(0, 80));
    console.log('Has image:', !!imageBase64);

    const response = await fetch('https://api.higgsfield.ai/v1/image2video/dop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('Higgsfield status:', response.status);
    console.log('Higgsfield response:', responseText.slice(0, 300));

    let data;
    try { data = JSON.parse(responseText); }
    catch { data = { raw: responseText }; }

    if (!response.ok) {
      console.error('Higgsfield API error:', response.status, responseText.slice(0, 300));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Higgsfield proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
