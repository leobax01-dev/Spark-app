// api/voice.js — "Alfred", the SPARK OS voice engine.
//
// Three actions:
//   POST { action: "command", audioBase64, mimeType } -> ElevenLabs speech-to-text,
//     then routes the transcript through processCommand() below.
//   POST { action: "text-command", text } -> skips STT (used by the client's
//     Web Speech API wake-word engine, which already has a transcript) and
//     routes straight through processCommand().
//   POST { action: "speak", text, voiceId? } -> ElevenLabs text-to-speech,
//     returns base64 audio for the client to play (and pulse the 3D Agent
//     Core to).
//
// processCommand() either:
//   - detects a quick "today's brief" style query and reads back a refined
//     executive summary of the latest SPARK_OS/05-Daily-Briefings/ file, or
//   - classifies the directive to a C-Suite agent (CFO/CTO/CMO/CRO/CEO),
//     files it as SPARK_OS/02-Tasks/Pending/[agent]-[timestamp].md, and
//     returns an in-character Alfred confirmation for the client to speak.
//
// Note: VITE_ prefixes only matter for client-bundled env vars (Vite inlines
// them at build time). This is a server-only Vercel function, so the prefix
// has no special effect here — it's just the variable's name. Kept as
// VITE_ELEVENLABS_API_KEY per spec, with a plain ELEVENLABS_API_KEY fallback.
import { createTask, listRecentBriefings } from "./_lib/tasks.js";
import { AGENTS, classifyIntent, extractPriority, isBriefingQuery, stripWakePhrase } from "./_lib/agents.js";
import { alfredConfirmation, alfredBriefingSummary, alfredApology } from "./_lib/alfred.js";

// Trimmed + de-quoted: a common cause of "key looks set but the check still
// fails" is a stray trailing newline/space or accidental wrapping quotes in
// .env.local (e.g. VITE_ELEVENLABS_API_KEY="sk_..." pasted with the quotes
// literally included). Both are stripped here so a genuinely-set key is
// never rejected on a formatting technicality.
function readApiKey() {
  const raw = process.env.VITE_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY || "";
  return raw.trim().replace(/^['"]|['"]$/g, "");
}
const API_KEY = readApiKey();
const DEFAULT_VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "onwK4e9ZLuTAKqWW03F9"; // "Daniel" — a calm, articulate British male voice, apt for Alfred

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { action } = req.body || {};

  if (action === "command") return handleAudioCommand(req, res);
  if (action === "text-command") return handleTextCommand(req, res);
  if (action === "speak") return handleSpeak(req, res);
  return res.status(400).json({ error: "action must be 'command', 'text-command', or 'speak'" });
}

async function handleAudioCommand(req, res) {
  if (!API_KEY) {
    return res.status(500).json({
      error:
        "ElevenLabs API key not configured. Set VITE_ELEVENLABS_API_KEY (or ELEVENLABS_API_KEY) in .env.local, " +
        "and note that plain `vite dev` never loads .env.local into api/ functions — run `vercel dev` locally, " +
        "or set the var in the Vercel project's Environment Variables for a real deploy.",
    });
  }
  const { audioBase64, mimeType = "audio/webm" } = req.body || {};
  if (!audioBase64) return res.status(400).json({ error: "audioBase64 required" });

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("file", new Blob([audioBuffer], { type: mimeType }), "command.webm");

    const sttRes = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": API_KEY },
      body: form,
    });
    if (!sttRes.ok) {
      const errText = await sttRes.text();
      return res.status(sttRes.status).json({ error: `ElevenLabs STT failed: ${errText}` });
    }
    const sttData = await sttRes.json();
    const transcript = (sttData.text || "").trim();
    if (!transcript) return res.status(422).json({ error: "No speech detected in audio" });

    const result = await processCommand(transcript);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message, spoken: alfredApology(err.message) });
  }
}

async function handleTextCommand(req, res) {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: "text required" });
  try {
    const result = await processCommand(text.trim());
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message, spoken: alfredApology(err.message) });
  }
}

// Shared routing logic for both the audio and text-command entry points.
async function processCommand(rawTranscript) {
  const transcript = stripWakePhrase(rawTranscript);

  // Quick Query Direct Response — bypass task filing, read the brief back.
  if (isBriefingQuery(transcript)) {
    const [latest] = listRecentBriefings(1);
    if (!latest) {
      const spoken = "I'm afraid there's no daily briefing on file yet, Mr. Bax. Shall I have the CEO Agent compile one now?";
      return { mode: "briefing", transcript, rawTranscript, spoken };
    }
    const spoken = await alfredBriefingSummary({ date: latest.date, briefingText: latest.text });
    return { mode: "briefing", transcript, rawTranscript, briefingDate: latest.date, spoken };
  }

  // Actionable Command Routing — classify, file, confirm.
  const intentKey = classifyIntent(transcript);
  const agent = AGENTS[intentKey];
  const priority = extractPriority(transcript);

  const task = await createTask({
    title: transcript.slice(0, 80) || "Voice directive",
    owner: agent.owner,
    priority,
    directive: `**Spoken directive (via Alfred voice engine):**\n\n> ${transcript}`,
    source: "alfred-voice",
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

async function handleSpeak(req, res) {
  if (!API_KEY) {
    return res.status(500).json({
      error:
        "ElevenLabs API key not configured. Set VITE_ELEVENLABS_API_KEY (or ELEVENLABS_API_KEY) in .env.local, " +
        "and note that plain `vite dev` never loads .env.local into api/ functions — run `vercel dev` locally, " +
        "or set the var in the Vercel project's Environment Variables for a real deploy.",
    });
  }
  const { text, voiceId } = req.body || {};
  if (!text) return res.status(400).json({ error: "text required" });

  try {
    const ttsRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId || DEFAULT_VOICE_ID}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": API_KEY,
          "Content-Type": "application/json",
          "accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.6, similarity_boost: 0.8, style: 0.3 },
        }),
      }
    );
    if (!ttsRes.ok) {
      const errText = await ttsRes.text();
      return res.status(ttsRes.status).json({ error: `ElevenLabs TTS failed: ${errText}` });
    }
    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());
    return res.status(200).json({
      audioBase64: audioBuffer.toString("base64"),
      mimeType: "audio/mpeg",
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
