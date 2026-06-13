// api/higgsfield.js — upload image to Supabase Storage, then animate with /v1/image2video/dop

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'listing-photos';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY; // must be "KEY_ID:KEY_SECRET"
  if (!apiKey) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const { imageBase64, prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt required' });

  const authHeader = `Key ${apiKey}`;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Step 1: Upload image to Supabase Storage to get a public hosted URL
  let imageUrl = null;
  if (imageBase64) {
    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const fileName = `listing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, imageBuffer, {
          contentType: 'image/jpeg',
          upsert: false,
        });

      if (uploadError) {
        console.warn('Supabase upload error:', uploadError.message);
      } else {
        const { data: publicData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(fileName);
        imageUrl = publicData?.publicUrl || null;
        console.log('Image hosted at:', imageUrl);
      }
    } catch (e) {
      console.warn('Upload error:', e.message);
    }
  }

  // Step 2: Submit to Higgsfield
  // image2video/dop requires input_images; without an image, fall back to text2image/soul
  let endpoint;
  let genBody;

  if (imageUrl) {
    endpoint = 'https://platform.higgsfield.ai/v1/image2video/dop';
    genBody = {
      model: 'dop-turbo',
      prompt,
      input_images: [{ type: 'image_url', image_url: imageUrl }],
    };
  } else {
    endpoint = 'https://platform.higgsfield.ai/v1/text2image/soul';
    genBody = {
      prompt,
      width_and_height: '1536x1536',
      quality: 'hd',
      batch_size: 1,
    };
  }

  console.log('Endpoint:', endpoint, '| image_url:', imageUrl || 'none');
  console.log('Prompt:', prompt.slice(0, 80));

  try {
    const response = await fetch(endpoint, {
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
