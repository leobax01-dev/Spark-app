// src/components/command-center/VitalDrilldown.jsx — the overlay that
// materializes when a System Vitals metric is tapped.
//
// Honesty note: "seats" gets a real breakdown derived from the actual
// numbers the API returns (solo seats vs. white-label deals — both real
// fields already on the /api/tasks response). "Token usage per agent" has
// no backing data source anywhere in this codebase — no usage metering is
// implemented in api/voice.js or elsewhere — so rather than fabricate a
// histogram, this shows an honest empty state explaining that and naming
// what would need to exist (a usage-logging table/column) to light it up.
import { C, AGENT_COLOR } from "./theme";
import TypewriterText from "./TypewriterText";

function SeatSlice({ soloSeats, whiteLabelDeals }) {
  const total = Math.max(1, soloSeats + whiteLabelDeals);
  const soloPct = (soloSeats / total) * 100;
  const size = 160;
  const r = 60;
  const circumference = 2 * Math.PI * r;
  const soloLen = (soloPct / 100) * circumference;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={16} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.indigo}
          strokeWidth={16}
          strokeDasharray={`${soloLen} ${circumference - soloLen}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${C.indigo})` }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={C.violet}
          strokeWidth={16}
          strokeDasharray={`${circumference - soloLen} ${soloLen}`}
          strokeDashoffset={-soloLen}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${C.violet})` }}
        />
        <text x="50%" y="48%" textAnchor="middle" fill={C.text} fontSize="22" fontFamily={C.F} fontWeight="800">
          {soloSeats + whiteLabelDeals}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fill={C.textDim} fontSize="8" fontFamily={C.F} letterSpacing="1">
          TOTAL SEATS
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <LegendRow color={C.indigo} label="Solo Agent Seats" value={soloSeats} />
        <LegendRow color={C.violet} label="White-Label Deals" value={whiteLabelDeals} />
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 10, height: 10, borderRadius: 2, background: color, boxShadow: `0 0 6px ${color}` }} />
      <span style={{ fontSize: 11, color: C.textMd, fontFamily: C.F }}>{label}</span>
      <span style={{ fontSize: 12, color: C.text, fontFamily: C.F, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

function TokenUsageEmptyState() {
  return (
    <div style={{ maxWidth: 340, textAlign: "center" }}>
      <div style={{ fontSize: 11, color: C.rose, letterSpacing: 1.5, fontWeight: 700, marginBottom: 10 }}>
        NO USAGE TELEMETRY ON RECORD
      </div>
      <div style={{ fontSize: 11, color: C.textMd, lineHeight: 1.6 }}>
        SPARK_OS doesn't log per-agent token/resource consumption anywhere yet —
        <code style={{ color: C.textDim }}> api/voice.js</code>,
        <code style={{ color: C.textDim }}> api/claude.js</code>, and the C-Suite agent files
        make no usage-metering calls. This panel is wired and ready — a real
        histogram will appear here as soon as a{" "}
        <code style={{ color: C.cyan }}>usage_log</code> table (or column) exists to read from.
      </div>
      <div style={{ marginTop: 16, display: "flex", justifyContent: "center", gap: 4, opacity: 0.35 }}>
        {["CEO", "CMO", "CTO", "CFO", "CRO"].map((a) => (
          <div key={a} style={{ width: 28, height: 4, borderRadius: 2, background: AGENT_COLOR[a] }} />
        ))}
      </div>
    </div>
  );
}

export default function VitalDrilldown({ kind, data, onClose }) {
  if (!kind) return null;
  const title = kind === "seats" ? "SEAT DISTRIBUTION SLICE" : "AGENT TOKEN USAGE";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(2,4,10,0.72)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "cc-fade-in .25s ease both",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(6,10,20,0.92)",
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 4,
          padding: "28px 32px",
          minWidth: 380,
          boxShadow: `0 0 60px rgba(56,240,255,0.08)`,
        }}
      >
        <TypewriterText
          text={title}
          style={{ fontSize: 12, fontWeight: 800, letterSpacing: 3, color: C.cyan, display: "block", marginBottom: 20 }}
        />
        <div style={{ display: "flex", justifyContent: "center" }}>
          {kind === "seats" ? (
            <SeatSlice soloSeats={data?.soloSeats ?? 0} whiteLabelDeals={data?.whiteLabelDeals ?? 0} />
          ) : (
            <TokenUsageEmptyState />
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            marginTop: 24,
            width: "100%",
            background: "transparent",
            border: `1px solid ${C.panelBorder}`,
            color: C.textMd,
            fontFamily: C.F,
            fontSize: 10,
            letterSpacing: 1.5,
            padding: "8px 0",
            cursor: "pointer",
            borderRadius: 3,
          }}
        >
          CLOSE
        </button>
      </div>
      <style>{`@keyframes cc-fade-in { from { opacity: 0 } to { opacity: 1 } }`}</style>
    </div>
  );
}
