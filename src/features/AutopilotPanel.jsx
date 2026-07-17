// src/features/AutopilotPanel.jsx
// SPARK AUTOPILOT — Unified AI Intelligence + Conversational Assistant
// Premium: Full Autopilot intelligence report + AI chat with Autopilot context
// Starter/Pro: SPARK Assistant chat with full business context (no Autopilot report)

import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:"#04040a", surface:"#08080f", surfaceUp:"#0d0d1a", surfaceHigh:"#111122",
  border:"rgba(255,255,255,0.06)", borderMd:"rgba(255,255,255,0.10)",
  indigo:"#6366f1", indigoLt:"#818cf8", violet:"#8b5cf6",
  cyan:"#22d3ee", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e",
  text:"rgba(255,255,255,0.95)", textMd:"rgba(255,255,255,0.55)",
  textDim:"rgba(255,255,255,0.26)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const AP_KEY      = "spark_autopilot_v1";
const MEMORY_KEY  = "spark_autopilot_memory_v1";
const RUN_KEY     = "spark_autopilot_last_run";
const CHAT_KEY    = "spark_autopilot_chat_v1";
const NOTES_KEY   = "spark_assistant_notes_v1";
const CONV_KEY    = "spark_conv_memory_v1"; // cached conversation summaries

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MEMORY — summarize + persist sessions
// ─────────────────────────────────────────────────────────────────────────────
async function summarizeConversation(messages, email){
  if(!messages?.length || messages.length < 2) return null;
  if(!email) return null;

  // Only summarize substantial conversations (4+ messages)
  const exchanges = messages.filter(m=>!m.streaming);
  if(exchanges.length < 4) return null;

  const transcript = exchanges.slice(-20).map(m=>
    `${m.role==="user"?"Agent":"SPARK"}: ${m.content.slice(0,200)}`
  ).join("\n");

  try{
    const r = await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system:"You are a conversation summarizer for a real estate AI assistant. Summarize conversations concisely, focusing on decisions made, clients discussed, strategies agreed on, and any outcomes the agent reported. Be specific — include client names, deal names, and dollar amounts when mentioned. Return ONLY valid JSON.",
        messages:[{role:"user",content:`Summarize this SPARK AI conversation in JSON:

${transcript}

Return ONLY this JSON:
{"summary":"2-3 sentence summary of what was discussed and decided — specific, include names and numbers","key_decisions":["decision or strategy agreed on","another decision"],"clients_discussed":["client name if mentioned"]}`}],
        max_tokens:600,
      })
    });
    const d = await r.json();
    const raw = d.content?.[0]?.text||"";

    let parsed = null;
    for(const attempt of [
      ()=>JSON.parse(raw.trim()),
      ()=>{ const f=raw.indexOf("{"),l=raw.lastIndexOf("}"); if(f!==-1&&l>f) return JSON.parse(raw.slice(f,l+1)); throw new Error("no block"); },
    ]){
      try{ parsed=attempt(); break; }catch{}
    }

    if(!parsed?.summary) return null;

    // Save to Supabase
    await apSync(email,"save_conversation",{
      summary:         parsed.summary,
      keyDecisions:    parsed.key_decisions||[],
      clientsDiscussed:parsed.clients_discussed||[],
    });

    // Update local cache
    const cached = lsGet(CONV_KEY,[]);
    const newEntry = {
      summary:          parsed.summary,
      key_decisions:    parsed.key_decisions||[],
      clients_discussed:parsed.clients_discussed||[],
      created_at:       new Date().toISOString(),
    };
    lsSet(CONV_KEY,[newEntry,...cached].slice(0,8));

    return parsed.summary;
  }catch(e){
    console.warn("Conversation summary failed:",e.message);
    return null;
  }
}

function buildConversationMemoryContext(conversations){
  if(!conversations?.length) return "";
  const lines=["\nCONVERSATION MEMORY (previous sessions — what the agent told you before):"];
  conversations.slice(0,5).forEach((c,i)=>{
    const date = new Date(c.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric"});
    lines.push(`\n[Session ${i+1} — ${date}]`);
    lines.push(`Summary: ${c.summary}`);
    if(c.key_decisions?.length)
      lines.push(`Decisions made: ${c.key_decisions.join("; ")}`);
    if(c.clients_discussed?.length)
      lines.push(`Clients discussed: ${c.clients_discussed.join(", ")}`);
  });
  lines.push("\nUse this memory to reference previous conversations naturally. Say things like 'Last time we talked about X' or 'You mentioned Y last week' when relevant.");
  return lines.join("\n");
}

function lsGet(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} }

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MODES
// ─────────────────────────────────────────────────────────────────────────────
const MODES = {
  write:     { label:"Write",    icon:"✍️", color:C.indigo,  description:"Scripts, emails & copy",    instruction:"You are in WRITE mode. Produce polished, ready-to-use written content. Write in natural prose. NEVER use JSON or code blocks. Output should read like something a human wrote." },
  strategize:{ label:"Strategy", icon:"🧠", color:C.violet,  description:"Think through problems",    instruction:"You are in STRATEGIZE mode. Think through the agent's situation deeply and respond in conversational prose. Give structured analysis with clear recommendations. NEVER use JSON or code blocks." },
  coach:     { label:"Coach",    icon:"🎯", color:C.amber,   description:"Direct business advice",    instruction:"You are in COACH mode. Be direct, honest, and specific. Don't soften feedback. Give the exact action to take. NEVER use JSON or code blocks. Write like a coach speaking plainly." },
  practice:  { label:"Practice", icon:"🎭", color:C.cyan,    description:"Role-play client scenarios", instruction:"You are in PRACTICE mode. Role-play as a real estate client so the agent can practice. Stay in character. NEVER use JSON or code blocks. After each exchange, give one line of coaching feedback." },
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────────
function aggregateBusinessData(voice){
  const clients  = lsGet("spark_clients_v1",[]);
  const pipeline = lsGet("spark_pipeline_value_v1",[]);
  const goals    = lsGet("spark_biz_goals_v1",{});
  const usage    = lsGet("sp_usage_stats",{});
  const now      = Date.now();

  const clientsWithMetrics = clients.map(c=>({
    ...c,
    daysSince: c.lastContact ? Math.round((now-new Date(c.lastContact))/864e5) : null,
  }));

  const overdue = clientsWithMetrics.filter(c=>c.daysSince!==null&&c.daysSince>7)
    .sort((a,b)=>b.daysSince-a.daysSince);

  const urgentDeals = pipeline.filter(d=>{
    if(!d.closeDate) return false;
    const days = Math.round((new Date(d.closeDate)-now)/864e5);
    return days>=0&&days<=21;
  }).sort((a,b)=>new Date(a.closeDate)-new Date(b.closeDate));

  const atRiskDeals = pipeline.filter(d=>(parseFloat(d.probability)||50)<60);

  const totalPipeline   = pipeline.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
  const weightedPipeline= pipeline.reduce((s,d)=>s+(parseFloat(d.value)||0)*(parseFloat(d.probability)||50)/100,0);
  const monthlyTarget   = parseFloat(goals.monthlyGciTarget?.replace(/[$,]/g,""))||0;
  const currentGci      = parseFloat(goals.currentMonth?.replace(/[$,]/g,""))||0;

  const closedClients = clients.filter(c=>c.stage==="closed");
  const referralOpps  = closedClients.filter(c=>{
    if(!c.lastContact) return false;
    const monthsAgo = Math.round((now-new Date(c.lastContact))/(864e5*30));
    return monthsAgo>=10&&monthsAgo<=13;
  });

  return {
    agentName:       voice?.name||"Agent",
    agentMarket:     voice?.market||"",
    agentBrokerage:  voice?.brokerage||"",
    totalClients:    clients.length,
    activeClients:   clients.filter(c=>c.stage==="active").length,
    contractClients: clients.filter(c=>c.stage==="contract").length,
    prospectClients: clients.filter(c=>c.stage==="prospect").length,
    overdueClients:  overdue,
    referralOpps,
    allClients:      clientsWithMetrics,
    totalDeals:      pipeline.length,
    urgentDeals, atRiskDeals,
    totalPipeline, weightedPipeline,
    monthlyTarget, currentGci,
    gciGap:         monthlyTarget>0?monthlyTarget-currentGci:null,
    gciPct:         monthlyTarget>0?Math.round((currentGci/monthlyTarget)*100):null,
    totalGenerations:usage.total||0,
    streak:         usage.streak||0,
    memory:         lsGet(MEMORY_KEY,{}),
    today: new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────────────────────
function buildAgentContext(voice,planKey){
  const lines=[];
  if(voice?.saved){
    lines.push("AGENT PROFILE:");
    if(voice.name)          lines.push(`- Name: ${voice.name}`);
    if(voice.brokerage)     lines.push(`- Brokerage: ${voice.brokerage}`);
    if(voice.market)        lines.push(`- Market: ${voice.market}`);
    if(voice.specialty)     lines.push(`- Specialty: ${voice.specialty}`);
    if(voice.tone)          lines.push(`- Tone preference: ${voice.tone}`);
    if(voice.targetClient)  lines.push(`- Target client: ${voice.targetClient}`);
    if(voice.cta)           lines.push(`- Preferred CTA: ${voice.cta}`);
    lines.push("");
  }

  const usage   = lsGet("sp_usage_stats",{});
  const credits = lsGet("sp_credits",null);
  lines.push("SPARK USAGE:");
  if(planKey)       lines.push(`- Plan: ${planKey}`);
  if(credits!==null)lines.push(`- Credits remaining: ${credits}`);
  if(usage.streak)  lines.push(`- Day streak: ${usage.streak}`);
  lines.push("");

  const clients = lsGet("spark_clients_v1",[]);
  if(clients.length){
    const now=Date.now();
    lines.push(`CLIENT PIPELINE (${clients.length} total):`);
    clients.forEach(c=>{
      const ds=c.lastContact?Math.round((now-new Date(c.lastContact))/864e5):null;
      const od=ds!==null&&ds>7?` ⚠️ ${ds}d no contact`:ds!==null?` (${ds}d ago)`:"";
      lines.push(`- [${c.stage?.toUpperCase()}] ${c.name} (${c.type}) — ${c.property||"?"}, budget ${c.budget||"?"}, timeline ${c.timeline||"?"}${od}${c.motivation?`, motivation: ${c.motivation}`:""}${c.notes?`, notes: ${c.notes.slice(0,100)}`:""}${c.nextAction?`, next: ${c.nextAction}`:""}`);
    });
    lines.push("");
  }

  const deals=lsGet("spark_pipeline_value_v1",[]);
  if(deals.length){
    const total=deals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
    lines.push(`DEALS ($${Math.round(total).toLocaleString()} total pipeline):`);
    deals.forEach(d=>{
      const daysUntil=d.closeDate?Math.round((new Date(d.closeDate)-Date.now())/864e5):null;
      lines.push(`- ${d.name}: $${(parseFloat(d.value)||0).toLocaleString()}, ${d.stage||"?"}, ${d.probability||50}% prob${daysUntil!==null?`, closes in ${daysUntil}d${daysUntil<=7?" 🔥":""}`:", close TBD"}`);
    });
    lines.push("");
  }

  const goals=lsGet("spark_biz_goals_v1",{});
  if(goals.monthlyGciTarget||goals.currentMonth){
    lines.push("BUSINESS GOALS:");
    if(goals.monthlyGciTarget) lines.push(`- Monthly GCI target: ${goals.monthlyGciTarget}`);
    if(goals.currentMonth)     lines.push(`- Current month GCI: ${goals.currentMonth}`);
    if(goals.yearToDate)       lines.push(`- YTD GCI: ${goals.yearToDate}`);
    lines.push("");
  }

  lines.push(`TODAY: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}`);
  return lines.join("\n");
}

function buildAutopilotContext(autopilotResult){
  if(!autopilotResult) return "";
  const lines=["\nAUTOPILOT INTELLIGENCE (latest analysis):"];
  if(autopilotResult.mission?.headline)
    lines.push(`- Today's mission: ${autopilotResult.mission.headline}`);
  if(autopilotResult.deal_intelligence?.overall_health)
    lines.push(`- Pipeline health: ${autopilotResult.deal_intelligence.overall_health}`);
  if(autopilotResult.deal_intelligence?.risks?.length)
    lines.push(`- Deal risks: ${autopilotResult.deal_intelligence.risks.map(r=>r.deal+": "+r.risk).join("; ")}`);
  if(autopilotResult.client_scores?.length)
    lines.push(`- Top client scores: ${autopilotResult.client_scores.slice(0,3).map(c=>`${c.name} ${c.score}/100`).join(", ")}`);
  if(autopilotResult.performance_forecast?.gci_projection)
    lines.push(`- GCI projection: ${autopilotResult.performance_forecast.gci_projection}`);
  if(autopilotResult.coaching_insight?.observation)
    lines.push(`- Coaching insight: ${autopilotResult.coaching_insight.observation}`);
  return lines.join("\n");
}

function buildGoogleContext(googleData){
  if(!googleData) return "";
  const lines=["\nGOOGLE INTEGRATION (live data):"];
  lines.push(`Connected Gmail: ${googleData.googleEmail}`);
  if(googleData.events?.length>0){
    lines.push(`\nUPCOMING CALENDAR (${googleData.events.length} events):`);
    googleData.events.forEach(e=>{
      const u=e.isToday?" 🔴 TODAY":e.isTomorrow?" 🟡 TOMORROW":"";
      lines.push(`- ${e.title}${u} · ${e.start}${e.location?` · ${e.location}`:""}${e.attendees?.length?` · with: ${e.attendees.slice(0,3).join(", ")}`:""}${e.description?` · ${e.description.slice(0,60)}`:""}`);
    });
  }
  if(googleData.emails?.length>0){
    lines.push(`\nRECENT INBOX (${googleData.emails.length} threads):`);
    googleData.emails.slice(0,6).forEach(e=>{
      lines.push(`- From: ${e.from.split("<")[0].trim()} · ${e.subject} · ${e.snippet.slice(0,80)}`);
    });
  }
  return lines.join("\n");
}

function buildSystem(voice,planKey,autopilotResult,googleData,mode,conversations){
  const agentCtx    = buildAgentContext(voice,planKey);
  const autopilotCtx= buildAutopilotContext(autopilotResult);
  const googleCtx   = buildGoogleContext(googleData);
  const memoryCtx   = buildConversationMemoryContext(conversations);
  const modeInst    = MODES[mode]?.instruction||"";
  const isPremium   = planKey==="premium";

  return `You are SPARK Autopilot — the most advanced AI business partner ever built for real estate agents. You are deeply integrated into this agent's business with full context about their clients, pipeline, deals, goals, calendar, email, and the history of your previous conversations together.

${agentCtx}
${autopilotCtx}
${googleCtx}
${memoryCtx}

${modeInst}

CORE RULES:
- NEVER respond with JSON, code blocks, or markdown code fences
- NEVER output structured data — always respond in natural conversational prose
- Write like the best business partner the agent has ever had
- Reference specific client names, deal values, and situations from context above
- When conversation memory exists, reference previous sessions naturally ("Last time we talked about...", "You mentioned last week that...")
- When calendar events exist, proactively prep the agent for upcoming appointments
- When emails are referenced, use actual inbox content
- Be direct and specific — no generic advice, always tie to their actual situation
- Use **bold** sparingly for emphasis, line breaks for readability
- Scripts and messages should be word-for-word ready to send
- Sound warm, sharp, and human — not like software${isPremium&&autopilotResult?"\n- You have full Autopilot intelligence — reference it proactively. Lead with what matters most today.":""}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// OPENING BRIEFING
// ─────────────────────────────────────────────────────────────────────────────
const DAILY_BRIEF_KEY = "spark_daily_brief_v1"; // { brief, suggestedAction, date, urgency }

async function generateDailyBrief(voice, autopilotResult, googleData, conversations){
  const firstName   = voice?.name?.split(" ")[0] || null;
  const hour        = new Date().getHours();
  const greeting    = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const name        = firstName?`, ${firstName}`:"";
  const today       = new Date().toISOString().slice(0,10);

  // Check if already generated today
  const cached = lsGet(DAILY_BRIEF_KEY, null);
  if(cached?.date===today) return cached;

  // Build rich context for brief generation
  const clients     = lsGet("spark_clients_v1",[]);
  const deals       = lsGet("spark_pipeline_value_v1",[]);
  const goals       = lsGet("spark_biz_goals_v1",{});
  const now         = Date.now();

  const overdue     = clients.filter(c=>c.lastContact&&Math.round((now-new Date(c.lastContact))/864e5)>7).sort((a,b)=>b.daysSince-a.daysSince);
  const critical    = clients.filter(c=>c.lastContact&&Math.round((now-new Date(c.lastContact))/864e5)>14);
  const closingToday= deals.filter(d=>d.closeDate&&Math.round((new Date(d.closeDate)-now)/864e5)===0);
  const closingSoon = deals.filter(d=>d.closeDate&&Math.round((new Date(d.closeDate)-now)/864e5)<=7&&Math.round((new Date(d.closeDate)-now)/864e5)>0);
  const todayEvents = googleData?.events?.filter(e=>e.isToday)||[];
  const tomorrowEvents = googleData?.events?.filter(e=>e.isTomorrow)||[];

  // Determine urgency level
  const isUrgent    = closingToday.length>0 || critical.length>0;
  const urgency     = closingToday.length>0?"critical":critical.length>0?"high":overdue.length>0?"medium":"low";

  // Build prompt context
  const ctx = [
    `Agent: ${voice?.name||"Agent"}, ${voice?.brokerage||""}, ${voice?.market||""}`,
    `Time: ${greeting.replace("Good ","")} — ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}`,
    autopilotResult?.mission?.headline ? `Autopilot mission: ${autopilotResult.mission.headline}` : "",
    autopilotResult?.mission?.why ? `Why: ${autopilotResult.mission.why}` : "",
    overdue.length ? `Overdue clients (7+ days): ${overdue.map(c=>`${c.name} (${Math.round((now-new Date(c.lastContact))/864e5)}d)`).join(", ")}` : "",
    critical.length ? `CRITICAL overdue (14+ days): ${critical.map(c=>c.name).join(", ")}` : "",
    closingToday.length ? `CLOSING TODAY: ${closingToday.map(d=>`${d.name} $${(parseFloat(d.value)||0).toLocaleString()}`).join(", ")}` : "",
    closingSoon.length ? `Closing soon: ${closingSoon.map(d=>`${d.name} in ${Math.round((new Date(d.closeDate)-now)/864e5)}d`).join(", ")}` : "",
    todayEvents.length ? `Today's calendar: ${todayEvents.map(e=>`${e.title} at ${e.start}`).join(", ")}` : "",
    tomorrowEvents.length ? `Tomorrow: ${tomorrowEvents.map(e=>e.title).join(", ")}` : "",
    goals.monthlyGciTarget ? `GCI target: ${goals.monthlyGciTarget} | Current: ${goals.currentMonth||"$0"}` : "",
    conversations?.length ? `Last session: ${conversations[0]?.summary?.slice(0,120)}` : "",
    autopilotResult?.deal_intelligence?.risks?.[0] ? `Top deal risk: ${autopilotResult.deal_intelligence.risks[0].deal} — ${autopilotResult.deal_intelligence.risks[0].risk}` : "",
  ].filter(Boolean).join("\n");

  try{
    const r = await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system:`You are SPARK Autopilot — a brilliant, warm real estate business partner. Generate a proactive daily brief that feels like a trusted colleague calling the agent in the morning. Be specific, reference real names and numbers. Sound human, not robotic. NEVER use JSON. Return ONLY plain text.`,
        messages:[{role:"user",content:`Generate a proactive morning brief for this agent. Context:\n\n${ctx}\n\nRules:
- Start with "${greeting}${name}." then immediately lead with the MOST IMPORTANT thing — don't bury the lede
- If something is closing TODAY or critical, lead with that urgency immediately
- Reference specific client names, deal values, and calendar events
- If you have conversation memory, reference it naturally ("Last time we talked about X...")
- 3-5 sentences max — punchy, direct, warm
- End with ONE specific suggested action the agent should take right now
- Do NOT use bullet points or headers — flowing conversational prose only
- Sound like the smartest business partner they've ever had calling them in the morning`}],
        max_tokens:400,
      })
    });
    const d = await r.json();
    const brief = sanitizeResponse(d.content?.[0]?.text||"");
    if(!brief) throw new Error("Empty brief");

    // Extract suggested action from the brief (last sentence)
    const sentences = brief.split(/(?<=[.!?])\s+/);
    const suggestedAction = sentences[sentences.length-1]||"";

    const result = { brief, suggestedAction, date:today, urgency };
    lsSet(DAILY_BRIEF_KEY, result);
    return result;
  }catch(e){
    console.warn("Daily brief generation failed:",e.message);
    // Fallback to static brief
    return buildStaticBriefing(voice, autopilotResult, greeting, name);
  }
}

function buildStaticBriefing(voice, autopilotResult, greeting, name){
  const today = new Date().toISOString().slice(0,10);
  if(autopilotResult?.mission?.headline){
    const brief = `${greeting}${name}. Autopilot has analyzed your business.\n\n**Today's priority:** ${autopilotResult.mission.headline}\n\n${autopilotResult.mission.why||""}\n\nWhat would you like to tackle first?`;
    return { brief, suggestedAction:null, date:today, urgency:"medium" };
  }
  const clients  = lsGet("spark_clients_v1",[]);
  const deals    = lsGet("spark_pipeline_value_v1",[]);
  const now      = Date.now();
  const overdue  = clients.filter(c=>c.lastContact&&Math.round((now-new Date(c.lastContact))/864e5)>7);
  const closing  = deals.filter(d=>d.closeDate&&Math.round((new Date(d.closeDate)-now)/864e5)<=14&&Math.round((new Date(d.closeDate)-now)/864e5)>=0);
  const items=[];
  if(overdue.length) items.push(`**${overdue.length} client${overdue.length>1?"s":""} need follow-up** — ${overdue.map(c=>c.name).join(", ")}`);
  if(closing.length) items.push(`**${closing[0].name} closes in ${Math.round((new Date(closing[0].closeDate)-now)/864e5)} days**`);
  const brief = items.length
    ? `${greeting}${name}. Here's what needs your attention:\n\n${items.map(i=>`• ${i}`).join("\n")}\n\nWhat would you like to tackle first?`
    : `${greeting}${name}. I'm SPARK — your AI business partner. I'm ready to help with whatever you need today.`;
  return { brief, suggestedAction:null, date:today, urgency:"low" };
}

function buildOpeningBriefing(voice, autopilotResult){
  // Synchronous fallback — returns immediately from cache or static
  const cached = lsGet(DAILY_BRIEF_KEY, null);
  const today  = new Date().toISOString().slice(0,10);
  if(cached?.date===today) return cached;
  const hour    = new Date().getHours();
  const greeting= hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";
  const name    = voice?.name?.split(" ")[0] ? `, ${voice.name.split(" ")[0]}` : "";
  return buildStaticBriefing(voice, autopilotResult, greeting, name);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
function getSmartPrompts(voice,mode,autopilotResult,googleData){
  const clients    = lsGet("spark_clients_v1",[]);
  const deals      = lsGet("spark_pipeline_value_v1",[]);
  const goals      = lsGet("spark_biz_goals_v1",{});
  const now        = Date.now();

  const prompts = [];

  // Autopilot-driven prompts (Premium)
  if(autopilotResult?.mission?.top3?.length){
    const top = autopilotResult.mission.top3[0];
    prompts.push({ icon:"🎯", label:`Priority: ${top.client||top.action}`, color:C.rose, urgent:true,
      prompt:`Autopilot flagged this as my #1 priority today: "${top.action}" for ${top.client||"my pipeline"}. ${top.message?"Here's the draft message: "+top.message+"\n\n":""} Help me execute this right now.` });
  }

  // Deal risks from Autopilot
  if(autopilotResult?.deal_intelligence?.risks?.length){
    const risk = autopilotResult.deal_intelligence.risks[0];
    prompts.push({ icon:"⚠️", label:`Deal risk: ${risk.deal}`, color:C.amber, urgent:true,
      prompt:`Autopilot detected a risk with ${risk.deal}: "${risk.risk}". Help me address this immediately.` });
  }

  // Calendar prompts (Google)
  if(googleData?.events?.length){
    const urgent = googleData.events.filter(e=>e.isToday||e.isTomorrow||e.daysUntil<=3);
    urgent.slice(0,1).forEach(e=>{
      prompts.push({ icon:"📅", label:`Prep: ${e.title}`, color:e.isToday?C.rose:C.amber, urgent:e.isToday,
        prompt:`I have "${e.title}" ${e.isToday?"today":e.isTomorrow?"tomorrow":`in ${e.daysUntil} days`} at ${e.start}${e.location?` at ${e.location}`:""}. Give me a complete prep package — talking points, likely objections, how to open, and what outcome I'm driving toward.` });
    });
  }

  // Overdue clients
  const overdue = clients.filter(c=>c.lastContact&&Math.round((now-new Date(c.lastContact))/864e5)>7);
  if(overdue.length){
    const c = overdue[0];
    const days = Math.round((now-new Date(c.lastContact))/864e5);
    prompts.push({ icon:"💬", label:`Follow up: ${c.name}`, color:C.indigo,
      prompt:`I haven't contacted ${c.name} in ${days} days. They're a ${c.type} looking at ${c.property||"real estate"}, budget ${c.budget||"?"}, timeline ${c.timeline||"?"}. Write me a warm, natural follow-up ${c.type==="buyer"?"text message":"email"} that re-engages without feeling pushy.` });
  }

  // Closing deals
  const closingSoon = deals.filter(d=>{
    if(!d.closeDate) return false;
    const days=Math.round((new Date(d.closeDate)-now)/864e5);
    return days>=0&&days<=14;
  });
  if(closingSoon.length){
    const d=closingSoon[0];
    const days=Math.round((new Date(d.closeDate)-now)/864e5);
    prompts.push({ icon:"🔥", label:`${d.name} closes in ${days}d`, color:C.amber,
      prompt:`My deal "${d.name}" closes in ${days} days at $${(parseFloat(d.value)||0).toLocaleString()}. What do I need to make sure is done, and what should I communicate to my client right now?` });
  }

  // Mode-specific fallbacks
  const fallbacks = {
    write:     [
      { icon:"📝", label:"Write a listing description", color:C.indigo, prompt:"Write me a compelling MLS listing description for a property. Ask me for the details." },
      { icon:"📧", label:"Draft a client email",        color:C.violet, prompt:"Help me draft a professional client email. What situation should I address?" },
    ],
    strategize:[
      { icon:"🏠", label:"Pricing strategy",     color:C.violet, prompt:"Help me think through a pricing strategy for an upcoming listing. I'll give you the details." },
      { icon:"🎯", label:"Lead conversion plan", color:C.cyan,   prompt:"I have a lead I want to convert. Help me build a strategy to win their business." },
    ],
    coach:     [
      { icon:"💪", label:"Business review",       color:C.amber, prompt:`Give me an honest assessment of my business right now based on what you know about my pipeline, clients, and goals. Don't hold back.` },
      { icon:"📈", label:"Hit my GCI target",     color:C.emerald, prompt:`My monthly GCI target is ${goals.monthlyGciTarget||"set in My Business"}. Current: ${goals.currentMonth||"0"}. What do I need to do right now to hit it?` },
    ],
    practice:  [
      { icon:"🗣️", label:"Practice a listing pitch",    color:C.cyan,   prompt:"Role-play as a seller who's interviewing agents. I want to practice my listing pitch. Start as the seller." },
      { icon:"💬", label:"Handle the 'I need to think'", color:C.violet, prompt:"Role-play as a buyer who just said 'I need to think about it.' Let me practice handling this objection." },
    ],
  };

  const remaining = 6 - prompts.length;
  const fb = (fallbacks[mode]||fallbacks.write).slice(0,remaining);
  return [...prompts, ...fb].slice(0,6);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUPABASE SYNC
// ─────────────────────────────────────────────────────────────────────────────
async function apSync(email,action,body={}){
  try{
    const r = await fetch("/api/google-data",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ email,action,...body }),
    });
    return await r.json();
  }catch(e){ console.warn("autopilot-sync failed:",e.message); return null; }
}

async function syncAgentData(email){
  if(!email) return;
  const clients  = lsGet("spark_clients_v1",[]);
  const pipeline = lsGet("spark_pipeline_value_v1",[]);
  const goals    = lsGet("spark_biz_goals_v1",{});
  await apSync(email,"sync_data",{ clients,pipeline,goals });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPILOT ENGINE (2 calls)
// ─────────────────────────────────────────────────────────────────────────────
async function runAutopilotEngine(data){
  const clientDetails = data.allClients.map(c=>
    `${c.name} (${c.type},${c.stage},last:${c.daysSince!==null?c.daysSince+"d":"?"}${c.daysSince>7?" ⚠️":""}, prop:${c.property||"?"}, budget:${c.budget||"?"}, timeline:${c.timeline||"?"}, motivation:${c.motivation||"?"}, notes:${c.notes?.slice(0,50)||"none"})`
  ).join("\n");

  const dealDetails = [...data.urgentDeals,...data.atRiskDeals.filter(d=>!data.urgentDeals.find(u=>u.id===d.id))].map(d=>{
    const days=d.closeDate?Math.round((new Date(d.closeDate)-Date.now())/864e5):null;
    return `${d.name}: $${(parseFloat(d.value)||0).toLocaleString()}, ${d.stage||"?"}, ${d.probability||50}% prob${days!==null?`, ${days}d to close`:""}`;
  }).join("\n");

  const ctx=`Agent: ${data.agentName}, ${data.agentBrokerage}, ${data.agentMarket}
Today: ${data.today}
Clients (${data.totalClients}): ${clientDetails||"none"}
Urgent/at-risk deals: ${dealDetails||"none"}
Overdue: ${data.overdueClients.map(c=>`${c.name} ${c.daysSince}d`).join(", ")||"none"}
Referral opps: ${data.referralOpps.map(c=>c.name).join(", ")||"none"}
GCI target: $${data.monthlyTarget?.toLocaleString()||"?"} | Current: $${data.currentGci?.toLocaleString()||"?"} | Pipeline: $${Math.round(data.totalPipeline).toLocaleString()}
${data.memory.patterns?`Patterns: ${data.memory.patterns}`:""}`;

  async function callClaude(userPrompt){
    const r=await fetch("/api/claude",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        system:"You are SPARK Autopilot, an elite real estate business intelligence AI. Be specific, reference real names and numbers. Return ONLY valid compact JSON — no markdown, no code fences, no explanation before or after.",
        messages:[{role:"user",content:userPrompt}],
        max_tokens:4000,
      })
    });
    const d=await r.json();
    const raw=d.content?.[0]?.text||"";
    for(const attempt of [
      ()=>JSON.parse(raw.trim()),
      ()=>JSON.parse(raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim()),
      ()=>{ const f=raw.indexOf("{"),l=raw.lastIndexOf("}"); if(f!==-1&&l>f) return JSON.parse(raw.slice(f,l+1)); throw new Error("no block"); },
    ]){
      try{ return attempt(); }catch{}
    }
    console.error("Parse failed:",raw.slice(0,200));
    throw new Error("parse_failed:"+raw.slice(0,80));
  }

  const part1 = await callClaude(`${ctx}

Return ONLY this JSON (compact):
{"mission":{"headline":"today's #1 priority in 1 sentence referencing real names","why":"why — specific data","top3":[{"rank":1,"action":"specific action","client":"name","urgency":"critical","message":"exact word-for-word message ready to send"},{"rank":2,"action":"action","client":"name","urgency":"high","message":"message"},{"rank":3,"action":"action","client":"name","urgency":"medium","message":"message"}]},"deal_intelligence":{"overall_health":"stable","health_summary":"2 sentence honest assessment","risks":[{"deal":"name","risk":"specific risk","severity":"high","action":"what to do","message":"exact recovery message to send"}],"opportunities":[{"description":"opportunity","action":"how to capitalize"}]},"client_scores":[{"name":"name","score":75,"trend":"rising","reason":"why","next_action":"what to do","probability":"65%"}]}`);

  const part2 = await callClaude(`${ctx}

Return ONLY this JSON (compact):
{"relationship_alerts":[{"type":"overdue","client":"name","days":9,"message":"exact warm personal message to send","reason":"why reach out now"}],"market_intelligence":{"insight":"actionable market insight for their pipeline","opportunity":"market condition to capitalize on now","talking_point":"most powerful talking point this week"},"coaching_insight":{"observation":"honest pattern from their data","recommendation":"one concrete change","this_week":"single most impactful action"},"performance_forecast":{"gci_projection":"$X projected this month","deals_likely_to_close":"1-2","biggest_risk_to_target":"what could prevent hitting goal","momentum":"rising"}}`);

  return {...part1,...part2};
}

// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SANITIZER
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeResponse(text){
  if(!text) return text;
  const jsonBlock=text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if(jsonBlock){
    try{
      const p=JSON.parse(jsonBlock[1]);
      return p.content||p.text||p.message||p.body||p.response||p.post||Object.values(p).find(v=>typeof v==="string"&&v.length>50)||jsonBlock[1].trim();
    }catch{ return jsonBlock[1].trim(); }
  }
  let clean=text.replace(/```(?:json|javascript|js|text)?\n?/g,"").replace(/```/g,"");
  const trimmed=clean.trim();
  if(trimmed.startsWith("{")||trimmed.startsWith("[")){
    try{
      const p=JSON.parse(trimmed);
      if(typeof p==="object"){
        const r=p.content||p.text||p.message||p.body||p.response||p.post||Object.values(p).find(v=>typeof v==="string"&&v.length>50);
        if(r) return r;
      }
    }catch{}
  }
  return clean.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
function APCard({ children, accent=C.indigo, style={} }){
  return(
    <div style={{background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
      border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 16px",
      marginBottom:12,position:"relative",overflow:"hidden",...style}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${accent}50,transparent)`}}/>
      {children}
    </div>
  );
}

function APLabel({ children, color=C.indigo }){
  return(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
      <div style={{width:3,height:13,borderRadius:2,
        background:`linear-gradient(180deg,${color},${color}60)`,
        boxShadow:`0 0 7px ${color}80`}}/>
      <span style={{fontSize:9,color,fontFamily:C.F,fontWeight:700,letterSpacing:2.2}}>
        {children}
      </span>
    </div>
  );
}

function APCopyBtn({ text }){
  const [ok,setOk]=useState(false);
  return(
    <button onClick={e=>{ e.stopPropagation();
      navigator.clipboard.writeText(text||"").then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,
        color:ok?C.emerald:C.textDim,borderRadius:6,padding:"3px 9px",
        cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,
        letterSpacing:1,transition:"all .14s",flexShrink:0}}>
      {ok?"✓":"COPY"}
    </button>
  );
}

function UrgencyBadge({ urgency }){
  const m={critical:{color:C.rose,label:"CRITICAL"},high:{color:C.amber,label:"HIGH"},medium:{color:C.indigo,label:"MEDIUM"},low:{color:C.textDim,label:"LOW"}}[urgency?.toLowerCase()]||{color:C.indigo,label:"MEDIUM"};
  return <span style={{fontSize:8,color:m.color,fontFamily:C.F,fontWeight:700,background:`${m.color}12`,border:`1px solid ${m.color}28`,borderRadius:8,padding:"2px 7px",letterSpacing:1,flexShrink:0}}>{m.label}</span>;
}

function HealthBadge({ health }){
  const m={strong:{color:C.emerald,icon:"↑",label:"STRONG"},stable:{color:C.cyan,icon:"→",label:"STABLE"},at_risk:{color:C.amber,icon:"↓",label:"AT RISK"},critical:{color:C.rose,icon:"!",label:"CRITICAL"}}[health]||{color:C.cyan,icon:"→",label:"STABLE"};
  return(
    <div style={{display:"flex",alignItems:"center",gap:5,background:`${m.color}10`,border:`1px solid ${m.color}25`,borderRadius:8,padding:"4px 10px"}}>
      <span style={{color:m.color,fontWeight:800,fontSize:12}}>{m.icon}</span>
      <span style={{fontSize:9,color:m.color,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>{m.label}</span>
    </div>
  );
}

function ScoreRing({ score }){
  const color=score>=80?C.emerald:score>=60?C.amber:C.rose;
  const r=16,circ=2*Math.PI*r,dash=(score/100)*circ;
  return(
    <svg width="40" height="40" viewBox="0 0 40 40" style={{flexShrink:0}}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="3"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 20 20)"/>
      <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="800"
        fontFamily="'Plus Jakarta Sans',sans-serif" fill={color}>{score}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPILOT INTELLIGENCE SECTIONS
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// SITUATION ROOM — deep-dive workspace for critical deal risks
// ─────────────────────────────────────────────────────────────────────────────
async function generateSituationRoomBrief(risk, client, deal, voice){
  const ctx = [
    `Agent: ${voice?.name||"Agent"}, ${voice?.brokerage||""}`,
    `Deal: ${risk.deal}`,
    `Risk: ${risk.risk} (severity: ${risk.severity||"high"})`,
    `Recommended action: ${risk.action||""}`,
    client ? `Client: ${client.name}, ${client.type}, stage: ${client.stage}, notes: ${client.notes?.slice(0,100)||"none"}` : "",
    deal   ? `Deal value: $${(parseFloat(deal.value)||0).toLocaleString()}, stage: ${deal.stage||"?"}, probability: ${deal.probability||50}%, close date: ${deal.closeDate||"TBD"}` : "",
  ].filter(Boolean).join("\n");

  const r = await fetch("/api/claude",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      system:"You are SPARK Autopilot, an elite real estate business intelligence AI. Generate a Situation Room brief for a deal at risk. Be specific, tactical, and direct. Return ONLY valid compact JSON.",
      messages:[{role:"user",content:`Generate a Situation Room for this deal risk. Context:\n${ctx}\n\nReturn ONLY this JSON:
{"situation":"2 sentence clear statement of exactly what is at risk and why it matters","urgency":"what happens if agent doesn't act today","scenarios":[{"label":"Best case","outcome":"what happens if handled perfectly","probability":"70%"},{"label":"Most likely","outcome":"most realistic outcome with action","probability":"20%"},{"label":"Worst case","outcome":"what happens with no action","probability":"10%"}],"playbook":[{"step":1,"action":"first thing to do right now","message":"exact word-for-word script or message to send"},{"step":2,"action":"second action","message":"exact message or talking point"},{"step":3,"action":"third action","message":"message or next step"}],"key_intel":"the single most important thing to know going into this situation","winning_move":"the one action that changes the outcome most in agent's favor"}`}],
      max_tokens:1500,
    })
  });
  const d = await r.json();
  const raw = d.content?.[0]?.text||"";
  for(const attempt of [
    ()=>JSON.parse(raw.trim()),
    ()=>{ const f=raw.indexOf("{"),l=raw.lastIndexOf("}"); if(f!==-1&&l>f) return JSON.parse(raw.slice(f,l+1)); throw new Error("no"); },
  ]){
    try{ return attempt(); }catch{}
  }
  throw new Error("parse failed");
}

function SituationRoom({ risk, apResult, voice, onClose, onDiscuss }){
  const [brief,    setBrief]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  // Find matching client and deal from localStorage
  const clients  = lsGet("spark_clients_v1",[]);
  const deals    = lsGet("spark_pipeline_value_v1",[]);
  const dealName = risk.deal?.toLowerCase()||"";
  const client   = clients.find(c=>dealName.includes(c.name?.toLowerCase()?.split(" ")[0])||c.name?.toLowerCase()?.includes(dealName.split(" ")[0]));
  const deal     = deals.find(d=>d.name?.toLowerCase()?.includes(dealName.split(" ")[0])||dealName.includes(d.name?.toLowerCase()?.split(" ")[0]));

  useEffect(()=>{
    generateSituationRoomBrief(risk, client, deal, voice)
      .then(b=>{ setBrief(b); setLoading(false); })
      .catch(e=>{ setError("Failed to generate brief — try again."); setLoading(false); });
  },[]);

  const sevColor = risk.severity==="high"?C.rose:C.amber;

  return(
    <div style={{animation:"fadeUp .3s ease"}}>

      {/* Header */}
      <div style={{background:`linear-gradient(135deg,${sevColor}10,${C.surface})`,
        border:`1px solid ${sevColor}30`,borderRadius:16,
        padding:"18px 18px",marginBottom:14,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:2,
          background:`linear-gradient(90deg,${sevColor},${sevColor}60,transparent)`}}/>

        <div style={{display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:40,height:40,borderRadius:11,flexShrink:0,
              background:`linear-gradient(135deg,${sevColor},${sevColor}80)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,boxShadow:`0 4px 14px ${sevColor}30`}}>⚠️</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                <span style={{fontSize:9,color:sevColor,fontFamily:C.F,fontWeight:700,
                  background:`${sevColor}14`,border:`1px solid ${sevColor}28`,
                  borderRadius:8,padding:"1px 8px",letterSpacing:1}}>
                  SITUATION ROOM
                </span>
                <span style={{fontSize:9,color:sevColor,fontFamily:C.F,fontWeight:700,
                  letterSpacing:1}}>
                  {risk.severity?.toUpperCase()||"HIGH"} SEVERITY
                </span>
              </div>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:16,color:C.text,
                letterSpacing:"-0.01em"}}>{risk.deal}</div>
            </div>
          </div>
          <button onClick={onClose}
            style={{background:"transparent",border:`1px solid ${C.border}`,
              color:C.textDim,borderRadius:8,width:32,height:32,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:13}}>
            ✕
          </button>
        </div>

        <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.6,
          fontWeight:600}}>{risk.risk}</p>
      </div>

      {/* Loading */}
      {loading&&(
        <APCard accent={sevColor}>
          <div style={{textAlign:"center",padding:"28px 0"}}>
            <div style={{display:"flex",justifyContent:"center",gap:7,marginBottom:14}}>
              {[0,1,2,3].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",
                background:sevColor,opacity:.6,animation:`pulse 1.1s ease ${i*.14}s infinite`}}/>)}
            </div>
            <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,margin:"0 0 4px"}}>
              Analyzing situation...
            </p>
            <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:0}}>
              Building scenarios, playbook, and winning strategy
            </p>
          </div>
        </APCard>
      )}

      {error&&<div style={{background:"rgba(244,63,94,.07)",border:"1px solid rgba(244,63,94,.2)",borderRadius:10,padding:"12px 14px",fontFamily:C.F,fontSize:12,color:C.rose}}>{error}</div>}

      {brief&&!loading&&(
        <div>
          {/* Situation + urgency */}
          <APCard accent={sevColor}>
            <APLabel color={sevColor}>THE SITUATION</APLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:"0 0 12px",
              lineHeight:1.7,fontWeight:600}}>{brief.situation}</p>
            {brief.urgency&&(
              <div style={{background:`${sevColor}08`,border:`1px solid ${sevColor}20`,
                borderRadius:9,padding:"10px 13px",display:"flex",gap:8,alignItems:"flex-start"}}>
                <span style={{fontSize:14,flexShrink:0}}>⏱️</span>
                <div>
                  <div style={{fontSize:8,color:sevColor,fontFamily:C.F,fontWeight:700,
                    letterSpacing:1.5,marginBottom:3}}>IF YOU DON'T ACT TODAY</div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.5}}>
                    {brief.urgency}
                  </p>
                </div>
              </div>
            )}
          </APCard>

          {/* Key intel */}
          {brief.key_intel&&(
            <APCard accent={C.amber}>
              <APLabel color={C.amber}>KEY INTELLIGENCE</APLabel>
              <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,
                lineHeight:1.7,fontWeight:600}}>{brief.key_intel}</p>
            </APCard>
          )}

          {/* Scenarios */}
          {brief.scenarios?.length>0&&(
            <APCard accent={C.indigo}>
              <APLabel color={C.indigo}>SCENARIO ANALYSIS</APLabel>
              <div style={{display:"flex",flexDirection:"column",gap:9}}>
                {brief.scenarios.map((s,i)=>{
                  const sc=[C.emerald,C.cyan,C.rose][i]||C.indigo;
                  return(
                    <div key={i} style={{background:`${sc}06`,border:`1px solid ${sc}20`,
                      borderRadius:10,padding:"11px 13px"}}>
                      <div style={{display:"flex",alignItems:"center",
                        justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontFamily:C.F,fontWeight:700,fontSize:12,
                          color:sc}}>{s.label}</span>
                        <span style={{fontSize:9,color:C.textDim,fontFamily:C.F,
                          fontWeight:700,background:"rgba(255,255,255,.04)",
                          borderRadius:8,padding:"2px 8px"}}>{s.probability}</span>
                      </div>
                      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,
                        margin:0,lineHeight:1.5}}>{s.outcome}</p>
                    </div>
                  );
                })}
              </div>
            </APCard>
          )}

          {/* Playbook */}
          {brief.playbook?.length>0&&(
            <APCard accent={C.violet}>
              <APLabel color={C.violet}>SITUATION PLAYBOOK</APLabel>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {brief.playbook.map((step,i)=>(
                  <div key={i} style={{animation:`slideR .22s ease ${i*.07}s both`}}>
                    <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
                      <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,
                        background:`${C.violet}18`,border:`1px solid ${C.violet}28`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10,color:C.violet,fontWeight:800}}>{step.step}</div>
                      <span style={{fontFamily:C.F,fontWeight:700,fontSize:13,
                        color:C.text}}>{step.action}</span>
                    </div>
                    {step.message&&(
                      <div style={{background:"rgba(255,255,255,.025)",
                        border:`1px solid ${C.border}`,borderRadius:9,
                        padding:"10px 12px",marginLeft:31}}>
                        <div style={{display:"flex",justifyContent:"space-between",
                          alignItems:"center",marginBottom:6}}>
                          <span style={{fontSize:8,color:C.violet,fontFamily:C.F,
                            fontWeight:700,letterSpacing:1.5}}>SCRIPT / MESSAGE</span>
                          <APCopyBtn text={step.message}/>
                        </div>
                        <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,
                          margin:0,lineHeight:1.65,whiteSpace:"pre-wrap"}}>
                          {step.message}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </APCard>
          )}

          {/* Winning move */}
          {brief.winning_move&&(
            <APCard accent={C.emerald} style={{background:`linear-gradient(135deg,rgba(16,185,129,.07),rgba(99,102,241,.04))`}}>
              <APLabel color={C.emerald}>THE WINNING MOVE</APLabel>
              <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,
                margin:"0 0 14px",lineHeight:1.6}}>{brief.winning_move}</p>
              <button onClick={()=>onDiscuss(`I'm in a Situation Room for "${risk.deal}". The risk: "${risk.risk}". The winning move according to Autopilot: "${brief.winning_move}". Help me execute this right now with the exact words to say.`)}
                style={{width:"100%",background:`linear-gradient(135deg,${C.emerald},${C.indigo})`,
                  border:"none",color:"#fff",borderRadius:10,padding:"12px 0",
                  cursor:"pointer",fontFamily:C.F,fontWeight:800,fontSize:13,
                  boxShadow:`0 4px 16px ${C.emerald}28`,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <span>⚡</span> Execute winning move with SPARK
              </button>
            </APCard>
          )}
        </div>
      )}
    </div>
  );
}

function MissionSection({ mission, runTime, onDiscuss }){
  if(!mission) return null;
  const uc={critical:C.rose,high:C.amber,medium:C.indigo};
  return(
    <div>
      <APCard accent={C.emerald} style={{background:`linear-gradient(135deg,rgba(16,185,129,.08),rgba(99,102,241,.04))`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
            background:`linear-gradient(135deg,${C.emerald},${C.indigo})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:20,boxShadow:`0 4px 16px rgba(16,185,129,.3)`}}>🎯</div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:C.emerald,letterSpacing:2.5,fontFamily:C.F,fontWeight:700,marginBottom:6}}>TODAY'S MISSION</div>
            <p style={{fontFamily:C.F,fontWeight:800,fontSize:16,color:C.text,margin:"0 0 8px",lineHeight:1.3,letterSpacing:"-0.01em"}}>{mission.headline}</p>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.6}}>{mission.why}</p>
          </div>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
          {runTime&&<div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>Last run: {new Date(runTime).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}</div>}
          <button onClick={()=>onDiscuss(`My Autopilot mission for today is: "${mission.headline}". ${mission.why} Help me execute this.`)}
            style={{background:`${C.emerald}12`,border:`1px solid ${C.emerald}24`,color:C.emerald,borderRadius:8,padding:"5px 12px",cursor:"pointer",fontSize:10,fontFamily:C.F,fontWeight:700}}>
            Discuss with SPARK →
          </button>
        </div>
      </APCard>

      <APCard accent={C.indigo}>
        <APLabel color={C.indigo}>PRIORITY ACTION QUEUE</APLabel>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {(mission.top3||[]).map((item,i)=>(
            <div key={i} style={{background:`${uc[item.urgency?.toLowerCase()]||C.indigo}06`,border:`1px solid ${uc[item.urgency?.toLowerCase()]||C.indigo}20`,borderRadius:11,padding:"13px 14px",animation:`slideR .25s ease ${i*.08}s both`}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:`${uc[item.urgency?.toLowerCase()]||C.indigo}18`,border:`1px solid ${uc[item.urgency?.toLowerCase()]||C.indigo}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:uc[item.urgency?.toLowerCase()]||C.indigo,fontWeight:800,flexShrink:0}}>{item.rank}</div>
                  <div>
                    <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text}}>{item.action}</div>
                    {item.client&&<div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>{item.client}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <UrgencyBadge urgency={item.urgency}/>
                  <button onClick={()=>onDiscuss(`Help me with priority #${item.rank}: "${item.action}" for ${item.client||"my pipeline"}. ${item.message?"Draft message: "+item.message:""}`)}
                    style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:C.F}}>Chat →</button>
                </div>
              </div>
              {item.message&&(
                <div style={{background:"rgba(255,255,255,.025)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:8,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>MESSAGE TO SEND</span>
                    <APCopyBtn text={item.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{item.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </APCard>
    </div>
  );
}

function DealIntelligence({ di, onDiscuss, onSituationRoom }){
  if(!di) return null;
  return(
    <div>
      <APCard accent={C.violet}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <APLabel color={C.violet}>DEAL INTELLIGENCE</APLabel>
          <HealthBadge health={di.overall_health}/>
        </div>
        <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7}}>{di.health_summary}</p>
      </APCard>
      {di.risks?.length>0&&(
        <APCard accent={C.rose}>
          <APLabel color={C.rose}>DEAL RISKS DETECTED</APLabel>
          {di.risks.map((risk,i)=>(
            <div key={i} style={{marginBottom:i<di.risks.length-1?14:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:risk.severity==="high"?C.rose:C.amber,boxShadow:`0 0 5px ${risk.severity==="high"?C.rose:C.amber}`,flexShrink:0}}/>
                <div style={{flex:1}}>
                  <span style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>{risk.deal}</span>
                  <span style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginLeft:8}}>— {risk.risk}</span>
                </div>
                <div style={{display:"flex",gap:5,flexShrink:0}}>
                  {risk.severity==="high"&&(
                    <button onClick={()=>onSituationRoom(risk)}
                      style={{background:`linear-gradient(135deg,${C.rose},rgba(244,63,94,.7))`,
                        border:"none",color:"#fff",borderRadius:6,padding:"3px 9px",
                        cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700}}>
                      Situation Room →
                    </button>
                  )}
                  <button onClick={()=>onDiscuss(`Autopilot detected a risk with ${risk.deal}: "${risk.risk}". Action needed: ${risk.action}. Help me handle this right now.`)}
                    style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:C.F}}>Chat →</button>
                </div>
              </div>
              {risk.message&&(
                <div style={{background:"rgba(244,63,94,.04)",border:"1px solid rgba(244,63,94,.14)",borderRadius:8,padding:"9px 11px",marginLeft:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:8,color:C.rose,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>RECOVERY MESSAGE</span>
                    <APCopyBtn text={risk.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.6}}>{risk.message}</p>
                </div>
              )}
            </div>
          ))}
        </APCard>
      )}
      {di.opportunities?.length>0&&(
        <APCard accent={C.emerald}>
          <APLabel color={C.emerald}>OPPORTUNITIES</APLabel>
          {di.opportunities.map((opp,i)=>(
            <div key={i} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:i<di.opportunities.length-1?`1px solid ${C.border}`:"none"}}>
              <div style={{width:16,height:16,borderRadius:"50%",flexShrink:0,background:`${C.emerald}14`,border:`1px solid ${C.emerald}24`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:C.emerald,fontWeight:800}}>✦</div>
              <div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.text,margin:"0 0 3px",fontWeight:600}}>{opp.description}</p>
                <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:0,lineHeight:1.5}}>{opp.action}</p>
              </div>
            </div>
          ))}
        </APCard>
      )}
    </div>
  );
}

function ClientScores({ scores, onDiscuss }){
  if(!scores?.length) return null;
  const ti=t=>t==="rising"?"↑":t==="falling"?"↓":"→";
  const tc=t=>t==="rising"?C.emerald:t==="falling"?C.rose:C.textDim;
  return(
    <APCard accent={C.cyan}>
      <APLabel color={C.cyan}>CLIENT PROBABILITY SCORES</APLabel>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {scores.slice(0,6).map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,borderRadius:10,padding:"11px 13px",animation:`slideR .22s ease ${i*.05}s both`}}>
            <ScoreRing score={c.score||50}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                <span style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text}}>{c.name}</span>
                <span style={{fontSize:11,color:tc(c.trend),fontWeight:700}}>{ti(c.trend)}</span>
                {c.probability&&<span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>{c.probability} likely</span>}
              </div>
              <p style={{fontFamily:C.F,fontSize:10,color:C.textDim,margin:"0 0 5px",lineHeight:1.4}}>{c.reason}</p>
              {c.next_action&&<div style={{fontSize:10,color:C.indigoLt,fontFamily:C.F,fontWeight:600}}>→ {c.next_action}</div>}
            </div>
            <button onClick={()=>onDiscuss(`Help me with ${c.name}. Their probability score is ${c.score}/100 (${c.trend}). Reason: ${c.reason}. Next action: ${c.next_action}. What's the best move right now?`)}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:9,fontFamily:C.F,flexShrink:0}}>Chat →</button>
          </div>
        ))}
      </div>
    </APCard>
  );
}

function RelationshipAlerts({ alerts, onDiscuss }){
  if(!alerts?.length) return null;
  const tm={overdue:{icon:"⚠️",color:C.rose,label:"OVERDUE"},referral_window:{icon:"🤝",color:C.amber,label:"REFERRAL WINDOW"},anniversary:{icon:"🎉",color:C.emerald,label:"ANNIVERSARY"},re_engage:{icon:"💬",color:C.indigo,label:"RE-ENGAGE"}};
  return(
    <APCard accent={C.amber}>
      <APLabel color={C.amber}>RELATIONSHIP ALERTS</APLabel>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {alerts.map((alert,i)=>{
          const t=tm[alert.type]||tm.re_engage;
          return(
            <div key={i} style={{background:`${t.color}06`,border:`1px solid ${t.color}20`,borderRadius:10,padding:"12px 13px",animation:`fadeUp .25s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:14}}>{t.icon}</span>
                <span style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>{alert.client}</span>
                <span style={{fontSize:9,color:t.color,fontWeight:700,letterSpacing:1,background:`${t.color}14`,border:`1px solid ${t.color}24`,borderRadius:6,padding:"1px 6px"}}>{t.label}</span>
                <button onClick={()=>onDiscuss(`I need to reach out to ${alert.client}. ${alert.reason}. Draft: ${alert.message||"?"}`)}
                  style={{marginLeft:"auto",background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"2px 8px",cursor:"pointer",fontSize:9,fontFamily:C.F,flexShrink:0}}>Chat →</button>
              </div>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:"0 0 10px",lineHeight:1.5}}>{alert.reason}</p>
              {alert.message&&(
                <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:8,color:t.color,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>PERSONAL MESSAGE</span>
                    <APCopyBtn text={alert.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.65}}>{alert.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </APCard>
  );
}

function MarketCoachingForecast({ market, coaching, forecast, onDiscuss }){
  const mc=forecast?.momentum==="rising"?C.emerald:forecast?.momentum==="declining"?C.rose:C.cyan;
  return(
    <div>
      {market&&(
        <APCard accent={C.cyan}>
          <APLabel color={C.cyan}>MARKET INTELLIGENCE</APLabel>
          <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:"0 0 12px",lineHeight:1.7}}>{market.insight}</p>
          {market.opportunity&&<div style={{background:`${C.emerald}08`,border:`1px solid ${C.emerald}18`,borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700,letterSpacing:1.5,marginBottom:4}}>CAPITALIZE NOW</div>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.6}}>{market.opportunity}</p>
          </div>}
          {market.talking_point&&<div style={{background:`${C.amber}06`,border:`1px solid ${C.amber}18`,borderRadius:8,padding:"10px 12px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <span style={{fontSize:8,color:C.amber,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>THIS WEEK'S TALKING POINT</span>
              <APCopyBtn text={market.talking_point}/>
            </div>
            <p style={{fontFamily:C.F,fontSize:12,fontWeight:600,color:C.text,margin:0,lineHeight:1.6,fontStyle:"italic"}}>"{market.talking_point}"</p>
          </div>}
        </APCard>
      )}
      {forecast&&(
        <APCard accent={mc}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <APLabel color={mc}>PERFORMANCE FORECAST</APLabel>
            <span style={{fontSize:9,color:mc,fontFamily:C.F,fontWeight:700,background:`${mc}12`,border:`1px solid ${mc}24`,borderRadius:8,padding:"2px 8px",letterSpacing:1}}>{forecast.momentum?.toUpperCase()||"STABLE"}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {[{label:"GCI PROJECTION",value:forecast.gci_projection,color:C.emerald},{label:"DEALS LIKELY CLOSE",value:forecast.deals_likely_to_close,color:C.indigo}].map((m,i)=>(
              <div key={i} style={{background:`${m.color}08`,border:`1px solid ${m.color}18`,borderRadius:9,padding:"10px 11px",textAlign:"center"}}>
                <div style={{fontSize:8,color:m.color,fontFamily:C.F,fontWeight:700,letterSpacing:1.5,marginBottom:4}}>{m.label}</div>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:15,color:C.text}}>{m.value}</div>
              </div>
            ))}
          </div>
          {forecast.biggest_risk_to_target&&<div style={{background:"rgba(244,63,94,.05)",border:"1px solid rgba(244,63,94,.14)",borderRadius:8,padding:"9px 11px"}}>
            <span style={{fontSize:8,color:C.rose,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>BIGGEST RISK: </span>
            <span style={{fontFamily:C.F,fontSize:11,color:C.textMd}}>{forecast.biggest_risk_to_target}</span>
          </div>}
        </APCard>
      )}
      {coaching&&(
        <APCard accent={C.violet}>
          <APLabel color={C.violet}>AUTOPILOT COACHING</APLabel>
          <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:"0 0 12px",lineHeight:1.75}}>{coaching.observation}</p>
          <div style={{background:`${C.violet}08`,border:`1px solid ${C.violet}18`,borderRadius:9,padding:"11px 13px",marginBottom:10}}>
            <div style={{fontSize:8,color:C.violet,fontFamily:C.F,fontWeight:700,letterSpacing:1.5,marginBottom:5}}>RECOMMENDATION</div>
            <p style={{fontFamily:C.F,fontSize:12,fontWeight:600,color:C.text,margin:0,lineHeight:1.6}}>{coaching.recommendation}</p>
          </div>
          {coaching.this_week&&<div style={{background:`${C.emerald}08`,border:`1px solid ${C.emerald}18`,borderRadius:9,padding:"11px 13px"}}>
            <div style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700,letterSpacing:1.5,marginBottom:5}}>DO THIS WEEK</div>
            <p style={{fontFamily:C.F,fontSize:12,fontWeight:700,color:C.text,margin:0,lineHeight:1.6}}>{coaching.this_week}</p>
          </div>}
          <button onClick={()=>onDiscuss(`Autopilot coaching insight: "${coaching.observation}". Recommendation: "${coaching.recommendation}". This week: "${coaching.this_week}". Let's talk through how I implement this.`)}
            style={{marginTop:12,background:`${C.violet}10`,border:`1px solid ${C.violet}24`,color:C.violet,borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:10,fontFamily:C.F,fontWeight:700,width:"100%"}}>
            Discuss this coaching insight →
          </button>
        </APCard>
      )}
    </div>
  );
}

function RunHistory({ runs, memory, conversations }){
  if(!runs?.length&&!memory?.coaching_history?.length&&!conversations?.length) return null;
  const hc={strong:C.emerald,stable:C.cyan,at_risk:C.amber,critical:C.rose};
  return(
    <div>
      {/* Conversation memory */}
      {conversations?.length>0&&(
        <APCard accent={C.emerald}>
          <APLabel color={C.emerald}>CONVERSATION MEMORY ({conversations.length} sessions)</APLabel>
          <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:"0 0 12px",lineHeight:1.5}}>
            SPARK remembers every conversation. This context is injected into every new session automatically.
          </p>
          {conversations.slice(0,5).map((c,i)=>{
            const date=new Date(c.created_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
            return(
              <div key={i} style={{background:`${C.emerald}06`,border:`1px solid ${C.emerald}18`,borderRadius:9,padding:"11px 13px",marginBottom:8,animation:`slideR .22s ease ${i*.05}s both`}}>
                <div style={{fontSize:9,color:C.emerald,fontFamily:C.F,fontWeight:700,marginBottom:6,letterSpacing:1}}>{date}</div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 8px",lineHeight:1.6}}>{c.summary}</p>
                {c.key_decisions?.length>0&&(
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:4}}>
                    {c.key_decisions.slice(0,3).map((d,j)=>(
                      <span key={j} style={{fontSize:9,color:C.indigoLt,fontFamily:C.F,fontWeight:600,background:`${C.indigo}10`,border:`1px solid ${C.indigo}20`,borderRadius:8,padding:"2px 8px"}}>
                        ✓ {d}
                      </span>
                    ))}
                  </div>
                )}
                {c.clients_discussed?.length>0&&(
                  <div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
                    Discussed: {c.clients_discussed.join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </APCard>
      )}

      {/* Coaching pattern memory */}
      {memory?.coaching_history?.length>0&&(
        <APCard accent={C.violet}>
          <APLabel color={C.violet}>PATTERN MEMORY ({memory.coaching_history.length} runs)</APLabel>
          {memory.coaching_history.slice(0,4).map((h,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px",marginBottom:8}}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginBottom:5}}>{h.date}</div>
              <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 6px",lineHeight:1.5}}>{h.observation}</p>
              {h.recommendation&&<p style={{fontFamily:C.F,fontSize:11,color:C.violet,margin:0,lineHeight:1.5,fontWeight:600}}>→ {h.recommendation}</p>}
            </div>
          ))}
        </APCard>
      )}

      {/* Run history */}
      {runs.length>0&&(
        <APCard accent={C.indigo}>
          <APLabel color={C.indigo}>RUN HISTORY ({runs.length})</APLabel>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {runs.map((run,i)=>{
              const hColor=hc[run.overall_health]||C.textDim;
              return(
                <div key={run.id} style={{display:"flex",alignItems:"center",gap:10,background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 12px"}}>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:C.F,fontSize:12,color:C.text,fontWeight:600}}>{new Date(run.run_at).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</div>
                    <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:2}}>{run.client_count} clients · {run.deal_count} deals</div>
                  </div>
                  <span style={{fontSize:9,color:hColor,fontFamily:C.F,fontWeight:700,background:`${hColor}12`,border:`1px solid ${hColor}24`,borderRadius:8,padding:"2px 8px",letterSpacing:1}}>{run.overall_health?.replace("_"," ").toUpperCase()||"STABLE"}</span>
                </div>
              );
            })}
          </div>
        </APCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CHAT MESSAGE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function ChatMessage({ msg, onRegenerate, onSaveNote }){
  const [copied,setCopied]=useState(false);
  const [showActions,setShowActions]=useState(false);
  const isUser=msg.role==="user";
  const formattedContent = msg.content.replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>");

  function copyText(){
    navigator.clipboard.writeText(msg.content).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});
  }

  return(
    <div style={{display:"flex",gap:9,marginBottom:16,alignItems:"flex-start",
      flexDirection:isUser?"row-reverse":"row"}}
      onMouseEnter={()=>setShowActions(true)}
      onMouseLeave={()=>setShowActions(false)}>
      <div style={{width:28,height:28,borderRadius:"50%",
        background:isUser?`linear-gradient(135deg,${C.indigo},${C.violet})`:`linear-gradient(135deg,${C.emerald},${C.cyan})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:800,color:"#fff",flexShrink:0,marginTop:2}}>
        {isUser?"Y":"S"}
      </div>
      <div style={{maxWidth:"82%",position:"relative"}}>
        <div style={{background:isUser?`linear-gradient(135deg,${C.indigo}22,${C.violet}14)`:`${C.surface}`,
          border:`1px solid ${isUser?C.indigo+"30":C.border}`,
          borderRadius:isUser?"14px 4px 14px 14px":"4px 14px 14px 14px",
          padding:"10px 13px"}}>
          <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,lineHeight:1.75,
            whiteSpace:"pre-wrap"}}
            dangerouslySetInnerHTML={{__html:formattedContent}}/>
          {msg.streaming&&(
            <span style={{display:"inline-block",width:8,height:14,background:C.indigoLt,
              marginLeft:2,borderRadius:1,animation:"pulse .7s ease infinite"}}/>
          )}
        </div>
        <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:4,
          textAlign:isUser?"right":"left"}}>
          {msg.timestamp?new Date(msg.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):""}
        </div>
        {!isUser&&!msg.streaming&&showActions&&(
          <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
            {[{label:copied?"✓ Copied":"Copy",fn:copyText},{label:"Save note",fn:()=>onSaveNote(msg.content)},{label:"Regenerate",fn:onRegenerate}].map((a,i)=>(
              <button key={i} onClick={a.fn}
                style={{background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,
                  color:C.textDim,borderRadius:8,padding:"3px 9px",cursor:"pointer",
                  fontSize:9,fontFamily:C.F,fontWeight:600,transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.indigoLt;e.currentTarget.style.borderColor="rgba(99,102,241,.28)";}}
                onMouseLeave={e=>{e.currentTarget.style.color=C.textDim;e.currentTarget.style.borderColor=C.border;}}>
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator(){
  return(
    <div style={{display:"flex",gap:9,marginBottom:16,alignItems:"flex-start"}}>
      <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.emerald},${C.cyan})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>S</div>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"4px 14px 14px 14px",padding:"13px 15px",display:"flex",gap:5,alignItems:"center"}}>
        {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.indigoLt,animation:`pulse .9s ease ${i*.18}s infinite`}}/>)}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN UNIFIED COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function AutopilotPanel({ user, voice, planKey, onNavigate }){
  // Autopilot state
  const [apResult,    setApResult]    = useState(()=>lsGet(AP_KEY,null));
  const [apRunning,   setApRunning]   = useState(false);
  const [apError,     setApError]     = useState(null);
  const [lastRun,     setLastRun]     = useState(()=>lsGet(RUN_KEY,null));
  const [runHistory,  setRunHistory]  = useState([]);
  const [syncing,     setSyncing]     = useState(false);
  const [dbMemory,    setDbMemory]    = useState(null);
  const [apTab,        setApTab]        = useState("mission");
  const [situationRoom,setSituationRoom] = useState(null); // active risk for situation room

  // Chat state
  const [messages,      setMessages]      = useState(()=>lsGet(CHAT_KEY,[]));
  const [input,         setInput]         = useState("");
  const [chatLoading,   setChatLoading]   = useState(false);
  const [mode,          setMode]          = useState("write");
  const [briefObj,      setBriefObj]      = useState(()=>buildOpeningBriefing(voice,apResult));
  const [briefLoading,  setBriefLoading]  = useState(false);
  const [googleData,    setGoogleData]    = useState(null);
  const [conversations, setConversations] = useState(()=>lsGet(CONV_KEY,[]));
  const [summarizing,   setSummarizing]   = useState(false);

  // Voice state
  const [voiceActive,   setVoiceActive]   = useState(false); // mic is listening
  const [voiceEnabled,  setVoiceEnabled]  = useState(false); // voice output toggled on
  const [voiceSupported,setVoiceSupported]= useState(false); // browser supports it
  const [transcript,    setTranscript]    = useState("");    // live transcript while speaking
  const recognitionRef  = useRef(null);
  const synthRef        = useRef(window.speechSynthesis);
  const [showChat,    setShowChat]    = useState(false);

  // View state — "intelligence" or "chat"
  const [view,        setView]        = useState("intelligence");

  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const abortRef       = useRef(null);

  // Check voice support on mount
  useEffect(()=>{
    const supported = "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
    setVoiceSupported(supported);
    // Load saved voice output preference
    setVoiceEnabled(lsGet("spark_voice_output", false));
  },[]);

  // Voice input — start/stop mic
  function toggleVoice(){
    if(voiceActive){
      stopVoice();
    } else {
      startVoice();
    }
  }

  function startVoice(){
    if(!voiceSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = "en-US";

    recognition.onstart = ()=>{ setVoiceActive(true); setTranscript(""); };

    recognition.onresult = (e)=>{
      let interim = "";
      let final   = "";
      for(let i=e.resultIndex; i<e.results.length; i++){
        if(e.results[i].isFinal) final   += e.results[i][0].transcript;
        else                     interim += e.results[i][0].transcript;
      }
      const combined = (input + final).trim();
      if(final) setInput(combined);
      setTranscript(interim);
    };

    recognition.onend = ()=>{
      setVoiceActive(false);
      setTranscript("");
      // Auto-send if we have content
      const current = document.querySelector("textarea[data-voice]")?.value||"";
    };

    recognition.onerror = (e)=>{
      console.warn("Speech recognition error:", e.error);
      setVoiceActive(false);
      setTranscript("");
    };

    recognition.start();
  }

  function stopVoice(){
    recognitionRef.current?.stop();
    setVoiceActive(false);
    setTranscript("");
  }

  // Voice output — speak SPARK's response
  function speakResponse(text){
    if(!voiceEnabled || !window.speechSynthesis) return;
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Strip markdown and clean text for speech
    const clean = text
      .replace(/\*\*(.*?)\*\*/g,"$1")
      .replace(/\*(.*?)\*/g,"$1")
      .replace(/#{1,6}\s/g,"")
      .replace(/\n\n/g,". ")
      .replace(/\n/g,", ")
      .replace(/→/g,"")
      .slice(0,800); // cap at ~800 chars for reasonable length

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate   = 0.95;
    utterance.pitch  = 1.0;
    utterance.volume = 1.0;

    // Prefer a natural-sounding voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v=>
      v.name.includes("Samantha")||    // macOS
      v.name.includes("Google US English")||
      v.name.includes("Microsoft Aria")||
      v.name.includes("Alex")
    );
    if(preferred) utterance.voice = preferred;

    window.speechSynthesis.speak(utterance);
  }

  function toggleVoiceOutput(){
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    lsSet("spark_voice_output", next);
    if(!next) window.speechSynthesis?.cancel();
  }

  // Cleanup on unmount
  useEffect(()=>{
    return ()=>{
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  },[]);

  const isPremium     = planKey==="premium";
  const data          = aggregateBusinessData(voice);
  const hasEnoughData = data.totalClients>0||data.totalDeals>0;
  const memory        = lsGet(MEMORY_KEY,{});
  const totalRuns     = dbMemory?.run_count||memory.runCount||0;

  // Persist chat
  useEffect(()=>{ lsSet(CHAT_KEY,messages.slice(-60)); },[messages]);

  // Auto-summarize on unmount if conversation was substantial
  useEffect(()=>{
    return ()=>{
      const current = lsGet(CHAT_KEY,[]);
      if(current.length >= 4 && user?.email){
        summarizeConversation(current, user.email);
      }
    };
  },[]);

  // Auto scroll
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,chatLoading]);

  // Mount — load from Supabase, fetch Google, set briefing
  useEffect(()=>{
    if(user?.email){
      loadFromSupabase();
      syncAgentData(user.email);
      loadConversationMemory().then(convs=>{
        // Generate AI brief once conversations are loaded
        if(messages.length===0) triggerDailyBrief(convs);
      });
      if(lsGet("spark_google_connected",false)) fetchGoogleData().then(gd=>{
        // Regenerate brief with Google context if we got calendar data
        if(messages.length===0 && gd?.events?.length) triggerDailyBrief(null, gd);
      });
    } else {
      if(messages.length===0) setBriefObj(buildOpeningBriefing(voice,apResult));
    }
  },[]);

  async function loadConversationMemory(){
    const d = await apSync(user.email,"load_conversations");
    if(d?.conversations?.length){
      setConversations(d.conversations);
      lsSet(CONV_KEY, d.conversations);
      return d.conversations;
    }
    return lsGet(CONV_KEY,[]);
  }

  async function triggerDailyBrief(convs, gd){
    setBriefLoading(true);
    const today = new Date().toISOString().slice(0,10);
    const cached = lsGet(DAILY_BRIEF_KEY,null);
    // Skip if already generated today (unless we have better context now)
    if(cached?.date===today && !gd) {
      setBriefObj(cached);
      setBriefLoading(false);
      return;
    }
    const result = await generateDailyBrief(
      voice, apResult, gd||googleData,
      convs||lsGet(CONV_KEY,[])
    );
    setBriefObj(result);
    setBriefLoading(false);
  }

  // Stale auto-run
  useEffect(()=>{
    if(!hasEnoughData||!isPremium) return;
    const stale=!lastRun||(Date.now()-new Date(lastRun))>12*60*60*1000;
    if(stale&&!apResult) runAutopilot();
  },[]);

  async function loadFromSupabase(){
    setSyncing(true);
    const d=await apSync(user.email,"load_latest");
    if(d?.latestRun){
      const dbTime=new Date(d.latestRun.run_at).getTime();
      const lsTime=lastRun?new Date(lastRun).getTime():0;
      if(dbTime>lsTime){
        setApResult(d.latestRun.result);
        setLastRun(d.latestRun.run_at);
        lsSet(AP_KEY,d.latestRun.result);
        lsSet(RUN_KEY,d.latestRun.run_at);
      }
    }
    if(d?.memory){
      setDbMemory(d.memory);
      lsSet(MEMORY_KEY,{runCount:d.memory.run_count||0,patterns:d.memory.patterns||"",lastHealth:d.memory.last_health||""});
    }
    const h=await apSync(user.email,"load_history");
    if(h?.runs) setRunHistory(h.runs);
    setSyncing(false);
  }

  async function fetchGoogleData(){
    try{
      const r=await fetch("/api/google-data",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:user.email,action:"fetch"})});
      const d=await r.json();
      if(d.connected){ setGoogleData(d); lsSet("spark_google_connected",true); return d; }
      else if(d.disconnected){ lsSet("spark_google_connected",false); setGoogleData(null); }
    }catch(e){ console.warn("Google fetch failed:",e); }
    return null;
  }

  async function runAutopilot(){
    if(apRunning) return;
    setApRunning(true);
    setApError(null);
    try{
      const freshData=aggregateBusinessData(voice);
      const analysis=await runAutopilotEngine(freshData);
      const newMemory={runCount:(memory.runCount||0)+1,lastHealth:analysis.deal_intelligence?.overall_health,patterns:analysis.coaching_insight?.observation||memory.patterns,updatedAt:new Date().toISOString()};
      lsSet(MEMORY_KEY,newMemory);
      const now=new Date().toISOString();
      lsSet(AP_KEY,analysis);
      lsSet(RUN_KEY,now);
      setApResult(analysis);
      setLastRun(now);
      setApTab("mission");
      // Regenerate daily brief with new Autopilot context
      lsSet(DAILY_BRIEF_KEY,null);
      triggerDailyBrief(lsGet(CONV_KEY,[]),googleData);
      if(user?.email){
        apSync(user.email,"save_run",{result:analysis,clientCount:freshData.totalClients,dealCount:freshData.totalDeals,overallHealth:analysis.deal_intelligence?.overall_health||"stable",memory:newMemory})
          .then(()=>{
            apSync(user.email,"load_history").then(h=>{ if(h?.runs) setRunHistory(h.runs); });
            syncAgentData(user.email);
          });
      }
    }catch(e){
      console.error("Autopilot error:",e);
      setApError(e.message?.includes("parse_failed")?"Response format error — try running again.":"Analysis failed — check your connection and try again.");
    }
    setApRunning(false);
  }

  // Chat functions
  function discussWithSpark(prompt){
    setView("chat");
    setTimeout(()=>sendMessage(prompt),100);
  }

  function saveNote(text){
    const notes=lsGet(NOTES_KEY,[]);
    lsSet(NOTES_KEY,[{text,savedAt:new Date().toISOString()},...notes].slice(0,50));
  }

  async function clearChat(){
    if(!window.confirm("Clear conversation? SPARK will summarize and remember this session.")) return;
    // Summarize before clearing so memory persists
    if(messages.length >= 4 && user?.email){
      setSummarizing(true);
      const summary = await summarizeConversation(messages, user.email);
      if(summary){
        const updated = lsGet(CONV_KEY,[]);
        setConversations(updated);
      }
      setSummarizing(false);
    }
    setMessages([]);
    setBriefObj(buildOpeningBriefing(voice,apResult));
  }

  function handleKey(e){
    if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(input); }
  }

  function autoResize(e){
    e.target.style.height="44px";
    e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";
  }

  async function sendMessage(content,isRegenerate=false){
    if(!content?.trim()||chatLoading) return;
    if(abortRef.current) abortRef.current.abort();

    const userMsg={role:"user",content:content.trim(),timestamp:Date.now()};
    const baseMessages=isRegenerate?messages.slice(0,-1):[...messages,userMsg];
    if(!isRegenerate) setMessages(baseMessages);
    else setMessages(p=>p.slice(0,-1));

    setInput("");
    setBriefObj(null);
    setChatLoading(true);
    if(textareaRef.current) textareaRef.current.style.height="44px";

    try{
      const history=baseMessages.slice(-30).map(m=>({role:m.role,content:m.content}));
      const r=await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:buildSystem(voice,planKey,apResult,googleData,mode,conversations),
          messages:isRegenerate?history:[...history.slice(0,-1),{role:"user",content:content.trim()}],
        })
      });
      const d=await r.json();
      const raw=d.content?.[0]?.text||"I couldn't generate a response — please try again.";
      const text=sanitizeResponse(raw);

      setChatLoading(false);
      const streamMsg={role:"assistant",content:"",streaming:true,timestamp:Date.now()};
      setMessages(prev=>[...prev,streamMsg]);

      const words=text.split(" ");
      const chunk=Math.max(1,Math.floor(words.length/40));
      let idx=0;
      const interval=setInterval(()=>{
        idx+=chunk;
        const done=idx>=words.length;
        setMessages(prev=>{
          const updated=[...prev];
          updated[updated.length-1]={role:"assistant",content:done?text:words.slice(0,idx).join(" "),streaming:!done,timestamp:Date.now()};
          return updated;
        });
        if(done){
          clearInterval(interval);
          // Speak response if voice output enabled
          if(voiceEnabled) speakResponse(text);
        }
      },28);

    }catch(e){
      setChatLoading(false);
      setMessages(prev=>[...prev,{role:"assistant",content:"Connection error — check your internet and try again.",timestamp:Date.now()}]);
    }
  }

  const smartPrompts = getSmartPrompts(voice,mode,apResult,googleData);
  const hasMessages  = messages.length>0;
  const isGoogle     = !!googleData?.connected;
  const currentMode  = MODES[mode];

  // ── INTELLIGENCE VIEW TABS ──
  const AP_TABS=[
    {id:"mission",  label:"Mission",  icon:"🎯"},
    {id:"deals",    label:"Deals",    icon:"📋"},
    {id:"clients",  label:"Clients",  icon:"👥"},
    {id:"alerts",   label:"Alerts",   icon:"⚡"},
    {id:"market",   label:"Market",   icon:"📈"},
    {id:"coaching", label:"Coaching", icon:"🏆"},
    {id:"history",  label:"History",  icon:"📅",count:runHistory.length},
  ];

  return(
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 170px)",minHeight:500,position:"relative"}}>

      {/* ── TOP HEADER ── */}
      <div style={{flexShrink:0,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
          background:`linear-gradient(135deg,${C.indigo}10,${C.violet}06)`,
          border:`1px solid ${C.indigo}22`,borderRadius:14,
          padding:"12px 16px",position:"relative",overflow:"hidden"}}>
          <div style={{position:"absolute",top:"-30%",right:"-5%",width:140,height:140,borderRadius:"50%",pointerEvents:"none",background:`radial-gradient(circle,${C.indigo}16,transparent 70%)`}}/>

          {/* Identity */}
          <div style={{display:"flex",alignItems:"center",gap:10,position:"relative"}}>
            <div style={{width:38,height:38,borderRadius:10,flexShrink:0,
              background:`linear-gradient(135deg,${C.indigo},${C.violet})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:18,boxShadow:`0 4px 14px ${C.indigo}40`,
              animation:apRunning?"spin 2s linear infinite":"none"}}>🤖</div>
            <div>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:14,color:C.text,
                display:"flex",alignItems:"center",gap:6}}>
                SPARK Autopilot
                {isPremium&&<span style={{fontSize:8,background:`${C.violet}18`,border:`1px solid ${C.violet}30`,color:C.violet,borderRadius:8,padding:"1px 7px",fontWeight:700,letterSpacing:1}}>✦ PREMIUM</span>}
              </div>
              <div style={{fontFamily:C.F,fontSize:9,marginTop:2,display:"flex",alignItems:"center",gap:5,color:apRunning?C.amber:apResult?C.emerald:C.textDim}}>
                <div style={{width:4,height:4,borderRadius:"50%",background:apRunning?C.amber:apResult?C.emerald:C.textDim,animation:apRunning?"pulse 1s ease infinite":"none"}}/>
                {apRunning?"Analyzing your business...":apResult?"Monitoring your business · Always on":"Ready to analyze"}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div style={{display:"flex",gap:6,alignItems:"center",position:"relative"}}>
            {syncing&&<span style={{fontSize:9,color:C.amber,fontFamily:C.F}}>syncing...</span>}
            {isGoogle&&<div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",borderRadius:7,padding:"3px 8px",cursor:"pointer"}} onClick={fetchGoogleData}>
              <div style={{width:4,height:4,borderRadius:"50%",background:C.emerald}}/>
              <span style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700}}>Google</span>
            </div>}
            {isPremium&&<button onClick={runAutopilot} disabled={apRunning||!hasEnoughData}
              style={{background:apRunning||!hasEnoughData?"rgba(255,255,255,.05)":`linear-gradient(135deg,${C.indigo},${C.violet})`,border:"none",color:apRunning||!hasEnoughData?C.textDim:"#fff",borderRadius:9,padding:"7px 14px",cursor:apRunning||!hasEnoughData?"default":"pointer",fontFamily:C.F,fontWeight:700,fontSize:11,boxShadow:apRunning||!hasEnoughData?"none":`0 3px 12px ${C.indigo}30`,transition:"all .2s"}}>
              {apRunning?"Analyzing...":"▶ Run"}
            </button>}
          </div>
        </div>

        {/* Stats bar — Premium only */}
        {isPremium&&totalRuns>0&&(
          <div style={{display:"flex",gap:14,marginTop:8,paddingTop:8,borderBottom:`1px solid ${C.border}`,paddingBottom:8,flexWrap:"wrap",alignItems:"center"}}>
            {[{label:"RUNS",value:totalRuns},{label:"CLIENTS",value:data.totalClients},{label:"DEALS",value:data.totalDeals},{label:"PIPELINE",value:`$${Math.round(data.totalPipeline/1000)}k`}].map((s,i)=>(
              <div key={i}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:13,color:C.text}}>{s.value}</div>
                <div style={{fontSize:7,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1.5}}>{s.label}</div>
              </div>
            ))}
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              {[{id:"intelligence",label:"🤖 Intelligence",disabled:!apResult&&!hasEnoughData},{id:"chat",label:"💬 Chat"}].map(v=>(
                <button key={v.id} onClick={()=>!v.disabled&&setView(v.id)}
                  style={{background:view===v.id?`${C.indigo}14`:"transparent",border:`1px solid ${view===v.id?C.indigo+"44":C.border}`,color:view===v.id?C.indigoLt:C.textDim,borderRadius:8,padding:"4px 12px",cursor:v.disabled?"default":"pointer",fontSize:10,fontFamily:C.F,fontWeight:700,opacity:v.disabled?.4:1,transition:"all .14s"}}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mode selector for non-premium (chat only) or in chat view */}
        {(!isPremium||view==="chat")&&(
          <div style={{display:"flex",gap:5,background:"rgba(255,255,255,.02)",borderRadius:10,padding:3,marginTop:8}}>
            {Object.entries(MODES).map(([key,m])=>(
              <button key={key} onClick={()=>setMode(key)}
                style={{flex:1,padding:"6px 4px",borderRadius:7,
                  border:`1px solid ${mode===key?m.color+"30":"transparent"}`,
                  background:mode===key?`linear-gradient(135deg,${m.color}14,${m.color}06)`:"transparent",
                  color:mode===key?m.color:C.textDim,cursor:"pointer",
                  fontSize:9,fontWeight:700,fontFamily:C.F,letterSpacing:.4,transition:"all .14s"}}>
                {m.icon} {m.label.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"rgba(255,255,255,.06) transparent"}}>

        {/* ── INTELLIGENCE VIEW ── */}
        {view==="intelligence"&&(
          <div>
            {apError&&<div style={{background:"rgba(244,63,94,.07)",border:"1px solid rgba(244,63,94,.2)",borderRadius:10,padding:"12px 14px",marginBottom:12,fontFamily:C.F,fontSize:12,color:C.rose}}>{apError}</div>}

            {/* Premium with no data */}
            {isPremium&&!hasEnoughData&&!apResult&&(
              <div style={{textAlign:"center",padding:"32px 16px",animation:"fadeUp .4s ease"}}>
                <div style={{width:64,height:64,borderRadius:18,margin:"0 auto 16px",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,boxShadow:`0 8px 28px ${C.indigo}40`}}>🤖</div>
                <h3 style={{fontFamily:C.F,fontWeight:800,fontSize:18,color:C.text,margin:"0 0 10px"}}>Autopilot is ready.</h3>
                <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:"0 0 20px",lineHeight:1.7,maxWidth:320,marginLeft:"auto",marginRight:"auto"}}>Add your clients and deals so Autopilot has real data to analyze. The more context you provide, the more powerful it becomes.</p>
                {[{icon:"👥",label:"Add your clients",desc:"Clients tab → Pipeline Manager",tab:"clients"},{icon:"📋",label:"Add your deals",desc:"Market tab → My Business → Add Deal",tab:"market"},{icon:"🎯",label:"Set your GCI goal",desc:"Market tab → My Business → Goals",tab:"market"}].map((s,i)=>(
                  <div key={i} onClick={()=>onNavigate(s.tab)}
                    style={{display:"flex",alignItems:"center",gap:12,background:C.surface,border:`1px solid ${C.border}`,borderRadius:11,padding:"12px 14px",cursor:"pointer",textAlign:"left",marginBottom:8,maxWidth:320,marginLeft:"auto",marginRight:"auto",transition:"all .16s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(99,102,241,.3)"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                    <span style={{fontSize:20}}>{s.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>{s.label}</div>
                      <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>{s.desc}</div>
                    </div>
                    <span style={{color:C.indigo,fontSize:14}}>→</span>
                  </div>
                ))}
              </div>
            )}

            {/* Running animation */}
            {apRunning&&(
              <APCard accent={C.indigo}>
                <div style={{textAlign:"center",padding:"24px 0"}}>
                  <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
                    {[0,1,2,3,4].map(i=><div key={i} style={{width:8,height:8,borderRadius:"50%",background:C.indigo,opacity:.6,animation:`pulse 1.2s ease ${i*.15}s infinite`}}/>)}
                  </div>
                  <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,margin:"0 0 6px"}}>Analyzing your business...</p>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:0,lineHeight:1.6}}>Scanning {data.totalClients} clients · {data.totalDeals} deals · pipeline health · relationship patterns</p>
                </div>
              </APCard>
            )}

            {/* Intelligence report */}
            {!apRunning&&apResult&&(
              <div>
                {/* Situation Room — shows when active */}
                {situationRoom&&(
                  <div style={{marginBottom:14}}>
                    <SituationRoom
                      risk={situationRoom}
                      apResult={apResult}
                      voice={voice}
                      onClose={()=>setSituationRoom(null)}
                      onDiscuss={p=>{ setView("chat"); setTimeout(()=>sendMessage(p),100); }}
                    />
                  </div>
                )}

                {/* Critical risk banner — appears when high severity risks exist */}
                {!situationRoom&&apResult?.deal_intelligence?.risks?.filter(r=>r.severity==="high")?.length>0&&(
                  <div style={{background:"rgba(244,63,94,.07)",
                    border:"1px solid rgba(244,63,94,.25)",
                    borderRadius:12,padding:"12px 16px",marginBottom:14,
                    display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:6,height:6,borderRadius:"50%",
                        background:C.rose,boxShadow:`0 0 6px ${C.rose}`,
                        animation:"pulse 1s ease infinite",flexShrink:0}}/>
                      <div>
                        <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.rose}}>
                          {apResult.deal_intelligence.risks.filter(r=>r.severity==="high").length} critical deal risk{apResult.deal_intelligence.risks.filter(r=>r.severity==="high").length>1?"s":""} detected
                        </div>
                        <div style={{fontFamily:C.F,fontSize:10,color:C.textDim}}>
                          {apResult.deal_intelligence.risks[0].deal} — {apResult.deal_intelligence.risks[0].risk.slice(0,60)}...
                        </div>
                      </div>
                    </div>
                    <button onClick={()=>setSituationRoom(apResult.deal_intelligence.risks[0])}
                      style={{background:`linear-gradient(135deg,${C.rose},rgba(244,63,94,.7))`,
                        border:"none",color:"#fff",borderRadius:8,padding:"7px 14px",
                        cursor:"pointer",fontFamily:C.F,fontWeight:700,fontSize:11,
                        flexShrink:0,boxShadow:`0 3px 12px ${C.rose}28`}}>
                      Open Situation Room →
                    </button>
                  </div>
                )}

                {/* Tab nav */}
                <div style={{display:"flex",gap:5,marginBottom:14,overflowX:"auto",paddingBottom:4}}>
                  {AP_TABS.map(t=>(
                    <button key={t.id} onClick={()=>setApTab(t.id)}
                      style={{padding:"7px 12px",borderRadius:10,flexShrink:0,
                        border:`1px solid ${apTab===t.id?C.indigo+"44":C.border}`,
                        background:apTab===t.id?`${C.indigo}10`:"transparent",
                        color:apTab===t.id?C.indigoLt:C.textDim,cursor:"pointer",
                        fontSize:10,fontFamily:C.F,fontWeight:700,whiteSpace:"nowrap",
                        transition:"all .14s",display:"flex",alignItems:"center",gap:5}}>
                      {t.icon} {t.label}
                      {t.count>0&&<span style={{fontSize:8,background:C.indigo,color:"#fff",borderRadius:8,padding:"1px 5px",fontWeight:800}}>{t.count}</span>}
                    </button>
                  ))}
                </div>

                {apTab==="mission"  &&<MissionSection   mission={apResult.mission}             runTime={lastRun} onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}}/>}
                {apTab==="deals"    &&<DealIntelligence di={apResult.deal_intelligence}         onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}} onSituationRoom={r=>{setSituationRoom(r);setApTab("deals");}}/>}
                {apTab==="clients"  &&<ClientScores     scores={apResult.client_scores}         onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}}/>}
                {apTab==="alerts"   &&<RelationshipAlerts alerts={apResult.relationship_alerts} onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}}/>}
                {apTab==="market"   &&<MarketCoachingForecast market={apResult.market_intelligence} coaching={null} forecast={null} onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}}/>}
                {apTab==="coaching" &&<MarketCoachingForecast market={null} coaching={apResult.coaching_insight} forecast={apResult.performance_forecast} onDiscuss={p=>{setView("chat");setTimeout(()=>sendMessage(p),100);}}/>}
                {apTab==="history"  &&<RunHistory runs={runHistory} memory={dbMemory} conversations={conversations}/>}
              </div>
            )}

            {/* Non-premium paywall */}
            {!isPremium&&(
              <div style={{background:`linear-gradient(135deg,${C.violet}10,${C.indigo}08)`,border:`1px solid ${C.violet}28`,borderRadius:18,padding:"36px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",width:250,height:250,borderRadius:"50%",pointerEvents:"none",background:`radial-gradient(circle,${C.violet}14,transparent 70%)`}}/>
                <div style={{position:"relative"}}>
                  <div style={{width:60,height:60,borderRadius:16,margin:"0 auto 16px",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,boxShadow:`0 8px 28px ${C.indigo}40`}}>🤖</div>
                  <div style={{display:"inline-flex",alignItems:"center",gap:6,background:`${C.violet}12`,border:`1px solid ${C.violet}28`,borderRadius:14,padding:"3px 12px",marginBottom:12,fontSize:9,color:C.violet,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>✦ PREMIUM EXCLUSIVE</div>
                  <h3 style={{fontFamily:C.F,fontWeight:800,fontSize:20,color:C.text,margin:"0 0 10px",letterSpacing:"-0.02em"}}>Autopilot Intelligence</h3>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 20px",lineHeight:1.7,maxWidth:340,marginLeft:"auto",marginRight:"auto"}}>Upgrade to Premium to unlock the full Autopilot intelligence report — daily mission, deal risk detection, client probability scores, relationship alerts, market intelligence, and AI coaching — all in one view.</p>
                  <button onClick={()=>window.open("https://buy.stripe.com/6oUeVcfrnbmr3Z31vg0sU08","_blank")}
                    style={{background:`linear-gradient(135deg,${C.indigo},${C.violet})`,border:"none",color:"#fff",padding:"13px 32px",borderRadius:11,cursor:"pointer",fontWeight:800,fontSize:14,fontFamily:C.F,boxShadow:`0 0 0 1px ${C.violet}40,0 6px 22px ${C.violet}28`,marginBottom:10}}>
                    Upgrade to Premium — $129/month ⚡
                  </button>
                  <p style={{fontFamily:C.F,fontSize:10,color:C.textDim,margin:0}}>Cancel anytime · Unlimited credits included</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT VIEW ── */}
        {view==="chat"&&(
          <div style={{display:"flex",flexDirection:"column",height:"100%"}}>

            {/* Opening briefing */}
            {!hasMessages&&briefObj&&(
              <div style={{
                background: briefObj.urgency==="critical"
                  ? `linear-gradient(135deg,rgba(244,63,94,.08),rgba(99,102,241,.04))`
                  : briefObj.urgency==="high"
                  ? `linear-gradient(135deg,rgba(245,158,11,.07),rgba(99,102,241,.04))`
                  : `linear-gradient(135deg,${C.indigo}10,${C.emerald}06)`,
                border: `1px solid ${briefObj.urgency==="critical"?C.rose+"30":briefObj.urgency==="high"?C.amber+"30":C.indigo+"20"}`,
                borderRadius:13,padding:"16px 16px",marginBottom:16,
                animation:"fadeUp .4s ease",position:"relative",overflow:"hidden"}}>

                {/* Urgency pulse for critical */}
                {briefObj.urgency==="critical"&&(
                  <div style={{position:"absolute",top:10,right:12,
                    width:8,height:8,borderRadius:"50%",background:C.rose,
                    boxShadow:`0 0 8px ${C.rose}`,animation:"pulse 1s ease infinite"}}/>
                )}

                <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                    background:`linear-gradient(135deg,${C.emerald},${C.cyan})`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:12,fontWeight:800,color:"#fff"}}>S</div>
                  <div style={{flex:1}}>
                    {briefLoading?(
                      <div style={{display:"flex",gap:5,alignItems:"center",padding:"4px 0"}}>
                        {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.indigoLt,animation:`pulse .9s ease ${i*.18}s infinite`}}/>)}
                        <span style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginLeft:4}}>Preparing your brief...</span>
                      </div>
                    ):(
                      <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,
                        lineHeight:1.75,whiteSpace:"pre-wrap"}}
                        dangerouslySetInnerHTML={{__html:(briefObj.brief||"").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>")}}/>
                    )}
                    {/* Suggested action button */}
                    {!briefLoading&&briefObj.suggestedAction&&(
                      <button onClick={()=>sendMessage(briefObj.suggestedAction)}
                        style={{marginTop:10,background:`linear-gradient(135deg,${C.indigo}18,${C.violet}10)`,
                          border:`1px solid ${C.indigo}30`,color:C.indigoLt,
                          borderRadius:9,padding:"7px 14px",cursor:"pointer",
                          fontFamily:C.F,fontWeight:700,fontSize:11,
                          display:"inline-flex",alignItems:"center",gap:6,
                          transition:"all .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.background=`linear-gradient(135deg,${C.indigo}28,${C.violet}18)`}
                        onMouseLeave={e=>e.currentTarget.style.background=`linear-gradient(135deg,${C.indigo}18,${C.violet}10)`}>
                        <span>⚡</span>
                        Do this now
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Quick prompts */}
            {!hasMessages&&(
              <div style={{marginBottom:12}}>
                <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:10,textAlign:"center"}}>
                  {smartPrompts.some(p=>p.urgent)?"⚠️ NEEDS ATTENTION · QUICK STARTS":"QUICK STARTS"}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                  {smartPrompts.map((p,i)=>(
                    <button key={i} onClick={()=>sendMessage(p.prompt)}
                      style={{background:p.urgent?`${C.rose}06`:C.surface,border:`1px solid ${p.urgent?C.rose+"28":C.border}`,borderRadius:10,padding:"11px 12px",cursor:"pointer",textAlign:"left",transition:"all .15s",animation:`fadeUp .28s ease ${i*.04}s both`}}
                      onMouseEnter={e=>{ e.currentTarget.style.borderColor=p.urgent?C.rose+"55":`${p.color||C.indigo}44`; e.currentTarget.style.transform="translateY(-1px)"; }}
                      onMouseLeave={e=>{ e.currentTarget.style.borderColor=p.urgent?C.rose+"28":C.border; e.currentTarget.style.transform="translateY(0)"; }}>
                      <div style={{fontSize:15,marginBottom:4}}>{p.icon}</div>
                      <div style={{fontFamily:C.F,fontWeight:700,fontSize:11,color:p.urgent?C.rose:C.text,lineHeight:1.3}}>{p.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg,i)=>(
              <ChatMessage key={i} msg={msg}
                isLast={i===messages.length-1&&msg.role==="assistant"}
                onRegenerate={()=>{ const lu=messages.filter(m=>m.role==="user").slice(-1)[0]; if(lu) sendMessage(lu.content,true); }}
                onSaveNote={saveNote}/>
            ))}
            {chatLoading&&<TypingIndicator/>}
            <div ref={messagesEndRef}/>
          </div>
        )}
      </div>

      {/* ── CHAT INPUT (always visible in chat view) ── */}
      {view==="chat"&&(
        <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:8}}>
          {/* Follow-up chips */}
          {hasMessages&&!chatLoading&&(
            <div style={{display:"flex",gap:5,marginBottom:8,overflowX:"auto",paddingBottom:2}}>
              {["Make it shorter","Different version","More professional","More casual","Give me a script","What should I say next?","Add urgency","Write the email version"].map((s,i)=>(
                <button key={i} onClick={()=>sendMessage(s)}
                  style={{background:"rgba(255,255,255,.025)",border:`1px solid ${C.border}`,borderRadius:14,padding:"4px 10px",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,fontSize:9,color:C.textDim,fontFamily:C.F,fontWeight:600,transition:"all .12s"}}
                  onMouseEnter={e=>{e.currentTarget.style.color=C.indigoLt;e.currentTarget.style.borderColor="rgba(99,102,241,.28)";}}
                  onMouseLeave={e=>{e.currentTarget.style.color=C.textDim;e.currentTarget.style.borderColor=C.border;}}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div style={{display:"flex",gap:8,alignItems:"flex-end",position:"relative"}}>

            {/* Live transcript overlay */}
            {voiceActive&&transcript&&(
              <div style={{position:"absolute",bottom:"100%",left:0,right:0,
                marginBottom:6,background:`${C.indigo}10`,
                border:`1px solid ${C.indigo}28`,borderRadius:9,
                padding:"8px 12px",animation:"fadeUp .2s ease"}}>
                <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:4}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:C.rose,
                    animation:"pulse .6s ease infinite"}}/>
                  <span style={{fontSize:8,color:C.rose,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>
                    LISTENING
                  </span>
                </div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,margin:0,
                  fontStyle:"italic"}}>{transcript}</p>
              </div>
            )}

            {/* Mic button — voice input */}
            {voiceSupported&&isPremium&&(
              <button onClick={toggleVoice}
                title={voiceActive?"Stop listening":"Start voice input"}
                style={{width:44,height:44,borderRadius:11,flexShrink:0,
                  background:voiceActive
                    ?`linear-gradient(135deg,${C.rose},rgba(244,63,94,.7))`
                    :"rgba(255,255,255,.05)",
                  border:`1px solid ${voiceActive?C.rose+"50":C.border}`,
                  cursor:"pointer",display:"flex",alignItems:"center",
                  justifyContent:"center",
                  boxShadow:voiceActive?`0 0 0 3px ${C.rose}20,0 4px 14px ${C.rose}28`:"none",
                  transition:"all .18s",position:"relative"}}>
                {voiceActive&&(
                  <div style={{position:"absolute",inset:-3,borderRadius:14,
                    border:`2px solid ${C.rose}40`,animation:"pulse 1s ease infinite"}}/>
                )}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke={voiceActive?"#fff":C.textDim} strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            )}

            <textarea ref={textareaRef}
              data-voice="true"
              value={voiceActive&&transcript ? input+transcript : input}
              onChange={e=>{ if(!voiceActive){ setInput(e.target.value); autoResize(e); } }}
              onKeyDown={e=>{ if(!voiceActive) handleKey(e); }}
              placeholder={voiceActive?"Listening... speak now":isPremium&&apResult?"Ask Autopilot anything — it knows your business...":voice?.saved?`Ask anything, ${voice.name?.split(" ")[0]||""}... (${currentMode.description})`:`Ask anything... (${currentMode.description})`}
              rows={1}
              style={{flex:1,background:voiceActive?`${C.rose}06`:C.surfaceUp,
                border:`1px solid ${voiceActive?C.rose+"30":C.borderMd}`,
                borderRadius:11,padding:"11px 14px",color:C.text,fontFamily:C.F,
                fontSize:13,resize:"none",lineHeight:1.5,height:44,maxHeight:140,
                outline:"none",boxSizing:"border-box",transition:"all .16s"}}
              onFocus={e=>{ if(!voiceActive){ e.target.style.borderColor=`${currentMode.color}55`; e.target.style.boxShadow=`0 0 0 3px ${currentMode.color}10`; } }}
              onBlur={e=>{ e.target.style.borderColor=voiceActive?C.rose+"30":C.borderMd; e.target.style.boxShadow="none"; }}/>

            <button onClick={()=>{ stopVoice(); sendMessage(input); }}
              disabled={chatLoading||(!input.trim()&&!transcript)}
              style={{width:44,height:44,borderRadius:11,flexShrink:0,
                background:(input.trim()||transcript)&&!chatLoading
                  ?`linear-gradient(135deg,${currentMode.color},${currentMode.color}cc)`
                  :"rgba(255,255,255,.05)",
                border:"none",
                cursor:(input.trim()||transcript)&&!chatLoading?"pointer":"default",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:(input.trim()||transcript)&&!chatLoading?`0 4px 14px ${currentMode.color}30`:"none",
                transition:"all .18s"}}>
              {chatLoading
                ?<div style={{width:16,height:16,borderRadius:"50%",border:`2px solid ${currentMode.color}`,borderTopColor:"transparent",animation:"spin .7s linear infinite"}}/>
                :<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={(input.trim()||transcript)?"#fff":C.textDim} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              }
            </button>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <p style={{fontFamily:C.F,fontSize:8,color:C.textDim,margin:0,letterSpacing:.4}}>
                {voiceActive?"Tap send or stop mic to send":"Enter to send · Shift+Enter for new line"}
              </p>
              {/* Voice output toggle — Premium only */}
              {voiceSupported&&isPremium&&(
                <button onClick={toggleVoiceOutput}
                  title={voiceEnabled?"Turn off voice responses":"Turn on voice responses"}
                  style={{display:"flex",alignItems:"center",gap:4,
                    background:voiceEnabled?`${C.emerald}10`:"transparent",
                    border:`1px solid ${voiceEnabled?C.emerald+"30":C.border}`,
                    borderRadius:6,padding:"2px 8px",cursor:"pointer",transition:"all .14s"}}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke={voiceEnabled?C.emerald:C.textDim} strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    {voiceEnabled
                      ?<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></>
                      :<><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></>
                    }
                  </svg>
                  <span style={{fontSize:8,color:voiceEnabled?C.emerald:C.textDim,
                    fontFamily:C.F,fontWeight:700}}>
                    {voiceEnabled?"Voice on":"Voice off"}
                  </span>
                </button>
              )}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {conversations.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:4,
                  background:`${C.violet}08`,border:`1px solid ${C.violet}18`,
                  borderRadius:6,padding:"2px 7px"}}>
                  <div style={{width:4,height:4,borderRadius:"50%",background:C.violet}}/>
                  <span style={{fontSize:8,color:C.violet,fontFamily:C.F,fontWeight:700}}>
                    {conversations.length} session{conversations.length!==1?"s":""} remembered
                  </span>
                </div>
              )}
              {hasMessages&&(
                <button onClick={clearChat} disabled={summarizing}
                  style={{background:"transparent",border:"none",
                    color:C.textDim,cursor:"pointer",fontSize:9,fontFamily:C.F}}>
                  {summarizing?"Saving memory...":"Clear chat"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Persistent chat button (intelligence view) */}
      {view==="intelligence"&&isPremium&&(
        <div style={{flexShrink:0,paddingTop:10,borderTop:`1px solid ${C.border}`,marginTop:8}}>
          <button onClick={()=>setView("chat")}
            style={{width:"100%",background:`linear-gradient(135deg,${C.indigo}14,${C.violet}0a)`,border:`1px solid ${C.indigo}28`,color:C.indigoLt,borderRadius:11,padding:"11px 0",cursor:"pointer",fontFamily:C.F,fontWeight:700,fontSize:13,transition:"all .16s",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
            onMouseEnter={e=>e.currentTarget.style.background=`linear-gradient(135deg,${C.indigo}22,${C.violet}14)`}
            onMouseLeave={e=>e.currentTarget.style.background=`linear-gradient(135deg,${C.indigo}14,${C.violet}0a)`}>
            <span style={{fontSize:16}}>💬</span>
            {isPremium&&apResult?"Discuss anything with SPARK Autopilot →":"Chat with SPARK →"}
          </button>
        </div>
      )}
    </div>
  );
}
