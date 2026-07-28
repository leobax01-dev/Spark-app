// api/tasks.js — SPARK Command Center data + task creation/approval.
// GET  ?status=Pending|Needs_Approval|Completed -> full task rows for that
//      status (Task Drawer overlay).
// GET  (no status)                              -> vitals (task counts,
//      financial snapshot) + recent daily briefings feed (dashboard load).
// POST { action: "approve", id }                -> marks a task Completed
//      (Approval Aether "APPROVE" directive).
// POST { title, owner, body, source }            -> files a new task as a
//      row in the Supabase `spark_os_tasks` table (Command Deck buttons /
//      Direct Command Input) — see api/_lib/tasks.js for why this isn't a
//      file write.
import {
  listTaskCounts,
  listRecentBriefings,
  readFinancialSnapshot,
  createTask,
  listTasksByStatus,
  listTasksByOwner,
  updateTaskStatus,
} from "./_lib/tasks.js";

const VALID_STATUSES = new Set(["Pending", "Needs_Approval", "Completed"]);

export default async function handler(req, res) {
  if (req.method === "GET") {
    const { status, owner } = req.query || {};
    if (status) {
      if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: `Invalid status "${status}"` });
      try {
        const tasks = await listTasksByStatus(status);
        return res.status(200).json({ status, tasks });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (owner) {
      try {
        const ownerTag = owner.endsWith("_Agent") ? owner : `${owner}_Agent`;
        const tasks = await listTasksByOwner(ownerTag);
        return res.status(200).json({ owner: ownerTag, tasks });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

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
    const body = req.body || {};

    if (body.action === "approve") {
      if (!body.id) return res.status(400).json({ error: "id required" });
      try {
        const task = await updateTaskStatus(body.id, "Completed");
        return res.status(200).json({ ok: true, task });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    const { title, owner, body: directiveBody, source } = body;
    if (!title) return res.status(400).json({ error: "title required" });
    try {
      const task = await createTask({ title, owner, body: directiveBody, source });
      return res.status(200).json({ ok: true, task });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
