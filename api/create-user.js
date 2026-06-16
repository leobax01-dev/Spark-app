// api/create-user.js — server-side user row creation, bypasses RLS via service role
// Called immediately after sb.auth.signUp() succeeds

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

  const { email, plan, credits, intendedPlan } = req.body;
  if (!email || !plan || typeof credits !== 'number') {
    return res.status(400).json({ error: 'email, plan, and numeric credits required' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const normalizedEmail = email.toLowerCase();

  try {
    // Check if row already exists (e.g. retry, or self-heal for pre-fix accounts)
    const { data: existing } = await supabase
      .from('users')
      .select('plan,credits,intended_plan')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      // Row already exists — return current values, don't overwrite
      console.log(`User row already exists: ${normalizedEmail}`);
      return res.status(200).json({
        plan: existing.plan,
        credits: existing.credits,
        intendedPlan: existing.intended_plan,
        existed: true,
      });
    }

    const { error: insertError } = await supabase
      .from('users')
      .insert({
        email: normalizedEmail,
        plan,
        credits,
        intended_plan: intendedPlan || 'pro',
      });

    if (insertError) {
      // Handle race condition: row created between check and insert
      if (insertError.message?.toLowerCase().includes('duplicate')) {
        const { data: retryData } = await supabase
          .from('users')
          .select('plan,credits,intended_plan')
          .eq('email', normalizedEmail)
          .single();
        if (retryData) {
          return res.status(200).json({
            plan: retryData.plan,
            credits: retryData.credits,
            intendedPlan: retryData.intended_plan,
            existed: true,
          });
        }
      }
      console.error('User insert error:', insertError.message);
      return res.status(500).json({ error: 'Failed to create user record' });
    }

    console.log(`User created: ${normalizedEmail} -> ${plan} (${credits} credits, intended: ${intendedPlan || 'pro'})`);
    return res.status(200).json({ plan, credits, intendedPlan: intendedPlan || 'pro', existed: false });

  } catch (error) {
    console.error('Create user error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
