// api/google-data.js — Google integration + Autopilot sync (merged to stay under function limit)
// Google actions: fetch, disconnect
// Autopilot actions: save_run, load_latest, load_history, sync_data, load_data

import { createClient } from "@supabase/supabase-js";

function getSupabase(){
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth:{ autoRefreshToken:false, persistSession:false }, db:{ schema:"public" } }
  );
}

// ─── EMAIL NOTIFICATIONS (Resend HTTP API — no SDK needed) ───────────────────
// Fires when Autopilot detects a critical deal risk. Silently skipped if
// RESEND_API_KEY isn't set, so this never blocks or breaks a run save.
async function sendCriticalRiskEmail(toEmail, risk, agentName){
  const apiKey = process.env.RESEND_API_KEY;
  if(!apiKey || !toEmail) return;

  const firstName = agentName?.split(" ")[0] || "there";
  const subject = `⚠️ Autopilot: ${risk.deal} needs attention`;
  const html = `
    <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a12;color:#fff;border-radius:16px;">
      <div style="display:inline-block;background:rgba(244,63,94,.12);border:1px solid rgba(244,63,94,.3);color:#fb7185;font-size:11px;font-weight:700;letter-spacing:1.5px;padding:4px 12px;border-radius:20px;margin-bottom:16px;">
        CRITICAL DEAL RISK
      </div>
      <h1 style="font-size:20px;margin:0 0 12px;color:#fff;">Hi ${firstName}, Autopilot found something urgent</h1>
      <p style="font-size:15px;line-height:1.6;color:rgba(255,255,255,.7);margin:0 0 8px;">
        <strong style="color:#fff;">${risk.deal}</strong>
      </p>
      <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.6);margin:0 0 24px;">
        ${risk.risk}
      </p>
      ${risk.action ? `
      <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.2);border-radius:10px;padding:14px 16px;margin-bottom:24px;">
        <div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:1px;margin-bottom:6px;">RECOMMENDED ACTION</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.5;">${risk.action}</div>
      </div>` : ""}
      <a href="https://usesparkai.app" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;">
        Open Situation Room →
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,.3);margin-top:28px;">
        SPARK Autopilot is monitoring your pipeline 24/7. You're receiving this because a critical risk was detected on a Premium account.
      </p>
    </div>`;

  try{
    await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body: JSON.stringify({
        from: "SPARK Autopilot <autopilot@usesparkai.app>",
        to: toEmail,
        subject,
        html,
      }),
    });
  }catch(e){
    console.error("Email notify error:", e.message);
  }
}

// ─── GOOGLE HELPERS ───────────────────────────────────────────────────────────
async function refreshAccessToken(refreshToken, clientId, clientSecret){
  const res = await fetch("https://oauth2.googleapis.com/token",{
    method:"POST",
    headers:{"Content-Type":"application/x-www-form-urlencoded"},
    body:new URLSearchParams({
      refresh_token:refreshToken, client_id:clientId,
      client_secret:clientSecret, grant_type:"refresh_token",
    }),
  });
  const data = await res.json();
  if(!res.ok||!data.access_token) throw new Error("Token refresh failed");
  return data;
}

async function getValidToken(tokens, clientId, clientSecret){
  const isExpired = tokens.expires_at && Date.now() > tokens.expires_at - 60000;
  if(!isExpired) return { accessToken:tokens.access_token, newTokens:null };
  if(!tokens.refresh_token) throw new Error("No refresh token — reconnect Google");
  const refreshed = await refreshAccessToken(tokens.refresh_token, clientId, clientSecret);
  const newTokens = {
    ...tokens,
    access_token: refreshed.access_token,
    expires_at:   refreshed.expires_in ? Date.now() + refreshed.expires_in*1000 : null,
  };
  return { accessToken:refreshed.access_token, newTokens };
}

async function getGmailData(accessToken){
  try{
    const listRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/threads?maxResults=15&q=in:inbox",
      { headers:{ Authorization:`Bearer ${accessToken}` } }
    );
    const listData = await listRes.json();
    const threads  = listData.threads || [];
    const results  = [];
    for(const thread of threads.slice(0,10)){
      try{
        const threadRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/threads/${thread.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          { headers:{ Authorization:`Bearer ${accessToken}` } }
        );
        const threadData = await threadRes.json();
        const messages   = threadData.messages || [];
        const lastMsg    = messages[messages.length-1];
        if(!lastMsg) continue;
        const headers = lastMsg.payload?.headers || [];
        results.push({
          subject:  headers.find(h=>h.name==="Subject")?.value || "(no subject)",
          from:     headers.find(h=>h.name==="From")?.value || "",
          snippet:  (threadData.snippet||"").slice(0,200),
          msgCount: messages.length,
        });
      }catch{}
    }
    return results;
  }catch(err){ console.error("Gmail error:",err); return []; }
}

async function getCalendarData(accessToken){
  try{
    const now     = new Date().toISOString();
    const weekOut = new Date(Date.now()+7*864e5).toISOString();
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&timeMax=${weekOut}&singleEvents=true&orderBy=startTime&maxResults=20`,
      { headers:{ Authorization:`Bearer ${accessToken}` } }
    );
    const data   = await res.json();
    const events = data.items || [];
    return events.map(e=>{
      const start     = e.start?.dateTime || e.start?.date || "";
      const startFmt  = start ? new Date(start).toLocaleDateString("en-US",{
        weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
      }) : "";
      const daysUntil = start ? Math.round((new Date(start)-Date.now())/864e5) : null;
      return {
        title:       e.summary||"(untitled)",
        start:       startFmt,
        location:    e.location||"",
        description: (e.description||"").slice(0,150),
        attendees:   (e.attendees||[]).slice(0,5).map(a=>a.email),
        daysUntil,
        isToday:     daysUntil===0,
        isTomorrow:  daysUntil===1,
      };
    }).filter(e=>e.daysUntil!==null && e.daysUntil>=0);
  }catch(err){ console.error("Calendar error:",err); return []; }
}

// ─── AUTOPILOT HANDLERS ───────────────────────────────────────────────────────
async function handleAutopilot(action, email, body, res){
  const sb = getSupabase();

  if(action==="save_run"){
    const { result, clientCount, dealCount, overallHealth, memory, notifyEmail, agentName } = body;
    if(!result) return res.status(400).json({ error:"Result required" });

    const { error: runError } = await sb.from("autopilot_runs").insert({
      user_email:     email,
      result,
      client_count:   clientCount||0,
      deal_count:     dealCount||0,
      overall_health: overallHealth||"stable",
    });
    if(runError) console.error("Run save error:", runError.message);

    // Fire critical-risk email if the client flagged this as a new alert-worthy risk
    if(notifyEmail){
      const topRisk = result?.deal_intelligence?.risks?.find(r=>r.severity==="high");
      if(topRisk) await sendCriticalRiskEmail(email, topRisk, agentName);
    }

    if(memory){
      const { data: existing } = await sb
        .from("autopilot_memory")
        .select("coaching_history,run_count")
        .eq("user_email", email)
        .single();
      const prevHistory = existing?.coaching_history || [];
      const newEntry = {
        observation:    result?.coaching_insight?.observation||"",
        recommendation: result?.coaching_insight?.recommendation||"",
        date:           new Date().toISOString().slice(0,10),
      };
      await sb.from("autopilot_memory").upsert({
        user_email:       email,
        run_count:        (existing?.run_count||0)+1,
        patterns:         memory.patterns||"",
        last_health:      overallHealth||"stable",
        coaching_history: [newEntry,...prevHistory].slice(0,30),
        updated_at:       new Date().toISOString(),
      },{ onConflict:"user_email" });
    }
    return res.status(200).json({ saved:true });
  }

  if(action==="load_latest"){
    const { data:run } = await sb
      .from("autopilot_runs")
      .select("result,run_at,client_count,deal_count,overall_health")
      .eq("user_email", email)
      .order("run_at",{ ascending:false })
      .limit(1)
      .single();
    const { data:memory } = await sb
      .from("autopilot_memory")
      .select("run_count,patterns,last_health,coaching_history,updated_at")
      .eq("user_email", email)
      .single();
    return res.status(200).json({ latestRun:run||null, memory:memory||null });
  }

  if(action==="load_history"){
    const { data:runs } = await sb
      .from("autopilot_runs")
      .select("id,run_at,client_count,deal_count,overall_health")
      .eq("user_email", email)
      .order("run_at",{ ascending:false })
      .limit(20);
    return res.status(200).json({ runs:runs||[] });
  }

  if(action==="sync_data"){
    const { clients, pipeline, goals } = body;
    const { error } = await sb.from("agent_data_sync").upsert({
      user_email: email,
      clients:    clients||[],
      pipeline:   pipeline||[],
      goals:      goals||{},
      synced_at:  new Date().toISOString(),
    },{ onConflict:"user_email" });
    if(error){ console.error("Sync error:",error.message); return res.status(500).json({ error:error.message }); }
    return res.status(200).json({ synced:true });
  }

  if(action==="load_data"){
    const { data } = await sb
      .from("agent_data_sync")
      .select("clients,pipeline,goals,synced_at")
      .eq("user_email", email)
      .single();
    return res.status(200).json({ data:data||null });
  }

  if(action==="save_weekly_report"){
    const { weekStart, report } = body;
    if(!weekStart||!report) return res.status(400).json({ error:"weekStart and report required" });
    const { error } = await sb.from("autopilot_weekly_reports").upsert({
      user_email: email,
      week_start: weekStart,
      report,
    },{ onConflict:"user_email,week_start" });
    if(error){ console.error("Weekly report save error:",error.message); return res.status(500).json({ error:error.message }); }
    return res.status(200).json({ saved:true });
  }

  if(action==="load_weekly_reports"){
    const { data, error } = await sb
      .from("autopilot_weekly_reports")
      .select("week_start,report,created_at")
      .eq("user_email", email)
      .order("week_start",{ ascending:false })
      .limit(8);
    if(error) console.error("Weekly report load error:",error.message);
    return res.status(200).json({ reports:data||[] });
  }

  if(action==="save_conversation"){
    const { summary, keyDecisions, clientsDiscussed } = body;
    if(!summary) return res.status(400).json({ error:"Summary required" });
    const { error } = await sb.from("autopilot_conversations").insert({
      user_email:        email,
      summary,
      key_decisions:     keyDecisions||[],
      clients_discussed: clientsDiscussed||[],
    });
    if(error){ console.error("Conversation save error:",error.message); return res.status(500).json({ error:error.message }); }
    return res.status(200).json({ saved:true });
  }

  if(action==="load_conversations"){
    const { data, error } = await sb
      .from("autopilot_conversations")
      .select("summary,key_decisions,clients_discussed,created_at")
      .eq("user_email", email)
      .order("created_at",{ ascending:false })
      .limit(8);
    if(error) console.error("Conversation load error:",error.message);
    return res.status(200).json({ conversations:data||[] });
  }

  return res.status(400).json({ error:`Unknown autopilot action: ${action}` });
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
export default async function handler(req, res){
  if(req.method!=="POST") return res.status(405).json({ error:"Method not allowed" });

  const { email, action="fetch" } = req.body;
  if(!email) return res.status(400).json({ error:"Email required" });

  const userEmail = email.toLowerCase().trim();

  // Route autopilot actions
  const autopilotActions = [
    "save_run","load_latest","load_history","sync_data","load_data",
    "save_weekly_report","load_weekly_reports",
    "save_conversation","load_conversations",
  ];
  if(autopilotActions.includes(action)){
    try{ return await handleAutopilot(action, userEmail, req.body, res); }
    catch(err){ console.error("Autopilot error:",err.message); return res.status(500).json({ error:err.message }); }
  }

  // ── GOOGLE DISCONNECT ──
  if(action==="disconnect"){
    try{
      const sb = getSupabase();
      const { data } = await sb.from("users").select("google_tokens").eq("email",userEmail).single();
      if(data?.google_tokens?.access_token){
        fetch(`https://oauth2.googleapis.com/revoke?token=${data.google_tokens.access_token}`,{ method:"POST" }).catch(()=>{});
      }
      await sb.from("users").update({ google_tokens:null, google_email:null, google_connected_at:null }).eq("email",userEmail);
      return res.status(200).json({ disconnected:true });
    }catch(err){ return res.status(500).json({ error:err.message }); }
  }

  // ── GOOGLE FETCH ──
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if(!clientId||!clientSecret) return res.status(500).json({ error:"Google not configured" });

  try{
    const sb = getSupabase();
    const { data:userData, error:dbError } = await sb
      .from("users")
      .select("google_tokens,google_email")
      .eq("email",userEmail)
      .single();

    if(dbError||!userData?.google_tokens){
      return res.status(404).json({ error:"Google not connected", disconnected:true });
    }

    const { accessToken, newTokens } = await getValidToken(userData.google_tokens, clientId, clientSecret);
    if(newTokens){
      await sb.from("users").update({ google_tokens:newTokens }).eq("email",userEmail);
    }

    const [emails, events] = await Promise.all([
      getGmailData(accessToken),
      getCalendarData(accessToken),
    ]);

    return res.status(200).json({
      connected:   true,
      googleEmail: userData.google_email,
      emails, events,
      fetchedAt:   new Date().toISOString(),
    });
  }catch(err){
    console.error("google-data error:",err);
    return res.status(500).json({ error:err.message||"Failed to fetch Google data" });
  }
}
