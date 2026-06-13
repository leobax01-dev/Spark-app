// api/higgsfield-poll.js
// Polls Higgsfield job status until complete

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

  try {
    // Try v2 status endpoint first, fall back to v1
    const response = await fetch(
      `https://api.higgsfield.ai/v1/requests/${jobId}/status`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    const data = await response.json();
    return res.status(response.ok ? 200 : response.status).json(data);
  } catch (error) {
    console.error('Higgsfield poll error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}