// api/higgsfield.js — platform.higgsfield.ai proxy with correct upload flow

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

    // Step 1: Upload image if provided
    if (imageBase64) {
      try {
        // Convert base64 to binary buffer
        const buffer = Buffer.from(imageBase64, 'base64');
        
        // Build multipart form data manually
        const boundary = '----HiggsfieldBoundary' + Date.now();
        const CRLF = '\r\n';
        
        const header = `--${boundary}${CRLF}Content-Disposition: form-data; name="file"; filename="listing.jpg"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`;
        const footer = `${CRLF}--${boundary}--${CRLF}`;
        
        const headerBuf = Buffer.from(header, 'utf8');
        const footerBuf = Buffer.from(footer, 'utf8');
        const multipart = Buffer.concat([headerBuf, buffer, footerBuf]);

        console.log('Uploading image, size:', buffer.length, 'bytes');

        const uploadRes = await fetch('https://platform.higgsfield.ai/upload', {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': multipart.length.toString(),
          },
          body: multipart,
        });

        const uploadText = await uploadRes.text();
        console.log('Upload status:', uploadRes.status, uploadText.slice(0, 200));

        if (uploadRes.ok) {
          let uploadData;
          try { uploadData = JSON.parse(uploadText); } catch {}
          const imageUrl = uploadData?.url || uploadData?.file_url || uploadData?.data?.url;
          if (imageUrl) {
            body.image_url = imageUrl;
            console.log('Image uploaded successfully:', imageUrl);
          }
        } else {
          console.warn('Upload failed, proceeding without image');
        }
      } catch (uploadErr) {
        console.warn('Upload error:', uploadErr.message, '— proceeding without image');
      }
    }

    // Step 2: Submit generation request
    const endpoint = 'https://platform.higgsfield.ai/higgsfield-ai/dop/standard';
    console.log('Submitting generation, has image_url:', !!body.image_url);

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
    console.log('Generation status:', response.status);
    console.log('Generation response:', responseText.slice(0, 500));

    let data;
    try { data = JSON.parse(responseText); } catch { data = { raw: responseText }; }

    if (!response.ok) {
      console.error('Generation error:', response.status, responseText.slice(0, 400));
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
