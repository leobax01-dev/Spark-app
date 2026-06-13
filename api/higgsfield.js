// api/higgsfield.js — platform.higgsfield.ai proxy (correct per docs)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });

  try {
    const { imageBase64, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });

    // Per docs: Authorization: Key {key_id}:{key_secret}
    const authHeader = `Key ${apiKey}`;

    // Per docs: correct model ID is higgsfield-ai/dop/standard
    const modelId = 'higgsfield-ai/dop/standard';
    const endpoint = `https://platform.higgsfield.ai/${modelId}`;

    const body = {
      prompt,
      duration: 5,
    };

    // If we have an image, we need to upload it first to get a URL
    if (imageBase64) {
      // Step 1: Upload image to get a URL
      const uploadEndpoint = 'https://platform.higgsfield.ai/upload';
      
      // Convert base64 to binary for upload
      const binaryStr = atob(imageBase64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      
      const formData = new FormData();
      formData.append('file', blob, 'listing.jpg');

      console.log('Uploading image to Higgsfield...');
      const uploadRes = await fetch(uploadEndpoint, {
        method: 'POST',
        headers: { 'Authorization': authHeader },
        body: formData,
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        const imageUrl = uploadData?.url || uploadData?.file_url || uploadData?.image_url;
        console.log('Image uploaded, URL:', imageUrl);
        if (imageUrl) body.image_url = imageUrl;
      } else {
        const uploadErr = await uploadRes.text();
        console.warn('Image upload failed:', uploadRes.status, uploadErr.slice(0, 200));
        // Continue without image — text-to-video fallback
      }
    }

    console.log('Submitting to:', endpoint);
    console.log('Body keys:', Object.keys(body));
    console.log('Prompt:', prompt.slice(0, 80));

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
    console.log('Higgsfield status:', response.status);
    console.log('Higgsfield response:', responseText.slice(0, 400));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

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
