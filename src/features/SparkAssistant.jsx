// src/features/SparkAssistant.jsx — Premium SPARK Assistant v2
// Streaming responses · Proactive briefing · Message actions · Conversation modes
// Full business context injection · Smart dynamic prompts

import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  bg:"#04040a", surface:"#08080f", surfaceUp:"#0d0d1a", surfaceHigh:"#111122",
  border:"rgba(255,255,255,0.06)", borderMd:"rgba(255,255,255,0.10)",
  indigo:"#6366f1", indigoLt:"#818cf8", violet:"#8b5cf6",
  cyan:"#22d3ee", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e",
  text:"rgba(255,255,255,0.95)", textMd:"rgba(255,255,255,0.55)",
  textDim:"rgba(255,255,255,0.26)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const LS_KEY        = "spark_assistant_history_v2";
const LS_MODE_KEY   = "spark_assistant_mode_v1";
const LS_NOTES_KEY  = "spark_assistant_notes_v1";
function lsGet(key,fb){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch{ return fb; } }
function lsSet(key,val){ try{ localStorage.setItem(key,JSON.stringify(val)); }catch{} }

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION MODES
// ─────────────────────────────────────────────────────────────────────────────
const MODES = {
  write: {
    label:"Write",icon:"✍️",color:C.indigo,
    description:"Scripts, emails & copy",
    instruction:"You are in WRITE mode. Produce polished, ready-to-use written content — scripts, emails, texts, social captions, LinkedIn posts, listing descriptions. Write in natural prose. NEVER use JSON or code blocks. Output should read like something a human wrote, formatted cleanly with line breaks.",
  },
  strategize: {
    label:"Strategize",icon:"🧠",color:C.violet,
    description:"Think through problems",
    instruction:"You are in STRATEGIZE mode. Think through the agent's situation deeply and respond in conversational prose. Weigh options, anticipate objections, identify risks. Give structured analysis with clear recommendations. NEVER use JSON or code blocks. Write like a trusted advisor thinking out loud.",
  },
  coach: {
    label:"Coach",icon:"🎯",color:C.amber,
    description:"Direct business advice",
    instruction:"You are in COACH mode. Be direct, honest, and specific — like a high-performance real estate coach. Don't soften feedback. Give the exact action to take. NEVER use JSON or code blocks. Write in direct conversational sentences, like a coach speaking plainly.",
  },
  roleplay: {
    label:"Practice",icon:"🎭",color:C.cyan,
    description:"Role-play client scenarios",
    instruction:"You are in PRACTICE mode. Role-play as a real estate client so the agent can practice scripts and objection handling. Stay in character. NEVER use JSON or code blocks. Write dialogue naturally. After each exchange, briefly break character to give one line of coaching feedback.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT CONTEXT BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function buildAgentContext(voice, planKey){
  const lines = [];
  if(voice?.saved){
    lines.push("AGENT PROFILE:");
    if(voice.name)         lines.push(`- Name: ${voice.name}`);
    if(voice.brokerage)    lines.push(`- Brokerage: ${voice.brokerage}`);
    if(voice.market)       lines.push(`- Market: ${voice.market}`);
    if(voice.specialty)    lines.push(`- Specialty: ${voice.specialty}`);
    if(voice.tone)         lines.push(`- Tone preference: ${voice.tone}`);
    if(voice.targetClient) lines.push(`- Target client: ${voice.targetClient}`);
    if(voice.cta)          lines.push(`- Preferred CTA: ${voice.cta}`);
    lines.push("");
  }

  const usage = lsGet("sp_usage_stats",{});
  const credits = lsGet("sp_credits",null);
  if(planKey||usage.total){
    lines.push("SPARK USAGE:");
    if(planKey)         lines.push(`- Plan: ${planKey}`);
    if(credits!==null)  lines.push(`- Credits remaining: ${credits}`);
    if(usage.total)     lines.push(`- Total generations: ${usage.total}`);
    if(usage.streak)    lines.push(`- Day streak: ${usage.streak}`);
    if(usage.toolCounts){
      const top=Object.entries(usage.toolCounts).sort((a,b)=>b[1]-a[1]).slice(0,3);
      if(top.length) lines.push(`- Favorite tools: ${top.map(([k,v])=>`${k}(${v}x)`).join(", ")}`);
    }
    lines.push("");
  }

  const clients = lsGet("spark_clients_v1",[]);
  if(clients.length){
    const now = Date.now();
    const daysSince = c => c.lastContact ? Math.round((now-new Date(c.lastContact))/(864e5)) : null;
    lines.push(`CLIENT PIPELINE (${clients.length} total):`);
    clients.forEach(c=>{
      const ds = daysSince(c);
      const overdue = ds!==null && ds>7 ? ` ⚠️ ${ds}d no contact` : ds!==null ? ` (contacted ${ds}d ago)` : "";
      lines.push(`- [${c.stage.toUpperCase()}] ${c.name} (${c.type}) — ${c.property||"no property"}, budget ${c.budget||"?"}, timeline ${c.timeline||"?"}${overdue}${c.motivation?`, motivation: ${c.motivation}`:""}${c.notes?`, notes: ${c.notes.slice(0,120)}`:""}${c.nextAction?`, next action: ${c.nextAction}`:""}`);
    });
    lines.push("");
  }

  const deals = lsGet("spark_pipeline_value_v1",[]);
  if(deals.length){
    const total    = deals.reduce((s,d)=>s+(parseFloat(d.value)||0),0);
    const weighted = deals.reduce((s,d)=>s+(parseFloat(d.value)||0)*(parseFloat(d.probability)||50)/100,0);
    lines.push(`BUSINESS PIPELINE ($${Math.round(total).toLocaleString()} total, $${Math.round(weighted).toLocaleString()} weighted):`);
    deals.forEach(d=>{
      const daysUntil = d.closeDate ? Math.round((new Date(d.closeDate)-Date.now())/(864e5)) : null;
      const urgency   = daysUntil!==null && daysUntil<=14 ? ` 🔥 CLOSES IN ${daysUntil} DAYS` : "";
      lines.push(`- ${d.name}: $${(parseFloat(d.value)||0).toLocaleString()}, ${d.stage||"?"}, ${d.probability||50}% probability, closes ${d.closeDate||"TBD"}${urgency}`);
    });
    lines.push("");
  }

  const goals = lsGet("spark_biz_goals_v1",{});
  if(goals.monthlyGciTarget||goals.currentMonth){
    lines.push("BUSINESS GOALS:");
    if(goals.monthlyGciTarget) lines.push(`- Monthly GCI target: ${goals.monthlyGciTarget}`);
    if(goals.currentMonth)     lines.push(`- Current month GCI: ${goals.currentMonth}`);
    if(goals.yearToDate)       lines.push(`- YTD GCI: ${goals.yearToDate}`);
    if(goals.avgCommission)    lines.push(`- Avg commission: ${goals.avgCommission}%`);
    if(goals.conversionRate)   lines.push(`- Lead conversion: ${goals.conversionRate}%`);
    lines.push("");
  }

  const notes = lsGet(LS_NOTES_KEY,[]);
  if(notes.length){
    lines.push(`SAVED NOTES (${notes.length}):`);
    notes.slice(-5).forEach((n,i)=>lines.push(`- ${n.text.slice(0,100)}`));
    lines.push("");
  }

  lines.push(`TODAY: ${new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}`);
  return lines.join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// PROACTIVE OPENING BRIEFING
// ─────────────────────────────────────────────────────────────────────────────
function buildOpeningBriefing(voice){
  const firstName   = voice?.name?.split(" ")[0] || null;
  const clients     = lsGet("spark_clients_v1",[]);
  const deals       = lsGet("spark_pipeline_value_v1",[]);
  const now         = Date.now();

  const overdue = clients.filter(c=>{
    if(!c.lastContact) return false;
    return Math.round((now-new Date(c.lastContact))/(864e5)) > 7;
  });

  const closingSoon = deals.filter(d=>{
    if(!d.closeDate) return false;
    const days = Math.round((new Date(d.closeDate)-now)/(864e5));
    return days >= 0 && days <= 14;
  });

  const active   = clients.filter(c=>c.stage==="active").length;
  const contract = clients.filter(c=>c.stage==="contract").length;

  const hour = new Date().getHours();
  const greeting = hour<12?"Good morning":hour<17?"Good afternoon":"Good evening";

  const items = [];
  if(overdue.length)    items.push(`**${overdue.length} client${overdue.length>1?"s":""} need${overdue.length===1?"s":""} follow-up** — ${overdue.map(c=>c.name).join(", ")}`);
  if(closingSoon.length) items.push(`**${closingSoon[0].name} closes in ${Math.round((new Date(closingSoon[0].closeDate)-now)/(864e5))} days** — are you ready?`);
  if(active>0)          items.push(`**${active} active client${active>1?"s":""} in your pipeline** — who's closest to making a decision?`);
  if(contract>0)        items.push(`**${contract} deal${contract>1?"s":""} under contract** — all milestones on track?`);

  if(items.length === 0){
    return firstName
      ? `${greeting}, ${firstName}. I'm SPARK — your AI business partner. I have full context on your business and I'm ready to help. Ask me anything, or tap a quick start below.`
      : `${greeting}. I'm SPARK — your AI business partner. Ask me anything about your clients, deals, scripts, strategy, or market.`;
  }

  const greeting_line = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;
  return `${greeting_line} Here's what needs your attention:\n\n${items.map(i=>`• ${i}`).join("\n")}\n\nWhat would you like to tackle first?`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMART DYNAMIC PROMPTS
// ─────────────────────────────────────────────────────────────────────────────
function getSmartPrompts(voice, mode){
  const clients  = lsGet("spark_clients_v1",[]);
  const deals    = lsGet("spark_pipeline_value_v1",[]);
  const now      = Date.now();
  const prompts  = [];

  // Urgency-based prompts from real data
  const overdue = clients.filter(c=>c.lastContact&&Math.round((now-new Date(c.lastContact))/(864e5))>7);
  overdue.slice(0,2).forEach(c=>{
    prompts.push({
      label:`Follow up: ${c.name}`,
      icon:"⚠️",
      color:C.rose,
      urgent:true,
      prompt:`Write me a follow-up message for ${c.name}. They're a ${c.type||"client"} looking for ${c.property||"a property"}, budget ${c.budget||"unknown"}. Notes: ${c.notes?.slice(0,80)||"none"}. It's been over a week — make it personal and not pushy.`,
    });
  });

  const closingSoon = deals.filter(d=>{ if(!d.closeDate) return false; const days=Math.round((new Date(d.closeDate)-now)/(864e5)); return days>=0&&days<=14; });
  closingSoon.slice(0,1).forEach(d=>{
    const days = Math.round((new Date(d.closeDate)-now)/(864e5));
    prompts.push({
      label:`${d.name} — ${days}d to close`,
      icon:"🔥",
      color:C.amber,
      urgent:true,
      prompt:`My deal "${d.name}" closes in ${days} days. It's at ${d.stage||"active"} stage, $${(parseFloat(d.value)||0).toLocaleString()} transaction. What do I need to do right now to make sure this closes on time?`,
    });
  });

  // Mode-specific prompts
  if(mode==="write"){
    const activeSellers = clients.filter(c=>c.stage==="active"&&c.type==="seller");
    if(activeSellers.length){
      const s=activeSellers[0];
      prompts.push({ label:`Write listing copy for ${s.name}`, icon:"✍️", color:C.indigo, prompt:`Write a compelling MLS description and social media caption for my seller ${s.name}'s listing at ${s.property||"their property"}. Notes: ${s.notes?.slice(0,80)||"none"}.` });
    }
    prompts.push({ label:"Write a market update post", icon:"📊", color:C.indigo, prompt:`Write a LinkedIn post about what's happening in the ${voice?.market||"local"} real estate market right now. Make it sound like expert commentary, not a sales pitch.` });
    prompts.push({ label:"Write a follow-up email sequence", icon:"📧", color:C.indigo, prompt:`Write a 3-email follow-up sequence for a buyer lead from Zillow. They inquired about a property but haven't responded to my first message. Space them over 7 days.` });
  } else if(mode==="strategize"){
    prompts.push({ label:"Review my pipeline", icon:"🧠", color:C.violet, prompt:`Look at my current pipeline and tell me honestly: what's my biggest risk right now, what's my biggest opportunity, and what should I be focused on this week?` });
    prompts.push({ label:"Help me win a listing", icon:"🏆", color:C.violet, prompt:`I have a listing appointment tomorrow. Help me think through my strategy — how should I open, what questions should I ask, how do I handle pushback on commission, and how do I close for the signature?` });
    prompts.push({ label:"Analyze a difficult situation", icon:"⚖️", color:C.violet, prompt:`I have a situation I need help thinking through. [Describe your situation]` });
  } else if(mode==="coach"){
    prompts.push({ label:"Give me a reality check", icon:"🎯", color:C.amber, prompt:`Look at my business data and give me an honest assessment. What am I doing well? What's holding me back? What's the most important thing I should change right now?` });
    prompts.push({ label:"My GCI target check-in", icon:"💰", color:C.amber, prompt:`Based on my pipeline and goals, am I on track to hit my monthly GCI target? What do I need to do this week to stay on pace?` });
    prompts.push({ label:"Help me get unstuck", icon:"🔓", color:C.amber, prompt:`I feel like my business has plateaued. I'm working hard but not seeing the results I want. What would you coach me to do differently?` });
  } else if(mode==="roleplay"){
    prompts.push({ label:"Practice: motivated seller", icon:"🎭", color:C.cyan, prompt:`Let's role-play. You're a motivated seller who needs to sell in 60 days. You've had a bad experience with a previous agent and you're skeptical. I need to earn your trust and get the listing. Begin.` });
    prompts.push({ label:"Practice: price objection", icon:"🎭", color:C.cyan, prompt:`Role-play as a seller who thinks their home is worth $50,000 more than I'm recommending. Push back hard on my pricing. I need to practice this conversation.` });
    prompts.push({ label:"Practice: buyer who won't commit", icon:"🎭", color:C.cyan, prompt:`You're a buyer I've been working with for 4 months. You love homes but always find a reason not to make an offer. I need to practice converting you. Stay in character.` });
  }

  // Static fallbacks
  const statics = [
    { label:"Negative review response",  icon:"⭐", color:C.textMd, prompt:"Help me respond to a negative Zillow review professionally. Client said we weren't responsive and overpriced the home. We actually sold at asking in 12 days." },
    { label:"Lost offer follow-up",      icon:"💌", color:C.textMd, prompt:"Write a follow-up for buyers who just lost their 3rd offer. They're frustrated and considering giving up. Keep them motivated." },
    { label:"Price reduction talk",      icon:"💬", color:C.textMd, prompt:"Help me approach the price reduction conversation with a seller. Home has been listed 45 days, no offers. Need to suggest a $50,000 reduction." },
    { label:"FSBO outreach script",      icon:"🏠", color:C.textMd, prompt:"Write a script for calling a FSBO who's been trying to sell for 3 weeks. 4bd/3ba, listed at $1.2M." },
    { label:"Referral ask",              icon:"🤝", color:C.textMd, prompt:"Write a natural way to ask past clients for referrals. I closed 3 deals for them in 2 years. Don't want to sound salesy." },
    { label:"Counter offer strategy",    icon:"⚖️", color:C.textMd, prompt:"Help me craft a counter-offer strategy. Received an offer 8% below asking with financing contingency. Seller wants to stay close to list price." },
  ];

  return [...prompts, ...statics].slice(0,8);
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGE COMPONENT with actions
// ─────────────────────────────────────────────────────────────────────────────
function Message({ msg, onRegenerate, onSaveNote, isLast }){
  const isUser   = msg.role === "user";
  const isStream = msg.streaming;
  const [showActions, setShowActions] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  function copy(text, setter){
    navigator.clipboard.writeText(text||"").then(()=>{ setter(true); setTimeout(()=>setter(false),2000); });
  }

  // Format message — bold **text**, preserve line breaks
  function formatText(text){
    if(!text) return null;
    return text.split("\n").map((line,i)=>{
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <span key={i}>
          {parts.map((part,j)=>
            part.startsWith("**")&&part.endsWith("**")
              ? <strong key={j} style={{color:C.text,fontWeight:700}}>{part.slice(2,-2)}</strong>
              : <span key={j}>{part}</span>
          )}
          {i<text.split("\n").length-1&&<br/>}
        </span>
      );
    });
  }

  return(
    <div
      style={{display:"flex",flexDirection:isUser?"row-reverse":"row",gap:10,marginBottom:16}}
      onMouseEnter={()=>!isUser&&setShowActions(true)}
      onMouseLeave={()=>setShowActions(false)}>

      {/* Avatar */}
      <div style={{width:28,height:28,borderRadius:"50%",
        background:isUser
          ?`linear-gradient(135deg,${C.indigo},${C.violet})`
          :`linear-gradient(135deg,${C.emerald},${C.cyan})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:800,color:"#fff",
        boxShadow:isUser?`0 2px 8px ${C.indigo}40`:`0 2px 8px ${C.emerald}40`,
        flexShrink:0,marginTop:2}}>
        {isUser?"Y":"S"}
      </div>

      <div style={{maxWidth:"82%",position:"relative"}}>
        {/* Bubble */}
        <div style={{
          background:isUser
            ?`linear-gradient(135deg,${C.indigo}22,${C.violet}14)`
            :`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
          border:`1px solid ${isUser?C.indigo+"30":C.border}`,
          borderRadius:isUser?"14px 14px 4px 14px":"14px 14px 14px 4px",
          padding:"12px 14px",position:"relative",overflow:"hidden"}}>

          {!isUser&&<div style={{position:"absolute",top:0,left:0,right:0,height:1,
            background:`linear-gradient(90deg,transparent,${C.emerald}30,transparent)`}}/>}

          <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,
            lineHeight:1.75,wordBreak:"break-word"}}>
            {formatText(msg.content)}
            {isStream&&<span style={{
              display:"inline-block",width:2,height:14,
              background:C.emerald,marginLeft:2,verticalAlign:"middle",
              animation:"pulse .7s ease infinite"}}/>}
          </p>
        </div>

        {/* Action bar — appears on hover for AI messages */}
        {!isUser&&!isStream&&showActions&&(
          <div style={{
            display:"flex",gap:5,marginTop:6,
            animation:"fadeIn .14s ease"}}>
            {[
              {label:copied?"✓ Copied":"Copy",        action:()=>copy(msg.content,setCopied),    color:copied?C.emerald:C.textDim},
              {label:emailCopied?"✓":"Copy as Email", action:()=>copy(`Subject: Following up\n\n${msg.content}`,setEmailCopied), color:emailCopied?C.emerald:C.textDim},
              {label:saved?"✓ Saved":"Save to Notes", action:()=>{ onSaveNote(msg.content); setSaved(true); setTimeout(()=>setSaved(false),2000); }, color:saved?C.emerald:C.textDim},
              isLast&&{label:"Regenerate",             action:onRegenerate,                        color:C.indigo},
            ].filter(Boolean).map((btn,i)=>(
              <button key={i} onClick={btn.action}
                style={{background:C.surface,border:`1px solid ${C.border}`,
                  color:btn.color,borderRadius:6,padding:"4px 9px",
                  cursor:"pointer",fontSize:9,fontFamily:C.F,
                  fontWeight:700,letterSpacing:.6,transition:"all .14s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(255,255,255,.14)"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        {msg.timestamp&&(
          <div style={{fontSize:8,color:C.textDim,fontFamily:C.F,
            marginTop:4,textAlign:isUser?"right":"left",letterSpacing:.3}}>
            {new Date(msg.timestamp).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"})}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator(){
  return(
    <div style={{display:"flex",gap:10,marginBottom:16,alignItems:"flex-end"}}>
      <div style={{width:28,height:28,borderRadius:"50%",
        background:`linear-gradient(135deg,${C.emerald},${C.cyan})`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>S</div>
      <div style={{background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
        border:`1px solid ${C.border}`,borderRadius:"14px 14px 14px 4px",
        padding:"12px 16px",display:"flex",gap:5,alignItems:"center"}}>
        {[0,1,2].map(i=>(
          <div key={i} style={{width:6,height:6,borderRadius:"50%",
            background:C.emerald,opacity:.7,
            animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SAVED NOTES PANEL
// ─────────────────────────────────────────────────────────────────────────────
function NotesPanel({ onClose }){
  const [notes, setNotes] = useState(()=>lsGet(LS_NOTES_KEY,[]));
  function deleteNote(i){ const n=[...notes]; n.splice(i,1); setNotes(n); lsSet(LS_NOTES_KEY,n); }
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,
      background:C.bg,zIndex:10,display:"flex",flexDirection:"column",
      animation:"scaleIn .2s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
        padding:"16px 0",borderBottom:`1px solid ${C.border}`,marginBottom:14,flexShrink:0}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.text}}>
          Saved Notes ({notes.length})
        </div>
        <button onClick={onClose}
          style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textDim,borderRadius:7,padding:"5px 10px",
            cursor:"pointer",fontSize:11,fontFamily:C.F}}>Close</button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        {notes.length===0?(
          <div style={{textAlign:"center",padding:"40px 0",color:C.textDim,fontFamily:C.F,fontSize:12}}>
            No saved notes yet. Hover over any SPARK response and click "Save to Notes".
          </div>
        ):(
          notes.map((note,i)=>(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:10,padding:"13px 14px",marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",
                alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
                  {new Date(note.savedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
                </span>
                <div style={{display:"flex",gap:6}}>
                  <button onClick={()=>navigator.clipboard.writeText(note.text)}
                    style={{background:"transparent",border:`1px solid ${C.border}`,
                      color:C.textDim,borderRadius:5,padding:"2px 7px",
                      cursor:"pointer",fontSize:8,fontFamily:C.F,fontWeight:700}}>COPY</button>
                  <button onClick={()=>deleteNote(i)}
                    style={{background:"transparent",border:"none",
                      color:C.rose,cursor:"pointer",fontSize:12}}>✕</button>
                </div>
              </div>
              <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.6}}>
                {note.text.slice(0,300)}{note.text.length>300?"...":""}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ASSISTANT
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// RESPONSE SANITIZER — strips JSON/code blocks, extracts readable content
// ─────────────────────────────────────────────────────────────────────────────
function sanitizeResponse(text){
  if(!text) return text;

  // If entire response is a JSON code block, extract the content field
  const jsonBlockMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if(jsonBlockMatch){
    try{
      const parsed = JSON.parse(jsonBlockMatch[1]);
      // Try to extract the most readable field
      return parsed.content || parsed.text || parsed.message ||
        parsed.body || parsed.response || parsed.post ||
        Object.values(parsed).find(v=>typeof v==="string"&&v.length>50) ||
        JSON.stringify(parsed, null, 2);
    }catch{
      // Not valid JSON — just strip the code fence
      return jsonBlockMatch[1].trim();
    }
  }

  // Strip any inline code fences
  let clean = text.replace(/```(?:json|javascript|js|text)?\n?/g,"").replace(/```/g,"");

  // If it starts with { or [ and looks like JSON, try to extract content
  const trimmed = clean.trim();
  if((trimmed.startsWith("{") || trimmed.startsWith("["))){
    try{
      const parsed = JSON.parse(trimmed);
      if(typeof parsed === "object"){
        const readable = parsed.content || parsed.text || parsed.message ||
          parsed.body || parsed.response || parsed.post ||
          Object.values(parsed).find(v=>typeof v==="string"&&v.length>50);
        if(readable) return readable;
      }
    }catch{ /* not JSON, return as-is */ }
  }

  return clean.trim();
}

export default function SparkAssistant({ user, voice, planKey }){
  const [messages,      setMessages]     = useState(()=>lsGet(LS_KEY,[]));
  const [input,         setInput]        = useState("");
  const [loading,       setLoading]      = useState(false);
  const [streaming,     setStreaming]    = useState(false);
  const [mode,          setMode]         = useState(()=>lsGet(LS_MODE_KEY,"write"));
  const [showNotes,     setShowNotes]    = useState(false);
  const [showQuick,     setShowQuick]    = useState(true);
  const [briefing,      setBriefing]     = useState(null);
  const [googleData,    setGoogleData]   = useState(null);
  const [googleLoading, setGoogleLoading]= useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef    = useRef(null);
  const abortRef       = useRef(null);

  useEffect(()=>{ lsSet(LS_KEY, messages.slice(-60)); }, [messages]);
  useEffect(()=>{ lsSet(LS_MODE_KEY, mode); }, [mode]);
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:"smooth"}); }, [messages, loading]);

  // Fetch Google data on mount if connected
  useEffect(()=>{
    if(!user?.email) return;
    if(lsGet("spark_google_connected", false)) fetchGoogleData();
  }, [user?.email]);

  // Opening briefing on mount
  useEffect(()=>{
    if(messages.length===0) setBriefing(buildOpeningBriefing(voice));
  },[]);

  async function fetchGoogleData(){
    setGoogleLoading(true);
    try{
      const r = await fetch("/api/google-data",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ email:user.email, action:"fetch" }),
      });
      const d = await r.json();
      if(d.connected){ setGoogleData(d); lsSet("spark_google_connected",true); }
      else if(d.disconnected){ lsSet("spark_google_connected",false); setGoogleData(null); }
    }catch(e){ console.warn("Google fetch failed:",e); }
    setGoogleLoading(false);
  }

  function buildGoogleContext(){
    if(!googleData) return "";
    const lines = ["\nGOOGLE INTEGRATION (live data):"];
    lines.push(`Connected Gmail: ${googleData.googleEmail}`);

    // Calendar events
    if(googleData.events?.length > 0){
      lines.push(`\nUPCOMING CALENDAR (next 7 days, ${googleData.events.length} events):`);
      googleData.events.forEach(e=>{
        const urgency = e.isToday?" 🔴 TODAY":e.isTomorrow?" 🟡 TOMORROW":"";
        lines.push(`- ${e.title}${urgency} · ${e.start}${e.location?` · ${e.location}`:""}${e.attendees?.length?` · with: ${e.attendees.slice(0,3).join(", ")}`:""}${e.description?` · notes: ${e.description.slice(0,80)}`:""}`);
      });
    } else {
      lines.push("\nCALENDAR: No upcoming events in next 7 days");
    }

    // Recent emails
    if(googleData.emails?.length > 0){
      lines.push(`\nRECENT INBOX (${googleData.emails.length} threads):`);
      googleData.emails.slice(0,8).forEach(e=>{
        lines.push(`- From: ${e.from.split("<")[0].trim()} · Subject: ${e.subject} · Preview: ${e.snippet.slice(0,100)}`);
      });
    }

    return lines.join("\n");
  }

  function buildSystem(){
    const ctx        = buildAgentContext(voice, planKey);
    const googleCtx  = buildGoogleContext();
    const modeInst   = MODES[mode]?.instruction || "";
    return `You are SPARK, an elite AI business partner built exclusively for real estate agents. You are deeply integrated into this agent's business — you have full context about their clients, pipeline, deals, goals, communication style, calendar, and email inbox.

${ctx}
${googleCtx}

${modeInst}

CORE RULES:
- NEVER respond with JSON, code blocks, or markdown code fences (no \`\`\`json or \`\`\` of any kind)
- NEVER output structured data formats — always respond in natural, conversational prose
- Write like a knowledgeable business partner having a real conversation, not a software tool
- Reference specific clients, deal names, and numbers from the context above when relevant
- When the agent has calendar events, proactively mention upcoming appointments and offer prep
- When the agent asks about emails, reference their actual inbox threads
- Use the agent's name and brokerage in scripts when their profile is set
- Write all communications in the agent's preferred tone
- Be direct and specific — no generic advice, always connect to their actual situation
- Use **bold** sparingly for key points and line breaks for readability
- Scripts and messages should be word-for-word ready with minimal editing needed
- Sound warm, sharp, and human — like the best business partner they've ever had`;
  }

  async function sendMessage(content, isRegenerate=false){
    if(!content.trim()||loading) return;

    // Cancel any in-progress stream
    if(abortRef.current) abortRef.current.abort();

    const userMsg   = { role:"user", content:content.trim(), timestamp:Date.now() };
    const baseMessages = isRegenerate
      ? messages.slice(0,-1)  // remove last AI message for regenerate
      : [...messages, userMsg];

    if(!isRegenerate) setMessages(baseMessages);
    else setMessages(prev=>prev.slice(0,-1));

    setInput("");
    setShowQuick(false);
    setBriefing(null);
    setLoading(true);

    if(textareaRef.current) textareaRef.current.style.height="44px";

    try{
      const history = baseMessages.slice(-30).map(m=>({role:m.role,content:m.content}));

      const r = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:buildSystem(),
          messages:isRegenerate?history:[...history.slice(0,-1),{role:"user",content:content.trim()}],
        })
      });

      const d = await r.json();
      const raw  = d.content?.[0]?.text || "I couldn't generate a response — please try again.";
      const text = sanitizeResponse(raw);

      // Simulate streaming by revealing text progressively
      setLoading(false);
      setStreaming(true);
      const streamMsg = { role:"assistant", content:"", streaming:true, timestamp:Date.now() };
      setMessages(prev=>[...prev, streamMsg]);

      const words  = text.split(" ");
      const chunk  = Math.max(1, Math.floor(words.length/40)); // ~40 chunks
      let   idx    = 0;

      const interval = setInterval(()=>{
        idx += chunk;
        const revealed = words.slice(0,idx).join(" ");
        const done     = idx >= words.length;
        setMessages(prev=>{
          const updated = [...prev];
          updated[updated.length-1] = {
            role:"assistant",
            content: done ? text : revealed,
            streaming: !done,
            timestamp:Date.now()
          };
          return updated;
        });
        if(done){ clearInterval(interval); setStreaming(false); }
      }, 28);

    }catch(e){
      setLoading(false);
      setStreaming(false);
      setMessages(prev=>[...prev,{
        role:"assistant",
        content:"Connection error — please check your internet and try again.",
        timestamp:Date.now()
      }]);
    }
  }

  function saveNote(text){
    const notes = lsGet(LS_NOTES_KEY,[]);
    lsSet(LS_NOTES_KEY,[{text,savedAt:new Date().toISOString()},...notes].slice(0,50));
  }

  function handleKey(e){
    if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMessage(input); }
  }

  function autoResize(e){
    e.target.style.height="44px";
    e.target.style.height=Math.min(e.target.scrollHeight,140)+"px";
  }

  function clearHistory(){
    if(window.confirm("Clear conversation history?")){ setMessages([]); setShowQuick(true); setBriefing(buildOpeningBriefing(voice)); }
  }

  const hasMessages  = messages.length > 0;
  const currentMode  = MODES[mode];
  const smartPrompts = getSmartPrompts(voice, mode);
  const savedNotes   = lsGet(LS_NOTES_KEY,[]).length;
  const isGoogleConnected = !!googleData?.connected;

  // Inject upcoming-appointment quick prompts if Google connected
  const calendarPrompts = isGoogleConnected && googleData.events?.length > 0
    ? googleData.events
        .filter(e=>e.isToday||e.isTomorrow||e.daysUntil<=3)
        .slice(0,2)
        .map(e=>({
          label:`Prep: ${e.title}`,
          icon:"📅",
          color:e.isToday?C.rose:C.amber,
          urgent:e.isToday,
          prompt:`I have "${e.title}" ${e.isToday?"today":e.isTomorrow?"tomorrow":`in ${e.daysUntil} days`} at ${e.start}${e.location?` at ${e.location}`:""}${e.attendees?.length?` with ${e.attendees.join(", ")}`:""}. Give me a complete prep package — key talking points, questions to ask, potential objections, and how to open the meeting.`,
        }))
    : [];

  const allPrompts = [...calendarPrompts, ...smartPrompts].slice(0,8);

  return(
    <div style={{display:"flex",flexDirection:"column",
      height:"calc(100vh - 170px)",minHeight:450,
      position:"relative"}}>

      {/* Notes panel overlay */}
      {showNotes&&<NotesPanel onClose={()=>setShowNotes(false)}/>}

      {/* ── HEADER ── */}
      <div style={{flexShrink:0,marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",
          justifyContent:"space-between",marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,
              background:`linear-gradient(135deg,${C.emerald},${C.indigo})`,
              display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:17,boxShadow:`0 3px 12px ${C.emerald}28`}}>⚡</div>
            <div>
              <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,
                display:"flex",alignItems:"center",gap:6}}>
                SPARK Assistant
                <span style={{fontSize:9,background:`${currentMode.color}14`,
                  border:`1px solid ${currentMode.color}30`,color:currentMode.color,
                  borderRadius:10,padding:"1px 7px",fontWeight:700,letterSpacing:.8}}>
                  {currentMode.icon} {currentMode.label.toUpperCase()}
                </span>
              </div>
              <div style={{fontFamily:C.F,fontSize:9,color:C.emerald,marginTop:2,
                display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:4,height:4,borderRadius:"50%",
                  background:C.emerald,boxShadow:`0 0 4px ${C.emerald}`}}/>
                Knows your business · Always on
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            {/* Google status */}
            {isGoogleConnected&&(
              <div style={{display:"flex",alignItems:"center",gap:5,
                background:"rgba(16,185,129,.08)",border:"1px solid rgba(16,185,129,.2)",
                borderRadius:7,padding:"4px 9px",cursor:"pointer"}}
                onClick={fetchGoogleData}
                title="Google connected — click to refresh">
                <div style={{width:5,height:5,borderRadius:"50%",
                  background:C.emerald,boxShadow:`0 0 4px ${C.emerald}`}}/>
                <span style={{fontSize:9,color:C.emerald,fontFamily:C.F,fontWeight:700}}>
                  {googleLoading?"syncing...":"Google"}
                </span>
              </div>
            )}
            {savedNotes>0&&(
              <button onClick={()=>setShowNotes(true)}
                style={{background:`${C.violet}10`,border:`1px solid ${C.violet}28`,
                  color:C.violet,borderRadius:7,padding:"5px 9px",cursor:"pointer",
                  fontSize:9,fontFamily:C.F,fontWeight:700}}>
                📌 {savedNotes}
              </button>
            )}
            {hasMessages&&(
              <button onClick={clearHistory}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textDim,borderRadius:7,padding:"5px 9px",
                  cursor:"pointer",fontSize:9,fontFamily:C.F}}>Clear</button>
            )}
          </div>
        </div>

        {/* Mode selector */}
        <div style={{display:"flex",gap:5,
          background:"rgba(255,255,255,.02)",borderRadius:10,padding:3}}>
          {Object.entries(MODES).map(([key,m])=>(
            <button key={key} onClick={()=>setMode(key)}
              style={{flex:1,padding:"6px 4px",borderRadius:7,
                border:`1px solid ${mode===key?m.color+"30":"transparent"}`,
                background:mode===key?`linear-gradient(135deg,${m.color}14,${m.color}06)`:"transparent",
                color:mode===key?m.color:C.textDim,cursor:"pointer",
                fontSize:9,fontWeight:700,fontFamily:C.F,letterSpacing:.5,
                transition:"all .14s ease"}}>
              {m.icon} {m.label.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── MESSAGES ── */}
      <div style={{flex:1,overflowY:"auto",paddingRight:2,
        scrollbarWidth:"thin",scrollbarColor:`rgba(255,255,255,.06) transparent`}}>

        {/* Proactive opening briefing */}
        {!hasMessages&&briefing&&(
          <div style={{
            background:`linear-gradient(135deg,${C.indigo}10,${C.emerald}06)`,
            border:`1px solid ${C.indigo}20`,borderRadius:13,
            padding:"16px 16px",marginBottom:16,
            animation:"fadeUp .4s ease"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,
                background:`linear-gradient(135deg,${C.emerald},${C.cyan})`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:12,fontWeight:800,color:"#fff"}}>S</div>
              <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,
                lineHeight:1.75,whiteSpace:"pre-wrap",flex:1}}>
                {briefing}
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!hasMessages&&(
          <div>
            <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,
              fontWeight:700,marginBottom:10,textAlign:"center"}}>
              {allPrompts.some(p=>p.urgent)?"⚠️ NEEDS ATTENTION · QUICK STARTS":"QUICK STARTS"}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
              {allPrompts.map((p,i)=>(
                <button key={i} onClick={()=>sendMessage(p.prompt)}
                  style={{
                    background:p.urgent?`${C.rose}06`:C.surface,
                    border:`1px solid ${p.urgent?C.rose+"28":C.border}`,
                    borderRadius:10,padding:"11px 12px",
                    cursor:"pointer",textAlign:"left",
                    transition:"all .15s ease",
                    animation:`fadeUp .28s ease ${i*.04}s both`}}
                  onMouseEnter={e=>{
                    e.currentTarget.style.borderColor=p.urgent?C.rose+"55":`${p.color||C.indigo}44`;
                    e.currentTarget.style.transform="translateY(-1px)";
                  }}
                  onMouseLeave={e=>{
                    e.currentTarget.style.borderColor=p.urgent?C.rose+"28":C.border;
                    e.currentTarget.style.transform="translateY(0)";
                  }}>
                  <div style={{fontSize:15,marginBottom:4}}>{p.icon}</div>
                  <div style={{fontFamily:C.F,fontWeight:700,fontSize:11,
                    color:p.urgent?C.rose:C.text,lineHeight:1.3}}>{p.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg,i)=>(
          <Message
            key={i} msg={msg}
            isLast={i===messages.length-1&&msg.role==="assistant"}
            onRegenerate={()=>{ const lastUser=messages.filter(m=>m.role==="user").slice(-1)[0]; if(lastUser) sendMessage(lastUser.content,true); }}
            onSaveNote={saveNote}
          />
        ))}
        {loading&&<TypingIndicator/>}
        <div ref={messagesEndRef}/>
      </div>

      {/* ── INPUT ── */}
      <div style={{flexShrink:0,borderTop:`1px solid ${C.border}`,paddingTop:10,marginTop:8}}>

        {/* Follow-up chips */}
        {hasMessages&&!loading&&!streaming&&(
          <div style={{display:"flex",gap:5,marginBottom:8,overflowX:"auto",paddingBottom:2}}>
            {["Make it shorter","Different version","More professional",
              "More casual","Add urgency","Write the email version",
              "Give me a script","What should I say next?"].map((s,i)=>(
              <button key={i} onClick={()=>sendMessage(s)}
                style={{background:"rgba(255,255,255,.025)",border:`1px solid ${C.border}`,
                  borderRadius:14,padding:"4px 10px",cursor:"pointer",
                  whiteSpace:"nowrap",flexShrink:0,fontSize:9,
                  color:C.textDim,fontFamily:C.F,fontWeight:600,
                  transition:"all .12s"}}
                onMouseEnter={e=>{e.currentTarget.style.color=C.indigoLt;e.currentTarget.style.borderColor="rgba(99,102,241,.28)";}}
                onMouseLeave={e=>{e.currentTarget.style.color=C.textDim;e.currentTarget.style.borderColor=C.border;}}>
                {s}
              </button>
            ))}
          </div>
        )}

        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <textarea ref={textareaRef}
            value={input}
            onChange={e=>{ setInput(e.target.value); autoResize(e); }}
            onKeyDown={handleKey}
            placeholder={voice?.saved
              ? `Ask anything, ${voice.name?.split(" ")[0]||""}... (${currentMode.description})`
              : `Ask anything... (${currentMode.description})`}
            rows={1}
            style={{flex:1,background:C.surfaceUp,
              border:`1px solid ${C.borderMd}`,borderRadius:11,
              padding:"11px 14px",color:C.text,fontFamily:C.F,
              fontSize:13,resize:"none",lineHeight:1.5,
              height:44,maxHeight:140,outline:"none",
              boxSizing:"border-box",transition:"border-color .16s,box-shadow .16s"}}
            onFocus={e=>{
              e.target.style.borderColor=`${currentMode.color}55`;
              e.target.style.boxShadow=`0 0 0 3px ${currentMode.color}10`;
            }}
            onBlur={e=>{
              e.target.style.borderColor=C.borderMd;
              e.target.style.boxShadow="none";
            }}/>

          <button onClick={()=>sendMessage(input)}
            disabled={loading||streaming||!input.trim()}
            style={{width:44,height:44,borderRadius:11,flexShrink:0,
              background:input.trim()&&!loading&&!streaming
                ?`linear-gradient(135deg,${currentMode.color},${currentMode.color}cc)`
                :"rgba(255,255,255,.05)",
              border:"none",
              cursor:input.trim()&&!loading&&!streaming?"pointer":"default",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:input.trim()&&!loading&&!streaming?`0 4px 14px ${currentMode.color}30`:"none",
              transition:"all .18s ease"}}>
            {loading
              ? <div style={{width:16,height:16,borderRadius:"50%",
                  border:`2px solid ${currentMode.color}`,borderTopColor:"transparent",
                  animation:"spin .7s linear infinite"}}/>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={input.trim()&&!streaming?"#fff":C.textDim}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
            }
          </button>
        </div>

        <p style={{fontFamily:C.F,fontSize:8,color:C.textDim,
          margin:"7px 0 0",textAlign:"center",letterSpacing:.4}}>
          Enter to send · Shift+Enter for new line · Hover responses for actions
        </p>
      </div>
    </div>
  );
}
