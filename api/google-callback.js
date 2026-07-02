// api/google-callback.js — Handles OAuth callback from Google
// Exchanges auth code for tokens, stores in Supabase, redirects back to app

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { code, state, error } = req.query;

  const appUrl      = "https://usesparkai.app";
  const redirectUri = "https://usesparkai.app/api/google-callback";
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (error) {
    console.error("Google OAuth error:", error);
    return res.redirect(302, `${appUrl}?google_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.redirect(302, `${appUrl}?google_error=missing_params`);
  }

  // Decode state to get SPARK user email
  let userEmail = "";
  try {
    const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
    userEmail = decoded.email || "";
  } catch {
    return res.redirect(302, `${appUrl}?google_error=invalid_state`);
  }

  if (!clientId || !clientSecret) {
    return res.redirect(302, `${appUrl}?google_error=not_configured`);
  }

  try {
    // Exchange code for tokens
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
      console.error("Token exchange failed:", tokens);
      return res.redirect(302, `${appUrl}?google_error=token_exchange_failed`);
    }

    // Get Google account email
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo    = await userInfoRes.json();
    const googleEmail = userInfo.email || "";

    // Store tokens in Supabase
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const tokenData = {
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      expires_at:    tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null,
      scope:         tokens.scope || "",
    };

    const { error: dbError } = await sb
      .from("users")
      .update({
        google_tokens:       tokenData,
        google_email:        googleEmail,
        google_connected_at: new Date().toISOString(),
      })
      .eq("email", userEmail.toLowerCase());

    if (dbError) {
      console.error("Supabase update failed:", dbError);
      return res.redirect(302, `${appUrl}?google_error=db_update_failed`);
    }

    res.redirect(302, `${appUrl}?google_connected=true&google_email=${encodeURIComponent(googleEmail)}`);

  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect(302, `${appUrl}?google_error=${encodeURIComponent(err.message)}`);
  }
}
