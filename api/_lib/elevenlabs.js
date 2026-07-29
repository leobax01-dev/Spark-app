// api/_lib/elevenlabs.js — shared ElevenLabs text-to-speech helper.
// Extracted from api/voice.js's handleSpeak so api/ai/broker-copilot.js
// doesn't have to duplicate the key-parsing/error-handling logic.
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9"; // "Daniel"

// Trimmed + de-quoted: a stray trailing newline/space or accidental
// wrapping quotes in .env.local is a common cause of "key looks set but
// the check still fails."
export function readElevenLabsKey() {
  const raw = process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}

// Returns { audioBase64, mimeType } or throws with a message safe to
// surface to the caller. Callers should treat a missing API key as
// non-fatal if voice output is optional for their flow (see
// api/ai/broker-copilot.js, which still returns a text reply without audio).
export async function synthesizeSpeech(text, { voiceId, stability = 0.6, similarityBoost = 0.8, style = 0.3 } = {}) {
  const apiKey = readElevenLabsKey();
  if (!apiKey) {
    throw new Error(
      "ElevenLabs API key not configured. Set VITE_ELEVENLABS_API_KEY (or ELEVENLABS_API_KEY) in .env.local — " +
        "plain `vite dev` never loads .env.local into api/ functions, use `vercel dev` locally or set it in Vercel's Environment Variables."
    );
  }

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability, similarity_boost: similarityBoost, style },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${errText}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  return { audioBase64: audioBuffer.toString("base64"), mimeType: "audio/mpeg" };
}
