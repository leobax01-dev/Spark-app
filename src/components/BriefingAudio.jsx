// src/components/BriefingAudio.jsx — the 8am spoken-briefing player.
//
// Lives in the consolidated Autopilot header, so it is its own module rather
// than an export from CommandMatrix (a non-component export there breaks
// react-refresh's fast-refresh boundary).
//
// Volume note: the Web Speech API has no live volume control on an in-flight
// utterance, so muting mid-sentence has to cancel and restart it.
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
const HAIRLINE = "#27272a";
const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

// Carried here rather than left in CommandMatrix's style block — this now
// renders in the Autopilot header, outside the Matrix body, so it cannot
// rely on the Matrix having mounted its keyframes.
const AUDIO_KEYFRAMES = `@keyframes cmBar{0%,100%{transform:scaleY(.22)}50%{transform:scaleY(1)}}`;

export default function BriefingAudio({ text, compact }) {
  const [state, setState] = useState("idle"); // idle | playing | paused
  const [muted, setMuted] = useState(false);
  const [supported, setSupported] = useState(true);
  const synthRef = useRef(null);
  const uttRef = useRef(null);

  useEffect(() => {
    const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
    synthRef.current = synth;
    setSupported(!!synth);
    return () => { try { synth?.cancel(); } catch { /* nothing playing */ } };
  }, []);

  const speak = useCallback(() => {
    const synth = synthRef.current;
    if (!synth || !text) return;
    synth.cancel();
    const clean = String(text)
      .replace(/\*\*(.*?)\*\*/g, "$1").replace(/[#*_`>]/g, "")
      .replace(/\n+/g, ". ").slice(0, 1400);
    const utt = new SpeechSynthesisUtterance(clean);
    utt.rate = 0.98; utt.pitch = 1; utt.volume = muted ? 0 : 1;
    const voices = synth.getVoices() || [];
    const preferred = voices.find((v) =>
      /Samantha|Google US English|Microsoft Aria|Alex/.test(v.name));
    if (preferred) utt.voice = preferred;
    utt.onend = () => setState("idle");
    utt.onerror = () => setState("idle");
    uttRef.current = utt;
    synth.speak(utt);
    setState("playing");
  }, [text, muted]);

  const toggle = useCallback(() => {
    const synth = synthRef.current;
    if (!synth) return;
    if (state === "playing") { synth.pause(); setState("paused"); return; }
    if (state === "paused") { synth.resume(); setState("playing"); return; }
    speak();
  }, [state, speak]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      // The Web Speech API has no live volume control on an in-flight
      // utterance — muting mid-sentence has to restart it at volume 0.
      if (state === "playing" && uttRef.current) {
        const synth = synthRef.current;
        synth?.cancel();
        setState("idle");
      }
      return next;
    });
  }, [state]);

  const playing = state === "playing";

  return (
    <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
      display: "flex", alignItems: "center", gap: 10, flexShrink: 0,
      padding: compact ? "7px 10px" : "8px 12px", borderRadius: 12,
      background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
      border: `1px solid ${HAIRLINE}`,
    }}>
      <style>{AUDIO_KEYFRAMES}</style>
      <button onClick={toggle} disabled={!supported || !text} title={supported ? "Play the 8am briefing" : "Speech synthesis unavailable in this browser"}
        style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          background: playing ? `${PURPLE}22` : `#8b5cf6`,
          border: `1px solid ${PURPLE}88`, color: "#fff",
          cursor: supported && text ? "pointer" : "not-allowed",
          opacity: supported && text ? 1 : 0.45,
          boxShadow: "none",
        }}>
        {playing ? <Pause size={13} /> : <Play size={13} />}
      </button>

      {/* Visualizer — animates only while actually speaking. */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2.5, height: 18, width: 46, flexShrink: 0 }}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <span key={i} style={{
            flex: 1, borderRadius: 1, background: playing ? PURPLE_LT : "rgba(148,163,184,0.28)",
            height: playing ? "100%" : 3,
            transformOrigin: "bottom",
            animation: playing ? `cmBar 0.9s ease-in-out ${i * 0.09}s infinite` : "none",
            boxShadow: "none",
          }} />
        ))}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase",
        }}>8AM Audio Briefing</div>
        <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: playing ? PURPLE_LT : SLATE, whiteSpace: "nowrap" }}>
          {!supported ? "UNAVAILABLE IN THIS BROWSER" : !text ? "NO BRIEFING YET"
            : playing ? "TRANSMITTING…" : state === "paused" ? "PAUSED" : "READY"}
        </div>
      </div>

      <button onClick={toggleMute} disabled={!supported}
        title={muted ? "Unmute briefing" : "Mute briefing"}
        style={{
          background: "transparent", border: "none", padding: 0, flexShrink: 0,
          color: muted ? SLATE_DIM : CYAN, cursor: supported ? "pointer" : "not-allowed",
        }}>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
    </div>
  );
}
