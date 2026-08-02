// src/features/csvImport.js — CSV ingest for the Migration Command Center.
//
// Extracted from ClientPanel's legacy importer so the Migration Center and the
// old flow share one parser rather than drifting apart.
//
// Hand-rolled RFC-4180-ish parser: quoted fields, escaped quotes, CRLF. Kept
// dependency-free on purpose — a CSV parser is not worth a new npm package
// here, and this one already handles the exports agents actually bring.

export function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else field += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && next === "\n") i++;
        row.push(field); field = "";
        if (row.length > 1 || row[0] !== "") rows.push(row);
        row = [];
      } else field += ch;
    }
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  return {
    headers: rows[0].map((h) => h.trim()),
    rows: rows.slice(1).filter((r) => r.some((c) => c.trim() !== "")),
  };
}

// Fuzzy header matching — different CRMs name columns differently
// (Follow Up Boss: "First Name"/"Last Name", kvCORE: "Name", Google Contacts
// export: "Given Name").
export const FIELD_PATTERNS = {
  name: [/^full ?name$/i, /^name$/i, /^client ?name$/i, /^contact ?name$/i],
  firstName: [/^first ?name$/i, /^given ?name$/i, /^fname$/i],
  lastName: [/^last ?name$/i, /^family ?name$/i, /^surname$/i, /^lname$/i],
  email: [/^e-?mail/i, /^primary ?e-?mail/i, /^email ?1$/i],
  phone: [/^phone/i, /^mobile/i, /^cell/i, /^phone ?1$/i, /^primary ?phone/i],
  type: [/^type$/i, /^lead ?type$/i, /^client ?type$/i, /^role$/i],
  stage: [/^stage$/i, /^status$/i, /^lead ?status$/i, /^pipeline ?stage$/i],
  property: [/^property/i, /^address/i, /^listing/i],
  notes: [/^notes?$/i, /^description$/i, /^comments?$/i, /^remarks?$/i],
  budget: [/^budget$/i, /^price ?range$/i, /^value$/i],
  timeline: [/^timeline$/i, /^timeframe$/i],
};

export const MAPPABLE_FIELDS = Object.keys(FIELD_PATTERNS);

export function autoDetectMapping(headers) {
  const mapping = {};
  for (const [field, patterns] of Object.entries(FIELD_PATTERNS)) {
    const match = headers.find((h) => patterns.some((p) => p.test(h.trim())));
    if (match) mapping[field] = match;
  }
  return mapping;
}

// Asks Claude to map the columns the pattern matcher could not place. Returns
// null when unavailable so the caller can report which mapper actually ran —
// claiming "AI mapped your columns" when a regex did would be a lie about how
// the data got where it is.
export async function aiMapHeaders(headers, sampleRows) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: "You map spreadsheet columns from a real estate CRM export onto a fixed schema. Only map a column when you are confident. Return ONLY valid JSON.",
      messages: [{
        role: "user",
        content: `Columns: ${JSON.stringify(headers)}\nFirst rows: ${JSON.stringify(sampleRows.slice(0, 3))}\n\n` +
          `Map onto these fields, using the EXACT column name as the value, or null when no column fits: ${JSON.stringify(MAPPABLE_FIELDS)}\n\n` +
          `Return ONLY: {"mapping":{"name":"Column Name or null", ...},"notes":"one short sentence about anything odd you found"}`,
      }],
      max_tokens: 700,
    }),
  });
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) throw new Error("no-api");
  const d = await res.json();
  if (!res.ok || d?.error) throw new Error(d?.error?.message || `HTTP ${res.status}`);
  const raw = d.content?.[0]?.text || "";
  const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
  const parsed = JSON.parse(a !== -1 && b > a ? raw.slice(a, b + 1) : raw);
  const clean = {};
  Object.entries(parsed.mapping || {}).forEach(([k, v]) => {
    if (v && headers.includes(v) && MAPPABLE_FIELDS.includes(k)) clean[k] = v;
  });
  return { mapping: clean, notes: parsed.notes || "" };
}

export function normalizeStage(raw) {
  const v = (raw || "").toLowerCase().trim();
  if (!v) return "prospect";
  if (/closed|sold|won/.test(v)) return "closed";
  if (/contract|pending|escrow/.test(v)) return "contract";
  if (/active|client|working|hot|warm/.test(v)) return "active";
  return "prospect";
}

export function normalizeType(raw) {
  const v = (raw || "").toLowerCase().trim();
  if (/sell/.test(v)) return "seller";
  return "buyer";
}

// Turns parsed rows + a mapping into client records, flagging duplicates
// against what is already in the ledger rather than silently merging them.
export function buildClients({ headers, rows }, mapping, existing = []) {
  const seen = new Set(
    existing.flatMap((c) => [c.email?.toLowerCase(), c.phone?.replace(/\D/g, "")].filter(Boolean)),
  );
  const out = [];
  rows.forEach((row, i) => {
    const get = (field) => {
      const header = mapping[field];
      if (!header) return "";
      const idx = headers.indexOf(header);
      return idx >= 0 ? (row[idx] || "").trim() : "";
    };
    let name = get("name");
    if (!name) name = [get("firstName"), get("lastName")].filter(Boolean).join(" ");
    const email = get("email");
    const phone = get("phone");
    if (!name && !email && !phone) return; // nothing identifying — not a person

    const key = email?.toLowerCase() || phone?.replace(/\D/g, "");
    const duplicate = !!key && seen.has(key);
    if (key) seen.add(key);

    out.push({
      _row: i + 2, // +2: 1-indexed, plus the header row
      duplicate,
      name: name || email || phone,
      email, phone,
      type: normalizeType(get("type")),
      stage: normalizeStage(get("stage")),
      property: get("property"),
      budget: get("budget"),
      timeline: get("timeline"),
      notes: get("notes"),
    });
  });
  return out;
}
