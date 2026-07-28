// api/_lib/tasks.js — shared SPARK_OS task + reference-doc helpers.
// Not a route (Vercel excludes files under api/_lib/). Used by
// api/tasks.js (Command Deck) and api/voice.js (voice-to-task).
//
// Vercel production functions run on a read-only filesystem — writeFileSync
// to SPARK_OS/02-Tasks/Pending/ works locally but throws EROFS in
// production. Task creation and task counts are therefore backed by a
// Supabase table (`spark_os_tasks`) instead of files.
//
// listRecentBriefings() and readFinancialSnapshot() stay filesystem-based:
// those read the SPARK_OS/05-Daily-Briefings/ and
// SPARK_OS/04-Memory/Financial_Metrics.md docs that are committed to the
// repo and shipped with the deployment bundle — read-only access to
// bundled files is fine on Vercel; only writing at runtime is not.
import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.join(process.cwd(), "SPARK_OS");
const BRIEFINGS_DIR = path.join(ROOT, "05-Daily-Briefings");
const FINANCIAL_METRICS_FILE = path.join(ROOT, "04-Memory", "Financial_Metrics.md");

const TASKS_TABLE = "spark_os_tasks";

let _supabase = null;
function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase env vars not configured (SUPABASE_URL and SUPABASE_SERVICE_KEY) — required to read/write SPARK_OS tasks."
    );
  }
  _supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  return _supabase;
}

function listMdFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

// Counts rows in spark_os_tasks by status. Replaces the old readdirSync of
// 02-Tasks/{Pending,Needs_Approval,Completed}/ now that tasks live in
// Supabase rather than the (read-only in production) filesystem.
export async function listTaskCounts() {
  const supabase = getSupabase();
  const statuses = ["Pending", "Needs_Approval", "Completed"];
  const results = await Promise.all(
    statuses.map((status) =>
      supabase.from(TASKS_TABLE).select("id", { count: "exact", head: true }).eq("status", status)
    )
  );
  results.forEach((r, i) => {
    if (r.error) throw new Error(`Failed to count "${statuses[i]}" tasks: ${r.error.message}`);
  });
  return {
    pending: results[0].count ?? 0,
    needsApproval: results[1].count ?? 0,
    completed: results[2].count ?? 0,
  };
}

// Returns full task rows for one status, newest first — powers the
// Command Center's holographic Task Drawer overlay (unlike listTaskCounts,
// which only returns numbers).
export async function listTasksByStatus(status, limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TASKS_TABLE)
    .select("*")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Failed to list "${status}" tasks: ${error.message}`);
  return data;
}

// Updates a task's status (e.g. approving a Needs_Approval task moves it to
// Completed). Returns the updated row.
export async function updateTaskStatus(id, status) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(TASKS_TABLE)
    .update({ status })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`Failed to update task ${id} to "${status}": ${error.message}`);
  return data;
}

// Returns the most recent daily briefings as { file, date, text } entries,
// newest first, for the Command Center's live execution feed. These are
// static docs committed to the repo, so plain file reads are safe even on
// Vercel's read-only production filesystem.
export function listRecentBriefings(limit = 5) {
  const files = listMdFiles(BRIEFINGS_DIR).sort().reverse().slice(0, limit);
  return files.map((f) => ({
    file: f,
    date: f.replace(/\.md$/, ""),
    text: readFileSync(path.join(BRIEFINGS_DIR, f), "utf8"),
  }));
}

// Very light parse of Financial_Metrics.md for the System Vitals panel.
// Falls back to known launch-day targets if the file is missing/unparseable —
// this is a display helper, not the source of truth (that's the .md file itself).
export function readFinancialSnapshot() {
  const fallback = {
    arr: 0,
    arrConservativeTarget: 4_020_000,
    arrAmbitiousTarget: 35_200_000,
    soloSeats: 0,
    whiteLabelDeals: 0,
    foundingMembersTarget: 20,
  };
  if (!existsSync(FINANCIAL_METRICS_FILE)) return fallback;
  try {
    const text = readFileSync(FINANCIAL_METRICS_FILE, "utf8");
    const arrMatch = text.match(/\*\*ARR:\*\*\s*\$?([\d,]+)/i);
    const seatsMatch = text.match(/Founding Members.*?:\*\*\s*(\d+)/i);
    return {
      ...fallback,
      arr: arrMatch ? Number(arrMatch[1].replace(/,/g, "")) : fallback.arr,
      foundingMembersTarget: seatsMatch ? Number(seatsMatch[1]) : fallback.foundingMembersTarget,
    };
  } catch {
    return fallback;
  }
}

// Creates a new SPARK_OS task as a row in the `spark_os_tasks` Supabase
// table — not a file. Vercel's production filesystem is read-only, so
// writeFileSync(SPARK_OS/02-Tasks/Pending/...) throws EROFS there even
// though it works during local `vite`/`vercel dev`. The table is the single
// source of truth for task state now; see supabase/migrations/ for schema.
export async function createTask({ title, owner, body, source = "command-center", priority = "Medium", directive }) {
  const supabase = getSupabase();

  const ownerTag = owner && owner.endsWith("_Agent") ? owner : `${owner || "CEO"}_Agent`;
  const agentSlug = ownerTag.replace(/_Agent$/, "").toLowerCase();
  const directiveText = directive || body || "_No additional detail provided._";

  const { data, error } = await supabase
    .from(TASKS_TABLE)
    .insert({
      title,
      owner: ownerTag,
      agent_slug: agentSlug,
      priority,
      status: "Pending",
      source,
      directive: directiveText,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to file task in Supabase: ${error.message}`);

  // Kept for continuity with the old [agent]-[timestamp].md naming so UI
  // copy referencing "the filed task" still reads sensibly — this is a
  // display label now, not an actual file on disk.
  const label = `${agentSlug}-${data.id}`;

  return {
    id: data.id,
    fileName: `${label}.md`,
    filePath: `SPARK_OS/02-Tasks/Pending/${label}.md (Supabase: ${TASKS_TABLE}#${data.id})`,
    owner: ownerTag,
    priority,
    status: data.status,
    createdAt: data.created_at,
  };
}
