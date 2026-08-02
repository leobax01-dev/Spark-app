// src/features/MigrationCenter.jsx — SPARK OS Migration Command Center.
//
// Replaces the legacy CSV upload box: a full-width glassmorphic migration
// bridge with a drop zone, connector rail, a live parsing readout, and a
// strict commit gate.
//
// What is real and what is not — read before adding a connector:
//
// - CSV/TSV ingest is real. Parsing, AI column mapping, dedupe against the
//   existing ledger, and the commit all work.
// - .xlsx is NOT parsed. It is a ZIP-based binary format and this app has no
//   spreadsheet library. The drop zone rejects it with a Save-As-CSV
//   instruction instead of accepting the file and failing downstream.
// - Google Contacts sync does NOT exist. api/google-auth.js requests
//   gmail.readonly + calendar.readonly + userinfo.email only — no People API
//   scope — so there is no contacts permission to read with. The button is
//   rendered and disabled with that exact reason.
// - Outlook 365 has NO integration whatsoever. Same treatment.
// - Follow Up Boss has no API integration either, but its CSV export column
//   names are already in FIELD_PATTERNS, so that button routes to the file
//   picker with FUB-specific guidance and is labelled "via CSV export" — it
//   is a real path, just not an OAuth one.
//
// A button that looks like a live sync but silently does nothing is worse
// than no button: the agent believes their sphere migrated and stops checking.
import { useCallback, useRef, useState } from "react";
import {
  X, UploadCloud, Loader2, CheckCircle2, AlertTriangle, Zap, Lock,
  FileSpreadsheet, Users, Mail, Database,
} from "lucide-react";
import { lsGet, lsSet, cloudSync } from "../utils/storage";
import { parseCSV, autoDetectMapping, aiMapHeaders, buildClients, MAPPABLE_FIELDS } from "./csvImport";

const CYAN = "#38bdf8";
const PURPLE = "#8b5cf6";
const PURPLE_LT = "#a78bfa";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const GREEN = "#10b981";
const SLATE = "rgba(226,232,240,0.9)";
const SLATE_DIM = "rgba(148,163,184,0.65)";
const HAIRLINE = "#27272a";
const F = "'Plus Jakarta Sans',sans-serif";
const MONO = "'JetBrains Mono','Courier New',monospace";

const CLIENTS_KEY = "spark_clients_v1";

// Each connector states its real status. `available:false` renders disabled
// with the reason on screen — never a button that pretends to sync.
const CONNECTORS = [
  {
    id: "google", label: "Sync Google Contacts", icon: Users, color: CYAN,
    available: false,
    reason: "Google is connected for Gmail and Calendar, but contact sync needs the People API scope, which this app doesn't request yet.",
  },
  {
    id: "outlook", label: "Sync Outlook 365", icon: Mail, color: "#38bdf8",
    available: false,
    reason: "No Microsoft integration exists yet — there is no Outlook OAuth in this build.",
  },
  {
    id: "fub", label: "Import from Follow Up Boss", icon: Database, color: PURPLE,
    available: true, viaCsv: true,
    reason: "No Follow Up Boss API yet — export People to CSV from FUB and drop it here. SPARK already recognises their column names.",
  },
];

const STEPS = [
  "READING FILE...",
  "NORMALIZING DATA SCHEMA...",
  "MATCHING FIELDS...",
  "DEDUPLICATING AGAINST LEDGER...",
];

export default function MigrationCenter({ user, onClose, onImported }) {
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | parsing | review | committing | done
  const [step, setStep] = useState(-1);
  const [log, setLog] = useState([]);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [mapperUsed, setMapperUsed] = useState("");
  const [committed, setCommitted] = useState(0);
  const [hint, setHint] = useState("");
  const fileRef = useRef(null);

  const push = (line) => setLog((l) => [...l, line]);

  const run = useCallback(async (file) => {
    if (!file) return;
    const name = (file.name || "").toLowerCase();
    if (/\.(xlsx|xls)$/.test(name)) {
      setErr("Excel workbooks aren't parsed yet — this app has no spreadsheet library. In Excel or Numbers use File → Save As → CSV, then drop that.");
      setPhase("idle");
      return;
    }
    if (!/\.(csv|tsv|txt)$/.test(name) && !file.type.includes("csv") && !file.type.includes("text")) {
      setErr(`"${file.name}" isn't a CSV. Export your contacts as CSV and drop that file.`);
      setPhase("idle");
      return;
    }

    setPhase("parsing"); setErr(""); setLog([]); setStep(0); setResult(null);
    try {
      // 1 — read
      const text = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error("Could not read that file."));
        r.readAsText(file);
      });
      push(`${file.name} · ${(file.size / 1024).toFixed(1)} KB`);

      // 2 — normalize
      setStep(1);
      const parsed = parseCSV(text);
      if (!parsed.headers.length) throw new Error("That file has no header row SPARK could read.");
      if (!parsed.rows.length) throw new Error("That file has headers but no data rows.");
      push(`${parsed.headers.length} columns · ${parsed.rows.length} rows`);

      // 3 — map. Pattern matcher first (instant, offline), then ask the model
      // to place anything left over. Which one ran is reported, not implied.
      setStep(2);
      let mapping = autoDetectMapping(parsed.headers);
      let used = "pattern matcher";
      const missing = MAPPABLE_FIELDS.filter((f) => !mapping[f]);
      if (missing.length) {
        try {
          const ai = await aiMapHeaders(parsed.headers, parsed.rows);
          const added = Object.entries(ai.mapping).filter(([k]) => !mapping[k]);
          if (added.length) {
            mapping = { ...mapping, ...Object.fromEntries(added) };
            used = "AI + pattern matcher";
            push(`AI placed ${added.length} extra column${added.length !== 1 ? "s" : ""}`);
          }
          if (ai.notes) push(ai.notes);
        } catch (e) {
          // Offline or no API — the pattern matcher already produced a usable
          // mapping, so this is a downgrade, not a failure. Say so.
          push(e.message === "no-api"
            ? "AI mapping unavailable here — used the offline pattern matcher"
            : `AI mapping skipped (${String(e.message).slice(0, 60)})`);
        }
      }
      setMapperUsed(used);
      const mapped = Object.keys(mapping).length;
      push(`${mapped} field${mapped !== 1 ? "s" : ""} mapped: ${Object.keys(mapping).join(", ") || "none"}`);
      if (!mapping.name && !mapping.firstName && !mapping.email && !mapping.phone) {
        throw new Error("No name, email or phone column could be identified — SPARK won't import rows it can't identify a person from.");
      }

      // 4 — dedupe
      setStep(3);
      const existing = lsGet(CLIENTS_KEY, []) || [];
      const clients = buildClients(parsed, mapping, existing);
      const dupes = clients.filter((c) => c.duplicate).length;
      push(`${clients.length} importable · ${dupes} already in your ledger`);

      setStep(4);
      setResult({ clients, mapping, headers: parsed.headers, totalRows: parsed.rows.length, dupes, fileName: file.name });
      setPhase("review");
    } catch (e) {
      setErr(e.message || "Migration failed.");
      setPhase("idle");
      setStep(-1);
    }
  }, []);

  const commit = useCallback(async () => {
    if (!result) return;
    setPhase("committing");
    try {
      const existing = lsGet(CLIENTS_KEY, []) || [];
      const now = new Date().toISOString();
      // Duplicates are skipped, not merged — merging two records without
      // showing the agent what got overwritten is not reversible.
      const fresh = result.clients.filter((c) => !c.duplicate).map((c, i) => ({
        id: `${Date.now()}-${i}`,
        name: c.name, phone: c.phone, email: c.email, type: c.type, stage: c.stage,
        property: c.property, budget: c.budget, timeline: c.timeline,
        motivation: "", notes: c.notes, nextAction: "", aiAction: "",
        lastContact: "", createdAt: now,
        activities: [], tags: [], tasks: [], source: "migration",
      }));
      const next = [...existing, ...fresh];
      lsSet(CLIENTS_KEY, next);
      const synced = user?.email ? await cloudSync(user.email, { clients: next }) : false;
      setCommitted(fresh.length);
      setHint(synced ? "" : "Saved on this device — cloud sync did not confirm.");
      setPhase("done");
      onImported?.();
    } catch (e) {
      setErr(`Commit failed — ${e.message || "unknown error"}. Nothing was saved.`);
      setPhase("review");
    }
  }, [result, user, onImported]);

  const importable = result ? result.clients.filter((c) => !c.duplicate) : [];

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.82)",
      backdropFilter: "none", WebkitBackdropFilter: "none",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <style>{MC_KEYFRAMES}</style>
      <div onClick={(e) => e.stopPropagation()} className="backdrop-blur-2xl bg-black/60 border border-white/10" style={{
        width: "min(880px, 100%)", maxHeight: "90%", overflowY: "auto",
        background: "#111111", backdropFilter: "none", WebkitBackdropFilter: "none",
        border: `1px solid ${PURPLE}44`, borderRadius: 16, padding: 24, boxShadow: "none",
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
          <UploadCloud size={17} color={PURPLE_LT} />
          <span style={{ fontFamily: F, fontSize: 15, fontWeight: 800, letterSpacing: 1.2, color: "#fff" }}>
            MIGRATION COMMAND CENTER
          </span>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "transparent", border: "none", color: SLATE_DIM, cursor: "pointer", padding: 0 }}><X size={17} /></button>
        </div>
        <div className="tracking-wider text-slate-400" style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: 1.8, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 18,
        }}>Bring your existing sphere across · nothing is written without a commit</div>

        {/* ── done ── */}
        {phase === "done" ? (
          <div style={{ textAlign: "center", padding: "26px 10px" }}>
            <CheckCircle2 size={38} color={GREEN} style={{ marginBottom: 12 }} />
            <div style={{ fontFamily: F, fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
              {committed} client{committed !== 1 ? "s" : ""} migrated to your sphere ledger.
            </div>
            <div className="font-mono" style={{ fontFamily: MONO, fontSize: 9.5, color: SLATE_DIM, lineHeight: 1.7 }}>
              {result?.dupes ? `${result.dupes} DUPLICATE${result.dupes !== 1 ? "S" : ""} SKIPPED — ALREADY IN YOUR LEDGER.` : "NO DUPLICATES FOUND."}
              {hint && <><br />{hint.toUpperCase()}</>}
            </div>
            <button onClick={onClose} style={{
              marginTop: 20, padding: "12px 26px", borderRadius: 10, cursor: "pointer",
              background: `${CYAN}1c`, border: `1px solid ${CYAN}88`, color: CYAN,
              fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
            }}>[ Return to Sphere ]</button>
          </div>
        ) : phase === "review" && result ? (
          /* ── review / commit gate ── */
          <>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
              {[
                ["Rows read", result.totalRows, SLATE],
                ["Importable", importable.length, GREEN],
                ["Duplicates skipped", result.dupes, AMBER],
              ].map(([l, v, c]) => (
                <div key={l} style={{ flex: "1 1 150px", border: `1px solid ${HAIRLINE}`, borderRadius: 10, padding: 12, background: "#18181b" }}>
                  <div className="tracking-wider" style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase", marginBottom: 4 }}>{l}</div>
                  <div className="font-mono" style={{ fontFamily: MONO, fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                </div>
              ))}
            </div>

            <div className="font-mono" style={{
              fontFamily: MONO, fontSize: 8.5, color: SLATE_DIM, marginBottom: 12, lineHeight: 1.6,
            }}>
              MAPPED BY {mapperUsed.toUpperCase()} · {Object.entries(result.mapping).map(([k, v]) => `${k}←${v}`).join("  ·  ")}
            </div>

            {result.dupes > 0 && (
              <div className="font-mono" style={{
                fontFamily: MONO, fontSize: 8.5, lineHeight: 1.6, color: AMBER, marginBottom: 12,
                background: `${AMBER}0d`, border: `1px solid ${AMBER}44`, borderRadius: 8, padding: "9px 11px",
              }}>
                ⚠ {result.dupes} ROW{result.dupes !== 1 ? "S" : ""} {result.dupes !== 1 ? "MATCH" : "MATCHES"} AN EXISTING EMAIL
                OR PHONE. {result.dupes !== 1 ? "THEY" : "IT"} WILL BE SKIPPED, NOT MERGED — SPARK WILL NOT OVERWRITE A RECORD
                YOU ALREADY HAVE WITHOUT SHOWING YOU WHAT CHANGES.
              </div>
            )}

            <div style={{ border: `1px solid ${HAIRLINE}`, borderRadius: 11, overflow: "hidden", marginBottom: 16 }}>
              <div style={{ overflowX: "auto", maxHeight: 260, overflowY: "auto" }}>
                <table style={{ width: "100%", minWidth: 640, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#18181b", position: "sticky", top: 0 }}>
                      {["Row", "Name", "Email", "Phone", "Type", "Stage"].map((h) => (
                        <th key={h} className="tracking-wider" style={{
                          textAlign: "left", padding: "9px 12px", fontFamily: MONO, fontSize: 7.5,
                          fontWeight: 800, letterSpacing: 1.2, color: SLATE_DIM, textTransform: "uppercase",
                          borderBottom: `1px solid ${HAIRLINE}`, whiteSpace: "nowrap",
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.clients.slice(0, 60).map((c, i) => (
                      <tr key={i} style={{ borderBottom: "1px solid #18181b", opacity: c.duplicate ? 0.4 : 1 }}>
                        <td className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 9, color: SLATE_DIM }}>{c._row}</td>
                        <td style={{ padding: "8px 12px", fontFamily: F, fontSize: 11, color: "#fff", whiteSpace: "nowrap" }}>
                          {c.name}
                          {c.duplicate && <span className="font-mono" style={{ marginLeft: 6, fontSize: 6.5, color: AMBER, border: `1px solid ${AMBER}55`, borderRadius: 3, padding: "1px 4px" }}>DUPE</span>}
                        </td>
                        <td className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 9.5, color: SLATE, whiteSpace: "nowrap" }}>{c.email || "—"}</td>
                        <td className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 9.5, color: SLATE, whiteSpace: "nowrap" }}>{c.phone || "—"}</td>
                        <td className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 9, color: CYAN }}>{c.type}</td>
                        <td className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 9, color: PURPLE_LT }}>{c.stage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {result.clients.length > 60 && (
                <div className="font-mono" style={{ padding: "8px 12px", fontFamily: MONO, fontSize: 8, color: SLATE_DIM, borderTop: `1px solid ${HAIRLINE}` }}>
                  SHOWING FIRST 60 OF {result.clients.length} — ALL WILL BE COMMITTED.
                </div>
              )}
            </div>

            {err && (
              <div className="font-mono" style={{
                fontFamily: MONO, fontSize: 9, lineHeight: 1.6, color: RED, marginBottom: 12,
                background: `${RED}0d`, border: `1px solid ${RED}44`, borderRadius: 8, padding: "9px 11px",
              }}>{err}</div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setPhase("idle"); setResult(null); setLog([]); setStep(-1); }}
                style={{
                  flex: "1 1 160px", padding: "15px 16px", borderRadius: 11, cursor: "pointer",
                  background: "transparent", border: `1px solid ${HAIRLINE}`, color: SLATE,
                  fontFamily: F, fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase",
                }}>[ Abort Migration ]</button>
              <button onClick={commit} disabled={importable.length === 0}
                style={{
                  flex: "2 1 260px", padding: "15px 16px", borderRadius: 11,
                  cursor: importable.length ? "pointer" : "default",
                  background: importable.length ? `#8b5cf6` : "rgba(255,255,255,0.05)",
                  border: `1px solid ${importable.length ? PURPLE : HAIRLINE}`,
                  color: importable.length ? "#fff" : SLATE_DIM,
                  fontFamily: F, fontSize: 12.5, fontWeight: 800, letterSpacing: 1.1, textTransform: "uppercase",
                  boxShadow: "none",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <Zap size={14} /> [ Commit {importable.length} to Sphere Ledger ]
              </button>
            </div>
          </>
        ) : (
          /* ── idle / parsing ── */
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); if (phase !== "parsing") setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (phase !== "parsing") run(e.dataTransfer.files?.[0]); }}
              onClick={() => phase !== "parsing" && fileRef.current?.click()}
              style={{
                border: `1.5px dashed ${drag ? PURPLE : phase === "parsing" ? PURPLE : HAIRLINE}`,
                borderRadius: 14, padding: "38px 20px", textAlign: "center",
                cursor: phase === "parsing" ? "default" : "pointer",
                background: drag ? `${PURPLE}12` : "#18181b",
                transition: "border-color .18s ease, background .18s ease",
                animation: phase === "idle" ? "mcBreathe 2.6s ease-in-out infinite" : "none",
                position: "relative", overflow: "hidden", marginBottom: 16,
              }}>
              <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden
                onChange={(e) => run(e.target.files?.[0])} />

              {phase === "parsing" && (
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, overflow: "hidden" }}>
                  <div style={{ width: "40%", height: "100%", background: `linear-gradient(90deg,transparent,${PURPLE_LT},transparent)`, animation: "mcSweep 1.1s linear infinite" }} />
                </div>
              )}

              {phase === "parsing"
                ? <Loader2 size={30} color={PURPLE_LT} style={{ animation: "mcSpin 1s linear infinite" }} />
                : <UploadCloud size={30} color={drag ? PURPLE_LT : SLATE_DIM} />}

              <div style={{ fontFamily: F, fontSize: 13.5, fontWeight: 700, color: "#fff", marginTop: 12, lineHeight: 1.5, maxWidth: 460, marginLeft: "auto", marginRight: "auto" }}>
                {phase === "parsing"
                  ? "Reading your export…"
                  : "Drop any messy CSV export. SPARK will map your columns and clean the data."}
              </div>
              <div className="font-mono" style={{ fontFamily: MONO, fontSize: 8, color: SLATE_DIM, marginTop: 7, letterSpacing: 0.8, lineHeight: 1.7 }}>
                CSV · TSV — ANY COLUMN ORDER, ANY CRM
                <br />
                <span style={{ color: AMBER }}>EXCEL? SAVE AS → CSV FIRST — .XLSX ISN&apos;T PARSED YET.</span>
              </div>
            </div>

            {/* live readout */}
            {phase === "parsing" && (
              <div style={{ border: `1px solid ${PURPLE}33`, borderRadius: 11, padding: 14, marginBottom: 16, background: "#111111" }}>
                {STEPS.map((s, i) => (
                  <div key={s} className="font-mono" style={{
                    display: "flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 10,
                    color: i < step ? GREEN : i === step ? PURPLE_LT : "rgba(148,163,184,0.3)",
                    padding: "3px 0",
                    animation: i === step ? "mcBlink 1.1s ease-in-out infinite" : "none",
                  }}>
                    {i < step ? <CheckCircle2 size={10} /> : i === step ? <Loader2 size={10} style={{ animation: "mcSpin 1s linear infinite" }} /> : <span style={{ width: 10 }} />}
                    {s}
                  </div>
                ))}
                {log.length > 0 && (
                  <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px solid ${HAIRLINE}` }}>
                    {log.map((l, i) => (
                      <div key={i} className="font-mono" style={{ fontFamily: MONO, fontSize: 9, color: SLATE_DIM, lineHeight: 1.7 }}>
                        <span style={{ color: CYAN }}>›</span> {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {err && phase !== "parsing" && (
              <div className="font-mono" style={{
                fontFamily: MONO, fontSize: 9.5, lineHeight: 1.7, color: AMBER, marginBottom: 16,
                background: `${AMBER}0d`, border: `1px solid ${AMBER}44`, borderRadius: 9, padding: "11px 13px",
              }}>{err}</div>
            )}

            {/* connector rail */}
            <div className="tracking-wider text-slate-400" style={{
              fontFamily: MONO, fontSize: 7.5, fontWeight: 800, letterSpacing: 1.8, color: SLATE_DIM,
              textTransform: "uppercase", marginBottom: 9,
            }}>Direct connectors</div>

            <div style={{ display: "grid", gap: 9, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {CONNECTORS.map((c) => {
                const I = c.icon;
                return (
                  <div key={c.id}>
                    <button
                      onClick={() => { if (c.viaCsv) { setErr(""); setHint(""); fileRef.current?.click(); } }}
                      disabled={!c.available}
                      title={c.reason}
                      style={{
                        width: "100%", padding: "12px 14px", borderRadius: 10,
                        cursor: c.available ? "pointer" : "not-allowed",
                        background: c.available ? `${c.color}16` : "#18181b",
                        border: `1px solid ${c.available ? `${c.color}66` : HAIRLINE}`,
                        color: c.available ? c.color : SLATE_DIM,
                        fontFamily: F, fontSize: 10, fontWeight: 800, letterSpacing: 0.9, textTransform: "uppercase",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                        opacity: c.available ? 1 : 0.55,
                      }}>
                      {c.available ? <I size={12} /> : <Lock size={11} />}
                      [ {c.label} ]
                    </button>
                    <div className="font-mono" style={{
                      fontFamily: MONO, fontSize: 7.5, lineHeight: 1.6, marginTop: 5,
                      color: c.available ? SLATE_DIM : "rgba(255,176,32,0.75)",
                    }}>
                      {c.available ? "VIA CSV EXPORT · " : "NOT CONNECTED · "}{c.reason}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const MC_KEYFRAMES = `
@keyframes mcSpin{to{transform:rotate(360deg)}}
@keyframes mcBlink{0%,100%{opacity:1}50%{opacity:.45}}
@keyframes mcSweep{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
@keyframes mcBreathe{0%,100%{border-color:#27272a;box-shadow:0 0 0 rgba(168,85,247,0)}50%{border-color:rgba(168,85,247,0.45);box-shadow:0 0 26px rgba(168,85,247,0.14)}}
`;
