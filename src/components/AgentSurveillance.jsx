// src/components/AgentSurveillance.jsx — SPARK OS Agent Acquisition Grid.
// The agent-side counterpart to the brokerage Surveillance Radar: a tactical
// Mapbox terminal that plots the agent's own listings alongside expiring
// competitor inventory and AI-predicted off-market sellers, with a target-lock
// dossier carrying instant CMA, outreach scripting, and watchlist capture.
//
// Standing adaptations, same rationale as every other SPARK OS terminal:
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles.
//
// 2. Supabase client: this app's working client is `window.__supabase`
//    (lazily CDN-created in App.jsx); there is no lib/supabaseClient module.
//
// 3. Animation: no content is gated behind a framer-motion entrance and no
//    AnimatePresence wraps the dossier swap. Staggered/exit animations do not
//    reliably resolve in embedded or throttled contexts, and a stalled one
//    would leave an agent staring at an empty panel after clicking a node.
//
// 4. Data provenance: only the agent's OWN listings come from Supabase
//    (`deals`). Competitor-expiring and AI-predicted-seller nodes are
//    synthesized market intelligence — there is no MLS feed wired into this
//    app. Every synthesized node is badged SIM and the legend carries a
//    SIMULATED GRID notice, because an agent must never door-knock an address
//    believing it came from real MLS data when it did not.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";
import {
  Zap, Radar as RadarIcon, MapPin, X, FileText, MessageSquare, Bookmark,
  Loader2, Layers, Crosshair, Copy, Check,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

const MAPBOX_TOKEN = import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CYAN = "#22d3ee";
const PURPLE = "#a855f7";
const PURPLE_LT = "#c084fc";
const RED = "#ff3b5c";
const GREEN = "#22C55E";
const AMBER = "#ffb020";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const PANEL_W = 392;
const COMMISSION_RATE = 0.03;

const MIAMI_BEACH = { longitude: -80.132, latitude: 25.793, zoom: 12.6, pitch: 52, bearing: -17 };

const NODE = {
  MINE:      { key: "MINE",      label: "My Active Listings",   color: CYAN,   short: "ACTIVE ASSET" },
  EXPIRING:  { key: "EXPIRING",  label: "Flight Risk / Expiring", color: RED,  short: "EXPIRING" },
  PREDICTED: { key: "PREDICTED", label: "AI Predicted Seller",  color: PURPLE, short: "PREDICTED" },
};

const STYLES = [
  { id: "tactical", label: "Tactical", url: "mapbox://styles/mapbox/dark-v11" },
  { id: "satellite", label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12" },
];

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtFull(n) { return `$${Math.round(n || 0).toLocaleString()}`; }

// Haversine — straight-line distance from the agent's operating center.
function milesFrom(originLng, originLat, lng, lat) {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat - originLat), dLng = toRad(lng - originLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(originLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// ── Synthesized market grid (see header note 4) ───────────────────────────
const SYNTH_NODES = [
  ["EXPIRING",  "5 Star Island Dr, Miami Beach, FL",      -80.1520, 25.7745, 18_400_000, 118, "Single Family"],
  ["EXPIRING",  "1439 N View Dr, Miami Beach, FL",        -80.1408, 25.8180,  9_250_000,  96, "Single Family"],
  ["EXPIRING",  "6800 Fisher Island Dr, Miami Beach, FL", -80.1425, 25.7605,  6_400_000, 104, "Condo"],
  ["EXPIRING",  "300 S Pointe Dr, Miami Beach, FL",       -80.1350, 25.7688,  4_150_000,  91, "Condo"],
  ["EXPIRING",  "4401 Collins Ave, Miami Beach, FL",      -80.1235, 25.8155,  3_280_000, 133, "Condo"],
  ["PREDICTED", "2020 N Bay Rd, Miami Beach, FL",         -80.1462, 25.7962, 24_800_000, null, "Single Family"],
  ["PREDICTED", "5800 Pine Tree Dr, Miami Beach, FL",     -80.1281, 25.8305, 12_900_000, null, "Single Family"],
  ["PREDICTED", "1000 S Pointe Dr, Miami Beach, FL",      -80.1372, 25.7702,  8_600_000, null, "Condo"],
  ["PREDICTED", "441 Lakeview Dr, Miami Beach, FL",       -80.1338, 25.8060,  5_950_000, null, "Single Family"],
  ["PREDICTED", "9001 Collins Ave, Surfside, FL",         -80.1206, 25.8790,  4_720_000, null, "Condo"],
  ["MINE",      "1245 Alton Rd, Miami Beach, FL",         -80.1445, 25.7855,  7_300_000,  22, "Single Family"],
  ["MINE",      "50 S Pointe Dr, Miami Beach, FL",        -80.1318, 25.7672, 11_500_000,  14, "Condo"],
  ["MINE",      "3315 Flamingo Dr, Miami Beach, FL",      -80.1358, 25.8118,  6_150_000,  41, "Single Family"],
  ["MINE",      "2000 Sunset Dr, Miami Beach, FL",        -80.1490, 25.7908,  3_950_000,   8, "Condo"],
  ["MINE",      "7935 East Dr, North Bay Village, FL",    -80.1533, 25.8462,  2_480_000,  35, "Condo"],
];

function synthesizeGrid() {
  return SYNTH_NODES.map(([type, address, lng, lat, value, dom, propertyType], i) => ({
    id: `sim-${i}`, synthetic: true, type, address, lng, lat, value, dom, propertyType,
    owner: type === "PREDICTED" ? "Off-market — owner of record" : type === "EXPIRING" ? "Listed with competing brokerage" : "You",
    signal: type === "PREDICTED"
      ? ["Equity > 65% · 11yr tenure", "Recent permit pull · no listing", "Absentee owner · 2 properties", "Tax appeal filed · downsizing signal", "Neighbor sold 8% over ask"][i % 5]
      : null,
  }));
}

// ── Pulsing map node ──────────────────────────────────────────────────────
function PulseNode({ node, selected, onPick }) {
  const meta = NODE[node.type];
  const isSel = selected?.id === node.id;
  const size = 12 + Math.min(10, node.value / 2_600_000);
  return (
    <Marker longitude={node.lng} latitude={node.lat} anchor="center"
      onClick={(e) => { e.originalEvent.stopPropagation(); onPick(node); }}>
      <div style={{ position: "relative", width: size, height: size, cursor: "pointer" }}
        title={node.address}>
        {/* expanding pulse ring */}
        <span style={{
          position: "absolute", inset: -6, borderRadius: "50%", border: `1.5px solid ${meta.color}`,
          animation: `asPulse 2.4s cubic-bezier(.2,.6,.4,1) infinite`, animationDelay: `${(node.lat * 7) % 2}s`,
        }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%", background: meta.color,
          boxShadow: `0 0 ${isSel ? 22 : 12}px ${meta.color}, 0 0 4px #000`,
          border: isSel ? "2px solid #fff" : `1px solid rgba(0,0,0,0.5)`,
          transform: isSel ? "scale(1.35)" : "scale(1)", transition: "transform .16s ease, box-shadow .16s ease",
        }} />
      </div>
    </Marker>
  );
}

// ── AI tactical directive ─────────────────────────────────────────────────
function buildDirective(n) {
  if (n.type === "EXPIRING") {
    const daysLeft = Math.max(1, 180 - n.dom);
    return [
      `TARGET: ${n.address}`,
      `STATUS: Competitor listing · ${n.dom} days on market`,
      ``,
      `Listing approaches expiry in ~${daysLeft} days. At ${n.dom} DOM the owner has absorbed months of carrying cost with no close — frustration with showing volume and agent communication is the highest-probability opening.`,
      ``,
      `PLAY: Drop the Aggressive Marketing packet at the door tomorrow AM before the listing agent's renewal call. Lead with days-on-market data for the block, not with your resume. Ask one question: "What did they promise you on week one that never happened?"`,
    ].join("\n");
  }
  if (n.type === "PREDICTED") {
    return [
      `TARGET: ${n.address}`,
      `STATUS: Off-market · AI predicted seller`,
      `SIGNAL: ${n.signal}`,
      ``,
      `No active listing. This is a pre-market approach — you are not competing against another agent, you are competing against inertia.`,
      ``,
      `PLAY: Hand-written note + a single comparable that beats their assumed value. Do not ask for the listing. Offer the number: "Three buyers on my list would pay ${fmtMoney(n.value)} for this block. Want me to test it quietly?"`,
    ].join("\n");
  }
  return [
    `ASSET: ${n.address}`,
    `STATUS: Your active listing · ${n.dom} days on market`,
    ``,
    n.dom > 30
      ? `Momentum is decaying past the 30-day mark. Refresh photography, reset the price narrative, and re-blast to your buyer list before week six.`
      : `Inside the hot window. Protect the momentum — push open-house volume and capture every showing agent's feedback while attention is peaking.`,
    ``,
    `PLAY: Run comps this week and pre-empt the seller's price conversation before they raise it.`,
  ].join("\n");
}

function buildOutreach(n) {
  if (n.type === "EXPIRING") {
    return `Hi — I'm a local specialist working ${n.address.split(",")[1]?.trim() || "this market"}.

I noticed your home has been on the market about ${n.dom} days. That usually has nothing to do with the house and everything to do with how it's being positioned.

I put together a short breakdown of what's actually moving on your block right now, plus the three changes I'd make in week one. No cost, no pressure — I'll leave it at the door if that's easier.

Would tomorrow morning work?`;
  }
  if (n.type === "PREDICTED") {
    return `Hi — quick note about ${n.address.split(",")[0]}.

I'm not writing to ask you to list. I have buyers actively looking on your street, and based on the last few closings I think your home would test around ${fmtMoney(n.value)}.

If you're ever curious what that number looks like in writing, I'll put it together — no obligation and nothing goes public.

Worth a five-minute conversation?`;
  }
  return `Hi — checking in on ${n.address.split(",")[0]}.

We're at ${n.dom} days on market. Here's where we stand and what I'd like to adjust this week to keep momentum up.

Do you have ten minutes tomorrow?`;
}

// ── Instant CMA ───────────────────────────────────────────────────────────
function buildCma(n, all) {
  const comps = all
    .filter((c) => c.id !== n.id && c.propertyType === n.propertyType)
    .map((c) => ({ ...c, dist: milesFrom(n.lng, n.lat, c.lng, c.lat) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 4);
  const avg = comps.length ? comps.reduce((s, c) => s + c.value, 0) / comps.length : n.value;
  const delta = ((n.value - avg) / avg) * 100;
  return { comps, avg, delta };
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AgentSurveillance({ user }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [synthesized, setSynthesized] = useState(false);
  const [selected, setSelected] = useState(null);
  const [styleId, setStyleId] = useState("tactical");
  const [filter, setFilter] = useState("ALL");

  const [directive, setDirective] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [cma, setCma] = useState(null);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [toast, setToast] = useState(null);

  const mapRef = useRef(null);
  const decryptTimer = useRef(null);
  const setupDone = useRef(false);

  useEffect(() => {
    setDirective(null); setDecrypting(false); setCma(null); setScriptOpen(false);
    if (decryptTimer.current) clearInterval(decryptTimer.current);
  }, [selected?.id]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3600); return () => clearTimeout(t); }, [toast]);

  // ── Load the agent's own listings; synthesize the market grid ──────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const grid = synthesizeGrid();
      const sb = window.__supabase;
      if (!sb || !user?.id) {
        if (!cancelled) { setNodes(grid); setSynthesized(true); setLoading(false); }
        return;
      }
      try {
        const { data, error: dErr } = await sb
          .from("deals")
          .select("id, address, deal_volume, stage, last_activity_at")
          .eq("agent_id", user.id)
          .neq("stage", "closed");
        if (dErr) throw new Error(dErr.message);
        if (cancelled) return;
        // `deals` has no lat/lng (same schema gap the brokerage radar hits),
        // so real listings are anchored around the agent's operating center
        // rather than dropped at a fabricated precise address.
        const mine = (data || []).map((d, i) => ({
          id: d.id, synthetic: false, type: "MINE",
          address: d.address || "Address unavailable",
          lng: MIAMI_BEACH.longitude + ((i % 4) - 1.5) * 0.012,
          lat: MIAMI_BEACH.latitude + (Math.floor(i / 4) - 1) * 0.011,
          value: Number(d.deal_volume) || 0,
          dom: d.last_activity_at ? Math.round((Date.now() - new Date(d.last_activity_at)) / 86400000) : null,
          propertyType: "Single Family", owner: "You", signal: null,
        }));
        const sparse = mine.length < 3;
        setNodes(sparse ? [...mine, ...grid.filter((g) => g.type !== "MINE" || mine.length === 0)] : [...mine, ...grid.filter((g) => g.type !== "MINE")]);
        setSynthesized(true); // competitor + predicted layers are always synthesized
      } catch (err) {
        if (!cancelled) { setError(err.message || "Grid scan failed."); setNodes(grid); setSynthesized(true); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const visible = useMemo(() => filter === "ALL" ? nodes : nodes.filter((n) => n.type === filter), [nodes, filter]);

  const counts = useMemo(() => ({
    MINE: nodes.filter((n) => n.type === "MINE").length,
    EXPIRING: nodes.filter((n) => n.type === "EXPIRING").length,
    PREDICTED: nodes.filter((n) => n.type === "PREDICTED").length,
  }), [nodes]);

  const projectedGci = selected ? selected.value * COMMISSION_RATE : 0;
  const distance = selected ? milesFrom(MIAMI_BEACH.longitude, MIAMI_BEACH.latitude, selected.lng, selected.lat) : 0;

  const handleMapLoad = useCallback((e) => {
    if (setupDone.current) return;
    setupDone.current = true;
    const map = e.target;
    map.resize();
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    map.once("remove", () => window.removeEventListener("resize", onResize));
    try {
      map.setFog({ color: "#050505", "high-color": "#0b0b1a", "horizon-blend": 0.05, "space-color": "#020204", "star-intensity": 0.1 });
    } catch { /* style variant without fog — cosmetic only */ }
  }, []);

  const runDirective = useCallback(() => {
    if (!selected || decrypting) return;
    const full = buildDirective(selected);
    setDecrypting(true); setDirective("");
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let frame = 0; const total = 32;
    decryptTimer.current = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / total) * full.length);
      let out = full.slice(0, reveal);
      for (let i = 0; i < Math.min(15, full.length - reveal); i++) out += chars[Math.floor(Math.random() * chars.length)];
      setDirective(out);
      if (frame >= total) { clearInterval(decryptTimer.current); setDirective(full); setDecrypting(false); }
    }, 38);
  }, [selected, decrypting]);

  const pickNode = useCallback((n) => {
    setSelected(n);
    mapRef.current?.flyTo({ center: [n.lng, n.lat], zoom: 15.2, pitch: 58, duration: 1100, essential: true });
  }, []);

  const addWatchlist = useCallback(() => {
    if (!selected) return;
    if (watchlist.includes(selected.id)) { setToast("Already on your watchlist."); return; }
    setWatchlist((w) => [...w, selected.id]);
    setToast(`${selected.address.split(",")[0]} added to watchlist.`);
  }, [selected, watchlist]);

  const copyScript = useCallback(async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(buildOutreach(selected));
      setCopied(true); setTimeout(() => setCopied(false), 2200);
      setToast("Outreach script copied.");
    } catch { setToast("Copy failed — select and copy manually."); }
  }, [selected]);

  if (loading) return <SparkBoot label="SCANNING MARKET GRID FOR ACQUISITION TARGETS..." />;

  const selMeta = selected ? NODE[selected.type] : null;

  return (
    <div className="w-full h-full relative bg-[#050505] overflow-hidden"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", background: "#050505" }}>
      <style>{`
        @keyframes asPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(2.7);opacity:0}}
        @keyframes asSpin{to{transform:rotate(360deg)}}
        @keyframes asBlink{0%,100%{opacity:1}50%{opacity:.35}}
      `}</style>

      {toast && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 50,
            background: "rgba(6,6,12,0.94)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
            border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
            fontFamily: F, fontSize: 12, fontWeight: 700, boxShadow: `0 0 24px ${CYAN}55`, whiteSpace: "nowrap",
          }}>{toast}</motion.div>
      )}

      {/* ── Map ── */}
      {!MAPBOX_TOKEN ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontFamily: F, fontSize: 13, padding: 24, textAlign: "center" }}>
          Map access token not configured — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN) in .env.local.
        </div>
      ) : (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `calc(100% - ${PANEL_W}px)` }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={MIAMI_BEACH}
            mapStyle={STYLES.find((s) => s.id === styleId).url}
            style={{ position: "absolute", inset: 0 }}
            onLoad={handleMapLoad}
            onStyleData={handleMapLoad}
            onClick={() => setSelected(null)}
          >
            {visible.map((n) => (
              <PulseNode key={n.id} node={n} selected={selected} onPick={pickNode} />
            ))}
          </Map>

          {/* Tactical grid overlay — pure CSS, non-interactive */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
            backgroundImage: `linear-gradient(${CYAN}0c 1px, transparent 1px), linear-gradient(90deg, ${CYAN}0c 1px, transparent 1px)`,
            backgroundSize: "68px 68px",
          }} />
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
            boxShadow: `inset 0 0 140px rgba(0,0,0,0.75)`,
          }} />
          {/* Reticle */}
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 3, opacity: 0.3 }}>
            <Crosshair size={26} color={CYAN} />
          </div>
        </div>
      )}

      {/* ── Radar legend (top-left) ── */}
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 20, width: 246,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 14,
          boxShadow: `0 0 22px rgba(0,0,0,0.6)`,
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <Zap size={15} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: "drop-shadow(0 0 10px rgba(168,85,247,0.6))", animation: "asBlink 2.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.6, color: "#fff" }}>SPARK OS</span>
        </div>
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 7.5, fontWeight: 700, letterSpacing: 2.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 12 }}>
          Radar Legend · Acquisition Grid
        </div>

        {Object.values(NODE).map((m) => {
          const active = filter === "ALL" || filter === m.key;
          return (
            <button key={m.key} onClick={() => setFilter(filter === m.key ? "ALL" : m.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9, marginBottom: 7,
                background: filter === m.key ? `${m.color}16` : "transparent",
                border: `1px solid ${filter === m.key ? `${m.color}66` : "transparent"}`,
                borderRadius: 8, padding: "6px 8px", cursor: "pointer", textAlign: "left",
                opacity: active ? 1 : 0.4, transition: "opacity .15s ease, background .15s ease",
              }}>
              <span style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px solid ${m.color}`, animation: "asPulse 2.4s cubic-bezier(.2,.6,.4,1) infinite" }} />
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
              </span>
              <span style={{ flex: 1, fontFamily: F, fontSize: 10, color: SLATE, whiteSpace: "nowrap" }}>{m.label}</span>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: m.color }}>{counts[m.key]}</span>
            </button>
          );
        })}

        {synthesized && (
          <div className="font-mono" style={{
            marginTop: 10, fontFamily: MONO, fontSize: 7, letterSpacing: 0.6, lineHeight: 1.5,
            color: AMBER, background: `${AMBER}0f`, border: `1px solid ${AMBER}44`,
            borderRadius: 7, padding: "6px 8px",
          }}>
            ⚠ SIMULATED GRID — COMPETITOR &amp; PREDICTED NODES ARE MODELED INTELLIGENCE, NOT AN MLS FEED.
          </div>
        )}

        {/* Style toggle */}
        <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
          {STYLES.map((s) => (
            <button key={s.id} onClick={() => { setupDone.current = false; setStyleId(s.id); }}
              className="font-mono"
              style={{
                flex: 1, fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "6px 0",
                borderRadius: 7, cursor: "pointer", textTransform: "uppercase",
                background: styleId === s.id ? `${CYAN}1e` : "transparent",
                border: `1px solid ${styleId === s.id ? CYAN : "rgba(255,255,255,0.12)"}`,
                color: styleId === s.id ? CYAN : SLATE_DIM,
              }}>
              <Layers size={9} style={{ verticalAlign: -1, marginRight: 4 }} />{s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="font-mono" style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 20, fontFamily: MONO, fontSize: 10.5,
          color: RED, background: "rgba(255,59,92,0.1)", border: `1px solid ${RED}44`,
          borderRadius: 8, padding: "8px 12px", maxWidth: 300,
        }}>{error}</div>
      )}

      {/* ── Acquisition Dossier (right) ── */}
      <div className="w-96 backdrop-blur-2xl bg-black/60 border-l border-white/10 flex flex-col h-full z-10"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL_W, zIndex: 10,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column",
          padding: 18, boxSizing: "border-box", overflowY: "auto",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <RadarIcon size={14} color={selMeta ? selMeta.color : PURPLE_LT} style={{ filter: `drop-shadow(0 0 6px ${selMeta ? selMeta.color : PURPLE}aa)` }} />
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.7, color: "#fff" }}>
            {selected ? "ACQUISITION DOSSIER" : "ACQUISITION GRID"}
          </span>
          {selected && (
            <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={15} /></button>
          )}
        </div>
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 2.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 16 }}>
          {selected ? `Target Lock · ${selMeta.short}` : "Select a node to lock a target"}
        </div>

        {!selected ? (
          /* Idle */
          <>
            <div style={{
              position: "relative", height: 108, borderRadius: 10, overflow: "hidden", marginBottom: 16,
              border: "1px dashed rgba(255,255,255,0.12)",
              backgroundImage: "linear-gradient(rgba(148,163,184,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.07) 1px,transparent 1px)",
              backgroundSize: "16px 16px",
            }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <Crosshair size={22} color={CYAN} style={{ filter: `drop-shadow(0 0 10px ${CYAN})`, animation: "asBlink 2s ease-in-out infinite" }} />
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: SLATE_DIM }}>AWAITING TARGET LOCK</span>
              </div>
            </div>

            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 9 }}>
              Grid Summary
            </div>
            {[["My Active Assets", counts.MINE, CYAN],
              ["Expiring Competitor Inventory", counts.EXPIRING, RED],
              ["AI Predicted Sellers", counts.PREDICTED, PURPLE]].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, boxShadow: `0 0 7px ${c}`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: F, fontSize: 11, color: SLATE }}>{l}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: c }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 6 }}>
                Total Grid Opportunity
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: `0 0 16px ${PURPLE}88` }}>
                {fmtMoney(nodes.filter((n) => n.type !== "MINE").reduce((s, n) => s + n.value * COMMISSION_RATE, 0))}
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE_DIM, marginTop: 3 }}>
                PROJECTED GCI ACROSS {counts.EXPIRING + counts.PREDICTED} OFF-BOOK TARGETS @ 3%
              </div>
            </div>

            {watchlist.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 8 }}>
                  Watchlist · {watchlist.length}
                </div>
                {nodes.filter((n) => watchlist.includes(n.id)).map((n) => (
                  <div key={n.id} onClick={() => pickNode(n)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", cursor: "pointer" }}>
                    <Bookmark size={10} color={NODE[n.type].color} />
                    <span style={{ flex: 1, fontFamily: F, fontSize: 10.5, color: SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.address}</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM }}>{fmtMoney(n.value * COMMISSION_RATE)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Target lock */
          <>
            <div style={{
              border: `1px solid ${selMeta.color}44`, borderRadius: 12, padding: 14, marginBottom: 13,
              background: "rgba(255,255,255,0.02)", boxShadow: `inset 0 0 26px ${selMeta.color}0d`,
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
                <MapPin size={14} color={selMeta.color} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>{selected.address}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11, flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, color: selMeta.color,
                  background: `${selMeta.color}14`, border: `1px solid ${selMeta.color}55`, borderRadius: 999,
                  padding: "3px 9px", boxShadow: `0 0 8px ${selMeta.color}33`,
                }}>{selMeta.short}</span>
                {selected.synthetic && (
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
                )}
                <span style={{ fontFamily: F, fontSize: 10, color: SLATE_DIM, marginLeft: "auto" }}>{selected.propertyType}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {/* Owner spans both columns and wraps — the string is a sentence, not a metric. */}
                {[["Estimated Value", fmtMoney(selected.value), "#fff", false],
                  ["Days on Market", selected.dom != null ? `${selected.dom}d` : "OFF-MARKET", selected.dom > 90 ? RED : SLATE, false],
                  ["Distance", `${distance.toFixed(1)} mi`, SLATE, false],
                  ["Owner", selected.owner, SLATE, true]].map(([l, v, c, wide]) => (
                  <div key={l} style={{ minWidth: 0, gridColumn: wide ? "1 / -1" : "auto" }}>
                    <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 2 }}>{l}</div>
                    <div className="font-mono" style={{
                      fontFamily: MONO, fontSize: wide ? 10.5 : 12, fontWeight: wide ? 600 : 800, color: c,
                      ...(wide ? { lineHeight: 1.45 } : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }),
                    }}>{v}</div>
                  </div>
                ))}
              </div>

              {selected.signal && (
                <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3 }}>Predictive Signal</div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: PURPLE_LT }}>{selected.signal}</div>
                </div>
              )}
            </div>

            {/* Projected GCI */}
            <div style={{
              border: `1px solid ${GREEN}44`, borderRadius: 11, padding: 13, marginBottom: 13,
              background: `linear-gradient(135deg,${GREEN}10,rgba(0,0,0,0.25))`,
            }}>
              <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8, letterSpacing: 1.5, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>Projected GCI</div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: GREEN, textShadow: `0 0 16px ${GREEN}88` }}>
                {fmtFull(projectedGci)}
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginTop: 3 }}>
                {fmtFull(projectedGci)} AT 3% ON {fmtMoney(selected.value)}
              </div>
            </div>

            {/* AI tactical directive */}
            <button onClick={runDirective} disabled={decrypting}
              style={{
                width: "100%", background: decrypting ? `${PURPLE}22` : `linear-gradient(135deg,#7c3aed,${PURPLE})`,
                border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "11px 14px",
                fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", cursor: decrypting ? "default" : "pointer",
                boxShadow: decrypting ? "none" : `0 0 15px ${PURPLE}88`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
              }}>
              {decrypting ? <Loader2 size={13} style={{ animation: "asSpin 1s linear infinite" }} /> : <Zap size={13} />}
              {decrypting ? "Decrypting…" : "AI Tactical Directive"}
            </button>

            {directive != null && (
              <pre className="bg-black/80 font-mono text-xs" style={{
                background: "rgba(0,0,0,0.85)", border: `1px solid ${PURPLE}44`, borderRadius: 10, padding: 12,
                fontFamily: MONO, fontSize: 10, lineHeight: 1.6, color: "#e9d5ff", whiteSpace: "pre-wrap",
                wordBreak: "break-word", margin: "0 0 13px", maxHeight: 210, overflowY: "auto",
              }}>{directive}</pre>
            )}

            {/* CMA output */}
            {cma && (
              <div style={{ border: `1px solid ${CYAN}44`, borderRadius: 10, padding: 12, marginBottom: 13, background: "rgba(255,255,255,0.02)" }}>
                <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8, letterSpacing: 1.5, color: CYAN, textTransform: "uppercase", marginBottom: 9 }}>
                  Instant CMA · {cma.comps.length} Comparables
                </div>
                {cma.comps.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: NODE[c.type].color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontFamily: F, fontSize: 9.5, color: SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address.split(",")[0]}</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM }}>{c.dist.toFixed(2)}mi</span>
                    <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: "#fff" }}>{fmtMoney(c.value)}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9 }}>
                  <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase" }}>Comp Average</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: "#fff" }}>{fmtMoney(cma.avg)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                  <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase" }}>Subject vs Comps</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 11, fontWeight: 800, color: cma.delta >= 0 ? AMBER : GREEN }}>
                    {cma.delta >= 0 ? "+" : ""}{cma.delta.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}

            {/* Offensive action bridges */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={() => { setCma(buildCma(selected, nodes)); setToast("Instant CMA synthesized."); }}
                style={{
                  width: "100%", background: `${CYAN}1c`, border: `1px solid ${CYAN}77`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: CYAN, cursor: "pointer", boxShadow: `0 0 14px ${CYAN}55`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <FileText size={13} /> [ Generate Instant CMA ]
              </button>
              <button onClick={() => setScriptOpen(true)}
                style={{
                  width: "100%", background: `${PURPLE}1c`, border: `1px solid ${PURPLE}88`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: PURPLE_LT, cursor: "pointer", boxShadow: `0 0 14px ${PURPLE}66`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <MessageSquare size={13} /> [ Draft Outreach Script ]
              </button>
              <button onClick={addWatchlist}
                style={{
                  width: "100%", background: "transparent", border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10,
                  padding: "10px 14px", fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: watchlist.includes(selected.id) ? GREEN : SLATE,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <Bookmark size={12} fill={watchlist.includes(selected.id) ? GREEN : "none"} />
                {watchlist.includes(selected.id) ? "[ On Watchlist ]" : "[ Add to Watchlist ]"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Outreach script modal ── */}
      {scriptOpen && selected && (
        <div onClick={() => setScriptOpen(false)}
          style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}
            className="backdrop-blur-2xl bg-black/60 border border-white/10"
            style={{
              width: "min(560px, 100%)", maxHeight: "82%", overflowY: "auto",
              background: "rgba(6,6,12,0.92)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
              border: `1px solid ${PURPLE}55`, borderRadius: 14, padding: 20,
              boxShadow: `0 0 46px ${PURPLE}44`,
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <MessageSquare size={15} color={PURPLE_LT} />
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, letterSpacing: 1.4, color: "#fff" }}>OUTREACH SCRIPT</span>
              <button onClick={() => setScriptOpen(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={16} /></button>
            </div>
            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 15 }}>
              {selected.address}
            </div>
            <pre className="bg-black/80 font-mono text-xs" style={{
              background: "rgba(0,0,0,0.7)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10,
              padding: 14, fontFamily: MONO, fontSize: 11, lineHeight: 1.65, color: SLATE,
              whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 15px",
            }}>{buildOutreach(selected)}</pre>
            <button onClick={copyScript}
              style={{
                width: "100%", background: copied ? `${GREEN}1e` : `linear-gradient(135deg,#7c3aed,${PURPLE})`,
                border: `1px solid ${copied ? GREEN : PURPLE}88`, borderRadius: 10, padding: "12px 14px",
                fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: copied ? GREEN : "#fff", cursor: "pointer",
                boxShadow: copied ? "none" : `0 0 16px ${PURPLE}88`,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? "Copied to Clipboard" : "Copy Script"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
