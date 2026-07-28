// src/components/command-center/CommandLogsDrawer.jsx — the daily
// briefings / execution logs, hidden behind a frosted-glass slide-over that
// only opens when explicitly requested (the "Command Logs" button in the
// header), instead of permanently occupying screen real estate.
import { C } from "./theme";
import LiveFeed from "./LiveFeed";

export default function CommandLogsDrawer({ open, feed, onClose }) {
  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 210,
        background: "rgba(2,4,10,0.5)",
        backdropFilter: "blur(4px)",
        animation: "cc-fade-in .2s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: "58vh",
          background: "rgba(6,10,22,0.55)",
          backdropFilter: "blur(26px) saturate(140%)",
          WebkitBackdropFilter: "blur(26px) saturate(140%)",
          borderTop: `1px solid ${C.amber}33`,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          animation: "cc-slide-up .3s cubic-bezier(.2,.8,.2,1) both",
        }}
      >
        <div style={{ padding: "16px 26px", borderBottom: `1px solid ${C.amber}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: C.amber }}>
            COMMAND LOGS — SPARK_OS/05-Daily-Briefings/
          </span>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: `1px solid ${C.amber}44`, color: C.amber, width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 12 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "16px 26px", overflowY: "auto" }}>
          <LiveFeed feed={feed} />
        </div>
      </div>
      <style>{`
        @keyframes cc-fade-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cc-slide-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
      `}</style>
    </div>
  );
}
