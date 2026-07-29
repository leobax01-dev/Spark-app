// api/ai/broker-copilot.js — "Spark," the Broker Copilot. Canonical
// endpoint — this used to have a near-duplicate sibling at api/spark.js
// (built from a separate spec pass); both called the same kind of
// brokerage-scoped queries and Claude+ElevenLabs pipeline with slightly
// different response shapes, so they're consolidated into this one file
// now, backed by the single shared brain in api/_lib/copilot.js.
//
// POST { query: string } with an Authorization: Bearer <supabase access
// token> header, from an authenticated user whose role === 'broker'.
// Reuses requireBroker() from api/_lib/brokerage.js (same auth boundary as
// the Team Settings endpoint) — this is not a service-role-open endpoint,
// every request re-authenticates the caller and resolves their own
// brokerage_id server-side. The queries in api/_lib/copilot.js are
// hardcoded to filter on that resolved brokerage_id; the LLM never sees a
// database connection, so there's no prompt-injection path to another
// firm's data.
//
// Response shape: { reply, audio, metrics: { totalVolume, pendingGci, atRiskCount } }
// — reply/audio is what src/components/SparkHUD.tsx already consumes;
// metrics is additive, for any widget that wants the numbers without
// round-tripping through the LLM's prose.
import { requireBroker } from "../_lib/brokerage.js";
import { answerBrokerQuery } from "../_lib/copilot.js";
import { synthesizeSpeech } from "../_lib/elevenlabs.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query } = req.body || {};
  if (!query || !query.trim()) return res.status(400).json({ error: "query required" });

  let brokerageId;
  try {
    ({ brokerageId } = await requireBroker(req));
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  let reply, metrics;
  try {
    ({ reply, metrics } = await answerBrokerQuery(query.trim(), brokerageId));
  } catch (err) {
    console.error("Broker copilot query failed:", err.message);
    return res.status(500).json({ error: `Spark couldn't pull that data just now: ${err.message}` });
  }

  // Voice is a nice-to-have on top of the text reply — a missing/broken
  // ElevenLabs key shouldn't turn a working answer into a 500.
  let audio = null;
  try {
    const speech = await synthesizeSpeech(reply);
    audio = speech.audioBase64;
  } catch (err) {
    console.warn("Broker copilot TTS failed (returning text-only reply):", err.message);
  }

  return res.status(200).json({
    reply,
    audio,
    metrics: {
      totalVolume: metrics.totalActiveVolume,
      pendingGci: metrics.pendingGci,
      atRiskCount: metrics.atRiskCount,
    },
  });
}
