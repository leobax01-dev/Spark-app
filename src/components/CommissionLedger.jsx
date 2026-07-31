// src/components/CommissionLedger.jsx — Operations "Commission Ledger" tab:
// a full-screen financial forecasting/commission terminal, backed by live
// Supabase data (no mock arrays).
//
// Two adaptations from the literal spec, same reasoning as everywhere else
// in this codebase (see InterventionEngine.jsx for the identical rationale
// spelled out in full):
//
// 1. Styling: no Tailwind is configured in this app, so the requested
//    className strings are kept on every element (harmless now, free
//    upgrade if Tailwind is ever added) and backed by equivalent inline
//    `style` objects tuned to the same dark-glass/neon look.
//
// 2. Supabase client: this app has no `lib/supabaseClient` module. Every
//    real Supabase call here (BrokerDashboard.jsx, SurveillanceRadar.jsx,
//    InterventionEngine.jsx, PerformanceMatrix.jsx, App.jsx) reads
//    `window.__supabase`, a client lazily created from a CDN import once in
//    App.jsx's mount effect — that's the pattern followed below.
import { useEffect, useMemo, useState } from "react";
import {
  DollarSign, TrendingUp, Wallet, Search, Download, Loader2,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const GREEN = "#22C55E";
const AMBER = "#ffb020";
const RED = "#ff3b5c";
const CYAN = "#22d3ee";

const ANCHOR_EMAIL = "team@usesparkai.app";

const STATUS_COLOR = { ACTIVE: GREEN, CLOSED: GREEN, PENDING: AMBER, AT_RISK: RED };
const STATUS_LABEL = { ACTIVE: "Active", CLOSED: "Closed", PENDING: "Pending", AT_RISK: "At Risk" };

function fmtMoney(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function firstName(email) {
  if (!email) return "Unassigned";
  const local = email.split("@")[0];
  return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// deals.status (on_track/stalled/at_risk) and deals.stage
// (prospect/active/contract/closed) are separate real columns — this
// derives the single ACTIVE/PENDING/CLOSED/AT_RISK badge the spec asks for
// from both, same convention as BrokerDashboard.jsx's derivedStatus().
function deriveStatus(d) {
  if (d.stage === "closed") return "CLOSED";
  if (d.status === "at_risk") return "AT_RISK";
  if (d.stage === "prospect") return "PENDING";
  return "ACTIVE";
}

function mapDeal(d, agentEmail) {
  const volume = Number(d.deal_volume) || 0;
  const gci = Math.round(volume * 0.03); // per spec — mirrors the volume-based GCI metric used elsewhere rather than the deal's own stored gci column
  const payoutPct = Number(d.commission_split_pct ?? 70);
  const brokerageNet = Math.round(gci * (1 - payoutPct / 100));
  return {
    id: d.id,
    agent: firstName(agentEmail),
    property: d.address || "Address unavailable",
    volume,
    gci,
    agentPayoutPercent: payoutPct,
    brokerageNet,
    probability: d.probability != null ? Number(d.probability) : 50,
    projectedCloseDate: d.closing_date,
    status: deriveStatus(d),
  };
}

function StatusPill({ status }) {
  const color = STATUS_COLOR[status] || "rgba(255,255,255,0.4)";
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, fontFamily: F, fontSize: 9, fontWeight: 800,
        letterSpacing: 0.8, textTransform: "uppercase", color, background: `${color}14`,
        border: `1px solid ${color}55`, borderRadius: 999, padding: "3px 9px", whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: `0 0 5px ${color}` }} />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function MetricCard({ icon: IconCmp, label, value, accent }) {
  return (
    <div
      className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-4"
      style={{
        flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        border: `1px solid ${accent}33`, borderRadius: 12, padding: 16,
        boxShadow: `inset 0 0 30px ${accent}0f, 0 0 24px ${accent}1a`,
        display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: accent }}>
        <IconCmp size={14} strokeWidth={2.5} />
        <span style={{ fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1.5, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontFamily: F, fontSize: 28, fontWeight: 800, color: "#fff", textShadow: `0 0 16px ${accent}99`, letterSpacing: -0.5 }}>
        {value}
      </div>
    </div>
  );
}

function toCsv(rows) {
  const headers = ["Agent", "Property", "Volume", "GCI", "Payout %", "Brokerage Net", "Probability %", "Projected Close", "Status"];
  const lines = [headers.join(",")];
  rows.forEach((r) => {
    const cells = [
      r.agent, r.property, r.volume, r.gci, r.agentPayoutPercent, r.brokerageNet, r.probability,
      r.projectedCloseDate ? fmtDate(r.projectedCloseDate) : "", STATUS_LABEL[r.status] || r.status,
    ].map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  });
  return lines.join("\n");
}

export default function CommissionLedger() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bracketFilter, setBracketFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const sb = window.__supabase;
      if (!sb) {
        if (!cancelled) { setError("Supabase isn't initialized yet — try again in a moment."); setLoading(false); }
        return;
      }

      try {
        const { data: anchorUser, error: anchorError } = await sb
          .from("users")
          .select("id, brokerage_id")
          .eq("email", ANCHOR_EMAIL)
          .maybeSingle();
        if (anchorError) throw new Error(anchorError.message);
        if (!anchorUser?.brokerage_id) throw new Error(`No brokerage found for ${ANCHOR_EMAIL}`);

        const [dealsRes, usersRes] = await Promise.all([
          sb
            .from("deals")
            .select("id, agent_id, address, stage, status, deal_volume, commission_split_pct, probability, closing_date")
            .eq("brokerage_id", anchorUser.brokerage_id),
          sb.from("users").select("id, email").eq("brokerage_id", anchorUser.brokerage_id),
        ]);
        if (dealsRes.error) throw new Error(dealsRes.error.message);
        if (usersRes.error) throw new Error(usersRes.error.message);
        if (cancelled) return;

        const emailById = Object.fromEntries((usersRes.data || []).map((u) => [u.id, u.email]));
        setDeals((dealsRes.data || []).map((d) => mapDeal(d, emailById[d.agent_id])));
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load commission ledger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const agentOptions = useMemo(() => {
    const names = Array.from(new Set(deals.map((d) => d.agent))).sort();
    return names;
  }, [deals]);
  const [agentFilter, setAgentFilter] = useState("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals.filter((d) => {
      if (q && !d.property.toLowerCase().includes(q) && !d.agent.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (agentFilter !== "all" && d.agent !== agentFilter) return false;
      if (bracketFilter === "1m" && d.volume < 1_000_000) return false;
      if (bracketFilter === "5m" && d.volume < 5_000_000) return false;
      if (bracketFilter === "10m" && d.volume < 10_000_000) return false;
      return true;
    });
  }, [deals, search, statusFilter, agentFilter, bracketFilter]);

  const hud = useMemo(() => {
    const now = Date.now();
    const in30d = now + 30 * 86400000;
    const projectedPayout = deals.reduce((sum, d) => {
      if (!d.projectedCloseDate || d.status === "CLOSED") return sum;
      const t = new Date(d.projectedCloseDate).getTime();
      if (!Number.isFinite(t) || t < now || t > in30d) return sum;
      const agentPayout = d.gci * (d.agentPayoutPercent / 100);
      return sum + agentPayout * (d.probability / 100);
    }, 0);
    const totalFilteredGci = filtered.reduce((sum, d) => sum + d.gci, 0);
    const brokerageNetIncome = filtered.reduce((sum, d) => sum + d.brokerageNet, 0);
    return { projectedPayout, totalFilteredGci, brokerageNetIncome };
  }, [deals, filtered]);

  function exportCsv() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `commission-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const selectStyle = {
    background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8,
    color: "#fff", fontFamily: F, fontSize: 11, padding: "8px 10px", outline: "none", cursor: "pointer",
  };

  // Centralized SPARK OS loading state — shared pulsing purple bolt
  // splash so every Operations module boots identically.
  if (loading) return <SparkBoot />;

  return (
    <div
      className="w-full h-full flex flex-col bg-[#050505] text-white p-6 gap-6 overflow-y-auto"
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        background: "#050505", color: "#fff", padding: 24, gap: 20, boxSizing: "border-box", overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <DollarSign size={20} color={GREEN} style={{ filter: `drop-shadow(0 0 8px ${GREEN}aa)` }} />
        <div>
          <div style={{ fontFamily: F, fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "#fff" }}>COMMISSION LEDGER</div>
          <div style={{ fontFamily: F, fontSize: 10, color: "rgba(255,255,255,0.4)", letterSpacing: 1 }}>
            {loading ? "Loading ledger…" : `Brokerage-wide financial forecast — ${deals.length} deals on record`}
          </div>
        </div>
      </div>

      {error && (
        <div style={{ fontFamily: MONO, fontSize: 11.5, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "10px 14px" }}>
          {error}
        </div>
      )}

      {/* Top Financial Forecast HUD */}
      <div style={{ display: "flex", gap: 14 }}>
        <MetricCard icon={TrendingUp} label="30-Day Projected Payout" value={loading ? "…" : fmtMoney(hud.projectedPayout)} accent={CYAN} />
        <MetricCard icon={DollarSign} label="Total Filtered GCI" value={loading ? "…" : fmtMoney(hud.totalFilteredGci)} accent={GREEN} />
        <MetricCard icon={Wallet} label="Brokerage Net Income" value={loading ? "…" : fmtMoney(hud.brokerageNetIncome)} accent="#8CA0FF" />
      </div>

      {/* Dynamic Filtering Suite */}
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10"
        style={{
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12,
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
          <Search size={13} color="rgba(255,255,255,0.35)" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address or agent…"
            style={{
              width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#fff",
              fontFamily: F, fontSize: 11, padding: "8px 10px 8px 30px", outline: "none",
            }}
          />
        </div>

        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Agents</option>
          {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="CLOSED">Closed</option>
          <option value="AT_RISK">At Risk</option>
        </select>

        <select value={bracketFilter} onChange={(e) => setBracketFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Values</option>
          <option value="1m">$1M+</option>
          <option value="5m">$5M+</option>
          <option value="10m">$10M+</option>
        </select>

        <button
          onClick={exportCsv}
          disabled={loading || filtered.length === 0}
          style={{
            marginLeft: "auto", display: "flex", alignItems: "center", gap: 8,
            background: "rgba(34,197,94,0.12)", border: `1px solid ${GREEN}55`, borderRadius: 8,
            color: GREEN, fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, textTransform: "uppercase",
            padding: "9px 14px", cursor: loading || filtered.length === 0 ? "default" : "pointer",
            opacity: loading || filtered.length === 0 ? 0.5 : 1, whiteSpace: "nowrap",
          }}
        >
          <Download size={13} />
          Export Financial Report (CSV)
        </button>
      </div>

      {/* Institutional Data Grid */}
      <div
        className="bg-black/40 backdrop-blur-md border border-white/10"
        style={{
          flex: 1, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 16,
          display: "flex", flexDirection: "column", minHeight: 300, overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 0.9fr 0.9fr 1fr 0.9fr 1.1fr 0.9fr", gap: 8,
            padding: "0 10px 8px", borderBottom: "1px solid rgba(255,255,255,0.08)", fontFamily: F, fontSize: 9,
            fontWeight: 800, letterSpacing: 0.8, color: "rgba(255,255,255,0.35)", textTransform: "uppercase",
          }}
        >
          <span>Agent</span>
          <span>Property Address</span>
          <span>Deal Volume</span>
          <span>Total GCI</span>
          <span>Payout %</span>
          <span>Brokerage Net</span>
          <span>Probability</span>
          <span>Projected Close</span>
          <span>Status</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 20, fontFamily: MONO, fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              <Loader2 size={16} style={{ animation: "clSpin 1s linear infinite" }} />
              Loading ledger…
              <style>{`@keyframes clSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", fontFamily: F, fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
              {deals.length === 0 ? "No deals found for this brokerage." : "No deals match the current filters."}
            </div>
          ) : (
            filtered.map((d) => (
              <div
                key={d.id}
                className="border-b border-white/5 hover:bg-white/5 transition-colors"
                style={{
                  display: "grid", gridTemplateColumns: "1fr 1.6fr 1fr 0.9fr 0.9fr 1fr 0.9fr 1.1fr 0.9fr", gap: 8,
                  alignItems: "center", padding: "10px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  transition: "background 0.15s ease",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontFamily: F, fontSize: 12, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.agent}</span>
                <span style={{ fontFamily: F, fontSize: 11.5, color: "rgba(255,255,255,0.75)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.property}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(255,255,255,0.85)" }}>{fmtMoney(d.volume)}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: GREEN }}>{fmtMoney(d.gci)}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>{d.agentPayoutPercent}%</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#8CA0FF" }}>{fmtMoney(d.brokerageNet)}</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>{d.probability}%</span>
                <span style={{ fontFamily: MONO, fontSize: 11.5, color: "rgba(255,255,255,0.7)" }}>{fmtDate(d.projectedCloseDate)}</span>
                <span><StatusPill status={d.status} /></span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
