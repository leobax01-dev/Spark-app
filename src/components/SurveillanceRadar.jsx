// src/components/SurveillanceRadar.jsx — Spark Surveillance Radar: a live
// Mapbox market map for the Brokerage Command Suite, backed by
// api/market/surveillance.js (RentCast active listings -> GeoJSON).
//
// Two adaptations from the literal spec, same reasoning as everywhere else
// in this codebase:
//
// 1. Styling: no Tailwind anywhere in this app. The requested className
//    strings are kept on every element (harmless now, free upgrade if
//    Tailwind is ever added), backed by inline `style` objects tuned to
//    the same dark-glass/neon-blue look they describe.
//
// 2. Env var: the spec's NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN is a Next.js
//    naming convention; this is Vite, which only inlines VITE_-prefixed
//    vars into import.meta.env by default. Rather than duplicate the
//    token under a second name, vite.config.js now also whitelists
//    NEXT_PUBLIC_-prefixed vars (see the comment there) — access tokens
//    are meant to be public/client-side, so this isn't a secrets leak.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Source, Layer, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const MIAMI_CENTER = { longitude: -80.1918, latitude: 25.7617, zoom: 12 };

const C = {
  panelBg: "rgba(0,0,0,0.6)",
  hudBg: "rgba(0,0,0,0.5)",
  blue: "#38BDF8",
  blueBorder: "rgba(59,130,246,0.3)",
  blueBorderDim: "rgba(59,130,246,0.2)",
  emerald: "#22C55E",
  rose: "#F43F5E",
  amber: "#F59E0B",
  slate: "rgba(226,232,240,0.9)",
  slateDim: "rgba(148,163,184,0.7)",
  F: "'Plus Jakarta Sans',sans-serif",
};

// Palette for the RentCast market layers + the brokerage's own footprint.
// Kept distinct from the earlier CATEGORY_COLOR map (still used for the
// legend/stats) so "fresh"/"stale"/"price_cut" get the exact hexes specified
// for the glow layers, while "standard" RentCast listings keep the older blue.
const LAYER_COLOR = {
  fresh: "#06b6d4",
  stale: "#f59e0b",
  price_cut: "#ef4444",
  standard: C.blue,
  brokerage: "#3b82f6",
};

const CATEGORY_COLOR = {
  fresh: LAYER_COLOR.fresh,
  price_cut: LAYER_COLOR.price_cut,
  stale: LAYER_COLOR.stale,
  standard: LAYER_COLOR.standard,
  brokerage: LAYER_COLOR.brokerage,
};

const CATEGORY_LABEL = {
  fresh: "Fresh Capital (< 7 days)",
  price_cut: "Distressed Assets (price cut)",
  stale: "Stagnant Assets (> 60 days)",
  standard: "Standard",
  brokerage: "Brokerage Footprint",
};

const INTERACTIVE_LAYER_IDS = [
  "fresh-capital",
  "stagnant-assets",
  "distressed-assets",
  "standard-assets",
  "brokerage-footprint",
];

function fmtCompact(n) {
  if (n == null) return "—";
  return `$${Math.round(n).toLocaleString()}`;
}

// The `deals` table (see BrokerDashboard.jsx) has an `address` column but no
// lat/lng — geocode it client-side against Mapbox's Geocoding API using the
// same public token already on the page, rather than adding a new backend
// route or a geocoding dependency just for this.
async function geocodeAddress(address, token) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const [lng, lat] = data.features?.[0]?.center || [];
  return typeof lng === "number" && typeof lat === "number" ? [lng, lat] : null;
}

export default function SurveillanceRadar({ user, onExit }) {
  const [query, setQuery] = useState("Miami, FL");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [geojson, setGeojson] = useState({ type: "FeatureCollection", features: [] });
  const [stats, setStats] = useState({ avgDom: null, medianPrice: null, activeCount: 0 });
  const [selectedFeature, setSelectedFeature] = useState(null);
  const [brokerageGeojson, setBrokerageGeojson] = useState({ type: "FeatureCollection", features: [] });
  const [hovering, setHovering] = useState(false);
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [toast, setToast] = useState(null);
  const [whisperPitch, setWhisperPitch] = useState(null);
  const [whisperLoading, setWhisperLoading] = useState(false);
  const mapRef = useRef(null);

  // Clear any generated pitch when the selected node changes so a stale
  // pitch from a previously-selected property never lingers under a new one.
  useEffect(() => {
    setWhisperPitch(null);
    setWhisperLoading(false);
  }, [selectedFeature]);

  // Agent Selector — team members to deploy a dossier's target to. Same
  // brokerage-scoped users query as BrokerDashboard.jsx.
  useEffect(() => {
    if (!user?.brokerageId) return;
    let cancelled = false;
    (async () => {
      const sb = window.__supabase;
      if (!sb) return;
      const { data } = await sb.from("users").select("id, email").eq("brokerage_id", user.brokerageId);
      if (!cancelled && data) {
        setAgents(data);
        setSelectedAgentId((prev) => prev || data[0]?.id || "");
      }
    })();
    return () => { cancelled = true; };
  }, [user?.brokerageId]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Deploy to Agent War Room — targets public.war_room_deals (the org-wide
  // deal telemetry table, see 20260730000000_brokerage_multitenancy_rls.sql)
  // rather than `deals`: `deals.status` is a closed enum
  // (on_track/stalled/at_risk) with no "targeted" value, while
  // war_room_deals has a free-form `details` jsonb column that's the right
  // shape for property/scan metadata that doesn't map to a real deal yet.
  // Note: RLS on war_room_deals only allows inserting rows where
  // user_id = auth.uid(), so a broker deploying to a *different* agent will
  // get an RLS error back here (surfaced via the toast) until that policy
  // is extended — not silently worked around.
  const deployToWarRoom = useCallback(async (feature) => {
    const sb = window.__supabase;
    if (!sb || !selectedAgentId) return;
    const p = feature.properties;
    const isBrokerage = p.__source === "brokerage";
    const price = isBrokerage ? Number(p.deal_volume) || null : Number(p.price) || null;
    const agent = agents.find((a) => a.id === selectedAgentId);

    setDeploying(true);
    try {
      const { error: insertError } = await sb.from("war_room_deals").insert({
        brokerage_id: user?.brokerageId,
        user_id: selectedAgentId,
        deal_name: p.address || "Untitled target",
        negotiation_stage: "open",
        details: {
          address: p.address,
          price,
          status: "targeted",
          category: p.category || (isBrokerage ? "brokerage" : "standard"),
          source: isBrokerage ? "brokerage" : "rentcast",
          coordinates: feature.geometry.coordinates,
        },
      });
      if (insertError) throw new Error(insertError.message);
      setToast(`Target Deployed to ${agent?.email || "Agent"}'s Spark Workspace.`);
    } catch (err) {
      setToast(`Deploy failed: ${err.message}`);
    } finally {
      setDeploying(false);
    }
  }, [selectedAgentId, agents, user?.brokerageId]);

  // AI Whisper Campaign — a short, discreet outreach pitch for the selected
  // node, generated via the same api/claude.js proxy every other AI feature
  // in this app uses (see AutopilotPanel.jsx/TransactionPanel.jsx for the
  // identical system+messages+max_tokens shape).
  const generateWhisperPitch = useCallback(async (feature) => {
    const p = feature.properties;
    const isBrokerage = p.__source === "brokerage";
    const price = isBrokerage ? Number(p.deal_volume) || null : Number(p.price) || null;
    const pricePerSqft = price && p.squareFootage ? Math.round(price / p.squareFootage) : null;

    setWhisperLoading(true);
    setWhisperPitch(null);
    try {
      const r = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You write short, discreet off-market outreach pitches for real estate brokers to send to VIP investor clients. Tone: insider, low-key, urgent but not salesy. Exactly 3 sentences. Return ONLY valid JSON.",
          messages: [{
            role: "user",
            content: `Write a 3-sentence discreet VIP whisper pitch for this property:
Address: ${p.address || "Address unavailable"}
Price: ${fmtCompact(price)}
Price/sqft: ${pricePerSqft ? `$${pricePerSqft}` : "unknown"}
Days on market: ${p.daysOnMarket ?? "unknown"}

Follow this shape: "Off-market alert. Looking at a prime asset at [address] trading at [price/sqft]—well below sector median. Seller leverage is dropping at [DOM] days on market. Let me know if you want the private financials."

Return ONLY this JSON: {"pitch":"the 3-sentence pitch"}`,
          }],
          max_tokens: 300,
        }),
      });
      const d = await r.json();
      if (!r.ok || d?.error || d?.type === "error") {
        throw new Error(d?.error?.message || d?.error || `HTTP ${r.status}`);
      }
      const raw = d.content?.[0]?.text || "";
      const parsed = JSON.parse(raw);
      if (!parsed.pitch) throw new Error("No pitch in response");
      setWhisperPitch(parsed.pitch);
    } catch (err) {
      setWhisperPitch(null);
      setToast(`Whisper pitch failed: ${err.message}`);
    } finally {
      setWhisperLoading(false);
    }
  }, []);

  // Brokerage Footprint layer — the brokerage's own active deals, geocoded
  // client-side since `deals.address` has no lat/lng (see comment on
  // geocodeAddress above). RLS scopes this to the signed-in broker's own
  // brokerage_id, same as the query in BrokerDashboard.jsx.
  useEffect(() => {
    if (!MAPBOX_TOKEN) return;
    let cancelled = false;

    (async () => {
      const sb = window.__supabase;
      if (!sb) return;
      const { data, error: dealsError } = await sb
        .from("deals")
        .select("id, client_name, address, stage, deal_volume, gci, closing_date, commission_split_pct")
        .neq("stage", "closed")
        .not("address", "is", null);
      if (cancelled || dealsError || !data) return;

      const geocoded = await Promise.all(
        data.map(async (deal) => {
          const coords = await geocodeAddress(deal.address, MAPBOX_TOKEN);
          if (!coords) return null;
          return {
            type: "Feature",
            geometry: { type: "Point", coordinates: coords },
            properties: { ...deal, __source: "brokerage" },
          };
        })
      );
      if (!cancelled) {
        setBrokerageGeojson({ type: "FeatureCollection", features: geocoded.filter(Boolean) });
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // Sector Telemetry — aggregate metrics derived from the current RentCast
  // scan's plotted features (aggregateStats from the API only gives us
  // avgDom/medianPrice/activeCount; total volume and price-cut velocity are
  // cheap to derive client-side from the same geojson rather than adding
  // more fields to the API response).
  const sectorMetrics = useMemo(() => {
    const feats = geojson.features;
    const total = feats.length;
    const staleCount = feats.filter((f) => f.properties.category === "stale").length;
    const priceCutCount = feats.filter((f) => f.properties.category === "price_cut").length;
    const totalVolume = feats.reduce((sum, f) => sum + (Number(f.properties.price) || 0), 0);
    return {
      total,
      staleCount,
      priceCutCount,
      totalVolume,
      stalePct: total ? (staleCount / total) * 100 : 0,
      priceCutVelocity: total ? (priceCutCount / total) * 100 : 0,
    };
  }, [geojson]);

  // Tactical Directives — simple rule-based read of the sector data, not a
  // model call. Danger flags an elevated stale-listing density (buyer
  // leverage), Opportunity flags price-cut clusters (conversion targets),
  // Action compares the brokerage's own listings against the sector's
  // median comp price to suggest a pricing lean.
  const directives = useMemo(() => {
    const { total, staleCount, stalePct, priceCutCount } = sectorMetrics;

    const danger = stalePct >= 20
      ? { text: `${staleCount} stale listing${staleCount === 1 ? "" : "s"} detected (${stalePct.toFixed(0)}% of sector) — buyer leverage is elevated, expect longer negotiation cycles.`, elevated: true }
      : { text: total ? "Stale density nominal — no elevated risk detected in this sector." : "Run a scan to assess stale-listing risk.", elevated: false };

    const opportunity = priceCutCount > 0
      ? { text: `${priceCutCount} price-cut listing${priceCutCount === 1 ? "" : "s"} flagged — prime targets for expired-listing and price-cut conversion outreach.`, elevated: true }
      : { text: total ? "No price-cut clusters detected this scan." : "Run a scan to surface conversion targets.", elevated: false };

    const brokerageAvg = brokerageGeojson.features.length
      ? brokerageGeojson.features.reduce((sum, f) => sum + (Number(f.properties.deal_volume) || 0), 0) / brokerageGeojson.features.length
      : null;
    let action;
    if (brokerageAvg && sectorMetrics.total && stats.medianPrice) {
      const deltaPct = ((brokerageAvg - stats.medianPrice) / stats.medianPrice) * 100;
      if (deltaPct > 8) {
        action = { text: `Nearby brokerage listings price ${deltaPct.toFixed(0)}% above sector median (${fmtCompact(stats.medianPrice)}) — consider a pricing adjustment to stay competitive.`, elevated: true };
      } else if (deltaPct < -8) {
        action = { text: `Nearby brokerage listings price ${Math.abs(deltaPct).toFixed(0)}% below sector median (${fmtCompact(stats.medianPrice)}) — room to hold or raise ask.`, elevated: true };
      } else {
        action = { text: `Nearby brokerage listings are within range of the sector median (${fmtCompact(stats.medianPrice)}) — pricing strategy is on target.`, elevated: false };
      }
    } else {
      action = { text: "Run a scan and geocode brokerage listings to generate pricing guidance.", elevated: false };
    }

    return [
      { key: "danger", label: "Danger", color: LAYER_COLOR.price_cut, ...danger },
      { key: "opportunity", label: "Opportunity", color: "#22C55E", ...opportunity },
      { key: "action", label: "Action", color: C.blue, ...action },
    ];
  }, [sectorMetrics, brokerageGeojson, stats.medianPrice]);

  const runScan = useCallback(async (e) => {
    e?.preventDefault?.();
    const trimmed = query.trim();
    if (!trimmed || scanning) return;

    setScanning(true);
    setError(null);
    try {
      const isZip = /^\d{5}$/.test(trimmed);
      const params = new URLSearchParams(isZip ? { zipCode: trimmed } : { cityState: trimmed });
      const res = await fetch(`/api/market/surveillance?${params.toString()}`);
      const data = await res.json();

      setGeojson(data.geojson || { type: "FeatureCollection", features: [] });
      setStats(data.aggregateStats || { avgDom: null, medianPrice: null, activeCount: 0 });
      if (!data.success) setError(data.error || "Scan returned no data.");

      // Recenter on the first result if we got coordinates back — the
      // location search box doesn't do its own geocoding, so this is the
      // only signal we have for "where did this search actually land."
      const first = data.geojson?.features?.[0];
      if (first && mapRef.current) {
        const [lng, lat] = first.geometry.coordinates;
        mapRef.current.flyTo({ center: [lng, lat], zoom: 12, duration: 800 });
      }
    } catch (err) {
      setError(err.message || "Scan failed — try again.");
    } finally {
      setScanning(false);
    }
  }, [query, scanning]);

  return (
    <div
      className="w-screen h-screen m-0 p-0 absolute top-0 left-0 z-0 overflow-hidden"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden", zIndex: 0 }}
    >
      {/* Deploy success/error toast — top-center overlay, self-dismisses */}
      {toast && (
        <div
          style={{
            position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 30,
            background: "rgba(10,15,25,0.92)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
            border: `1px solid ${toast.startsWith("Deploy failed") ? "rgba(244,63,94,0.5)" : "rgba(59,130,246,0.5)"}`,
            borderRadius: 10, padding: "10px 18px", color: "#fff", fontFamily: C.F, fontSize: 12, fontWeight: 700,
            boxShadow: `0 0 20px ${toast.startsWith("Deploy failed") ? "rgba(244,63,94,0.25)" : "rgba(59,130,246,0.35)"}`,
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {!MAPBOX_TOKEN ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#050810", color: C.rose, fontFamily: C.F, fontSize: 13, padding: 24, textAlign: "center" }}>
          Mapbox access token not configured — set NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN (or VITE_MAPBOX_ACCESS_TOKEN) in .env.local.
        </div>
      ) : (
        <Map
          ref={mapRef}
          mapboxAccessToken={MAPBOX_TOKEN}
          initialViewState={MIAMI_CENTER}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ position: "absolute", inset: 0 }}
          cursor={hovering ? "pointer" : "grab"}
          interactiveLayerIds={INTERACTIVE_LAYER_IDS}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
          onClick={(e) => {
            const feature = e.features?.[0];
            setSelectedFeature(feature || null);
          }}
        >
          <Source id="surveillance-nodes" type="geojson" data={geojson}>
            {/* Fresh Capital — cyan, with a soft blurred glow ring under the solid dot */}
            <Layer
              id="fresh-capital-glow"
              type="circle"
              filter={["==", ["get", "category"], "fresh"]}
              paint={{
                "circle-radius": 14,
                "circle-color": LAYER_COLOR.fresh,
                "circle-blur": 1,
                "circle-opacity": 0.45,
              }}
            />
            <Layer
              id="fresh-capital"
              type="circle"
              filter={["==", ["get", "category"], "fresh"]}
              paint={{
                "circle-radius": 6,
                "circle-color": LAYER_COLOR.fresh,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "rgba(0,0,0,0.6)",
                "circle-opacity": 0.95,
              }}
            />

            {/* Stagnant Assets — amber markers, no glow */}
            <Layer
              id="stagnant-assets"
              type="circle"
              filter={["==", ["get", "category"], "stale"]}
              paint={{
                "circle-radius": 6,
                "circle-color": LAYER_COLOR.stale,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "rgba(0,0,0,0.6)",
                "circle-opacity": 0.9,
              }}
            />

            {/* Distressed Assets — sharp red glowing beacons */}
            <Layer
              id="distressed-glow"
              type="circle"
              filter={["==", ["get", "category"], "price_cut"]}
              paint={{
                "circle-radius": 16,
                "circle-color": LAYER_COLOR.price_cut,
                "circle-blur": 1.2,
                "circle-opacity": 0.5,
              }}
            />
            <Layer
              id="distressed-assets"
              type="circle"
              filter={["==", ["get", "category"], "price_cut"]}
              paint={{
                "circle-radius": 6,
                "circle-color": LAYER_COLOR.price_cut,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "rgba(0,0,0,0.6)",
                "circle-opacity": 1,
              }}
            />

            {/* Everything else (standard listings) */}
            <Layer
              id="standard-assets"
              type="circle"
              filter={["==", ["get", "category"], "standard"]}
              paint={{
                "circle-radius": 5,
                "circle-color": LAYER_COLOR.standard,
                "circle-stroke-width": 1.5,
                "circle-stroke-color": "rgba(0,0,0,0.6)",
                "circle-opacity": 0.85,
              }}
            />
          </Source>

          {/* Brokerage Footprint — the brokerage's own active deals, solid electric blue */}
          <Source id="brokerage-footprint-source" type="geojson" data={brokerageGeojson}>
            <Layer
              id="brokerage-footprint"
              type="circle"
              paint={{
                "circle-radius": 7,
                "circle-color": LAYER_COLOR.brokerage,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 1,
              }}
            />
          </Source>

          {selectedFeature && (
            <Popup
              longitude={selectedFeature.geometry.coordinates[0]}
              latitude={selectedFeature.geometry.coordinates[1]}
              onClose={() => setSelectedFeature(null)}
              closeOnClick={false}
              anchor="bottom"
            >
              {selectedFeature.properties.__source === "brokerage" ? (
                <div style={{ fontFamily: C.F, fontSize: 12, color: "#0a0a0d", minWidth: 160 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{fmtCompact(selectedFeature.properties.deal_volume)}</div>
                  <div style={{ marginBottom: 4 }}>{selectedFeature.properties.address || "Address unavailable"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>{selectedFeature.properties.client_name || "Unnamed client"}</div>
                  <div style={{ fontSize: 10, marginTop: 4, fontWeight: 700, color: LAYER_COLOR.brokerage }}>
                    {CATEGORY_LABEL.brokerage} · {selectedFeature.properties.stage}
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: C.F, fontSize: 12, color: "#0a0a0d", minWidth: 160 }}>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{selectedFeature.properties.formattedPrice || fmtCompact(selectedFeature.properties.price)}</div>
                  <div style={{ marginBottom: 4 }}>{selectedFeature.properties.address || "Address unavailable"}</div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {selectedFeature.properties.bedrooms ?? "—"}bd / {selectedFeature.properties.bathrooms ?? "—"}ba · {selectedFeature.properties.daysOnMarket ?? "—"} DOM
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4, fontWeight: 700, color: CATEGORY_COLOR[selectedFeature.properties.category] || C.blue }}>
                    {CATEGORY_LABEL[selectedFeature.properties.category] || "Standard"}
                  </div>
                </div>
              )}
            </Popup>
          )}
        </Map>
      )}

      {/* Exit Strategy — minimalist glowing button back to the standard CRM view.
          Only rendered when a parent (App.jsx) hands down onExit; standalone
          previews of this component with no exit handler just omit it. */}
      {onExit && (
        <button
          onClick={onExit}
          className="absolute top-4 left-4 z-10"
          style={{
            position: "absolute", top: 16, left: 16, zIndex: 20,
            background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
            border: `1px solid ${C.blueBorder}`, color: C.blue, fontFamily: C.F, fontSize: 10, fontWeight: 800,
            letterSpacing: 1, textTransform: "uppercase", borderRadius: 10, padding: "8px 14px",
            cursor: "pointer", boxShadow: `0 0 10px ${C.blueBorder}`, display: "flex", alignItems: "center", gap: 6,
            transition: "box-shadow 0.15s ease, background 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 0 18px rgba(59,130,246,0.6)`; e.currentTarget.style.background = "rgba(59,130,246,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = `0 0 10px ${C.blueBorder}`; e.currentTarget.style.background = "rgba(0,0,0,0.55)"; }}
        >
          ← Exit Radar
        </button>
      )}

      {/* Floating Search HUD — top left */}
      <form
        onSubmit={runScan}
        className="absolute top-16 left-4 z-10 bg-black/50 backdrop-blur-md border border-blue-500/30 text-white rounded-xl p-2 flex gap-2"
        style={{
          position: "absolute", top: onExit ? 62 : 16, left: 16, zIndex: 10,
          background: C.hudBg, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)",
          border: `1px solid ${C.blueBorder}`, color: "#fff", borderRadius: 12, padding: 8,
          display: "flex", gap: 8, alignItems: "center",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="City, ST or ZIP…"
          style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${C.blueBorderDim}`, borderRadius: 8,
            color: "#fff", fontFamily: C.F, fontSize: 12, padding: "8px 10px", outline: "none", width: 190,
          }}
        />
        <button
          type="submit"
          disabled={scanning}
          style={{
            background: scanning ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.25)",
            border: `1px solid ${C.blueBorder}`, color: C.blue, fontFamily: C.F, fontSize: 11, fontWeight: 800,
            letterSpacing: 0.8, borderRadius: 8, padding: "0 14px", cursor: scanning ? "default" : "pointer",
            textTransform: "uppercase", whiteSpace: "nowrap",
          }}
        >
          {scanning ? "Scanning…" : "Scan Sector"}
        </button>
      </form>

      {/* Floating Intelligence Panel — right side */}
      <div
        className="absolute right-0 top-0 h-full z-10 bg-black/60 backdrop-blur-xl border-l border-blue-500/20 p-4 text-slate-200 flex flex-col"
        style={{
          position: "absolute", right: 0, top: 0, height: "100%", width: 380, zIndex: 10,
          background: C.panelBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          borderLeft: `1px solid ${C.blueBorderDim}`, padding: 16, color: C.slate,
          display: "flex", flexDirection: "column", overflowY: "auto", boxSizing: "border-box",
        }}
      >
        <div
          style={{
            fontFamily: C.F, fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: C.blue,
            textShadow: `0 0 12px ${C.blue}88`, marginBottom: 4, textTransform: "uppercase",
          }}
        >
          SPARK SURVEILLANCE RADAR
        </div>
        <div style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 2, color: C.slateDim, marginBottom: 18, textTransform: "uppercase" }}>
          Market Telemetry
        </div>

        {error && (
          <div style={{ fontSize: 11, color: C.rose, background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 8, padding: "8px 10px", marginBottom: 14 }}>
            {error}
          </div>
        )}

        {/* Property Dossier — top section, populated on node click */}
        {selectedFeature ? (
          <PropertyDossier
            feature={selectedFeature}
            onClose={() => setSelectedFeature(null)}
            agents={agents}
            selectedAgentId={selectedAgentId}
            onAgentChange={setSelectedAgentId}
            onDeploy={() => deployToWarRoom(selectedFeature)}
            deploying={deploying}
            onGenerateWhisper={() => generateWhisperPitch(selectedFeature)}
            whisperLoading={whisperLoading}
            whisperPitch={whisperPitch}
            onWhisperCopied={() => setToast("Whisper pitch copied to clipboard.")}
          />
        ) : (
          <div style={{ fontFamily: C.F, fontSize: 10, color: C.slateDim, border: `1px dashed ${C.blueBorderDim}`, borderRadius: 10, padding: 12, marginBottom: 20, textAlign: "center" }}>
            Click a map node to load its dossier.
          </div>
        )}

        {/* Sector Telemetry — middle section, live aggregates from the scan */}
        <div style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 1.5, color: C.slateDim, marginBottom: 10, textTransform: "uppercase" }}>
          Sector Telemetry
        </div>
        <DomGauge avgDom={stats.avgDom} />
        <div style={{ display: "flex", gap: 14, marginBottom: 20, flexWrap: "wrap" }}>
          <StatTile label="Active Listings" value={stats.activeCount ?? "—"} />
          <StatTile label="Total Active Volume" value={fmtCompact(sectorMetrics.totalVolume)} />
          <StatTile label="Price-Cut Velocity" value={sectorMetrics.total ? `${sectorMetrics.priceCutVelocity.toFixed(0)}%` : "—"} />
        </div>

        {/* Tactical Directives — bottom section, rule-based AI-style alerts */}
        <div style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 1.5, color: C.slateDim, marginBottom: 10, textTransform: "uppercase" }}>
          Tactical Directives
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {directives.map((d) => (
            <DirectiveCard key={d.key} directive={d} />
          ))}
        </div>

        <div style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 1.5, color: C.slateDim, marginBottom: 10, textTransform: "uppercase" }}>
          Category Legend
        </div>
        {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 11, fontFamily: C.F }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLOR[key], boxShadow: `0 0 6px ${CATEGORY_COLOR[key]}` }} />
            {label}
          </div>
        ))}

        <div style={{ marginTop: "auto", fontSize: 9, color: C.slateDim, fontFamily: C.F, letterSpacing: 0.5, paddingTop: 16 }}>
          {geojson.features.length > 0
            ? `${geojson.features.length} plotted result${geojson.features.length === 1 ? "" : "s"} · click a point for details`
            : "Run a scan to populate live listing telemetry."}
        </div>
      </div>
    </div>
  );
}

function DomGauge({ avgDom }) {
  // Visual gauge capped at 90 days — beyond that the sector reads as
  // maximally "cold" regardless of exact value, so the bar never overflows.
  const capped = avgDom != null ? Math.min(avgDom, 90) : 0;
  const pct = (capped / 90) * 100;
  const color = avgDom == null ? C.slateDim : avgDom < 21 ? "#22C55E" : avgDom < 60 ? C.amber : LAYER_COLOR.price_cut;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <span style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 1, color: C.slateDim, textTransform: "uppercase" }}>Avg Days on Market</span>
        <span style={{ fontFamily: C.F, fontSize: 13, fontWeight: 800, color }}>{avgDom != null ? `${avgDom}d` : "—"}</span>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function DirectiveCard({ directive }) {
  const { label, color, text, elevated } = directive;
  return (
    <div
      style={{
        border: `1px solid ${color}${elevated ? "77" : "33"}`,
        borderRadius: 10,
        padding: "10px 12px",
        background: `linear-gradient(135deg, ${color}14, rgba(255,255,255,0.02))`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: elevated ? `0 0 14px ${color}22` : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }} />
        <span style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 9, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase" }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 10.5, lineHeight: 1.5, color: C.slate }}>
        {text}
      </div>
    </div>
  );
}

// RentCast doesn't return an appraisal/valuation figure — this assumes a flat
// buy-side + list-side commission rate against list price as a working
// estimate, same convention used elsewhere in this app for commission math
// (e.g. BrokerDashboard's commission_split_pct on the brokerage's own deals).
const ASSUMED_COMMISSION_RATE = 0.03;

function domBadgeColor(dom) {
  if (dom == null) return C.slateDim;
  if (dom < 7) return "#22C55E";
  if (dom <= 60) return C.amber;
  return LAYER_COLOR.price_cut;
}

function PropertyDossier({
  feature, onClose, agents, selectedAgentId, onAgentChange, onDeploy, deploying,
  onGenerateWhisper, whisperLoading, whisperPitch, onWhisperCopied,
}) {
  const p = feature.properties;
  const isBrokerage = p.__source === "brokerage";
  const accent = isBrokerage ? LAYER_COLOR.brokerage : (CATEGORY_COLOR[p.category] || C.blue);
  const price = isBrokerage ? Number(p.deal_volume) || null : Number(p.price) || null;
  const pricePerSqft = price && p.squareFootage ? price / p.squareFootage : null;
  const estimatedCommission = isBrokerage
    ? (p.gci != null ? Number(p.gci) : price != null ? price * (Number(p.commission_split_pct ?? 70) / 100) * ASSUMED_COMMISSION_RATE : null)
    : (price != null ? price * ASSUMED_COMMISSION_RATE : null);
  const dom = p.daysOnMarket;

  return (
    <div
      style={{
        border: `1px solid ${accent}55`, borderRadius: 10, padding: 12, marginBottom: 20,
        background: "rgba(255,255,255,0.03)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ fontFamily: C.F, fontSize: 9, letterSpacing: 1.5, color: accent, textTransform: "uppercase", fontWeight: 800 }}>
          {isBrokerage ? "Brokerage Dossier" : "Property Dossier"}
        </div>
        <button
          onClick={onClose}
          style={{ background: "transparent", border: "none", color: C.slateDim, cursor: "pointer", fontSize: 13, lineHeight: 1, padding: 0 }}
        >
          ×
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <div style={{ fontFamily: C.F, fontSize: 16, fontWeight: 800, color: "#fff" }}>
          {isBrokerage ? fmtCompact(p.deal_volume) : (p.formattedPrice || fmtCompact(p.price))}
        </div>
        {!isBrokerage && (
          <span
            style={{
              fontFamily: "'JetBrains Mono','Courier New',monospace", fontSize: 9, fontWeight: 800,
              color: domBadgeColor(dom), border: `1px solid ${domBadgeColor(dom)}66`, borderRadius: 999,
              padding: "2px 8px", whiteSpace: "nowrap",
            }}
          >
            {dom != null ? `${dom}d DOM` : "DOM —"}
          </span>
        )}
      </div>
      <div style={{ fontFamily: C.F, fontSize: 11, color: C.slate, marginBottom: 8 }}>
        {p.address || "Address unavailable"}
      </div>

      {isBrokerage ? (
        <>
          <div style={{ fontFamily: C.F, fontSize: 11, color: C.slateDim, marginBottom: 4 }}>
            Client: {p.client_name || "—"}
          </div>
          <div style={{ fontFamily: C.F, fontSize: 11, color: C.slateDim, marginBottom: 4 }}>
            GCI: {fmtCompact(p.gci)}
          </div>
          <div style={{ fontFamily: C.F, fontSize: 11, color: C.slateDim }}>
            Closing: {p.closing_date || "TBD"}
          </div>
        </>
      ) : (
        <div style={{ fontFamily: C.F, fontSize: 11, color: C.slateDim }}>
          {p.bedrooms ?? "—"}bd / {p.bathrooms ?? "—"}ba · {p.squareFootage ? `${p.squareFootage.toLocaleString()} sqft` : "— sqft"}
        </div>
      )}

      <div style={{ display: "flex", gap: 16, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${accent}22` }}>
        <div>
          <div style={{ fontFamily: C.F, fontSize: 8, letterSpacing: 1, color: C.slateDim, textTransform: "uppercase", marginBottom: 2 }}>Price / Sqft</div>
          <div style={{ fontFamily: C.F, fontSize: 12, fontWeight: 800, color: "#fff" }}>{pricePerSqft ? `$${pricePerSqft.toFixed(0)}` : "—"}</div>
        </div>
        <div>
          <div style={{ fontFamily: C.F, fontSize: 8, letterSpacing: 1, color: C.slateDim, textTransform: "uppercase", marginBottom: 2 }}>
            {isBrokerage ? "Est. Commission" : "Est. Commission (3%)"}
          </div>
          <div style={{ fontFamily: C.F, fontSize: 12, fontWeight: 800, color: "#fff" }}>{fmtCompact(estimatedCommission)}</div>
        </div>
      </div>

      <div style={{ fontSize: 9, marginTop: 10, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: 1 }}>
        {isBrokerage ? `${CATEGORY_LABEL.brokerage} · ${p.stage}` : (CATEGORY_LABEL[p.category] || "Standard")}
      </div>

      {/* Agent Selector + Deploy trigger — pushes this dossier into the
          selected agent's War Room (public.war_room_deals). */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${accent}22` }}>
        <select
          value={selectedAgentId}
          onChange={(e) => onAgentChange(e.target.value)}
          disabled={!agents?.length || deploying}
          style={{
            width: "100%", background: "rgba(255,255,255,0.05)", border: `1px solid ${C.blueBorderDim}`,
            borderRadius: 8, color: "#fff", fontFamily: C.F, fontSize: 11, padding: "8px 10px",
            outline: "none", marginBottom: 8, cursor: agents?.length ? "pointer" : "default",
          }}
        >
          {agents?.length ? (
            agents.map((a) => (
              <option key={a.id} value={a.id} style={{ background: "#0a0a0d" }}>{a.email}</option>
            ))
          ) : (
            <option value="">No agents available</option>
          )}
        </select>

        <button
          onClick={onDeploy}
          disabled={!selectedAgentId || deploying}
          className="bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]"
          style={{
            width: "100%", background: deploying ? "#1d4ed8" : "#2563eb", color: "#fff", border: "none",
            borderRadius: 8, padding: "10px 12px", fontFamily: C.F, fontSize: 11, fontWeight: 800,
            letterSpacing: 1, textTransform: "uppercase", cursor: !selectedAgentId || deploying ? "default" : "pointer",
            boxShadow: "0 0 12px rgba(59,130,246,0.4)", transition: "background 0.15s ease, box-shadow 0.15s ease",
            opacity: !selectedAgentId ? 0.5 : 1,
          }}
          onMouseEnter={(e) => { if (!deploying && selectedAgentId) { e.currentTarget.style.background = "#3b82f6"; e.currentTarget.style.boxShadow = "0 0 20px rgba(59,130,246,0.65)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = deploying ? "#1d4ed8" : "#2563eb"; e.currentTarget.style.boxShadow = "0 0 12px rgba(59,130,246,0.4)"; }}
        >
          {deploying ? "Deploying…" : "Deploy to Agent War Room"}
        </button>

        {/* AI Whisper Campaign — discreet VIP outreach pitch, generated via api/claude.js */}
        <button
          onClick={onGenerateWhisper}
          disabled={whisperLoading}
          className="border-purple-500/50 hover:border-purple-400 text-purple-300"
          style={{
            width: "100%", marginTop: 8, background: "rgba(168,85,247,0.08)", color: "#d8b4fe",
            border: "1px solid rgba(168,85,247,0.5)", borderRadius: 8, padding: "10px 12px",
            fontFamily: C.F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            cursor: whisperLoading ? "default" : "pointer", transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            boxShadow: "none",
          }}
          onMouseEnter={(e) => { if (!whisperLoading) { e.currentTarget.style.borderColor = "rgba(192,132,252,0.9)"; e.currentTarget.style.boxShadow = "0 0 14px rgba(168,85,247,0.35)"; } }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(168,85,247,0.5)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          {whisperLoading ? "AI synthesizing asset telemetry…" : "Generate VIP Whisper Pitch"}
        </button>

        {whisperPitch && (
          <WhisperPitchOutput pitch={whisperPitch} onCopied={onWhisperCopied} />
        )}
      </div>
    </div>
  );
}

function WhisperPitchOutput({ pitch, onCopied }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pitch);
      onCopied?.();
    } catch {
      // clipboard permission denied or unavailable — nothing more we can do here
    }
  };

  return (
    <div style={{ marginTop: 10, position: "relative" }}>
      <div
        className="bg-black/80 font-mono text-xs text-purple-200 p-3 rounded-md"
        style={{
          background: "rgba(0,0,0,0.8)", fontFamily: "'JetBrains Mono','Courier New',monospace",
          fontSize: 11.5, lineHeight: 1.6, color: "#e9d5ff", padding: 12, borderRadius: 8,
          border: "1px solid rgba(168,85,247,0.35)", paddingRight: 36,
        }}
      >
        {pitch}
      </div>
      <button
        onClick={copy}
        title="Copy to clipboard"
        style={{
          position: "absolute", top: 8, right: 8, background: "rgba(168,85,247,0.15)",
          border: "1px solid rgba(168,85,247,0.4)", borderRadius: 6, width: 24, height: 24,
          color: "#d8b4fe", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, lineHeight: 1, padding: 0,
        }}
      >
        ⧉
      </button>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 9, color: "rgba(148,163,184,0.7)", letterSpacing: 1, fontFamily: "'Plus Jakarta Sans',sans-serif", marginBottom: 4, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{value}</div>
    </div>
  );
}
