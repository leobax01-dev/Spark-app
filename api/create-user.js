// api/create-user.js — server-side user row creation in public.users
// Fetches the auth.users id first, then inserts with correct FK

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl     = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const { email, plan, credits, intendedPlan } = req.body;
  if (!email || !plan || typeof credits !== 'number') {
    return res.status(400).json({ error: 'email, plan, and numeric credits required' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db:   { schema: 'public' },
  });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if public.users row already exists
    const { data: existing } = await supabase
      .from('users')
      .select('plan,credits,intended_plan')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      return res.status(200).json({
        plan: existing.plan,
        credits: existing.credits,
        intendedPlan: existing.intended_plan,
        existed: true,
      });
    }

    // Get the auth.users id for this email — required for FK
    const sbAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUsers, error: authError } = await sbAdmin.auth.admin.listUsers();
    const authUser = authUsers?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

    if (!authUser) {
      // Auth user doesn't exist yet — retry after short delay (race condition)
      await new Promise(r => setTimeout(r, 1500));
      const { data: retryAuth } = await sbAdmin.auth.admin.listUsers();
      const retryUser = retryAuth?.users?.find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!retryUser) {
        console.error('Auth user not found for:', normalizedEmail);
        return res.status(404).json({ error: 'Auth user not found' });
      }
      // Insert with correct auth id
      const { error: insertErr } = await supabase.from('users').insert({
        id:            retryUser.id,
        email:         normalizedEmail,
        plan,
        credits,
        intended_plan: intendedPlan || 'pro',
      });
      if (insertErr) {
        console.error('User insert error (retry):', insertErr.message);
        return res.status(500).json({ error: insertErr.message });
      }
      return res.status(200).json({ plan, credits, intendedPlan: intendedPlan || 'pro', existed: false });
    }

    // Insert with correct auth id
    const { error: insertError } = await supabase.from('users').insert({
      id:            authUser.id,
      email:         normalizedEmail,
      plan,
      credits,
      intended_plan: intendedPlan || 'pro',
    });

    if (insertError) {
      // Handle race condition duplicate
      if (insertError.message?.toLowerCase().includes('duplicate') ||
          insertError.code === '23505') {
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
      console.error('User insert error:', insertError.message, insertError.details);
      return res.status(500).json({ error: insertError.message });
    }

    console.log(`User created: ${normalizedEmail} -> ${plan} (${credits} credits)`);
    return res.status(200).json({ plan, credits, intendedPlan: intendedPlan || 'pro', existed: false });

  } catch (error) {
    console.error('Create user error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}
