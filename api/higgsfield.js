// api/higgsfield.js — upload image then animate with dop/standard

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });

  const { imageBase64, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const authHeader = `Key ${apiKey}`;

  // Step 1: Upload image to get a hosted URL
  // Higgsfield requires a real URL in image_url — base64 causes 422
  let imageUrl = null;
  if (imageBase64) {
    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const boundary = `----FormBoundary${Date.now()}`;
      const CRLF = '\r\n';

      const header = Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="file"; filename="listing.jpg"${CRLF}` +
        `Content-Type: image/jpeg${CRLF}${CRLF}`,
        'utf8'
      );
      const footer = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
      const formData = Buffer.concat([header, imageBuffer, footer]);

      console.log('Uploading image, bytes:', imageBuffer.length);

      const uploadRes = await fetch('https://platform.higgsfield.ai/upload', {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      });

      const uploadText = await uploadRes.text();
      console.log('Upload status:', uploadRes.status, uploadText.slice(0, 300));

      if (uploadRes.ok) {
        const uploadJson = JSON.parse(uploadText);
        imageUrl = uploadJson?.url || uploadJson?.file_url || uploadJson?.data?.url;
        console.log('Image hosted at:', imageUrl);
      } else {
        console.warn('Upload failed:', uploadRes.status, uploadText.slice(0, 200));
      }
    } catch (e) {
      console.warn('Upload error:', e.message);
    }
  }

  // Step 2: Submit to dop/standard (the correct image-to-video model per docs)
  const genBody = { prompt, duration: 5 };
  if (imageUrl) {
    genBody.image_url = imageUrl; // real hosted URL per docs
  }

  // Only call dop/standard if we have an image URL — it's the i2v model
  // Without image, use soul/standard for text-to-video
  const modelId = imageUrl
    ? 'higgsfield-ai/dop/standard'
    : 'higgsfield-ai/soul/standard';

  console.log('Model:', modelId, '| image_url:', imageUrl || 'none');
  console.log('Prompt:', prompt.slice(0, 80));

  try {
    const response = await fetch(`https://platform.higgsfield.ai/${modelId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify(genBody),
    });

    const responseText = await response.text();
    console.log('Generation status:', response.status, responseText.slice(0, 400));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    return res.status(response.ok ? 200 : response.status).json(data);

  } catch (error) {
    console.error('Generation error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
