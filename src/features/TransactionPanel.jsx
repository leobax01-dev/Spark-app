// src/features/TransactionPanel.jsx
// Transaction Intelligence Layer — Timeline Generator, Listing Presentation, CMA Analyzer
// Standalone feature file — imported into App.jsx, zero changes to existing code

import { useState, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// COMP FETCHER — shared by Presentation and CMA tools
// ─────────────────────────────────────────────────────────────────────────────
function useCompFetcher() {
  const [compsLoading, setCompsLoading] = useState(false);
  const [compsError,   setCompsError]   = useState(null);
  const [compsData,    setCompsData]    = useState(null);
  const debounceRef = useRef(null);

  const fetchComps = useCallback((address) => {
    setCompsError(null);
    if (!address || address.length < 10) { setCompsData(null); return; }
    // Debounce — wait 800ms after user stops typing
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setCompsLoading(true);
      try {
        const r = await fetch("/api/comps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const d = await r.json();
        if (!r.ok) { setCompsError(d.error || "Could not find comps for this address"); setCompsData(null); }
        else { setCompsData(d); }
      } catch(e) {
        setCompsError("Connection error — comps unavailable");
      }
      setCompsLoading(false);
    }, 800);
  }, []);

  return { compsLoading, compsError, compsData, fetchComps };
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS — mirrors App.jsx C object
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

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function TCard({children, accent=C.indigo, style={}}){
  return(
    <div style={{
      background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
      border:`1px solid ${C.border}`,borderRadius:14,
      padding:"20px 18px",marginBottom:14,position:"relative",
      overflow:"hidden",...style}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${accent}40,transparent)`}}/>
      {children}
    </div>
  );
}

function TLabel({children, color=C.indigo}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:14}}>
      <div style={{width:3,height:13,borderRadius:2,
        background:`linear-gradient(180deg,${color},${color}60)`,
        boxShadow:`0 0 7px ${color}80`}}/>
      <span style={{fontSize:9,color,fontFamily:C.F,fontWeight:700,letterSpacing:2.2}}>
        {children}
      </span>
    </div>
  );
}

function TField({label, value, onChange, placeholder, area=false, rows=2}){
  return(
    <div style={{marginBottom:12}}>
      <div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,
        fontWeight:700,marginBottom:5}}>{label}</div>
      {area
        ? <textarea value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder} rows={rows}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.F,
              fontSize:12,resize:"vertical",boxSizing:"border-box",lineHeight:1.5}}/>
        : <input value={value} onChange={e=>onChange(e.target.value)}
            placeholder={placeholder}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"9px 11px",color:C.text,fontFamily:C.F,
              fontSize:12,boxSizing:"border-box"}}/>
      }
    </div>
  );
}

function TBtn({onClick, loading, children, color=C.indigo, full=true}){
  return(
    <button onClick={onClick} disabled={loading}
      style={{
        width:full?"100%":"auto",
        background:loading?"rgba(255,255,255,.06)":`linear-gradient(135deg,${color},${color}cc)`,
        border:"none",color:loading?C.textDim:"#fff",
        padding:"13px 0",borderRadius:10,cursor:loading?"default":"pointer",
        fontFamily:C.F,fontWeight:800,fontSize:13,letterSpacing:.3,
        boxShadow:loading?"none":`0 4px 16px ${color}30`,
        transition:"all .2s ease",opacity:loading?.6:1}}>
      {loading?"Generating...":children}
    </button>
  );
}

function TCopyBtn({text}){
  const [ok,setOk]=useState(false);
  return(
    <button onClick={()=>{ navigator.clipboard.writeText(text).then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,
        color:ok?C.emerald:C.textDim,borderRadius:6,padding:"3px 9px",
        cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,
        letterSpacing:1,transition:"all .16s"}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}

function ResultBlock({label, value, color=C.indigo, area=false}){
  if(!value) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"13px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>{label}</span>
        <TCopyBtn text={value}/>
      </div>
      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7,
        whiteSpace:"pre-wrap"}}>{value}</p>
    </div>
  );
}

function ResultList({label, items, color=C.indigo}){
  if(!items?.length) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"13px 14px",marginBottom:10}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>{label}</span>
        <TCopyBtn text={items.join("\n")}/>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{display:"flex",gap:9,padding:"7px 0",
          borderBottom:i<items.length-1?`1px solid ${C.border}`:"none",
          animation:`fadeUp .25s ease ${i*.05}s both`}}>
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
// COMPS PANEL — shows auto-fetched comps with edit override
// ─────────────────────────────────────────────────────────────────────────────
function CompsPanel({ compsLoading, compsError, compsData, overrides, setOverrides }){
  if(compsLoading) return(
    <div style={{background:`${C.indigo}08`,border:`1px solid ${C.indigo}20`,
      borderRadius:11,padding:"14px 16px",marginBottom:14,
      display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${C.indigo}`,
        borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
      <span style={{fontFamily:C.F,fontSize:12,color:C.indigoLt}}>
        Fetching recent comparable sales...
      </span>
    </div>
  );

  if(compsError) return(
    <div style={{background:"rgba(244,63,94,.06)",border:"1px solid rgba(244,63,94,.2)",
      borderRadius:11,padding:"12px 14px",marginBottom:14}}>
      <span style={{fontFamily:C.F,fontSize:12,color:C.rose}}>⚠ {compsError}</span>
      <span style={{fontFamily:C.F,fontSize:11,color:C.textDim,display:"block",marginTop:4}}>
        Enter comps manually below.
      </span>
    </div>
  );

  if(!compsData) return null;

  return(
    <div style={{background:`${C.emerald}06`,border:`1px solid ${C.emerald}22`,
      borderRadius:13,padding:"16px 16px",marginBottom:14}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:7}}>
          <div style={{width:3,height:13,borderRadius:2,
            background:`linear-gradient(180deg,${C.emerald},${C.emerald}60)`,
            boxShadow:`0 0 7px ${C.emerald}80`}}/>
          <span style={{fontSize:9,color:C.emerald,fontFamily:C.F,
            fontWeight:700,letterSpacing:2.2}}>COMPS AUTO-FETCHED</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {compsData.avgPricePerSqft&&(
            <span style={{fontSize:9,color:C.cyan,fontFamily:C.F,fontWeight:700,
              background:"rgba(34,211,238,.08)",border:"1px solid rgba(34,211,238,.2)",
              borderRadius:6,padding:"2px 8px"}}>
              avg {compsData.avgPricePerSqft}
            </span>
          )}
          <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
            {compsData.count} comps found
          </span>
        </div>
      </div>

      {/* Comp cards */}
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {compsData.comps.map((comp,i)=>{
          const override = overrides[i] || {};
          const isEditing = override.editing;
          return(
            <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:10,padding:"11px 13px",
              animation:`slideR .22s ease ${i*.06}s both`}}>
              {!isEditing ? (
                <div style={{display:"flex",alignItems:"center",
                  justifyContent:"space-between",gap:8}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:C.F,fontWeight:700,fontSize:12,
                      color:C.text,marginBottom:2,overflow:"hidden",
                      textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                      {override.address||comp.address}
                    </div>
                    <div style={{fontFamily:C.F,fontSize:10,color:C.textDim}}>
                      {override.details||comp.details}
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontFamily:C.F,fontWeight:800,fontSize:14,
                      color:C.emerald}}>{override.price||comp.price}</div>
                    {comp.daysAgo&&(
                      <div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>
                        {comp.daysAgo}d ago
                      </div>
                    )}
                  </div>
                  <button onClick={()=>setOverrides(p=>({...p,[i]:{...override,editing:true}}))}
                    style={{background:"transparent",border:`1px solid ${C.border}`,
                      color:C.textDim,borderRadius:6,padding:"3px 8px",
                      cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,
                      letterSpacing:1,flexShrink:0}}>
                    EDIT
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
                    <TField label="PRICE" value={override.price||comp.price}
                      onChange={v=>setOverrides(p=>({...p,[i]:{...p[i],price:v}}))}
                      placeholder="$1,850,000"/>
                    <TField label="DETAILS" value={override.details||comp.details}
                      onChange={v=>setOverrides(p=>({...p,[i]:{...p[i],details:v}}))}
                      placeholder="4bd/3ba, 2,600sqft..."/>
                  </div>
                  <button onClick={()=>setOverrides(p=>({...p,[i]:{...p[i],editing:false}}))}
                    style={{background:`${C.emerald}18`,border:`1px solid ${C.emerald}30`,
                      color:C.emerald,borderRadius:6,padding:"4px 12px",
                      cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700}}>
                    ✓ Done
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compsData.subject&&(
        <div style={{marginTop:10,fontSize:10,color:C.textDim,fontFamily:C.F,
          textAlign:"center"}}>
          Subject: {compsData.subject.beds}bd / {compsData.subject.baths}ba
          {compsData.subject.sqft&&` · ${compsData.subject.sqft.toLocaleString()}sqft`}
          {compsData.subject.yearBuilt&&` · Built ${compsData.subject.yearBuilt}`}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — TRANSACTION TIMELINE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function TransactionTimeline(){
  const [inputs,setInputs]=useState({
    address:"",offerDate:"",closeDate:"",salePrice:"",
    buyerName:"",buyerAgent:"",inspectionDays:"10",
    appraisalDays:"21",financingDays:"25",notes:""
  });
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);

  function set(k){ return v=>setInputs(p=>({...p,[k]:v})); }

  function calculateMilestones(){
    const offer = new Date(inputs.offerDate);
    const close = new Date(inputs.closeDate);
    if(isNaN(offer)||isNaN(close)) return null;

    const addDays=(d,n)=>{ const r=new Date(d); r.setDate(r.getDate()+n); return r; };
    const fmt=(d)=>d.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});

    const inspectionDeadline = addDays(offer, parseInt(inputs.inspectionDays)||10);
    const appraisalDeadline  = addDays(offer, parseInt(inputs.appraisalDays)||21);
    const financingDeadline  = addDays(offer, parseInt(inputs.financingDays)||25);
    const titleSearch        = addDays(offer, 14);
    const finalWalkthrough   = addDays(close, -2);
    const closingDay         = close;

    const totalDays = Math.round((close-offer)/(1000*60*60*24));

    return [
      { date:fmt(offer),          label:"Accepted Offer",         icon:"✅", color:C.emerald,
        action:"Send introduction email to all parties. Confirm earnest money deposit timeline.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, congratulations! Your offer on ${inputs.address||"the property"} has been accepted. Here's what happens next...`},
      { date:fmt(inspectionDeadline), label:`Inspection Deadline`,icon:"🔍", color:C.indigo,
        action:"Schedule home inspection immediately. Confirm inspector, share access instructions with listing agent.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, just a reminder that your inspection deadline is ${fmt(inspectionDeadline)}. Please confirm your inspector is scheduled.`},
      { date:fmt(titleSearch),    label:"Title Search Due",        icon:"📋", color:C.cyan,
        action:"Follow up with title company on search progress. Flag any liens or easements.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, title search is underway for ${inputs.address||"your property"}. I'll update you as soon as we have results.`},
      { date:fmt(appraisalDeadline), label:"Appraisal Deadline",  icon:"🏠", color:C.violet,
        action:"Confirm appraisal is scheduled and appraiser has access. Provide comp data to support value.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, your appraisal is due by ${fmt(appraisalDeadline)}. Let me know if you need any updates on this.`},
      { date:fmt(financingDeadline), label:"Financing Deadline",  icon:"💰", color:C.amber,
        action:"Follow up with lender on loan commitment letter. Alert all parties of status.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, your financing deadline is ${fmt(financingDeadline)}. Please confirm your lender has everything they need for final approval.`},
      { date:fmt(finalWalkthrough),  label:"Final Walkthrough",   icon:"👀", color:C.cyan,
        action:"Schedule final walkthrough with buyer. Confirm all repairs completed and agreed items are in place.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, we're almost there! Your final walkthrough is scheduled for ${fmt(finalWalkthrough)}. I'll confirm the time with you shortly.`},
      { date:fmt(closingDay),     label:"CLOSING DAY 🎉",          icon:"🏆", color:C.emerald,
        action:"Confirm closing time and location with title company. Remind buyer to bring ID and certified funds.",
        email:`Hi ${inputs.buyerName||"[Buyer]"}, today is the day! Closing is confirmed for ${fmt(closingDay)}. Please bring your photo ID and certified funds. Congratulations on your new home!`},
    ];
  }

  async function generate(){
    if(!inputs.address||!inputs.offerDate||!inputs.closeDate){
      alert("Please enter property address, offer date, and close date"); return;
    }
    setLoading(true);
    const milestones = calculateMilestones();
    setResult({ milestones, inputs:{...inputs} });
    setLoading(false);
  }

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      <TCard accent={C.indigo}>
        <TLabel color={C.indigo}>TRANSACTION DETAILS</TLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <TField label="PROPERTY ADDRESS" value={inputs.address} onChange={set("address")} placeholder="123 Ocean Dr, Miami Beach"/>
          <TField label="SALE PRICE" value={inputs.salePrice} onChange={set("salePrice")} placeholder="$1,250,000"/>
          <TField label="BUYER NAME" value={inputs.buyerName} onChange={set("buyerName")} placeholder="Sarah & Mike Johnson"/>
          <TField label="BUYER'S AGENT" value={inputs.buyerAgent} onChange={set("buyerAgent")} placeholder="John Smith"/>
          <TField label="OFFER ACCEPTED DATE" value={inputs.offerDate} onChange={set("offerDate")} placeholder="2026-07-01" type="date"/>
          <TField label="CLOSING DATE" value={inputs.closeDate} onChange={set("closeDate")} placeholder="2026-08-01" type="date"/>
          <TField label="INSPECTION DEADLINE (DAYS)" value={inputs.inspectionDays} onChange={set("inspectionDays")} placeholder="10"/>
          <TField label="FINANCING DEADLINE (DAYS)" value={inputs.financingDays} onChange={set("financingDays")} placeholder="25"/>
        </div>
        <TField label="NOTES / SPECIAL CONDITIONS" value={inputs.notes} onChange={set("notes")} placeholder="Cash offer, no financing contingency, as-is..." area rows={2}/>
        <TBtn onClick={generate} loading={loading} color={C.indigo}>
          📋 Generate Transaction Timeline
        </TBtn>
      </TCard>

      {result&&(
        <div style={{animation:"scaleIn .28s ease"}}>
          {/* Summary header */}
          <div style={{background:`linear-gradient(135deg,${C.indigo}14,${C.violet}08)`,
            border:`1px solid ${C.indigo}28`,borderRadius:13,padding:"16px 18px",
            marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:15,color:C.text,marginBottom:3}}>
                {result.inputs.address||"Transaction Timeline"}
              </div>
              <div style={{fontFamily:C.F,fontSize:11,color:C.textDim}}>
                {result.inputs.offerDate} → {result.inputs.closeDate}
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:22,color:C.emerald}}>
                {result.milestones.length}
              </div>
              <div style={{fontSize:8,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>MILESTONES</div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{position:"relative"}}>
            {/* Vertical line */}
            <div style={{position:"absolute",left:19,top:8,bottom:8,width:1,
              background:`linear-gradient(180deg,${C.indigo},${C.emerald})`,opacity:.2}}/>

            {result.milestones.map((m,i)=>(
              <div key={i} style={{display:"flex",gap:13,marginBottom:12,
                animation:`slideR .28s ease ${i*.07}s both`}}>
                {/* Circle */}
                <div style={{width:38,height:38,borderRadius:"50%",flexShrink:0,
                  background:`linear-gradient(135deg,${m.color}22,${m.color}0a)`,
                  border:`1px solid ${m.color}40`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:16,zIndex:1,boxShadow:`0 0 8px ${m.color}20`}}>
                  {m.icon}
                </div>
                {/* Content */}
                <div style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,
                  borderRadius:11,padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",
                    alignItems:"flex-start",marginBottom:6}}>
                    <div>
                      <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,
                        color:m.color}}>{m.label}</div>
                      <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>
                        📅 {m.date}
                      </div>
                    </div>
                    <TCopyBtn text={m.email}/>
                  </div>
                  <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:"0 0 8px",
                    lineHeight:1.5}}>{m.action}</p>
                  {/* Email preview */}
                  <div style={{background:"rgba(255,255,255,.02)",borderRadius:7,
                    padding:"8px 10px",borderLeft:`2px solid ${m.color}60`}}>
                    <div style={{fontSize:7,color:m.color,fontFamily:C.F,fontWeight:700,
                      letterSpacing:1.5,marginBottom:4}}>CLIENT EMAIL</div>
                    <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:0,
                      lineHeight:1.5}}>{m.email}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — LISTING PRESENTATION BUILDER
// ─────────────────────────────────────────────────────────────────────────────
function ListingPresentation(){
  const [inputs,setInputs]=useState({
    address:"", askingPrice:"", beds:"", baths:"", sqft:"",
    keyFeatures:"", neighborhood:"",
    agentName:"", agentYears:"", agentSales:"", agentDom:"",
    agentMarket:"", sellerGoal:""
  });
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [compOverrides,setCompOverrides]=useState({});
  const { compsLoading, compsError, compsData, fetchComps } = useCompFetcher();

  function set(k){ return v=>{
    setInputs(p=>({...p,[k]:v}));
    if(k==="address") fetchComps(v);
  }; }

  function buildCompsString(){
    if(!compsData) return "No comps available — agent to provide";
    return compsData.comps.map((c,i)=>{
      const ov = compOverrides[i]||{};
      return `${ov.address||c.address} — ${ov.price||c.price}, ${ov.details||c.details}`;
    }).join(". ");
  }

  async function generate(){
    if(!inputs.address||!inputs.askingPrice){
      alert("Please enter property address and asking price"); return;
    }
    setLoading(true);
    try{
      const compsString = buildCompsString();
      const r = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, an elite real estate AI. Generate a compelling, data-driven listing presentation. Return ONLY valid JSON, no markdown.",
          messages:[{role:"user",content:
            `Create a full listing presentation for: ${inputs.address}, asking ${inputs.askingPrice}, ${inputs.beds}bd/${inputs.baths}ba, ${inputs.sqft}sqft. Features: ${inputs.keyFeatures}. Neighborhood: ${inputs.neighborhood}. Comparable sales: ${compsString}. Agent: ${inputs.agentName}, ${inputs.agentYears} years experience, ${inputs.agentSales} listings sold, avg ${inputs.agentDom} days on market, specializes in ${inputs.agentMarket}. Seller goal: ${inputs.sellerGoal}.

Return ONLY valid JSON:
{"pricing_recommendation":"specific price recommendation with reasoning in 2-3 sentences","pricing_scenarios":[{"scenario":"Aggressive","price":"$X","rationale":"why","expected_dom":"X days"},{"scenario":"Market Rate","price":"$X","rationale":"why","expected_dom":"X days"},{"scenario":"Conservative","price":"$X","rationale":"why","expected_dom":"X days"}],"market_positioning":"2-3 sentences on how to position this listing","marketing_plan":["8 specific marketing actions SPARK AI will execute for this listing"],"why_hire_me":"compelling 3-4 sentence paragraph why this agent should be hired, based on their stats","opening_statement":"powerful 2-3 sentence opening for the listing appointment","seller_talking_points":["5 key talking points to address common seller concerns"],"listing_timeline":["5 key steps from signed listing agreement to closing"],"competitive_advantage":"2-3 sentences on what makes this agent different from competitors"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setResult(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      <TCard accent={C.violet}>
        <TLabel color={C.violet}>PROPERTY DETAILS</TLabel>
        <TField label="PROPERTY ADDRESS" value={inputs.address} onChange={set("address")} placeholder="456 Palm Ave, Miami Beach, FL"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <TField label="ASKING PRICE" value={inputs.askingPrice} onChange={set("askingPrice")} placeholder="$2,450,000"/>
          <TField label="NEIGHBORHOOD" value={inputs.neighborhood} onChange={set("neighborhood")} placeholder="South Beach"/>
          <TField label="BEDS" value={inputs.beds} onChange={set("beds")} placeholder="4"/>
          <TField label="BATHS" value={inputs.baths} onChange={set("baths")} placeholder="3.5"/>
          <TField label="SQ FT" value={inputs.sqft} onChange={set("sqft")} placeholder="3,200"/>
          <TField label="SELLER'S GOAL" value={inputs.sellerGoal} onChange={set("sellerGoal")} placeholder="Close in 45 days, relocating..."/>
        </div>
        <TField label="KEY FEATURES" value={inputs.keyFeatures} onChange={set("keyFeatures")} placeholder="Pool, ocean views, renovated kitchen..." area rows={2}/>
      </TCard>

      {/* Auto-fetched comps */}
      <CompsPanel
        compsLoading={compsLoading}
        compsError={compsError}
        compsData={compsData}
        overrides={compOverrides}
        setOverrides={setCompOverrides}
      />

      <TCard accent={C.emerald}>
        <TLabel color={C.emerald}>YOUR STATS</TLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <TField label="YOUR NAME" value={inputs.agentName} onChange={set("agentName")} placeholder="Sarah Williams"/>
          <TField label="YEARS EXPERIENCE" value={inputs.agentYears} onChange={set("agentYears")} placeholder="12"/>
          <TField label="LISTINGS SOLD (12mo)" value={inputs.agentSales} onChange={set("agentSales")} placeholder="34"/>
          <TField label="AVG DAYS ON MARKET" value={inputs.agentDom} onChange={set("agentDom")} placeholder="21"/>
        </div>
        <TField label="YOUR MARKET SPECIALTY" value={inputs.agentMarket} onChange={set("agentMarket")} placeholder="Luxury waterfront, South Beach"/>
      </TCard>

      <TBtn onClick={generate} loading={loading} color={C.violet}>
        🏆 Build Listing Presentation
      </TBtn>

      {result&&(
        <div style={{marginTop:20,animation:"scaleIn .28s ease"}}>
          {/* Opening */}
          <TCard accent={C.violet}>
            <TLabel color={C.violet}>OPENING STATEMENT</TLabel>
            <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,
              lineHeight:1.7,fontWeight:600,fontStyle:"italic"}}>
              "{result.opening_statement}"
            </p>
            <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
              <TCopyBtn text={result.opening_statement}/>
            </div>
          </TCard>

          {/* Pricing scenarios */}
          <TCard accent={C.amber}>
            <TLabel color={C.amber}>PRICING STRATEGY</TLabel>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 14px",
              lineHeight:1.6}}>{result.pricing_recommendation}</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
              {(result.pricing_scenarios||[]).map((s,i)=>(
                <div key={i} style={{
                  background:`${[C.emerald,C.indigo,C.amber][i]}0a`,
                  border:`1px solid ${[C.emerald,C.indigo,C.amber][i]}28`,
                  borderRadius:10,padding:"12px 10px",textAlign:"center"}}>
                  <div style={{fontSize:9,color:[C.emerald,C.indigo,C.amber][i],
                    fontFamily:C.F,fontWeight:700,letterSpacing:1,marginBottom:4}}>
                    {s.scenario}
                  </div>
                  <div style={{fontFamily:C.F,fontWeight:800,fontSize:16,
                    color:C.text,marginBottom:4}}>{s.price}</div>
                  <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,
                    marginBottom:4}}>{s.expected_dom}</div>
                  <div style={{fontSize:9,color:C.textMd,fontFamily:C.F,
                    lineHeight:1.4}}>{s.rationale}</div>
                </div>
              ))}
            </div>
          </TCard>

          {/* Why hire me */}
          <TCard accent={C.emerald}>
            <TLabel color={C.emerald}>WHY HIRE ME</TLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8}}>
              {result.why_hire_me}
            </p>
            <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
              <TCopyBtn text={result.why_hire_me}/>
            </div>
          </TCard>

          <ResultList label="MARKETING PLAN" items={result.marketing_plan} color={C.indigo}/>
          <ResultList label="SELLER TALKING POINTS" items={result.seller_talking_points} color={C.violet}/>
          <ResultList label="LISTING TIMELINE" items={result.listing_timeline} color={C.cyan}/>
          <ResultBlock label="MARKET POSITIONING" value={result.market_positioning} color={C.cyan}/>
          <ResultBlock label="COMPETITIVE ADVANTAGE" value={result.competitive_advantage} color={C.violet}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — PRICING STRATEGY & CMA ANALYZER
// ─────────────────────────────────────────────────────────────────────────────
function CMAAnalyzer(){
  const [inputs,setInputs]=useState({
    address:"", beds:"", baths:"", sqft:"", condition:"",
    lotSize:"", yearBuilt:"", features:"", neighborhood:"",
    marketTrend:"", daysOnMarket:""
  });
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const [compOverrides,setCompOverrides]=useState({});
  const { compsLoading, compsError, compsData, fetchComps } = useCompFetcher();

  function set(k){ return v=>{
    setInputs(p=>({...p,[k]:v}));
    if(k==="address") fetchComps(v);
  }; }

  function buildCompsString(){
    if(!compsData) return "";
    return compsData.comps.map((c,i)=>{
      const ov = compOverrides[i]||{};
      return `Comp ${i+1}: ${ov.price||c.price} — ${ov.details||c.details}`;
    }).join(". ");
  }

  async function generate(){
    if(!inputs.address){
      alert("Please enter the property address"); return;
    }
    const compsString = buildCompsString();
    if(!compsString && !compsData){
      alert("Waiting for comps to load — try again in a moment"); return;
    }
    setLoading(true);
    try{
      const r = await fetch("/api/claude",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, an expert real estate pricing strategist. Analyze comps and generate a comprehensive CMA. Return ONLY valid JSON, no markdown.",
          messages:[{role:"user",content:
            `Analyze this CMA: Subject property: ${inputs.address}, ${inputs.beds}bd/${inputs.baths}ba, ${inputs.sqft}sqft, built ${inputs.yearBuilt}, condition: ${inputs.condition}, features: ${inputs.features}, neighborhood: ${inputs.neighborhood}, lot: ${inputs.lotSize}. Comparable sales: ${compsString}. Market trend: ${inputs.marketTrend}. Avg days on market: ${inputs.daysOnMarket}.

Return ONLY valid JSON:
{"recommended_price":"specific price recommendation with dollar amount","price_range":{"low":"$X","mid":"$X","high":"$X"},"price_per_sqft":"$X/sqft","value_adjustments":["4-5 specific adjustments made vs comps — e.g. +$15,000 for pool, -$8,000 for year built"],"days_on_market_prediction":"X-Y days at recommended price","market_summary":"2-3 sentence market context","pricing_rationale":"3-4 sentences explaining the recommended price","seller_presentation_script":"what to say when presenting this price to the seller — 3-4 natural sentences","price_reduction_trigger":"specific market signals that would indicate a price reduction is needed","negotiation_range":"the lowest price that would still make sense to accept and why"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setResult(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      <TCard accent={C.cyan}>
        <TLabel color={C.cyan}>SUBJECT PROPERTY</TLabel>
        <TField label="ADDRESS" value={inputs.address} onChange={set("address")} placeholder="789 Bayview Dr, Miami, FL"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <TField label="CONDITION" value={inputs.condition} onChange={set("condition")} placeholder="Excellent / Good / Average"/>
          <TField label="NEIGHBORHOOD" value={inputs.neighborhood} onChange={set("neighborhood")} placeholder="Coconut Grove"/>
          <TField label="BEDS" value={inputs.beds} onChange={set("beds")} placeholder="4"/>
          <TField label="BATHS" value={inputs.baths} onChange={set("baths")} placeholder="3"/>
          <TField label="SQ FT" value={inputs.sqft} onChange={set("sqft")} placeholder="2,800"/>
          <TField label="YEAR BUILT" value={inputs.yearBuilt} onChange={set("yearBuilt")} placeholder="2018"/>
          <TField label="LOT SIZE" value={inputs.lotSize} onChange={set("lotSize")} placeholder="8,500 sqft"/>
          <TField label="AVG DAYS ON MARKET" value={inputs.daysOnMarket} onChange={set("daysOnMarket")} placeholder="28"/>
        </div>
        <TField label="KEY FEATURES" value={inputs.features} onChange={set("features")} placeholder="Pool, renovated kitchen, 2-car garage..." area rows={2}/>
        <TField label="MARKET TREND" value={inputs.marketTrend} onChange={set("marketTrend")} placeholder="Hot / Balanced / Cooling / Slow"/>
      </TCard>

      {/* Auto-fetched comps */}
      <CompsPanel
        compsLoading={compsLoading}
        compsError={compsError}
        compsData={compsData}
        overrides={compOverrides}
        setOverrides={setCompOverrides}
      />

      <TBtn onClick={generate} loading={loading} color={C.cyan}>
        📊 Analyze & Generate CMA
      </TBtn>

      {result&&(
        <div style={{marginTop:20,animation:"scaleIn .28s ease"}}>
          {/* Price recommendation hero */}
          <div style={{
            background:`linear-gradient(135deg,${C.emerald}12,${C.indigo}08)`,
            border:`1px solid ${C.emerald}30`,
            borderRadius:14,padding:"22px 20px",marginBottom:14,textAlign:"center"}}>
            <div style={{fontSize:9,color:C.emerald,letterSpacing:2.5,
              fontFamily:C.F,fontWeight:700,marginBottom:6}}>RECOMMENDED LIST PRICE</div>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:38,
              color:C.text,letterSpacing:"-0.03em",marginBottom:8}}>
              {result.recommended_price}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:16,marginBottom:10}}>
              {[
                {label:"Low",value:result.price_range?.low,color:C.amber},
                {label:"Mid",value:result.price_range?.mid,color:C.emerald},
                {label:"High",value:result.price_range?.high,color:C.indigo},
              ].map(p=>(
                <div key={p.label} style={{textAlign:"center"}}>
                  <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:p.color}}>{p.value}</div>
                  <div style={{fontSize:8,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>{p.label}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"center",gap:20}}>
              <div style={{fontSize:11,color:C.textMd,fontFamily:C.F}}>
                📐 {result.price_per_sqft}/sqft
              </div>
              <div style={{fontSize:11,color:C.textMd,fontFamily:C.F}}>
                📅 {result.days_on_market_prediction}
              </div>
            </div>
          </div>

          <TCard accent={C.cyan}>
            <TLabel color={C.cyan}>SELLER PRESENTATION SCRIPT</TLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,
              lineHeight:1.8,fontStyle:"italic"}}>
              "{result.seller_presentation_script}"
            </p>
            <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
              <TCopyBtn text={result.seller_presentation_script}/>
            </div>
          </TCard>

          <ResultBlock label="PRICING RATIONALE" value={result.pricing_rationale} color={C.emerald}/>
          <ResultBlock label="MARKET SUMMARY" value={result.market_summary} color={C.cyan}/>
          <ResultList label="VALUE ADJUSTMENTS VS COMPS" items={result.value_adjustments} color={C.amber}/>
          <ResultBlock label="PRICE REDUCTION TRIGGER" value={result.price_reduction_trigger} color={C.rose}/>
          <ResultBlock label="NEGOTIATION FLOOR" value={result.negotiation_range} color={C.violet}/>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN TRANSACTION PANEL — tab switcher for all 3 tools
// ─────────────────────────────────────────────────────────────────────────────
export default function TransactionPanel({ user, planKey }){
  const [tool,setTool]=useState("timeline");

  const TOOLS=[
    {id:"timeline",    label:"Timeline",     icon:"📋", color:C.indigo,  desc:"Deal milestones + client emails"},
    {id:"presentation",label:"Presentation", icon:"🏆", color:C.violet,  desc:"Full listing appointment deck"},
    {id:"cma",         label:"Pricing CMA",  icon:"📊", color:C.cyan,    desc:"Comp analysis + price strategy"},
  ];

  return(
    <div style={{paddingBottom:40}}>
      {/* Tool selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:20}}>
        {TOOLS.map(t=>(
          <div key={t.id} onClick={()=>setTool(t.id)}
            style={{
              padding:"13px 10px",borderRadius:12,cursor:"pointer",textAlign:"center",
              border:`1px solid ${tool===t.id?t.color+"50":C.border}`,
              background:tool===t.id?`${t.color}0e`:"rgba(255,255,255,.015)",
              transition:"all .16s ease"}}>
            <div style={{fontSize:20,marginBottom:6}}>{t.icon}</div>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:11,
              color:tool===t.id?t.color:C.textMd,marginBottom:3}}>{t.label}</div>
            <div style={{fontFamily:C.F,fontSize:9,color:C.textDim,lineHeight:1.3}}>
              {t.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Active tool */}
      {tool==="timeline"     && <TransactionTimeline/>}
      {tool==="presentation" && <ListingPresentation/>}
      {tool==="cma"          && <CMAAnalyzer/>}
    </div>
  );
}
