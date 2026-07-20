// src/utils/storage.js
// CANONICAL storage helpers — the single source of truth for localStorage
// access and Supabase cloud sync across every feature file.
//
// WHY THIS FILE EXISTS:
// Multiple feature files used to each define their own `lsGet`/`lsSet`
// with identical names. Vite bundles every feature file into one output
// file, and same-named module-level functions across files have caused
// two separate production crashes (undefined-function errors from bundle
// ordering conflicts). Importing from one shared module makes that class
// of bug structurally impossible — there is now only one definition.
//
// USAGE:
//   import { lsGet, lsSet, cloudLoad, cloudSync } from "../utils/storage";
//
// If a file needs a locally-scoped alias (e.g. AutopilotPanel uses
// apLsGet/apLsSet), import with a rename instead of redefining:
//   import { lsGet as apLsGet, lsSet as apLsSet } from "../utils/storage";

/**
 * Read a JSON value from localStorage. Never throws.
 * @param {string} key
 * @param {*} fallback - returned if the key is missing or unparsable
 */
export function lsGet(key, fallback){
  try{
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  }catch(e){
    return fallback;
  }
}

/**
 * Write a JSON value to localStorage. Never throws.
 * @param {string} key
 * @param {*} val
 */
export function lsSet(key, val){
  try{
    localStorage.setItem(key, JSON.stringify(val));
  }catch(e){
    // Storage full or unavailable (private browsing, etc) — fail silently.
    // The app should always keep working even if persistence doesn't.
  }
}

/**
 * Remove a key from localStorage. Never throws.
 * @param {string} key
 */
export function lsRemove(key){
  try{
    localStorage.removeItem(key);
  }catch(e){}
}

// ─────────────────────────────────────────────────────────────────────────
// CLOUD SYNC — Supabase (agent_data_sync table) is source of truth for
// durable business data (clients, pipeline, goals). localStorage is a
// fast local cache, not the primary store. This talks to /api/google-data,
// which is the merged endpoint that also handles Autopilot + Google OAuth
// (kept in one file to stay under the Vercel Hobby 12-function limit).
// ─────────────────────────────────────────────────────────────────────────

/**
 * Load an agent's synced business data (clients/pipeline/goals) from
 * Supabase. Returns null on any failure — callers should treat that as
 * "no cloud data yet, use whatever is cached locally."
 * @param {string} email
 */
export async function cloudLoad(email){
  if(!email) return null;
  try{
    const r = await fetch("/api/google-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "load_data" }),
    });
    const d = await r.json();
    return d?.data || null;
  }catch(e){
    console.warn("Cloud load failed:", e.message);
    return null;
  }
}

/**
 * Push a partial update (any of clients/pipeline/goals) to Supabase.
 * Returns true/false for success — callers use this to drive a sync
 * status indicator, never to block the UI.
 * @param {string} email
 * @param {{clients?:any[], pipeline?:any[], goals?:object}} patch
 */
export async function cloudSync(email, patch){
  if(!email) return false;
  try{
    const r = await fetch("/api/google-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, action: "sync_data", ...patch }),
    });
    const d = await r.json();
    return !!d?.synced;
  }catch(e){
    console.warn("Cloud sync failed:", e.message);
    return false;
  }
}

/**
 * Debounce helper — used so cloud syncs fire ~900ms after the last edit
 * rather than on every keystroke. Returns a cancel function.
 * @param {Function} fn
 * @param {number} ms
 */
export function debounce(fn, ms){
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
}
