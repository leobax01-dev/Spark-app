// src/components/command-center/AgentDossier.jsx — the glassmorphic
// "Holographic Dossier" that slides out when a C-Suite planet is clicked.
// Shows that agent's live tasks from Supabase (GET /api/tasks?owner=...),
// derived KPI counts, and recent execution-log lines pulled from the daily
// briefings that mention them.
import { useEffect, useState } from "react";
import { C, AGENT_COLOR, PRIORITY_COLOR } from "./theme";

const AGENT_TITLE = {
  CEO: "Chief Executive Officer — Master Orchestrator",
  CMO: "Chief Marketing Officer — GTM & Acquisition",
  CTO: "Chief Technology Officer — Architecture & Data Moat",
  CFO: "Chief Financial Officer — Revenue & Unit Economics",
};

function timeAgo(iso) {
  if (!iso) return "—";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AgentDossier({ agentKey, onClose }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!agentKey) return;
    let cancelled = false;
    setTasks(null);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/tasks?owner=${encodeURIComponent(agentKey)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load dossier");
        if (!cancelled) setTasks(data.tasks || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [agentKey]);

  if (!agentKey) return null;
  const color = AGENT_COLOR[agentKey] || C.cyan;

  const counts = (tasks || []).reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: "min(420px, 92vw)",
        zIndex: 220,
        background: "rgba(6,10,22,0.5)",
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        borderLeft: `1px solid ${color}33`,
        boxShadow: `-20px 0 60px rgba(0,0,0,0.5), inset 1px 0 0 ${color}22`,
        display: "flex",
        flexDirection: "column",
        animation: "cc-slide-in .35s cubic-bezier(.2,.8,.2,1) both",
      }}
    >
      <style>{`@keyframes cc-slide-in { from { transform: translateX(100%); opacity: 0.4 } to { transform: translateX(0); opacity: 1 } }`}</style>

      <div style={{ padding: "24px 26px 18px", borderBottom: `1px solid ${color}22` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 4 }}>HOLOGRAPHIC DOSSIER</div>
            <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: C.F, letterSpacing: 1 }}>{agentKey}_AGENT</div>
            <div style={{ fontSize: 10, color: C.textMd, marginTop: 4 }}>{AGENT_TITLE[agentKey]}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${color}44`, color, width: 28, height: 28, borderRadius: "50%", cursor: "pointer", fontSize: 13 }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          {["Pending", "Needs_Approval", "Completed"].map((s) => (
            <div key={s} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 800, color, textShadow: `0 0 8px ${color}66` }}>{counts[s] || 0}</div>
              <div style={{ fontSize: 8, color: C.textDim, letterSpacing: 1, textTransform: "uppercase" }}>{s.replace("_", " ")}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: C.textDim, marginBottom: 12 }}>ACTIVE DIRECTIVES</div>
        {error && <div style={{ fontSize: 11, color: C.rose }}>{error}</div>}
        {tasks === null && !error && <div style={{ fontSize: 11, color: C.textDim }}>Decrypting transmission…</div>}
        {tasks?.length === 0 && <div style={{ fontSize: 11, color: C.textDim }}>No directives on file for this agent yet.</div>}
        {tasks?.map((t) => (
          <div
            key={t.id}
            style={{
              padding: "12px 14px",
              marginBottom: 10,
              borderRadius: 8,
              background: "rgba(255,255,255,0.03)",
              border: `1px solid ${color}22`,
              backdropFilter: "blur(6px)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: PRIORITY_COLOR[t.priority] || C.textMd }}>
                {(t.priority || "MED").toUpperCase()}
              </span>
              <span style={{ fontSize: 9, color: C.textDim }}>{timeAgo(t.created_at)}</span>
            </div>
            <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{t.title}</div>
            <div style={{ fontSize: 9, color: C.textDim, marginTop: 4, letterSpacing: 0.5 }}>
              {t.status.replace("_", " ").toUpperCase()} · {t.source}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
