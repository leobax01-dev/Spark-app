// api/webhook.js — Stripe webhook handler
// Vercel serverless function — place this at /api/webhook.js in your project

import { createClient } from '@supabase/supabase-js'

// Use service role key here (not publishable) so we can write to DB server-side
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)

// Plan lookup by Stripe Payment Link URL
// IMPORTANT: these must exactly match the Payment Link URLs used in src (PLANS[].stripeLink)
const LINK_TO_PLAN = {
  'https://buy.stripe.com/00w28qa733TZ3Z3gqa0sU00': { plan:'agent', credits:20 },
  'https://buy.stripe.com/7sYcN4gvr4Y37bfddY0sU01': { plan:'pro',   credits:60 },
  'https://buy.stripe.com/00waEWgvr0HNfHLei20sU02': { plan:'team',  credits:180 },
}

// Credit pack lookup by Stripe Payment Link URL
// IMPORTANT: these must exactly match CREDIT_PACKS[].stripeLink in src
const LINK_TO_CREDITS = {
  'https://buy.stripe.com/6oUbJ00wtbmrdzD4Hs0sU03': 10,
  'https://buy.stripe.com/7sYcN4cfb2PV9jn2zk0sU04': 30,
  'https://buy.stripe.com/bJeaEW0wt3TZeDH3Do0sU05': 80,
  'https://buy.stripe.com/14AbJ0gvr9ej537ddY0sU06': 200,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const event = req.body

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const rawEmail = session.customer_details?.email || session.customer_email
      const paymentLink = session.payment_link

      if (!rawEmail) {
        console.warn('Webhook: no email found on session', session.id)
        return res.status(200).json({ received: true, note: 'No email found' })
      }

      const email = rawEmail.toLowerCase()

      // Look up the user in Supabase by normalized email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, credits, plan')
        .eq('email', email)
        .single()

      if (userError || !userData) {
        console.error('User not found for email:', email, userError?.message)
        return res.status(200).json({ received: true, note: 'User not found' })
      }

      // Check if this is a subscription plan purchase
      const planData = LINK_TO_PLAN[paymentLink]
      if (planData) {
        const { error: updateError } = await supabase
          .from('users')
          .update({
            plan: planData.plan,
            credits: planData.credits,
            stripe_customer_id: session.customer,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userData.id)

        if (updateError) {
          console.error('Plan update failed:', email, updateError.message)
          return res.status(200).json({ received: true, note: 'Update failed' })
        }

        console.log(`Plan updated: ${email} -> ${planData.plan} (${planData.credits} credits)`)
        return res.status(200).json({ received: true })
      }

      // Check if this is a credit pack purchase
      const creditsToAdd = LINK_TO_CREDITS[paymentLink]
      if (creditsToAdd) {
        const newCredits = (userData.credits || 0) + creditsToAdd
        const { error: updateError } = await supabase
          .from('users')
          .update({
            credits: newCredits,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userData.id)

        if (updateError) {
          console.error('Credit pack update failed:', email, updateError.message)
          return res.status(200).json({ received: true, note: 'Update failed' })
        }

        console.log(`Credits added: ${email} -> +${creditsToAdd} (total: ${newCredits})`)
        return res.status(200).json({ received: true })
      }

      // Neither map matched — log so this is debuggable
      console.warn('Webhook: no plan/credit mapping for payment_link:', paymentLink)
    }

    // Handle subscription renewals — top up credits monthly
    if (event.type === 'invoice.paid') {
      const invoice = event.data.object
      const rawEmail = invoice.customer_email
      if (!rawEmail) return res.status(200).json({ received: true })

      const email = rawEmail.toLowerCase()

      // Find which plan this subscription is for
      const lineItems = invoice.lines?.data || []
      for (const item of lineItems) {
        const amount = item.price?.unit_amount
        let planData = null
        if (amount === 2900) planData = { plan:'agent', credits:20 }
        else if (amount === 4900) planData = { plan:'pro', credits:60 }
        else if (amount === 9900) planData = { plan:'team', credits:180 }

        if (planData) {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              credits: planData.credits,
              plan: planData.plan,
              updated_at: new Date().toISOString(),
            })
            .eq('email', email)

          if (updateError) {
            console.error('Renewal update failed:', email, updateError.message)
          } else {
            console.log(`Monthly renewal: ${email} -> ${planData.credits} credits`)
          }
        }
      }
    }

    return res.status(200).json({ received: true })

  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(500).json({ error: err.message })
  }
}
