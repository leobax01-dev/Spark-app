// src/components/SurveillanceRadar.jsx — SPARK OS Surveillance Radar: an
// institutional quant terminal. Live listings flow in through the secure
// server-side proxy at api/market/surveillance.js (the upstream data
// vendor's API key only ever exists in that Vercel function's env — the
// frontend just calls /api/market/surveillance), rendered on a rotating 3D
// globe with atmospheric fog, cinematic scan fly-ins, switchable
// intelligence layers (including a turf-built 3D hex-grid), and a
// mapbox-gl-draw polygon lasso that re-aggregates the entire telemetry
// suite for any hand-drawn micro-market.
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
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import * as turf from "@turf/turf";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import {
  Zap, Radar as RadarIcon, Layers, Search, Crosshair, MapPin, Loader2, Send, X, Hexagon, PenTool, Eraser,
} from "lucide-react";

const MAPBOX_TOKEN = import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const PANEL_W = 384;

// Idle state: pulled back to a slow-rotating globe; SCAN SECTOR dives in.
const GLOBE_IDLE = { longitude: -60, latitude: 22, zoom: 1.6, pitch: 0, bearing: 0 };

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const CYAN = "#38bdf8";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const CATEGORY_COLOR = { fresh: CYAN, price_cut: RED, stale: AMBER, standard: "#a78bfa" };
const CATEGORY_LABEL = {
  fresh: "Fresh Capital (< 7 days)",
  price_cut: "Distressed (price cut)",
  stale: "Stagnant (> 60 days)",
  standard: "Standard",
};

const INTEL_LAYERS = [
  { id: "default", label: "Default Radar" },
  { id: "heatmap", label: "Liquidity Heatmap" },
  { id: "hexgrid", label: "3D Hex-Grid" },
  { id: "accumulation", label: "Institutional Accumulation" },
];

function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function median(nums) {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
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
    `1. OPENING POSITION: ${leverage}`,
    `2. TERMS LEVER: Offer a 14-day inspection-light close in exchange for the price concession — speed is the currency here.`,
    `3. CLOSE LINE: "We're prepared to wire earnest money today. What number makes this done by Friday?"`,
  ].join("\n");
}

// ── UI atoms ──────────────────────────────────────────────────────────────

function StatTile({ label, value, accent = "#fff" }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3, whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 16, fontWeight: 800, color: accent, textShadow: "none", whiteSpace: "nowrap" }}>
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
        boxShadow: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: "none", animation: "none" }} />
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase" }}>{label}</span>
      </div>
      <div className="sr-scanline" style={{ fontFamily: MONO, fontSize: 10.5, lineHeight: 1.55, color: SLATE }}>
        {text}
      </div>
    </div>
  );
}

// Awaiting-scan idle visual: faint mono grid with a sweeping laser line
function AwaitingScan() {
  return (
    <div
      style={{
        position: "relative", height: 110, borderRadius: 10, overflow: "hidden", marginBottom: 4,
        border: "1px dashed #27272a",
        backgroundImage:
          "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div
        style={{
          position: "absolute", left: 0, right: 0, height: 2, top: 0,
          background: `linear-gradient(90deg, transparent, ${PURPLE}cc, transparent)`,
          boxShadow: "none",
          animation: "none",
        }}
      />
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9.5, letterSpacing: 2, color: SLATE_DIM }}>
        AWAITING SECTOR SCAN
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
  const [selected, setSelected] = useState(null);
  const [intelLayer, setIntelLayer] = useState("default");
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [sectorPolygon, setSectorPolygon] = useState(null);
  const [drawing, setDrawing] = useState(false);

  // Micro-mode state
  const [scriptText, setScriptText] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState(null);

  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const decryptTimer = useRef(null);
  const spinEnabled = useRef(true);
  const spinFrame = useRef(null);

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

  useEffect(() => () => { if (spinFrame.current) cancelAnimationFrame(spinFrame.current); }, []);

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

  // ── Map init: fog, 3D buildings, draw control, resize, idle spin ───────
  // Wired to BOTH onLoad and onStyleData (idempotent via setupDone) — the
  // full `load` event waits on every tile/sprite fetch, which background
  // throttling can stall indefinitely; styledata fires as soon as the style
  // arrives, which is all this setup actually needs.
  const setupDone = useRef(false);
  const handleMapLoad = useCallback((e) => {
    if (setupDone.current) return;
    setupDone.current = true;
    const map = e.target;

    // Viewport alignment — the canvas container is sized to
    // calc(100% - 384px); force Mapbox to re-measure so the globe centers
    // in the visible viewport instead of hiding under the HUD.
    map.resize();
    const onWinResize = () => map.resize();
    window.addEventListener("resize", onWinResize);
    map.once("remove", () => window.removeEventListener("resize", onWinResize));

    // Atmospheric fog — outer-space look at globe zooms
    try {
      map.setFog({
        color: "#050505",
        "high-color": "#111111",
        "horizon-blend": 0.03,
        "space-color": "#050505",
        "star-intensity": 0,
      });
    } catch { /* fog unsupported on this style version — cosmetic only */ }

    // 3D buildings
    if (!map.getLayer("sr-3d-buildings")) {
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
      } catch { /* style variant without a building layer — map stays flat */ }
    }

    // Polygon lasso (mapbox-gl-draw) — controls hidden, driven by our button
    if (!drawRef.current) {
      const draw = new MapboxDraw({ displayControlsDefault: false });
      map.addControl(draw);
      drawRef.current = draw;
      const syncPolygon = () => {
        const feats = draw.getAll().features.filter((f) => f.geometry.type === "Polygon");
        setSectorPolygon(feats.length ? feats[feats.length - 1] : null);
        setDrawing(false);
      };
      map.on("draw.create", syncPolygon);
      map.on("draw.update", syncPolygon);
      map.on("draw.delete", syncPolygon);
    }

    // Cinematic idle: slow globe rotation below zoom 3, paused on
    // interaction (and permanently once a scan dives in).
    const spin = () => {
      if (spinEnabled.current && map.getZoom() < 3 && !map.isMoving()) {
        const center = map.getCenter();
        center.lng -= 0.03;
        map.easeTo({ center, duration: 50, easing: (t) => t });
      }
      spinFrame.current = requestAnimationFrame(spin);
    };
    ["mousedown", "touchstart", "wheel"].forEach((ev) => map.on(ev, () => { spinEnabled.current = false; }));
    spin();
  }, []);

  // ── Scans ──────────────────────────────────────────────────────────────
  const cinematicDive = useCallback((lng, lat) => {
    spinEnabled.current = false;
    mapRef.current?.flyTo({
      center: [lng, lat], zoom: 13.6, pitch: 60, bearing: -18,
      duration: 4200, essential: true, curve: 1.6,
    });
  }, []);

  const applyScanResult = useCallback((data) => {
    setGeojson(data.geojson || { type: "FeatureCollection", features: [] });
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
      if (first) cinematicDive(first.geometry.coordinates[0], first.geometry.coordinates[1]);
    } catch (err) {
      setError(err.message || "Scan failed — try again.");
    } finally {
      setScanning(false);
    }
  }, [query, scanning, applyScanResult, cinematicDive]);

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

  // ── Polygon lasso controls ─────────────────────────────────────────────
  const startLasso = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;
    draw.deleteAll();
    setSectorPolygon(null);
    setDrawing(true);
    draw.changeMode("draw_polygon");
  }, []);

  const clearSector = useCallback(() => {
    drawRef.current?.deleteAll();
    setSectorPolygon(null);
    setDrawing(false);
  }, []);

  // ── Telemetry: full suite over the (optionally lassoed) feature set ────
  const sectorFeatures = useMemo(() => {
    const feats = geojson.features;
    if (!sectorPolygon) return feats;
    return feats.filter((f) => {
      try { return turf.booleanPointInPolygon(turf.point(f.geometry.coordinates), sectorPolygon); }
      catch { return false; }
    });
  }, [geojson, sectorPolygon]);

  const macro = useMemo(() => {
    const feats = sectorFeatures;
    const total = feats.length;
    const prices = feats.map((f) => Number(f.properties.price)).filter((p) => p > 0);
    const doms = feats.map((f) => f.properties.daysOnMarket).filter((d) => typeof d === "number");
    const ppsf = feats
      .map((f) => {
        const p = Number(f.properties.price);
        const s = Number(f.properties.squareFootage);
        return p > 0 && s > 0 ? p / s : null;
      })
      .filter((v) => v != null);
    const priceCuts = feats.filter((f) => f.properties.category === "price_cut").length;
    return {
      total,
      totalVolume: prices.reduce((s, p) => s + p, 0),
      medianPrice: median(prices),
      avgDom: doms.length ? doms.reduce((s, d) => s + d, 0) / doms.length : null,
      priceCutVelocity: total ? (priceCuts / total) * 100 : 0,
      avgPpsf: ppsf.length ? ppsf.reduce((s, v) => s + v, 0) / ppsf.length : null,
      stalePct: total ? (feats.filter((f) => f.properties.category === "stale").length / total) * 100 : 0,
      freshCount: feats.filter((f) => f.properties.category === "fresh").length,
    };
  }, [sectorFeatures]);

  const sparkData = useMemo(() => {
    const feats = sectorFeatures;
    if (!feats.length) return [];
    const bins = Array.from({ length: 12 }, (_, i) => ({ bin: i, count: 0 }));
    feats.forEach((f) => {
      const dom = f.properties.daysOnMarket;
      if (dom == null) return;
      bins[Math.min(11, Math.floor(dom / 10))].count += 1;
    });
    return bins;
  }, [sectorFeatures]);

  const directives = useMemo(() => {
    const scope = sectorPolygon ? "isolated sector" : "sector";
    if (!macro.total) {
      return [
        { color: RED, label: "Danger", text: sectorPolygon ? "No listings inside the drawn perimeter." : "Awaiting sector scan — no threat telemetry." },
        { color: GREEN, label: "Opportunity", text: "Run a scan to surface acquisition targets." },
        { color: CYAN, label: "Action", text: "Position the map and scan the viewport for live inventory." },
      ];
    }
    return [
      {
        color: RED, label: "Danger",
        text: macro.stalePct >= 20
          ? `Stale density at ${macro.stalePct.toFixed(0)}% of ${scope} — buyer leverage elevated, expect drawn-out negotiations.`
          : `Stale density nominal — no elevated ${scope} risk detected.`,
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
          ? `${macro.freshCount} fresh listing${macro.freshCount === 1 ? "" : "s"} (<7d) in ${scope} — deploy field agents before competing offers land.`
          : "No fresh inventory this cycle — monitor and rescan.",
      },
    ];
  }, [macro, sectorPolygon]);

  // ── 3D Hex-Grid: turf hexbins → fill-extrusion columns ─────────────────
  const hexgrid = useMemo(() => {
    if (intelLayer !== "hexgrid" || geojson.features.length === 0) {
      return { type: "FeatureCollection", features: [] };
    }
    try {
      const pts = turf.featureCollection(geojson.features.map((f) => turf.point(f.geometry.coordinates, f.properties)));
      const bbox = turf.bbox(pts);
      const pad = 0.01;
      const grid = turf.hexGrid([bbox[0] - pad, bbox[1] - pad, bbox[2] + pad, bbox[3] + pad], 0.45, { units: "kilometers" });
      const cells = [];
      grid.features.forEach((cell) => {
        const inside = geojson.features.filter((f) => {
          try { return turf.booleanPointInPolygon(turf.point(f.geometry.coordinates), cell); }
          catch { return false; }
        });
        if (!inside.length) return;
        const volume = inside.reduce((s, f) => s + (Number(f.properties.price) || 0), 0);
        const cuts = inside.filter((f) => f.properties.category === "price_cut" || f.properties.category === "stale").length;
        cell.properties = {
          count: inside.length,
          volume,
          height: 120 + Math.min(2400, volume / 12000),
          risk: inside.length ? cuts / inside.length : 0,
        };
        cells.push(cell);
      });
      return turf.featureCollection(cells);
    } catch {
      return { type: "FeatureCollection", features: [] };
    }
  }, [intelLayer, geojson]);

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

  const selCat = selected?.properties?.category;
  const selColor = CATEGORY_COLOR[selCat] || PURPLE_LT;

  return (
    <div
      className="w-full h-full relative bg-[#050505] overflow-hidden"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", background: "#050505" }}
    >
      <style>{`
        @keyframes srBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes srSpin { to { transform: rotate(360deg); } }
        @keyframes srScan { 0% { background-position: -200px 0; } 100% { background-position: 200px 0; } }
        @keyframes srLaser { 0% { top: 0; } 50% { top: calc(100% - 2px); } 100% { top: 0; } }
        .sr-scanline {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%);
          background-size: 200px 100%; background-repeat: no-repeat;
          animation: srScan 2.8s linear infinite;
        }
        .mapboxgl-ctrl-attrib { background: rgba(0,0,0,0.4) !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 40,
            background: "rgba(8,8,14,0.92)", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${toast.startsWith("Deploy failed") ? RED : PURPLE}88`,
            borderRadius: 10, padding: "10px 18px", color: "#fff", fontFamily: F, fontSize: 12, fontWeight: 700,
            boxShadow: "none", whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {!MAPBOX_TOKEN ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontFamily: F, fontSize: 13, padding: 24, textAlign: "center" }}>
          Map access token not configured — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN) in .env.local.
        </div>
      ) : (
        /* Map fills exactly the viewport left of the HUD so the globe
           centers in visible space rather than under the glass panel. */
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `calc(100% - ${PANEL_W}px)` }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={GLOBE_IDLE}
            mapStyle="mapbox://styles/mapbox/dark-v11"
            projection="globe"
            style={{ position: "absolute", inset: 0 }}
            cursor={drawing ? "crosshair" : hovering ? "pointer" : "grab"}
            interactiveLayerIds={intelLayer === "default" || intelLayer === "accumulation" ? ["sr-nodes"] : []}
            onLoad={handleMapLoad}
            onStyleData={handleMapLoad}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            onClick={(e) => { if (!drawing) setSelected(e.features?.[0] || null); }}
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
                      "circle-color": ["match", ["get", "category"], "fresh", CYAN, "price_cut", RED, "stale", AMBER, "#a78bfa"],
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
                      "circle-color": ["match", ["get", "category"], "fresh", CYAN, "price_cut", RED, "stale", AMBER, "#a78bfa"],
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

            {/* 3D Hex-Grid — column height = volume, color = risk velocity */}
            <Source id="sr-hex-source" type="geojson" data={hexgrid}>
              {intelLayer === "hexgrid" && (
                <Layer
                  id="sr-hex"
                  source="sr-hex-source"
                  type="fill-extrusion"
                  paint={{
                    "fill-extrusion-height": ["get", "height"],
                    "fill-extrusion-base": 0,
                    "fill-extrusion-opacity": 0.72,
                    "fill-extrusion-color": [
                      "interpolate", ["linear"], ["get", "risk"],
                      0, CYAN,
                      0.4, PURPLE,
                      1, RED,
                    ],
                  }}
                />
              )}
            </Source>
          </Map>
        </div>
      )}

      {/* Brand chip — SPARK OS */}
      <div
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 20, display: "flex", alignItems: "center", gap: 9,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid rgba(168,85,247,0.35)", borderRadius: 12, padding: "9px 14px",
          boxShadow: "none",
        }}
      >
        <Zap
          size={17}
          className="text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.8)] animate-pulse"
          color={PURPLE_LT}
          fill={PURPLE_LT}
          style={{ filter: "none", animation: "none" }}
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
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 12, padding: 8,
          display: "flex", gap: 8, alignItems: "center",
        }}
      >
        <Search size={13} color={SLATE_DIM} style={{ marginLeft: 4, flexShrink: 0 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, ST or ZIP…"
          style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid #27272a", borderRadius: 8,
            color: "#fff", fontFamily: F, fontSize: 12, padding: "8px 10px", outline: "none", width: 160,
          }}
        />
        <button
          type="submit"
          disabled={scanning}
          style={{
            background: scanning ? "rgba(168,85,247,0.15)" : "rgba(168,85,247,0.3)",
            border: `1px solid ${PURPLE}66`, color: PURPLE_LT, fontFamily: F, fontSize: 10.5, fontWeight: 800,
            letterSpacing: 1, borderRadius: 8, padding: "8px 12px", cursor: scanning ? "default" : "pointer",
            textTransform: "uppercase", whiteSpace: "nowrap", boxShadow: "none",
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

      {/* Control bar: Intelligence Layers + Polygon Lasso */}
      <div style={{ position: "absolute", top: 136, left: 16, zIndex: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div>
          <button
            onClick={() => setLayerMenuOpen((o) => !o)}
            className="bg-black/50 backdrop-blur-md border border-white/10"
            style={{
              display: "flex", alignItems: "center", gap: 8, background: "#111111",
              backdropFilter: "none", WebkitBackdropFilter: "none",
              border: "1px solid #27272a", borderRadius: 10, padding: "9px 13px",
              color: "#fff", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8,
              textTransform: "uppercase", cursor: "pointer",
            }}
          >
            {intelLayer === "hexgrid" ? <Hexagon size={13} color={PURPLE_LT} /> : <Layers size={13} color={PURPLE_LT} />}
            {INTEL_LAYERS.find((l) => l.id === intelLayer)?.label}
          </button>
          {layerMenuOpen && (
            <div
              style={{
                marginTop: 6, background: "rgba(0,0,0,0.7)", backdropFilter: "none", WebkitBackdropFilter: "none",
                border: "1px solid #27272a", borderRadius: 10, overflow: "hidden", width: 230,
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

        <button
          onClick={sectorPolygon || drawing ? clearSector : startLasso}
          title={sectorPolygon ? "Clear drawn sector" : "Draw a polygon to isolate a micro-market"}
          style={{
            display: "flex", alignItems: "center", gap: 7, background: sectorPolygon ? "rgba(255,59,92,0.18)" : drawing ? "rgba(168,85,247,0.25)" : "#111111",
            backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${sectorPolygon ? RED : drawing ? PURPLE : "#27272a"}88`,
            borderRadius: 10, padding: "9px 13px",
            color: sectorPolygon ? RED : drawing ? PURPLE_LT : "#fff", fontFamily: F, fontSize: 10.5, fontWeight: 800,
            letterSpacing: 0.8, textTransform: "uppercase", cursor: "pointer",
            boxShadow: "none",
          }}
        >
          {sectorPolygon ? <Eraser size={13} /> : <PenTool size={13} />}
          {sectorPolygon ? "Clear Sector" : drawing ? "Drawing… (dbl-click to close)" : "Sector Lasso"}
        </button>
      </div>

      {/* ── Intelligence HUD (right panel — glass at all times) ── */}
      <div
        className="w-96 backdrop-blur-2xl bg-black/60 border-l border-white/10 flex flex-col h-full z-10"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL_W, zIndex: 10,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          borderLeft: "1px solid #27272a", display: "flex", flexDirection: "column",
          padding: 18, boxSizing: "border-box", overflowY: "auto",
        }}
      >
        {/* Panel header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <RadarIcon size={14} color={PURPLE_LT} style={{ filter: "none"}} />
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.8, color: "#fff" }}>
            {selected ? "TARGET LOCK DOSSIER" : "SECTOR TELEMETRY"}
          </span>
          {selected && (
            <button onClick={() => setSelected(null)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}>
              <X size={15} />
            </button>
          )}
        </div>
        <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 2.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 6 }}>
          {selected ? "MICRO MODE — ASSET ANALYSIS" : "MACRO MODE — PROPRIETARY MARKET TELEMETRY"}
        </div>
        {!selected && sectorPolygon && (
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: PURPLE_LT, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: PURPLE, boxShadow: "none", animation: "none" }} />
            MICRO-MARKET ISOLATED · {sectorFeatures.length} OF {geojson.features.length} NODES
          </div>
        )}
        {!selected && !sectorPolygon && <div style={{ marginBottom: 10 }} />}

        {error && (
          <div style={{ fontFamily: MONO, fontSize: 10.5, color: RED, background: "rgba(255,59,92,0.08)", border: `1px solid ${RED}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {!selected ? (
          /* ── MACRO MODE ── */
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13, marginBottom: 14 }}>
              <StatTile label="Active Listings" value={macro.total || "—"} accent={CYAN} />
              <StatTile label="Total Active Volume" value={macro.total ? fmtMoney(macro.totalVolume) : "—"} accent={PURPLE_LT} />
              <StatTile label="Median List Price" value={macro.total ? fmtMoney(macro.medianPrice) : "—"} accent={GREEN} />
              <StatTile label="Avg Days on Market" value={macro.avgDom != null ? `${macro.avgDom.toFixed(0)}d` : "—"} />
              <StatTile label="Price-Cut Velocity" value={macro.total ? `${macro.priceCutVelocity.toFixed(0)}%` : "—"} accent={macro.priceCutVelocity > 15 ? RED : "#fff"} />
              <StatTile label="Avg Price / SqFt" value={macro.avgPpsf != null ? `$${Math.round(macro.avgPpsf).toLocaleString()}` : "—"} accent={AMBER} />
            </div>

            {/* Density sparkline / awaiting-scan laser grid */}
            {sparkData.length > 0 ? (
              <>
                <div style={{ height: 54, marginBottom: 4 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={sparkData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="srSpark" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={PURPLE} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={PURPLE} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="count" stroke={PURPLE_LT} strokeWidth={1.5} fill="url(#srSpark)" isAnimationActive={false} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: SLATE_DIM, marginBottom: 16, textAlign: "center" }}>
                  LISTING DENSITY BY DOM DECILE (0 → 120d+)
                </div>
              </>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <AwaitingScan />
              </div>
            )}

            <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: SLATE_DIM, marginBottom: 8, textTransform: "uppercase" }}>
              Tactical Directives
            </div>
            {directives.map((d) => <Directive key={d.label} {...d} />)}

            <div style={{ fontFamily: F, fontSize: 9, letterSpacing: 1.5, color: SLATE_DIM, margin: "10px 0 8px", textTransform: "uppercase" }}>
              Category Legend
            </div>
            {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
              <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 10.5, fontFamily: F, color: SLATE }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLOR[key], boxShadow: "none"}} />
                {label}
              </div>
            ))}

            <div style={{ marginTop: "auto", paddingTop: 14, fontFamily: MONO, fontSize: 9, color: SLATE_DIM, letterSpacing: 0.5 }}>
              {geojson.features.length > 0
                ? `${geojson.features.length} nodes plotted · click a node to lock target · lasso to isolate`
                : "Run a scan to populate the radar"}
            </div>
          </>
        ) : (
          /* ── MICRO MODE ── */
          <>
            <div
              style={{
                border: `1px solid ${selColor}55`, borderRadius: 12, padding: 14, marginBottom: 14,
                background: "#18181b", boxShadow: "none",
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
                width: "100%", background: decrypting ? "rgba(168,85,247,0.15)" : "#8b5cf6",
                border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "12px 14px",
                fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", cursor: decrypting ? "default" : "pointer",
                boxShadow: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12,
              }}
            >
              {decrypting ? <Loader2 size={13} style={{ animation: "srSpin 1s linear infinite" }} /> : <Zap size={13} />}
              {decrypting ? "Decrypting…" : "Generate AI Acquisition Script"}
            </button>

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
            <div style={{ borderTop: "1px solid #27272a", paddingTop: 14 }}>
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
                    <option key={a.id} value={a.id} style={{ background: "#0a0a0a" }}>{firstName(a.email)} — {a.email}</option>
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
                  boxShadow: "none",
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
