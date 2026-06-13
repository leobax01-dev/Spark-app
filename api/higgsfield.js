// api/higgsfield.js — using dop/preview for actual video animation

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

    const body = { prompt, duration: 5 };

    // Use dop/preview for image animation, soul/standard for text-to-video
    const modelId = imageBase64
      ? 'higgsfield-ai/dop/preview'
      : 'higgsfield-ai/soul/standard';

    if (imageBase64) {
      body.start_image_url = `data:image/jpeg;base64,${imageBase64}`;
    }

    const endpoint = `https://platform.higgsfield.ai/${modelId}`;
    console.log('POST to:', endpoint, '| has image:', !!imageBase64);

    const response = await fetch(endpoint, {
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
