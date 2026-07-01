import posthog from "posthog-js";

import { useState, useEffect, useCallback, useRef } from "react";
import posthog from "posthog-js";

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — PostHog
// ─────────────────────────────────────────────────────────────────────────────
let _phInitialized = false;
function initAnalytics(){
  if(_phInitialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
  if(!key) return; // no key configured — analytics silently disabled
  posthog.init(key, { api_host: host, defaults: "2026-01-30", capture_pageview: true });
  _phInitialized = true;
}
function track(event, props={}){
  try{ if(_phInitialized) posthog.capture(event, props); }catch{}
}
function identifyUser(email, props={}){
  try{ if(_phInitialized) posthog.identify(email, props); }catch{}
}
function resetAnalytics(){
  try{ if(_phInitialized) posthog.reset(); }catch{}
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap";
export { initAnalytics, track, identifyUser, resetAnalytics };
