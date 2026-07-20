// src/utils/compliance.js
// SPARK Compliance Guardrails — fair housing risk screening for AI-generated
// content. Two layers:
//   1. Instant pattern scan (client-side, free, zero latency) — catches
//      well-established risky phrases immediately.
//   2. AI-powered deeper review (Claude) — catches nuance and coded
//      language the pattern list can't, and drafts compliant rewrites.
//
// IMPORTANT — what this is and isn't:
// This tool reduces risk and catches common problems before content goes
// out. It is NOT a legal compliance guarantee, and it does not replace an
// agent's own judgment or a broker/attorney review for anything ambiguous.
// Fair housing law includes federal protected classes plus additional
// state/local protections that vary by market — this tool is grounded in
// widely-published federal guidance (HUD, NAR) but coverage is not
// exhaustive. Always keep this framing in any UI copy that surfaces this
// feature — never claim or imply "guaranteed compliant."

// ─────────────────────────────────────────────────────────────────────────
// LAYER 1 — PATTERN LIST
// Each entry: a regex, the protected-class category it relates to, why
// it's commonly flagged, and the direction a safer rewrite should take.
// Grounded in widely-published Fair Housing Act guidance and standard
// NAR/HUD advertising-compliance training material.
// ─────────────────────────────────────────────────────────────────────────
export const RISKY_PATTERNS = [
  // Familial status
  { regex:/\bno\s+(kids|children)\b/i, category:"Familial Status", severity:"high",
    reason:"Directly excludes families with children, a federally protected class.",
    guidance:"Describe the property itself, not who should or shouldn't live there." },
  { regex:/\badults?[\s-]only\b/i, category:"Familial Status", severity:"high",
    reason:"Excludes families with children unless the property legitimately qualifies as HOPA senior housing (55+/62+) — if it does, say so explicitly and accurately instead of 'adults only'.",
    guidance:"If this is a qualified senior community, state the specific age restriction and legal basis. Otherwise remove entirely." },
  { regex:/\b(perfect|ideal|great)\s+for\s+(a\s+)?(growing\s+)?famil(y|ies)\b/i, category:"Familial Status", severity:"medium",
    reason:"Signals a preference for households with children, which can be read as steering.",
    guidance:"Describe features (bedrooms, yard, school proximity as a neutral fact) rather than who the home is 'for'." },
  { regex:/\bempty[\s-]nesters?\b/i, category:"Familial Status", severity:"medium",
    reason:"Signals a preference based on family/age composition.",
    guidance:"Focus on the property's layout or low-maintenance features instead." },
  { regex:/\bbachelor(?:'s)?\s+pad\b/i, category:"Familial/Marital Status", severity:"low",
    reason:"Implies a preference for single, unmarried occupants.",
    guidance:"Describe the space itself — e.g. 'open-concept layout' — instead." },
  { regex:/\bsingles?\s+(only|preferred)\b/i, category:"Marital/Familial Status", severity:"high",
    reason:"Explicitly excludes based on marital or familial status.",
    guidance:"Remove — occupancy preferences based on marital/familial status are not permitted." },

  // Religion
  { regex:/\b(walking\s+distance\s+to|near|close\s+to)\s+(the\s+)?(church|synagogue|mosque|temple)\b/i, category:"Religion", severity:"medium",
    reason:"Referencing a specific religious institution can signal a religious preference, even unintentionally.",
    guidance:"Reference proximity to amenities generically (e.g. 'places of worship nearby') or omit." },
  { regex:/\bchristian\s+(community|neighborhood|family)\b/i, category:"Religion", severity:"high",
    reason:"Signals a religious preference for occupants.",
    guidance:"Remove entirely — religious affiliation of a community cannot be marketed as a selling point." },

  // Disability
  { regex:/\b(not\s+)?(wheelchair|handicap)[\s-]?(accessible|friendly)\b/i, category:"Disability", severity:"medium",
    reason:"Framing accessibility as a limitation ('not wheelchair accessible') can read as exclusionary. Factual accessibility features are fine to list; the property being unsuitable for someone is not.",
    guidance:"State factual features only (e.g. 'second-floor unit, no elevator') without characterizing who it is or isn't suitable for." },
  { regex:/\bmust\s+be\s+able\s+to\s+(climb|walk|carry)\b/i, category:"Disability", severity:"high",
    reason:"Frames a physical ability as a requirement to live there, which can constitute disability discrimination.",
    guidance:"State the physical fact (e.g. 'third-floor walk-up, no elevator') without framing it as a requirement of the occupant." },
  { regex:/\bable[\s-]bodied\s+(only|preferred)\b/i, category:"Disability", severity:"high",
    reason:"Directly excludes based on disability status.",
    guidance:"Remove entirely." },
  { regex:/\bno\s+(wheelchairs?|walkers?)\b/i, category:"Disability", severity:"high",
    reason:"Directly excludes based on the use of a mobility aid.",
    guidance:"Remove entirely — describe physical layout facts only, never who can or can't use the space." },

  // National origin / race (coded language)
  { regex:/\bexclusive\s+neighborhood\b/i, category:"Race/National Origin (coded)", severity:"low",
    reason:"Can function as coded exclusionary language depending on context, even when meant as a marketing term.",
    guidance:"Use concrete, neutral descriptors like 'gated community' or 'low-density neighborhood' instead." },
  { regex:/\bsafe\s+(neighborhood|area|community)\b/i, category:"Race/National Origin (coded)", severity:"medium",
    reason:"Widely flagged in fair housing training as coded language that can imply a racial or ethnic preference about who lives nearby.",
    guidance:"Cite a neutral, factual data point instead if relevant (e.g. crime statistics from a public source), or omit." },
  { regex:/\bno\s+section\s*8\b/i, category:"Source of Income", severity:"high",
    reason:"Refusing housing-voucher holders is a protected-class violation in a growing number of states and localities, and is broadly discouraged even where not yet locally protected.",
    guidance:"Remove entirely — check your local source-of-income protection rules before including any voucher-related language." },

  // General exclusionary framing
  { regex:/\b(ideal|perfect)\s+for\s+(a\s+)?single\s+professional\b/i, category:"Familial/Marital Status", severity:"medium",
    reason:"Signals a preference for a specific household composition.",
    guidance:"Describe the unit's size or layout instead of who it's 'for'." },
];

/**
 * Instant, zero-latency pattern scan. Returns an array of flags found.
 * @param {string} text
 */
export function scanForRiskyLanguage(text){
  if(!text) return [];
  const flags = [];
  for(const pattern of RISKY_PATTERNS){
    const match = text.match(pattern.regex);
    if(match){
      flags.push({
        phrase: match[0],
        category: pattern.category,
        severity: pattern.severity,
        reason: pattern.reason,
        guidance: pattern.guidance,
        source: "pattern",
      });
    }
  }
  return flags;
}

/**
 * Extracts all meaningful text content from a generated-content result
 * object, regardless of its exact field names (SPARK's content types each
 * have different schemas — this is deliberately schema-agnostic so it
 * doesn't need updating every time a new content type is added).
 * @param {object} result
 */
export function extractTextForReview(result){
  if(!result || typeof result !== "object") return "";
  const EXCLUDE_FIELDS = new Set(["higgsfield_prompt","higgsfield_prompts","script_title"]);
  const parts = [];
  for(const [key, val] of Object.entries(result)){
    if(EXCLUDE_FIELDS.has(key)) continue;
    if(typeof val === "string" && val.trim().length > 10){
      parts.push(val.trim());
    } else if(Array.isArray(val)){
      val.forEach(v=>{ if(typeof v === "string" && v.trim().length > 10) parts.push(v.trim()); });
    }
  }
  return parts.join("\n\n");
}

// ─────────────────────────────────────────────────────────────────────────
// LAYER 2 — AI-POWERED REVIEW
// Uses the existing /api/claude endpoint — no new backend function needed.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Runs a deeper AI compliance review, aware of what the pattern scan
 * already found so it can focus on nuance (coded language, implied
 * steering) rather than re-finding the same obvious matches.
 * @param {string} text
 * @param {string} contentType - e.g. "MLS Description", "Chat message"
 * @param {Array} patternFlags - output of scanForRiskyLanguage
 */
export async function reviewWithAI(text, contentType, patternFlags=[]){
  if(!text || text.trim().length < 10){
    return { overall_risk:"clear", flags:[], summary:"No content to review." };
  }

  const patternSummary = patternFlags.length
    ? `A fast pattern scan already caught these phrases: ${patternFlags.map(f=>`"${f.phrase}" (${f.category})`).join(", ")}. Confirm these and look for anything else — implied steering, coded language, or exclusionary framing that a keyword scan would miss.`
    : "A fast pattern scan found no obvious matches. Look specifically for subtler issues — implied steering, coded language, or exclusionary framing.";

  try{
    const r = await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system:"You are a Fair Housing Act compliance reviewer for real estate marketing and client communication. You review text for language that could violate federal fair housing protections (race, color, religion, sex, disability, familial status, national origin) or common state/local protections (source of income, sexual orientation, gender identity, marital status, age). Be precise — flag genuine risk, not overly cautious about normal descriptive language ('spacious', 'renovated', 'quiet street' are fine). Return ONLY valid compact JSON.",
        messages:[{role:"user",content:`Review this ${contentType||"real estate content"} for fair housing compliance risk:\n\n"""${text}"""\n\n${patternSummary}\n\nReturn ONLY this JSON:
{"overall_risk":"clear | caution | high_risk","summary":"1-2 sentence honest overall assessment","flags":[{"phrase":"the exact risky phrase or sentence from the text","category":"which protected class or issue this relates to","reason":"why this is a compliance concern, 1 sentence","suggested_rewrite":"a specific compliant replacement that preserves the marketing intent"}]}`}],
        max_tokens:1200,
      })
    });
    const d = await r.json();
    const raw = d.content?.[0]?.text||"";
    for(const attempt of [
      ()=>JSON.parse(raw.trim()),
      ()=>{ const f=raw.indexOf("{"),l=raw.lastIndexOf("}"); if(f!==-1&&l>f) return JSON.parse(raw.slice(f,l+1)); throw new Error("no"); },
    ]){
      try{ return attempt(); }catch{}
    }
    throw new Error("parse_failed");
  }catch(e){
    console.warn("AI compliance review failed:", e.message);
    // Fail safe — if the AI layer is unavailable, fall back to pattern-only
    // results rather than blocking the agent or hiding known issues.
    return {
      overall_risk: patternFlags.length ? "caution" : "clear",
      summary: patternFlags.length
        ? "AI review unavailable — showing pattern-scan results only."
        : "AI review unavailable and no risky patterns detected.",
      flags: patternFlags.map(f=>({ phrase:f.phrase, category:f.category, reason:f.reason, suggested_rewrite:f.guidance })),
    };
  }
}

/**
 * Full orchestrated check — run this from the UI. Combines the instant
 * pattern scan with the AI review and returns one unified result.
 * @param {string} text
 * @param {string} contentType
 */
export async function runComplianceCheck(text, contentType){
  const patternFlags = scanForRiskyLanguage(text);
  const aiResult = await reviewWithAI(text, contentType, patternFlags);
  return {
    ...aiResult,
    checkedAt: new Date().toISOString(),
    patternFlagCount: patternFlags.length,
  };
}

export const RISK_LABELS = {
  clear:     { label:"Looks Clear",     color:"emerald" },
  caution:   { label:"Review Suggested", color:"amber" },
  high_risk: { label:"High Risk",        color:"rose" },
};
