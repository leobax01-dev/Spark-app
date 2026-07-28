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
