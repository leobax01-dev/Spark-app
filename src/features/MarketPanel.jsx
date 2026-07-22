// src/features/MarketPanel.jsx
// Market & Business Intelligence — Neighborhood Report, Lead Response, Business Dashboard
// Standalone feature file — imported into App.jsx

import { useState, useEffect, useRef } from "react";
import { lsGet, lsSet, cloudLoad, cloudSync } from "../utils/storage";
import Icon from "../components/Icons";
import { Card, Label } from "../components/UI";

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:"#0a0a0d", surface:"#0d0e12", surfaceUp:"#131519", surfaceHigh:"#191c22",
  border:"rgba(255,255,255,0.07)", borderMd:"rgba(255,255,255,0.12)",
  indigo:"#4F6BFF", indigoLt:"#8CA0FF", violet:"#4257DB",
  cyan:"#38BDF8", emerald:"#22C55E", amber:"#F5A623", rose:"#EF4444",
  text:"rgba(255,255,255,0.95)", textMd:"rgba(255,255,255,0.55)",
  textDim:"rgba(255,255,255,0.26)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const LS_KEY_GOALS = "spark_biz_goals_v1";
const LS_KEY_PIPELINE_VALUE = "spark_pipeline_value_v1";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function MCard({children, accent, style={}}){
  return <Card accent={accent} style={style} C={C}>{children}</Card>;
}

function MLabel({children, color}){
  return <Label color={color} C={C}>{children}</Label>;
}

function MField({label, value, onChange, placeholder, area=false, rows=2, type="text"}){
  return(
    <div style={{marginBottom:10}}>
      {label&&<div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,
        fontWeight:700,marginBottom:5}}>{label}</div>}
      {area
        ? <textarea value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder} rows={rows}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.F,
              fontSize:12,resize:"vertical",boxSizing:"border-box",lineHeight:1.5}}/>
        : <input value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder} type={type}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.F,
              fontSize:12,boxSizing:"border-box"}}/>
      }
    </div>
  );
}

function MBtn({onClick, loading, children, color=C.indigo, small=false}){
  return(
    <button onClick={onClick} disabled={loading}
      style={{width:small?"auto":"100%",
        background:loading?"rgba(255,255,255,.06)":`linear-gradient(135deg,${color},${color}cc)`,
        border:"none",color:loading?C.textDim:"#fff",
        padding:small?"7px 14px":"13px 0",borderRadius:9,
        cursor:loading?"default":"pointer",fontFamily:C.F,
        fontWeight:800,fontSize:small?11:13,letterSpacing:.3,
        boxShadow:loading?"none":`0 4px 16px ${color}28`,
        transition:"all .2s",opacity:loading?.6:1}}>
      {loading?"Generating...":children}
    </button>
  );
}

function MCopyBtn({text}){
  const [ok,setOk]=useState(false);
  return(
    <button onClick={()=>{ navigator.clipboard.writeText(text||"").then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,
        color:ok?C.emerald:C.textDim,borderRadius:6,padding:"3px 8px",
        cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}

function ResultBlock({label, value, color=C.indigo}){
  if(!value) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"13px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>{label}</span>
        <MCopyBtn text={value}/>
      </div>
      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
        lineHeight:1.7,whiteSpace:"pre-wrap"}}>{value}</p>
    </div>
  );
}

function ResultList({label, items, color=C.indigo}){
  if(!items?.length) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"13px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>{label}</span>
        <MCopyBtn text={items.join("\n")}/>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{display:"flex",gap:9,padding:"7px 0",
          borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{minWidth:18,height:18,borderRadius:"50%",
            background:`${color}18`,border:`1px solid ${color}30`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:8,color,fontWeight:700,flexShrink:0}}>{i+1}</div>
          <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
            lineHeight:1.5,alignSelf:"center"}}>{item}</p>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — NEIGHBORHOOD INTELLIGENCE REPORT
// ─────────────────────────────────────────────────────────────────────────────
function NeighborhoodReport(){
  const [inputs,setInputs]=useState({
    neighborhood:"", city:"", state:"",
    avgSalePrice:"", medianSalePrice:"", priceChange:"",
    avgDom:"", domChange:"", activeListings:"", soldLast30:"",
    newListings:"", absorptionRate:"", avgPricePerSqft:"",
    marketTrend:"", topSelling:"", targetAudience:"",
    agentName:"", agentPhone:"", agentBrokerage:""
  });
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);

  function set(k){ return v=>setInputs(p=>({...p,[k]:v})); }

  async function generate(){
    if(!inputs.neighborhood||!inputs.city){
      alert("Please enter neighborhood and city"); return;
    }
    setLoading(true);
    try{
      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, a real estate market intelligence expert. Create engaging, authoritative market reports that position agents as local experts. Return ONLY valid JSON, no markdown.",
          messages:[{role:"user",content:
            `Create a neighborhood intelligence report for ${inputs.neighborhood}, ${inputs.city}, ${inputs.state}.

Market data: Avg sale price: ${inputs.avgSalePrice}, Median: ${inputs.medianSalePrice}, Price change: ${inputs.priceChange}, Avg DOM: ${inputs.avgDom}, DOM change: ${inputs.domChange}, Active listings: ${inputs.activeListings}, Sold last 30 days: ${inputs.soldLast30}, New listings: ${inputs.newListings}, Absorption rate: ${inputs.absorptionRate}, Avg $/sqft: ${inputs.avgPricePerSqft}. Market trend: ${inputs.marketTrend}. Top selling features: ${inputs.topSelling}. Target audience: ${inputs.targetAudience}. Agent: ${inputs.agentName}, ${inputs.agentBrokerage}.

Return ONLY valid JSON:
{"report_title":"compelling report title","market_headline":"one powerful headline summarizing market conditions — specific numbers","market_summary":"3-4 sentence executive summary of current market conditions — engaging and data-driven","buyer_snapshot":"2-3 sentences on what this market means for buyers right now","seller_snapshot":"2-3 sentences on what this market means for sellers right now","key_stats":["5 most compelling statistics formatted as 'Stat: Context' — e.g. 'Homes selling in 18 days: fastest pace in 3 years'"],"market_prediction":"2-3 sentence prediction for next 90 days based on current data","neighborhood_highlights":["3-4 specific things making this neighborhood desirable right now"],"agent_insight":"personal insight paragraph the agent adds — 2-3 sentences positioning them as the local expert","social_caption":"Instagram/Facebook caption version — engaging, under 280 chars, with relevant hashtags","email_subject":"email subject line for sending this to sphere","sphere_email":"full email to send to sphere of influence — personal, data-driven, 3 short paragraphs, ends with CTA","talking_point":"the single most impressive stat or fact from this report to drop in conversation"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first=cleaned.indexOf("{"); const last=cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setResult(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      <MCard accent={C.cyan}>
        <MLabel color={C.cyan}>LOCATION</MLabel>
        <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10}}>
          <MField label="NEIGHBORHOOD" value={inputs.neighborhood} onChange={set("neighborhood")} placeholder="Brickell"/>
          <MField label="CITY" value={inputs.city} onChange={set("city")} placeholder="Miami"/>
          <MField label="STATE" value={inputs.state} onChange={set("state")} placeholder="FL"/>
        </div>
      </MCard>

      <MCard accent={C.indigo}>
        <MLabel color={C.indigo}>MARKET DATA</MLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <MField label="AVG SALE PRICE" value={inputs.avgSalePrice} onChange={set("avgSalePrice")} placeholder="$875,000"/>
          <MField label="MEDIAN SALE PRICE" value={inputs.medianSalePrice} onChange={set("medianSalePrice")} placeholder="$720,000"/>
          <MField label="PRICE CHANGE (YoY)" value={inputs.priceChange} onChange={set("priceChange")} placeholder="+8.2%"/>
          <MField label="AVG DAYS ON MARKET" value={inputs.avgDom} onChange={set("avgDom")} placeholder="22"/>
          <MField label="DOM CHANGE" value={inputs.domChange} onChange={set("domChange")} placeholder="-4 days vs last year"/>
          <MField label="ACTIVE LISTINGS" value={inputs.activeListings} onChange={set("activeListings")} placeholder="48"/>
          <MField label="SOLD (LAST 30 DAYS)" value={inputs.soldLast30} onChange={set("soldLast30")} placeholder="31"/>
          <MField label="NEW LISTINGS (30 DAYS)" value={inputs.newListings} onChange={set("newListings")} placeholder="27"/>
          <MField label="ABSORPTION RATE" value={inputs.absorptionRate} onChange={set("absorptionRate")} placeholder="1.5 months"/>
          <MField label="AVG PRICE PER SQFT" value={inputs.avgPricePerSqft} onChange={set("avgPricePerSqft")} placeholder="$485"/>
        </div>
        <MField label="MARKET TREND" value={inputs.marketTrend} onChange={set("marketTrend")} placeholder="Seller's market, low inventory, multiple offers common"/>
        <MField label="TOP SELLING FEATURES" value={inputs.topSelling} onChange={set("topSelling")} placeholder="Walkability, proximity to Brickell City Centre, bay views"/>
      </MCard>

      <MCard accent={C.emerald}>
        <MLabel color={C.emerald}>AGENT BRANDING</MLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <MField label="YOUR NAME" value={inputs.agentName} onChange={set("agentName")} placeholder="Sarah Williams"/>
          <MField label="PHONE" value={inputs.agentPhone} onChange={set("agentPhone")} placeholder="+1 305 555 0100"/>
        </div>
        <MField label="BROKERAGE" value={inputs.agentBrokerage} onChange={set("agentBrokerage")} placeholder="Compass Real Estate"/>
        <MField label="TARGET AUDIENCE" value={inputs.targetAudience} onChange={set("targetAudience")} placeholder="Luxury buyers, investors, relocators from NYC"/>
      </MCard>

      <MBtn onClick={generate} loading={loading} color={C.cyan}>
        📊 Generate Neighborhood Report
      </MBtn>

      {result&&(
        <div style={{marginTop:20,animation:"scaleIn .28s ease"}}>
          {/* Report header */}
          <MCard accent={C.cyan}>
            <div style={{fontSize:9,color:C.cyan,letterSpacing:2.5,fontFamily:C.F,
              fontWeight:700,marginBottom:8}}>{result.report_title}</div>
            <p style={{fontFamily:C.F,fontWeight:800,fontSize:18,color:C.text,
              margin:"0 0 10px",lineHeight:1.3}}>{result.market_headline}</p>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7}}>
              {result.market_summary}
            </p>
          </MCard>

          {/* Key stats */}
          <MCard accent={C.indigo}>
            <MLabel color={C.indigo}>KEY STATS</MLabel>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {(result.key_stats||[]).map((stat,i)=>{
                const parts = stat.split(":");
                return(
                  <div key={i} style={{background:`${C.indigo}08`,
                    border:`1px solid ${C.indigo}18`,borderRadius:9,
                    padding:"10px 11px"}}>
                    <div style={{fontFamily:C.F,fontWeight:800,fontSize:13,
                      color:C.indigoLt,marginBottom:3}}>
                      {parts[0]}
                    </div>
                    <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,lineHeight:1.4}}>
                      {parts.slice(1).join(":").trim()}
                    </div>
                  </div>
                );
              })}
            </div>
          </MCard>

          {/* Buyer + seller snapshots */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <MCard accent={C.emerald} style={{marginBottom:0}}>
              <MLabel color={C.emerald}>FOR BUYERS</MLabel>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.6}}>
                {result.buyer_snapshot}
              </p>
            </MCard>
            <MCard accent={C.amber} style={{marginBottom:0}}>
              <MLabel color={C.amber}>FOR SELLERS</MLabel>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.6}}>
                {result.seller_snapshot}
              </p>
            </MCard>
          </div>

          <ResultList label="NEIGHBORHOOD HIGHLIGHTS" items={result.neighborhood_highlights} color={C.cyan}/>

          {/* Market prediction */}
          <MCard accent={C.violet}>
            <MLabel color={C.violet}>90-DAY PREDICTION</MLabel>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7}}>
              {result.market_prediction}
            </p>
          </MCard>

          {/* Talking point */}
          <MCard accent={C.amber}>
            <MLabel color={C.amber}>CONVERSATION TALKING POINT</MLabel>
            <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,
              margin:0,lineHeight:1.6,fontStyle:"italic"}}>
              "{result.talking_point}"
            </p>
          </MCard>

          {/* Social + email */}
          <ResultBlock label="SOCIAL CAPTION" value={result.social_caption} color={C.indigo}/>
          <ResultBlock label="SPHERE EMAIL SUBJECT" value={result.email_subject} color={C.emerald}/>
          <ResultBlock label="SPHERE EMAIL" value={result.sphere_email} color={C.emerald}/>
          <ResultBlock label="AGENT INSIGHT (add your voice)" value={result.agent_insight} color={C.violet}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — LEAD RESPONSE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
const LEAD_SOURCES = [
  "Zillow Inquiry","Realtor.com Inquiry","Open House Sign-In",
  "Referral","Cold Call / Door Knock","Social Media DM",
  "Website Form","Past Client Re-Engagement","FSBO Outreach","Expired Listing"
];

function LeadResponse(){
  const [inputs,setInputs]=useState({
    leadSource:"Zillow Inquiry", leadName:"", leadPhone:"",
    propertyAddress:"", propertyPrice:"", leadMessage:"",
    agentName:"", agentMarket:"", responseTime:"",
  });
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [activeSeq,setActiveSeq]=useState("immediate");

  function set(k){ return v=>setInputs(p=>({...p,[k]:v})); }

  async function generate(){
    if(!inputs.leadName||!inputs.leadSource){
      alert("Please enter lead name and source"); return;
    }
    setLoading(true);
    try{
      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, a real estate lead conversion expert. Generate personalized, high-converting lead response sequences. Return ONLY valid JSON, no markdown.",
          messages:[{role:"user",content:
            `Generate a complete lead response sequence for:
Lead: ${inputs.leadName}, Source: ${inputs.leadSource}
Property interest: ${inputs.propertyAddress} (${inputs.propertyPrice})
Their message: "${inputs.leadMessage}"
Agent: ${inputs.agentName}, Market: ${inputs.agentMarket}
Response time: ${inputs.responseTime||"ASAP"}

Return ONLY valid JSON:
{"lead_profile":"2-sentence assessment of this lead's likely motivation and readiness","immediate_text":"immediate SMS response — personal, warm, under 160 chars, asks one qualifying question","immediate_email":{"subject":"email subject","body":"immediate email response — 3 short paragraphs, personal, references their specific inquiry, ends with clear next step"},"day3_followup":{"text":"day 3 text — brief check-in, different angle from first message","email":{"subject":"subject","body":"day 3 email — value add, market insight or relevant listing, soft CTA"}},"day7_reengagement":{"text":"day 7 text — creates urgency without being pushy","email":{"subject":"subject","body":"day 7 email — new approach, ask a specific question, make it about them"}},"voicemail_script":"30-second voicemail script — warm, specific, creates reason to call back","qualifying_questions":["5 most important qualifying questions to ask this specific lead"],"objection_responses":{"not_ready":"response if they say they're not ready yet","just_looking":"response if they say just looking","have_agent":"response if they say they already have an agent"},"conversion_tip":"one specific tip for converting this type of lead from this source"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first=cleaned.indexOf("{"); const last=cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setResult(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  const SEQ_TABS=[
    {id:"immediate",label:"Immediate",icon:"Zap",   color:C.emerald},
    {id:"day3",     label:"Day 3",    icon:"Weekly",color:C.indigo},
    {id:"day7",     label:"Day 7",    icon:"Sphere",color:C.amber},
    {id:"tools",    label:"Tools",    icon:"Wrench",color:C.violet},
  ];

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      <MCard accent={C.emerald}>
        <MLabel color={C.emerald}>LEAD DETAILS</MLabel>

        {/* Lead source selector */}
        <div style={{marginBottom:12}}>
          <div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,
            fontWeight:700,marginBottom:7}}>LEAD SOURCE</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {LEAD_SOURCES.map(s=>(
              <button key={s} onClick={()=>set("leadSource")(s)}
                style={{padding:"5px 10px",borderRadius:16,
                  border:`1px solid ${inputs.leadSource===s?C.emerald+"55":C.border}`,
                  background:inputs.leadSource===s?`${C.emerald}10`:"transparent",
                  color:inputs.leadSource===s?C.emerald:C.textDim,
                  cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:600}}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <MField label="LEAD NAME" value={inputs.leadName} onChange={set("leadName")} placeholder="John & Amy Martinez"/>
          <MField label="THEIR PHONE" value={inputs.leadPhone} onChange={set("leadPhone")} placeholder="+1 305 555 0100"/>
          <MField label="PROPERTY ADDRESS" value={inputs.propertyAddress} onChange={set("propertyAddress")} placeholder="123 Ocean Dr, Miami Beach"/>
          <MField label="LIST PRICE" value={inputs.propertyPrice} onChange={set("propertyPrice")} placeholder="$1,250,000"/>
          <MField label="YOUR NAME" value={inputs.agentName} onChange={set("agentName")} placeholder="Sarah Williams"/>
          <MField label="YOUR MARKET" value={inputs.agentMarket} onChange={set("agentMarket")} placeholder="Miami Beach luxury"/>
        </div>
        <MField label="THEIR MESSAGE / INQUIRY (paste if available)" value={inputs.leadMessage}
          onChange={set("leadMessage")} placeholder="Hi, I'm interested in the property at 123 Ocean Dr. Is it still available? We're looking to move in the next few months..." area rows={3}/>
      </MCard>

      <MBtn onClick={generate} loading={loading} color={C.emerald}>
        ⚡ Generate Full Response Sequence
      </MBtn>

      {result&&(
        <div style={{marginTop:20,animation:"scaleIn .28s ease"}}>
          {/* Lead profile */}
          <MCard accent={C.cyan}>
            <MLabel color={C.cyan}>LEAD PROFILE</MLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7}}>
              {result.lead_profile}
            </p>
          </MCard>

          {/* Sequence tabs */}
          <div style={{display:"flex",gap:6,marginBottom:14,
            background:"rgba(255,255,255,.025)",borderRadius:10,padding:3}}>
            {SEQ_TABS.map(t=>{
              const TIcon = Icon[t.icon];
              return(
              <button key={t.id} onClick={()=>setActiveSeq(t.id)}
                style={{flex:1,padding:"8px 4px",borderRadius:7,display:"flex",alignItems:"center",justifyContent:"center",gap:4,
                  border:`1px solid ${activeSeq===t.id?t.color+"28":"transparent"}`,
                  background:activeSeq===t.id?`linear-gradient(135deg,${t.color}14,${t.color}08)`:"transparent",
                  color:activeSeq===t.id?t.color:C.textDim,cursor:"pointer",
                  fontSize:9,fontWeight:700,fontFamily:C.F,letterSpacing:.8}}>
                {TIcon&&<TIcon size={11}/>} {t.label.toUpperCase()}
              </button>
              );
            })}
          </div>

          {/* Immediate */}
          {activeSeq==="immediate"&&(
            <div style={{animation:"scaleIn .22s ease"}}>
              <MCard accent={C.emerald}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",marginBottom:10}}>
                  <MLabel color={C.emerald}>SEND NOW — TEXT</MLabel>
                  <MCopyBtn text={result.immediate_text}/>
                </div>
                <p style={{fontFamily:C.F,fontSize:14,fontWeight:600,color:C.text,
                  margin:0,lineHeight:1.7}}>{result.immediate_text}</p>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,marginTop:6}}>
                  {(result.immediate_text||"").length} / 160 chars
                </div>
              </MCard>
              {result.immediate_email&&(
                <MCard accent={C.indigo}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:8}}>
                    <MLabel color={C.indigo}>SEND NOW — EMAIL</MLabel>
                    <MCopyBtn text={`Subject: ${result.immediate_email.subject}\n\n${result.immediate_email.body}`}/>
                  </div>
                  <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,
                    color:C.text,marginBottom:8}}>
                    Subject: {result.immediate_email.subject}
                  </div>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
                    lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.immediate_email.body}</p>
                </MCard>
              )}
              {result.voicemail_script&&(
                <MCard accent={C.violet}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:8}}>
                    <MLabel color={C.violet}>VOICEMAIL SCRIPT</MLabel>
                    <MCopyBtn text={result.voicemail_script}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
                    lineHeight:1.8,fontStyle:"italic"}}>"{result.voicemail_script}"</p>
                </MCard>
              )}
            </div>
          )}

          {/* Day 3 */}
          {activeSeq==="day3"&&result.day3_followup&&(
            <div style={{animation:"scaleIn .22s ease"}}>
              <MCard accent={C.indigo}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",marginBottom:10}}>
                  <MLabel color={C.indigo}>DAY 3 — TEXT</MLabel>
                  <MCopyBtn text={result.day3_followup.text}/>
                </div>
                <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,
                  margin:0,lineHeight:1.7}}>{result.day3_followup.text}</p>
              </MCard>
              {result.day3_followup.email&&(
                <MCard accent={C.indigo}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:8}}>
                    <MLabel color={C.indigo}>DAY 3 — EMAIL</MLabel>
                    <MCopyBtn text={`Subject: ${result.day3_followup.email.subject}\n\n${result.day3_followup.email.body}`}/>
                  </div>
                  <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text,marginBottom:8}}>
                    Subject: {result.day3_followup.email.subject}
                  </div>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
                    lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.day3_followup.email.body}</p>
                </MCard>
              )}
            </div>
          )}

          {/* Day 7 */}
          {activeSeq==="day7"&&result.day7_reengagement&&(
            <div style={{animation:"scaleIn .22s ease"}}>
              <MCard accent={C.amber}>
                <div style={{display:"flex",justifyContent:"space-between",
                  alignItems:"center",marginBottom:10}}>
                  <MLabel color={C.amber}>DAY 7 — TEXT</MLabel>
                  <MCopyBtn text={result.day7_reengagement.text}/>
                </div>
                <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,
                  margin:0,lineHeight:1.7}}>{result.day7_reengagement.text}</p>
              </MCard>
              {result.day7_reengagement.email&&(
                <MCard accent={C.amber}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"center",marginBottom:8}}>
                    <MLabel color={C.amber}>DAY 7 — EMAIL</MLabel>
                    <MCopyBtn text={`Subject: ${result.day7_reengagement.email.subject}\n\n${result.day7_reengagement.email.body}`}/>
                  </div>
                  <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text,marginBottom:8}}>
                    Subject: {result.day7_reengagement.email.subject}
                  </div>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
                    lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.day7_reengagement.email.body}</p>
                </MCard>
              )}
            </div>
          )}

          {/* Tools */}
          {activeSeq==="tools"&&(
            <div style={{animation:"scaleIn .22s ease"}}>
              <ResultList label="QUALIFYING QUESTIONS" items={result.qualifying_questions} color={C.violet}/>
              {result.objection_responses&&(
                <MCard accent={C.rose}>
                  <MLabel color={C.rose}>OBJECTION RESPONSES</MLabel>
                  {[
                    {key:"not_ready",label:"\"I'm not ready yet\""},
                    {key:"just_looking",label:"\"Just looking\""},
                    {key:"have_agent",label:"\"I already have an agent\""},
                  ].map((o,i)=>(
                    <div key={i} style={{marginBottom:12}}>
                      <div style={{fontFamily:C.F,fontSize:10,color:C.rose,
                        fontWeight:700,marginBottom:4}}>{o.label}</div>
                      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,
                        margin:0,lineHeight:1.6}}>{result.objection_responses[o.key]}</p>
                    </div>
                  ))}
                </MCard>
              )}
              {result.conversion_tip&&(
                <MCard accent={C.emerald}>
                  <MLabel color={C.emerald}>CONVERSION TIP</MLabel>
                  <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,
                    margin:0,lineHeight:1.6}}>{result.conversion_tip}</p>
                </MCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — BUSINESS PERFORMANCE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function BusinessDashboard({ user }){
  const [goals, setGoals]     = useState(()=>lsGet(LS_KEY_GOALS, {
    monthlyGciTarget:"", avgCommission:"", conversionRate:"",
    currentMonth:"", yearToDate:"", closingsTarget:""
  }));
  const [pipeline, setPipeline] = useState(()=>lsGet(LS_KEY_PIPELINE_VALUE, []));
  const [newDeal,  setNewDeal]  = useState({name:"",value:"",probability:"",stage:"",closeDate:""});
  const [adding,   setAdding]   = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [syncStatus, setSyncStatus] = useState("idle");
  const hydrated = useRef(false);

  // On mount — pull from cloud (source of truth), reconcile with local cache
  useEffect(()=>{
    if(!user?.email){ hydrated.current=true; return; }
    (async ()=>{
      const cloud = await cloudLoad(user.email);
      if(cloud){
        if(cloud.pipeline?.length>0 || pipeline.length===0){
          setPipeline(cloud.pipeline||[]);
          lsSet(LS_KEY_PIPELINE_VALUE, cloud.pipeline||[]);
        }
        if(cloud.goals && Object.keys(cloud.goals).length>0){
          setGoals(cloud.goals);
          lsSet(LS_KEY_GOALS, cloud.goals);
        }
      }
      hydrated.current = true;
    })();
  },[]);

  useEffect(()=>{ lsSet(LS_KEY_GOALS, goals); }, [goals]);
  useEffect(()=>{ lsSet(LS_KEY_PIPELINE_VALUE, pipeline); }, [pipeline]);

  // Debounced cloud sync whenever goals or pipeline change
  useEffect(()=>{
    if(!hydrated.current || !user?.email) return;
    setSyncStatus("syncing");
    const timeout = setTimeout(async ()=>{
      const ok = await cloudSync(user.email, { goals, pipeline });
      setSyncStatus(ok?"synced":"offline");
    }, 900);
    return ()=>clearTimeout(timeout);
  },[goals, pipeline]);

  function setGoal(k){ return v=>setGoals(p=>({...p,[k]:v})); }

  function addDeal(){
    if(!newDeal.name||!newDeal.value) return;
    setPipeline(p=>[...p,{...newDeal,id:Date.now().toString()}]);
    setNewDeal({name:"",value:"",probability:"",stage:"",closeDate:""});
    setAdding(false);
  }
  function removeDeal(id){ setPipeline(p=>p.filter(d=>d.id!==id)); }

  // Calculate metrics
  const totalPipelineValue = pipeline.reduce((sum,d)=>sum+(parseFloat(d.value)||0),0);
  const weightedValue = pipeline.reduce((sum,d)=>sum+(parseFloat(d.value)||0)*(parseFloat(d.probability)||50)/100,0);
  const avgComm = parseFloat(goals.avgCommission)||0;
  const convRate = parseFloat(goals.conversionRate)||50;
  const monthlyTarget = parseFloat(goals.monthlyGciTarget?.replace(/[$,]/g,""))||0;
  const currentGci = parseFloat(goals.currentMonth?.replace(/[$,]/g,""))||0;
  const ytdGci = parseFloat(goals.yearToDate?.replace(/[$,]/g,""))||0;
  const pctToTarget = monthlyTarget ? Math.min(100,Math.round((currentGci/monthlyTarget)*100)) : 0;
  const projectedFromPipeline = weightedValue * (avgComm/100);

  async function generateAnalysis(){
    setLoading(true);
    try{
      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, a real estate business coach. Give honest, specific, actionable business analysis. Return ONLY valid JSON.",
          messages:[{role:"user",content:
            `Analyze this agent's business performance:
Monthly GCI Target: ${goals.monthlyGciTarget}, Current month GCI: ${goals.currentMonth}, YTD GCI: ${goals.yearToDate}
Pipeline: ${pipeline.map(d=>`${d.name} (${d.stage}, $${d.value}, ${d.probability}% probability, closes ${d.closeDate})`).join("; ")||"no deals in pipeline"}
Total pipeline value: $${totalPipelineValue.toLocaleString()}, Weighted value: $${Math.round(weightedValue).toLocaleString()}
Avg commission rate: ${goals.avgCommission}%, Lead conversion rate: ${goals.conversionRate}%
Progress to monthly target: ${pctToTarget}%

Return ONLY valid JSON:
{"performance_assessment":"honest 2-3 sentence assessment of where they stand — direct, no sugar-coating","gci_projection":"projected GCI for current month based on pipeline and conversion rate — specific number with reasoning","gap_analysis":"if behind target, exactly what they need to close the gap — specific numbers","focus_list":["top 3 deals in pipeline to prioritize this week — with specific reason why"],"deals_at_risk":["any pipeline deals showing warning signs — be specific"],"weekly_actions":["5 specific business-building actions to take this week to hit target"],"lead_math":"how many leads they need to generate this week to hit their monthly target — show the math","coaching_insight":"one direct piece of coaching advice based on their specific situation","momentum":"one motivating observation about their business — find something genuine to be positive about"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first=cleaned.indexOf("{"); const last=cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setAnalysis(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      {/* Sync status */}
      {user?.email&&(
        <div style={{display:"flex",justifyContent:"flex-end",marginBottom:8,alignItems:"center",gap:5}}>
          <div style={{width:5,height:5,borderRadius:"50%",
            background:syncStatus==="synced"?C.emerald:syncStatus==="syncing"?C.amber:syncStatus==="offline"?C.rose:C.textDim,
            boxShadow:syncStatus==="synced"?`0 0 5px ${C.emerald}`:"none"}}/>
          <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
            {syncStatus==="synced"?"Synced to cloud":syncStatus==="syncing"?"Syncing...":syncStatus==="offline"?"Offline — saved locally":""}
          </span>
        </div>
      )}
      {/* Goals */}
      <MCard accent={C.indigo}>
        <MLabel color={C.indigo}>MONTHLY GOALS</MLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <MField label="GCI TARGET" value={goals.monthlyGciTarget} onChange={setGoal("monthlyGciTarget")} placeholder="$30,000"/>
          <MField label="THIS MONTH SO FAR" value={goals.currentMonth} onChange={setGoal("currentMonth")} placeholder="$12,500"/>
          <MField label="YEAR TO DATE GCI" value={goals.yearToDate} onChange={setGoal("yearToDate")} placeholder="$87,000"/>
          <MField label="AVG COMMISSION RATE (%)" value={goals.avgCommission} onChange={setGoal("avgCommission")} placeholder="2.5"/>
          <MField label="LEAD CONVERSION RATE (%)" value={goals.conversionRate} onChange={setGoal("conversionRate")} placeholder="15"/>
          <MField label="CLOSINGS TARGET (mo)" value={goals.closingsTarget} onChange={setGoal("closingsTarget")} placeholder="3"/>
        </div>
      </MCard>

      {/* Live metrics */}
      {monthlyTarget>0&&(
        <MCard accent={C.emerald}>
          <MLabel color={C.emerald}>LIVE METRICS</MLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:14}}>
            {[
              {label:"MONTHLY PROGRESS",value:`${pctToTarget}%`,color:pctToTarget>=100?C.emerald:pctToTarget>=60?C.amber:C.rose,sub:`$${currentGci.toLocaleString()} of $${monthlyTarget.toLocaleString()}`},
              {label:"PIPELINE VALUE",value:`$${Math.round(totalPipelineValue).toLocaleString()}`,color:C.indigo,sub:`${pipeline.length} active deals`},
              {label:"WEIGHTED VALUE",value:`$${Math.round(weightedValue).toLocaleString()}`,color:C.cyan,sub:"probability-adjusted"},
              {label:"PROJECTED GCI",value:`$${Math.round(projectedFromPipeline).toLocaleString()}`,color:projectedFromPipeline>=monthlyTarget?C.emerald:C.amber,sub:"from pipeline"},
            ].map((m,i)=>(
              <div key={i} style={{background:`${m.color}08`,border:`1px solid ${m.color}18`,
                borderRadius:10,padding:"11px 12px",textAlign:"center"}}>
                <div style={{fontSize:8,color:m.color,fontFamily:C.F,fontWeight:700,
                  letterSpacing:1.5,marginBottom:5}}>{m.label}</div>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,color:m.color,
                  letterSpacing:"-0.02em"}}>{m.value}</div>
                <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:3}}>{m.sub}</div>
              </div>
            ))}
          </div>
          {/* Progress bar */}
          {monthlyTarget>0&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>Monthly target progress</span>
                <span style={{fontSize:9,color:pctToTarget>=100?C.emerald:C.amber,fontFamily:C.F,fontWeight:700}}>{pctToTarget}%</span>
              </div>
              <div style={{height:6,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pctToTarget}%`,
                  background:`linear-gradient(90deg,${pctToTarget>=100?C.emerald:pctToTarget>=60?C.amber:C.rose},${C.indigoLt})`,
                  borderRadius:3,transition:"width .6s ease",
                  boxShadow:`0 0 8px ${pctToTarget>=100?C.emerald:C.amber}60`}}/>
              </div>
            </div>
          )}
        </MCard>
      )}

      {/* Pipeline deals */}
      <MCard accent={C.violet}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <MLabel color={C.violet}>DEAL PIPELINE</MLabel>
          <button onClick={()=>setAdding(!adding)}
            style={{background:`${C.violet}18`,border:`1px solid ${C.violet}30`,
              color:C.violet,borderRadius:7,padding:"5px 11px",cursor:"pointer",
              fontSize:10,fontFamily:C.F,fontWeight:700}}>
            + Add Deal
          </button>
        </div>

        {adding&&(
          <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
            borderRadius:10,padding:"13px 12px",marginBottom:12}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <MField label="DEAL / CLIENT NAME" value={newDeal.name} onChange={v=>setNewDeal(p=>({...p,name:v}))} placeholder="Johnson Family Sale"/>
              <MField label="DEAL VALUE ($)" value={newDeal.value} onChange={v=>setNewDeal(p=>({...p,value:v}))} placeholder="850000"/>
              <MField label="PROBABILITY (%)" value={newDeal.probability} onChange={v=>setNewDeal(p=>({...p,probability:v}))} placeholder="75"/>
              <MField label="STAGE" value={newDeal.stage} onChange={v=>setNewDeal(p=>({...p,stage:v}))} placeholder="Under Contract"/>
              <MField label="EXPECTED CLOSE DATE" value={newDeal.closeDate} onChange={v=>setNewDeal(p=>({...p,closeDate:v}))} placeholder="2026-08-15"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <MBtn small onClick={addDeal} color={C.violet}>Add Deal</MBtn>
              <button onClick={()=>setAdding(false)}
                style={{background:"transparent",border:`1px solid ${C.border}`,
                  color:C.textDim,borderRadius:7,padding:"7px 12px",cursor:"pointer",
                  fontFamily:C.F,fontSize:11}}>Cancel</button>
            </div>
          </div>
        )}

        {pipeline.length===0?(
          <div style={{textAlign:"center",padding:"24px",color:C.textDim,fontFamily:C.F,fontSize:12}}>
            No deals in pipeline yet — add your first deal above
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {pipeline.map((deal,i)=>{
              const comm = (parseFloat(deal.value)||0) * (avgComm/100);
              const prob = parseFloat(deal.probability)||50;
              return(
                <div key={deal.id} style={{background:C.surface,border:`1px solid ${C.border}`,
                  borderRadius:10,padding:"11px 12px",
                  display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,color:C.text,marginBottom:2}}>
                      {deal.name}
                    </div>
                    <div style={{fontFamily:C.F,fontSize:10,color:C.textDim}}>
                      {deal.stage} · closes {deal.closeDate} · {prob}% probability
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:C.F,fontWeight:800,fontSize:13,
                      color:C.emerald}}>${Math.round(comm).toLocaleString()}</div>
                    <div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>est. commission</div>
                  </div>
                  <button onClick={()=>removeDeal(deal.id)}
                    style={{background:"transparent",border:"none",color:C.textDim,
                      cursor:"pointer",fontSize:14,flexShrink:0,padding:"2px 4px"}}>✕</button>
                </div>
              );
            })}
          </div>
        )}
      </MCard>

      <MBtn onClick={generateAnalysis} loading={loading} color={C.indigo}>
        📈 Generate Business Analysis
      </MBtn>

      {analysis&&(
        <div style={{marginTop:16,animation:"scaleIn .28s ease"}}>
          <MCard accent={C.indigo}>
            <MLabel color={C.indigo}>PERFORMANCE ASSESSMENT</MLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:"0 0 10px",lineHeight:1.7}}>
              {analysis.performance_assessment}
            </p>
            <div style={{background:`${C.emerald}08`,border:`1px solid ${C.emerald}18`,
              borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:8,color:C.emerald,fontFamily:C.F,fontWeight:700,
                letterSpacing:1.5,marginBottom:4}}>GCI PROJECTION</div>
              <p style={{fontFamily:C.F,fontSize:13,fontWeight:700,color:C.text,margin:0,lineHeight:1.5}}>
                {analysis.gci_projection}
              </p>
            </div>
          </MCard>

          {analysis.gap_analysis&&(
            <MCard accent={C.rose}>
              <MLabel color={C.rose}>GAP ANALYSIS</MLabel>
              <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7}}>
                {analysis.gap_analysis}
              </p>
            </MCard>
          )}

          <ResultList label="FOCUS LIST — TOP DEALS THIS WEEK" items={analysis.focus_list} color={C.violet}/>
          {analysis.deals_at_risk?.length>0&&<ResultList label="DEALS AT RISK" items={analysis.deals_at_risk} color={C.rose}/>}
          <ResultList label="WEEKLY ACTIONS" items={analysis.weekly_actions} color={C.indigo}/>

          <MCard accent={C.amber}>
            <MLabel color={C.amber}>LEAD MATH</MLabel>
            <p style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text,margin:0,lineHeight:1.7}}>
              {analysis.lead_math}
            </p>
          </MCard>

          <MCard accent={C.cyan}>
            <MLabel color={C.cyan}>COACHING INSIGHT</MLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:"0 0 10px",lineHeight:1.7}}>
              {analysis.coaching_insight}
            </p>
            <p style={{fontFamily:C.F,fontSize:13,fontWeight:700,color:C.emerald,
              margin:0,lineHeight:1.6,fontStyle:"italic"}}>
              "{analysis.momentum}"
            </p>
          </MCard>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN MARKET PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function MarketPanel({ user, planKey }){
  const [tool, setTool] = useState("leads");

  const TOOLS=[
    {id:"leads",     label:"Lead Response",  icon:"Zap",   color:C.emerald, desc:"Full response sequence for any lead"},
    {id:"report",    label:"Market Report",  icon:"Market",color:C.cyan,    desc:"Brandable neighborhood intel report"},
    {id:"dashboard", label:"My Business",    icon:"Coaching",color:C.indigo,  desc:"GCI tracker, pipeline & AI coaching"},
  ];

  return(
    <div style={{paddingBottom:40}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
        {TOOLS.map(t=>{
          const TIcon = Icon[t.icon];
          return(
          <div key={t.id} onClick={()=>setTool(t.id)}
            style={{padding:"13px 10px",borderRadius:12,cursor:"pointer",textAlign:"center",
              border:`1px solid ${tool===t.id?t.color+"50":C.border}`,
              background:tool===t.id?`${t.color}0e`:"rgba(255,255,255,.015)",
              transition:"all .16s ease"}}>
            <div style={{display:"flex",justifyContent:"center",marginBottom:6,color:tool===t.id?t.color:C.textMd}}>
              {TIcon&&<TIcon size={19}/>}
            </div>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:11,
              color:tool===t.id?t.color:C.textMd,marginBottom:3}}>{t.label}</div>
            <div style={{fontFamily:C.F,fontSize:9,color:C.textDim,lineHeight:1.3}}>
              {t.desc}
            </div>
          </div>
          );
        })}
      </div>

      {tool==="leads"     && <LeadResponse/>}
      {tool==="report"    && <NeighborhoodReport/>}
      {tool==="dashboard" && <BusinessDashboard user={user}/>}
    </div>
  );
}
