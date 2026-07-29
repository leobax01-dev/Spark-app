// api/brokerage/accept-invite.js — POST { token, userId } to join a
// brokerage via an invite link (SparkCommandCenter-unrelated; this is the
// core app's `/?invite=TOKEN` flow). Called from the client right after a
// new or existing agent signs in with an invite token present in the URL.
import { acceptInvite } from "../_lib/brokerage.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { token, userId } = req.body || {};
  if (!token || !userId) return res.status(400).json({ error: "token and userId required" });

  try {
    const result = await acceptInvite(token, userId);
    return res.status(200).json({ ok: true, brokerageId: result.brokerageId });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
