// src/components/command-center/TaskDrawer.jsx — full-screen holographic
// overlay listing tasks for one pipeline status. Needs_Approval rows get a
// functional "APPROVE" directive that PATCHes the task to Completed in
// Supabase (via POST /api/tasks {action:"approve"}), triggers a glitch
// flash, and removes the glyph from this list — the parent's counts get
// refreshed so it reappears under the Completed hex module.
import { useEffect, useState } from "react";
import { C, agentColorFor, PRIORITY_COLOR } from "./theme";
import TypewriterText from "./TypewriterText";

function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TaskRow({ task, onApprove, approving, sound }) {
  const color = agentColorFor(task.agent_slug || task.owner);
  return (
    <div
      onMouseEnter={() => sound?.hover()}
      style={{
        display: "grid",
        gridTemplateColumns: "70px 110px 90px 1fr auto",
        gap: 14,
        alignItems: "center",
        padding: "10px 14px",
        borderBottom: `1px solid ${C.panelBorder}`,
        fontSize: 11,
        fontFamily: C.F,
        animation: "cc-materialize .35s ease both",
      }}
    >
      <span style={{ color: PRIORITY_COLOR[task.priority] || C.textMd, fontWeight: 800, letterSpacing: 1 }}>
        [{(task.priority || "MED").slice(0, 3).toUpperCase()}]
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 6, color }}>
        <span style={{ width: 8, height: 8, clipPath: "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)", background: color, boxShadow: `0 0 6px ${color}` }} />
        {task.owner}
      </span>
      <span style={{ color: C.textDim }}>{timeAgo(task.created_at)}</span>
      <span style={{ color: C.textMd, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{task.title}</span>
      {task.status === "Needs_Approval" ? (
        <button
          onClick={() => onApprove(task)}
          disabled={approving}
          style={{
            background: "transparent",
            border: `1px solid ${C.emerald}`,
            color: C.emerald,
            fontFamily: C.F,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 1.5,
            padding: "5px 10px",
            cursor: approving ? "default" : "pointer",
            opacity: approving ? 0.5 : 1,
            boxShadow: `0 0 10px ${C.emerald}44`,
            borderRadius: 2,
          }}
        >
          {approving ? "…" : "APPROVE"}
        </button>
      ) : (
        <span />
      )}
    </div>
  );
}

export default function TaskDrawer({ status, label, color, onClose, onApproved, sound, playGlitch }) {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/tasks?status=${encodeURIComponent(status)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load tasks");
        if (!cancelled) setTasks(data.tasks || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [status]);

  async function handleApprove(task) {
    setApprovingId(task.id);
    sound?.approve();
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve", id: task.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      playGlitch?.();
      setTasks((prev) => (prev || []).filter((t) => t.id !== task.id));
      onApproved?.((task.agent_slug || "").toUpperCase());
    } catch (err) {
      setError(err.message);
      sound?.error();
    } finally {
      setApprovingId(null);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(2,4,10,0.78)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "cc-fade-in .25s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 92vw)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          background: "rgba(5,8,16,0.9)",
          border: `1px solid ${color}55`,
          boxShadow: `0 0 80px ${color}22`,
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.panelBorder}` }}>
          <TypewriterText
            text={`${label.toUpperCase()} — TASK MANIFEST`}
            style={{ fontSize: 13, fontWeight: 800, letterSpacing: 3, color, display: "block" }}
          />
          <div style={{ fontSize: 9, color: C.textDim, marginTop: 4, letterSpacing: 1 }}>
            [PRIORITY] | [AGENT GLYPH] | [TIMESTAMP] | [DIRECTIVE SUMMARY]
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {error && <div style={{ padding: 20, fontSize: 11, color: C.rose, fontFamily: C.F }}>{error}</div>}
          {tasks === null && !error && (
            <div style={{ padding: 20, fontSize: 11, color: C.textDim, fontFamily: C.F }}>Materializing glyphs…</div>
          )}
          {tasks?.length === 0 && <div style={{ padding: 20, fontSize: 11, color: C.textDim, fontFamily: C.F }}>Nothing here.</div>}
          {tasks?.map((t) => (
            <TaskRow key={t.id} task={t} onApprove={handleApprove} approving={approvingId === t.id} sound={sound} />
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            padding: "10px 0",
            background: "transparent",
            border: "none",
            borderTop: `1px solid ${C.panelBorder}`,
            color: C.textMd,
            fontFamily: C.F,
            fontSize: 10,
            letterSpacing: 2,
            cursor: "pointer",
          }}
        >
          CLOSE MANIFEST
        </button>
      </div>
      <style>{`
        @keyframes cc-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cc-materialize { from { opacity: 0; filter: blur(4px); transform: translateY(-3px); } to { opacity: 1; filter: blur(0); transform: translateY(0); } }
      `}</style>
    </div>
  );
}
