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
    const { result, clientCount, dealCount, overallHealth, memory } = body;
    if(!result) return res.status(400).json({ error:"Result required" });

    const { error: runError } = await sb.from("autopilot_runs").insert({
      user_email:     email,
      result,
      client_count:   clientCount||0,
      deal_count:     dealCount||0,
      overall_health: overallHealth||"stable",
    });
    if(runError) console.error("Run save error:", runError.message);

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
  const autopilotActions = ["save_run","load_latest","load_history","sync_data","load_data"];
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
