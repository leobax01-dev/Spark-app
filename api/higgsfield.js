// api/higgsfield.js
// Higgsfield v2 image-to-video proxy

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

    if (!imageBase64 || !prompt) {
      return res.status(400).json({ error: 'imageBase64 and prompt are required' });
    }

    // Upload the image first to get a URL
    const uploadRes = await fetch('https://api.higgsfield.ai/v1/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: `data:image/jpeg;base64,${imageBase64}`,
      }),
    });

    let imageUrl = null;

    if (uploadRes.ok) {
      const uploadData = await uploadRes.json();
      imageUrl = uploadData.url || uploadData.image_url || null;
    }

    // Submit image-to-video job
    const body = {
      model: 'dop-turbo',
      prompt: prompt,
      aspect_ratio: '9:16',
      duration: 5,
    };

    // Use URL if upload worked, otherwise send base64 directly
    if (imageUrl) {
      body.input_images = [{ type: 'image_url', image_url: imageUrl }];
    } else {
      body.input_images = [{ type: 'base64', data: imageBase64 }];
    }

    const response = await fetch('https://api.higgsfield.ai/v1/image2video/dop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Higgsfield error:', response.status, JSON.stringify(data));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Higgsfield proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
