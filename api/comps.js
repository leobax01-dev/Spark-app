// api/comps.js — RentCast comparable sales proxy
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { address } = req.body;
  if (!address) return res.status(400).json({ error: "Address required" });
  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "RentCast API key not configured" });

  try {
    // Step 1 — property lookup to get coordinates and details
    const propRes = await fetch(
      `https://api.rentcast.io/v1/properties?address=${encodeURIComponent(address)}&limit=1`,
      { headers: { "X-Api-Key": apiKey, "accept": "application/json" } }
    );
    if (!propRes.ok) return res.status(propRes.status).json({ error: `Property lookup failed: ${propRes.status}` });
    const propData = await propRes.json();
    const property = Array.isArray(propData) ? propData[0] : propData;
    if (!property?.latitude) return res.status(404).json({ error: "Property not found — try a more specific address" });

    const { latitude, longitude, bedrooms } = property;

    // Step 2 — fetch comps, try 0.5mi first, widen to 1.5mi if needed
    async function fetchComps(radius, daysOld) {
      const url = new URL("https://api.rentcast.io/v1/sales/comparables");
      url.searchParams.set("latitude", latitude);
      url.searchParams.set("longitude", longitude);
      url.searchParams.set("radius", radius);
      url.searchParams.set("limit", "6");
      url.searchParams.set("daysOld", daysOld);
      if (bedrooms) url.searchParams.set("bedrooms", bedrooms);
      const r = await fetch(url.toString(), { headers: { "X-Api-Key": apiKey, "accept": "application/json" } });
      if (!r.ok) return [];
      const d = await r.json();
      return Array.isArray(d) ? d : (d.comparables || d.properties || []);
    }

    let comps = await fetchComps("0.5", "180");
    if (comps.length < 2) comps = await fetchComps("1.0", "365");
    if (comps.length < 2) comps = await fetchComps("1.5", "365");
    if (comps.length === 0) return res.status(404).json({ error: "No comparable sales found in this area" });

    const formatted = comps.slice(0, 4).map(c => {
      const daysAgo = c.lastSaleDate
        ? Math.round((Date.now() - new Date(c.lastSaleDate)) / (1000*60*60*24))
        : null;
      const price = c.lastSalePrice ? `$${c.lastSalePrice.toLocaleString()}` : "N/A";
      const details = [
        c.bedrooms && `${c.bedrooms}bd`,
        c.bathrooms && `${c.bathrooms}ba`,
        c.squareFootage && `${c.squareFootage.toLocaleString()}sqft`,
        daysAgo && `sold ${daysAgo} days ago`,
      ].filter(Boolean).join(", ");
      return {
        address: (c.formattedAddress||c.addressLine1||"").split(",").slice(0,2).join(",").trim(),
        price,
        priceRaw: c.lastSalePrice || 0,
        details,
        beds: c.bedrooms,
        baths: c.bathrooms,
        sqft: c.squareFootage,
        daysAgo,
      };
    });

    const valid = formatted.filter(c => c.priceRaw && c.sqft);
    const avgPpsf = valid.length
      ? Math.round(valid.reduce((s,c) => s + c.priceRaw/c.sqft, 0) / valid.length)
      : null;

    return res.status(200).json({
      comps: formatted,
      subject: {
        beds: property.bedrooms,
        baths: property.bathrooms,
        sqft: property.squareFootage,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
      },
      avgPricePerSqft: avgPpsf ? `$${avgPpsf}/sqft` : null,
      count: formatted.length,
    });

  } catch (err) {
    console.error("Comps API error:", err);
    return res.status(500).json({ error: "Internal error fetching comps" });
  }
}
