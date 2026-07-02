// api/google-disconnect.js — Removes Google tokens from Supabase

import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  try {
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    await sb.from("users")
      .update({
        google_tokens:       null,
        google_email:        null,
        google_connected_at: null,
      })
      .eq("email", email.toLowerCase());

    // Optionally revoke Google token
    const { data } = await sb.from("users").select("google_tokens").eq("email", email.toLowerCase()).single();
    if (data?.google_tokens?.access_token) {
      fetch(`https://oauth2.googleapis.com/revoke?token=${data.google_tokens.access_token}`, { method: "POST" }).catch(() => {});
    }

    res.status(200).json({ disconnected: true });
  } catch (err) {
    console.error("google-disconnect error:", err);
    res.status(500).json({ error: err.message });
  }
}
