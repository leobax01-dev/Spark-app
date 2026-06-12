export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { jobId } = req.query;
  if (!jobId) return res.status(400).json({ error: 'jobId required' });

  try {
    const response = await fetch(
      `https://cloud.higgsfield.ai/api/v1/jobs/${jobId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.HIGGSFIELD_API_KEY}`,
        },
      }
    );
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
