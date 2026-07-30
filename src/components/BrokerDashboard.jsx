// src/components/BrokerDashboard.jsx — Brokerage Command Suite: the
// broker-only landing view. Gated by role==="broker" in the parent
// (App.jsx); this component also self-guards so it never renders anything
// for a non-broker if it's ever mounted by mistake.
//
// All data here comes from real Supabase queries against the `deals` table
// (see supabase/migrations/20260729000000_create_brokerage_suite.sql and
// later additive migrations for probability/closing_date/commission_split_pct),
// scoped by RLS to rows where deals.brokerage_id matches the signed-in
// broker's own brokerage_id — a broker can only ever see their own
// brokerage's pipeline, enforced at the database level, not just hidden in
// the UI.
import { useEffect, useMemo, useState } from "react";
import { Card, Label } from "./UI";

const C = {
  bg: "#0a0a0d", surface: "#0d0e12", surfaceUp: "#131519",
  border: "rgba(255,255,255,0.07)", borderMd: "rgba(255,255,255,0.12)",
  indigo: "#4F6BFF", indigoLt: "#8CA0FF", violet: "#4257DB",
  cyan: "#38BDF8", emerald: "#22C55E", amber: "#F5A623", rose: "#EF4444",
  text: "rgba(255,255,255,0.95)", textMd: "rgba(255,255,255,0.55)", textDim: "rgba(255,255,255,0.26)",
  F: "'Plus Jakarta Sans',sans-serif",
};

function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function fmtMoneyFull(n) {
  return `$${(Number(n) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

// The requested status vocabulary ('active'/'pending'/'closed'/'at-risk'/
// 'stalled') doesn't map 1:1 onto this schema's two real columns — `stage`
// (prospect/active/contract/closed) and `status` (on_track/stalled/at_risk)
// are separate concepts. This derives one display label from both rather
// than inventing a third schema column that would drift out of sync with
// the two that actually drive the rest of the dashboard.
function derivedStatus(d) {
  if (d.stage === "closed") return "Closed";
  if (d.status === "at_risk") return "At Risk";
  if (d.status === "stalled") return "Stalled";
  if (d.stage === "prospect") return "Pending";
  return "Active";
}

const STATUS_COLOR = {
  Active: C.emerald,
  Pending: C.amber,
  Closed: C.indigoLt,
  "At Risk": C.rose,
  Stalled: C.violet,
};

function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || C.textMd;
  return (
    <span
      style={{
        display: "inline-block",
        fontSize: 9,
        fontWeight: 800,
        letterSpacing: 0.6,
        textTransform: "uppercase",
        color,
        background: `${color}1a`,
        border: `1px solid ${color}44`,
        borderRadius: 999,
        padding: "3px 9px",
      }}
    >
      {status}
    </span>
  );
}

function StatBlock({ label, value, color }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 9, color: C.textDim, letterSpacing: 1.5, fontFamily: C.F, fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: color || C.text, fontFamily: C.F, letterSpacing: "-0.02em" }}>{value}</div>
    </div>
  );
}

function Select({ value, onChange, options, style = {} }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: C.surfaceUp,
        border: `1px solid ${C.borderMd}`,
        borderRadius: 8,
        color: C.text,
        fontFamily: C.F,
        fontSize: 11,
        padding: "8px 10px",
        outline: "none",
        ...style,
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export default function BrokerDashboard({ user }) {
  const [deals, setDeals] = useState(null);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  const [filterAgent, setFilterAgent] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "broker") return;
    let cancelled = false;

    (async () => {
      const sb = window.__supabase;
      if (!sb) {
        setError("Supabase isn't initialized yet — try again in a moment.");
        return;
      }
      try {
        const [dealsRes, membersRes] = await Promise.all([
          sb
            .from("deals")
            .select("id, agent_id, client_name, address, stage, status, deal_volume, gci, commission_split_pct, probability, closing_date, war_room_active, last_activity_at")
            .order("last_activity_at", { ascending: false }),
          sb.from("users").select("id, email").eq("brokerage_id", user.brokerageId),
        ]);
        if (cancelled) return;
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        setDeals(dealsRes.data || []);
        if (!membersRes.error) setMembers(membersRes.data || []);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();

    return () => { cancelled = true; };
  }, [user]);

  if (user?.role !== "broker") return null;

  const memberById = Object.fromEntries(members.map((m) => [m.id, m.email]));

  const totalActiveVolume = (deals || []).filter((d) => d.stage !== "closed").reduce((sum, d) => sum + (Number(d.deal_volume) || 0), 0);
  const pendingGci = (deals || []).filter((d) => d.stage !== "closed").reduce((sum, d) => sum + (Number(d.gci) || 0), 0);
  const closedCount = (deals || []).filter((d) => d.stage === "closed").length;
  const totalCount = (deals || []).length;
  // "Deal Velocity" — closed-deal ratio over the visible pipeline window,
  // the simplest honest proxy available without a defined time-series
  // metric spec; expressed as a percentage of pipeline that's converted.
  const dealVelocity = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;

  const atRiskDeals = (deals || []).filter((d) => d.status === "stalled" || d.status === "at_risk");

  const agentStats = {};
  for (const d of deals || []) {
    const key = d.agent_id;
    if (!agentStats[key]) agentStats[key] = { email: memberById[key] || key, active: 0, warRoom: 0, won: 0, lost: 0 };
    if (d.stage !== "closed") agentStats[key].active++;
    if (d.war_room_active) agentStats[key].warRoom++;
    if (d.stage === "closed") agentStats[key].won++;
    if (d.status === "at_risk" && d.stage !== "closed") agentStats[key].lost++; // proxy — no explicit "lost" stage exists yet
  }
  const leaderboard = Object.values(agentStats).sort((a, b) => b.won - a.won);

  // ── Team Deals & Commission Ledger ──────────────────────────────────────
  const ledgerRows = useMemo(
    () =>
      (deals || []).map((d) => ({
        ...d,
        agentEmail: memberById[d.agent_id] || d.agent_id,
        statusLabel: derivedStatus(d),
        commissionPayout: (Number(d.gci) || 0) * ((Number(d.commission_split_pct) || 0) / 100),
      })),
    [deals, members] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const statusOptions = ["Active", "Pending", "Closed", "At Risk", "Stalled"];
  const agentOptions = useMemo(() => {
    const unique = new Map();
    for (const d of ledgerRows) if (!unique.has(d.agent_id)) unique.set(d.agent_id, d.agentEmail);
    return Array.from(unique.entries());
  }, [ledgerRows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ledgerRows.filter((d) => {
      if (filterAgent !== "all" && d.agent_id !== filterAgent) return false;
      if (filterStatus !== "all" && d.statusLabel !== filterStatus) return false;
      if (q && !(d.address || "").toLowerCase().includes(q) && !(d.agentEmail || "").toLowerCase().includes(q) && !(d.client_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ledgerRows, filterAgent, filterStatus, search]);

  const filteredVolume = filteredRows.reduce((sum, d) => sum + (Number(d.deal_volume) || 0), 0);
  const filteredGci = filteredRows.reduce((sum, d) => sum + (Number(d.gci) || 0), 0);
  const filteredCommissions = filteredRows.reduce((sum, d) => sum + d.commissionPayout, 0);

  return (
    <div style={{ maxWidth: 1080 }}>
      {error && (
        <Card accent={C.rose} C={C} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.rose }}>{error}</div>
        </Card>
      )}

      {/* Macro-Pipeline Widget */}
      <Card accent={C.emerald} C={C} style={{ marginBottom: 18 }}>
        <Label color={C.emerald} C={C}>MACRO-PIPELINE</Label>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <StatBlock label="TOTAL ACTIVE VOLUME" value={deals === null ? "—" : fmtMoney(totalActiveVolume)} color={C.emerald} />
          <StatBlock label="PENDING GCI" value={deals === null ? "—" : fmtMoney(pendingGci)} color={C.cyan} />
          <StatBlock label="DEAL VELOCITY" value={deals === null ? "—" : `${dealVelocity}%`} color={C.indigoLt} />
        </div>
      </Card>

      {/* Intervention Feed */}
      <Card accent={C.rose} C={C} style={{ marginBottom: 18 }}>
        <Label color={C.rose} C={C}>INTERVENTION FEED — STALLED / AT-RISK DEALS</Label>
        {deals === null && <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>}
        {deals !== null && atRiskDeals.length === 0 && (
          <div style={{ fontSize: 12, color: C.textDim }}>Nothing flagged — pipeline looks healthy.</div>
        )}
        {atRiskDeals.map((d) => (
          <div
            key={d.id}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 12px", marginBottom: 8, borderRadius: 8,
              background: "rgba(239,68,68,0.06)", border: `1px solid ${C.rose}33`,
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>{d.client_name || "Unnamed deal"}</div>
              <div style={{ fontSize: 10, color: C.textDim, marginTop: 2 }}>{memberById[d.agent_id] || "Unknown agent"} · {fmtMoney(d.deal_volume)}</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1, color: C.rose, textTransform: "uppercase" }}>{d.status.replace("_", " ")}</span>
          </div>
        ))}
      </Card>

      {/* Agent Leaderboard */}
      <Card accent={C.indigo} C={C} style={{ marginBottom: 18 }}>
        <Label color={C.indigo} C={C}>AGENT LEADERBOARD</Label>
        {deals === null && <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>}
        {deals !== null && leaderboard.length === 0 && <div style={{ fontSize: 12, color: C.textDim }}>No deal activity recorded yet.</div>}
        {leaderboard.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.F }}>
            <thead>
              <tr>
                {["AGENT", "ACTIVE DEALS", "WAR ROOM", "WON", "AT RISK"].map((h) => (
                  <th key={h} style={{ textAlign: "left", fontSize: 9, color: C.textDim, letterSpacing: 1, fontWeight: 700, padding: "6px 8px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((a) => (
                <tr key={a.email}>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}` }}>{a.email}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: C.textMd, borderBottom: `1px solid ${C.border}` }}>{a.active}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: C.violet, borderBottom: `1px solid ${C.border}` }}>{a.warRoom}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: C.emerald, borderBottom: `1px solid ${C.border}` }}>{a.won}</td>
                  <td style={{ padding: "10px 8px", fontSize: 12, color: C.rose, borderBottom: `1px solid ${C.border}` }}>{a.lost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Team Deals & Commission Ledger */}
      <Card accent={C.cyan} C={C}>
        <Label color={C.cyan} C={C}>TEAM DEALS & COMMISSION LEDGER</Label>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Select
            value={filterAgent}
            onChange={setFilterAgent}
            options={[{ value: "all", label: "All Agents" }, ...agentOptions.map(([id, email]) => ({ value: id, label: email }))]}
          />
          <Select
            value={filterStatus}
            onChange={setFilterStatus}
            options={[{ value: "all", label: "All Statuses" }, ...statusOptions.map((s) => ({ value: s, label: s }))]}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address or agent…"
            style={{
              flex: 1,
              minWidth: 180,
              background: C.surfaceUp,
              border: `1px solid ${C.borderMd}`,
              borderRadius: 8,
              color: C.text,
              fontFamily: C.F,
              fontSize: 11,
              padding: "8px 10px",
              outline: "none",
            }}
          />
        </div>

        {/* Summary bar */}
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 16, padding: "12px 14px", background: C.surfaceUp, borderRadius: 10, border: `1px solid ${C.border}` }}>
          <StatBlock label="TOTAL FILTERED VOLUME" value={deals === null ? "—" : fmtMoney(filteredVolume)} color={C.emerald} />
          <StatBlock label="TOTAL FILTERED GCI" value={deals === null ? "—" : fmtMoney(filteredGci)} color={C.cyan} />
          <StatBlock label="TOTAL PROJECTED COMMISSIONS" value={deals === null ? "—" : fmtMoney(filteredCommissions)} color={C.violet} />
        </div>

        {deals === null && <div style={{ fontSize: 12, color: C.textDim }}>Loading…</div>}
        {deals !== null && filteredRows.length === 0 && (
          <div style={{ fontSize: 12, color: C.textDim }}>No deals match the current filters.</div>
        )}

        {filteredRows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: C.F, minWidth: 780 }}>
              <thead>
                <tr>
                  {["AGENT", "PROPERTY ADDRESS", "VOLUME", "GCI", "COMMISSION PAYOUT", "STATUS", "PROBABILITY", "CLOSING DATE"].map((h) => (
                    <th key={h} style={{ textAlign: "left", fontSize: 9, color: C.textDim, letterSpacing: 1, fontWeight: 700, padding: "6px 8px", borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((d) => (
                  <tr key={d.id}>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{d.agentEmail}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.textMd, borderBottom: `1px solid ${C.border}` }}>{d.address || d.client_name || "—"}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.text, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{fmtMoneyFull(d.deal_volume)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.cyan, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{fmtMoneyFull(d.gci)}</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.violet, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>
                      {fmtMoneyFull(d.commissionPayout)} <span style={{ color: C.textDim, fontSize: 10 }}>({d.commission_split_pct}%)</span>
                    </td>
                    <td style={{ padding: "10px 8px", borderBottom: `1px solid ${C.border}` }}><StatusBadge status={d.statusLabel} /></td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.textMd, borderBottom: `1px solid ${C.border}` }}>{d.probability}%</td>
                    <td style={{ padding: "10px 8px", fontSize: 12, color: C.textMd, borderBottom: `1px solid ${C.border}`, whiteSpace: "nowrap" }}>{fmtDate(d.closing_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
