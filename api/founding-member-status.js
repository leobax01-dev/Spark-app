// api/founding-member-status.js
// Public, unauthenticated, read-only. The landing page needs to show a live
// "X of 20 spots remaining" count before anyone has an account — this reads
// the real redemption count directly from Stripe's own Coupon object
// (Stripe enforces the actual 20-redemption cap natively via the
// Promotion Code's max_redemptions setting; this endpoint just reports
// that real number back, it doesn't do any counting or enforcement itself).
// Returns ONLY a safe, minimal shape — never anything from Stripe that
// could expose customer or account details.
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const TOTAL_SPOTS = 20

export default async function handler(req, res) {
  // Cache for 60s at the edge — this gets hit by every landing page load,
  // and the number only needs to be "close to live," not millisecond-fresh.
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')

  const couponId = process.env.FOUNDING_MEMBER_COUPON_ID
  if (!couponId) {
    // Not configured yet — fail safe with the full count rather than error
    // out and break the landing page for everyone.
    return res.status(200).json({ remaining: TOTAL_SPOTS, total: TOTAL_SPOTS, configured: false })
  }

  try {
    const coupon = await stripe.coupons.retrieve(couponId)
    const redeemed = coupon.times_redeemed || 0
    const remaining = Math.max(0, TOTAL_SPOTS - redeemed)
    return res.status(200).json({ remaining, total: TOTAL_SPOTS, configured: true })
  } catch (e) {
    console.error('Founding member status check failed:', e.message)
    // Same fail-safe logic — a Stripe hiccup shouldn't take down the
    // landing page's hero section.
    return res.status(200).json({ remaining: TOTAL_SPOTS, total: TOTAL_SPOTS, configured: false })
  }
}
