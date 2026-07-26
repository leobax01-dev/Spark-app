// api/create-billing-portal.js
// "Manage Billing" in Settings used to link to a generic, non-account-
// specific Stripe URL — it didn't actually show the agent their own
// subscription, payment method, or invoices, just Stripe's own site.
// This creates a real, secure, one-time-use Stripe Billing Portal
// session tied to the agent's own stripe_customer_id, so "Manage
// Billing" actually takes them to their own account.
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body || {}
  if (!email) {
    return res.status(400).json({ error: 'Email required' })
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !user?.stripe_customer_id) {
      // Trial-tier agents (or anyone who's never actually gone through
      // Stripe checkout) genuinely don't have a customer record yet —
      // that's a real, expected state, not a broken one.
      return res.status(404).json({
        error: 'No billing account found yet — this appears once you upgrade to a paid plan.',
      })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: 'https://usesparkai.app/?tab=settings',
    })

    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('Billing portal session failed:', e.message)
    return res.status(500).json({ error: 'Could not open billing portal — please try again in a moment.' })
  }
}
