export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { endpoint, ...body } = req.body;

  const allowed = [
    'https://cloud.higgsfield.ai/api/v1/generate',
    'https://cloud.higgsfield.ai/api/v1/image-to-video',
  ];

  if (!allowed.includes(endpoint)) {
    return res.status(400).json({ error: 'Endpoint not allowed' });
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
