// api/market/surveillance.js — RentCast data engine for the Broker Map.
//
// Framework note: the spec offered "Next.js API route structure" as an
// alternative. This repo has no Next.js anywhere (confirmed again for this
// task) — it's Vite + Vercel serverless functions (`api/*.js`, the
// `(req, res)` signature), the same convention as api/comps.js, which this
// file matches exactly (same RENTCAST_API_KEY env var, same `X-Api-Key`
// header, same base URL).
//
// GET /api/market/surveillance?zipCode=33139
// GET /api/market/surveillance?cityState=Miami,FL
//
// Response is always 200 with a valid (possibly empty) GeoJSON
// FeatureCollection, even on upstream failure — { success: true|false,
// geojson, aggregateStats }. The frontend map should never need a
// try/catch around parsing this; it should just render whatever geojson
// comes back (empty if RentCast rate-limited, errored, or the key isn't
// configured) and can check `success`/`error` for a banner if it wants one.
const EMPTY_GEOJSON = { type: "FeatureCollection", features: [] };
const EMPTY_STATS = { avgDom: null, medianPrice: null, activeCount: 0 };

function emptyResponse(res, status, error) {
  return res.status(status).json({ success: false, error, geojson: EMPTY_GEOJSON, aggregateStats: EMPTY_STATS });
}

const compactUsd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactPrice(price) {
  if (price == null || Number.isNaN(Number(price))) return null;
  return compactUsd.format(Number(price));
}

// RentCast's active-listing payloads aren't perfectly uniform across
// markets/plans — this reads a few plausible field names defensively
// rather than assuming one exact shape, and never throws on a missing field.
function getDaysOnMarket(listing) {
  if (typeof listing.daysOnMarket === "number") return listing.daysOnMarket;
  const listedDate = listing.listedDate || listing.listDate;
  if (!listedDate) return null;
  const days = Math.round((Date.now() - new Date(listedDate).getTime()) / (1000 * 60 * 60 * 24));
  return Number.isFinite(days) && days >= 0 ? days : null;
}

// Looks for any history/priceHistory entries showing a price drop from the
// listing's original/earliest recorded price to its current one.
function hasRecentPriceCut(listing) {
  const currentPrice = Number(listing.price ?? listing.listPrice);
  const historyEntries = Array.isArray(listing.priceHistory)
    ? listing.priceHistory
    : listing.history && typeof listing.history === "object"
      ? Object.values(listing.history)
      : [];

  if (!currentPrice || historyEntries.length === 0) return false;

  const priorPrices = historyEntries
    .map((h) => Number(h?.price ?? h?.listPrice))
    .filter((p) => Number.isFinite(p) && p > 0);

  if (priorPrices.length === 0) return false;
  const earliestKnownPrice = Math.max(...priorPrices); // highest prior price = the original ask, before any cuts
  return earliestKnownPrice > currentPrice;
}

function categorize(dom, priceCut) {
  if (priceCut) return "price_cut";
  if (dom != null && dom < 7) return "fresh";
  if (dom != null && dom > 60) return "stale";
  return "standard";
}

function listingToFeature(listing) {
  const lat = listing.latitude ?? listing.coordinates?.latitude;
  const lng = listing.longitude ?? listing.coordinates?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null; // un-mappable without coordinates

  const price = Number(listing.price ?? listing.listPrice) || null;
  const dom = getDaysOnMarket(listing);
  const priceCut = hasRecentPriceCut(listing);

  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: [lng, lat] },
    properties: {
      id: listing.id ?? listing.formattedAddress ?? `${lat},${lng}`,
      address: listing.formattedAddress ?? listing.addressLine1 ?? null,
      price,
      formattedPrice: formatCompactPrice(price),
      daysOnMarket: dom,
      bedrooms: listing.bedrooms ?? null,
      bathrooms: listing.bathrooms ?? null,
      squareFootage: listing.squareFootage ?? null,
      propertyType: listing.propertyType ?? null,
      listedDate: listing.listedDate ?? listing.listDate ?? null,
      priceHistory: listing.priceHistory ?? listing.history ?? null,
      category: categorize(dom, priceCut),
    },
  };
}

function median(numbers) {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function computeAggregateStats(features) {
  const doms = features.map((f) => f.properties.daysOnMarket).filter((d) => typeof d === "number");
  const prices = features.map((f) => f.properties.price).filter((p) => typeof p === "number");
  return {
    avgDom: doms.length ? Math.round(doms.reduce((s, d) => s + d, 0) / doms.length) : null,
    medianPrice: median(prices),
    activeCount: features.length,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) return emptyResponse(res, 500, "RentCast API key not configured");

  const { zipCode, cityState } = req.query || {};
  if (!zipCode && !cityState) return emptyResponse(res, 400, "zipCode or cityState query parameter required");

  const url = new URL("https://api.rentcast.io/v1/listings/active");
  if (zipCode) {
    url.searchParams.set("zipCode", String(zipCode));
  } else {
    const [city, state] = String(cityState).split(",").map((s) => s.trim());
    if (city) url.searchParams.set("city", city);
    if (state) url.searchParams.set("state", state);
  }
  url.searchParams.set("status", "Active");
  url.searchParams.set("limit", "500");

  try {
    const rentcastRes = await fetch(url.toString(), {
      headers: { "X-Api-Key": apiKey, accept: "application/json" },
    });

    if (!rentcastRes.ok) {
      // Rate limits (429) and plan/quota errors are expected operating
      // conditions for a third-party data vendor, not exceptional bugs —
      // the map should just show "no data right now," never crash.
      const bodyText = await rentcastRes.text().catch(() => "");
      return emptyResponse(res, 200, `RentCast request failed (${rentcastRes.status}): ${bodyText.slice(0, 200)}`);
    }

    const raw = await rentcastRes.json();
    const listings = Array.isArray(raw) ? raw : raw.listings || raw.properties || [];

    const features = listings.map(listingToFeature).filter(Boolean);
    const geojson = { type: "FeatureCollection", features };
    const aggregateStats = computeAggregateStats(features);

    return res.status(200).json({ success: true, geojson, aggregateStats });
  } catch (err) {
    console.error("Market surveillance API error:", err);
    return emptyResponse(res, 200, "Internal error fetching listings — showing no data for this area.");
  }
}
