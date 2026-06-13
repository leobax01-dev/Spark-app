// api/higgsfield.js — upload image then animate with dop/preview

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
    let hostedImageUrl = null;

    // Step 1: Upload image to get a hosted URL
    if (imageBase64) {
      try {
        const imageBuffer = Buffer.from(imageBase64, 'base64');
        const boundary = 'HFBoundary' + Date.now();
        const nl = '\r\n';
        const part = [
          `--${boundary}`,
          'Content-Disposition: form-data; name="file"; filename="listing.jpg"',
          'Content-Type: image/jpeg',
          '',
          '',
        ].join(nl);

        const partBuf = Buffer.from(part, 'utf8');
        const endBuf = Buffer.from(`${nl}--${boundary}--${nl}`, 'utf8');
        const body = Buffer.concat([partBuf, imageBuffer, endBuf]);

        const uploadRes = await fetch('https://platform.higgsfield.ai/upload', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
          },
          body,
        });

        const uploadText = await uploadRes.text();
        console.log('Upload status:', uploadRes.status, uploadText.slice(0, 200));

        if (uploadRes.ok) {
          const uploadData = JSON.parse(uploadText);
          hostedImageUrl = uploadData?.url || uploadData?.file_url || uploadData?.data?.url;
          console.log('Hosted image URL:', hostedImageUrl);
        }
      } catch (e) {
        console.warn('Upload failed:', e.message);
      }
    }

    // Step 2: Generate video
    // Use dop/preview if we have a hosted image URL, otherwise soul/standard
    const modelId = hostedImageUrl
      ? 'higgsfield-ai/dop/preview'
      : 'higgsfield-ai/soul/standard';

    const genBody = {
      prompt,
      aspect_ratio: '9:16',
      resolution: '720p',
    };

    if (hostedImageUrl) {
      genBody.start_image_url = hostedImageUrl;
    } else if (imageBase64) {
      // Last resort — try base64 data URL (worked partially before)
      genBody.start_image_url = `data:image/jpeg;base64,${imageBase64}`;
    }

    console.log('Generating with model:', modelId, '| has hosted URL:', !!hostedImageUrl);

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
    console.log('Generation status:', response.status, responseText.slice(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!response.ok) {
      // If dop/preview failed, fall back to soul/standard
      if (hostedImageUrl && response.status === 422) {
        console.log('dop/preview rejected, falling back to soul/standard');
        const fallbackBody = { prompt, aspect_ratio: '9:16', resolution: '720p', start_image_url: hostedImageUrl };
        const r2 = await fetch('https://platform.higgsfield.ai/higgsfield-ai/soul/standard', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': authHeader },
          body: JSON.stringify(fallbackBody),
        });
        const t2 = await r2.text();
        console.log('Fallback status:', r2.status, t2.slice(0, 300));
        let d2; try { d2 = JSON.parse(t2); } catch { d2 = { raw: t2 }; }
        return res.status(r2.ok ? 200 : r2.status).json(d2);
      }
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
