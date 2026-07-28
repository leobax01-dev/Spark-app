// api/tasks.js — SPARK Command Center data + task creation.
// GET  -> vitals (task counts, financial snapshot) + recent daily briefings feed.
// POST -> files a task as a row in the Supabase `spark_os_tasks` table
//         (Command Deck buttons) — see api/_lib/tasks.js for why this isn't
//         a file write.
import { listTaskCounts, listRecentBriefings, readFinancialSnapshot, createTask } from "./_lib/tasks.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const [counts, briefings] = await Promise.all([listTaskCounts(), Promise.resolve(listRecentBriefings(5))]);
      return res.status(200).json({
        counts,
        financial: readFinancialSnapshot(),
        briefings,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    const { title, owner, body, source } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });
    try {
      const task = await createTask({ title, owner, body, source });
      return res.status(200).json({ ok: true, task });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
