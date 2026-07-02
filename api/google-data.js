// api/google-data.js — Reads Gmail threads and Calendar events for SPARK context
// Called by SPARK Assistant to inject real email/calendar data into conversations

import { createClient } from "@supabase/supabase-js";

// Refresh access token using refresh token
async function refreshAccessToken(refreshToken, clientId, clientSecret) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) throw new Error("Token refresh failed");
  return data;
}

// Get valid access token — refresh if expired
async function getValidToken(tokens, clientId, clientSecret) {
  const isExpired = tokens.expires_at && Date.now() > tokens.expires_at - 60000;
  if (!isExpired) return { accessToken: tokens.access_token, newTokens: null };

  if (!tokens.refresh_token) throw new Error("No refresh token — user must reconnect Google");
  const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
  const newTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at:   refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : null,
  };
  return { accessToken: refreshed.access_token, newTokens };
}

// Fetch recent Gmail threads (last 10, real estate relevant)
async function getGmailData(accessToken) {
  try {
    // Get list of recent threads
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=15&q=in:inbox",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const threads  = listData.threads || [];

    const results = [];
    for (const thread of threads.slice(0, 10)) {
      try {
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const threadData = await threadRes.json();
        const messages   = threadData.messages || [];
        const lastMsg    = messages[messages.length - 1];
        if (!lastMsg) continue;

        const headers  = lastMsg.payload?.headers || [];
        const subject  = headers.find(h => h.name === "Subject")?.value || "(no subject)";
        const from     = headers.find(h => h.name === "From")?.value || "";
        const date     = headers.find(h => h.name === "Date")?.value || "";
        const snippet  = threadData.snippet || "";
        const msgCount = messages.length;

        results.push({ subject, from, date, snippet: snippet.slice(0, 200), msgCount });
      } catch { /* skip individual thread errors */ }
    }
    return results;
  } catch (err) {
    console.error("Gmail fetch error:", err);
    return [];
  }
}

// Fetch upcoming calendar events (next 7 days)
async function getCalendarData(accessToken) {
  try {
    const now      = new Date().toISOString();
    const weekOut  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${weekOut}&singleEvents=true&orderBy=startTime&maxResults=20`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data   = await res.json();
    const events = data.items || [];

    return events.map(e => {
      const start    = e.start?.dateTime || e.start?.date || "";
      const end      = e.end?.dateTime || e.end?.date || "";
      const startFmt = start ? new Date(start).toLocaleDateString("en-US", {
        weekday:"short", month:"short", day:"numeric",
        hour:"numeric", minute:"2-digit",
      }) : "";
      const daysUntil = start
        ? Math.round((new Date(start) - Date.now()) / (864e5))
        : null;

      return {
        title:       e.summary || "(untitled)",
        start:       startFmt,
        location:    e.location || "",
        description: (e.description || "").slice(0, 150),
        attendees:   (e.attendees || []).slice(0, 5).map(a => a.email),
        daysUntil,
        isToday:     daysUntil === 0,
        isTomorrow:  daysUntil === 1,
      };
    }).filter(e => e.daysUntil !== null && e.daysUntil >= 0);
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return res.status(500).json({ error: "Google not configured" });

  try {
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get stored tokens from Supabase
    const { data: userData, error: dbError } = await sb
      .from("users")
      .select("google_tokens, google_email")
      .eq("email", email.toLowerCase())
      .single();

    if (dbError || !userData?.google_tokens) {
      return res.status(404).json({ error: "Google not connected", disconnected: true });
    }

    const tokens = userData.google_tokens;

    // Get valid (possibly refreshed) token
    const { accessToken, newTokens } = await getValidToken(tokens, clientId, clientSecret);

    // If token was refreshed, update in Supabase
    if (newTokens) {
      await sb.from("users").update({ google_tokens: newTokens }).eq("email", email.toLowerCase());
    }

    // Fetch data in parallel
    const [emails, events] = await Promise.all([
      getGmailData(accessToken),
      getCalendarData(accessToken),
    ]);

    res.status(200).json({
      connected:   true,
      googleEmail: userData.google_email,
      emails,
      events,
      fetchedAt:   new Date().toISOString(),
    });

  } catch (err) {
    console.error("google-data error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch Google data" });
  }
}
