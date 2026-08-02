// src/components/AgentSurveillance.jsx — SPARK OS Agent Acquisition Grid.
// A live, searchable market acquisition terminal: Mapbox Geocoding drives the
// camera, RentCast drives the inventory, and a zero-fail synthesizer guarantees
// the radar is never empty in front of a client.
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
// 4. RentCast credential handling — READ THIS BEFORE MOVING THE KEY.
//    Vite inlines every VITE_-prefixed env var into the client bundle, so
//    VITE_RENTCAST_API_KEY is readable by anyone who opens devtools on the
//    deployed app, and RentCast bills per request. So the fetch path is
//    ordered by safety, not convenience:
//      (a) /api/market/surveillance — the existing Vercel function, where
//          RENTCAST_API_KEY stays server-side. Preferred, and the only path
//          that should be relied on in production.
//      (b) a direct browser call using import.meta.env.VITE_RENTCAST_API_KEY,
//          for `vite dev` where no serverless runtime is running. Useful for
//          local demos; it exposes the key, which is why it is second.
//      (c) the synthesizer.
//    Deleting VITE_RENTCAST_API_KEY costs nothing in production — path (a)
//    already covers it.
//
// 5. Data provenance: RentCast's /listings/sale endpoint returns ACTIVE
//    listings only. There are no off-market records in it, so "AI predicted
//    seller" nodes are always modeled intelligence, even when the rest of the
//    grid is live. Every modeled node is badged SIM and the legend states the
//    mix, because an agent must never door-knock an address believing it came
//    from a real feed when it did not. Likewise `deals` carries no lat/lng,
//    so the agent's own listings are anchored around the active scan center
//    rather than dropped at a fabricated precise coordinate.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { motion } from "framer-motion";
import {
  Zap, Radar as RadarIcon, MapPin, X, FileText, MessageSquare, Bookmark,
  Loader2, Layers, Crosshair, Copy, Check, Search, Satellite,
} from "lucide-react";
import SparkBoot from "./SparkBoot";

// Mapbox pk.* tokens are public by design. VITE_MAPBOX_TOKEN is the name this
// build asks for; the other two are kept so the currently-provisioned
// .env.local (NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) does not go dark on deploy.
const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  import.meta.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ||
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;

const RENTCAST_KEY = import.meta.env.VITE_RENTCAST_API_KEY;

const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const RED = "#ef4444";
const GREEN = "#10b981";
const AMBER = "#f59e0b";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";

const PANEL_W = 392;
// Left edge the search/filter HUD must clear so it never sits on the legend
// card (16px inset + 246px card + 14px padding each side + borders).
const LEGEND_CLEAR = 312;
const COMMISSION_RATE = 0.03;
const LIVE_LIMIT = 25;
const LUXURY_FLOOR = 5_000_000;
const HIGH_DOM = 60;
const TAX_RATE = 0.0185; // effective blended rate — an estimate, labelled as one

const HOME = {
  longitude: -80.132, latitude: 25.793, zoom: 12.6, pitch: 52, bearing: -17,
  label: "Miami Beach, FL", city: "Miami Beach", state: "FL",
};

const NODE = {
  ACTIVE:    { key: "ACTIVE",    label: "Active Inventory",     color: CYAN,   short: "ACTIVE INVENTORY" },
  EXPIRING:  { key: "EXPIRING",  label: "Flight Risk / High DOM", color: RED,  short: "FLIGHT RISK" },
  PREDICTED: { key: "PREDICTED", label: "AI Predicted Seller",  color: PURPLE, short: "PREDICTED SELLER" },
};

const FILTERS = [
  { key: "ALL",       label: "All Targets",      color: SLATE },
  { key: "EXPIRING",  label: "High DOM / Expiring", color: RED },
  { key: "PREDICTED", label: "AI Predicted Sellers", color: PURPLE },
  { key: "LUXURY",    label: "$5M+ Luxury",      color: AMBER },
];

const STYLES = [
  { id: "tactical", label: "Tactical", url: "mapbox://styles/mapbox/dark-v11", icon: Layers },
  { id: "satellite", label: "Satellite", url: "mapbox://styles/mapbox/satellite-streets-v12", icon: Satellite },
];

// ── formatting ────────────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtFull(n) { return `$${Math.round(n || 0).toLocaleString()}`; }
function fmtInt(n) { return n == null ? "—" : Math.round(n).toLocaleString(); }
function fmtPsf(n) { return n == null || !Number.isFinite(n) ? "—" : `$${Math.round(n).toLocaleString()}`; }

// Haversine — straight-line distance in miles.
function milesFrom(originLng, originLat, lng, lat) {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat - originLat), dLng = toRad(lng - originLng);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(originLat)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Seeded PRNG. A grid that reshuffles on every render reads as broken, so
// synthesized nodes are derived deterministically from the scan center —
// searching the same market twice yields the same grid.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(lng, lat) {
  return Math.abs(Math.round(lng * 10000) * 73856093 ^ Math.round(lat * 10000) * 19349663) >>> 0;
}

// ── Mapbox Geocoding ──────────────────────────────────────────────────────
const GEOCODE_BASE = "https://api.mapbox.com/geocoding/v5/mapbox.places/";

function parseGeoFeature(f) {
  const [lng, lat] = f.center || [];
  const ctx = f.context || [];
  const at = (prefix) => ctx.find((c) => typeof c.id === "string" && c.id.startsWith(prefix));
  const types = f.place_type || [];
  const region = at("region");
  const place = at("place");
  const postcode = at("postcode");
  return {
    id: f.id,
    lng, lat,
    label: f.place_name || f.text,
    city: types.includes("place") ? f.text : place?.text || null,
    state: region?.short_code ? String(region.short_code).replace(/^US-/, "") : null,
    zip: types.includes("postcode") ? f.text : postcode?.text || null,
  };
}

async function geocode(query, { signal } = {}) {
  if (!MAPBOX_TOKEN || !query?.trim()) return [];
  const url =
    `${GEOCODE_BASE}${encodeURIComponent(query.trim())}.json` +
    `?access_token=${MAPBOX_TOKEN}&country=us&limit=5` +
    `&types=place,postcode,locality,neighborhood,address`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const json = await res.json();
  return (json.features || []).map(parseGeoFeature).filter((f) => Number.isFinite(f.lng) && Number.isFinite(f.lat));
}

// ── RentCast normalization ────────────────────────────────────────────────
function domOf(l) {
  if (typeof l.daysOnMarket === "number") return l.daysOnMarket;
  const listed = l.listedDate || l.listDate;
  if (!listed) return null;
  const d = Math.round((Date.now() - new Date(listed).getTime()) / 86400000);
  return Number.isFinite(d) && d >= 0 ? d : null;
}
function hasCut(l) {
  const cur = Number(l.price ?? l.listPrice);
  const hist = Array.isArray(l.priceHistory) ? l.priceHistory
    : l.history && typeof l.history === "object" ? Object.values(l.history) : [];
  if (!cur || !hist.length) return false;
  const prior = hist.map((h) => Number(h?.price ?? h?.listPrice)).filter((p) => Number.isFinite(p) && p > 0);
  return prior.length > 0 && Math.max(...prior) > cur;
}

// The proxy hands back GeoJSON; a direct RentCast call hands back raw rows.
// Both collapse to one shape so the node builder has a single input contract.
function fromFeature(f) {
  const [lng, lat] = f.geometry?.coordinates || [];
  const p = f.properties || {};
  return {
    id: p.id, address: p.address, lng, lat, price: p.price,
    dom: p.daysOnMarket, priceCut: p.category === "price_cut",
    propertyType: p.propertyType, beds: p.bedrooms, baths: p.bathrooms,
    sqft: p.squareFootage, lot: p.lotSize, year: p.yearBuilt,
  };
}
function fromRaw(l) {
  const lat = l.latitude ?? l.coordinates?.latitude;
  const lng = l.longitude ?? l.coordinates?.longitude;
  return {
    id: l.id ?? l.formattedAddress, address: l.formattedAddress ?? l.addressLine1,
    lng, lat, price: Number(l.price ?? l.listPrice) || null,
    dom: domOf(l), priceCut: hasCut(l), propertyType: l.propertyType,
    beds: l.bedrooms, baths: l.bathrooms, sqft: l.squareFootage,
    lot: l.lotSize, year: l.yearBuilt,
  };
}

// Fills the telemetry RentCast did not return. Everything derived here is an
// estimate and is rendered behind an EST. marker so it is never mistaken for
// county record data.
function enrich(n, rng) {
  const value = n.value || 0;
  // Derive floor area from a realistic $/sqft band and clamp it, rather than
  // dividing straight through — an unclamped divide turns a $23M listing into
  // a 30,000 sqft house, which reads as broken data to any working agent.
  const psfBand = 450 + rng() * 2200;
  const sqft = n.sqft || Math.round(Math.max(900, Math.min(15_000, value / psfBand)) / 10) * 10;
  const beds = n.beds || Math.max(2, Math.min(9, Math.round(sqft / 1100)));
  const baths = n.baths || Math.max(2, Math.round(beds * 1.2 * 2) / 2);
  const lot = n.lot || Math.round((sqft * (1.6 + rng() * 2.4)) / 50) * 50;
  const year = n.year || 1958 + Math.floor(rng() * 64);
  return {
    ...n, sqft, beds, baths, lot, year,
    psf: sqft ? value / sqft : null,
    tax: value * TAX_RATE,
    estimated: {
      sqft: !n.sqft, beds: !n.beds, baths: !n.baths, lot: !n.lot, year: !n.year,
    },
  };
}

async function fetchListings({ lng, lat, city, state, zip }) {
  const errors = [];

  // (a) secure server proxy — RENTCAST_API_KEY never reaches the browser.
  const qs = new URLSearchParams();
  if (city && state) qs.set("cityState", `${city},${state}`);
  else if (zip) qs.set("zipCode", zip);
  else { qs.set("latitude", String(lat)); qs.set("longitude", String(lng)); qs.set("radius", "6"); }
  qs.set("limit", String(LIVE_LIMIT));

  try {
    const res = await fetch(`/api/market/surveillance?${qs.toString()}`);
    const ct = res.headers.get("content-type") || "";
    if (res.ok && ct.includes("application/json")) {
      const json = await res.json();
      const feats = json?.geojson?.features || [];
      if (feats.length) return { rows: feats.map(fromFeature), via: "PROXY", error: null };
      if (json?.error) errors.push(json.error);
    } else if (!ct.includes("application/json")) {
      // `vite dev` serves index.html for unknown paths — no serverless runtime.
      errors.push("No serverless runtime for /api in this environment");
    }
  } catch (err) {
    errors.push(err.message || "Proxy unreachable");
  }

  // (b) direct browser call — exposes the key (see header note 4).
  if (RENTCAST_KEY) {
    try {
      const url = new URL("https://api.rentcast.io/v1/listings/sale");
      if (city && state) { url.searchParams.set("city", city); url.searchParams.set("state", state); }
      else if (zip) { url.searchParams.set("zipCode", zip); }
      else {
        url.searchParams.set("latitude", String(lat));
        url.searchParams.set("longitude", String(lng));
        url.searchParams.set("radius", "6");
      }
      url.searchParams.set("status", "Active");
      url.searchParams.set("limit", String(LIVE_LIMIT));
      const res = await fetch(url.toString(), {
        headers: { "X-Api-Key": RENTCAST_KEY, accept: "application/json" },
      });
      if (res.ok) {
        const raw = await res.json();
        const rows = (Array.isArray(raw) ? raw : raw.listings || raw.properties || []).map(fromRaw);
        if (rows.length) return { rows, via: "DIRECT", error: null };
        errors.push("RentCast returned no listings for this market");
      } else {
        errors.push(`RentCast direct call failed (${res.status})`);
      }
    } catch (err) {
      // A browser-blocked CORS preflight lands here — expected, not a bug.
      errors.push(err.message || "RentCast direct call blocked");
    }
  } else {
    errors.push("VITE_RENTCAST_API_KEY not set");
  }

  return { rows: [], via: null, error: errors[0] || "No live listings available" };
}

// ── Zero-fail synthesizer ─────────────────────────────────────────────────
const STREETS = [
  "Ocean Dr", "N Bay Rd", "Palm Ave", "Harbor Dr", "Sunset Blvd", "Lakeview Ter",
  "Ridge Rd", "Crescent Dr", "Waterway Ct", "Coral Way", "Grove St", "Highland Ave",
  "Marina Blvd", "Star Island Dr", "Vista Pl",
];
const SIGNALS = [
  "Equity > 65% · 11yr tenure",
  "Recent permit pull · no listing",
  "Absentee owner · 2 properties",
  "Tax appeal filed · downsizing signal",
  "Neighbor sold 8% over ask",
];
const TYPES = ["Single Family", "Condo", "Townhouse"];

function shortPlace(label) {
  if (!label) return "";
  const parts = label.split(",").map((s) => s.trim());
  const state = parts.find((p) => /^[A-Z]{2}$/.test(p));
  return [parts[0], state].filter(Boolean).join(", ");
}

// 15 high-density luxury nodes ($2.5M–$25M) tiled around the scan center, so
// the radar is operational for any searched market regardless of feed state.
function synthesizeGrid(lng, lat, label, rng, { predictedOnly = false } = {}) {
  const place = shortPlace(label) || "Market";
  const plan = predictedOnly
    ? Array(5).fill("PREDICTED")
    : ["EXPIRING", "EXPIRING", "EXPIRING", "EXPIRING", "EXPIRING",
       "PREDICTED", "PREDICTED", "PREDICTED", "PREDICTED", "PREDICTED",
       "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE"];

  return plan.map((type, i) => {
    const ring = 0.006 + rng() * 0.028;
    const angle = rng() * Math.PI * 2;
    const value = Math.round((2_500_000 + rng() * 22_500_000) / 10_000) * 10_000;
    const dom = type === "PREDICTED" ? null
      : type === "EXPIRING" ? 61 + Math.floor(rng() * 95)
      : 3 + Math.floor(rng() * 52);
    const base = {
      id: `sim-${predictedOnly ? "p" : "g"}-${i}-${Math.round(lng * 1e4)}`,
      synthetic: true, mine: false, type,
      address: `${100 + Math.floor(rng() * 9800)} ${STREETS[Math.floor(rng() * STREETS.length)]}, ${place}`,
      lng: lng + Math.cos(angle) * ring * 1.9,
      lat: lat + Math.sin(angle) * ring,
      value, dom,
      propertyType: TYPES[Math.floor(rng() * TYPES.length)],
      owner: type === "PREDICTED" ? "Off-market — owner of record" : "Listed with competing brokerage",
      signal: type === "PREDICTED" ? SIGNALS[i % SIGNALS.length] : null,
      sqft: null, beds: null, baths: null, lot: null, year: null,
    };
    return enrich(base, rng);
  });
}

function liveToNode(r, i, rng) {
  if (!Number.isFinite(r.lng) || !Number.isFinite(r.lat)) return null;
  const value = Number(r.price) || 0;
  if (!value) return null;
  const type = (r.dom != null && r.dom > HIGH_DOM) || r.priceCut ? "EXPIRING" : "ACTIVE";
  return enrich({
    id: `rc-${r.id ?? i}`, synthetic: false, mine: false, type,
    address: r.address || "Address unavailable",
    lng: r.lng, lat: r.lat, value, dom: r.dom ?? null,
    propertyType: r.propertyType || "Residential",
    owner: type === "EXPIRING" ? "Listed with competing brokerage" : "Active market listing",
    signal: r.priceCut ? "Price reduced from original ask" : null,
    sqft: r.sqft || null, beds: r.beds || null, baths: r.baths || null,
    lot: r.lot || null, year: r.year || null,
  }, rng);
}

// ── Pulsing map node ──────────────────────────────────────────────────────
function PulseNode({ node, selected, dimmed, onPick }) {
  const meta = NODE[node.type];
  const isSel = selected?.id === node.id;
  const size = 12 + Math.min(10, node.value / 2_600_000);
  return (
    <Marker longitude={node.lng} latitude={node.lat} anchor="center"
      onClick={(e) => { e.originalEvent.stopPropagation(); if (!dimmed) onPick(node); }}>
      <div style={{
        position: "relative", width: size, height: size,
        cursor: dimmed ? "default" : "pointer",
        opacity: dimmed ? 0.07 : 1, pointerEvents: dimmed ? "none" : "auto",
        transition: "opacity .38s cubic-bezier(.4,0,.2,1)",
      }} title={node.address}>
        <span style={{
          position: "absolute", inset: -6, borderRadius: "50%", border: `1.5px solid ${meta.color}`,
          animation: "none", animationDelay: `${(node.lat * 7) % 2}s`,
        }} />
        <span style={{
          position: "absolute", inset: 0, borderRadius: "50%", background: meta.color,
          boxShadow: "none",
          border: isSel ? "2px solid #fff" : `1px solid #111111`,
          transform: isSel ? "scale(1.35)" : "scale(1)", transition: "transform .16s ease, box-shadow .16s ease",
        }} />
      </div>
    </Marker>
  );
}

// ── AI tactical directive ─────────────────────────────────────────────────
function buildDirective(n) {
  if (n.type === "EXPIRING") {
    const daysLeft = Math.max(1, 180 - (n.dom || 0));
    return [
      `TARGET: ${n.address}`,
      `STATUS: Competitor listing · ${n.dom ?? "—"} days on market`,
      ``,
      `Listing approaches expiry in ~${daysLeft} days. At ${n.dom ?? "—"} DOM the owner has absorbed months of carrying cost with no close — frustration with showing volume and agent communication is the highest-probability opening.`,
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
  if (n.mine) {
    return [
      `ASSET: ${n.address}`,
      `STATUS: Your active listing · ${n.dom ?? "—"} days on market`,
      ``,
      (n.dom || 0) > 30
        ? `Momentum is decaying past the 30-day mark. Refresh photography, reset the price narrative, and re-blast to your buyer list before week six.`
        : `Inside the hot window. Protect the momentum — push open-house volume and capture every showing agent's feedback while attention is peaking.`,
      ``,
      `PLAY: Run comps this week and pre-empt the seller's price conversation before they raise it.`,
    ].join("\n");
  }
  return [
    `TARGET: ${n.address}`,
    `STATUS: Active market listing · ${n.dom ?? "—"} days on market`,
    ``,
    `Freshly positioned and still inside the attention window — the listing agent is not vulnerable yet. This is a watch, not a strike.`,
    ``,
    `PLAY: Add to watchlist and re-scan at day 60. If it crosses ${HIGH_DOM} DOM without a contract it moves to Flight Risk and the expiring playbook applies.`,
  ].join("\n");
}

function buildOutreach(n) {
  if (n.type === "EXPIRING") {
    return `Hi — I'm a local specialist working ${n.address.split(",")[1]?.trim() || "this market"}.

I noticed your home has been on the market about ${n.dom ?? "a few months"} days. That usually has nothing to do with the house and everything to do with how it's being positioned.

I put together a short breakdown of what's actually moving on your block right now, plus the three changes I'd make in week one. No cost, no pressure — I'll leave it at the door if that's easier.

Would tomorrow morning work?`;
  }
  if (n.type === "PREDICTED") {
    return `Hi — quick note about ${n.address.split(",")[0]}.

I'm not writing to ask you to list. I have buyers actively looking on your street, and based on the last few closings I think your home would test around ${fmtMoney(n.value)}.

If you're ever curious what that number looks like in writing, I'll put it together — no obligation and nothing goes public.

Worth a five-minute conversation?`;
  }
  if (n.mine) {
    return `Hi — checking in on ${n.address.split(",")[0]}.

We're at ${n.dom ?? "—"} days on market. Here's where we stand and what I'd like to adjust this week to keep momentum up.

Do you have ten minutes tomorrow?`;
  }
  return `Hi — I represent buyers actively searching ${n.address.split(",")[1]?.trim() || "this market"}.

I'm reaching out about ${n.address.split(",")[0]} while it's still early in its listing cycle. If your seller would entertain a clean, pre-inspected offer, I'd like to bring one before this goes to a wider audience.

Can we talk today?`;
}

// ── CMA & valuation engine ────────────────────────────────────────────────
function buildCma(n, all) {
  const comps = all
    .filter((c) => c.id !== n.id)
    .map((c) => ({ ...c, dist: milesFrom(n.lng, n.lat, c.lng, c.lat) }))
    // Same-property-type comps first, then nearest — a condo is not a comp
    // for a single-family lot no matter how close it sits.
    .sort((a, b) => {
      const at = a.propertyType === n.propertyType ? 0 : 1;
      const bt = b.propertyType === n.propertyType ? 0 : 1;
      return at - bt || a.dist - b.dist;
    })
    .slice(0, 4);

  const avgValue = comps.length ? comps.reduce((s, c) => s + c.value, 0) / comps.length : n.value;
  const psfComps = comps.filter((c) => Number.isFinite(c.psf) && c.psf > 0);
  const avgPsf = psfComps.length ? psfComps.reduce((s, c) => s + c.psf, 0) / psfComps.length : n.psf;

  // Fair market value blends a $/sqft rebuild against the raw comp average, so
  // one unusually large or small comp cannot dominate the estimate.
  const psfValue = avgPsf && n.sqft ? avgPsf * n.sqft : avgValue;
  const fmv = 0.6 * psfValue + 0.4 * avgValue;

  const overPct = fmv ? ((n.value - fmv) / fmv) * 100 : 0;
  // EXPIRING has already proven the market rejects the current ask, so the
  // recommendation shades below FMV; a pre-market approach can test above it.
  const factor = n.type === "EXPIRING" ? 0.97 : n.type === "PREDICTED" ? 1.02 : 1.0;
  const recommended = Math.round((fmv * factor) / 5000) * 5000;

  const domAt = (price) => {
    const over = fmv ? Math.max(0, ((price - fmv) / fmv) * 100) : 0;
    return Math.max(14, Math.min(210, Math.round(34 * (1 + (over / 100) * 2.4))));
  };

  return {
    comps, avgValue, avgPsf, fmv, overPct, recommended,
    domAtAsk: domAt(n.value), domAtRec: domAt(recommended),
    simulated: n.synthetic || comps.some((c) => c.synthetic),
  };
}

function buildTearSheet(n, cma, marketLabel) {
  const line = "─".repeat(52);
  return [
    `SPARK OS REAL ESTATE AI — INSTANT CMA & COMP ANALYSIS`,
    line,
    `SUBJECT      ${n.address}`,
    `MARKET       ${marketLabel}`,
    `TYPE         ${n.propertyType}`,
    `GENERATED    ${new Date().toLocaleString()}`,
    ``,
    `VALUATION`,
    line,
    `Target price          ${fmtFull(n.value)}`,
    `Estimated fair value  ${fmtFull(cma.fmv)}`,
    `Variance vs FMV       ${cma.overPct >= 0 ? "+" : ""}${cma.overPct.toFixed(1)}%`,
    `Subject $/sqft        ${fmtPsf(n.psf)}   (${fmtInt(n.sqft)} sqft)`,
    `Comp avg $/sqft       ${fmtPsf(cma.avgPsf)}`,
    ``,
    `COMPARABLES (${cma.comps.length})`,
    line,
    ...cma.comps.map((c) =>
      `${(c.address.split(",")[0] || "").padEnd(28).slice(0, 28)} ${fmtMoney(c.value).padStart(9)} ${fmtPsf(c.psf).padStart(7)}/sf ${c.dist.toFixed(2).padStart(5)}mi`),
    ``,
    `AI STRATEGY DIRECTIVE`,
    line,
    `Recommended entry     ${fmtFull(cma.recommended)}`,
    `Expected DOM at entry ${cma.domAtRec} days`,
    `Expected DOM at ask   ${cma.domAtAsk} days`,
    `Projected GCI @ 3%    ${fmtFull(cma.recommended * COMMISSION_RATE)}`,
    ``,
    cma.simulated
      ? `NOTE: This tear-sheet includes SIMULATED nodes. Modeled comparables are\nnot MLS records and must not be presented to a client as verified sales.`
      : `Comparables sourced from RentCast active listings.`,
    ``,
    `Property telemetry not returned by the data provider is estimated and`,
    `marked EST. in the terminal. Estimates are not county record data.`,
  ].join("\n");
}

// ── Component ─────────────────────────────────────────────────────────────

export default function AgentSurveillance({ user }) {
  const [nodes, setNodes] = useState([]);
  const [booting, setBooting] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [feed, setFeed] = useState({ live: 0, sim: 0, via: null });
  const [market, setMarket] = useState(HOME.label);
  const [selected, setSelected] = useState(null);
  const [styleId, setStyleId] = useState("tactical");
  const [filter, setFilter] = useState("ALL");

  const [query, setQuery] = useState("");
  const [suggests, setSuggests] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);

  const [directive, setDirective] = useState(null);
  const [decrypting, setDecrypting] = useState(false);
  const [cmaOpen, setCmaOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sheetCopied, setSheetCopied] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [toast, setToast] = useState(null);

  const mapRef = useRef(null);
  const decryptTimer = useRef(null);
  const setupDone = useRef(false);
  const scanToken = useRef(0);
  const dealsRef = useRef(null);
  const centerRef = useRef({ lng: HOME.longitude, lat: HOME.latitude });

  useEffect(() => {
    setDirective(null); setDecrypting(false); setCmaOpen(false); setScriptOpen(false);
    if (decryptTimer.current) clearInterval(decryptTimer.current);
  }, [selected?.id]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 3600); return () => clearTimeout(t); }, [toast]);
  useEffect(() => () => { if (decryptTimer.current) clearInterval(decryptTimer.current); }, []);

  // The agent's own pipeline. `deals` has no coordinates, so rows are cached
  // once and re-anchored around whichever market is currently being scanned.
  const loadDeals = useCallback(async () => {
    if (dealsRef.current) return dealsRef.current;
    const sb = window.__supabase;
    if (!sb || !user?.id) { dealsRef.current = []; return []; }
    try {
      const { data, error: dErr } = await sb
        .from("deals")
        .select("id, address, deal_volume, stage, last_activity_at")
        .eq("agent_id", user.id)
        .neq("stage", "closed");
      if (dErr) throw new Error(dErr.message);
      dealsRef.current = data || [];
    } catch (err) {
      setError(err.message || "Could not load your pipeline.");
      dealsRef.current = [];
    }
    return dealsRef.current;
  }, [user?.id]);

  const anchorDeals = useCallback((deals, lng, lat, rng) =>
    deals.map((d, i) => enrich({
      id: `deal-${d.id}`, synthetic: false, mine: true, type: "ACTIVE",
      address: d.address || "Address unavailable",
      lng: lng + ((i % 4) - 1.5) * 0.012,
      lat: lat + (Math.floor(i / 4) - 1) * 0.011,
      value: Number(d.deal_volume) || 0,
      dom: d.last_activity_at ? Math.round((Date.now() - new Date(d.last_activity_at)) / 86400000) : null,
      propertyType: "Single Family", owner: "You", signal: null,
      sqft: null, beds: null, baths: null, lot: null, year: null,
    }, rng)).filter((n) => n.value > 0), []);

  // ── Market scan ────────────────────────────────────────────────────────
  const runScan = useCallback(async (place, { fly = true } = {}) => {
    const token = ++scanToken.current;
    setScanning(true); setError(null); setSelected(null); setFilter("ALL");
    setMarket(place.label);
    centerRef.current = { lng: place.lng, lat: place.lat };

    if (fly) {
      mapRef.current?.flyTo({
        center: [place.lng, place.lat], zoom: 12.6, pitch: 52, bearing: -17,
        duration: 2200, curve: 1.42, easing: (t) => t * (2 - t), essential: true,
      });
    }

    const { rows, via, error: feedErr } = await fetchListings(place);
    if (token !== scanToken.current) return;

    const rng = mulberry32(seedFrom(place.lng, place.lat));
    let built;
    let liveCount = 0;

    if (rows.length) {
      const liveNodes = rows.slice(0, LIVE_LIMIT).map((r, i) => liveToNode(r, i, rng)).filter(Boolean);
      liveCount = liveNodes.length;
      // RentCast carries no off-market records — predicted sellers stay modeled.
      built = [...liveNodes, ...synthesizeGrid(place.lng, place.lat, place.label, rng, { predictedOnly: true })];
    } else {
      built = synthesizeGrid(place.lng, place.lat, place.label, rng);
      if (feedErr) setError(`Live feed unavailable — ${feedErr}. Showing a simulated grid.`);
    }

    const deals = await loadDeals();
    if (token !== scanToken.current) return;
    const mine = anchorDeals(deals, place.lng, place.lat, mulberry32(seedFrom(place.lng, place.lat) + 7));

    const all = [...mine, ...built];
    setNodes(all);
    setFeed({ live: liveCount, sim: all.filter((n) => n.synthetic).length, via });
    setScanning(false);
    setBooting(false);
  }, [loadDeals, anchorDeals]);

  useEffect(() => {
    runScan({ ...HOME, lng: HOME.longitude, lat: HOME.latitude }, { fly: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ── Geocoding suggestions (debounced) ──────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) { setSuggests([]); return; }
    const ctrl = new AbortController();
    setGeoBusy(true);
    const t = setTimeout(async () => {
      try {
        const list = await geocode(query, { signal: ctrl.signal });
        setSuggests(list); setSuggestOpen(true);
      } catch (err) {
        if (err.name !== "AbortError") setSuggests([]);
      } finally { setGeoBusy(false); }
    }, 280);
    return () => { clearTimeout(t); ctrl.abort(); setGeoBusy(false); };
  }, [query]);

  const submitSearch = useCallback(async (place) => {
    setSuggestOpen(false);
    if (place) { setQuery(""); runScan(place); return; }
    if (!query.trim()) return;
    if (suggests.length) { setQuery(""); runScan(suggests[0]); return; }
    setGeoBusy(true);
    try {
      const list = await geocode(query);
      if (list.length) { setQuery(""); runScan(list[0]); }
      else setToast("No coordinates found for that search.");
    } catch {
      setToast("Geocoding unavailable — check the Mapbox token.");
    } finally { setGeoBusy(false); }
  }, [query, suggests, runScan]);

  // ── Derived ────────────────────────────────────────────────────────────
  const matches = useCallback((n) => {
    if (filter === "ALL") return true;
    if (filter === "LUXURY") return n.value >= LUXURY_FLOOR;
    return n.type === filter;
  }, [filter]);

  const counts = useMemo(() => ({
    ACTIVE: nodes.filter((n) => n.type === "ACTIVE").length,
    EXPIRING: nodes.filter((n) => n.type === "EXPIRING").length,
    PREDICTED: nodes.filter((n) => n.type === "PREDICTED").length,
    MINE: nodes.filter((n) => n.mine).length,
    LUXURY: nodes.filter((n) => n.value >= LUXURY_FLOOR).length,
  }), [nodes]);

  const cma = useMemo(() => (selected ? buildCma(selected, nodes) : null), [selected, nodes]);
  const projectedGci = selected ? selected.value * COMMISSION_RATE : 0;
  const distance = selected ? milesFrom(centerRef.current.lng, centerRef.current.lat, selected.lng, selected.lat) : 0;

  const handleMapLoad = useCallback((e) => {
    if (setupDone.current) return;
    setupDone.current = true;
    const map = e.target;
    map.resize();
    const onResize = () => map.resize();
    window.addEventListener("resize", onResize);
    map.once("remove", () => window.removeEventListener("resize", onResize));
    try {
      map.setFog({ color: "#050505", "high-color": "#111111", "horizon-blend": 0.03, "space-color": "#050505", "star-intensity": 0 });
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

  const copyTearSheet = useCallback(async () => {
    if (!selected || !cma) return;
    try {
      await navigator.clipboard.writeText(buildTearSheet(selected, cma, market));
      setSheetCopied(true); setTimeout(() => setSheetCopied(false), 2200);
      setToast("CMA tear-sheet copied.");
    } catch { setToast("Copy failed — select and copy manually."); }
  }, [selected, cma, market]);

  if (booting) return <SparkBoot label="SCANNING MARKET GRID FOR ACQUISITION TARGETS..." />;

  const selMeta = selected ? NODE[selected.type] : null;
  const mapW = `calc(100% - ${PANEL_W}px)`;

  return (
    <div className="w-full h-full relative bg-[#050505] overflow-hidden"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "hidden", background: "#050505" }}>
      <style>{`
        @keyframes asPulse{0%{transform:scale(.55);opacity:.95}100%{transform:scale(2.7);opacity:0}}
        @keyframes asSpin{to{transform:rotate(360deg)}}
        @keyframes asBlink{0%,100%{opacity:1}50%{opacity:.35}}
        @keyframes asSweep{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        .as-search-input::placeholder{color:rgba(148,163,184,0.5)}
      `}</style>

      {/* ── Map ── */}
      {!MAPBOX_TOKEN ? (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: mapW, display: "flex", alignItems: "center", justifyContent: "center", color: RED, fontFamily: F, fontSize: 13, padding: 24, textAlign: "center" }}>
          Map access token not configured — set VITE_MAPBOX_TOKEN (or NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) in .env.local.
        </div>
      ) : (
        <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: mapW }}>
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={HOME}
            mapStyle={STYLES.find((s) => s.id === styleId).url}
            style={{ position: "absolute", inset: 0 }}
            onLoad={handleMapLoad}
            onStyleData={handleMapLoad}
            onClick={() => setSelected(null)}
          >
            {nodes.map((n) => (
              <PulseNode key={n.id} node={n} selected={selected} dimmed={!matches(n)} onPick={pickNode} />
            ))}
          </Map>

          {/* Tactical grid overlay — pure CSS, non-interactive */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2,
            backgroundImage: `linear-gradient(${CYAN}0c 1px, transparent 1px), linear-gradient(90deg, ${CYAN}0c 1px, transparent 1px)`,
            backgroundSize: "68px 68px",
          }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "none"}} />
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 3, opacity: 0.3 }}>
            <Crosshair size={26} color={CYAN} />
          </div>

          {/* Scan sweep */}
          {scanning && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, overflow: "hidden", zIndex: 30, pointerEvents: "none" }}>
              <div style={{ width: "50%", height: "100%", background: `linear-gradient(90deg,transparent,${CYAN},transparent)`, animation: "asSweep 1.1s linear infinite" }} />
            </div>
          )}
        </div>
      )}

      {/* ── Market Search Command HUD (top-center of the map area) ──
          Offset past LEGEND_CLEAR so the HUD centers in the space to the RIGHT
          of the radar legend rather than underneath it. */}
      <div style={{
        position: "absolute", top: 16, left: LEGEND_CLEAR, zIndex: 40,
        width: `calc(100% - ${PANEL_W}px - ${LEGEND_CLEAR}px)`,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 9, pointerEvents: "none",
      }}>
        <div style={{ width: "min(460px, 100%)", pointerEvents: "auto", position: "relative" }}>
          <div className="tracking-wider" style={{
            fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 2.2, color: SLATE_DIM,
            textTransform: "uppercase", textAlign: "center", marginBottom: 5,
            textShadow: "none",
          }}>
            [ Search Market Coordinates ]
          </div>

          <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
            display: "flex", alignItems: "center", gap: 9, padding: "0 12px", height: 42,
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${suggestOpen && suggests.length ? `${CYAN}66` : "#27272a"}`,
            borderRadius: 11, boxShadow: "none",
          }}>
            {geoBusy || scanning
              ? <Loader2 size={14} color={CYAN} style={{ animation: "asSpin 1s linear infinite", flexShrink: 0 }} />
              : <Search size={14} color={SLATE_DIM} style={{ flexShrink: 0 }} />}
            <input
              className="as-search-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => suggests.length && setSuggestOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submitSearch(); }
                if (e.key === "Escape") setSuggestOpen(false);
              }}
              placeholder='Palm Beach, FL · Brickell · 33139'
              style={{
                flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none",
                fontFamily: MONO, fontSize: 11.5, color: "#fff", letterSpacing: 0.3,
              }}
            />
            <button onClick={() => submitSearch()} disabled={!query.trim() || scanning}
              className="font-mono" style={{
                flexShrink: 0, fontFamily: MONO, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.2,
                textTransform: "uppercase", padding: "6px 11px", borderRadius: 7,
                background: query.trim() ? `${CYAN}1e` : "transparent",
                border: `1px solid ${query.trim() ? `${CYAN}88` : "#27272a"}`,
                color: query.trim() ? CYAN : SLATE_DIM,
                cursor: query.trim() && !scanning ? "pointer" : "default",
              }}>Scan</button>
          </div>

          {/* Geocoding suggestions */}
          {suggestOpen && suggests.length > 0 && (
            <div className="backdrop-blur-2xl bg-black/80 border border-white/10" style={{
              position: "absolute", top: 48 + 18, left: 0, right: 0, zIndex: 45,
              background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
              border: "1px solid #27272a", borderRadius: 11, overflow: "hidden",
              boxShadow: "none",
            }}>
              {suggests.map((s) => (
                <button key={s.id} onClick={() => submitSearch(s)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 9, padding: "9px 12px",
                    background: "transparent", border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                    cursor: "pointer", textAlign: "left",
                  }}>
                  <MapPin size={11} color={CYAN} style={{ flexShrink: 0 }} />
                  <span style={{ flex: 1, fontFamily: F, fontSize: 11, color: SLATE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, flexShrink: 0 }}>
                    {s.lat.toFixed(2)}, {s.lng.toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Tactical Filter Matrix ── */}
        <div className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center", maxWidth: "100%",
          gap: 4, padding: 4, pointerEvents: "auto",
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 10, boxShadow: "none",
        }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const n = f.key === "ALL" ? nodes.length : counts[f.key] || 0;
            return (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className="font-mono" style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8,
                  textTransform: "uppercase", padding: "7px 9px", borderRadius: 7, cursor: "pointer",
                  whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
                  background: on ? `${f.color}1e` : "transparent",
                  border: `1px solid ${on ? `${f.color}88` : "transparent"}`,
                  color: on ? (f.key === "ALL" ? "#fff" : f.color) : SLATE_DIM,
                  boxShadow: "none",
                  transition: "background .2s ease, color .2s ease, border-color .2s ease",
                }}>
                [ {f.label} ]
                <span style={{ opacity: 0.75, fontWeight: 700 }}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Radar legend (top-left) ── */}
      <div className="backdrop-blur-2xl bg-black/60 border border-white/10"
        style={{
          position: "absolute", top: 16, left: 16, zIndex: 20, width: 246,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          border: "1px solid #27272a", borderRadius: 12, padding: 14,
          boxShadow: "none",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <Zap size={15} color={PURPLE_LT} fill={PURPLE_LT}
            style={{ filter: "none", animation: "none" }} />
          <span style={{ fontFamily: F, fontSize: 12, fontWeight: 800, letterSpacing: 1.6, color: "#fff" }}>SPARK OS</span>
        </div>
        <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 7.5, fontWeight: 700, letterSpacing: 2.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>
          Radar Legend · Acquisition Grid
        </div>
        <div className="font-mono" style={{
          fontFamily: MONO, fontSize: 9, color: CYAN, marginBottom: 11,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }} title={market}>▸ {market}</div>

        {Object.values(NODE).map((m) => {
          const active = filter === "ALL" || filter === m.key || filter === "LUXURY";
          return (
            <button key={m.key} onClick={() => setFilter(filter === m.key ? "ALL" : m.key)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 9, marginBottom: 7,
                background: filter === m.key ? `${m.color}16` : "transparent",
                border: `1px solid ${filter === m.key ? `${m.color}66` : "transparent"}`,
                borderRadius: 8, padding: "6px 8px", cursor: "pointer", textAlign: "left",
                opacity: active ? 1 : 0.4, transition: "opacity .2s ease, background .2s ease",
              }}>
              <span style={{ position: "relative", width: 9, height: 9, flexShrink: 0 }}>
                <span style={{ position: "absolute", inset: -4, borderRadius: "50%", border: `1px solid ${m.color}`, animation: "none" }} />
                <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: m.color, boxShadow: "none"}} />
              </span>
              <span style={{ flex: 1, fontFamily: F, fontSize: 10, color: SLATE, whiteSpace: "nowrap" }}>{m.label}</span>
              <span className="font-mono" style={{ fontFamily: MONO, fontSize: 10, fontWeight: 800, color: m.color }}>{counts[m.key]}</span>
            </button>
          );
        })}

        {/* Feed provenance — states the live/modeled mix outright. */}
        <div className="font-mono" style={{
          marginTop: 10, fontFamily: MONO, fontSize: 7, letterSpacing: 0.6, lineHeight: 1.55,
          color: feed.live ? CYAN : AMBER,
          background: feed.live ? `${CYAN}0d` : `${AMBER}0f`,
          border: `1px solid ${feed.live ? `${CYAN}44` : `${AMBER}44`}`,
          borderRadius: 7, padding: "6px 8px",
        }}>
          {feed.live > 0 ? (
            <>▣ {feed.live} LIVE RENTCAST {feed.via === "PROXY" ? "(SECURE PROXY)" : "(DIRECT)"} · {feed.sim} MODELED.
              PREDICTED SELLERS ARE ALWAYS MODELED — NO OFF-MARKET FEED EXISTS.</>
          ) : (
            <>⚠ SIMULATED GRID — ALL {feed.sim} NODES ARE MODELED INTELLIGENCE, NOT AN MLS FEED.</>
          )}
        </div>

        {/* Style toggle */}
        <div style={{ display: "flex", gap: 6, marginTop: 11 }}>
          {STYLES.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => { setupDone.current = false; setStyleId(s.id); }}
                className="font-mono"
                style={{
                  flex: 1, fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 1, padding: "6px 0",
                  borderRadius: 7, cursor: "pointer", textTransform: "uppercase",
                  background: styleId === s.id ? `${CYAN}1e` : "transparent",
                  border: `1px solid ${styleId === s.id ? CYAN : "#27272a"}`,
                  color: styleId === s.id ? CYAN : SLATE_DIM,
                }}>
                <Icon size={9} style={{ verticalAlign: -1, marginRight: 4 }} />{s.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="font-mono" style={{
          position: "absolute", bottom: 16, left: 16, zIndex: 20, fontFamily: MONO, fontSize: 10,
          lineHeight: 1.5, color: AMBER, background: "rgba(255,176,32,0.08)", border: `1px solid ${AMBER}44`,
          borderRadius: 8, padding: "8px 12px", maxWidth: 340,
        }}>{error}</div>
      )}

      {/* Above the modals (z-index 70) on purpose — copy/watchlist actions are
          triggered from inside them, and their feedback must not be buried. */}
      {toast && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{
            position: "absolute", bottom: 22, left: `calc((100% - ${PANEL_W}px) / 2)`, transform: "translateX(-50%)", zIndex: 90,
            background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
            border: `1px solid ${CYAN}88`, borderRadius: 10, padding: "10px 18px", color: "#fff",
            fontFamily: F, fontSize: 12, fontWeight: 700, boxShadow: "none", whiteSpace: "nowrap",
          }}>{toast}</motion.div>
      )}

      {/* ── Acquisition Dossier (right) ── */}
      <div className="w-96 backdrop-blur-2xl bg-black/60 border-l border-white/10 flex flex-col h-full z-10"
        style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: PANEL_W, zIndex: 10,
          background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
          borderLeft: "1px solid #27272a", display: "flex", flexDirection: "column",
          padding: 18, boxSizing: "border-box", overflowY: "auto",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <RadarIcon size={14} color={selMeta ? selMeta.color : PURPLE_LT} style={{ filter: "none"}} />
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
              border: "1px dashed #27272a",
              backgroundImage: "linear-gradient(rgba(148,163,184,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,0.07) 1px,transparent 1px)",
              backgroundSize: "16px 16px",
            }}>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8 }}>
                <Crosshair size={22} color={CYAN} style={{ filter: "none", animation: "none" }} />
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 9, letterSpacing: 2, color: SLATE_DIM }}>
                  {scanning ? "SCANNING MARKET…" : "AWAITING TARGET LOCK"}
                </span>
              </div>
            </div>

            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 9 }}>
              Grid Summary
            </div>
            {[["Active Inventory", counts.ACTIVE, CYAN],
              ["— of which yours", counts.MINE, CYAN],
              ["Flight Risk / High DOM", counts.EXPIRING, RED],
              ["AI Predicted Sellers", counts.PREDICTED, PURPLE],
              ["$5M+ Luxury Band", counts.LUXURY, AMBER]].map(([l, v, c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c, boxShadow: "none", flexShrink: 0 }} />
                <span style={{ flex: 1, fontFamily: F, fontSize: 11, color: SLATE }}>{l}</span>
                <span className="font-mono" style={{ fontFamily: MONO, fontSize: 14, fontWeight: 800, color: c }}>{v}</span>
              </div>
            ))}

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #27272a" }}>
              <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.6, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 6 }}>
                Total Grid Opportunity
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 22, fontWeight: 800, color: "#fff", textShadow: "none"}}>
                {fmtMoney(nodes.filter((n) => !n.mine).reduce((s, n) => s + n.value * COMMISSION_RATE, 0))}
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8.5, color: SLATE_DIM, marginTop: 3 }}>
                PROJECTED GCI ACROSS {nodes.filter((n) => !n.mine).length} OFF-BOOK TARGETS @ 3%
              </div>
            </div>

            {watchlist.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #27272a" }}>
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
              background: "#18181b", boxShadow: "none",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 9 }}>
                <MapPin size={14} color={selMeta.color} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ fontFamily: F, fontSize: 13, fontWeight: 800, color: "#fff", lineHeight: 1.35 }}>{selected.address}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11, flexWrap: "wrap" }}>
                <span style={{
                  fontFamily: MONO, fontSize: 8, fontWeight: 800, letterSpacing: 0.8, color: selMeta.color,
                  background: `${selMeta.color}14`, border: `1px solid ${selMeta.color}55`, borderRadius: 999,
                  padding: "3px 9px", boxShadow: "none",
                }}>{selMeta.short}</span>
                {selected.mine && (
                  <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: GREEN, border: `1px solid ${GREEN}55`, borderRadius: 4, padding: "2px 5px" }}>YOURS</span>
                )}
                {selected.synthetic
                  ? <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 4, padding: "2px 5px" }}>SIM</span>
                  : <span className="font-mono" style={{ fontFamily: MONO, fontSize: 7, color: CYAN, border: `1px solid ${CYAN}55`, borderRadius: 4, padding: "2px 5px" }}>LIVE</span>}
                <span style={{ fontFamily: F, fontSize: 10, color: SLATE_DIM, marginLeft: "auto" }}>{selected.propertyType}</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, paddingTop: 10, borderTop: "1px solid #27272a" }}>
                {/* Owner spans both columns and wraps — the string is a sentence, not a metric. */}
                {[["Estimated Value", fmtMoney(selected.value), "#fff", false],
                  ["Days on Market", selected.dom != null ? `${selected.dom}d` : "OFF-MARKET", (selected.dom || 0) > HIGH_DOM ? RED : SLATE, false],
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

              {/* Property telemetry */}
              <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid #27272a" }}>
                <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 7 }}>
                  Property Telemetry
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "9px 10px" }}>
                  {[["Price / Sqft", fmtPsf(selected.psf), false],
                    ["Living Area", `${fmtInt(selected.sqft)} sf`, selected.estimated.sqft],
                    ["Lot Size", `${fmtInt(selected.lot)} sf`, selected.estimated.lot],
                    ["Bed / Bath", `${selected.beds} / ${selected.baths}`, selected.estimated.beds],
                    ["Year Built", selected.year, selected.estimated.year],
                    ["Est. Taxes", `${fmtMoney(selected.tax)}/yr`, true]].map(([l, v, est]) => (
                    <div key={l} style={{ minWidth: 0 }}>
                      <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7, letterSpacing: 0.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
                        {est && <span style={{ color: AMBER, opacity: 0.85, flexShrink: 0 }}>·EST</span>}
                      </div>
                      <div className="font-mono" style={{
                        fontFamily: MONO, fontSize: 11, fontWeight: 800, color: est ? SLATE : "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {selected.signal && (
                <div style={{ marginTop: 11, paddingTop: 10, borderTop: "1px solid #27272a" }}>
                  <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3 }}>Predictive Signal</div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 10, color: PURPLE_LT }}>{selected.signal}</div>
                </div>
              )}
            </div>

            {/* Projected GCI */}
            <div style={{
              border: `1px solid ${GREEN}44`, borderRadius: 11, padding: 13, marginBottom: 13,
              background: `#111111`,
            }}>
              <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8, letterSpacing: 1.5, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>Projected GCI</div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 24, fontWeight: 800, color: GREEN, textShadow: "none"}}>
                {fmtFull(projectedGci)}
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginTop: 3 }}>
                {fmtFull(projectedGci)} AT 3% ON {fmtMoney(selected.value)}
              </div>
            </div>

            {/* AI tactical directive */}
            <button onClick={runDirective} disabled={decrypting}
              style={{
                width: "100%", background: decrypting ? `${PURPLE}22` : `#8b5cf6`,
                border: `1px solid ${PURPLE}88`, borderRadius: 10, padding: "11px 14px",
                fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: "#fff", cursor: decrypting ? "default" : "pointer",
                boxShadow: "none",
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

            {/* Offensive action bridges */}
            <div style={{ borderTop: "1px solid #27272a", paddingTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
              <button onClick={() => setCmaOpen(true)}
                style={{
                  width: "100%", background: `${CYAN}1c`, border: `1px solid ${CYAN}77`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: CYAN, cursor: "pointer", boxShadow: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <FileText size={13} /> [ Generate Instant CMA ]
              </button>
              <button onClick={() => setScriptOpen(true)}
                style={{
                  width: "100%", background: `${PURPLE}1c`, border: `1px solid ${PURPLE}88`, borderRadius: 10,
                  padding: "11px 14px", fontFamily: F, fontSize: 10.5, fontWeight: 800, letterSpacing: 1,
                  textTransform: "uppercase", color: PURPLE_LT, cursor: "pointer", boxShadow: "none",
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

      {/* ── Instant CMA & Comp Analysis modal ── */}
      {cmaOpen && selected && cma && (
        <div onClick={() => setCmaOpen(false)}
          style={{ position: "absolute", inset: 0, zIndex: 70, background: "rgba(0,0,0,0.74)", backdropFilter: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}
            className="backdrop-blur-2xl bg-black/60 border border-white/10"
            style={{
              width: "min(620px, 100%)", maxHeight: "86%", overflowY: "auto",
              background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
              border: `1px solid ${CYAN}55`, borderRadius: 14, padding: 20, boxShadow: "none",
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
              <FileText size={15} color={CYAN} />
              <span style={{ fontFamily: F, fontSize: 13, fontWeight: 800, letterSpacing: 1.3, color: "#fff" }}>INSTANT CMA &amp; COMP ANALYSIS</span>
              <button onClick={() => setCmaOpen(false)} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={16} /></button>
            </div>
            <div className="tracking-wider text-slate-400" style={{ fontFamily: F, fontSize: 8.5, letterSpacing: 2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 15 }}>
              {selected.address} · {selected.propertyType}
            </div>

            {/* Subject vs fair market value */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 13 }}>
              <div style={{ border: "1px solid #27272a", borderRadius: 11, padding: 13, background: "#18181b" }}>
                <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>Subject Target Price</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: "#fff" }}>{fmtFull(selected.value)}</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, marginTop: 3 }}>{fmtPsf(selected.psf)}/sf · {fmtInt(selected.sqft)} sf</div>
              </div>
              <div style={{ border: `1px solid ${CYAN}44`, borderRadius: 11, padding: 13, background: `linear-gradient(135deg,${CYAN}0e,rgba(0,0,0,0.25))` }}>
                <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>Estimated Fair Market Value</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 19, fontWeight: 800, color: CYAN, textShadow: "none"}}>{fmtFull(cma.fmv)}</div>
                <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9, marginTop: 3, color: cma.overPct >= 0 ? AMBER : GREEN }}>
                  SUBJECT {cma.overPct >= 0 ? "+" : ""}{cma.overPct.toFixed(1)}% VS FMV
                </div>
              </div>
            </div>

            {/* Comparables micro-table */}
            <div className="tracking-wider" style={{ fontFamily: F, fontSize: 8, letterSpacing: 1.5, color: CYAN, textTransform: "uppercase", marginBottom: 7 }}>
              Comparable Sales · {cma.comps.length}
            </div>
            <div style={{ border: "1px solid #27272a", borderRadius: 10, overflow: "hidden", marginBottom: 13 }}>
              <div className="font-mono" style={{
                display: "grid", gridTemplateColumns: "1fr 78px 68px 54px", gap: 8, padding: "7px 11px",
                background: "#18181b", fontFamily: MONO, fontSize: 7.5, letterSpacing: 1,
                color: SLATE_DIM, textTransform: "uppercase",
              }}>
                <span>Address</span><span style={{ textAlign: "right" }}>Sold</span>
                <span style={{ textAlign: "right" }}>$/Sqft</span><span style={{ textAlign: "right" }}>Dist</span>
              </div>
              {cma.comps.map((c) => (
                <div key={c.id} className="font-mono" style={{
                  display: "grid", gridTemplateColumns: "1fr 78px 68px 54px", gap: 8, padding: "8px 11px",
                  borderTop: "1px solid rgba(255,255,255,0.05)", fontFamily: MONO, fontSize: 10, alignItems: "center",
                }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, color: SLATE }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: NODE[c.type].color, flexShrink: 0 }} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.address.split(",")[0]}</span>
                  </span>
                  <span style={{ textAlign: "right", color: "#fff", fontWeight: 700 }}>{fmtMoney(c.value)}</span>
                  <span style={{ textAlign: "right", color: SLATE }}>{fmtPsf(c.psf)}</span>
                  <span style={{ textAlign: "right", color: SLATE_DIM }}>{c.dist.toFixed(2)}mi</span>
                </div>
              ))}
              <div className="font-mono" style={{
                display: "grid", gridTemplateColumns: "1fr 78px 68px 54px", gap: 8, padding: "8px 11px",
                borderTop: `1px solid ${CYAN}33`, background: `${CYAN}0a`, fontFamily: MONO, fontSize: 10,
              }}>
                <span style={{ color: SLATE_DIM, letterSpacing: 1, fontSize: 8, textTransform: "uppercase", alignSelf: "center" }}>Comp Average</span>
                <span style={{ textAlign: "right", color: CYAN, fontWeight: 800 }}>{fmtMoney(cma.avgValue)}</span>
                <span style={{ textAlign: "right", color: CYAN, fontWeight: 800 }}>{fmtPsf(cma.avgPsf)}</span>
                <span />
              </div>
            </div>

            {/* AI strategy directive */}
            <div style={{ border: `1px solid ${PURPLE}44`, borderRadius: 11, padding: 13, marginBottom: 14, background: `linear-gradient(135deg,${PURPLE}0e,rgba(0,0,0,0.25))` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 9 }}>
                <Zap size={12} color={PURPLE_LT} />
                <span className="tracking-wider" style={{ fontFamily: F, fontSize: 8.5, fontWeight: 800, letterSpacing: 1.5, color: PURPLE_LT, textTransform: "uppercase" }}>AI Strategy Directive</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11, marginBottom: 10 }}>
                {[["Recommended Entry", fmtFull(cma.recommended), PURPLE_LT],
                  ["Expected DOM", `${cma.domAtRec} days`, "#fff"],
                  ["GCI @ 3%", fmtFull(cma.recommended * COMMISSION_RATE), GREEN]].map(([l, v, c]) => (
                  <div key={l} style={{ minWidth: 0 }}>
                    <div className="tracking-wider" style={{ fontFamily: F, fontSize: 7, letterSpacing: 1, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 3 }}>{l}</div>
                    <div className="font-mono" style={{ fontFamily: MONO, fontSize: 13, fontWeight: 800, color: c, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontFamily: F, fontSize: 10.5, lineHeight: 1.6, color: SLATE, borderTop: "1px solid #27272a", paddingTop: 9 }}>
                {selected.type === "EXPIRING"
                  ? `The market has already rejected ${fmtMoney(selected.value)} over ${selected.dom ?? "—"} days. Re-entering at ${fmtFull(cma.recommended)} prices ${Math.abs(cma.overPct).toFixed(1)}% of dead air out of the ask and should clear in roughly ${cma.domAtRec} days versus ${cma.domAtAsk} at the current number.`
                  : selected.type === "PREDICTED"
                    ? `Off-market, so there is no competing ask to beat. Lead the owner with ${fmtFull(cma.recommended)} — slightly above blended comp value, which is what makes a quiet test worth their time. Expect ~${cma.domAtRec} days once live.`
                    : `Positioned near fair value. Hold at ${fmtFull(cma.recommended)} and expect roughly ${cma.domAtRec} days to contract; revisit if it crosses ${HIGH_DOM} DOM without an offer.`}
              </div>
            </div>

            {cma.simulated && (
              <div className="font-mono" style={{
                fontFamily: MONO, fontSize: 8, lineHeight: 1.55, color: AMBER, background: `${AMBER}0f`,
                border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "8px 10px", marginBottom: 13,
              }}>
                ⚠ THIS ANALYSIS INCLUDES SIMULATED NODES. MODELED COMPARABLES ARE NOT MLS RECORDS AND MUST NOT BE PRESENTED TO A CLIENT AS VERIFIED SALES.
              </div>
            )}

            <button onClick={copyTearSheet}
              style={{
                width: "100%", background: sheetCopied ? `${GREEN}1e` : `#38bdf8`,
                border: `1px solid ${sheetCopied ? GREEN : CYAN}88`, borderRadius: 10, padding: "12px 14px",
                fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: sheetCopied ? GREEN : "#04222b", cursor: "pointer",
                boxShadow: "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {sheetCopied ? <Check size={13} /> : <Copy size={13} />}
              {sheetCopied ? "Tear-Sheet Copied" : "[ Copy CMA Tear-Sheet ]"}
            </button>
          </div>
        </div>
      )}

      {/* ── Outreach script modal ── */}
      {scriptOpen && selected && (
        <div onClick={() => setScriptOpen(false)}
          style={{ position: "absolute", inset: 0, zIndex: 70, background: "#111111", backdropFilter: "none", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()}
            className="backdrop-blur-2xl bg-black/60 border border-white/10"
            style={{
              width: "min(560px, 100%)", maxHeight: "82%", overflowY: "auto",
              background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
              border: `1px solid ${PURPLE}55`, borderRadius: 14, padding: 20,
              boxShadow: "none",
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
              background: "rgba(0,0,0,0.7)", border: "1px solid #27272a", borderRadius: 10,
              padding: 14, fontFamily: MONO, fontSize: 11, lineHeight: 1.65, color: SLATE,
              whiteSpace: "pre-wrap", wordBreak: "break-word", margin: "0 0 15px",
            }}>{buildOutreach(selected)}</pre>
            <button onClick={copyScript}
              style={{
                width: "100%", background: copied ? `${GREEN}1e` : `#8b5cf6`,
                border: `1px solid ${copied ? GREEN : PURPLE}88`, borderRadius: 10, padding: "12px 14px",
                fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                color: copied ? GREEN : "#fff", cursor: "pointer",
                boxShadow: "none",
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
