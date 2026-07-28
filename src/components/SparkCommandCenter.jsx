// src/components/SparkCommandCenter.jsx
//
// SPARK OS Command Center — "Cosmic Star System / Elite Neural Void."
// Alfred is the central Sun/core of a living 3D solar system; the four
// C-Suite agents (CEO/CMO/CTO/CFO) orbit him as planets, tethered by lines
// of light that pulse when a task actually moves in Supabase.
//
// This file is the composition root; the actual pieces live in
// src/components/command-center/:
//   StarSystem.jsx        — the 3D solar system (Sun=Alfred, 4 planets, tethers)
//   AgentCore.jsx          — the shader-driven nebula core StarSystem uses as the Sun
//   AgentDossier.jsx        — glassmorphic slide-out panel for a clicked planet
//   CommandLogsDrawer.jsx    — frosted-glass slide-over hiding the daily briefings
//   GlassPanel.jsx             — deep-glass container (no solid borders)
//   ArrTrajectoryMap.jsx        — radial ARR "star chart"
//   VitalDrilldown.jsx           — tap-to-materialize seat/token detail overlay
//   PipelineHex.jsx                — clickable hex pipeline-count modules
//   TaskDrawer.jsx                   — holographic task manifest + APPROVE
//   CommandInput.jsx                   — typed command/question field
//   LiveFeed.jsx, TypewriterText.jsx, ScanlineOverlay.jsx, theme.js
// ../hooks/useSynthSound.js — WebAudio UI blips (no audio files)
//
// Voice is now invisible by design: there is no mic button and no mode
// toggle anywhere in this file. A Web Speech API listener starts silently
// on mount and stays on for the component's lifetime, waiting for "Hey
// Alfred" / "Alfred" / "Excuse me Alfred". On wake, a glowing ring
// materializes around the Sun; the captured utterance is sent to
// /api/alfred-brain (Alfred's Neural Cortex), which autonomously decides
// whether it's a question (answered conversationally from real Supabase
// task data), a quick briefing request, or a directive (filed as a task —
// which fires a pulse of light down that agent's tether). The response is
// always spoken aloud via ElevenLabs (/api/voice, action "speak").

import { useEffect, useRef, useState, useCallback } from "react";
import { useCoreState } from "./command-center/AgentCore";
import StarSystem from "./command-center/StarSystem";
import ArrTrajectoryMap from "./command-center/ArrTrajectoryMap";
import VitalDrilldown from "./command-center/VitalDrilldown";
import GlassPanel from "./command-center/GlassPanel";
import PipelineHex from "./command-center/PipelineHex";
import TaskDrawer from "./command-center/TaskDrawer";
import CommandInput from "./command-center/CommandInput";
import AgentDossier from "./command-center/AgentDossier";
import CommandLogsDrawer from "./command-center/CommandLogsDrawer";
import ScanlineOverlay from "./command-center/ScanlineOverlay";
import TypewriterText from "./command-center/TypewriterText";
import { C } from "./command-center/theme";
import { useSynthSound } from "../hooks/useSynthSound";

const ARR_CONSERVATIVE_TARGET = 4_020_000;
const WAKE_RE = /(hey\s+alfred|excuse me,?\s+alfred|alfred)/i;

// ── Small UI atoms ─────────────────────────────────────────────────────────
function PanelLabel({ children, color = C.cyan }) {
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
    <div onClick={onClick} style={{ marginBottom: 16, cursor: onClick ? "pointer" : "default" }} className={onClick ? "cc-vital-tap" : ""}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: C.textMd, fontFamily: C.F }}>{label}</span>
        <span style={{ fontSize: 11, color: C.text, fontFamily: C.F, fontWeight: 700 }}>{formatValue ? formatValue(value) : value}</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg,${color}80,${color})`, boxShadow: `0 0 8px ${color}80`, transition: "width .6s ease" }} />
      </div>
    </div>
  );
}

function CommandButton({ label, sub, color, onClick, busy }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="scc-cmd-btn"
      style={{
        width: "100%",
        textAlign: "left",
        background: "rgba(255,255,255,0.03)",
        border: "none",
        boxShadow: `0 0 0 1px rgba(255,255,255,0.06) inset`,
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 10,
        cursor: busy ? "default" : "pointer",
        opacity: busy ? 0.6 : 1,
        transition: "all .18s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = `0 0 0 1px ${color}66 inset, 0 0 16px ${color}22`)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = `0 0 0 1px rgba(255,255,255,0.06) inset`)}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: C.F }}>{busy ? "Filing task…" : label}</div>
      <div style={{ fontSize: 10, color: C.textDim, fontFamily: C.F, marginTop: 2 }}>{sub}</div>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function SparkCommandCenter() {
  const [status, setStatus] = useState("booting");
  const [bootPct, setBootPct] = useState(0);
  const [vitals, setVitals] = useState(null);
  const [feed, setFeed] = useState([]);
  const [busyAction, setBusyAction] = useState(null);
  const [voiceError, setVoiceError] = useState(null);
  const [ring, setRing] = useState(false); // wake word heard, capturing utterance
  const [thinking, setThinking] = useState(false); // dispatched, awaiting brain response
  const [drawerStatus, setDrawerStatus] = useState(null);
  const [drilldown, setDrilldown] = useState(null);
  const [glitch, setGlitch] = useState(false);
  const [focusedAgent, setFocusedAgent] = useState(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [pulseTriggers, setPulseTriggers] = useState({});
  const [lastSpoken, setLastSpoken] = useState(null);

  const sound = useSynthSound();

  const pulseRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const recognitionRef = useRef(null);
  const ringStatusRef = useRef("listening"); // listening | capturing | thinking
  const captureBufferRef = useRef("");
  const silenceTimerRef = useRef(null);

  const { coreState, triggerSuccessFlash } = useCoreState({ thinking, hasError: Boolean(voiceError) });

  function flashGlitch() {
    setGlitch(true);
    setTimeout(() => setGlitch(false), 400);
  }

  function firePulse(agentKey) {
    if (!agentKey) return;
    setPulseTriggers((p) => ({ ...p, [agentKey]: (p[agentKey] || 0) + 1 }));
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

  async function runCommand(title, ownerKey, body) {
    setBusyAction(title);
    sound.hexClick();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, owner: ownerKey, body, source: "command-deck" }),
      });
      const data = await res.json();
      if (res.ok) {
        await loadData();
        triggerSuccessFlash();
        firePulse(ownerKey);
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

  // ── Audio pulse (drives the Sun's reactivity to Alfred's own voice) ─────
  function stopPulseLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    pulseRef.current = 0;
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
      // audio still plays, the Sun just won't pulse to it.
    }
  }

  const speak = useCallback(async (text) => {
    if (!text) return;
    setThinking(true);
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "speak", text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "TTS failed");
      setVoiceError(null);
      setLastSpoken(text);
      const audioEl = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
      startPulseLoopFromAudioElement(audioEl);
      audioEl.onended = () => {
        stopPulseLoop();
        setThinking(false);
        triggerSuccessFlash();
      };
      await audioEl.play();
    } catch (err) {
      setVoiceError(err.message);
      setThinking(false);
      sound.error();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Always-on "Hey Alfred" wake-word listener — no button, no toggle ────
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

        if (ringStatusRef.current === "listening") {
          const match = combined.match(WAKE_RE);
          if (match) {
            ringStatusRef.current = "capturing";
            setRing(true);
            captureBufferRef.current = combined.slice(match.index + match[0].length).trim();
            resetSilenceTimer();
          }
        } else if (ringStatusRef.current === "capturing") {
          captureBufferRef.current = combined.replace(WAKE_RE, "").trim();
          resetSilenceTimer();
        }
      };

      rec.onerror = (e) => {
        if (e.error === "no-speech" || e.error === "aborted") return;
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setVoiceError("Microphone access was denied — Alfred can't listen for his wake word.");
        }
      };

      rec.onend = () => {
        if (ringStatusRef.current !== "thinking") {
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
    silenceTimerRef.current = setTimeout(dispatchCapturedUtterance, 1400);
  }

  async function dispatchCapturedUtterance() {
    const text = captureBufferRef.current.trim();
    captureBufferRef.current = "";
    setRing(false);
    if (!text) {
      ringStatusRef.current = "listening";
      return;
    }

    ringStatusRef.current = "thinking";
    setThinking(true);
    try {
      recognitionRef.current?.stop();
    } catch {
      // no-op
    }

    try {
      const res = await fetch("/api/alfred-brain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Command failed");
      setVoiceError(null);
      if (data.mode === "task") {
        await loadData();
        firePulse(data.agent);
      }
      await speak(data.spoken);
    } catch (err) {
      setVoiceError(err.message);
      sound.error();
      setThinking(false);
    } finally {
      ringStatusRef.current = "listening";
      try {
        recognitionRef.current?.start();
      } catch {
        // already started — ignore
      }
    }
  }

  // Start listening silently on mount; no UI control anywhere for this.
  useEffect(() => {
    const rec = getRecognition();
    if (!rec) {
      setVoiceError("This browser doesn't support the Web Speech API — Alfred can't listen. Try Chrome.");
      return;
    }
    try {
      rec.start();
    } catch {
      // already running — ignore
    }
    return () => {
      stopPulseLoop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      try {
        recognitionRef.current?.stop();
      } catch {
        // no-op
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDrawer(statusKey) {
    sound.hexClick();
    setDrawerStatus(statusKey);
  }
  function openDrilldown(kind) {
    sound.hexClick();
    setDrilldown(kind);
  }
  function selectPlanet(agentKey) {
    sound.hexClick();
    setFocusedAgent((prev) => (prev === agentKey ? null : agentKey));
  }

  const arr = vitals?.financial?.arr ?? 0;
  const soloSeats = vitals?.financial?.soloSeats ?? 0;
  const whiteLabelDeals = vitals?.financial?.whiteLabelDeals ?? 0;
  const target = vitals?.financial?.arrConservativeTarget ?? ARR_CONSERVATIVE_TARGET;
  const panelPulse = coreState === "thinking" ? 0.7 : coreState === "success" ? 1 : coreState === "error" ? 0.9 : 0.12;

  const DRAWER_META = {
    Pending: { label: "Pending", color: C.amber },
    Needs_Approval: { label: "Needs Approval", color: C.rose },
    Completed: { label: "Completed", color: C.emerald },
  };

  return (
    <div
      style={{
        height: "100vh",
        background: "radial-gradient(ellipse at 50% 30%, #0a1030 0%, #030410 55%, #010103 100%)",
        fontFamily: C.F,
        color: C.text,
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <style>{`
        .scc-cmd-btn { }
        .cc-pipeline-hex:hover { transform: scale(1.04); }
        .cc-vital-tap:hover { filter: brightness(1.3); }
        @keyframes scc-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>

      <ScanlineOverlay glitch={glitch} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 26px", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: status === "online" ? C.emerald : C.amber,
              boxShadow: `0 0 10px ${status === "online" ? C.emerald : C.amber}`,
              animation: status !== "online" ? "scc-blink 1s infinite" : "none",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3 }}>SPARK OS — COSMIC COMMAND</span>
          <span style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, paddingLeft: 10 }}>VOICED BY ALFRED · ALWAYS LISTENING</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {voiceError && (
            <span style={{ fontSize: 9, color: C.rose, maxWidth: 260, textAlign: "right" }}>{voiceError}</span>
          )}
          <button
            onClick={() => setLogsOpen(true)}
            style={{ background: "transparent", border: "none", boxShadow: `0 0 0 1px ${C.amber}44 inset`, color: C.amber, fontFamily: C.F, fontSize: 9, letterSpacing: 1.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
          >
            COMMAND LOGS
          </button>
          <span style={{ fontSize: 10, color: C.textDim, letterSpacing: 1 }}>
            {new Date().toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr 320px", gap: 16, flex: 1, minHeight: 0, padding: "0 16px 16px", position: "relative", zIndex: 10 }}>
        {/* LEFT — System Vitals */}
        <GlassPanel accent={C.emerald} pulse={panelPulse} contentStyle={{ padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.emerald}>SYSTEM VITALS</PanelLabel>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <ArrTrajectoryMap arr={arr} target={target} />
          </div>
          <VitalBar label="Active Subscriber Seats (tap for slice)" value={soloSeats} max={Math.max(soloSeats, 20)} color={C.indigo} formatValue={(v) => `${v}`} onClick={() => openDrilldown("seats")} />
          <VitalBar label="Agent Token Usage (tap for histogram)" value={0} max={1} color={C.violet} formatValue={() => "—"} onClick={() => openDrilldown("tokens")} />
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <PanelLabel color={C.cyan}>TASK PIPELINE</PanelLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <PipelineHex label="Pending" count={vitals?.counts?.pending ?? "—"} color={C.amber} onClick={() => openDrawer("Pending")} />
              <PipelineHex label="Needs Appr." count={vitals?.counts?.needsApproval ?? "—"} color={C.rose} onClick={() => openDrawer("Needs_Approval")} />
              <PipelineHex label="Completed" count={vitals?.counts?.completed ?? "—"} color={C.emerald} onClick={() => openDrawer("Completed")} />
            </div>
          </div>
        </GlassPanel>

        {/* CENTER — The Cosmic Star System. No mic, no toggle — Alfred is
            always listening in the background; the ring is the only tell. */}
        <GlassPanel accent={coreState === "error" ? C.rose : coreState === "thinking" ? C.violet : C.cyan} pulse={panelPulse} contentStyle={{ position: "relative" }}>
          <div style={{ position: "absolute", inset: 0 }}>
            <StarSystem
              coreState={status === "online" ? coreState : "idle"}
              pulseRef={pulseRef}
              listening={ring}
              focusedAgent={focusedAgent}
              onSelectPlanet={selectPlanet}
              pulseTriggers={pulseTriggers}
            />
          </div>

          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", textAlign: "center", pointerEvents: "none" }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 4, color: status === "online" ? C.cyan : C.textDim }}>
              ALFRED CORE: {status === "online" ? coreState.toUpperCase() : "INITIALIZING"}
            </span>
            {status !== "online" && (
              <div style={{ width: 160, height: 3, borderRadius: 2, background: "rgba(255,255,255,0.08)", margin: "8px auto 0", overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, bootPct)}%`, height: "100%", background: C.cyan, transition: "width .15s linear" }} />
              </div>
            )}
          </div>

          {lastSpoken && (
            <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", maxWidth: 420, textAlign: "center", pointerEvents: "none" }}>
              <TypewriterText
                text={`Alfred: "${lastSpoken}"`}
                maxDurationMs={1200}
                style={{ fontSize: 11, color: C.cyan, fontStyle: "italic", display: "block", textShadow: "0 0 12px rgba(56,240,255,0.4)" }}
              />
            </div>
          )}

          <div style={{ position: "absolute", bottom: 14, right: 18, fontSize: 8, color: C.textDim, letterSpacing: 1, pointerEvents: "none" }}>
            CLICK A PLANET FOR ITS DOSSIER
          </div>
        </GlassPanel>

        {/* RIGHT — Command Deck + Direct Command Input */}
        <GlassPanel accent={C.indigo} pulse={panelPulse} contentStyle={{ padding: "20px 18px", overflowY: "auto" }}>
          <PanelLabel color={C.indigo}>COMMAND DECK</PanelLabel>
          <CommandButton label="Run Daily Briefing" sub="CEO Agent — compile status across all agents" color={C.indigo} busy={busyAction === "Run Daily Briefing"} onClick={() => runCommand("Run Daily Briefing", "CEO", "Compile the daily standup: shipped, pending, needs-approval, blocked, and ARR trajectory across all executive agents.")} />
          <CommandButton label="Financial Audit" sub="CFO Agent — reconcile MRR/ARR vs. target" color={C.emerald} busy={busyAction === "Financial Audit"} onClick={() => runCommand("Financial Audit", "CFO", "Reconcile 04-Memory/Financial_Metrics.md against current Stripe data; flag variance from the $4.02M Conservative ARR target.")} />
          <CommandButton label="Audit Multi-Tenancy RLS" sub="CTO Agent — verify brokerage_id isolation" color={C.violet} busy={busyAction === "Audit Multi-Tenancy RLS"} onClick={() => runCommand("Audit Multi-Tenancy RLS", "CTO", "Verify Supabase RLS policies isolate all tenant-scoped tables by brokerage_id/team_id; confirm live policy state via dashboard or supabase db pull.")} />
          <CommandInput onDispatched={(agentKey) => { loadData(); firePulse(agentKey); }} onSpeak={speak} sound={sound} />
        </GlassPanel>
      </div>

      {drawerStatus && DRAWER_META[drawerStatus] && (
        <TaskDrawer
          status={drawerStatus}
          label={DRAWER_META[drawerStatus].label}
          color={DRAWER_META[drawerStatus].color}
          onClose={() => setDrawerStatus(null)}
          onApproved={(agentKey) => {
            flashGlitch();
            triggerSuccessFlash();
            firePulse(agentKey);
            loadData();
          }}
          sound={sound}
          playGlitch={flashGlitch}
        />
      )}

      <VitalDrilldown kind={drilldown} data={{ soloSeats, whiteLabelDeals }} onClose={() => setDrilldown(null)} />

      <AgentDossier agentKey={focusedAgent} onClose={() => setFocusedAgent(null)} />

      <CommandLogsDrawer open={logsOpen} feed={feed} onClose={() => setLogsOpen(false)} />
    </div>
  );
}
