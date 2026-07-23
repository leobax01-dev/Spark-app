// api/cron-autopilot.js
// The scheduled background Autopilot run — the piece everything else this
// month has been building toward. Vercel Cron hits this on a schedule with
// no browser involved, so the client-side engine (aggregateBusinessData +
// runAutopilotEngine + getMarketContext, all living in AutopilotPanel.jsx)
// is ported here as plain server-side JS. Kept as close to byte-identical
// to the client version as possible so the JSON schema matches exactly —
// if you change the prompts/schema in AutopilotPanel.jsx, mirror the
// change here too, they're not shared code, just kept in sync by hand.
//
// Reuses the existing /api/claude, /api/comps, and /api/google-data
// endpoints via internal HTTP calls rather than duplicating their logic
// (Anthropic calls, RentCast parsing, email sending, memory writes) — so
// every run this produces is saved and notified exactly the same way a
// client-triggered run is, with zero duplicated business logic.

import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://usesparkai.app";

function getSupabase(){
  return createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    { auth:{ autoRefreshToken:false, persistSession:false }, db:{ schema:"public" } }
  );
}

// ─── Ported from AutopilotPanel.jsx aggregateBusinessData ─────────────────
function aggregateBusinessData({ clients=[], pipeline=[], goals={}, profile={} }){
  const now = Date.now();
  const clientsWithMetrics = clients.map(c=>{
    const activities = c.activities||[];
    const latestActivity = activities[0]||null; // stored newest-first
    const openTasks = (c.tasks||[]).filter(t=>!t.completed);
    return {
      ...c,
      daysSince: c.lastContact ? Math.round((now-new Date(c.lastContact))/864e5) : null,
      latestActivity,
      activityCount: activities.length,
      openTaskCount: openTasks.length,
      nextTaskDue: openTasks.filter(t=>t.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0]?.dueDate || null,
    };
  });

  const overdue = clientsWithMetrics.filter(c=>c.daysSince!==null&&c.daysSince>7)
    .sort((a,b)=>b.daysSince-a.daysSince);

  const urgentDeals = pipeline.filter(d=>{
    if(!d.closeDate) return false;
    const days = Math.round((new Date(d.closeDate)-now)/864e5);
    return days>=0&&days<=21;
  }).sort((a,b)=>new Date(a.closeDate)-new Date(b.closeDate));

  const atRiskDeals = pipeline.filter(d=>(parseFloat(d.probability)||50)<60);
  const totalPipeline = pipeline.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const monthlyTarget = parseFloat(String(goals.monthlyGciTarget||"").replace(/[$,]/g,""))||0;
  const currentGci    = parseFloat(String(goals.currentMonth||"").replace(/[$,]/g,""))||0;

  const closedClients = clients.filter(c=>c.stage==="closed");
  const referralOpps  = closedClients.filter(c=>{
    if(!c.lastContact) return false;
    const monthsAgo = Math.round((now-new Date(c.lastContact))/(864e5*30));
    return monthsAgo>=10&&monthsAgo<=13;
  });

  return {
    agentName:      profile?.name||"Agent",
    agentMarket:    profile?.market||"",
    agentBrokerage: profile?.brokerage||"",
    totalClients:   clients.length,
    overdueClients: overdue,
    referralOpps,
    allClients:     clientsWithMetrics,
    totalDeals:     pipeline.length,
    urgentDeals, atRiskDeals, totalPipeline,
    monthlyTarget, currentGci,
    today: new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}),
  };
}

// ─── Ported market-grounding helpers ───────────────────────────────────────
function extractZip(propertyText){
  if(!propertyText) return null;
  const match = propertyText.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}

async function fetchMarketStats(zipCode){
  try{
    const r = await fetch(`${BASE_URL}/api/comps`,{
      method:"POST", headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ action:"market_stats", zipCode }),
    });
    if(!r.ok) return null;
    return await r.json();
  }catch(e){
    console.warn("Market stats fetch failed:", e.message);
    return null;
  }
}

async function getMarketContext(clients){
  const relevant = (clients||[]).filter(c=>c.property && (c.stage==="active"||c.stage==="contract"||c.stage==="prospect"));
  const zips = [...new Set(relevant.map(c=>extractZip(c.property)).filter(Boolean))].slice(0,8);
  if(zips.length===0) return "";

  const results = await Promise.all(zips.map(async zip=>{
    const stats = await fetchMarketStats(zip);
    return stats ? { zip, stats } : null;
  }));

  const lines = results.filter(Boolean).map(({zip,stats})=>
    `Zip ${zip}: median days on market ${stats.medianDaysOnMarket??"?"}, median sale price $${stats.medianSalePrice?.toLocaleString()||"?"}, median list price $${stats.medianListPrice?.toLocaleString()||"?"}, active listings ${stats.activeListings??"?"}`
  );
  return lines.length ? `LIVE MARKET DATA (real, current, from RentCast — reference these actual numbers, never invent statistics):\n${lines.join("\n")}` : "";
}

// ─── Ported Claude engine — identical prompts/schema to the client ────────
async function callClaude(userPrompt, systemPrompt){
  const r = await fetch(`${BASE_URL}/api/claude`,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ system:systemPrompt, messages:[{role:"user",content:userPrompt}], max_tokens:4000 }),
  });
  const d = await r.json();
  const raw = d.content?.[0]?.text||"";
  for(const attempt of [
    ()=>JSON.parse(raw.trim()),
    ()=>JSON.parse(raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim()),
    ()=>{ const f=raw.indexOf("{"),l=raw.lastIndexOf("}"); if(f!==-1&&l>f) return JSON.parse(raw.slice(f,l+1)); throw new Error("no block"); },
  ]){
    try{ return attempt(); }catch{}
  }
  throw new Error("parse_failed:"+raw.slice(0,150));
}

async function runAutopilotEngine(data){
  const clientDetails = data.allClients.map(c=>{
    const tagStr = c.tags?.length ? `, tags:[${c.tags.join(",")}]` : "";
    const activityStr = c.latestActivity
      ? `, last activity (${c.latestActivity.type}): "${c.latestActivity.summary?.slice(0,80)}"`
      : `, notes:${c.notes?.slice(0,50)||"none"}`;
    const taskStr = c.openTaskCount>0 ? `, ${c.openTaskCount} open task${c.openTaskCount!==1?"s":""}${c.nextTaskDue?` (next due ${c.nextTaskDue})`:""}` : "";
    return `${c.name} (${c.type},${c.stage},last:${c.daysSince!==null?c.daysSince+"d":"?"}${c.daysSince>7?" ⚠️":""}, prop:${c.property||"?"}, budget:${c.budget||"?"}, timeline:${c.timeline||"?"}, motivation:${c.motivation||"?"}${activityStr}${tagStr}${taskStr})`;
  }).join("\n");

  const dealDetails = [...data.urgentDeals,...data.atRiskDeals.filter(d=>!data.urgentDeals.find(u=>u.id===d.id))].map(d=>{
    const days=d.closeDate?Math.round((new Date(d.closeDate)-Date.now())/864e5):null;
    return `${d.name}: $${(parseFloat(d.value)||0).toLocaleString()}, ${d.stage||"?"}, ${d.probability||50}% prob${days!==null?`, ${days}d to close`:""}`;
  }).join("\n");

  const marketCtx = await getMarketContext(data.allClients);

  const ctx=`Agent: ${data.agentName}, ${data.agentBrokerage}, ${data.agentMarket}
Today: ${data.today}
Clients (${data.totalClients}): ${clientDetails||"none"}
Urgent/at-risk deals: ${dealDetails||"none"}
Overdue: ${data.overdueClients.map(c=>`${c.name} ${c.daysSince}d`).join(", ")||"none"}
Referral opps: ${data.referralOpps.map(c=>c.name).join(", ")||"none"}
GCI target: $${data.monthlyTarget?.toLocaleString()||"?"} | Current: $${data.currentGci?.toLocaleString()||"?"} | Pipeline: $${Math.round(data.totalPipeline).toLocaleString()}
${marketCtx}`;

  const SYSTEM = "You are SPARK Autopilot, an elite real estate business intelligence AI. Be specific, reference real names and numbers. When a client has tags, a logged activity, or open tasks, weave that real context into your reasoning — a tagged 'VIP' client going quiet is a sharper signal than a generic overdue flag, and referencing what was actually said in their last logged call beats a generic notes summary. Return ONLY valid compact JSON — no markdown, no code fences, no explanation before or after.";

  const part1 = await callClaude(`${ctx}

Return ONLY this JSON (compact):
{"mission":{"headline":"today's #1 priority in 1 sentence referencing real names","why":"why — specific data","top3":[{"rank":1,"action":"specific action","client":"name","urgency":"critical","message":"exact word-for-word message ready to send"},{"rank":2,"action":"action","client":"name","urgency":"high","message":"message"},{"rank":3,"action":"action","client":"name","urgency":"medium","message":"message"}]},"deal_intelligence":{"overall_health":"stable","health_summary":"2 sentence honest assessment","risks":[{"deal":"name","risk":"specific risk","severity":"high","action":"what to do","message":"exact recovery message to send","value":0}],"opportunities":[{"description":"opportunity","action":"how to capitalize","value":0}]},"client_scores":[{"name":"name","score":75,"trend":"rising","reason":"why","next_action":"what to do","probability":"65%"}]}

For every risk and opportunity, include "value": the real dollar amount of that specific deal (from the deal data given above — its full value, not a guess or a fraction). Use 0 only if you genuinely cannot match it to a known deal value.`, SYSTEM);

  const part2 = await callClaude(`${ctx}

Return ONLY this JSON (compact):
{"relationship_alerts":[{"type":"overdue","client":"name","days":9,"message":"exact warm personal message to send — if they have a logged activity or tag, reference it specifically instead of writing a generic check-in","reason":"why reach out now — cite their tags or last logged activity if relevant"}],"market_intelligence":{"insight":"actionable market insight for their pipeline — if LIVE MARKET DATA is provided above, ground this in the real numbers given (e.g. reference actual median DOM or price trends); otherwise give an honest general insight without inventing statistics","opportunity":"market condition to capitalize on now","talking_point":"most powerful talking point this week"},"coaching_insight":{"observation":"honest pattern from their data — if you notice clients with open tasks going overdue, or tagged clients being neglected, call that out specifically","recommendation":"one concrete change","this_week":"single most impactful action"},"performance_forecast":{"gci_projection":"$X projected this month","deals_likely_to_close":"1-2","biggest_risk_to_target":"what could prevent hitting goal","momentum":"rising"}}`, SYSTEM);

  return {...part1, ...part2};
}

// ─── Handler ────────────────────────────────────────────────────────────
export default async function handler(req, res){
  // Vercel automatically sends this header on cron-triggered requests when
  // CRON_SECRET is set as an env var — rejects anyone else hitting this URL.
  const authHeader = req.headers.authorization;
  if(process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`){
    return res.status(401).json({ error:"Unauthorized" });
  }

  const sb = getSupabase();
  const summary = { processed:0, skipped:0, errors:[] };

  const { data: users, error: usersError } = await sb
    .from("users")
    .select("email")
    .eq("plan","premium");

  if(usersError){
    console.error("Cron: failed to load premium users:", usersError.message);
    return res.status(500).json({ error:usersError.message });
  }

  for(const u of users||[]){
    try{
      const { data: sync } = await sb
        .from("agent_data_sync")
        .select("clients,pipeline,goals,profile")
        .eq("user_email", u.email)
        .single();

      const clients = sync?.clients||[];
      if(clients.length===0){ summary.skipped++; continue; }

      const businessData = aggregateBusinessData({
        clients, pipeline:sync?.pipeline||[], goals:sync?.goals||{}, profile:sync?.profile||{},
      });
      const analysis = await runAutopilotEngine(businessData);

      // Only email if the top critical risk is genuinely new since the last run
      const { data: prevRun } = await sb
        .from("autopilot_runs")
        .select("result")
        .eq("user_email", u.email)
        .order("run_at",{ ascending:false })
        .limit(1)
        .single();
      const prevTopRisk = prevRun?.result?.deal_intelligence?.risks?.find(r=>r.severity==="high");
      const newTopRisk  = analysis?.deal_intelligence?.risks?.find(r=>r.severity==="high");
      const notifyEmail = !!newTopRisk && (!prevTopRisk || `${prevTopRisk.deal}::${prevTopRisk.risk}` !== `${newTopRisk.deal}::${newTopRisk.risk}`);

      await fetch(`${BASE_URL}/api/google-data`,{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          email: u.email, action:"save_run",
          result: analysis,
          clientCount: businessData.totalClients,
          dealCount: businessData.totalDeals,
          overallHealth: analysis.deal_intelligence?.overall_health||"stable",
          memory: { patterns: analysis.coaching_insight?.observation||"" },
          notifyEmail, agentName: sync?.profile?.name,
        }),
      });

      summary.processed++;
    }catch(err){
      console.error(`Cron: run failed for ${u.email}:`, err.message);
      summary.errors.push({ email:u.email, error:err.message });
    }
  }

  return res.status(200).json(summary);
}
