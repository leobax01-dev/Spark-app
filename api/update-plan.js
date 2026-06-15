// api/update-plan.js — server-side plan/credits update, bypasses RLS via service role
// Used for downgrades (no Stripe checkout event to trigger webhook)

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

  const { email, plan, credits } = req.body;
  if (!email || !plan || typeof credits !== 'number') {
    return res.status(400).json({ error: 'email, plan, and numeric credits required' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const normalizedEmail = email.toLowerCase();

  try {
    const { error: updateError } = await supabase
      .from('users')
      .update({ plan, credits, updated_at: new Date().toISOString() })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('Plan update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to update plan' });
    }

    console.log(`Plan updated: ${normalizedEmail} -> ${plan} (${credits} credits)`);
    return res.status(200).json({ plan, credits });

  } catch (error) {
    console.error('Update plan error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}