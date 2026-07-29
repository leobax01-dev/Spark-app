// api/brokerage/team.js — Team Management & Seat Provisioning.
// GET  -> { brokerage, members, seatLimit, activeSeats } for the calling broker.
// POST { action: "invite" }              -> creates and returns an invite URL/token.
// POST { action: "revoke", userId }      -> clears that member's brokerage_id.
// All actions require a valid broker session (see requireBroker) — this is
// not a service-role-open endpoint, the caller is authenticated per-request
// via their Supabase access token.
import { requireBroker, getBrokerage, listBrokerageMembers, createInvite, revokeMemberAccess } from "../_lib/brokerage.js";

export default async function handler(req, res) {
  try {
    const { brokerageId, userId } = await requireBroker(req);

    if (req.method === "GET") {
      const [brokerage, members] = await Promise.all([getBrokerage(brokerageId), listBrokerageMembers(brokerageId)]);
      // active_seats is now the authoritative stored counter (migration
      // 20260730000000) — members.length is still returned for the roster
      // itself, but seat math uses the counter, not a recount.
      if (members.length !== brokerage.active_seats) {
        console.warn(`active_seats drift for brokerage ${brokerageId}: counter=${brokerage.active_seats}, actual members=${members.length}`);
      }
      return res.status(200).json({
        brokerage,
        members,
        seatLimit: brokerage.pilot_seat_limit,
        activeSeats: brokerage.active_seats,
      });
    }

    if (req.method === "POST") {
      const { action } = req.body || {};

      if (action === "invite") {
        const brokerage = await getBrokerage(brokerageId);
        if (brokerage.pilot_seat_limit != null && brokerage.active_seats >= brokerage.pilot_seat_limit) {
          return res.status(409).json({ error: `Seat limit reached (${brokerage.pilot_seat_limit}). Upgrade your tier to invite more agents.` });
        }
        const invite = await createInvite(brokerageId, userId);
        const origin = req.headers.origin || `https://${req.headers.host}`;
        return res.status(200).json({
          token: invite.token,
          expiresAt: invite.expires_at,
          inviteUrl: `${origin}/?invite=${invite.token}`,
        });
      }

      if (action === "revoke") {
        if (!req.body.userId) return res.status(400).json({ error: "userId required" });
        if (req.body.userId === userId) return res.status(400).json({ error: "You can't revoke your own broker access here." });
        const revoked = await revokeMemberAccess(brokerageId, req.body.userId);
        return res.status(200).json({ ok: true, revoked });
      }

      return res.status(400).json({ error: "action must be 'invite' or 'revoke'" });
    }

    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
