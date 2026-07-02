// api/google-callback.js — Handles OAuth callback from Google
// Writes to public.users (not auth.users)

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  const appUrl      = "https://usesparkai.app";
  const redirectUri = "https://usesparkai.app/api/google-callback";
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (error) {
    return res.redirect(302, `${appUrl}?google_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return res.redirect(302, `${appUrl}?google_error=missing_params`);
  }

  // Decode state to get SPARK user email
  let userEmail = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userEmail = (decoded.email || "").toLowerCase().trim();
  } catch {
    return res.redirect(302, `${appUrl}?google_error=invalid_state`);
  }

  if (!clientId || !clientSecret) {
    return res.redirect(302, `${appUrl}?google_error=not_configured`);
  }
  if (!userEmail) {
    return res.redirect(302, `${appUrl}?google_error=no_user_email`);
  }

  try {
    // Exchange auth code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     clientId,
        client_secret: clientSecret,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) {
      console.error("Token exchange failed:", JSON.stringify(tokens));
      return res.redirect(302, `${appUrl}?google_error=token_exchange_failed`);
    }

    // Get Google account email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo    = await userInfoRes.json();
    const googleEmail = userInfo.email || "";

    // Write to public.users — never auth.users
    const supabaseUrl = process.env.SUPABASE_URL
      || process.env.VITE_SUPABASE_URL
      || "";
    const serviceKey  = process.env.SUPABASE_SERVICE_KEY || "";

    if (!supabaseUrl || !serviceKey) {
      console.error("Missing Supabase env vars. Available:", Object.keys(process.env).filter(k=>k.includes("SUPA")||k.includes("supabase")).join(", "));
      return res.redirect(302, `${appUrl}?google_error=db_not_configured`);
    }

    const sb = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      db:   { schema: "public" },
    });

    const tokenData = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      scope:         tokens.scope || "",
    };

    // Explicitly target public.users by email
    const { error: dbError } = await sb
      .from("users")
      .update({
        google_tokens:       tokenData,
        google_email:        googleEmail,
        google_connected_at: new Date().toISOString(),
      })
      .eq("email", userEmail);

    if (dbError) {
      console.error("public.users update failed:", dbError.message, dbError.details, dbError.hint);
      // Still mark connected locally — tokens usable from localStorage
      return res.redirect(302,
        `${appUrl}?google_connected=true&google_email=${encodeURIComponent(googleEmail)}&db_error=1`
      );
    }

    res.redirect(302,
      `${appUrl}?google_connected=true&google_email=${encodeURIComponent(googleEmail)}&screen=login`
    );

  } catch (err) {
    console.error("Google callback error:", err.message);
    res.redirect(302, `${appUrl}?google_error=${encodeURIComponent(err.message)}`);
  }
}
