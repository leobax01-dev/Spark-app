// api/billing/brokerage-checkout.js — Tiered Annual Subscription Engine.
// POST { tier: "boutique"|"growth"|"enterprise", seats, brokerageName, userId, email }
// Creates a Stripe Checkout Session (mode: subscription, annual) and
// returns { url } for redirect. The webhook (api/webhook.js) picks up
// `checkout.session.completed` for this flow via `metadata.brokerage_flow`
// and provisions/updates the `brokerages` row + the purchasing user's
// role/brokerage_id.
//
// Pricing note: this app has no existing brokerage pricing anywhere (no
// price IDs, no prior tier structure for brokerages) — the per-seat annual
// figures below are placeholders modeled loosely on the $2.5k-$4k/mo
// white-label range mentioned in SPARK_OS/04-Memory/Financial_Metrics.md,
// divided into a per-seat annual rate. Adjust PRICE_PER_SEAT_ANNUAL_CENTS
// to your actual pricing before going live — do not ship these numbers as-is.
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const TIERS = {
  boutique: { maxSeats: 10, minSeats: 1, pricePerSeatAnnualCents: 39_900, label: "Boutique" },
  growth: { maxSeats: 25, minSeats: 11, pricePerSeatAnnualCents: 34_900, label: "Growth" },
  // "Custom seats" — no upper cap, but still a fixed, server-controlled
  // per-seat rate. A client-supplied price would let anyone check out for
  // $0.01; only the seat *count* is client-controlled here, never the price.
  enterprise: { maxSeats: null, minSeats: 26, pricePerSeatAnnualCents: 29_900, label: "Enterprise" },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: "STRIPE_SECRET_KEY not configured" });

  const { tier, seats, brokerageName, userId, email } = req.body || {};
  const tierConfig = TIERS[tier];
  if (!tierConfig) return res.status(400).json({ error: `tier must be one of: ${Object.keys(TIERS).join(", ")}` });
  if (!userId || !email) return res.status(400).json({ error: "userId and email required" });
  if (!brokerageName || !brokerageName.trim()) return res.status(400).json({ error: "brokerageName required" });

  const seatCount = Number(seats);
  if (!Number.isInteger(seatCount) || seatCount < tierConfig.minSeats || (tierConfig.maxSeats && seatCount > tierConfig.maxSeats)) {
    return res.status(400).json({
      error: `seats must be an integer between ${tierConfig.minSeats} and ${tierConfig.maxSeats ?? "unlimited"} for the ${tierConfig.label} tier`,
    });
  }

  const origin = req.headers.origin || `https://${req.headers.host}`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "year" },
            unit_amount: tierConfig.pricePerSeatAnnualCents,
            product_data: {
              name: `SPARK Brokerage — ${tierConfig.label} Tier (per seat, annual)`,
            },
          },
          quantity: seatCount,
        },
      ],
      metadata: {
        brokerage_flow: "true",
        tier,
        seats: String(seatCount),
        brokerage_name: brokerageName.trim(),
        user_id: userId,
      },
      subscription_data: {
        metadata: { brokerage_flow: "true", tier, seats: String(seatCount), user_id: userId },
      },
      success_url: `${origin}/?brokerage_checkout=success`,
      cancel_url: `${origin}/?brokerage_checkout=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Brokerage checkout session creation failed:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
