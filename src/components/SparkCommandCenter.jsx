// src/components/SparkCommandCenter.jsx
//
// SPARK OS Command Center — Elite Military OS / alien-tech HUD, voiced by
// "Alfred": a refined, unfailingly polite AI chief of staff (modeled on
// Bruce Wayne's butler) who always addresses the operator as "Mr. Bax".
//
// This file is the composition root; the actual visual/interactive pieces
// live in src/components/command-center/:
//   AgentCore.jsx        — shader-driven nebula core (idle/thinking/error/success)
//   ArrTrajectoryMap.jsx — radial ARR "star chart" (center=$0, rim=target)
//   VitalDrilldown.jsx   — tap-to-materialize seat/token-usage detail overlay
//   HexPanel.jsx          — angular glowing-border panel shell
//   PipelineHex.jsx        — clickable hex pipeline-count modules
//   TaskDrawer.jsx         — holographic full-screen task manifest + APPROVE
//   CommandInput.jsx       — typed direct-command field -> intent router
//   LiveFeed.jsx            — per-agent colorized decoding feed
//   ScanlineOverlay.jsx      — CRT/hologram post-process look
//   TypewriterText.jsx        — decode-on-load text effect
//   theme.js                   — shared palette
// ../hooks/useSynthSound.js — WebAudio UI blips (no audio files)
//
// Center: the Agent Core pulses with voice audio amplitude and reacts to
// system state (thinking/error/success). Left: system vitals — ARR gets the
// radial trajectory map, seats/white-label are tappable for drilldowns.
// Right: Command Deck quick actions + Direct Command Input, both filing
// real tasks into the Supabase `spark_os_tasks` table via /api/tasks.
// Bottom: a live, per-agent colorized feed from SPARK_OS/05-Daily-Briefings/.
//
// Voice, two paths (unchanged from the prior revision):
//   1. Hold-to-talk: the mic button records real audio, sent to /api/voice
//      { action: "command" } for ElevenLabs speech-to-text.
//   2. Hands-Free Mode: a continuous Web Speech API listener watches for
//      "Hey Alfred" / "Alfred" / "Excuse me Alfred", then sends the
//      already-transcribed text to /api/voice { action: "text-command" }.
// Both route through api/voice.js's intent classifier (CFO/CTO/CMO/CRO/CEO)
// and return an in-character Alfred line spoken via ElevenLabs TTS.

import { useEffect, useRef, useState, useCallback } from "react";
import AgentCore, { useCoreState } from "./command-center/AgentCore";
import ArrTrajectoryMap from "./command-center/ArrTrajectoryMap";
import VitalDrilldown from "./command-center/VitalDrilldown";
import HexPanel from "./command-center/HexPanel";
import PipelineHex from "./command-center/PipelineHex";
import TaskDrawer from "./command-center/TaskDrawer";
import CommandInput from "./command-center/CommandInput";
import LiveFeed from "./command-center/LiveFeed";
import ScanlineOverlay from "./command-center/ScanlineOverlay";
import TypewriterText from "./command-center/TypewriterText";
import { C } from "./command-center/theme";
import { useSynthSound } from "../hooks/useSynthSound";

const ARR_CONSERVATIVE_TARGET = 4_020_000;

// ── Small UI atoms ─────────────────────────────────────────────────────────
function PanelLabel({ children, color = C.cyan }) {
  // Static section chrome, not live data — the decode/typewriter effect is
  // reserved for values that actually load or update (ARR, core status,
  // feed entries below). Animating fixed labels on every render both looks
  // like a bug (a permanently-scrambled tail under WebGL frame contention)
  // and buys nothing, since the text never changes.
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 14 }}>
      <div style={{ width: 3, height: 12, borderRadius: 2, background: color, boxShadow: `0 0 8px ${color}` }} />
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color, fontFamily: C.F }}>{children}</span>
    </div>
  );
}

function VitalBar({ label, value, max, color, formatValue, onClick }) {
  const pct = Math.min(100, max ? (value / max) * 100 : 0);
  return (
    <div
      onClick={onClick}
      style={{ marginBottom: 16, cursor: onClick ? "pointer" : "default" }}
      className={onClick ? "cc-vital-tap" : ""}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.textMd, fontFamily: C.F }}>{label}</span>
        <span style={{ fontSize: 11, color: C.text, fontFamily: C.F, fontWeight: 700 }}>
          {formatValue ? formatValue(value) : value}
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg,${color}80,${color})`,
            boxShadow: `0 0 8px ${color}80`,
            transition: "width .6s ease",
          }}
        />
      </div>
    </div>
  );
}

function CommandButton({ label, sub, color, onClick, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        width: "100%",
        textAlign: "left",
        background: C.panel,
        border: `1px solid ${C.panelBorder}`,
        borderRadius: 3,
        padding: "12px 14px",
        marginBottom: 10,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "all .18s ease",
      }}
      className="scc-cmd-btn"
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = color)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.panelBorder)}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: C.F }}>
        {busy ? "Filing task…" : label}
      </div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.F, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SparkCommandCenter() {
  const [status, setStatus] = useState("booting"); // booting -> online
  const [bootPct, setBootPct] = useState(0);
  const [vitals, setVitals] = useState(null);
  const [feed, setFeed] = useState([]);
  const [busyAction, setBusyAction] = useState(null);
  const [voiceState, setVoiceState] = useState("idle"); // idle | recording | thinking | speaking
  const [voiceLog, setVoiceLog] = useState(null);
  const [voiceError, setVoiceError] = useState(null);
  const [handsFree, setHandsFree] = useState(false);
  const [hfStatus, setHfStatus] = useState("listening");
  const [drawerStatus, setDrawerStatus] = useState(null); // "Pending" | "Needs_Approval" | "Completed" | null
  const [drilldown, setDrilldown] = useState(null); // "seats" | "tokens" | null
  const [glitch, setGlitch] = useState(false);

  const sound = useSynthSound();

  const pulseRef = useRef(0);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recognitionRef = useRef(null);
  const handsFreeRef = useRef(false);
  const hfStatusRef = useRef("listening");
  const captureBufferRef = useRef("");
  const silenceTimerRef = useRef(null);

  const { coreState, triggerSuccessFlash } = useCoreState({
    voiceState,
    hfStatus,
    handsFree,
    hasError: Boolean(voiceError),
  });

  function flashGlitch() {
    setGlitch(true);
    setTimeout(() => setGlitch(false), 400);
  }

  // Boot sequence
  useEffect(() => {
    const id = setInterval(() => {
      setBootPct((p) => {
        if (p >= 100) {
          clearInterval(id);
          setStatus("online");
          return 100;
        }
        return p + Math.random() * 18;
      });
    }, 140);
    return () => clearInterval(id);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) return;
      const data = await res.json();
      setVitals(data);
      setFeed(data.briefings || []);
    } catch {
      // Command Center degrades gracefully with no live data (e.g. local dev
      // without `vercel dev` running api/ routes) — HUD still renders.
    }
  }, []);

  useEffect(() => {
    loadData();
    const id = setInterval(loadData, 30000);
    return () => clearInterval(id);
  }, [loadData]);

  async function runCommand(title, owner, body) {
    setBusyAction(title);
    sound.hexClick();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, owner, body, source: "command-deck" }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        triggerSuccessFlash();
      } else {
        sound.error();
      }
      return data;
    } catch (err) {
      sound.error();
      return { error: err.message };
    } finally {
      setBusyAction(null);
    }
  }

  // ── Voice: record -> /api/voice command -> /api/voice speak -> pulse ────
  function stopPulseLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pulseRef.current = 0;
  }

  function triggerWakePulse() {
    stopPulseLoop();
    const start = performance.now();
    const duration = 900;
    function tick(now) {
      const t = (now - start) / duration;
      if (t >= 1) {
        pulseRef.current = 0;
        return;
      }
      pulseRef.current = Math.sin(t * Math.PI);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function startPulseLoopFromAudioElement(audioEl) {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaElementSource(audioEl);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        pulseRef.current = Math.min(1, avg / 90);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Web Audio graph can fail silently cross-origin/blocked contexts —
      // audio still plays, the core just won't pulse to it.
    }
  }

  async function speak(text) {
    setVoiceState("speaking");
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "TTS failed");
      if (data.audioBase64) setVoiceError(null);
      const audioEl = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      startPulseLoopFromAudioElement(audioEl);
      audioEl.onended = () => {
        stopPulseLoop();
        setVoiceState("idle");
        triggerSuccessFlash();
      };
      await audioEl.play();
    } catch (err) {
      setVoiceError(err.message);
      setVoiceState("idle");
      sound.error();
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const audioBase64 = reader.result.split(",")[1];
          setVoiceState("thinking");
          try {
            const res = await fetch("/api/voice", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "command", audioBase64, mimeType: "audio/webm" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Voice command failed");
            setVoiceLog(data);
            setVoiceError(null);
            if (data.mode === "task") await loadData();
            await speak(data.spoken);
          } catch (err) {
            setVoiceError(err.message);
            setVoiceState("idle");
            sound.error();
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setVoiceState("recording");
    } catch (err) {
      setVoiceError("Microphone access denied or unavailable: " + err.message);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  // ── Hands-Free Mode: continuous wake-word listener ("Hey Alfred") ───────
  const WAKE_RE = /(hey\s+alfred|excuse me,?\s+alfred|alfred)/i;

  function getRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    if (!recognitionRef.current) {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      rec.onresult = (e) => {
        let finalText = "";
        let interimText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + " ";
          else interimText += r[0].transcript;
        }
        const combined = (finalText + " " + interimText).trim();
        if (!combined) return;

        if (hfStatusRef.current === "listening") {
          const match = combined.match(WAKE_RE);
          if (match) {
            hfStatusRef.current = "capturing";
            setHfStatus("capturing");
            triggerWakePulse();
            captureBufferRef.current = combined.slice(match.index + match[0].length).trim();
            resetSilenceTimer();
          }
        } else if (hfStatusRef.current === "capturing") {
          captureBufferRef.current = combined.replace(WAKE_RE, "").trim();
          resetSilenceTimer();
        }
      };

      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setVoiceError("Microphone access denied for Hands-Free Mode.");
          setHandsFree(false);
          handsFreeRef.current = false;
        }
      };

      rec.onend = () => {
        if (handsFreeRef.current && hfStatusRef.current !== "thinking" && hfStatusRef.current !== "speaking") {
          try {
            rec.start();
          } catch {
            // already started — ignore
          }
        }
      };

      recognitionRef.current = rec;
    }
    return recognitionRef.current;
  }

  function resetSilenceTimer() {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(dispatchCapturedCommand, 1400);
  }

  async function dispatchCapturedCommand() {
    const text = captureBufferRef.current.trim();
    captureBufferRef.current = "";
    if (!text) {
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      return;
    }

    hfStatusRef.current = "thinking";
    setHfStatus("thinking");
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }

    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "text-command", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      setVoiceLog(data);
      setVoiceError(null);
      if (data.mode === "task") await loadData();

      hfStatusRef.current = "speaking";
      setHfStatus("speaking");
      await speak(data.spoken);
    } catch (err) {
      setVoiceError(err.message);
      sound.error();
    } finally {
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      if (handsFreeRef.current) {
        try {
          recognitionRef.current?.start();
        } catch {
          // already started — ignore
        }
      }
    }
  }

  function toggleHandsFree() {
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    sound.hexClick();

    if (next) {
      const rec = getRecognition();
      if (!rec) {
        setHfStatus("unsupported");
        setVoiceError("Hands-Free Mode needs a browser with Web Speech API support (e.g. Chrome).");
        setHandsFree(false);
        handsFreeRef.current = false;
        return;
      }
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      captureBufferRef.current = "";
      try {
        rec.start();
      } catch {
        // already running — ignore
      }
    } else {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      hfStatusRef.current = "listening";
      setHfStatus("listening");
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    }
  }

  useEffect(
    () => () => {
      stopPulseLoop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    },
    []
  );

  function openDrawer(statusKey) {
    sound.hexClick();
    setDrawerStatus(statusKey);
  }

  function openDrilldown(kind) {
    sound.hexClick();
    setDrilldown(kind);
  }

  const arr = vitals?.financial?.arr ?? 0;
  const soloSeats = vitals?.financial?.soloSeats ?? 0;
  const whiteLabelDeals = vitals?.financial?.whiteLabelDeals ?? 0;
  const target = vitals?.financial?.arrConservativeTarget ?? ARR_CONSERVATIVE_TARGET;
  const panelPulse = coreState === "thinking" ? 0.7 : coreState === "success" ? 1 : coreState === "error" ? 0.9 : 0.15;

  const DRAWER_META = {
    Pending: { label: "Pending", color: C.amber },
    Needs_Approval: { label: "Needs Approval", color: C.rose },
    Completed: { label: "Completed", color: C.emerald },
  };

  return (
    <div style={{ height: "100vh", background: C.bg, fontFamily: C.F, color: C.text, position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <style>{`
        .scc-cmd-btn:hover { background: rgba(255,255,255,0.05) !important; }
        .scc-mic:hover { transform: scale(1.06); }
        .scc-hf-toggle:hover span:first-child { color: rgba(255,255,255,0.7) !important; }
        .scc-mic:active { transform: scale(0.96); }
        .cc-pipeline-hex:hover { transform: scale(1.04); }
        .cc-vital-tap:hover { filter: brightness(1.3); }
        @keyframes scc-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      <ScanlineOverlay glitch={glitch} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: `1px solid ${C.panelBorder}`, position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: status === "online" ? C.emerald : C.amber, boxShadow: `0 0 10px ${status === "online" ? C.emerald : C.amber}`, animation: status !== "online" ? "scc-blink 1s infinite" : "none" }} />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3 }}>SPARK OS — COMMAND CENTER</span>
          <span style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, borderLeft: `1px solid ${C.panelBorder}`, paddingLeft: 10 }}>
            VOICED BY ALFRED
          </span>
        </div>
        <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
          {new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 320px", gap: 14, flex: 1, minHeight: 0, padding: 14, position: "relative", zIndex: 10 }}>
        {/* LEFT — System Vitals */}
        <HexPanel accent={C.emerald} pulse={panelPulse} contentStyle={{ padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.emerald}>SYSTEM VITALS</PanelLabel>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <ArrTrajectoryMap arr={arr} target={target} />
          </div>

          <VitalBar
            label="Active Subscriber Seats (tap for slice)"
            value={soloSeats}
            max={Math.max(soloSeats, 20)}
            color={C.indigo}
            formatValue={(v) => `${v}`}
            onClick={() => openDrilldown("seats")}
          />
          <VitalBar
            label="Agent Token Usage (tap for histogram)"
            value={0}
            max={1}
            color={C.violet}
            formatValue={() => "—"}
            onClick={() => openDrilldown("tokens")}
          />

          <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.panelBorder}` }}>
            <PanelLabel color={C.cyan}>TASK PIPELINE</PanelLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <PipelineHex label="Pending" count={vitals?.counts?.pending ?? "—"} color={C.amber} onClick={() => openDrawer("Pending")} />
              <PipelineHex label="Needs Appr." count={vitals?.counts?.needsApproval ?? "—"} color={C.rose} onClick={() => openDrawer("Needs_Approval")} />
              <PipelineHex label="Completed" count={vitals?.counts?.completed ?? "—"} color={C.emerald} onClick={() => openDrawer("Completed")} />
            </div>
          </div>
        </HexPanel>

        {/* CENTER — Agent Core. Strict vertical flow: label -> core -> mic. */}
        <HexPanel accent={coreState === "error" ? C.rose : coreState === "thinking" ? C.violet : C.cyan} pulse={panelPulse} contentStyle={{ display: "flex", flexDirection: "column", alignItems: "center", overflowY: "auto", padding: "12px 0" }}>
          <div style={{ position: "relative", width: "100%", height: "min(50vh, 460px)", flexShrink: 0 }}>
            <div style={{ position: "absolute", inset: 0 }}>
              <AgentCore coreState={status === "online" ? coreState : "idle"} pulseRef={pulseRef} />
            </div>

            <div style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", textAlign: "center" }}>
              {/* Plain text, not the decode effect: this line changes on
                  every state transition (idle/thinking/error/success) right
                  next to a continuously-rendering WebGL canvas, and under
                  that render-loop contention the animation was visibly
                  lagging — a live status readout should never look stuck
                  mid-glitch. */}
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: status === "online" ? C.cyan : C.textDim, display: "block" }}>
                AGENT CORE: {status === "online" ? coreState.toUpperCase() : "INITIALIZING"}
              </span>
              {status !== "online" && (
                <div style={{ width: 160, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", margin: "8px auto 0", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, bootPct)}%`, height: "100%", background: C.cyan, transition: "width .15s linear" }} />
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, flexShrink: 0, padding: "4px 0 24px" }}>
            <button
              className="scc-mic"
              onMouseDown={!handsFree ? startRecording : undefined}
              onMouseUp={!handsFree ? stopRecording : undefined}
              onTouchStart={!handsFree ? startRecording : undefined}
              onTouchEnd={!handsFree ? stopRecording : undefined}
              disabled={handsFree || voiceState === "thinking" || voiceState === "speaking"}
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: `2px solid ${voiceState === "recording" ? C.rose : C.cyan}`,
                background: voiceState === "recording" ? "rgba(239,68,68,0.15)" : "rgba(56,240,255,0.08)",
                color: voiceState === "recording" ? C.rose : C.cyan,
                fontSize: 20,
                cursor: handsFree ? "default" : "pointer",
                opacity: handsFree ? 0.35 : 1,
                transition: "transform .15s ease, opacity .2s ease",
                boxShadow: `0 0 20px ${voiceState === "recording" ? "rgba(239,68,68,0.4)" : "rgba(56,240,255,0.25)"}`,
                flexShrink: 0,
              }}
              title={handsFree ? "Disabled while Hands-Free Mode is on" : "Hold to speak to Alfred"}
            >
              🎙
            </button>
            <span style={{ fontSize: 9, letterSpacing: 1.5, color: C.textDim, textTransform: "uppercase" }}>
              {handsFree
                ? { listening: "Alfred is listening for \"Hey Alfred\"…", capturing: "Listening, Mr. Bax…", thinking: "One moment, Mr. Bax…", speaking: "Alfred is responding…", unsupported: "Hands-Free unsupported" }[hfStatus]
                : { idle: "Hold to speak to Alfred", recording: "Listening…", thinking: "Transcribing…", speaking: "Alfred is responding…" }[voiceState]}
            </span>

            <button
              onClick={toggleHandsFree}
              className="scc-hf-toggle"
              style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", padding: "4px 2px" }}
              title="Toggle Hands-Free Mode — continuously listen for &quot;Hey Alfred&quot;"
            >
              <span style={{ fontSize: 9, letterSpacing: 1.2, color: handsFree ? C.emerald : C.textDim, textTransform: "uppercase", fontWeight: 700 }}>
                Hands-Free Mode
              </span>
              <span
                style={{
                  width: 30,
                  height: 16,
                  borderRadius: 10,
                  background: handsFree ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)",
                  border: `1px solid ${handsFree ? C.emerald : C.panelBorder}`,
                  position: "relative",
                  transition: "background .2s ease",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: handsFree ? 15 : 1,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: handsFree ? C.emerald : C.textDim,
                    boxShadow: handsFree ? `0 0 6px ${C.emerald}` : "none",
                    transition: "left .18s ease",
                  }}
                />
              </span>
            </button>

            {voiceLog?.transcript && (
              <div style={{ fontSize: 10, color: C.textMd, maxWidth: 280, textAlign: "center" }}>"{voiceLog.transcript}"</div>
            )}
            {voiceLog?.mode === "task" && voiceLog?.agentLabel && (
              <div style={{ fontSize: 9, color: C.violet, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700 }}>
                Routed to {voiceLog.agentLabel} · {voiceLog.priority} priority
              </div>
            )}
            {voiceLog?.spoken && (
              <div style={{ fontSize: 10, color: C.cyan, maxWidth: 280, textAlign: "center", fontStyle: "italic" }}>Alfred: "{voiceLog.spoken}"</div>
            )}
            {voiceError && <div style={{ fontSize: 10, color: C.rose, maxWidth: 280, textAlign: "center" }}>{voiceError}</div>}
          </div>
        </HexPanel>

        {/* RIGHT — Command Deck + Direct Command Input */}
        <HexPanel accent={C.indigo} pulse={panelPulse} contentStyle={{ padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.indigo}>COMMAND DECK</PanelLabel>
          <CommandButton
            label="Run Daily Briefing"
            sub="CEO Agent — compile status across all agents"
            color={C.indigo}
            busy={busyAction === "Run Daily Briefing"}
            onClick={() => runCommand("Run Daily Briefing", "CEO", "Compile the daily standup: shipped, pending, needs-approval, blocked, and ARR trajectory across all executive agents.")}
          />
          <CommandButton
            label="Financial Audit"
            sub="CFO Agent — reconcile MRR/ARR vs. target"
            color={C.emerald}
            busy={busyAction === "Financial Audit"}
            onClick={() => runCommand("Financial Audit", "CFO", "Reconcile 04-Memory/Financial_Metrics.md against current Stripe data; flag variance from the $4.02M Conservative ARR target.")}
          />
          <CommandButton
            label="Audit Multi-Tenancy RLS"
            sub="CTO Agent — verify brokerage_id isolation"
            color={C.violet}
            busy={busyAction === "Audit Multi-Tenancy RLS"}
            onClick={() => runCommand("Audit Multi-Tenancy RLS", "CTO", "Verify Supabase RLS policies isolate all tenant-scoped tables by brokerage_id/team_id; confirm live policy state via dashboard or supabase db pull.")}
          />

          <CommandInput onDispatched={loadData} sound={sound} />
        </HexPanel>
      </div>

      {/* BOTTOM — Live Execution Feed */}
      <div style={{ padding: "0 14px 14px", position: "relative", zIndex: 10 }}>
        <HexPanel accent={C.amber} pulse={panelPulse * 0.6} contentStyle={{ padding: "14px 24px" }}>
          <PanelLabel color={C.amber}>LIVE EXECUTION FEED — SPARK_OS/05-Daily-Briefings/</PanelLabel>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            <LiveFeed feed={feed} />
          </div>
        </HexPanel>
      </div>

      {drawerStatus && DRAWER_META[drawerStatus] && (
        <TaskDrawer
          status={drawerStatus}
          label={DRAWER_META[drawerStatus].label}
          color={DRAWER_META[drawerStatus].color}
          onClose={() => setDrawerStatus(null)}
          onApproved={() => {
            flashGlitch();
            triggerSuccessFlash();
            loadData();
          }}
          sound={sound}
          playGlitch={flashGlitch}
        />
      )}

      <VitalDrilldown
        kind={drilldown}
        data={{ soloSeats, whiteLabelDeals }}
        onClose={() => setDrilldown(null)}
      />
    </div>
  );
}
