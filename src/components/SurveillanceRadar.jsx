// src/components/SurveillanceRadar.jsx — SPARK OS Surveillance Radar: a
// full-screen market intelligence terminal. Live RentCast listings flow in
// through the secure server-side proxy at api/market/surveillance.js (the
// RentCast X-Api-Key only ever exists in that Vercel function's env — the
// frontend just calls /api/market/surveillance), rendered on a 3D Mapbox
// scene with switchable intelligence layers, and any target can be pushed
// straight into an agent's pipeline via a Supabase `deals` insert.
//
// Standing adaptations, same rationale as every other Operations-suite file
// (see InterventionEngine.jsx for the full write-up):
//
// 1. Styling: no Tailwind is configured in this app — requested className
//    strings are kept (free upgrade if Tailwind ever lands) and backed by
//    equivalent inline styles.
//
// 2. Supabase client: this app's working client is `window.__supabase`
//    (lazily CDN-created in App.jsx); there is no lib/supabaseClient module.
//
// 3. Schema: there is no `profiles`/`agents`/`pipeline` table — agents live
//    in `users` (scoped by brokerage_id) and pipeline rows live in `deals`,
//    whose `stage` column already has exactly the requested 'prospect'
//    value. The deploy inserts a `deals` row with stage='prospect'.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Source, Layer } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  Zap, Radar as RadarIcon, Layers, Search, Crosshair, MapPin, Loader2, Send, X,
} from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MIAMI_CENTER = { longitude: -80.1918, latitude: 25.7617, zoom: 13, pitch: 50, bearing: -15 };

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const PURPLE = "#a855f7";
const PURPLE_LT = "#c084fc";
const CYAN = "#22d3ee";
const GREEN = "#22C55E";
const AMBER = "#ffb020";
const RED = "#ff3b5c";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const CATEGORY_COLOR = { fresh: CYAN, price_cut: RED, stale: AMBER, standard: "#8CA0FF" };
const CATEGORY_LABEL = {
  fresh: "Fresh Capital (< 7 days)",
  price_cut: "Distressed (price cut)",
  stale: "Stagnant (> 60 days)",
  standard: "Standard",
};

const INTEL_LAYERS = [
  { id: "default", label: "Default Radar" },
  { id: "heatmap", label: "Liquidity Heatmap" },
  { id: "accumulation", label: "Institutional Accumulation" },
];

function fmtMoney(n) {
  if (n == null) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function firstName(email) {
  if (!email) return "Unassigned";
  const local = email.split("@")[0];
  return local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── AI Acquisition Script (rule-based, decrypted char-by-char) ────────────
function buildAcquisitionScript(p) {
  const price = p.price != null ? fmtMoney(p.price) : "the current ask";
  const dom = p.daysOnMarket;
  const leverage = dom != null && dom > 45
    ? `The asset has sat ${dom} days — seller leverage is materially eroded. Open 6-8% under ask.`
    : dom != null && dom < 7
      ? `Only ${dom} days on market — move fast, anchor near ask with clean terms to pre-empt competition.`
      : `At ${dom ?? "unknown"} days on market, pressure is balanced — anchor 3-4% under ask with a short close window.`;
  return [
    `TARGET: ${p.address || "Unknown asset"} (${p.propertyType || "Residential"})`,
    `LIST: ${price} · DOM: ${dom ?? "—"}`,
    ``,
    `OPENING POSITION: ${leverage}`,
    `TERMS LEVER: Offer a 14-day inspection-light close in exchange for the price concession — speed is the currency here.`,
    `CLOSE LINE: "We're prepared to wire earnest money today. What number makes this done by Friday?"`,
  ].join("\n");
}

// ── UI atoms ──────────────────────────────────────────────────────────────

function StatTile({ label, value, accent = "#fff" }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 800, color: accent, textShadow: accent !== "#fff" ? `0 0 12px ${accent}66` : "none", whiteSpace: "nowrap" }}>
        {value}
      </div>
    </div>
  );
}

function Directive({ color, label, text }) {
  return (
    <div
      style={{
        border: `1px solid ${color}55`, borderRadius: 10, padding: "10px 12px", marginBottom: 10,
        background: `linear-gradient(135deg, ${color}10, rgba(0,0,0,0.3))`,
        boxShadow: `inset 0 0 22px ${color}0d, 0 0 12px ${color}1a`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}`, animation: "srBlink 1.6s ease-in-out infinite" }} />
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div className="sr-scanline" style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.55, color: SLATE }}>
        {text}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function SurveillanceRadar({ user }) {
  const [query, setQuery] = useState("Miami, FL");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [geojson, setGeojson] = useState({ type: "FeatureCollection", features: [] });
  const [stats, setStats] = useState({ avgDom: null, medianPrice: null, activeCount: 0 });
  const [selected, setSelected] = useState(null);
  const [intelLayer, setIntelLayer] = useState("default");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [buildingsReady, setBuildingsReady] = useState(false);

  // Micro-mode state
  const [scriptText, setScriptText] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState(null);

  const mapRef = useRef(null);
  const decryptTimer = useRef(null);

  // Reset micro-mode artifacts whenever the target changes
  useEffect(() => {
    setScriptText(null);
    setDecrypting(false);
    if (decryptTimer.current) clearInterval(decryptTimer.current);
  }, [selected]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Field agents for the delegation dropdown — `users` scoped by brokerage
  useEffect(() => {
    if (!user?.brokerageId) return;
    let cancelled = false;
    (async () => {
      const sb = window.__supabase;
      if (!sb) return;
      const { data } = await sb.from("users").select("id, email, role").eq("brokerage_id", user.brokerageId);
      if (!cancelled && data) {
        const list = data.filter((u) => u.role !== "broker");
        const finalList = list.length ? list : data;
        setAgents(finalList);
        setSelectedAgentId((prev) => prev || finalList[0]?.id || "");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.brokerageId]);

  // ── Scans ──────────────────────────────────────────────────────────────
  const applyScanResult = useCallback((data) => {
    setGeojson(data.geojson || { type: "FeatureCollection", features: [] });
    setStats(data.aggregateStats || { avgDom: null, medianPrice: null, activeCount: 0 });
    if (!data.success) setError(data.error || "Scan returned no data.");
  }, []);

  const runScan = useCallback(async (e) => {
    e?.preventDefault?.();
    const trimmed = query.trim();
    if (!trimmed || scanning) return;
    setScanning(true);
    setError(null);
    setSelected(null);
    try {
      const isZip = /^\d{5}$/.test(trimmed);
      const params = new URLSearchParams(isZip ? { zipCode: trimmed } : { cityState: trimmed });
      const res = await fetch(`/api/market/surveillance?${params.toString()}`);
      const data = await res.json();
      applyScanResult(data);
      const first = data.geojson?.features?.[0];
      if (first && mapRef.current) {
        const [lng, lat] = first.geometry.coordinates;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 13, pitch: 50, duration: 900 });
      }
    } catch (err) {
      setError(err.message || "Scan failed — try again.");
    } finally {
      setScanning(false);
    }
  }, [query, scanning, applyScanResult]);

  // Viewport scan — collapses the current map bounding box to center+radius
  // (miles), which is the shape RentCast's API accepts server-side.
  const scanViewport = useCallback(async () => {
    const map = mapRef.current?.getMap?.();
    if (!map || scanning) return;
    setScanning(true);
    setError(null);
    setSelected(null);
    try {
      const bounds = map.getBounds();
      const center = bounds.getCenter();
      const ne = bounds.getNorthEast();
      const latMiles = Math.abs(ne.lat - center.lat) * 69;
      const lngMiles = Math.abs(ne.lng - center.lng) * 69 * Math.cos((center.lat * Math.PI) / 180);
      const radius = Math.max(1, Math.min(50, Math.sqrt(latMiles ** 2 + lngMiles ** 2)));
      const params = new URLSearchParams({
        latitude: center.lat.toFixed(5),
        longitude: center.lng.toFixed(5),
        radius: radius.toFixed(1),
      });
      const res = await fetch(`/api/market/surveillance?${params.toString()}`);
      const data = await res.json();
      applyScanResult(data);
    } catch (err) {
      setError(err.message || "Viewport scan failed — try again.");
    } finally {
      setScanning(false);
    }
  }, [scanning, applyScanResult]);

  // ── Macro aggregates ───────────────────────────────────────────────────
  const macro = useMemo(() => {
    const feats = geojson.features;
    const total = feats.length;
    const totalVolume = feats.reduce((sum, f) => sum + (Number(f.properties.price) || 0), 0);
    const priceCuts = feats.filter((f) => f.properties.category === "price_cut").length;
    return {
      total,
      totalVolume,
      priceCutVelocity: total ? (priceCuts / total) * 100 : 0,
      stalePct: total ? (feats.filter((f) => f.properties.category === "stale").length / total) * 100 : 0,
      freshCount: feats.filter((f) => f.properties.category === "fresh").length,
    };
  }, [geojson]);

  // Sparkline: listing density binned by days-on-market (momentum profile)
  const sparkData = useMemo(() => {
    const feats = geojson.features;
    if (!feats.length) return [];
    const bins = Array.from({ length: 12 }, (_, i) => ({ bin: i, count: 0 }));
    feats.forEach((f) => {
      const dom = f.properties.daysOnMarket;
      if (dom == null) return;
      const idx = Math.min(11, Math.floor(dom / 10));
      bins[idx].count += 1;
    });
    return bins;
  }, [geojson]);

  const directives = useMemo(() => {
    if (!macro.total) {
      return [
        { color: RED, label: "Danger", text: "Awaiting sector scan — no threat telemetry." },
        { color: GREEN, label: "Opportunity", text: "Run a scan to surface acquisition targets." },
        { color: CYAN, label: "Action", text: "Position the map and scan the viewport for live inventory." },
      ];
    }
    return [
      {
        color: RED, label: "Danger",
        text: macro.stalePct >= 20
          ? `Stale density at ${macro.stalePct.toFixed(0)}% of sector — buyer leverage elevated, expect drawn-out negotiations.`
          : "Stale density nominal — no elevated sector risk detected.",
      },
      {
        color: GREEN, label: "Opportunity",
        text: macro.priceCutVelocity > 0
          ? `Price-cut velocity at ${macro.priceCutVelocity.toFixed(0)}% — distressed cluster forming. Prime for below-ask acquisition sweeps.`
          : "No distressed clusters detected this scan.",
      },
      {
        color: CYAN, label: "Action",
        text: macro.freshCount > 0
          ? `${macro.freshCount} fresh listing${macro.freshCount === 1 ? "" : "s"} (<7d) detected — deploy field agents before competing offers land.`
          : "No fresh inventory this cycle — monitor and rescan.",
      },
    ];
  }, [macro]);

  // ── Micro mode actions ─────────────────────────────────────────────────
  const generateScript = useCallback(() => {
    if (!selected || decrypting) return;
    const full = buildAcquisitionScript(selected.properties);
    setDecrypting(true);
    setScriptText("");
    const chars = "!<>-_\\/[]{}—=+*^?#________";
    let frame = 0;
    const totalFrames = 30;
    decryptTimer.current = setInterval(() => {
      frame += 1;
      const reveal = Math.floor((frame / totalFrames) * full.length);
      let out = full.slice(0, reveal);
      for (let i = 0; i < Math.min(14, full.length - reveal); i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
      }
      setScriptText(out);
      if (frame >= totalFrames) {
        clearInterval(decryptTimer.current);
        setScriptText(full);
        setDecrypting(false);
      }
    }, 40);
  }, [selected, decrypting]);

  const deployToPipeline = useCallback(async () => {
    if (!selected || !selectedAgentId || deploying) return;
    const sb = window.__supabase;
    if (!sb) { setToast("Deploy failed: Supabase isn't initialized yet."); return; }
    const p = selected.properties;
    const agent = agents.find((a) => a.id === selectedAgentId);
    setDeploying(true);
    try {
      const { error: insertError } = await sb.from("deals").insert({
        brokerage_id: user?.brokerageId,
        agent_id: selectedAgentId,
        address: p.address || "Unknown address",
        stage: "prospect",
        status: "on_track",
        deal_volume: Number(p.price) || 0,
        gci: Math.round((Number(p.price) || 0) * 0.03),
      });
      if (insertError) throw new Error(insertError.message);
      setToast(`Target deployed to ${firstName(agent?.email)}'s pipeline as PROSPECT.`);
    } catch (err) {
      setToast(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [selected, selectedAgentId, deploying, agents, user?.brokerageId]);

  // 3D buildings — dark-v11's composite source carries a `building` layer;
  // extrude it once the style loads for physical depth under pitch/zoom.
  const handleMapLoad = useCallback((e) => {
    const map = e.target;
    if (map.getLayer("sr-3d-buildings")) return;
    try {
      map.addLayer({
        id: "sr-3d-buildings",
        source: "composite",
        "source-layer": "building",
        filter: ["==", "extrude", "true"],
        type: "fill-extrusion",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": "#1a1a24",
          "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["get", "height"]],
          "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 13, 0, 14.5, ["get", "min_height"]],
          "fill-extrusion-opacity": 0.75,
        },
      });
      setBuildingsReady(true);
    } catch {
      // style variant without a building layer — map still fully usable flat
    }
  }, []);

  const selCat = selected?.properties?.category;
  const selColor = CATEGORY_COLOR[selCat] || PURPLE_LT;

  return (
    <div
      className="w-full h-full relative bg-[#050505] overflow-hidden"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", background: "#050505" }}
    >
      <style>{`
        @keyframes srBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes srPulse { 0% { transform: scale(0.7); opacity: 0.9; } 100% { transform: scale(2.4); opacity: 0; } }
        @keyframes srScan { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        .sr-scanline {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
          background-size: 200px 100%; background-repeat: no-repeat;
          animation: srScan 2.8s linear infinite;
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 40,
            background: "rgba(8,8,14,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${toast.startsWith("Deploy failed") ? RED : PURPLE}88`,
            borderRadius: 10, padding: "10px 18px", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700,
            boxShadow: `0 0 22px ${toast.startsWith("Deploy failed") ? RED : PURPLE}55`, whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {!MAPBOX_TOKEN ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontFamily: F, fontSize: 13, padding: 24, textAlign: "center" }}>
          Mapbox access token not configured — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN) in .env.local.
        </div>
      ) : (
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={MIAMI_CENTER}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ position: "absolute", inset: 0, right: 384 }}
          cursor={hovering ? "pointer" : "grab"}
          interactiveLayerIds={intelLayer === "heatmap" ? [] : ["sr-nodes"]}
          onLoad={handleMapLoad}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={(e) => setSelected(e.features?.[0] || null)}
        >
          <Source id="sr-source" type="geojson" data={geojson}>
            {intelLayer === "default" && (
              <>
                <Layer
                  id="sr-glow"
                  source="sr-source"
                  type="circle"
                  paint={{
                    "circle-radius": 15,
                    "circle-color": ["match", ["get", "category"], "fresh", CYAN, "price_cut", RED, "stale", AMBER, "#8CA0FF"],
                    "circle-blur": 1.1,
                    "circle-opacity": 0.4,
                  }}
                />
                <Layer
                  id="sr-nodes"
                  source="sr-source"
                  type="circle"
                  paint={{
                    "circle-radius": 6,
                    "circle-color": ["match", ["get", "category"], "fresh", CYAN, "price_cut", RED, "stale", AMBER, "#8CA0FF"],
                    "circle-stroke-width": 1.5,
                    "circle-stroke-color": "rgba(0,0,0,0.7)",
                    "circle-opacity": 0.95,
                  }}
                />
              </>
            )}
            {intelLayer === "heatmap" && (
              <Layer
                id="sr-heat"
                source="sr-source"
                type="heatmap"
                paint={{
                  "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "price"], 0], 0, 0.2, 5000000, 1],
                  "heatmap-intensity": 1.1,
                  "heatmap-radius": 42,
                  "heatmap-opacity": 0.85,
                  "heatmap-color": [
                    "interpolate", ["linear"], ["heatmap-density"],
                    0, "rgba(0,0,0,0)",
                    0.25, "rgba(34,211,238,0.35)",
                    0.5, "rgba(168,85,247,0.55)",
                    0.8, "rgba(255,59,92,0.75)",
                    1, "rgba(255,176,32,0.95)",
                  ],
                }}
              />
            )}
            {intelLayer === "accumulation" && (
              <>
                <Layer
                  id="sr-acc-glow"
                  source="sr-source"
                  type="circle"
                  paint={{
                    "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "price"], 0], 500000, 10, 25000000, 42],
                    "circle-color": PURPLE,
                    "circle-blur": 1.2,
                    "circle-opacity": 0.35,
                  }}
                />
                <Layer
                  id="sr-nodes"
                  source="sr-source"
                  type="circle"
                  paint={{
                    "circle-radius": ["interpolate", ["linear"], ["coalesce", ["get", "price"], 0], 500000, 4, 25000000, 16],
                    "circle-color": PURPLE_LT,
                    "circle-stroke-width": 1.5,
                    "circle-stroke-color": "rgba(255,255,255,0.85)",
                    "circle-opacity": 0.9,
                  }}
                />
              </>
            )}
          </Source>
        </Map>
      )}

      {/* Brand chip — SPARK OS */}
      <div
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 20, display: "flex", alignItems: "center", gap: 9,
          background: "rgba(0,0,0,0.55)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)",
          border: "1px solid rgba(168,85,247,0.35)", borderRadius: 12, padding: "9px 14px",
          boxShadow: "0 0 18px rgba(168,85,247,0.25)",
        }}
      >
        <Zap
          size={17}
          className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse"
          color={PURPLE_LT}
          fill={PURPLE_LT}
          style={{ filter: "drop-shadow(0 0 10px rgba(168,85,247,0.8))", animation: "srBlink 2.2s ease-in-out infinite" }}
        />
        <div>
          <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, letterSpacing: 2, color: "#fff", lineHeight: 1.1 }}>SPARK OS</div>
          <div style={{ fontFamily: F, fontSize: 7.5, fontWeight: 700, letterSpacing: 2.5, color: SLATE_DIM, textTransform: "uppercase" }}>Surveillance Radar</div>
        </div>
      </div>

      {/* Search HUD */}
      <form
        onSubmit={runScan}
        className="absolute z-10 bg-black/50 backdrop-blur-md border border-white/10 rounded-xl p-2 flex gap-2"
        style={{
          position: "absolute", top: 76, left: 16, zIndex: 10,
          background: "rgba(0,0,0,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.12)", borderRadius: 12, padding: 8,
          display: "flex", gap: 8, alignItems: "center",
        }}
      >
        <Search size={13} color={SLATE_DIM} style={{ marginLeft: 4, flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, ST or ZIP…"
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            color: "#fff", fontFamily: F, fontSize: 12, padding: "8px 10px", outline: "none", width: 170,
          }}
        />
        <button
          type="submit"
          disabled={scanning}
          style={{
            background: scanning ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.3)",
            border: `1px solid ${PURPLE}66`, color: PURPLE_LT, fontFamily: F, fontSize: 10.5, fontWeight: 800,
            letterSpacing: 1, borderRadius: 8, padding: "8px 12px", cursor: scanning ? "default" : "pointer",
            textTransform: "uppercase", whiteSpace: "nowrap", boxShadow: scanning ? "none" : "0 0 15px rgba(168,85,247,0.5)",
          }}
        >
          {scanning ? "Scanning…" : "Scan Sector"}
        </button>
        <button
          type="button"
          onClick={scanViewport}
          disabled={scanning}
          title="Scan current map viewport"
          style={{
            background: "rgba(34,211,238,0.12)", border: `1px solid ${CYAN}55`, color: CYAN,
            borderRadius: 8, padding: "8px 10px", cursor: scanning ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6, fontFamily: F, fontSize: 10.5, fontWeight: 800,
            letterSpacing: 0.8, textTransform: "uppercase", whiteSpace: "nowrap",
          }}
        >
          <Crosshair size={12} />
          Viewport
        </button>
      </form>

      {/* Intelligence Layers toggle */}
      <div style={{ position: "absolute", top: 136, left: 16, zIndex: 10 }}>
        <button
          onClick={() => setLayerMenuOpen((o) => !o)}
          className="bg-black/50 backdrop-blur-md border border-white/10"
          style={{
            display: "flex", alignItems: "center", gap: 8, background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, padding: "9px 13px",
            color: "#fff", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8,
            textTransform: "uppercase", cursor: "pointer",
          }}
        >
          <Layers size={13} color={PURPLE_LT} />
          {INTEL_LAYERS.find((l) => l.id === intelLayer)?.label}
        </button>
        {layerMenuOpen && (
          <div
            style={{
              marginTop: 6, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, overflow: "hidden", width: 230,
            }}
          >
            {INTEL_LAYERS.map((l) => (
              <button
                key={l.id}
                onClick={() => { setIntelLayer(l.id); setLayerMenuOpen(false); }}
                style={{
                  display: "block", width: "100%", textAlign: "left", background: intelLayer === l.id ? "rgba(168,85,247,0.18)" : "transparent",
                  border: "none", borderLeft: `2px solid ${intelLayer === l.id ? PURPLE : "transparent"}`,
                  color: intelLayer === l.id ? PURPLE_LT : SLATE, fontFamily: F, fontSize: 11, fontWeight: 700,
                  padding: "10px 14px", cursor: "pointer",
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Intelligence HUD (right panel) ── */}
      <div
        className="w-96 backdrop-blur-2xl bg-black/60 border-l border-white/10 flex flex-col h-full z-10"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 384, zIndex: 10,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          borderLeft: "1px solid rgba(255,255,255,0.1)", display: "flex", flexDirection: "column",
          padding: 18, boxSizing: "border-box", overflowY: "auto",
        }}
      >
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <RadarIcon size={14} color={PURPLE_LT} style={{ filter: `drop-shadow(0 0 6px ${PURPLE}aa)` }} />
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.8, color: "#fff" }}>
            {selected ? "TARGET LOCK DOSSIER" : "SECTOR TELEMETRY"}
          </span>
          {selected && (
            <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}>
              <X size={15} />
            </button>
          )}
        </div>
        <div style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 2.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 16 }}>
          {selected ? "Micro Mode · Asset Analysis" : "Macro Mode · Live RentCast Feed"}
        </div>

        {error && (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {!selected ? (
          /* ── MACRO MODE ── */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <StatTile label="Active Listings" value={stats.activeCount ?? "—"} accent={CYAN} />
              <StatTile label="Total Active Volume" value={fmtMoney(macro.totalVolume)} accent={PURPLE_LT} />
              <StatTile label="Avg Days on Market" value={stats.avgDom != null ? `${stats.avgDom}d` : "—"} />
              <StatTile label="Price-Cut Velocity" value={macro.total ? `${macro.priceCutVelocity.toFixed(0)}%` : "—"} accent={macro.priceCutVelocity > 15 ? RED : "#fff"} />
            </div>

            {/* Momentum sparkline — listing density by DOM decile */}
            <div style={{ height: 54, marginBottom: 4 }}>
              {sparkData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="srSpark" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={PURPLE} stopOpacity={0.6} />
                        <stop offset="100%" stopColor={PURPLE} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="count" stroke={PURPLE_LT} strokeWidth={1.5} fill="url(#srSpark)" isAnimationActive={false} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9.5, color: SLATE_DIM, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8 }}>
                  DENSITY PROFILE — AWAITING SCAN
                </div>
              )}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: SLATE_DIM, marginBottom: 16, textAlign: "center" }}>
              LISTING DENSITY BY DOM DECILE (0 → 120d+)
            </div>

            <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: SLATE_DIM, marginBottom: 8, textTransform: "uppercase" }}>
              Tactical Directives
            </div>
            {directives.map((d) => <Directive key={d.label} {...d} />)}

            <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: SLATE_DIM, margin: "10px 0 8px", textTransform: "uppercase" }}>
              Category Legend
            </div>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 10.5, fontFamily: F, color: SLATE }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLOR[key], boxShadow: `0 0 6px ${CATEGORY_COLOR[key]}` }} />
                {label}
              </div>
            ))}

            <div style={{ marginTop: "auto", paddingTop: 14, fontFamily: MONO, fontSize: 9, color: SLATE_DIM, letterSpacing: 0.5 }}>
              {geojson.features.length > 0
                ? `${geojson.features.length} nodes plotted · click a node to lock target`
                : buildingsReady ? "3D terrain online · run a scan to populate the radar" : "Run a scan to populate the radar"}
            </div>
          </>
        ) : (
          /* ── MICRO MODE ── */
          <>
            <div
              style={{
                border: `1px solid ${selColor}55`, borderRadius: 12, padding: 14, marginBottom: 14,
                background: "rgba(255,255,255,0.02)", boxShadow: `inset 0 0 26px ${selColor}0d`,
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                <MapPin size={14} color={selColor} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>
                  {selected.properties.address || "Address unavailable"}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
                <StatTile label="List Price" value={selected.properties.formattedPrice || fmtMoney(selected.properties.price)} accent={PURPLE_LT} />
                <StatTile label="Days on Market" value={selected.properties.daysOnMarket != null ? `${selected.properties.daysOnMarket}d` : "—"} accent={selColor} />
                <StatTile label="Type" value={selected.properties.propertyType || "—"} />
                <StatTile label="Beds / Baths" value={`${selected.properties.bedrooms ?? "—"} / ${selected.properties.bathrooms ?? "—"}`} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: selColor, textTransform: "uppercase" }}>
                {CATEGORY_LABEL[selCat] || "Standard"}
              </div>
            </div>

            <button
              onClick={generateScript}
              disabled={decrypting}
              className="shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              style={{
                width: "100%", background: decrypting ? "rgba(168,85,247,0.15)" : "linear-gradient(135deg,#7c3aed,#a855f7)",
                border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "12px 14px",
                fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", cursor: decrypting ? "default" : "pointer",
                boxShadow: decrypting ? "none" : "0 0 15px rgba(168,85,247,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
              }}
            >
              {decrypting ? <Loader2 size={13} style={{ animation: "srSpin 1s linear infinite" }} /> : <Zap size={13} />}
              {decrypting ? "Decrypting…" : "Generate AI Acquisition Script"}
            </button>
            <style>{`@keyframes srSpin { to { transform: rotate(360deg); } }`}</style>

            {scriptText != null && (
              <pre
                className="bg-black/80 font-mono text-xs"
                style={{
                  background: "rgba(0,0,0,0.85)", border: `1px solid ${PURPLE}44`, borderRadius: 10,
                  padding: 12, fontFamily: MONO, fontSize: 10.5, lineHeight: 1.6, color: "#e9d5ff",
                  whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 14px",
                }}
              >
                {scriptText}
              </pre>
            )}

            {/* Pipeline assignment */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
              <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: SLATE_DIM, marginBottom: 8, textTransform: "uppercase" }}>
                Delegate to Field Agent
              </div>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                disabled={!agents.length || deploying}
                style={{
                  width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 8, color: "#fff", fontFamily: F, fontSize: 11.5, padding: "9px 10px",
                  outline: "none", marginBottom: 10, cursor: agents.length ? "pointer" : "default",
                }}
              >
                {agents.length ? (
                  agents.map((a) => (
                    <option key={a.id} value={a.id} style={{ background: "#0a0a0d" }}>{firstName(a.email)} — {a.email}</option>
                  ))
                ) : (
                  <option value="">No agents available</option>
                )}
              </select>
              <button
                onClick={deployToPipeline}
                disabled={!selectedAgentId || deploying}
                style={{
                  width: "100%", background: deploying ? "rgba(34,211,238,0.12)" : "rgba(34,211,238,0.2)",
                  border: `1px solid ${CYAN}77`, borderRadius: 10, padding: "11px 14px",
                  fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                  color: CYAN, cursor: !selectedAgentId || deploying ? "default" : "pointer",
                  boxShadow: deploying ? "none" : `0 0 14px ${CYAN}44`,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  opacity: !selectedAgentId ? 0.5 : 1,
                }}
              >
                {deploying ? <Loader2 size={13} style={{ animation: "srSpin 1s linear infinite" }} /> : <Send size={13} />}
                {deploying ? "Deploying…" : "Deploy to Agent Pipeline"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
