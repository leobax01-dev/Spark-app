// api/alfred-brain.js — Alfred's Neural Cortex endpoint.
//
// POST { text } -> routes through api/_lib/alfredBrain.js's routeUtterance(),
// which autonomously decides whether this is a conversational question
// (answered from real spark_os_tasks data), a quick briefing readout, or an
// actionable directive (filed as a task and confirmed).
//
// This is the endpoint the always-on "Hey Alfred" wake-word listener calls
// with the transcript Web Speech API already produced client-side — there's
// no audio/STT step here (that still exists in api/voice.js's "command"
// action for API completeness, but the UI no longer has a mic button to
// trigger it).
import { routeUtterance } from "./_lib/alfredBrain.js";
import { alfredApology } from "./_lib/alfred.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text required" });

  try {
    const result = await routeUtterance(text.trim());
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message, spoken: alfredApology(err.message) });
  }
}
