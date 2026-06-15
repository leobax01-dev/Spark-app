// api/deduct-credits.js — server-side credit deduction, bypasses RLS via service role

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const { email, cost } = req.body;
  if (!email || typeof cost !== 'number' || cost <= 0) {
    return res.status(400).json({ error: 'email and positive numeric cost required' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const normalizedEmail = email.toLowerCase();

  try {
    // Fetch current credits
    const { data: userRow, error: fetchError } = await supabase
      .from('users')
      .select('credits')
      .eq('email', normalizedEmail)
      .single();

    if (fetchError || !userRow) {
      console.error('User fetch error:', fetchError?.message);
      return res.status(404).json({ error: 'User not found' });
    }

    const currentCredits = userRow.credits ?? 0;

    if (currentCredits < cost) {
      return res.status(402).json({ error: 'Insufficient credits', credits: currentCredits });
    }

    const newCredits = currentCredits - cost;

    const { error: updateError } = await supabase
      .from('users')
      .update({ credits: newCredits, updated_at: new Date().toISOString() })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('Credit update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to update credits' });
    }

    console.log(`Credits deducted: ${normalizedEmail} ${currentCredits} -> ${newCredits} (cost ${cost})`);
    return res.status(200).json({ credits: newCredits });

  } catch (error) {
    console.error('Deduct credits error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}