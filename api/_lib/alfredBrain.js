// api/_lib/alfredBrain.js — Alfred's Neural Cortex.
//
// The single routing brain shared by api/alfred-brain.js (the new
// conversational endpoint) and api/voice.js (audio STT path + legacy
// text-command action) — one implementation, not two copies.
//
// Given a raw transcript, Alfred autonomously decides between three modes:
//   1. "briefing"    — a quick "today's brief" style request -> reads back
//                       the latest SPARK_OS/05-Daily-Briefings/ entry.
//   2. "conversation" — a genuine question ("what is the CMO working on?",
//                       "how is our ARR looking?") -> queries spark_os_tasks
//                       for real context and answers conversationally.
//   3. "task"          — an actual directive -> classifies to a C-Suite
//                       agent, files a row in spark_os_tasks, and confirms.
//
// Honesty note on the "conversational brain": this grounds answers in the
// most recent ~40 task rows (title/owner/status/priority/created_at) — it
// is not a full agentic tool-use loop with arbitrary SQL/query planning.
// That's a deliberate scope choice: a real text-to-SQL or multi-step
// tool-calling agent is a substantially larger project than a single
// endpoint, and a fixed recent-context window answers the kinds of
// questions Mr. Bax actually asks ("what's CMO doing", "how's ARR") well
// without the failure modes of freeform generated SQL against a live table.
import { createTask, listRecentBriefings, listRecentTasksContext } from "./tasks.js";
import { AGENTS, classifyIntent, extractPriority, isBriefingQuery, stripWakePhrase } from "./agents.js";
import { alfredConfirmation, alfredBriefingSummary, alfredApology, alfredAnswerFromContext } from "./alfred.js";

// Question-shaped utterances route to conversation instead of task-filing.
// Deliberately conservative: default to "task" (the safer failure — Alfred
// filing a task from an ambiguous utterance is recoverable; silently
// answering instead of acting on a real directive is worse).
const QUESTION_RE = /^(what|how|why|who|when|where|is|are|did|does|do|can|could|will|should|tell me|give me an update|update me)\b/i;

export function isConversationalQuery(text) {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.endsWith("?")) return true;
  return QUESTION_RE.test(t);
}

export async function routeUtterance(rawTranscript) {
  const transcript = stripWakePhrase(rawTranscript);
  if (!transcript) {
    return { mode: "conversation", transcript, rawTranscript, spoken: "I didn't quite catch that, Mr. Bax — go ahead." };
  }

  // 1. Quick briefing readout
  if (isBriefingQuery(transcript)) {
    const [latest] = listRecentBriefings(1);
    if (!latest) {
      return {
        mode: "briefing",
        transcript,
        rawTranscript,
        spoken: "I'm afraid there's no daily briefing on file yet, Mr. Bax. Shall I have the CEO Agent compile one now?",
      };
    }
    const spoken = await alfredBriefingSummary({ date: latest.date, briefingText: latest.text });
    return { mode: "briefing", transcript, rawTranscript, briefingDate: latest.date, spoken };
  }

  // 2. Conversational question — grounded in real Supabase task data
  if (isConversationalQuery(transcript)) {
    let context = [];
    try {
      context = await listRecentTasksContext(40);
    } catch (err) {
      return { mode: "conversation", transcript, rawTranscript, spoken: alfredApology(err.message) };
    }
    const spoken = await alfredAnswerFromContext({ question: transcript, tasks: context });
    return { mode: "conversation", transcript, rawTranscript, spoken, contextCount: context.length };
  }

  // 3. Actionable directive — classify, file, confirm
  const intentKey = classifyIntent(transcript);
  const agent = AGENTS[intentKey];
  const priority = extractPriority(transcript);

  const task = await createTask({
    title: transcript.slice(0, 80) || "Voice directive",
    owner: agent.owner,
    priority,
    directive: `**Spoken directive (via Alfred's Neural Cortex):**\n\n> ${transcript}`,
    source: "alfred-brain",
  });

  const spoken = await alfredConfirmation({ agentLabel: agent.label, transcript, priority });

  return {
    mode: "task",
    transcript,
    rawTranscript,
    agent: intentKey,
    agentLabel: agent.label,
    priority,
    task,
    spoken,
  };
}
