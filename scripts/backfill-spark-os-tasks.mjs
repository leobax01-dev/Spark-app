#!/usr/bin/env node
// scripts/backfill-spark-os-tasks.mjs
//
// One-time migration: reads every .md task file currently sitting in
// SPARK_OS/02-Tasks/{Pending,Needs_Approval,Completed}/ and inserts each as
// a row in the Supabase `spark_os_tasks` table (see
// supabase/migrations/20260728000000_create_spark_os_tasks.sql), so tasks
// that predate the Supabase-backed api/_lib/tasks.js show up in the same
// place as tasks filed after the switch.
//
// Files are left in place — this only reads them, never deletes or moves
// anything. Re-running is safe: it skips any file whose relative path is
// already recorded in `source` (e.g. "backfill:02-Tasks/Pending/foo.md").
//
// Usage:
//   node scripts/backfill-spark-os-tasks.mjs           # do it
//   node scripts/backfill-spark-os-tasks.mjs --dry-run # print what would be inserted, insert nothing
//
// Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY —
// loaded from .env.local automatically if present, or export them yourself.

import { readdirSync, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..");
const SPARK_OS_DIR = path.join(REPO_ROOT, "SPARK_OS");
const TASKS_DIR = path.join(SPARK_OS_DIR, "02-Tasks");

const DRY_RUN = process.argv.includes("--dry-run");

// ── Minimal .env.local loader (no dependency added) ──────────────────────
function loadDotEnvLocal() {
  const envPath = path.join(REPO_ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    value = value.replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_SERVICE_KEY)) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_KEY.\n" +
      "Set them in .env.local or export them before running, or pass --dry-run to preview without them."
  );
  process.exit(1);
}

const supabase = DRY_RUN ? null : createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const FOLDER_TO_STATUS = {
  Pending: "Pending",
  Needs_Approval: "Needs_Approval",
  Completed: "Completed",
};

const SUBTASK_HEADING_RE = /^##\s*\d+\.\s*([A-Za-z]+_Agent)\s*—\s*(.+)$/gm;

function extractField(body, label) {
  const re = new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`, "i");
  const m = body.match(re);
  return m ? m[1].trim() : null;
}

function extractTitle(body, fallback) {
  const m = body.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function stripMetadataBlock(body) {
  // Drop the leading "# Title" line and any **Key:** Value lines immediately
  // following it, keeping everything else (the actual directive content).
  const lines = body.split("\n");
  let i = 0;
  if (lines[0]?.startsWith("# ")) i = 1;
  while (i < lines.length && (lines[i].trim() === "" || /^\*\*[^*]+:\*\*/.test(lines[i].trim()))) {
    i++;
  }
  return lines.slice(i).join("\n").trim();
}

// Splits an umbrella multi-owner directive (like gtm-launch-day-1.md, which
// has "## 1. CMO_Agent — ..." style sub-sections each with their own
// **Owner:**) into one task per sub-section. Returns [] if the file doesn't
// match that shape, so the caller falls back to single-task parsing.
function parseMultiOwnerFile(body, relPath) {
  const matches = [...body.matchAll(SUBTASK_HEADING_RE)];
  if (matches.length < 2) return [];

  const topPriority = extractField(body, "Priority") || "Medium";
  const tasks = [];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const owner = m[1];
    const title = m[2].trim();
    const start = m.index + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    const sectionBody = body.slice(start, end).replace(/^\s*---\s*$/gm, "").trim();

    tasks.push({
      title,
      owner,
      priority: extractField(sectionBody, "Priority") || topPriority,
      directive: sectionBody || "_No additional detail provided._",
      source: `backfill:${relPath}#${i + 1}`,
    });
  }
  return tasks;
}

function parseSingleTaskFile(body, relPath, fallbackTitle) {
  const owner = extractField(body, "Assigned Agent") || extractField(body, "Owner") || "CEO_Agent";
  const title = extractTitle(body, fallbackTitle);
  const priority = extractField(body, "Priority") || "Medium";
  const directive = stripMetadataBlock(body) || "_No additional detail provided._";
  return [{ title, owner, priority, directive, source: `backfill:${relPath}` }];
}

function collectTasks() {
  const collected = [];
  for (const [folder, status] of Object.entries(FOLDER_TO_STATUS)) {
    const dir = path.join(TASKS_DIR, folder);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
      const filePath = path.join(dir, file);
      const relPath = path.relative(SPARK_OS_DIR, filePath);
      const body = readFileSync(filePath, "utf8");

      const multi = parseMultiOwnerFile(body, relPath);
      const parsed = multi.length > 0 ? multi : parseSingleTaskFile(body, relPath, file.replace(/\.md$/, ""));

      for (const t of parsed) {
        const ownerTag = t.owner.endsWith("_Agent") ? t.owner : `${t.owner}_Agent`;
        collected.push({
          title: t.title,
          owner: ownerTag,
          agent_slug: ownerTag.replace(/_Agent$/, "").toLowerCase(),
          priority: /^(low|medium|high)$/i.test(t.priority) ? t.priority[0].toUpperCase() + t.priority.slice(1).toLowerCase() : "Medium",
          status,
          source: t.source,
          directive: t.directive,
        });
      }
    }
  }
  return collected;
}

async function alreadyBackfilled(source) {
  const { data, error } = await supabase.from("spark_os_tasks").select("id").eq("source", source).limit(1);
  if (error) throw new Error(`Lookup failed for source="${source}": ${error.message}`);
  return data.length > 0;
}

async function main() {
  const tasks = collectTasks();
  if (tasks.length === 0) {
    console.log("No task files found under SPARK_OS/02-Tasks/ — nothing to backfill.");
    return;
  }

  console.log(`Found ${tasks.length} task(s) to backfill:\n`);
  for (const t of tasks) {
    console.log(`  [${t.status}] ${t.owner} — "${t.title}" (${t.source})`);
  }

  if (DRY_RUN) {
    console.log("\n--dry-run: nothing inserted.");
    return;
  }

  console.log("");
  let inserted = 0;
  let skipped = 0;
  for (const t of tasks) {
    if (await alreadyBackfilled(t.source)) {
      console.log(`  skip (already backfilled): ${t.source}`);
      skipped++;
      continue;
    }
    const { error } = await supabase.from("spark_os_tasks").insert(t);
    if (error) {
      console.error(`  FAILED: ${t.source} — ${error.message}`);
      continue;
    }
    console.log(`  inserted: ${t.source}`);
    inserted++;
  }

  console.log(`\nDone. ${inserted} inserted, ${skipped} already present, ${tasks.length - inserted - skipped} failed.`);
  console.log("The original .md files under SPARK_OS/02-Tasks/ were left untouched.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
