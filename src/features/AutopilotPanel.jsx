// src/features/AutopilotPanel.jsx
// SPARK AUTOPILOT — Premium-exclusive AI business intelligence layer
// Monitors clients, deals, market, relationships — surfaces the right action at the right moment

import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
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

const AP_KEY     = "spark_autopilot_v1";       // last autopilot run result
const MEMORY_KEY = "spark_autopilot_memory_v1"; // pattern memory across runs
const RUN_KEY    = "spark_autopilot_last_run";  // timestamp of last run

function lsGet(key, fallback){ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fallback; }catch{ return fallback; } }
function lsSet(key, val){ try{ localStorage.setItem(key, JSON.stringify(val)); }catch{} }

// ─────────────────────────────────────────────────────────────────────────────
// DATA AGGREGATOR — reads all platform data for analysis
// ─────────────────────────────────────────────────────────────────────────────
function aggregateBusinessData(voice){
  const clients    = lsGet("spark_clients_v1", []);
  const pipeline   = lsGet("spark_pipeline_value_v1", []);
  const goals      = lsGet("spark_biz_goals_v1", {});
  const usage      = lsGet("sp_usage_stats", {});
  const history    = lsGet("spark_content_history_v1", []);
  const memory     = lsGet(MEMORY_KEY, {});
  const now        = Date.now();

  // Calculate days since last contact per client
  const clientsWithMetrics = clients.map(c => {
    const daysSince = c.lastContact
      ? Math.round((now - new Date(c.lastContact)) / 864e5)
      : null;
    const daysToTimeline = c.timeline
      ? null // can't parse free text reliably
      : null;
    return { ...c, daysSince };
  });

  // Overdue clients (7+ days)
  const overdue = clientsWithMetrics.filter(c => c.daysSince !== null && c.daysSince > 7)
    .sort((a,b) => b.daysSince - a.daysSince);

  // Deals closing soon
  const urgentDeals = pipeline.filter(d => {
    if(!d.closeDate) return false;
    const days = Math.round((new Date(d.closeDate) - now) / 864e5);
    return days >= 0 && days <= 21;
  }).sort((a,b) => new Date(a.closeDate) - new Date(b.closeDate));

  // At-risk deals (high value + long since contact)
  const atRiskDeals = pipeline.filter(d => {
    const client = clients.find(c =>
      c.name?.toLowerCase().includes(d.name?.toLowerCase()?.split(" ")[0]) ||
      d.name?.toLowerCase().includes(c.name?.toLowerCase()?.split(" ")[0])
    );
    const prob = parseFloat(d.probability) || 50;
    return prob < 60 || (client && client.daysSince > 7);
  });

  // Pipeline value metrics
  const totalPipeline = pipeline.reduce((s,d) => s + (parseFloat(d.value)||0), 0);
  const weightedPipeline = pipeline.reduce((s,d) =>
    s + (parseFloat(d.value)||0) * (parseFloat(d.probability)||50)/100, 0);

  // GCI progress
  const monthlyTarget = parseFloat(goals.monthlyGciTarget?.replace(/[$,]/g,"")) || 0;
  const currentGci    = parseFloat(goals.currentMonth?.replace(/[$,]/g,"")) || 0;
  const gciGap        = monthlyTarget > 0 ? monthlyTarget - currentGci : null;

  // Content activity
  const recentContent = history.slice(0, 5);
  const lastGenDaysAgo = usage.lastGenDate
    ? Math.round((now - new Date(usage.lastGenDate)) / 864e5)
    : null;

  // Past clients (closed, for referral timing)
  const closedClients = clients.filter(c => c.stage === "closed");
  const referralOpps = closedClients.filter(c => {
    // Find clients closed 11-13 months ago (anniversary window)
    if(!c.lastContact) return false;
    const monthsAgo = Math.round((now - new Date(c.lastContact)) / (864e5 * 30));
    return monthsAgo >= 10 && monthsAgo <= 13;
  });

  return {
    // Agent identity
    agentName:    voice?.name || "Agent",
    agentMarket:  voice?.market || "",
    agentBrokerage: voice?.brokerage || "",

    // Client intelligence
    totalClients:    clients.length,
    activeClients:   clients.filter(c => c.stage === "active").length,
    contractClients: clients.filter(c => c.stage === "contract").length,
    prospectClients: clients.filter(c => c.stage === "prospect").length,
    closedCount:     closedClients.length,
    overdueClients:  overdue,
    referralOpps,
    allClients:      clientsWithMetrics,

    // Deal intelligence
    totalDeals:     pipeline.length,
    urgentDeals,
    atRiskDeals,
    totalPipeline,
    weightedPipeline,

    // Business metrics
    monthlyTarget,
    currentGci,
    gciGap,
    gciPct: monthlyTarget > 0 ? Math.round((currentGci/monthlyTarget)*100) : null,
    avgCommission: parseFloat(goals.avgCommission) || 0,

    // Activity
    totalGenerations: usage.total || 0,
    streak:          usage.streak || 0,
    lastGenDaysAgo,
    recentContent,

    // Memory (patterns from previous runs)
    memory,

    // Today
    today: new Date().toLocaleDateString("en-US", {
      weekday:"long", month:"long", day:"numeric", year:"numeric"
    }),
    dayOfWeek: new Date().toLocaleDateString("en-US", { weekday:"long" }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOPILOT ENGINE — Claude-powered business analysis
// ─────────────────────────────────────────────────────────────────────────────
async function runAutopilotEngine(data){
  const clientDetails = data.allClients.map(c =>
    `${c.name} (${c.type}, ${c.stage}, last contact: ${c.daysSince !== null ? c.daysSince+"d ago" : "unknown"}${c.daysSince > 7 ? " ⚠️ OVERDUE" : ""}, property: ${c.property||"unknown"}, budget: ${c.budget||"?"}, timeline: ${c.timeline||"?"}, motivation: ${c.motivation||"?"}, notes: ${c.notes?.slice(0,80)||"none"}, next action: ${c.nextAction||"none"})`
  ).join("\n");

  const dealDetails = data.urgentDeals.concat(
    data.atRiskDeals.filter(d => !data.urgentDeals.find(u => u.id === d.id))
  ).map(d => {
    const days = d.closeDate ? Math.round((new Date(d.closeDate) - Date.now()) / 864e5) : null;
    return `${d.name}: $${(parseFloat(d.value)||0).toLocaleString()}, ${d.stage||"unknown stage"}, ${d.probability||50}% probability${days !== null ? `, closes in ${days} days` : ""}`;
  }).join("\n");

  const prompt = `You are SPARK Autopilot — the most advanced AI business intelligence system ever built for real estate agents. Your job is to analyze this agent's complete business data and generate a prioritized mission, risk alerts, relationship intelligence, and actionable insights.

AGENT: ${data.agentName}, ${data.agentBrokerage}, ${data.agentMarket}
TODAY: ${data.today}

PIPELINE SNAPSHOT:
- Active clients: ${data.activeClients}
- Under contract: ${data.contractClients}
- Prospects: ${data.prospectClients}
- Total pipeline value: $${Math.round(data.totalPipeline).toLocaleString()}
- Weighted value: $${Math.round(data.weightedPipeline).toLocaleString()}
- Monthly GCI target: ${data.monthlyTarget ? "$"+data.monthlyTarget.toLocaleString() : "not set"}
- Current month GCI: ${data.currentGci ? "$"+data.currentGci.toLocaleString() : "not set"}
- Progress to target: ${data.gciPct !== null ? data.gciPct+"%" : "unknown"}

CLIENTS (${data.totalClients} total):
${clientDetails || "No clients in pipeline"}

URGENT DEALS (closing soon or at risk):
${dealDetails || "No urgent deals"}

OVERDUE FOLLOW-UPS (${data.overdueClients.length}):
${data.overdueClients.map(c => `${c.name}: ${c.daysSince} days since last contact`).join("\n") || "None"}

REFERRAL OPPORTUNITIES:
${data.referralOpps.map(c => `${c.name}: closed ~${Math.round((Date.now()-new Date(c.lastContact))/(864e5*30))} months ago`).join("\n") || "None in window"}

ACTIVITY:
- Total content generated: ${data.totalGenerations}
- Day streak: ${data.streak}
- Last generation: ${data.lastGenDaysAgo !== null ? data.lastGenDaysAgo+"d ago" : "never"}

${data.memory.patterns ? `LEARNED PATTERNS:\n${data.memory.patterns}` : ""}

Generate a comprehensive Autopilot intelligence report. Return ONLY a single valid JSON object with no text before or after it, no markdown, no code fences:
{"mission":{"headline":"today's single most important strategic priority — specific, 1 sentence","why":"why this is the priority today referencing actual data — 1-2 sentences","top3":[{"rank":1,"action":"specific action","client":"client or deal name","urgency":"critical","message":"exact word-for-word message to send — ready to copy"},{"rank":2,"action":"specific action","client":"name","urgency":"high","message":"exact message"},{"rank":3,"action":"specific action","client":"name","urgency":"medium","message":"exact message"}]},"deal_intelligence":{"overall_health":"stable","health_summary":"honest 2 sentence pipeline assessment","risks":[{"deal":"name","risk":"specific risk","severity":"high","action":"what to do","message":"exact message to address this risk"}],"opportunities":[{"description":"specific opportunity","action":"how to capitalize"}]},"client_scores":[{"name":"client name","score":80,"trend":"stable","reason":"why this score","next_action":"most important next step","probability":"70%"}],"relationship_alerts":[{"type":"overdue","client":"name","days":9,"message":"exact personal message to send","reason":"why reach out now"}],"market_intelligence":{"insight":"one actionable market insight relevant to their pipeline","opportunity":"specific market condition to capitalize on","talking_point":"most powerful talking point for client conversations this week"},"coaching_insight":{"observation":"honest pattern from their business data","recommendation":"one concrete change for biggest impact","this_week":"single most impactful thing to do differently this week"},"performance_forecast":{"gci_projection":"projected GCI this month as dollar amount","deals_likely_to_close":"number","biggest_risk_to_target":"what could prevent hitting the goal","momentum":"rising"}}`;

  const r = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system: "You are SPARK Autopilot, the most advanced real estate business intelligence AI ever built. Analyze agent data deeply and generate highly specific, actionable intelligence. Every recommendation must reference actual client names, deal values, and specific situations. Never give generic advice. Return ONLY valid JSON — no markdown, no code fences.",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
    })
  });

  const d = await r.json();
  const raw = d.content?.[0]?.text || "";

  // Try multiple extraction strategies
  let parsed = null;

  // Strategy 1: direct parse
  try { parsed = JSON.parse(raw.trim()); } catch {}

  // Strategy 2: strip code fences then parse
  if(!parsed){
    try {
      const stripped = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      parsed = JSON.parse(stripped);
    } catch {}
  }

  // Strategy 3: extract first { ... } block
  if(!parsed){
    try {
      const first = raw.indexOf("{");
      const last  = raw.lastIndexOf("}");
      if(first !== -1 && last !== -1 && last > first){
        parsed = JSON.parse(raw.slice(first, last+1));
      }
    } catch {}
  }

  // Strategy 4: find largest JSON object in response
  if(!parsed){
    const matches = raw.match(/\{[\s\S]+\}/g);
    if(matches){
      for(const m of matches.sort((a,b)=>b.length-a.length)){
        try { parsed = JSON.parse(m); break; } catch {}
      }
    }
  }

  if(!parsed) throw new Error("Could not parse Autopilot response — raw: " + raw.slice(0,200));
  return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function APCard({ children, accent=C.indigo, style={} }){
  return(
    <div style={{
      background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
      border:`1px solid ${C.border}`,borderRadius:14,
      padding:"18px 16px",marginBottom:12,
      position:"relative",overflow:"hidden",...style}}>
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
  const [ok,setOk] = useState(false);
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
  const map = {
    critical:{ color:C.rose,   label:"CRITICAL" },
    high:    { color:C.amber,  label:"HIGH"     },
    medium:  { color:C.indigo, label:"MEDIUM"   },
    low:     { color:C.textDim,label:"LOW"      },
  };
  const m = map[urgency?.toLowerCase()] || map.medium;
  return(
    <span style={{fontSize:8,color:m.color,fontFamily:C.F,fontWeight:700,
      background:`${m.color}12`,border:`1px solid ${m.color}28`,
      borderRadius:8,padding:"2px 7px",letterSpacing:1,flexShrink:0}}>
      {m.label}
    </span>
  );
}

function HealthBadge({ health }){
  const map = {
    strong:  { color:C.emerald, icon:"↑", label:"STRONG"   },
    stable:  { color:C.cyan,    icon:"→", label:"STABLE"   },
    at_risk: { color:C.amber,   icon:"↓", label:"AT RISK"  },
    critical:{ color:C.rose,    icon:"!", label:"CRITICAL"  },
  };
  const m = map[health] || map.stable;
  return(
    <div style={{display:"flex",alignItems:"center",gap:5,
      background:`${m.color}10`,border:`1px solid ${m.color}25`,
      borderRadius:8,padding:"4px 10px"}}>
      <span style={{color:m.color,fontWeight:800,fontSize:12}}>{m.icon}</span>
      <span style={{fontSize:9,color:m.color,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>
        {m.label}
      </span>
    </div>
  );
}

function ScoreRing({ score }){
  const color = score >= 80 ? C.emerald : score >= 60 ? C.amber : C.rose;
  const r = 16, circ = 2 * Math.PI * r;
  const dash = (score/100) * circ;
  return(
    <svg width="40" height="40" viewBox="0 0 40 40" style={{flexShrink:0}}>
      <circle cx="20" cy="20" r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="3"/>
      <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 20 20)" style={{transition:"stroke-dasharray .6s ease"}}/>
      <text x="20" y="24" textAnchor="middle" fontSize="10" fontWeight="800"
        fontFamily="'Plus Jakarta Sans',sans-serif" fill={color}>{score}</text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: DAILY MISSION
// ─────────────────────────────────────────────────────────────────────────────
function MissionSection({ mission, runTime }){
  if(!mission) return null;
  const urgencyColors = { critical:C.rose, high:C.amber, medium:C.indigo };

  return(
    <div>
      {/* Mission headline */}
      <APCard accent={C.emerald} style={{
        background:`linear-gradient(135deg,rgba(16,185,129,.08),rgba(99,102,241,.04))`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
            background:`linear-gradient(135deg,${C.emerald},${C.indigo})`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
            boxShadow:`0 4px 16px rgba(16,185,129,.3)`}}>🎯</div>
          <div style={{flex:1}}>
            <div style={{fontSize:9,color:C.emerald,letterSpacing:2.5,
              fontFamily:C.F,fontWeight:700,marginBottom:6}}>TODAY'S MISSION</div>
            <p style={{fontFamily:C.F,fontWeight:800,fontSize:16,color:C.text,
              margin:"0 0 8px",lineHeight:1.3,letterSpacing:"-0.01em"}}>
              {mission.headline}
            </p>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,
              margin:0,lineHeight:1.6}}>{mission.why}</p>
          </div>
        </div>
        {runTime&&(
          <div style={{marginTop:12,fontSize:9,color:C.textDim,fontFamily:C.F,
            textAlign:"right"}}>
            Last run: {new Date(runTime).toLocaleTimeString("en-US",{
              hour:"numeric",minute:"2-digit"
            })}
          </div>
        )}
      </APCard>

      {/* Top 3 actions */}
      <APCard accent={C.indigo}>
        <APLabel color={C.indigo}>PRIORITY ACTION QUEUE</APLabel>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {(mission.top3||[]).map((item,i)=>(
            <div key={i} style={{
              background:`${urgencyColors[item.urgency?.toLowerCase()]||C.indigo}06`,
              border:`1px solid ${urgencyColors[item.urgency?.toLowerCase()]||C.indigo}20`,
              borderRadius:11,padding:"13px 14px",
              animation:`slideR .25s ease ${i*.08}s both`}}>
              <div style={{display:"flex",alignItems:"center",
                justifyContent:"space-between",marginBottom:8}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:22,height:22,borderRadius:"50%",
                    background:`${urgencyColors[item.urgency?.toLowerCase()]||C.indigo}18`,
                    border:`1px solid ${urgencyColors[item.urgency?.toLowerCase()]||C.indigo}30`,
                    display:"flex",alignItems:"center",justifyContent:"center",
                    fontSize:10,color:urgencyColors[item.urgency?.toLowerCase()]||C.indigo,
                    fontWeight:800,flexShrink:0}}>
                    {item.rank}
                  </div>
                  <div>
                    <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text}}>
                      {item.action}
                    </div>
                    {item.client&&(
                      <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>
                        {item.client}
                      </div>
                    )}
                  </div>
                </div>
                <UrgencyBadge urgency={item.urgency}/>
              </div>
              {item.message&&(
                <div style={{background:"rgba(255,255,255,.025)",border:`1px solid ${C.border}`,
                  borderRadius:8,padding:"10px 12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:6}}>
                    <span style={{fontSize:8,color:C.textDim,fontFamily:C.F,
                      fontWeight:700,letterSpacing:1.5}}>MESSAGE TO SEND</span>
                    <APCopyBtn text={item.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,
                    margin:0,lineHeight:1.65,whiteSpace:"pre-wrap"}}>{item.message}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </APCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: DEAL INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────
function DealIntelligence({ dealIntelligence }){
  if(!dealIntelligence) return null;
  return(
    <div>
      <APCard accent={C.violet}>
        <div style={{display:"flex",justifyContent:"space-between",
          alignItems:"center",marginBottom:12}}>
          <APLabel color={C.violet}>DEAL INTELLIGENCE</APLabel>
          <HealthBadge health={dealIntelligence.overall_health}/>
        </div>
        <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,
          margin:0,lineHeight:1.7}}>{dealIntelligence.health_summary}</p>
      </APCard>

      {/* Risks */}
      {dealIntelligence.risks?.length>0&&(
        <APCard accent={C.rose}>
          <APLabel color={C.rose}>DEAL RISKS DETECTED</APLabel>
          {dealIntelligence.risks.map((risk,i)=>(
            <div key={i} style={{marginBottom:i<dealIntelligence.risks.length-1?14:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}>
                <div style={{width:6,height:6,borderRadius:"50%",
                  background:risk.severity==="high"?C.rose:C.amber,
                  boxShadow:`0 0 5px ${risk.severity==="high"?C.rose:C.amber}`,
                  flexShrink:0}}/>
                <div>
                  <span style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>
                    {risk.deal}
                  </span>
                  <span style={{fontFamily:C.F,fontSize:11,color:C.textDim,
                    marginLeft:8}}>— {risk.risk}</span>
                </div>
              </div>
              {risk.message&&(
                <div style={{background:"rgba(244,63,94,.04)",
                  border:"1px solid rgba(244,63,94,.14)",
                  borderRadius:8,padding:"9px 11px",marginLeft:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:8,color:C.rose,fontFamily:C.F,
                      fontWeight:700,letterSpacing:1.5}}>RECOVERY MESSAGE</span>
                    <APCopyBtn text={risk.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,
                    margin:0,lineHeight:1.6}}>{risk.message}</p>
                </div>
              )}
            </div>
          ))}
        </APCard>
      )}

      {/* Opportunities */}
      {dealIntelligence.opportunities?.length>0&&(
        <APCard accent={C.emerald}>
          <APLabel color={C.emerald}>OPPORTUNITIES</APLabel>
          {dealIntelligence.opportunities.map((opp,i)=>(
            <div key={i} style={{display:"flex",gap:9,padding:"7px 0",
              borderBottom:i<dealIntelligence.opportunities.length-1?
                `1px solid ${C.border}`:"none"}}>
              <div style={{width:16,height:16,borderRadius:"50%",flexShrink:0,
                background:`${C.emerald}14`,border:`1px solid ${C.emerald}24`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:8,color:C.emerald,fontWeight:800}}>✦</div>
              <div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.text,
                  margin:"0 0 3px",fontWeight:600}}>{opp.description}</p>
                <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,
                  margin:0,lineHeight:1.5}}>{opp.action}</p>
              </div>
            </div>
          ))}
        </APCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: CLIENT SCORES
// ─────────────────────────────────────────────────────────────────────────────
function ClientScores({ scores }){
  if(!scores?.length) return null;
  const trendIcon = t => t==="rising"?"↑":t==="falling"?"↓":"→";
  const trendColor = t => t==="rising"?C.emerald:t==="falling"?C.rose:C.textDim;

  return(
    <APCard accent={C.cyan}>
      <APLabel color={C.cyan}>CLIENT PROBABILITY SCORES</APLabel>
      <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:"0 0 14px",lineHeight:1.5}}>
        Likelihood to transact in the next 30 days, scored from your pipeline data.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {scores.slice(0,6).map((client,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,
            background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
            borderRadius:10,padding:"11px 13px",
            animation:`slideR .22s ease ${i*.05}s both`}}>
            <ScoreRing score={client.score||50}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:3}}>
                <span style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text}}>
                  {client.name}
                </span>
                <span style={{fontSize:11,color:trendColor(client.trend),fontWeight:700}}>
                  {trendIcon(client.trend)}
                </span>
                {client.probability&&(
                  <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
                    {client.probability}% likely
                  </span>
                )}
              </div>
              <p style={{fontFamily:C.F,fontSize:10,color:C.textDim,margin:"0 0 5px",
                lineHeight:1.4}}>{client.reason}</p>
              {client.next_action&&(
                <div style={{fontSize:10,color:C.indigoLt,fontFamily:C.F,
                  fontWeight:600}}>→ {client.next_action}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </APCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: RELATIONSHIP ALERTS
// ─────────────────────────────────────────────────────────────────────────────
function RelationshipAlerts({ alerts }){
  if(!alerts?.length) return null;
  const typeMap = {
    overdue:         { icon:"⚠️", color:C.rose,   label:"OVERDUE"          },
    referral_window: { icon:"🤝", color:C.amber,  label:"REFERRAL WINDOW"  },
    anniversary:     { icon:"🎉", color:C.emerald,label:"ANNIVERSARY"      },
    re_engage:       { icon:"💬", color:C.indigo, label:"RE-ENGAGE"        },
  };

  return(
    <APCard accent={C.amber}>
      <APLabel color={C.amber}>RELATIONSHIP ALERTS</APLabel>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {alerts.map((alert,i)=>{
          const t = typeMap[alert.type] || typeMap.re_engage;
          return(
            <div key={i} style={{background:`${t.color}06`,
              border:`1px solid ${t.color}20`,borderRadius:10,padding:"12px 13px",
              animation:`fadeUp .25s ease ${i*.06}s both`}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <span style={{fontSize:14}}>{t.icon}</span>
                <div>
                  <span style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>
                    {alert.client}
                  </span>
                  <span style={{fontFamily:C.F,fontSize:9,color:t.color,
                    fontWeight:700,letterSpacing:1,marginLeft:8,
                    background:`${t.color}14`,border:`1px solid ${t.color}24`,
                    borderRadius:6,padding:"1px 6px"}}>
                    {t.label}
                  </span>
                </div>
              </div>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,
                margin:"0 0 10px",lineHeight:1.5}}>{alert.reason}</p>
              {alert.message&&(
                <div style={{background:"rgba(255,255,255,.02)",
                  border:`1px solid ${C.border}`,borderRadius:7,padding:"9px 11px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:5}}>
                    <span style={{fontSize:8,color:t.color,fontFamily:C.F,
                      fontWeight:700,letterSpacing:1.5}}>PERSONAL MESSAGE</span>
                    <APCopyBtn text={alert.message}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,
                    margin:0,lineHeight:1.65}}>{alert.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </APCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: MARKET INTELLIGENCE
// ─────────────────────────────────────────────────────────────────────────────
function MarketIntel({ market }){
  if(!market) return null;
  return(
    <APCard accent={C.cyan}>
      <APLabel color={C.cyan}>MARKET INTELLIGENCE</APLabel>
      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,
        margin:"0 0 12px",lineHeight:1.7}}>{market.insight}</p>
      {market.opportunity&&(
        <div style={{background:`${C.emerald}08`,border:`1px solid ${C.emerald}18`,
          borderRadius:8,padding:"10px 12px",marginBottom:10}}>
          <div style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700,
            letterSpacing:1.5,marginBottom:4}}>CAPITALIZE NOW</div>
          <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.6}}>
            {market.opportunity}
          </p>
        </div>
      )}
      {market.talking_point&&(
        <div style={{background:`${C.amber}06`,border:`1px solid ${C.amber}18`,
          borderRadius:8,padding:"10px 12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:8,color:C.amber,fontFamily:C.F,fontWeight:700,
              letterSpacing:1.5}}>THIS WEEK'S TALKING POINT</span>
            <APCopyBtn text={market.talking_point}/>
          </div>
          <p style={{fontFamily:C.F,fontSize:12,fontWeight:600,color:C.text,
            margin:0,lineHeight:1.6,fontStyle:"italic"}}>
            "{market.talking_point}"
          </p>
        </div>
      )}
    </APCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION: COACHING + FORECAST
// ─────────────────────────────────────────────────────────────────────────────
function CoachingForecast({ coaching, forecast }){
  if(!coaching && !forecast) return null;
  const momentumColor = forecast?.momentum==="rising"?C.emerald:
    forecast?.momentum==="declining"?C.rose:C.cyan;

  return(
    <div>
      {forecast&&(
        <APCard accent={momentumColor}>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:12}}>
            <APLabel color={momentumColor}>PERFORMANCE FORECAST</APLabel>
            <span style={{fontSize:9,color:momentumColor,fontFamily:C.F,fontWeight:700,
              background:`${momentumColor}12`,border:`1px solid ${momentumColor}24`,
              borderRadius:8,padding:"2px 8px",letterSpacing:1}}>
              {forecast.momentum?.toUpperCase()||"STABLE"}
            </span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {[
              {label:"GCI PROJECTION",    value:forecast.gci_projection,    color:C.emerald},
              {label:"DEALS LIKELY CLOSE",value:forecast.deals_likely_to_close, color:C.indigo},
            ].map((m,i)=>(
              <div key={i} style={{background:`${m.color}08`,border:`1px solid ${m.color}18`,
                borderRadius:9,padding:"10px 11px",textAlign:"center"}}>
                <div style={{fontSize:8,color:m.color,fontFamily:C.F,fontWeight:700,
                  letterSpacing:1.5,marginBottom:4}}>{m.label}</div>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:15,color:C.text}}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
          {forecast.biggest_risk_to_target&&(
            <div style={{background:"rgba(244,63,94,.05)",border:"1px solid rgba(244,63,94,.14)",
              borderRadius:8,padding:"9px 11px"}}>
              <span style={{fontSize:8,color:C.rose,fontFamily:C.F,fontWeight:700,
                letterSpacing:1.5}}>BIGGEST RISK TO TARGET: </span>
              <span style={{fontFamily:C.F,fontSize:11,color:C.textMd}}>
                {forecast.biggest_risk_to_target}
              </span>
            </div>
          )}
        </APCard>
      )}

      {coaching&&(
        <APCard accent={C.violet}>
          <APLabel color={C.violet}>AUTOPILOT COACHING</APLabel>
          <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,
            margin:"0 0 12px",lineHeight:1.75}}>{coaching.observation}</p>
          <div style={{background:`${C.violet}08`,border:`1px solid ${C.violet}18`,
            borderRadius:9,padding:"11px 13px",marginBottom:10}}>
            <div style={{fontSize:8,color:C.violet,fontFamily:C.F,fontWeight:700,
              letterSpacing:1.5,marginBottom:5}}>RECOMMENDATION</div>
            <p style={{fontFamily:C.F,fontSize:12,fontWeight:600,color:C.text,
              margin:0,lineHeight:1.6}}>{coaching.recommendation}</p>
          </div>
          {coaching.this_week&&(
            <div style={{background:`${C.emerald}08`,border:`1px solid ${C.emerald}18`,
              borderRadius:9,padding:"11px 13px"}}>
              <div style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700,
                letterSpacing:1.5,marginBottom:5}}>DO THIS WEEK</div>
              <p style={{fontFamily:C.F,fontSize:12,fontWeight:700,color:C.text,
                margin:0,lineHeight:1.6}}>{coaching.this_week}</p>
            </div>
          )}
        </APCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE — not enough data yet
// ─────────────────────────────────────────────────────────────────────────────
function AutopilotEmptyState({ onNavigate }){
  const steps = [
    { icon:"👥", label:"Add your clients", desc:"Go to Clients tab → Pipeline Manager", tab:"clients" },
    { icon:"📋", label:"Add your deals", desc:"Go to Market tab → My Business → Add Deal", tab:"market" },
    { icon:"🎯", label:"Set your GCI goal", desc:"Go to Market tab → My Business → Goals", tab:"market" },
  ];
  return(
    <div style={{textAlign:"center",padding:"32px 16px",animation:"fadeUp .4s ease"}}>
      <div style={{width:72,height:72,borderRadius:20,margin:"0 auto 20px",
        background:`linear-gradient(135deg,${C.indigo},${C.violet})`,
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,
        boxShadow:`0 8px 32px ${C.indigo}40`}}>🤖</div>
      <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:20,color:C.text,
        margin:"0 0 10px",letterSpacing:"-0.01em"}}>Autopilot is ready.</h2>
      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,
        margin:"0 0 28px",lineHeight:1.7,maxWidth:340,
        marginLeft:"auto",marginRight:"auto"}}>
        Add your clients and deals so Autopilot has real data to analyze. The more you put in, the smarter it gets.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:10,
        maxWidth:320,margin:"0 auto 28px"}}>
        {steps.map((s,i)=>(
          <div key={i} onClick={()=>onNavigate(s.tab)}
            style={{display:"flex",alignItems:"center",gap:12,
              background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:11,padding:"12px 14px",cursor:"pointer",
              textAlign:"left",transition:"all .16s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(99,102,241,.3)"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
            <span style={{fontSize:20}}>{s.icon}</span>
            <div>
              <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text}}>
                {s.label}
              </div>
              <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>
                {s.desc}
              </div>
            </div>
            <span style={{marginLeft:"auto",color:C.indigo,fontSize:14}}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN AUTOPILOT PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function AutopilotPanel({ user, voice, planKey, onNavigate }){
  const [result,   setResult]   = useState(()=>lsGet(AP_KEY, null));
  const [running,  setRunning]  = useState(false);
  const [error,    setError]    = useState(null);
  const [lastRun,  setLastRun]  = useState(()=>lsGet(RUN_KEY, null));
  const [activeTab,setActiveTab]= useState("mission");

  const data = aggregateBusinessData(voice);
  const hasEnoughData = data.totalClients > 0 || data.totalDeals > 0;

  // Auto-run on mount if no result or result is stale (>12 hours)
  useEffect(()=>{
    if(!hasEnoughData) return;
    const stale = !lastRun || (Date.now() - new Date(lastRun)) > 12 * 60 * 60 * 1000;
    if(stale && !result) runAutopilot();
  }, []);

  async function runAutopilot(){
    if(running) return;
    setRunning(true);
    setError(null);
    try{
      const freshData = aggregateBusinessData(voice);
      const analysis  = await runAutopilotEngine(freshData);

      // Update memory with patterns
      const memory = lsGet(MEMORY_KEY, { runCount:0, patterns:"" });
      const newMemory = {
        runCount:   (memory.runCount||0) + 1,
        lastHealth: analysis.deal_intelligence?.overall_health,
        patterns:   analysis.coaching_insight?.observation || memory.patterns,
        updatedAt:  new Date().toISOString(),
      };
      lsSet(MEMORY_KEY, newMemory);

      const now = new Date().toISOString();
      lsSet(AP_KEY, analysis);
      lsSet(RUN_KEY, now);
      setResult(analysis);
      setLastRun(now);
      setActiveTab("mission");
    }catch(e){
      console.error("Autopilot error:", e);
      if(e.message?.includes("timeout")||e.message?.includes("504")||e.message?.includes("502")){
        setError("Analysis timed out — the request took too long. Try again or reduce the amount of client data.");
      } else if(e.message?.includes("JSON")||e.message?.includes("parse")){
        setError("Analysis returned unexpected data — try running again.");
      } else {
        setError("Analysis failed — check your connection and try again. " + (e.message||""));
      }
    }
    setRunning(false);
  }

  const TABS = [
    { id:"mission",      label:"Mission",      icon:"🎯" },
    { id:"deals",        label:"Deals",        icon:"📋" },
    { id:"clients",      label:"Clients",      icon:"👥" },
    { id:"alerts",       label:"Alerts",       icon:"⚡" },
    { id:"market",       label:"Market",       icon:"📈" },
    { id:"coaching",     label:"Coaching",     icon:"🏆" },
  ];

  const memory = lsGet(MEMORY_KEY, {});

  return(
    <div style={{paddingBottom:48}}>

      {/* ── HEADER ── */}
      <div style={{
        background:`linear-gradient(135deg,${C.indigo}10,${C.violet}06)`,
        border:`1px solid ${C.indigo}22`,borderRadius:16,
        padding:"20px 18px",marginBottom:16,
        position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-30%",right:"-5%",width:180,height:180,
          borderRadius:"50%",pointerEvents:"none",
          background:`radial-gradient(circle,${C.indigo}18,transparent 70%)`}}/>
        <div style={{display:"flex",alignItems:"center",
          justifyContent:"space-between",position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
              background:`linear-gradient(135deg,${C.indigo},${C.violet})`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,
              boxShadow:`0 4px 16px ${C.indigo}40`,
              animation:running?"spin 2s linear infinite":"none"}}>
              🤖
            </div>
            <div>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:15,color:C.text}}>
                SPARK Autopilot
              </div>
              <div style={{fontFamily:C.F,fontSize:10,marginTop:2,
                display:"flex",alignItems:"center",gap:5,
                color:running?C.amber:result?C.emerald:C.textDim}}>
                <div style={{width:5,height:5,borderRadius:"50%",
                  background:running?C.amber:result?C.emerald:C.textDim,
                  boxShadow:running?`0 0 6px ${C.amber}`:result?`0 0 6px ${C.emerald}`:"none",
                  animation:running?"pulse 1s ease infinite":"none"}}/>
                {running?"Analyzing your business..."
                  :result?"Active · Monitoring your business"
                  :"Ready to analyze"}
              </div>
            </div>
          </div>
          <button onClick={runAutopilot} disabled={running||!hasEnoughData}
            style={{
              background:running||!hasEnoughData?"rgba(255,255,255,.06)"
                :`linear-gradient(135deg,${C.indigo},${C.violet})`,
              border:"none",color:running||!hasEnoughData?C.textDim:"#fff",
              borderRadius:10,padding:"10px 18px",cursor:running||!hasEnoughData?"default":"pointer",
              fontFamily:C.F,fontWeight:700,fontSize:12,letterSpacing:.3,
              boxShadow:running||!hasEnoughData?"none":`0 4px 14px ${C.indigo}30`,
              transition:"all .2s"}}>
            {running?"Running...":"▶ Run Autopilot"}
          </button>
        </div>

        {/* Stats bar */}
        {(memory.runCount||0) > 0 && (
          <div style={{display:"flex",gap:14,marginTop:14,
            paddingTop:12,borderTop:`1px solid ${C.border}`,
            flexWrap:"wrap",position:"relative"}}>
            {[
              {label:"RUNS",      value:memory.runCount||0},
              {label:"CLIENTS",   value:data.totalClients},
              {label:"DEALS",     value:data.totalDeals},
              {label:"PIPELINE",  value:`$${Math.round(data.totalPipeline/1000)}k`},
            ].map((s,i)=>(
              <div key={i}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:14,color:C.text}}>
                  {s.value}
                </div>
                <div style={{fontSize:7,color:C.textDim,fontFamily:C.F,
                  fontWeight:700,letterSpacing:1.5}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error&&(
        <div style={{background:"rgba(244,63,94,.07)",border:"1px solid rgba(244,63,94,.2)",
          borderRadius:10,padding:"12px 14px",marginBottom:14,
          fontFamily:C.F,fontSize:12,color:C.rose}}>{error}</div>
      )}

      {/* Running animation */}
      {running&&(
        <APCard accent={C.indigo}>
          <div style={{textAlign:"center",padding:"24px 0"}}>
            <div style={{display:"flex",justifyContent:"center",gap:8,marginBottom:16}}>
              {[0,1,2,3,4].map(i=>(
                <div key={i} style={{width:8,height:8,borderRadius:"50%",
                  background:C.indigo,opacity:.6,
                  animation:`pulse 1.2s ease ${i*.15}s infinite`}}/>
              ))}
            </div>
            <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,
              margin:"0 0 6px"}}>Autopilot is analyzing your business...</p>
            <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:0,lineHeight:1.6}}>
              Scanning {data.totalClients} clients · {data.totalDeals} deals · pipeline health · relationship patterns
            </p>
          </div>
        </APCard>
      )}

      {/* Empty state */}
      {!running&&!result&&(
        <AutopilotEmptyState onNavigate={onNavigate}/>
      )}

      {/* Results */}
      {!running&&result&&(
        <div>
          {/* Tab navigation */}
          <div style={{display:"flex",gap:5,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setActiveTab(t.id)}
                style={{padding:"7px 12px",borderRadius:10,flexShrink:0,
                  border:`1px solid ${activeTab===t.id?C.indigo+"44":C.border}`,
                  background:activeTab===t.id?`${C.indigo}10`:"transparent",
                  color:activeTab===t.id?C.indigoLt:C.textDim,cursor:"pointer",
                  fontSize:10,fontFamily:C.F,fontWeight:700,whiteSpace:"nowrap",
                  transition:"all .14s"}}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab==="mission"  && <MissionSection      mission={result.mission}              runTime={lastRun}/>}
          {activeTab==="deals"    && <DealIntelligence    dealIntelligence={result.deal_intelligence}/>}
          {activeTab==="clients"  && <ClientScores        scores={result.client_scores}/>}
          {activeTab==="alerts"   && <RelationshipAlerts  alerts={result.relationship_alerts}/>}
          {activeTab==="market"   && <MarketIntel         market={result.market_intelligence}/>}
          {activeTab==="coaching" && <CoachingForecast    coaching={result.coaching_insight} forecast={result.performance_forecast}/>}
        </div>
      )}
    </div>
  );
}
