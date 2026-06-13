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

    // Add image if provided
    if (imageBase64) {
      body.input_images = [{
        type: 'base64',
        data: imageBase64,
        media_type: 'image/jpeg',
      }];
    }

    console.log('Sending to Higgsfield:', JSON.stringify({ prompt: prompt.slice(0, 80), hasImage: !!imageBase64 }));

    const response = await fetch('https://api.higgsfield.ai/v1/image2video/dop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('Higgsfield response:', response.status, JSON.stringify(data).slice(0, 200));

    if (!response.ok) {
      console.error('Higgsfield API error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Higgsfield proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
