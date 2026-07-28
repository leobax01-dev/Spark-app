// api/tasks.js — SPARK Command Center data + task creation.
// GET  -> vitals (task counts, financial snapshot) + recent daily briefings feed.
// POST -> creates a task file in SPARK_OS/02-Tasks/Pending/ (Command Deck buttons).
import { listTaskCounts, listRecentBriefings, readFinancialSnapshot, createTask } from "./_lib/tasks.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      return res.status(200).json({
        counts: listTaskCounts(),
        financial: readFinancialSnapshot(),
        briefings: listRecentBriefings(5),
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === "POST") {
    const { title, owner, body, source } = req.body || {};
    if (!title) return res.status(400).json({ error: "title required" });
    try {
      const task = createTask({ title, owner, body, source });
      return res.status(200).json({ ok: true, task });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
