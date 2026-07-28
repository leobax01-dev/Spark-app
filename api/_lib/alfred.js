// api/_lib/alfred.js — Alfred persona voice generation.
// Uses ANTHROPIC_API_KEY (same key api/claude.js already relies on) to
// generate natural, in-character lines. Falls back to a deterministic
// template — still fully in persona, always addressing "Mr. Bax" — if no
// key is configured, so the voice engine degrades gracefully rather than
// failing outright.
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const ALFRED_SYSTEM_PROMPT = `You are Alfred, the refined and unfailingly composed AI chief of staff for SPARK OS — modeled on Bruce Wayne's trusted butler. You always address the user as "Mr. Bax". Your tone is formal, calm, articulate, warm, and dryly understated — think a distinguished English butler, never a generic corporate assistant and never robotic. Keep responses brief (1-3 sentences), natural to speak aloud, and always in character. Never break character, never mention that you are an AI language model, never use bullet points or markdown — this is spoken dialogue.`;

async function callClaude(userPrompt, maxTokens = 220) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: ALFRED_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

// A short spoken confirmation after a directive has been routed and filed.
export async function alfredConfirmation({ agentLabel, transcript, priority }) {
  const prompt = `Mr. Bax just gave this spoken directive: "${transcript}". You have filed it as a ${priority}-priority task for ${agentLabel}. Compose your one-to-two sentence spoken confirmation to Mr. Bax now.`;
  const generated = await callClaude(prompt, 120);
  if (generated) return generated;
  return `Very good, Mr. Bax. I've instructed ${agentLabel} accordingly, and filed it as ${priority.toLowerCase()} priority. I'll keep the dashboard updated.`;
}

// Refined executive summary of the latest daily briefing, read aloud.
export async function alfredBriefingSummary({ date, briefingText }) {
  const prompt = `Here is the raw content of today's SPARK OS daily briefing (dated ${date}):\n\n${briefingText.slice(0, 6000)}\n\nMr. Bax has asked for today's brief. Synthesize this into a refined executive summary — the key decisions, what shipped, what's pending or blocked, and anything needing his attention — as you would deliver it to him aloud. Three to five sentences.`;
  const generated = await callClaude(prompt, 400);
  if (generated) return generated;
  const condensed = briefingText.replace(/[#*_`]/g, "").trim().slice(0, 500);
  return `Certainly, Mr. Bax. Here is the briefing for ${date}: ${condensed}${briefingText.length > 500 ? "…" : ""}`;
}

// Spoken response when something goes wrong — still in character.
export function alfredApology(reason) {
  return `My apologies, Mr. Bax — I wasn't able to complete that. ${reason || "Something interrupted me."}`;
}

// Conversational answer grounded in real spark_os_tasks rows — Alfred's
// Neural Cortex. `tasks` is a recent-task context window (see
// api/_lib/alfredBrain.js), not arbitrary query results, so the prompt
// explicitly instructs Claude to answer only from what's given rather than
// speculate beyond it.
export async function alfredAnswerFromContext({ question, tasks }) {
  const byOwner = {};
  for (const t of tasks) {
    (byOwner[t.owner] ||= []).push(t);
  }
  const summaryLines = Object.entries(byOwner).map(([owner, rows]) => {
    const statusCounts = rows.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1;
      return acc;
    }, {});
    const statusStr = Object.entries(statusCounts).map(([s, n]) => `${n} ${s}`).join(", ");
    const recentTitles = rows.slice(0, 5).map((r) => `"${r.title}" [${r.priority}, ${r.status}]`).join("; ");
    return `${owner}: ${statusStr}. Recent: ${recentTitles || "none"}`;
  });
  const contextBlock = summaryLines.length > 0 ? summaryLines.join("\n") : "No tasks recorded in the system yet.";

  const prompt = `Mr. Bax just asked you, aloud: "${question}"\n\nHere is the current state of SPARK_OS's task table (spark_os_tasks), grouped by agent:\n\n${contextBlock}\n\nAnswer his question conversationally using ONLY this data. If the data doesn't actually answer what he asked (e.g. he asked about financials but the task table has nothing relevant), say so honestly rather than inventing numbers — you may note that a given metric isn't tracked in the task table yet. Two to four sentences, spoken aloud.`;

  const generated = await callClaude(prompt, 320);
  if (generated) return generated;

  // Deterministic fallback (no ANTHROPIC_API_KEY configured) — still
  // genuinely grounded in the same data, just templated instead of generated.
  if (summaryLines.length === 0) {
    return "I'm afraid there's nothing on the books yet, Mr. Bax — the task table is empty.";
  }
  return `Here's where things stand, Mr. Bax: ${summaryLines.join(" ")}`;
}
