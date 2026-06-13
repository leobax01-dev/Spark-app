// api/higgsfield.js — Higgsfield platform.higgsfield.ai proxy

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });
  }

  try {
    const { imageBase64, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    // Correct auth per docs: "Authorization: Key {your_api_key}"
    const authHeader = `Key ${apiKey}`;

    // Correct endpoint per docs: POST https://platform.higgsfield.ai/{model_id}
    // Model ID for DoP image-to-video
    const modelId = 'higgsfield-ai/soul/standard';

    const body = {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
    };

    // Add image if provided
    if (imageBase64) {
      body.start_image_url = `data:image/jpeg;base64,${imageBase64}`;
    }

    console.log('Higgsfield submit to platform.higgsfield.ai');
    console.log('Model:', modelId);
    console.log('Has image:', !!imageBase64);
    console.log('Prompt:', prompt.slice(0, 80));

    const response = await fetch(`https://platform.higgsfield.ai/${modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    console.log('Higgsfield status:', response.status);
    console.log('Higgsfield response:', responseText.slice(0, 400));

    let data;
    try { data = JSON.parse(responseText); }
    catch { data = { raw: responseText }; }

    if (!response.ok) {
      console.error('Higgsfield error:', response.status, responseText.slice(0, 400));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Higgsfield proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
