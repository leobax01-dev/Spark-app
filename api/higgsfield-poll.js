// api/higgsfield-poll.js — polls platform.higgsfield.ai job status

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.HIGGSFIELD_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'HIGGSFIELD_API_KEY not configured' });

  const { jobId, statusUrl } = req.query;

  // Use the status_url directly from the job response if available
  // Otherwise construct it from the jobId
  let pollEndpoint;
  if (statusUrl) {
    pollEndpoint = decodeURIComponent(statusUrl);
  } else if (jobId) {
    pollEndpoint = `https://platform.higgsfield.ai/requests/${jobId}/status`;
  } else {
    return res.status(400).json({ error: 'jobId or statusUrl required' });
  }

  try {
    const response = await fetch(pollEndpoint, {
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    // 304 = Not Modified = still processing
    if (response.status === 304) {
      return res.status(200).json({ status: 'processing' });
    }

    const responseText = await response.text();
    console.log('Poll status:', response.status, responseText.slice(0, 300));

    let data;
    try { data = JSON.parse(responseText); }
    catch { data = { raw: responseText, status: 'processing' }; }

    return res.status(200).json(data);
  } catch (error) {
    console.error('Poll error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
