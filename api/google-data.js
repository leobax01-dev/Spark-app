// api/google-data.js — Google integration + Autopilot sync (merged to stay under function limit)
// Google actions: fetch, disconnect
// Autopilot actions: save_run, load_latest, load_history, sync_data, load_data

import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

// VAPID keys authenticate SPARK's server as the sender for push
// notifications — one key pair for the whole app, not per-agent.
// VAPID_PRIVATE_KEY must stay a secret env var; the public key is safe
// to expose client-side (it's also set as VITE_VAPID_PUBLIC_KEY there).
if(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY){
  webpush.setVapidDetails(
    "mailto:support@usesparkai.app",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

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

// Fires the moment a lead submits SPARK's public lead-capture page, so the
// agent finds out immediately instead of having to check the app.
async function sendNewLeadEmail(toEmail, lead){
  const apiKey = process.env.RESEND_API_KEY;
  if(!apiKey || !toEmail) return;

  const subject = `🎯 New lead: ${lead.name}`;
  const html = `
    <div style="font-family:-apple-system,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0a12;color:#fff;border-radius:16px;">
      <div style="display:inline-block;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);color:#34d399;font-size:11px;font-weight:700;letter-spacing:1.5px;padding:4px 12px;border-radius:20px;margin-bottom:16px;">
        NEW LEAD
      </div>
      <h1 style="font-size:20px;margin:0 0 12px;color:#fff;">${lead.name} just reached out</h1>
      <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.7);margin:0 0 6px;">
        ${lead.type==="seller"?"Interested in selling":"Interested in buying"}
      </p>
      ${lead.phone?`<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.7);margin:0 0 6px;">📞 ${lead.phone}</p>`:""}
      ${lead.email?`<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.7);margin:0 0 6px;">✉️ ${lead.email}</p>`:""}
      ${lead.motivation?`
      <div style="background:rgba(99,102,241,.08);border:1px solid rgba(99,102,241,.2);border-radius:10px;padding:14px 16px;margin:16px 0;">
        <div style="font-size:10px;color:#a78bfa;font-weight:700;letter-spacing:1px;margin-bottom:6px;">THEIR MESSAGE</div>
        <div style="font-size:13px;color:rgba(255,255,255,.8);line-height:1.5;">${lead.motivation}</div>
      </div>` : ""}
      <a href="https://usesparkai.app" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:12px 28px;border-radius:10px;margin-top:8px;">
        View in SPARK →
      </a>
      <p style="font-size:11px;color:rgba(255,255,255,.3);margin-top:28px;">
        This lead has already been added to your pipeline as a prospect. Fastest agents win — reach out within the hour if you can.
      </p>
    </div>`;

  try{
    await fetch("https://api.resend.com/emails",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body: JSON.stringify({
        from: "SPARK Leads <leads@usesparkai.app>",
        to: toEmail,
        subject,
        html,
      }),
    });
  }catch(e){
    console.error("Lead email notify error:", e.message);
  }
}

// ─── SMS (Twilio REST API — no SDK needed) ────────────────────────────────
// Agents live in text messages far more than email or an app they have to
// remember to open — this is the trigger channel that closes the loop on
// "runs your business while you sell." Requires a real Twilio account:
// TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars.
// Silently no-ops if unconfigured or the agent hasn't opted in — never
// blocks or breaks whatever called it, same pattern as the email helpers.

const TCPA_WINDOW_START = 8;  // 8am
const TCPA_WINDOW_END   = 21; // 9pm — federal TCPA baseline for automated texts
const DEFAULT_SMS_TIMEZONE = "America/New_York"; // used only if no timezone is known for the recipient

// Checked against the RECIPIENT's local time, not the server's. A team
// member wouldn't text you at 3am, and neither should an automated one —
// this applies to every SMS this app ever sends, not just messages to
// clients, on purpose: the trust the "your team" story depends on breaks
// the first time an agent gets an off-hours text, even from their own
// account notifications.
function isTcpaSafeHour(timezone){
  try{
    const formatter = new Intl.DateTimeFormat("en-US", { timeZone: timezone||DEFAULT_SMS_TIMEZONE, hour:"numeric", hour12:false });
    const hour = parseInt(formatter.format(new Date()), 10) % 24;
    return hour >= TCPA_WINDOW_START && hour < TCPA_WINDOW_END;
  }catch(e){
    // Unrecognized timezone string — fail safe by treating it as unsafe
    // rather than risking an off-hours send on a bad value.
    console.warn("isTcpaSafeHour: invalid timezone, treating as unsafe:", timezone, e.message);
    return false;
  }
}

async function sendSMS(toPhone, message, recipientTimezone){
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if(!sid || !token || !fromNumber || !toPhone) return false;

  if(!isTcpaSafeHour(recipientTimezone)){
    console.log(`SMS held — outside TCPA-safe window (8am-9pm) for timezone ${recipientTimezone||DEFAULT_SMS_TIMEZONE}. Not sent.`);
    return false;
  }

  try{
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const body = new URLSearchParams({ To: toPhone, From: fromNumber, Body: message.slice(0,1500) });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,{
      method:"POST",
      headers:{
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if(!r.ok){
      const errText = await r.text().catch(()=>"");
      console.error("SMS send failed:", r.status, errText.slice(0,200));
      return false;
    }
    return true;
  }catch(e){
    console.error("SMS send error:", e.message);
    return false;
  }
}

// ─── PUSH NOTIFICATIONS (Web Push API via the web-push package) ──────────
// The free trigger channel — no per-message cost unlike SMS, and it works
// even with the app fully closed on the agent's phone. Fires for the same
// moments SMS does. Requires VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env vars
// (see top of file) and the agent to have subscribed via the PWA install +
// notification-permission flow client-side. Silently no-ops if VAPID isn't
// configured or the agent has no stored subscription — same pattern as
// every other notification helper in this file.
async function sendPushNotification(subscription, payload, sb, email){
  if(!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !subscription) return false;

  try{
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return true;
  }catch(e){
    // 404/410 means the browser has permanently unsubscribed (uninstalled,
    // cleared data, etc) — clean up the dead subscription so we stop
    // trying to push to it, rather than silently failing forever.
    if((e.statusCode===404 || e.statusCode===410) && sb && email){
      try{
        const { data: existing } = await sb.from("agent_data_sync").select("profile").eq("user_email", email).single();
        if(existing?.profile){
          const cleaned = { ...existing.profile, pushSubscription: null };
          await sb.from("agent_data_sync").update({ profile: cleaned }).eq("user_email", email);
        }
      }catch{}
    } else {
      console.error("Push send error:", e.message);
    }
    return false;
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
    const { result, clientCount, dealCount, overallHealth, memory, notifyEmail, agentName, phone, smsEnabled, timezone, pushSubscription } = body;
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
      if(topRisk){
        await sendCriticalRiskEmail(email, topRisk, agentName);
        if(smsEnabled && phone){
          await sendSMS(phone, `SPARK: ${topRisk.deal} needs you — ${(topRisk.risk||"").slice(0,100)} Open: usesparkai.app`, timezone);
        }
        if(pushSubscription && isTcpaSafeHour(timezone)){
          await sendPushNotification(pushSubscription, {
            title: "Your team needs you", body: `${topRisk.deal} — ${(topRisk.risk||"").slice(0,120)}`, url: "/", tag: "spark-risk",
          }, sb, email);
        }
      }
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
    const { clients, pipeline, goals, profile } = body;
    const patch = { user_email: email, synced_at: new Date().toISOString() };
    if(clients  !== undefined) patch.clients  = clients;
    if(pipeline !== undefined) patch.pipeline = pipeline;
    if(goals    !== undefined) patch.goals    = goals;
    if(profile  !== undefined) patch.profile  = profile;
    const { error } = await sb.from("agent_data_sync").upsert(patch,{ onConflict:"user_email" });
    if(error){ console.error("Sync error:",error.message); return res.status(500).json({ error:error.message }); }
    return res.status(200).json({ synced:true });
  }

  if(action==="load_data"){
    const { data } = await sb
      .from("agent_data_sync")
      .select("clients,pipeline,goals,profile,synced_at")
      .eq("user_email", email)
      .single();
    return res.status(200).json({ data:data||null });
  }

  // ─── PUBLIC LEAD CAPTURE — no auth required, deliberately narrow ─────────
  // get_public_profile ONLY ever returns the small public-facing subset of
  // an agent's profile — never clients, pipeline, goals, plan, or any
  // other private business data, even though it reads the same row.
  if(action==="get_public_profile"){
    const { data } = await sb
      .from("agent_data_sync")
      .select("profile")
      .eq("user_email", email)
      .single();
    const p = data?.profile || {};
    return res.status(200).json({
      profile: {
        name:      p.name || null,
        brokerage: p.brokerage || null,
        market:    p.market || null,
        specialty: p.specialty || null,
        cta:       p.cta || null,
      },
    });
  }

  if(action==="capture_lead"){
    const { name, phone, leadEmail, message, interest, honeypot } = body;
    // Basic bot filter — honeypot field must stay empty for real submissions
    if(honeypot) return res.status(200).json({ captured:true });
    if(!name || (!phone && !leadEmail)){
      return res.status(400).json({ error:"Name and at least one contact method required" });
    }

    const { data: existing } = await sb
      .from("agent_data_sync")
      .select("clients,profile")
      .eq("user_email", email)
      .single();

    const newClient = {
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      name: String(name).slice(0,100),
      phone: phone ? String(phone).slice(0,30) : "",
      email: leadEmail ? String(leadEmail).slice(0,120) : "",
      type: interest==="selling" ? "seller" : "buyer",
      stage: "prospect",
      property: "",
      budget: "",
      timeline: "",
      motivation: message ? String(message).slice(0,500) : "",
      notes: `Submitted via SPARK lead capture page${message?`: ${String(message).slice(0,300)}`:""}`,
      lastContact: new Date().toISOString(),
      nextAction: "New lead — reach out within 24 hours",
      aiAction: "",
      createdAt: new Date().toISOString(),
      source: "spark_lead_capture",
    };

    const updatedClients = [...(existing?.clients||[]), newClient];
    const { error } = await sb.from("agent_data_sync").upsert({
      user_email: email,
      clients: updatedClients,
      synced_at: new Date().toISOString(),
    },{ onConflict:"user_email" });
    if(error){ console.error("Lead capture error:", error.message); return res.status(500).json({ error:error.message }); }

    // Notify the agent immediately — reuses the existing Resend integration
    sendNewLeadEmail(email, newClient).catch(()=>{});
    if(existing?.profile?.smsEnabled && existing?.profile?.phone){
      sendSMS(existing.profile.phone, `SPARK: New lead — ${newClient.name}${newClient.phone?` (${newClient.phone})`:""}. They're already in your pipeline. usesparkai.app`, existing.profile.timezone).catch(()=>{});
    }
    if(existing?.profile?.pushSubscription && isTcpaSafeHour(existing.profile.timezone)){
      sendPushNotification(existing.profile.pushSubscription, {
        title: "New lead", body: `${newClient.name} just reached out — already in your pipeline`, url: "/", tag: "spark-lead",
      }, sb, email).catch(()=>{});
    }

    return res.status(200).json({ captured:true });
  }

  // Fired by the nightly cron job right after a successful morning run —
  // a short "your brief is ready" text, not the whole brief. Agents live
  // in texts far more than email or an app they have to remember to open;
  // this is the trigger that actually gets them to look.
  if(action==="send_brief_notification"){
    const { phone, headline, timezone, pushSubscription } = body;
    if(pushSubscription && isTcpaSafeHour(timezone)){
      sendPushNotification(pushSubscription, {
        title: "Your brief is ready", body: headline ? String(headline).slice(0,140) : "Your team has been working overnight — see what's new.", url: "/", tag: "spark-brief",
      }, sb, email).catch(()=>{});
    }
    if(!phone) return res.status(200).json({ sent:false }); // push may have fired above even with no phone on file
    const message = `Good morning! Your SPARK brief is ready.${headline?` Today: ${String(headline).slice(0,100)}`:""} Open it: usesparkai.app`;
    const sent = await sendSMS(phone, message, timezone);
    return res.status(200).json({ sent });
  }

  // Stores the browser's push subscription object (endpoint + keys) so the
  // server can push to this specific device later. One agent can have
  // subscriptions from multiple devices in theory, but this keeps it
  // simple for now — most recent subscription wins, matching how phone/
  // timezone/smsEnabled already work in the same profile object.
  if(action==="save_push_subscription"){
    const { subscription } = body;
    if(!subscription?.endpoint) return res.status(400).json({ error:"subscription required" });
    const { data: existing } = await sb.from("agent_data_sync").select("profile").eq("user_email", email).single();
    const updatedProfile = { ...(existing?.profile||{}), pushSubscription: subscription };
    const { error } = await sb.from("agent_data_sync").upsert({
      user_email: email, profile: updatedProfile, synced_at: new Date().toISOString(),
    },{ onConflict:"user_email" });
    if(error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ saved:true });
  }

  // ─── SEND IT FOR ME — agent-initiated email to their own client, sent via
  // Resend but branded as coming from the agent, with reply-to set to the
  // agent's own inbox so any response lands directly with them. This is
  // the "action execution" piece of Autopilot — not just drafting a
  // message, actually sending it, always with the agent's explicit
  // confirmation on the exact wording before it goes out.
  if(action==="send_message"){
    const { agentName, recipientEmail, recipientName, subject, body: messageBody } = body;
    if(!recipientEmail || !messageBody){
      return res.status(400).json({ error:"Recipient email and message required" });
    }
    const apiKey = process.env.RESEND_API_KEY;
    if(!apiKey) return res.status(500).json({ error:"Email sending not configured" });

    const fromName = agentName ? `${agentName} via SPARK` : "SPARK";
    const htmlBody = String(messageBody)
      .split("\n\n").map(p=>`<p style="margin:0 0 14px;">${p.replace(/\n/g,"<br/>")}</p>`).join("");

    try{
      const r = await fetch("https://api.resend.com/emails",{
        method:"POST",
        headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
        body: JSON.stringify({
          from: `${fromName} <notifications@usesparkai.app>`,
          to: recipientEmail,
          reply_to: email, // agent's own email — replies go straight to them
          subject: subject || "Following up",
          html: `<div style="font-family:-apple-system,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a;max-width:560px;">
            ${htmlBody}
            <p style="margin-top:24px;color:#888;font-size:12px;">Sent via SPARK on behalf of ${agentName||"your agent"}. Reply directly to this email to reach them.</p>
          </div>`,
        }),
      });
      if(!r.ok){
        const errBody = await r.text().catch(()=>"");
        console.error("Send message failed:", r.status, errBody);
        return res.status(502).json({ error:"Email failed to send" });
      }
    }catch(e){
      console.error("Send message error:", e.message);
      return res.status(500).json({ error:e.message });
    }

    return res.status(200).json({ sent:true });
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
    "get_public_profile","capture_lead","send_message","send_brief_notification",
    "save_push_subscription",
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
