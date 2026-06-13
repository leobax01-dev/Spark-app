// api/higgsfield-poll.js — polls Higgsfield job status

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });
  }

  // Higgsfield v2 uses "Key YOUR_KEY" for UUID-style keys
  const authHeader = apiKey.startsWith('hf-')
    ? `Bearer ${apiKey}`
    : `Key ${apiKey}`;

  try {
    const response = await fetch(
      `https://api.higgsfield.ai/v1/requests/${jobId}/status`,
      {
        headers: { 'Authorization': authHeader },
      }
    );

    const responseText = await response.text();
    console.log('Poll status:', response.status, responseText.slice(0, 200));

    let data;
    try { data = JSON.parse(responseText); }
    catch { data = { raw: responseText }; }

    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Higgsfield poll error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
