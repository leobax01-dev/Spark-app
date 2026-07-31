// src/components/SparkHUD.tsx — "Spark", an elite executive voice-and-text
// AI HUD for the Brokerage Command Suite.
//
// Two notes on how this fits the actual repo, not the spec's assumed one:
//
// 1. Path: the spec asked for `components/SparkHUD.tsx`. This repo's real
//    component directory is `src/components/` (see BrokerDashboard.jsx,
//    SparkCommandCenter.jsx, UI.jsx there) — placed there instead so it's
//    actually importable alongside its siblings.
//
// 2. Styling: this app has no Tailwind installed anywhere (every other
//    component — UI.jsx, ClientPanel.jsx, BrokerDashboard.jsx — uses plain
//    inline styles with a shared design-token object). The Tailwind
//    className strings requested are kept on every element as literal
//    strings (harmless, and they'll activate for free if Tailwind is ever
//    added later), but the actual visual result today comes from the
//    inline `style` objects alongside them, tuned to the same zinc-950 /
//    indigo-500 / cyan dark-enterprise palette the classNames describe.
//
// Backend: POSTs to /api/ai/broker-copilot (api/ai/broker-copilot.js),
// authenticated via the signed-in user's Supabase access token, resolved
// fresh on each send — see getAuthToken() below. If that token is missing
// or the request fails, Spark shows a clear error in chat rather than
// hanging or crashing — see handleSend().
//
// Mounted globally from src/App.jsx's MainApp, rendered only when
// user.role === "broker" (it POSTs to a broker-only endpoint — mounting it
// for agents would just produce 403s from every message).
import { useState, useRef, useEffect, useCallback } from "react";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

const WAKE_PHRASE = "hey spark";
const COPILOT_ENDPOINT = "/api/ai/broker-copilot";

const C = {
  bg: "rgba(9,9,11,0.95)", // zinc-950/95
  panel: "rgba(24,24,27,0.85)", // zinc-900-ish
  border: "rgba(99,102,241,0.3)", // indigo-500/30
  borderStrong: "rgba(99,102,241,0.55)",
  indigo: "#6366F1",
  cyan: "#22D3EE",
  text: "rgba(244,244,245,0.96)",
  textMd: "rgba(212,212,216,0.65)",
  textDim: "rgba(161,161,170,0.45)",
  rose: "#FB7185",
  F: "'Plus Jakarta Sans','Inter',sans-serif",
};

type ChatMessage = {
  id: string;
  role: "user" | "spark";
  text: string;
  isError?: boolean;
};

const QUICK_PROMPTS = [
  "Show me our projected GCI for this month",
  "Which deals are currently stalled?",
  "Top performing agent this quarter",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// Resolves the current Supabase access token at call time (same pattern as
// BrokerTeamSettings.jsx's authedFetch) rather than accepting it as a prop
// — this lets SparkHUD mount globally in App.jsx without App.jsx having to
// track/refresh a token on its behalf, and it always uses a fresh one.
async function getAuthToken(): Promise<string | null> {
  const sb = (window as any).__supabase;
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export default function SparkHUD() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capturingRef = useRef(false);

  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // ── Continuous background listening for the "Hey Spark" wake phrase ────
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) return;
    try {
      SpeechRecognition.startListening({ continuous: true });
    } catch {
      // getUserMedia can reject synchronously in locked-down contexts —
      // isMicrophoneAvailable below is what actually surfaces this to the UI.
    }
    return () => {
      try {
        SpeechRecognition.stopListening();
      } catch {
        // no-op
      }
    };
  }, [browserSupportsSpeechRecognition]);

  useEffect(() => {
    if (!isMicrophoneAvailable) {
      setMicError("Microphone access was denied — Spark can't listen for \"Hey Spark.\" You can still type.");
    }
  }, [isMicrophoneAvailable]);

  // ── Wake-phrase + end-of-utterance detection ────────────────────────────
  // react-speech-recognition just streams a running transcript; there's no
  // built-in "utterance finished" event, so a short silence window after
  // the wake phrase is heard is what triggers dispatch — the same pattern
  // used by the Alfred voice engine elsewhere in this app.
  useEffect(() => {
    if (!transcript) return;
    const lower = transcript.toLowerCase();

    if (!capturingRef.current) {
      const wakeIndex = lower.indexOf(WAKE_PHRASE);
      if (wakeIndex === -1) return;
      capturingRef.current = true;
      setOpen(true);
    }

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const wakeIndex = lower.indexOf(WAKE_PHRASE);
      const utterance = (wakeIndex >= 0 ? transcript.slice(wakeIndex + WAKE_PHRASE.length) : transcript).trim();
      capturingRef.current = false;
      resetTranscript();
      if (utterance) handleSend(utterance);
    }, 1400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  function toggleMic() {
    if (!browserSupportsSpeechRecognition) {
      setMicError("This browser doesn't support the Web Speech API — try Chrome.");
      return;
    }
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true });
    }
  }

  async function speakReply(base64Audio: string) {
    try {
      const audio = new Audio("data:audio/mp3;base64," + base64Audio);
      audioRef.current = audio;
      setSpeaking(true);
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play();
    } catch {
      setSpeaking(false);
    }
  }

  const handleSend = useCallback(
    async (rawText: string) => {
      const text = rawText.trim();
      if (!text || loading) return;

      setMessages((prev) => [...prev, { id: uid(), role: "user", text }]);
      setInputValue("");
      setLoading(true);

      try {
        const authToken = await getAuthToken();
        if (!authToken) throw new Error("Your session expired — please sign in again.");

        const res = await fetch(COPILOT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ query: text }),
        });

        let data: any = null;
        try {
          data = await res.json();
        } catch {
          throw new Error(`Backend returned a non-JSON response (${res.status}) — is /api/ai/broker-copilot deployed?`);
        }
        if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);

        const replyText = data.reply || data.text || "Understood.";
        setMessages((prev) => [...prev, { id: uid(), role: "spark", text: replyText }]);

        if (data.audio) speakReply(data.audio);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "spark", text: err.message || "Spark couldn't reach the backend just now.", isError: true },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSend(inputValue);
  }

  return (
    <div
      className="fixed bottom-6 right-6 z-50"
      style={{ position: "fixed", bottom: 24, right: 24, zIndex: 50, fontFamily: C.F }}
    >
      {open && (
        <div
          className="bg-zinc-950/95 border border-indigo-500/30 backdrop-blur-xl rounded-2xl shadow-2xl"
          style={{
            width: 360,
            maxWidth: "92vw",
            height: 480,
            marginBottom: 12,
            background: C.bg,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: `0 20px 60px rgba(0,0,0,0.55), 0 0 40px ${C.indigo}22`,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <StatusPulse active={listening || speaking} color={speaking ? C.cyan : C.indigo} />
              <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, color: C.text }}>SPARK OS HUD</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Collapse Spark HUD"
              style={{
                background: "transparent",
                border: "none",
                color: C.textMd,
                cursor: "pointer",
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          {micError && (
            <div style={{ padding: "8px 14px", fontSize: 10, color: C.rose, borderBottom: `1px solid ${C.border}` }}>
              {micError}
            </div>
          )}

          {/* Chat history */}
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ fontSize: 11, color: C.textDim, textAlign: "center", marginTop: 20, lineHeight: 1.6 }}>
                Say "Hey Spark" or type a question below.
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "9px 12px",
                  borderRadius: 12,
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: m.isError ? C.rose : C.text,
                  background: m.role === "user" ? `${C.indigo}22` : C.panel,
                  border: `1px solid ${m.isError ? "rgba(251,113,133,0.35)" : C.border}`,
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}>
                <StatusPulse active color={C.cyan} small />
                <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>Spark is querying the brokerage…</span>
              </div>
            )}
          </div>

          {/* Quick prompts */}
          <div style={{ display: "flex", gap: 6, padding: "0 12px 10px", flexWrap: "wrap" }}>
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                disabled={loading}
                style={{
                  fontSize: 10,
                  color: C.cyan,
                  background: "transparent",
                  border: `1px solid ${C.border}`,
                  borderRadius: 999,
                  padding: "5px 10px",
                  cursor: loading ? "default" : "pointer",
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input row */}
          <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, padding: "10px 12px 14px", borderTop: `1px solid ${C.border}` }}>
            <button
              type="button"
              onClick={toggleMic}
              aria-label="Toggle microphone"
              style={{
                width: 34,
                height: 34,
                flexShrink: 0,
                borderRadius: "50%",
                border: `1px solid ${listening ? C.cyan : C.border}`,
                background: listening ? `${C.cyan}22` : "transparent",
                color: listening ? C.cyan : C.textMd,
                cursor: "pointer",
                fontSize: 14,
              }}
              title={listening ? "Listening — click to mute" : "Click to talk"}
            >
              🎙
            </button>
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask Spark…"
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.04)",
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: "8px 10px",
                color: C.text,
                fontSize: 12,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              style={{
                border: `1px solid ${C.borderStrong}`,
                background: "transparent",
                color: C.indigo,
                borderRadius: 10,
                padding: "0 14px",
                fontSize: 11,
                fontWeight: 800,
                cursor: loading ? "default" : "pointer",
                opacity: loading || !inputValue.trim() ? 0.5 : 1,
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}

      {/* Toggle button */}
      <button
        className="bg-zinc-950/95 border border-indigo-500/30 backdrop-blur-xl"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginLeft: "auto",
          background: C.bg,
          border: `1px solid ${open ? C.borderStrong : C.border}`,
          borderRadius: 999,
          padding: "10px 16px",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: `0 8px 30px rgba(0,0,0,0.5), 0 0 24px ${C.indigo}1a`,
          cursor: "pointer",
        }}
      >
        <StatusPulse active={listening || speaking} color={speaking ? C.cyan : C.indigo} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.text }}>SPARK OS HUD</span>
      </button>
    </div>
  );
}

// Glowing cyan/indigo pulse — solid while idle-listening, animated ripple
// while Spark is actually speaking (audio playback in progress).
function StatusPulse({ active, color, small }: { active: boolean; color: string; small?: boolean }) {
  const size = small ? 6 : 8;
  return (
    <span style={{ position: "relative", display: "inline-flex", width: size, height: size }}>
      {active && (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: color,
            opacity: 0.6,
            animation: "spark-hud-ping 1.1s cubic-bezier(0,0,0.2,1) infinite",
          }}
        />
      )}
      <span style={{ position: "relative", width: size, height: size, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
      <style>{`
        @keyframes spark-hud-ping {
          0% { transform: scale(1); opacity: 0.6; }
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </span>
  );
}
