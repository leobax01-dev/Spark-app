// api/google-auth.js — Initiates Google OAuth flow
// Redirects agent to Google consent screen

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const clientId    = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://usesparkai.app"}/api/google-callback`;

  if (!clientId) return res.status(500).json({ error: "Google client ID not configured" });

  const scopes = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ].join(" ");

  // Pass user email in state so callback knows which user to update
  const state = Buffer.from(JSON.stringify({
    email: req.query.email || "",
    ts:    Date.now(),
  })).toString("base64url");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         scopes,
    access_type:   "offline",
    prompt:        "consent",
    state,
  });

  res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
