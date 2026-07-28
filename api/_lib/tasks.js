// api/_lib/tasks.js — shared SPARK_OS filesystem helpers.
// Not a route (Vercel excludes files under api/_lib/). Used by
// api/tasks.js (Command Deck) and api/voice.js (voice-to-task).
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const ROOT = path.join(process.cwd(), "SPARK_OS");
const PENDING_DIR = path.join(ROOT, "02-Tasks", "Pending");
const COMPLETED_DIR = path.join(ROOT, "02-Tasks", "Completed");
const NEEDS_APPROVAL_DIR = path.join(ROOT, "02-Tasks", "Needs_Approval");
const BRIEFINGS_DIR = path.join(ROOT, "05-Daily-Briefings");
const FINANCIAL_METRICS_FILE = path.join(ROOT, "04-Memory", "Financial_Metrics.md");

function listMdFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort();
}

export function listTaskCounts() {
  return {
    pending: listMdFiles(PENDING_DIR).length,
    needsApproval: listMdFiles(NEEDS_APPROVAL_DIR).length,
    completed: listMdFiles(COMPLETED_DIR).length,
  };
}

// Returns the most recent daily briefings as { file, date, text } entries,
// newest first, for the Command Center's live execution feed.
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

// Creates a new SPARK_OS task file in 02-Tasks/Pending/, matching the
// convention used by gtm-launch-day-1.md and the run-autonomous-loop.sh
// owner-tag routing (an "<Owner>_Agent" token in the body). Filed as
// [agent]-[timestamp].md, e.g. cfo-2026-07-28t03-15-00-000z.md.
export function createTask({ title, owner, body, source = "command-center", priority = "Medium", directive }) {
  if (!existsSync(PENDING_DIR)) mkdirSync(PENDING_DIR, { recursive: true });

  const ownerTag = owner && owner.endsWith("_Agent") ? owner : `${owner || "CEO"}_Agent`;
  const agentSlug = ownerTag.replace(/_Agent$/, "").toLowerCase();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").toLowerCase();
  const fileName = `${agentSlug}-${stamp}.md`;
  const filePath = path.join(PENDING_DIR, fileName);

  const content = `# ${title}

**Assigned Agent:** ${ownerTag}
**Priority:** ${priority}
**Status:** Pending
**Source:** ${source}
**Created:** ${new Date().toISOString()}

## Directive

${directive || body || "_No additional detail provided._"}
`;

  writeFileSync(filePath, content, "utf8");
  return { fileName, filePath: path.relative(process.cwd(), filePath), owner: ownerTag, priority };
}
