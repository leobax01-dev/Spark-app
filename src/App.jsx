import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap";
const C = {
  bg:"#050507", surface:"#0a0b0f", surfaceUp:"#0f1018", surfaceHigh:"#141520",
  border:"rgba(255,255,255,0.055)", borderMd:"rgba(255,255,255,0.10)", borderHi:"rgba(255,255,255,0.18)",
  indigo:"#6366f1", indigoLt:"#818cf8", indigoD:"#4f52c9",
  violet:"#8b5cf6", cyan:"#22d3ee", emerald:"#10b981",
  amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8",
  text:"rgba(255,255,255,0.94)", textMd:"rgba(255,255,255,0.52)",
  textDim:"rgba(255,255,255,0.24)", textFaint:"rgba(255,255,255,0.07)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const GLOBAL_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%;background:#050507;-webkit-font-smoothing:antialiased}
  ::-webkit-scrollbar{width:2px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.06);border-radius:2px}
  ::placeholder{color:rgba(255,255,255,0.15)!important}
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(0.95)}to{opacity:1;transform:scale(1)}}
  @keyframes slideR{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:translateX(0)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.08)}}
  @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-44px,26px) scale(1.06)}}
  @keyframes orb3{0%,100%{transform:translate(0,0)}50%{transform:translate(20px,30px)}}
  @keyframes pulse{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
  @keyframes toastIn{from{opacity:0;transform:translateY(10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes carouselSlide{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes carouselSlideL{from{opacity:0;transform:translateX(-20px)}to{opacity:1;transform:translateX(0)}}
  @keyframes photoIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
  @keyframes lineGrow{from{width:0}to{width:100%}}
  @keyframes glow{0%,100%{opacity:.5}50%{opacity:1}}
  .nav-item{transition:all .18s ease}
  .nav-item:hover{background:rgba(255,255,255,0.04)!important;color:rgba(255,255,255,.9)!important}
  .nav-item.active{background:rgba(99,102,241,.1)!important;color:#a5b4fc!important;border-color:rgba(99,102,241,.22)!important}
  .btn-g{transition:all .2s ease}
  .btn-g:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 12px 32px rgba(99,102,241,.28)!important;filter:brightness(1.08)}
  .btn-g:active:not(:disabled){transform:translateY(0);filter:brightness(.96)}
  .btn-g:disabled{opacity:.38;cursor:not-allowed!important}
  .btn-o{transition:all .18s ease}
  .btn-o:hover{border-color:rgba(255,255,255,.18)!important;color:rgba(255,255,255,.92)!important;background:rgba(255,255,255,.03)!important}
  .ifield:focus{border-color:rgba(99,102,241,.5)!important;box-shadow:0 0 0 3px rgba(99,102,241,.08)!important;outline:none}
  .tab-b{transition:all .16s}
  .tab-b:hover{color:rgba(255,255,255,.85)!important}
  .card-h{transition:all .22s ease}
  .card-h:hover{transform:translateY(-3px);border-color:rgba(255,255,255,.1)!important;background:rgba(255,255,255,.025)!important}
  .cp-b{transition:all .2s ease}
  .cp-b:hover{border-color:rgba(99,102,241,.35)!important;transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.3)!important}
  .copy-b{transition:all .16s}
  .copy-b:hover{background:rgba(99,102,241,.1)!important;border-color:rgba(99,102,241,.3)!important;color:#a5b4fc!important}
  .up-tease{transition:all .2s;cursor:pointer}
  .up-tease:hover{border-color:rgba(245,158,11,.4)!important;background:rgba(245,158,11,.06)!important}
  .plat-b{transition:all .18s}
  .plat-b:hover:not([data-locked="true"]){transform:translateY(-1px)}
  .photo-thumb{transition:all .2s;cursor:pointer}
  .photo-thumb:hover{transform:scale(1.05);border-color:rgba(99,102,241,.5)!important}
  .drop-zone{transition:all .24s}
  .drop-zone.drag-over{border-color:rgba(99,102,241,.6)!important;background:rgba(99,102,241,.07)!important}
  .carousel-arrow{transition:all .2s;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(255,255,255,.35);cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;width:38px;height:38px;flex-shrink:0}
  .carousel-arrow:hover{background:rgba(99,102,241,.14)!important;border-color:rgba(99,102,241,.35)!important;color:#a5b4fc!important;transform:scale(1.1)}
  .carousel-dot{transition:all .24s;cursor:pointer;border-radius:4px;flex-shrink:0}
  .premium-card{transition:all .22s ease;position:relative}
  .premium-card::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(99,102,241,.2),rgba(139,92,246,.1),transparent);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none;opacity:0;transition:opacity .3s}
  .premium-card:hover::before{opacity:1}
  .feature-row{transition:all .16s}
  .feature-row:hover{background:rgba(255,255,255,.018)!important}
  .signout-btn{transition:all .18s;cursor:pointer}
  .signout-btn:hover{color:#f43f5e!important;border-color:rgba(244,63,94,.3)!important;background:rgba(244,63,94,.05)!important}
`;


// ─────────────────────────────────────────────────────────────────────────────
const PLANS = {
  agent:{
    name:"Agent", price:29, credits:20, accent:C.emerald, badge:null,
    contentTypes:["listing","education"],
    platforms:["TikTok","Reels"],
    hooks:3, voiceMemory:false, videoQuality:"720p", maxPhotos:3, teamSeats:1, apiAccess:false,
    perks:["20 credits / month","Listing videos + agent tips","TikTok & Reels only","3 hook variants","Up to 3 listing photos","MLS-safe captions","Email support"],
    stripeLink:"https://buy.stripe.com/00w28qa733TZ3Z3gqa0sU00",
  },
  pro:{
    name:"Pro", price:49, credits:60, accent:C.indigo, badge:"Most Popular",
    contentTypes:["listing","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:7, voiceMemory:true, videoQuality:"1080p", maxPhotos:8, teamSeats:1, apiAccess:false,
    perks:["60 credits / month","All 4 content types","All 5 platforms","7 hook variants","Up to 8 listing photos","Agent voice memory","Auto listing video generation","Priority support"],
    stripeLink:"https://buy.stripe.com/7sYcN4gvr4Y37bfddY0sU01",
  },
  team:{
    name:"Team", price:99, credits:180, accent:C.violet, badge:null,
    contentTypes:["listing","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:10, voiceMemory:true, videoQuality:"4K", maxPhotos:20, teamSeats:5, apiAccess:true,
    perks:["180 credits / month","Full content suite","All 5 platforms","10 hook variants","Up to 20 listing photos","4K cinematic video","5-seat workspace","API access","Dedicated support"],
    stripeLink:"https://buy.stripe.com/00waEWgvr0HNfHLei20sU02",
  },
};

const CREDIT_PACKS = [
  {credits:10,  price:8,  label:"Starter",    stripeLink:"https://buy.stripe.com/6oUbJ00wtbmrdzD4Hs0sU03"},
  {credits:30,  price:18, label:"Popular",     stripeLink:"https://buy.stripe.com/7sYcN4cfb2PV9jn2zk0sU04"},
  {credits:80,  price:40, label:"Best Value",  stripeLink:"https://buy.stripe.com/bJeaEW0wt3TZeDH3Do0sU05",  hot:true},
  {credits:200, price:85, label:"Broker Pack", stripeLink:"https://buy.stripe.com/14AbJ0gvr9ej537ddY0sU06"},
];

// Stripe redirect — prepends user email so checkout is pre-filled
function goStripe(link, email){
  if(!link||link.startsWith("REPLACE")){ alert("Stripe not connected yet — add your Payment Links to the PLANS config."); return; }
  const url = email ? link+"?prefilled_email="+encodeURIComponent(email) : link;
  window.location.href = url;
}

const CONTENT_TYPES = {
  listing:  {label:"Listing Video",      icon:"🏠",color:C.indigo, cost:2,desc:"Cinematic walkthrough + auto video", minPlan:"agent"},
  education:{label:"Agent Tip",          icon:"💡",color:C.amber,  cost:1,desc:"Authority-building daily tips",      minPlan:"agent"},
  market:   {label:"Market Update",      icon:"📈",color:C.cyan,   cost:2,desc:"Local stats → viral authority",      minPlan:"pro"},
  lifestyle:{label:"Neighborhood Story", icon:"🌆",color:C.emerald,cost:2,desc:"Lifestyle content for relocators",   minPlan:"pro"},
};

const PLATFORMS = {
  TikTok:  {color:"#FF004F",spec:"9:16 · 30–90s",  minPlan:"agent"},
  Reels:   {color:"#E1306C",spec:"9:16 · 15–90s",  minPlan:"agent"},
  YouTube: {color:"#FF0000",spec:"Shorts · 15–60s",minPlan:"pro"},
  Facebook:{color:"#1877F2",spec:"16:9 · 60–180s", minPlan:"pro"},
  LinkedIn:{color:"#0A66C2",spec:"1:1 · pro tone",  minPlan:"pro"},
};


const INPUT_META = {
  address:      ["Address",              "123 Ocean Drive, Miami Beach, FL 33139"],
  price:        ["List Price",           "$875,000"],
  beds:         ["Beds",                 "4"],
  baths:        ["Baths",               "3"],
  sqft:         ["Sq Ft",               "2,400"],
  keyFeatures:  ["Key Features",        "Pool, chef's kitchen, water views, renovated 2024"],
  neighborhood: ["Neighborhood",        "Miami Beach"],
  city:         ["City / Area",         "Miami, FL"],
  avgPrice:     ["Avg Sale Price",      "$650,000"],
  daysOnMarket: ["Avg Days on Market",  "22 days"],
  inventory:    ["Inventory Level",     "Low — 1.8 months supply"],
  trend:        ["Market Trend",        "Sellers market, up 8% YoY"],
  highlights:   ["Neighborhood Highlights","Top schools, walkable, bayfront parks"],
  targetBuyer:  ["Target Buyer",        "NYC professionals relocating with families"],
  topic:        ["Tip Topic",           "How to win a bidding war without overpaying"],
  audience:     ["Audience",            "First-time buyers in Miami"],
  keyPoint:     ["Key Point",           "Pre-approval isn't enough — use an escalation clause"],
};

const TYPE_INPUTS = {
  listing:  ["address","price","beds","baths","sqft","keyFeatures","neighborhood"],
  market:   ["city","avgPrice","daysOnMarket","inventory","trend"],
  lifestyle:["neighborhood","city","highlights","targetBuyer"],
  education:["topic","audience","keyPoint"],
};

const PLAN_ORDER = ["agent","pro","team"];
const planRank = p => PLAN_ORDER.indexOf(p);

// ─────────────────────────────────────────────────────────────────────────────
// LOCALSTORAGE
// ─────────────────────────────────────────────────────────────────────────────
const LS = {
  get:(k,def)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; }},
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{}},
  del:(k)=>{ try{ localStorage.removeItem(k); }catch{}},
};

// ─────────────────────────────────────────────────────────────────────────────
// API — CLAUDE
// ─────────────────────────────────────────────────────────────────────────────
async function callClaude({ type, inputs, platform, voice, planKey, photoBase64s }) {
  const plan  = PLANS[planKey];
  const hooks = plan.hooks;
  const useVoice = plan.voiceMemory && voice?.saved;

  const voiceCtx = useVoice
    ? `Agent: ${voice.name||""}, ${voice.brokerage||""}, ${voice.market||""}. Specialty: ${voice.specialty||""}. Tone: ${voice.tone||"warm, professional"}. Target client: ${voice.targetClient||""}. Preferred CTA: ${voice.cta||""}.`
    : "Write as a warm, professional, knowledgeable real estate agent.";

  const typeCtx = {
    listing:  `Listing at ${inputs.address||"the property"}, ${inputs.price||""}, ${inputs.beds||"?"}bd/${inputs.baths||"?"}ba, ${inputs.sqft||"?"}sqft. Features: ${inputs.keyFeatures||""}. Neighborhood: ${inputs.neighborhood||""}. ${photoBase64s?.length?"Photos of the actual property have been provided — reference their visual details in the script.":""}`,
    market:   `Market update: ${inputs.city||"local market"}. Avg price ${inputs.avgPrice||""}, ${inputs.daysOnMarket||""} DOM, inventory: ${inputs.inventory||""}, trend: ${inputs.trend||""}.`,
    lifestyle:`Neighborhood story: ${inputs.neighborhood||""}, ${inputs.city||""}. Highlights: ${inputs.highlights||""}. Target buyer: ${inputs.targetBuyer||""}.`,
    education:`Agent tip about: "${inputs.topic||""}" for ${inputs.audience||"buyers and sellers"}. Key point: ${inputs.keyPoint||""}.`,
  };

  // Build message content — include photos for listing type if provided
  const userContent = [];
  if(type==="listing" && photoBase64s?.length){
    photoBase64s.slice(0,4).forEach((b64,i)=>{
      userContent.push({ type:"image", source:{ type:"base64", media_type:"image/jpeg", data:b64 }});
    });
  }
  userContent.push({ type:"text", text:
    `${voiceCtx}\n\n${typeCtx[type]}\n\nPlatform: ${platform} (${PLATFORMS[platform]?.spec||""}). Generate exactly ${hooks} hook variants.\n\n`+
    `Return ONLY valid JSON (no markdown fences):\n`+
    `{"headline":"best single hook","hooks":["exactly ${hooks} distinct hook variants"],"script":"full timed script [0:00] with (camera cues)","higgsfield_prompt":"detailed Higgsfield AI image-to-video prompt: cinematic camera moves (slow dolly in, aerial reveal, orbit), lighting mood, color grade, focus on hero shots from the uploaded photos — specific enough to render immediately","caption":"MLS-safe caption under 220 chars","hashtags":["15 hashtags"],"cta":"platform-native CTA","shot_list":["5 specific shot/scene descriptions"],"thumbnail":"thumbnail concept: composition + text overlay + color","posting_tip":"one specific ${platform} optimization tip"}`
  });

  const r = await fetch("/api/claude",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:2000,
      system:`You are SPARK, an elite real estate content strategist for ${platform}. Always write MLS-compliant content. Return ONLY valid JSON, no markdown.`,
      messages:[{role:"user", content:userContent}],
    }),
  });
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||`API error ${r.status}`); }
  const d=await r.json();
  const raw=(d.content?.[0]?.text||"{}").replace(/```json\n?|```\n?/g,"").trim();
  try{ return JSON.parse(raw); }catch{ throw new Error("Failed to parse AI response — try again"); }
}

// ─────────────────────────────────────────────────────────────────────────────
// API — HIGGSFIELD IMAGE-TO-VIDEO
// ─────────────────────────────────────────────────────────────────────────────
async function callHiggsfieldImg(imageBase64, prompt){
  const r = await fetch("/api/higgsfield",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      endpoint:"https://cloud.higgsfield.ai/api/v1/image-to-video",
      prompt,
      image:`data:image/jpeg;base64,${imageBase64}`,
      model:"soul-v2",
      aspect_ratio:"9:16",
      duration:5,
    }),
  });
  if(!r.ok) throw new Error(`Video generation error ${r.status}`);
  return r.json();
}

async function callHiggsfieldTxt(prompt){
  const r = await fetch("/api/higgsfield",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      endpoint:"https://cloud.higgsfield.ai/api/v1/generate",
      prompt,
      model:"soul-v2",
      aspect_ratio:"9:16",
      duration:5,
    }),
  });
  if(!r.ok) throw new Error(`Video generation error ${r.status}`);
  return r.json();
}

async function pollHiggsfield(jobId, onProgress){
  const MAX=60, INTERVAL=4000;
  for(let i=0;i<MAX;i++){
    await new Promise(r=>setTimeout(r,INTERVAL));
    const pct = Math.min(92, 20+(i/MAX)*72);
    onProgress(Math.round(pct));
    try{
      const r = await fetch(`/api/higgsfield-poll?jobId=${jobId}`);
      if(!r.ok) continue;
      const d = await r.json();
      const status = d?.status||d?.state;
      if(status==="completed"||status==="succeeded"){
        const url = d?.output?.media_url?.[0] || d?.output?.url || d?.result?.url || null;
        return {done:true, url};
      }
      if(status==="failed"||status==="error") return {done:true, url:null, failed:true};
    }catch{}
  }
  return {done:true, url:null, failed:true};
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION
// ─────────────────────────────────────────────────────────────────────────────
function useStyles(){
  useEffect(()=>{
    if(!document.getElementById("spark-css")){
      const s=document.createElement("style"); s.id="spark-css"; s.textContent=GLOBAL_CSS;
      document.head.appendChild(s);
    }
    if(!document.getElementById("spark-font")){
      const l=document.createElement("link"); l.id="spark-font"; l.rel="stylesheet"; l.href=FONTS_URL;
      document.head.appendChild(l);
    }
  },[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
const ToastCtx={listeners:[]};
function useToast(){ return useCallback((msg,type="success")=>{ ToastCtx.listeners.forEach(fn=>fn({msg,type,id:Date.now()})); },[]); }
function ToastContainer(){
  const [toasts,setToasts]=useState([]);
  useEffect(()=>{
    const fn=(t)=>{ setToasts(p=>[...p,t]); setTimeout(()=>setToasts(p=>p.filter(x=>x.id!==t.id)),3400); };
    ToastCtx.listeners.push(fn);
    return ()=>{ ToastCtx.listeners=ToastCtx.listeners.filter(f=>f!==fn); };
  },[]);
  return(
    <div style={{position:"fixed",bottom:24,right:20,zIndex:9999,display:"flex",flexDirection:"column",gap:8,maxWidth:320}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          background:t.type==="error"?"rgba(244,63,94,.12)":t.type==="info"?"rgba(99,102,241,.12)":"rgba(16,185,129,.12)",
          border:`1px solid ${t.type==="error"?C.rose:t.type==="info"?C.indigo:C.emerald}44`,
          color:t.type==="error"?C.rose:t.type==="info"?C.indigoLt:C.emerald,
          padding:"11px 16px",borderRadius:10,fontSize:13,fontFamily:C.F,fontWeight:600,
          boxShadow:"0 8px 24px rgba(0,0,0,.4)",animation:"toastIn .25s ease both",backdropFilter:"blur(12px)",
        }}>{t.type==="error"?"✕ ":t.type==="info"?"ℹ ":"✓ "}{t.msg}</div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
function OrbBg(){
  return(
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:-1}}>
      <div style={{position:"absolute",width:800,height:800,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.07) 0%,transparent 65%)",top:"-20%",left:"-15%",animation:"orb1 28s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:700,height:700,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,.05) 0%,transparent 65%)",bottom:"-10%",right:"-10%",animation:"orb2 32s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:500,height:500,borderRadius:"50%",background:"radial-gradient(circle,rgba(34,211,238,.03) 0%,transparent 65%)",top:"40%",left:"50%",animation:"orb3 22s ease-in-out infinite"}}/>
      <div style={{position:"absolute",inset:0,background:"repeating-linear-gradient(0deg,transparent,transparent 60px,rgba(255,255,255,.008) 60px,rgba(255,255,255,.008) 61px),repeating-linear-gradient(90deg,transparent,transparent 60px,rgba(255,255,255,.008) 60px,rgba(255,255,255,.008) 61px)"}}/>
    </div>
  );
}
function Logo({small}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:small?30:36,height:small?30:36,borderRadius:9,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:small?14:17,boxShadow:"0 0 0 1px rgba(99,102,241,.3), 0 4px 20px rgba(99,102,241,.3)",flexShrink:0}}>⚡</div>
      <div>
        <div style={{fontFamily:C.F,fontWeight:800,fontSize:small?14:16,color:C.text,letterSpacing:.5}}>SPARK</div>
        <div style={{fontFamily:C.F,fontSize:8,color:C.textDim,letterSpacing:2.5,marginTop:-1}}>REAL ESTATE AI</div>
      </div>
    </div>
  );
}
function Shimmer({children,style={}}){
  return <span style={{background:"linear-gradient(90deg,#6366f1,#a5b4fc,#8b5cf6,#6366f1)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3s linear infinite",...style}}>{children}</span>;
}
function Badge({color=C.indigo,children}){
  return <span style={{background:color+"14",border:`1px solid ${color}35`,color,fontSize:9,fontWeight:700,padding:"3px 10px",borderRadius:20,fontFamily:C.F,letterSpacing:1.8,whiteSpace:"nowrap",backdropFilter:"blur(4px)"}}>{children}</span>;
}
function CopyBtn({text,label}){
  const [ok,setOk]=useState(false); const toast=useToast();
  return(
    <button className="copy-b" onClick={()=>{ navigator.clipboard.writeText(text).then(()=>{ setOk(true); toast(label||"Copied"); setTimeout(()=>setOk(false),2000); }).catch(()=>toast("Copy failed","error")); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontSize:10,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:C.F,fontWeight:600,letterSpacing:1}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}
function Field({label,value,onChange,placeholder,area,rows=2,type="text"}){
  const s={width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:C.F,transition:"border-color .18s, box-shadow .18s",resize:"none"};
  return(
    <div>
      <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:6}}>{label}</div>
      {area?<textarea className="ifield" value={value} onChange={onChange} placeholder={placeholder} rows={rows} style={s}/>
           :<input className="ifield" type={type} value={value} onChange={onChange} placeholder={placeholder} style={s}/>}
    </div>
  );
}
function Spinner({size=18,color=C.indigo}){
  return <div style={{width:size,height:size,borderRadius:"50%",border:`2px solid ${color}33`,borderTopColor:color,animation:"spin .7s linear infinite",flexShrink:0}}/>;
}
function ProgressRing({pct,size=56}){
  const r=(size-6)/2,circ=2*Math.PI*r,off=circ-(pct/100)*circ;
  return(
    <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,.05)" strokeWidth={3}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.indigo} strokeWidth={3}
        strokeDasharray={circ} strokeDashoffset={off} style={{transition:"stroke-dashoffset .35s ease",strokeLinecap:"round"}}/>
    </svg>
  );
}
function UpgradePrompt({feature,requiredPlan,onUpgrade}){
  const p=PLANS[requiredPlan];
  return(
    <div className="up-tease" onClick={onUpgrade} style={{background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:"22px 20px",textAlign:"center",animation:"scaleIn .25s ease"}}>
      <div style={{fontSize:22,marginBottom:8}}>🔒</div>
      <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.amber,marginBottom:6}}>{feature} requires {p.name} plan</div>
      <div style={{fontFamily:C.F,fontSize:12,color:C.textMd,marginBottom:14,lineHeight:1.55}}>Upgrade to {p.name} (${p.price}/mo) to unlock.</div>
      <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#fff",padding:"8px 18px",borderRadius:8,fontSize:12,fontWeight:700,fontFamily:C.F}}>Upgrade to {p.name} →</div>
    </div>
  );
}
function RBlock({accent,label,children,action,delay=0}){
  return(
    <div style={{background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:12,padding:20,marginBottom:10,animation:`scaleIn .28s ease ${delay}s both`}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:2,height:12,background:accent,borderRadius:1,boxShadow:`0 0 7px ${accent}`}}/>
          <span style={{fontSize:9,color:accent,letterSpacing:2,fontFamily:C.F,fontWeight:700}}>{label}</span>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHOTO UPLOADER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function PhotoUploader({ photos, setPhotos, maxPhotos, planKey, onGoUpgrade }){
  const inputRef = useRef(null);
  const toast = useToast();
  const [dragging, setDragging] = useState(false);

  async function processFiles(files){
    const remaining = maxPhotos - photos.length;
    if(remaining <= 0){ toast(`Plan limit is ${maxPhotos} photos. Upgrade for more.`,"error"); return; }
    const toAdd = Array.from(files).slice(0, remaining);
    const results = [];
    for(const file of toAdd){
      if(!file.type.startsWith("image/")){ toast("Only image files allowed","error"); continue; }
      if(file.size > 12*1024*1024){ toast(`${file.name} is too large — max 12MB`,"error"); continue; }
      const b64 = await new Promise((res,rej)=>{
        const fr=new FileReader();
        fr.onload=()=>res(fr.result.split(",")[1]);
        fr.onerror=rej;
        fr.readAsDataURL(file);
      });
      const preview = URL.createObjectURL(file);
      results.push({ id:Date.now()+Math.random(), b64, preview, name:file.name });
    }
    setPhotos(p=>[...p,...results]);
    if(results.length) toast(`${results.length} photo${results.length>1?"s":""} added ✓`);
  }

  function handleDrop(e){
    e.preventDefault(); setDragging(false);
    processFiles(e.dataTransfer.files);
  }
  function handleDrag(e){ e.preventDefault(); setDragging(true); }
  function handleDragLeave(){ setDragging(false); }
  function removePhoto(id){ setPhotos(p=>p.filter(x=>x.id!==id)); }
  function moveHero(id){ setPhotos(p=>{ const i=p.findIndex(x=>x.id===id); if(i<=0) return p; const a=[...p]; const [item]=a.splice(i,1); return [item,...a]; }); }

  return(
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:9}}>
        <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700}}>
          LISTING PHOTOS <span style={{color:C.indigo,fontWeight:400}}>({photos.length}/{maxPhotos})</span>
        </div>
        {photos.length>0&&<span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Tap ⭐ to set hero frame</span>}
      </div>

      {/* Photo thumbnails */}
      {photos.length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          {photos.map((ph,i)=>(
            <div key={ph.id} className="photo-thumb" style={{position:"relative",width:72,height:72,borderRadius:8,overflow:"hidden",border:`2px solid ${i===0?C.indigo:C.border}`,animation:"photoIn .22s ease both",flexShrink:0}}>
              <img src={ph.preview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              {i===0&&<div style={{position:"absolute",top:2,left:2,background:"rgba(99,102,241,.88)",borderRadius:4,padding:"1px 4px",fontSize:8,color:"#fff",fontWeight:700,fontFamily:C.F}}>HERO</div>}
              <div style={{position:"absolute",top:2,right:2,display:"flex",gap:3}}>
                {i>0&&(
                  <button onClick={()=>moveHero(ph.id)} title="Set as hero" style={{width:18,height:18,borderRadius:3,background:"rgba(0,0,0,.7)",border:"none",cursor:"pointer",fontSize:9,display:"flex",alignItems:"center",justifyContent:"center",color:"#fbbf24"}}>⭐</button>
                )}
                <button onClick={()=>removePhoto(ph.id)} title="Remove" style={{width:18,height:18,borderRadius:3,background:"rgba(0,0,0,.7)",border:"none",cursor:"pointer",fontSize:10,display:"flex",alignItems:"center",justifyContent:"center",color:C.rose}}>✕</button>
              </div>
            </div>
          ))}
          {photos.length<maxPhotos&&(
            <button onClick={()=>inputRef.current?.click()} style={{width:72,height:72,borderRadius:8,border:`2px dashed ${C.border}`,background:"transparent",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,color:C.textDim,flexShrink:0,transition:"all .18s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.indigo+"88";e.currentTarget.style.color=C.indigoLt;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textDim;}}>
              <span style={{fontSize:18}}>+</span>
              <span style={{fontSize:8,fontFamily:C.F,fontWeight:600}}>ADD</span>
            </button>
          )}
        </div>
      )}

      {/* Drop zone — shown when no photos yet */}
      {photos.length===0&&(
        <div className={`drop-zone${dragging?" drag-over":""}`}
          onDrop={handleDrop} onDragOver={handleDrag} onDragLeave={handleDragLeave}
          onClick={()=>inputRef.current?.click()}
          style={{border:`2px dashed ${dragging?C.indigo:C.border}`,borderRadius:10,padding:"28px 16px",textAlign:"center",cursor:"pointer",background:dragging?"rgba(99,102,241,.06)":"rgba(255,255,255,.01)",transition:"all .22s"}}>
          <div style={{fontSize:28,marginBottom:8}}>📸</div>
          <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.textMd,marginBottom:4}}>Drop listing photos here</div>
          <div style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginBottom:8}}>or tap to browse · up to {maxPhotos} photos · JPG/PNG/WEBP</div>
          <div style={{display:"inline-flex",gap:6,alignItems:"center",background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.2)",borderRadius:6,padding:"4px 10px"}}>
            <span style={{fontSize:10,color:C.indigoLt,fontFamily:C.F,fontWeight:600}}>Hero photo → animates into cinematic video ✨</span>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept="image/*" multiple style={{display:"none"}} onChange={e=>processFiles(e.target.files)}/>

      {photos.length===0&&planKey==="agent"&&(
        <div style={{marginTop:8,fontSize:10,color:C.textDim,fontFamily:C.F}}>
          Agent plan: up to 3 photos. <span className="up-tease" onClick={onGoUpgrade} style={{color:C.amber,textDecoration:"underline",cursor:"pointer"}}>Upgrade to Pro for 8 photos →</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VIDEO RESULT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function VideoResultPanel({ vidState, higgsfieldPrompt, videoQuality, hasHiggsfieldKey, onGoSettings }){
  // vidState: null | {status:"generating",pct:N} | {status:"ready",url:string} | {status:"failed"} | {status:"prompt"}

  if(!vidState){
    return(
      <div style={{background:"rgba(34,211,238,.03)",border:`1px solid ${C.border}`,borderRadius:10,padding:18,textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:10}}>🎬</div>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.textMd,marginBottom:6}}>Video generates automatically with your content</div>
        <div style={{fontFamily:C.F,fontSize:11,color:C.textDim}}>Upload listing photos + add your Video Engine key in Settings to enable auto-generation.</div>
      </div>
    );
  }

  if(vidState.status==="generating"){
    return(
      <div style={{background:"rgba(99,102,241,.05)",border:"1px solid rgba(99,102,241,.15)",borderRadius:12,padding:"28px 22px",textAlign:"center",animation:"fadeIn .2s ease"}}>
        <div style={{position:"relative",width:64,height:64,margin:"0 auto 16px"}}>
          <ProgressRing pct={vidState.pct} size={64}/>
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.indigoLt,fontFamily:C.F,fontWeight:700}}>{vidState.pct}%</div>
        </div>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>Generating your cinematic listing video…</div>
        <div style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginBottom:14}}>This takes 30–90 seconds. Your content is ready now while you wait.</div>
        <div style={{display:"flex",justifyContent:"center",gap:5}}>
          {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.indigoLt,animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>)}
        </div>
      </div>
    );
  }

  if(vidState.status==="ready"&&vidState.url){
    return(
      <div style={{animation:"scaleIn .28s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 8px ${C.emerald}`}}/>
          <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:700}}>LISTING VIDEO READY · {videoQuality}</span>
        </div>
        <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:12,boxShadow:"0 12px 40px rgba(0,0,0,.5)"}}>
          <video src={vidState.url} controls playsInline style={{width:"100%",maxHeight:420,display:"block"}}/>
        </div>
        <div style={{display:"flex",gap:8}}>
          <a href={vidState.url} download="spark-listing-video.mp4" style={{flex:1,display:"block"}}>
            <button className="btn-g" style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"11px 0",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:C.F}}>⬇ Download Video</button>
          </a>
          <CopyBtn text={vidState.url} label="Video URL copied"/>
        </div>
      </div>
    );
  }

  if(vidState.status==="failed"||vidState.status==="prompt"){
    return(
      <div style={{animation:"scaleIn .28s ease"}}>
        {vidState.status==="failed"&&(
          <div style={{background:"rgba(244,63,94,.06)",border:"1px solid rgba(244,63,94,.15)",borderRadius:8,padding:"9px 13px",marginBottom:12,fontSize:12,color:C.rose,fontFamily:C.F}}>
            ⚠ Video generation timed out or failed. Use the prompt below to render manually.
          </div>
        )}
        <div style={{background:"rgba(34,211,238,.04)",border:"1px solid rgba(34,211,238,.12)",borderRadius:8,padding:14,marginBottom:10}}>
          <div style={{fontSize:9,color:C.cyan,fontFamily:C.F,fontWeight:700,letterSpacing:2,marginBottom:8}}>CINEMATIC VIDEO PROMPT</div>
          <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,whiteSpace:"pre-wrap",lineHeight:1.75}}>{higgsfieldPrompt}</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:9,flexWrap:"wrap"}}>
          <CopyBtn text={higgsfieldPrompt||""} label="Video prompt copied"/>
          {!hasHiggsfieldKey&&(
            <button className="btn-o" onClick={onGoSettings} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,padding:"5px 12px",borderRadius:7,cursor:"pointer",fontSize:11,fontFamily:C.F,fontWeight:600}}>Add Video Key in Settings →</button>
          )}
        </div>
      </div>
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// ONBOARDING MODAL
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingModal({planKey,onClose}){
  const [step,setStep]=useState(0);
  const steps=[
    {icon:"⚡",title:"Welcome to SPARK",body:`You are on the ${PLANS[planKey].name} plan with ${PLANS[planKey].credits} credits. Turn any listing into a viral video in under 60 seconds.`},
    {icon:"📸",title:"Upload Listing Photos",body:"Go to Generate, tap Listing Video, and upload your property photos. The first photo becomes the hero frame for your cinematic listing video."},
    {icon:"⚡",title:"Generate Everything",body:"Hit Generate — SPARK writes your script, hooks, captions, and automatically renders your animated listing video. One click, everything done."},
    {icon:"📤",title:"Post and Get Leads",body:"Copy your script, caption, and hashtags. Download your animated listing video with one tap. Most agents see their first lead inquiry within 48 hours."},
  ];
  const s=steps[step];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(8,9,14,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}}>
      <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:18,padding:"36px 30px",maxWidth:440,width:"90%",boxShadow:"0 48px 96px rgba(0,0,0,.55)",animation:"scaleIn .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <Logo/>
          <div style={{display:"flex",gap:5}}>
            {steps.map((_,i)=><div key={i} style={{width:i===step?18:6,height:6,borderRadius:3,background:i===step?C.indigo:"rgba(255,255,255,.1)",transition:"all .2s"}}/>)}
          </div>
        </div>
        <div style={{fontSize:36,marginBottom:12}}>{s.icon}</div>
        <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:10,color:C.text}}>{s.title}</div>
        <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,lineHeight:1.7,marginBottom:28}}>{s.body}</p>
        <div style={{display:"flex",gap:10}}>
          {step>0&&<button className="btn-o" onClick={()=>setStep(s=>s-1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"11px 18px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F}}>← Back</button>}
          <button className="btn-g" onClick={()=>step<steps.length-1?setStep(s=>s+1):onClose()} style={{flex:1,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"12px 0",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:"0 4px 18px rgba(99,102,241,.25)"}}>
            {step<steps.length-1?"Next →":"Start Generating ⚡"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERATE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function GeneratePanel({planKey,voice,credits,setCredits,apiKeys,onGoUpgrade,onGoSettings}){
  const plan=PLANS[planKey];
  const toast=useToast();

  const [type,setType]      =useState(()=>LS.get("sp_type","listing"));
  const [platform,setPlatform]=useState(()=>{ const s=LS.get("sp_plat","TikTok"); return plan.platforms.includes(s)?s:"TikTok"; });
  const [inputs,setInputs]  =useState(()=>LS.get("sp_inputs",{}));
  const [photos,setPhotos]  =useState([]);
  const [gen,setGen]        =useState(false);
  const [stage,setStage]    =useState("");
  const [pct,setPct]        =useState(0);
  const [result,setResult]  =useState(null);
  const [vidState,setVid]   =useState(null);
  const [tab,setTab]        =useState("script");
  const genRef              =useRef(false);

  useEffect(()=>LS.set("sp_type",type),[type]);
  useEffect(()=>LS.set("sp_plat",platform),[platform]);
  useEffect(()=>LS.set("sp_inputs",inputs),[inputs]);
  useEffect(()=>{ if(!plan.contentTypes.includes(type)) setType("listing"); if(!plan.platforms.includes(platform)) setPlatform("TikTok"); },[planKey]);
  useEffect(()=>{ setResult(null); setVid(null); },[type,platform]);

  const typeLocked     = !plan.contentTypes.includes(type);
  const platformLocked = !plan.platforms.includes(platform);
  const cost           = CONTENT_TYPES[type]?.cost||2;
  const hasVidKey      = !!apiKeys.higgsfield;
  const canGen         = credits>=cost && !typeLocked && !platformLocked;
  const showPhotoUpload= type==="listing";

  const STAGES=[
    [10,"Analyzing your listing..."],
    [24,"SPARK is crafting your script..."],
    [42,"Writing hooks & captions..."],
    [58,`Optimizing for ${platform}...`],
    [72,"Building shot list & thumbnail..."],
    [86,"Finalizing your package..."],
  ];

  async function generate(){
    if(genRef.current) return;
    if(credits<cost){ onGoUpgrade(); toast("Add credits to generate more content","info"); return; }
    if(typeLocked||platformLocked){ toast("Upgrade your plan to unlock this","error"); return; }

    genRef.current=true;
    setGen(true); setResult(null); setVid(null); setTab("script");

    for(const [p,s] of STAGES){
      if(!genRef.current) break;
      setStage(s); setPct(p);
      await new Promise(r=>setTimeout(r,p<42?420:300));
    }

    try{
      const photoBase64s = photos.map(ph=>ph.b64);
      const content = await callClaude({type,inputs,platform,voice,planKey,photoBase64s});
      setPct(94); setStage("Content ready ✓");
      await new Promise(r=>setTimeout(r,200));
      setResult(content);
      setCredits(c=>{ const n=c-cost; LS.set("sp_credits",n); return n; });
      toast("Content package ready ✓");

      // Trigger Higgsfield video generation in background
      if(type==="listing"){
        setVid({status:"generating",pct:5});
        const heroB64 = photos[0]?.b64 || null;
        const prompt  = content.higgsfield_prompt || `Cinematic listing video for ${inputs.address||"the property"}. Slow dolly-in reveal, warm golden hour lighting, luxury real estate aesthetic.`;
        try{
          let job;
          if(heroB64){
            setStage("Rendering cinematic video...");
            job = await callHiggsfieldImg(heroB64, prompt);
          } else {
            job = await callHiggsfieldTxt(prompt);
          }
          const jobId = job?.id || job?.job_id || job?.data?.id;
          if(jobId){
            // Poll in background without blocking UI
            pollHiggsfield(jobId, (pct)=>{
              setVid(v=>v?.status==="generating"?{status:"generating",pct}:v);
            }).then(res=>{
              if(res.url) setVid({status:"ready",url:res.url});
              else setVid({status:"failed"});
            });
          } else if(job?.output?.media_url?.[0]||job?.result?.url){
            setVid({status:"ready",url:job.output?.media_url?.[0]||job.result?.url});
          } else {
            setVid({status:"prompt"});
          }
        }catch(e){
          console.warn("Video gen error:",e);
          setVid({status:"prompt"});
        }
      } else if(type==="listing"){
        setVid({status:"prompt"});
      }

    }catch(e){
      toast(e.message||"Generation failed — please try again","error");
    }finally{
      genRef.current=false;
      setGen(false); setStage(""); setPct(0);
    }
  }

  const TABS=["script","hooks","caption","video","shots"];

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* Content type selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:18}}>
        {Object.entries(CONTENT_TYPES).map(([k,ct],i)=>{
          const locked=!plan.contentTypes.includes(k);
          const active=type===k;
          return(
            <div key={k} className="card-h" onClick={()=>locked?onGoUpgrade():setType(k)}
              style={{padding:"15px 11px",borderRadius:12,textAlign:"left",position:"relative",border:`1px solid ${active?ct.color+"44":C.border}`,background:active?ct.color+"0c":locked?"rgba(255,255,255,.01)":C.surface,opacity:locked?.58:1,cursor:"pointer",animation:`fadeUp .32s ease ${i*.06}s both`}}>
              {locked&&<div style={{position:"absolute",top:7,right:7,background:"rgba(245,158,11,.14)",border:"1px solid rgba(245,158,11,.28)",borderRadius:4,padding:"1px 5px",fontSize:7,color:C.amber,fontWeight:700,fontFamily:C.F}}>{PLANS[ct.minPlan].name.toUpperCase()}+</div>}
              <div style={{fontSize:19,marginBottom:7}}>{ct.icon}</div>
              <div style={{fontSize:11,fontWeight:700,color:active?ct.color:locked?C.textDim:C.textMd,fontFamily:C.F,marginBottom:2}}>{ct.label}</div>
              <div style={{fontSize:10,color:C.textDim,lineHeight:1.4,fontFamily:C.F,marginBottom:9}}>{ct.desc}</div>
              <Badge color={locked?C.amber:ct.color}>{locked?`${PLANS[ct.minPlan].name}+`:`${ct.cost} CR`}</Badge>
            </div>
          );
        })}
      </div>

      {typeLocked?(
        <UpgradePrompt feature={CONTENT_TYPES[type]?.label||"This content type"} requiredPlan={CONTENT_TYPES[type]?.minPlan||"pro"} onUpgrade={onGoUpgrade}/>
      ):(
        <>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:13}}>

            {/* Voice status */}
            <div style={{marginBottom:16}}>
              {plan.voiceMemory?(
                voice?.saved?(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 7px ${C.emerald}`}}/>
                    <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:600}}>Agent voice active — {voice.name||""} · {voice.market||""}</span>
                  </div>
                ):(
                  <div style={{padding:"7px 11px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.15)",borderRadius:7}}>
                    <span style={{fontSize:11,color:C.indigoLt,fontFamily:C.F}}>Set up Agent Voice in the sidebar for personalised scripts</span>
                  </div>
                )
              ):(
                <div className="up-tease" onClick={onGoUpgrade} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.18)",borderRadius:7}}>
                  <span style={{fontSize:11,color:C.amber,fontFamily:C.F}}>🔒 Agent voice memory requires Pro plan</span>
                  <Badge color={C.amber}>Upgrade →</Badge>
                </div>
              )}
            </div>

            {/* Photo uploader — listing type only */}
            {showPhotoUpload&&(
              <PhotoUploader photos={photos} setPhotos={setPhotos} maxPhotos={plan.maxPhotos} planKey={planKey} onGoUpgrade={onGoUpgrade}/>
            )}

            {/* Video key hint for listing */}
            {showPhotoUpload&&!hasVidKey&&(
              <div className="up-tease" onClick={onGoSettings} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",background:"rgba(34,211,238,.04)",border:"1px solid rgba(34,211,238,.13)",borderRadius:7,marginBottom:13}}>
                <span style={{fontSize:11,color:C.cyan,fontFamily:C.F}}>🎬 Add your Video Engine key in Settings to auto-generate listing videos</span>
                <Badge color={C.cyan}>Settings →</Badge>
              </div>
            )}
            {showPhotoUpload&&hasVidKey&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",background:"rgba(34,211,238,.05)",border:"1px solid rgba(34,211,238,.14)",borderRadius:7,marginBottom:13}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:C.cyan,boxShadow:`0 0 7px ${C.cyan}`}}/>
                <span style={{fontSize:11,color:C.cyan,fontFamily:C.F,fontWeight:600}}>Video engine connected — listing video will auto-render after generation</span>
              </div>
            )}

            {/* Inputs */}
            <div style={{display:"grid",gridTemplateColumns:type==="listing"?"1fr 1fr":"1fr",gap:11}}>
              {TYPE_INPUTS[type].map(k=>{
                const [lbl,ph]=INPUT_META[k]||[k,""];
                const wide=type==="listing"&&(k==="keyFeatures"||k==="address");
                return(
                  <div key={k} style={wide?{gridColumn:"1/-1"}:{}}>
                    <Field label={lbl.toUpperCase()} value={inputs[k]||""} onChange={e=>setInputs(p=>({...p,[k]:e.target.value}))} placeholder={ph} area={k==="keyFeatures"||k==="highlights"} rows={2}/>
                  </div>
                );
              })}
            </div>

            {/* Platform */}
            <div style={{marginTop:16}}>
              <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:9}}>PLATFORM</div>
              <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                {Object.entries(PLATFORMS).map(([k,p])=>{
                  const locked=!plan.platforms.includes(k);
                  const active=platform===k;
                  return(
                    <button key={k} className="plat-b" data-locked={locked} onClick={()=>locked?onGoUpgrade():setPlatform(k)}
                      style={{padding:"6px 13px",borderRadius:18,border:`1px solid ${active?p.color+"66":locked?"rgba(245,158,11,.22)":C.border}`,background:active?p.color+"12":locked?"rgba(245,158,11,.03)":"transparent",color:active?p.color:locked?C.amber:C.textDim,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:C.F,display:"flex",alignItems:"center",gap:4}}>
                      {k}{locked&&<span style={{fontSize:7,background:C.amber+"1e",color:C.amber,padding:"1px 4px",borderRadius:3,fontWeight:700}}>PRO+</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plan stats row */}
            <div style={{marginTop:14,padding:"7px 11px",background:"rgba(255,255,255,.02)",borderRadius:7,display:"flex",gap:16,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Hooks: <strong style={{color:C.text}}>{plan.hooks}</strong></span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Video: <strong style={{color:C.text}}>{plan.videoQuality}</strong></span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Photos: <strong style={{color:C.text}}>{plan.maxPhotos} max</strong></span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Credits: <strong style={{color:credits<5?C.rose:C.text}}>{credits} left</strong></span>
              {planKey!=="team"&&<span className="up-tease" onClick={onGoUpgrade} style={{fontSize:10,color:C.indigo,fontFamily:C.F,cursor:"pointer",marginLeft:"auto"}}>Upgrade for more ↗</span>}
            </div>
          </div>

          {/* Generate button */}
          {!gen?(
            <button className="btn-g" onClick={generate} disabled={!canGen}
              style={{width:"100%",background:canGen?"linear-gradient(135deg,#6366f1,#8b5cf6)":C.surface,border:canGen?"none":`1px solid ${C.border}`,color:canGen?"#fff":C.textDim,padding:"14px 0",borderRadius:10,cursor:canGen?"pointer":"not-allowed",fontFamily:C.F,fontWeight:700,fontSize:14,letterSpacing:.2,boxShadow:canGen?"0 4px 18px rgba(99,102,241,.24)":"none"}}>
              {credits<=0?"⚡ Buy Credits to Continue":credits<cost?`Need ${cost} Credits — Buy More`:`⚡ Generate ${CONTENT_TYPES[type].label} — ${cost} Credits`}
            </button>
          ):(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"26px 22px",textAlign:"center",animation:"fadeIn .2s ease"}}>
              <div style={{position:"relative",width:56,height:56,margin:"0 auto 14px"}}>
                <ProgressRing pct={pct}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.indigoLt,fontFamily:C.F,fontWeight:700}}>{pct}%</div>
              </div>
              <p style={{color:C.textMd,fontSize:13,fontFamily:C.F,margin:"0 0 11px"}}>{stage}</p>
              <div style={{display:"flex",justifyContent:"center",gap:5}}>
                {[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:C.indigoLt,animation:`pulse 1.2s ease ${i*.2}s infinite`}}/>)}
              </div>
            </div>
          )}

          {/* Results */}
          {result&&(
            <div style={{marginTop:26}}>
              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:14,animation:"fadeUp .28s ease",flexWrap:"wrap"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 7px ${C.emerald}`}}/>
                <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:700}}>PACKAGE READY</span>
                <Badge color={PLATFORMS[platform].color}>{platform}</Badge>
                <Badge color={CONTENT_TYPES[type].color}>{CONTENT_TYPES[type].label}</Badge>
                {vidState?.status==="generating"&&<Badge color={C.cyan}>🎬 VIDEO RENDERING…</Badge>}
                {vidState?.status==="ready"&&<Badge color={C.emerald}>🎬 VIDEO READY</Badge>}
              </div>

              {/* Tab bar */}
              <div style={{display:"flex",background:"rgba(255,255,255,.03)",borderRadius:9,padding:3,marginBottom:12,gap:2}}>
                {TABS.map(t=>{
                  const dot = t==="video"&&vidState?.status==="generating";
                  const done = t==="video"&&vidState?.status==="ready";
                  return(
                    <button key={t} className="tab-b" onClick={()=>setTab(t)} style={{flex:1,padding:"7px 4px",borderRadius:6,border:"none",background:tab===t?C.surfaceUp:"transparent",color:tab===t?C.text:C.textDim,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:C.F,letterSpacing:.8,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,.28)":"none",position:"relative"}}>
                      {t.toUpperCase()}
                      {dot&&<span style={{position:"absolute",top:4,right:4,width:5,height:5,borderRadius:"50%",background:C.cyan,animation:"pulse 1.2s ease infinite"}}/>}
                      {done&&<span style={{position:"absolute",top:4,right:4,width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 5px ${C.emerald}`}}/>}
                    </button>
                  );
                })}
              </div>

              {tab==="script"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.indigo} label="HEADLINE HOOK" action={<CopyBtn text={result.headline||""} label="Hook copied"/>} delay={0}>
                    <p style={{fontFamily:C.F,fontSize:16,fontWeight:700,color:C.text,margin:0,lineHeight:1.5}}>"{result.headline}"</p>
                  </RBlock>
                  <RBlock accent={C.indigoLt} label="FULL SCRIPT" action={<CopyBtn text={result.script||""} label="Script copied"/>} delay={.05}>
                    <pre style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,whiteSpace:"pre-wrap",lineHeight:1.9}}>{result.script}</pre>
                  </RBlock>
                  {result.posting_tip&&(
                    <div style={{background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.15)",borderRadius:8,padding:"10px 13px"}}>
                      <span style={{fontSize:9,color:C.indigo,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>POSTING TIP — </span>
                      <span style={{fontSize:12,color:C.textMd,fontFamily:C.F}}>{result.posting_tip}</span>
                    </div>
                  )}
                </div>
              )}

              {tab==="hooks"&&(
                <RBlock accent={C.violet} label={`HOOK VARIANTS (${(result.hooks||[]).length})`}
                  action={<CopyBtn text={(result.hooks||[]).join("\n\n")} label="All hooks copied"/>}>
                  {(result.hooks||[]).map((h,i)=>(
                    <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"11px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .22s ease ${i*.04}s both`}}>
                      <div style={{flex:1}}>
                        <div style={{fontSize:9,color:C.violet,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:4}}>H{String(i+1).padStart(2,"0")}</div>
                        <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,lineHeight:1.5}}>"{h}"</p>
                      </div>
                      <div style={{marginLeft:11,flexShrink:0}}><CopyBtn text={h} label={`Hook ${i+1} copied`}/></div>
                    </div>
                  ))}
                </RBlock>
              )}

              {tab==="caption"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.emerald} label="MLS-SAFE CAPTION + CTA"
                    action={<CopyBtn text={`${result.caption||""}\n\n${result.cta||""}\n\n${(result.hashtags||[]).join(" ")}`} label="Full caption copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:"0 0 12px",lineHeight:1.7}}>{result.caption}</p>
                    <div style={{background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7,padding:"7px 11px",marginBottom:12}}>
                      <span style={{fontSize:9,color:C.emerald,fontWeight:700,letterSpacing:2,fontFamily:C.F}}>CTA — </span>
                      <span style={{fontSize:13,color:C.textMd,fontFamily:C.F}}>{result.cta}</span>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {(result.hashtags||[]).map((h,i)=>(
                        <span key={i} style={{background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,color:C.textMd,padding:"3px 9px",borderRadius:12,fontSize:11,fontFamily:C.F}}>
                          {h.startsWith("#")?h:"#"+h}
                        </span>
                      ))}
                    </div>
                  </RBlock>
                </div>
              )}

              {tab==="video"&&(
                <RBlock accent={C.cyan} label={`LISTING VIDEO · ${plan.videoQuality}`}>
                  <VideoResultPanel
                    vidState={vidState}
                    higgsfieldPrompt={result.higgsfield_prompt}
                    videoQuality={plan.videoQuality}
                    hasHiggsfieldKey={hasVidKey}
                    onGoSettings={onGoSettings}
                  />
                  {result.thumbnail&&(
                    <div style={{marginTop:14,background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:13}}>
                      <div style={{fontSize:9,color:C.cyan,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:5}}>THUMBNAIL CONCEPT</div>
                      <p style={{fontSize:12,color:C.textMd,margin:0,fontFamily:C.F,lineHeight:1.6}}>{result.thumbnail}</p>
                    </div>
                  )}
                </RBlock>
              )}

              {tab==="shots"&&(
                <RBlock accent={C.amber} label="SHOT LIST / SCENE GUIDE">
                  {(result.shot_list||[]).map((s,i)=>(
                    <div key={i} style={{display:"flex",gap:11,padding:"10px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .2s ease ${i*.04}s both`}}>
                      <div style={{minWidth:27,height:27,borderRadius:"50%",background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.amber,fontFamily:C.F,fontWeight:700,flexShrink:0}}>{i+1}</div>
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5,alignSelf:"center"}}>{s}</p>
                    </div>
                  ))}
                </RBlock>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT VOICE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function VoicePanel({planKey,voice,setVoice,onSave,onGoUpgrade}){
  const toast=useToast();
  if(!PLANS[planKey].voiceMemory) return <UpgradePrompt feature="Agent Voice Memory" requiredPlan="pro" onUpgrade={onGoUpgrade}/>;
  const fields=[
    {k:"name",l:"YOUR NAME",p:"Sarah Johnson"},
    {k:"brokerage",l:"BROKERAGE",p:"Keller Williams Realty"},
    {k:"market",l:"PRIMARY MARKET",p:"Miami, FL"},
    {k:"specialty",l:"SPECIALTY",p:"Luxury waterfront, first-time buyers"},
    {k:"tone",l:"CONTENT TONE",p:"Warm and knowledgeable — like a trusted friend"},
    {k:"targetClient",l:"TARGET CLIENT",p:"Families relocating from NYC, $600K–$1.2M"},
    {k:"cta",l:"PREFERRED CTA",p:"DM me HOME for a free market analysis"},
  ];
  function save(){
    if(!voice.name||!voice.market){toast("Add your name and market first","error");return;}
    const saved={...voice,saved:true}; setVoice(saved); LS.set("sp_voice",saved);
    toast("Agent voice saved — all scripts will now sound like you ✓"); onSave();
  }
  return(
    <div style={{animation:"fadeUp .38s ease"}}>
      <p style={{fontSize:13,color:C.textMd,lineHeight:1.7,marginBottom:22,fontFamily:C.F}}>Set your profile once. Every script, hook, and caption will sound exactly like you — not generic AI copy.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:13}}>
        {fields.map((f,i)=>(
          <div key={f.k} style={{gridColumn:f.k==="tone"||f.k==="specialty"?"1/-1":"auto",animation:`fadeUp .28s ease ${i*.05}s both`}}>
            <Field label={f.l} value={voice[f.k]||""} onChange={e=>setVoice(v=>({...v,[f.k]:e.target.value}))} placeholder={f.p}/>
          </div>
        ))}
      </div>
      <button className="btn-g" onClick={save} style={{marginTop:22,width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:"pointer",fontFamily:C.F,fontWeight:700,fontSize:14,boxShadow:"0 4px 18px rgba(99,102,241,.24)"}}>
        Save Agent Voice ⚡
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN CAROUSEL
// ─────────────────────────────────────────────────────────────────────────────
function PlanCarousel({currentPlanKey,onSelect,onStart,mode}){
  const planEntries=Object.entries(PLANS);
  const POP_IDX=1;
  const [idx,setIdx]=useState(POP_IDX);
  const [dir,setDir]=useState(null);
  const [animKey,setAnimKey]=useState(0);

  function go(next){
    const c=Math.max(0,Math.min(planEntries.length-1,next));
    if(c===idx) return;
    setDir(c>idx?"r":"l"); setIdx(c); setAnimKey(k=>k+1);
  }
  const [k,p]=planEntries[idx];
  const prevOk=idx>0,nextOk=idx<planEntries.length-1;
  const isCur=mode==="billing"&&k===currentPlanKey;
  const isUp=mode==="billing"&&planRank(k)>planRank(currentPlanKey);
  const isDn=mode==="billing"&&planRank(k)<planRank(currentPlanKey);
  const slideAnim=dir==="r"?"carouselSlide .28s ease both":dir==="l"?"carouselSlideL .28s ease both":"scaleIn .28s ease both";

  return(
    <div style={{userSelect:"none"}}>
      <div style={{display:"flex",justifyContent:"center",gap:6,marginBottom:20}}>
        {planEntries.map(([pk,pp],i)=>{
          const active=i===idx, isCurTab=mode==="billing"&&pk===currentPlanKey;
          return(
            <button key={pk} onClick={()=>go(i)} style={{padding:"5px 14px",borderRadius:20,border:"none",background:active?`linear-gradient(135deg,${pp.accent},${pp.accent}bb)`:"rgba(255,255,255,.05)",color:active?"#fff":C.textDim,cursor:"pointer",fontSize:11,fontWeight:active?700:500,fontFamily:C.F,letterSpacing:.5,transition:"all .18s",boxShadow:active?`0 2px 12px ${pp.accent}44`:"none",position:"relative"}}>
              {pp.name}
              {isCurTab&&<span style={{position:"absolute",top:-4,right:-4,width:8,height:8,borderRadius:"50%",background:C.emerald,border:`2px solid ${C.bg}`,boxShadow:`0 0 6px ${C.emerald}`}}/>}
            </button>
          );
        })}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12}}>
        <button className="carousel-arrow" onClick={()=>go(idx-1)} disabled={!prevOk} style={{opacity:prevOk?1:.2,pointerEvents:prevOk?"auto":"none"}}>←</button>
        <div key={animKey} style={{flex:1,background:isCur?C.surfaceUp:C.surface,border:`1px solid ${isCur?p.accent+"55":p.badge?p.accent+"30":C.border}`,borderRadius:16,padding:"28px 24px",position:"relative",boxShadow:p.badge?`0 0 40px ${p.accent}18,0 8px 32px rgba(0,0,0,.3)`:isCur?`0 0 28px ${p.accent}14`:"0 4px 20px rgba(0,0,0,.2)",animation:slideAnim}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:18}}>
            <Badge color={p.accent}>{p.name.toUpperCase()}</Badge>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",justifyContent:"flex-end"}}>
              {p.badge&&<span style={{background:`linear-gradient(135deg,${C.indigo},${C.violet})`,color:"#fff",fontSize:8,fontWeight:800,padding:"3px 10px",borderRadius:8,letterSpacing:1,fontFamily:C.F}}>{p.badge}</span>}
              {isCur&&<span style={{background:p.accent,color:"#fff",fontSize:8,fontWeight:800,padding:"3px 10px",borderRadius:8,letterSpacing:1,fontFamily:C.F}}>CURRENT</span>}
            </div>
          </div>
          <div style={{fontFamily:C.F,fontWeight:800,fontSize:48,lineHeight:1,marginBottom:4}}>${p.price}<span style={{fontSize:14,color:C.textDim,fontWeight:400}}>/mo</span></div>
          <div style={{fontSize:12,color:C.textDim,marginBottom:22,fontFamily:C.F}}>{p.credits} credits · {p.videoQuality} video · {p.hooks} hooks · {p.maxPhotos} photos</div>
          <div style={{marginBottom:22}}>
            {p.perks.map((pk,j)=>(
              <div key={j} style={{fontSize:13,color:C.textMd,marginBottom:8,display:"flex",gap:8,fontFamily:C.F,alignItems:"flex-start"}}>
                <span style={{color:p.accent,flexShrink:0,marginTop:1}}>✓</span>{pk}
              </div>
            ))}
          </div>
          <div style={{background:p.accent+"0c",border:`1px solid ${p.accent}22`,borderRadius:8,padding:"10px 14px",marginBottom:18}}>
            <div style={{fontSize:9,color:p.accent,fontFamily:C.F,fontWeight:700,letterSpacing:1.5,marginBottom:5}}>PLATFORMS INCLUDED</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {p.platforms.map(pl=><span key={pl} style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.textMd,fontSize:10,padding:"2px 8px",borderRadius:10,fontFamily:C.F}}>{pl}</span>)}
            </div>
          </div>
          {mode==="landing"?(
            <button className="btn-g" onClick={()=>onStart("signup")} style={{width:"100%",background:`linear-gradient(135deg,${p.accent},${p.accent}bb)`,border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:`0 4px 18px ${p.accent}33`,letterSpacing:.3}}>
              Get Started with {p.name} ⚡
            </button>
          ):(
            <button className="btn-g" onClick={()=>onSelect(k)} disabled={isCur}
              style={{width:"100%",background:isCur?"transparent":isUp?`linear-gradient(135deg,${p.accent},${p.accent}bb)`:"rgba(255,255,255,.06)",border:`1px solid ${isCur?p.accent+"44":isUp?p.accent+"66":C.border}`,color:isCur?p.accent:isUp?"#fff":C.textMd,padding:"13px 0",borderRadius:10,cursor:isCur?"default":"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:isUp?`0 4px 18px ${p.accent}30`:"none"}}>
              {isCur?"Your Current Plan":isUp?`Upgrade to ${p.name} →`:isDn?`Switch to ${p.name} ↓`:"Select Plan"}
            </button>
          )}
        </div>
        <button className="carousel-arrow" onClick={()=>go(idx+1)} disabled={!nextOk} style={{opacity:nextOk?1:.2,pointerEvents:nextOk?"auto":"none"}}>→</button>
      </div>
      <div style={{display:"flex",justifyContent:"center",gap:7,marginTop:18}}>
        {planEntries.map(([pk,pp],i)=>(
          <div key={pk} className="carousel-dot" onClick={()=>go(i)} style={{width:i===idx?20:7,height:7,background:i===idx?planEntries[i][1].accent:"rgba(255,255,255,.15)",borderRadius:4}}/>
        ))}
      </div>
      <p style={{textAlign:"center",fontSize:10,color:C.textDim,fontFamily:C.F,marginTop:10,letterSpacing:.8}}>← click arrows or tabs to compare plans →</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING PANEL
// ─────────────────────────────────────────────────────────────────────────────
function BillingPanel({planKey,setPlanKey,credits,setCredits,userEmail}){
  const plan=PLANS[planKey];
  const toast=useToast();
  const [confirmKey,setConfirmKey]=useState(null);

  function doUpgrade(k){
    if(k===planKey) return;
    if(planRank(k)<planRank(planKey)){ setPlanKey(k); LS.set("sp_plan",k); const nc=PLANS[k].credits; setCredits(nc); LS.set("sp_credits",nc); toast(`Switched to ${PLANS[k].name} plan`,"info"); }
    else setConfirmKey(k);
  }
  function confirmUpgrade(){
    window.location.href = PLANS[confirmKey].stripeLink;
    setConfirmKey(null);
  }

  return(
    <div style={{animation:"fadeUp .38s ease"}}>
      {confirmKey&&(
        <div style={{position:"fixed",inset:0,background:"rgba(8,9,14,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}}>
          <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:30,maxWidth:400,width:"90%",boxShadow:"0 40px 80px rgba(0,0,0,.5)",animation:"scaleIn .24s ease"}}>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:8}}>Upgrade to {PLANS[confirmKey].name}?</div>
            <p style={{fontSize:13,color:C.textMd,marginBottom:20,fontFamily:C.F,lineHeight:1.6}}>Your plan becomes <strong style={{color:PLANS[confirmKey].accent}}>{PLANS[confirmKey].name}</strong> at ${PLANS[confirmKey].price}/month with {PLANS[confirmKey].maxPhotos} listing photos and {PLANS[confirmKey].videoQuality} video generation.</p>
            <div style={{background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",borderRadius:8,padding:"10px 13px",marginBottom:20,fontSize:12,color:C.emerald,fontFamily:C.F}}>You will be taken to secure Stripe checkout to complete your upgrade.</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-g" onClick={confirmUpgrade} style={{flex:1,background:`linear-gradient(135deg,${PLANS[confirmKey].accent},${C.violet})`,border:"none",color:"#fff",padding:"12px 0",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F}}>Confirm Upgrade</button>
              <button className="btn-o" onClick={()=>setConfirmKey(null)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"12px 18px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Credit overview */}
      <div style={{background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,border:`1px solid ${C.border}`,borderRadius:13,padding:22,marginBottom:26,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-25%",right:"-4%",width:200,height:200,borderRadius:"50%",background:`radial-gradient(circle,${plan.accent}14,transparent 70%)`,pointerEvents:"none"}}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:5}}>CURRENT PLAN</div>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:22,color:plan.accent}}>{plan.name}</div>
            <div style={{fontSize:12,color:C.textMd,marginTop:2,fontFamily:C.F}}>${plan.price}/mo · {plan.videoQuality} · {plan.maxPhotos} photos · {plan.hooks} hooks</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:38,color:credits<5?C.rose:C.text,lineHeight:1}}>{credits}</div>
            <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700}}>CREDITS LEFT</div>
          </div>
        </div>
        <div style={{height:4,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(100,(credits/plan.credits)*100)}%`,background:`linear-gradient(90deg,${plan.accent},${C.indigoLt})`,borderRadius:2,transition:"width .55s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
          <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>{credits} remaining</span>
          <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>{plan.credits} per month</span>
        </div>
      </div>

      <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:18}}>PLANS</div>
      <div style={{marginBottom:30}}><PlanCarousel currentPlanKey={planKey} onSelect={doUpgrade} mode="billing"/></div>

      {/* Credit packs */}
      <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:13}}>BUY EXTRA CREDITS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11}}>
        {CREDIT_PACKS.map((pk,i)=>(
          <button key={i} className="cp-b" onClick={()=>{ goStripe(pk.stripeLink, userEmail||""); }}
            style={{background:C.surface,border:`1px solid ${pk.hot?"rgba(99,102,241,.28)":C.border}`,borderRadius:10,padding:"16px 10px",textAlign:"center",cursor:"pointer",position:"relative",animation:`fadeUp .3s ease ${i*.06}s both`}}>
            {pk.hot&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,color:"#fff",fontSize:7,fontWeight:800,padding:"2px 8px",borderRadius:8,letterSpacing:.8,whiteSpace:"nowrap",fontFamily:C.F}}>BEST VALUE</div>}
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:26,color:C.indigo}}>{pk.credits}</div>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,fontFamily:C.F,marginBottom:6}}>CREDITS</div>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:18}}>${pk.price}</div>
            <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:2}}>${(pk.price/pk.credits).toFixed(2)}/cr</div>
            <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:3}}>{pk.label}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL — real user settings
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPanel({user,planKey,onLogout,apiKeys,setApiKeys}){
  const toast = useToast();
  const plan  = PLANS[planKey];
  const [showVidKey, setShowVidKey] = useState(false);
  const [vidKey, setVidKey]         = useState(apiKeys.higgsfield||"");
  const [showDeleteConfirm, setDeleteConfirm] = useState(false);

  function saveVidKey(){
    const updated = {...apiKeys, higgsfield:vidKey};
    setApiKeys(updated); LS.set("sp_keys",updated);
    toast("Video Engine key saved ✓");
  }

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* Account card */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:22,marginBottom:14}}>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:14}}>YOUR ACCOUNT</div>
        <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:18}}>
          <div style={{width:48,height:48,borderRadius:"50%",background:`linear-gradient(135deg,${plan.accent},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
            {(user?.email||"?")[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email||""}</div>
            <div style={{display:"flex",alignItems:"center",gap:7,marginTop:4}}>
              <span style={{background:plan.accent+"18",border:`1px solid ${plan.accent}40`,color:plan.accent,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,fontFamily:C.F,letterSpacing:1.5}}>{plan.name.toUpperCase()}</span>
              <span style={{fontSize:11,color:C.textDim,fontFamily:C.F}}>${plan.price}/mo</span>
            </div>
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:18}}>
          {[
            {label:"PLAN",    value:plan.name,            color:plan.accent},
            {label:"CREDITS", value:`${LS.get("sp_credits",plan.credits)} left`, color:C.indigoLt},
            {label:"VIDEO",   value:plan.videoQuality,    color:C.cyan},
          ].map((s,i)=>(
            <div key={i} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 10px",textAlign:"center"}}>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:16,color:s.color}}>{s.value}</div>
              <div style={{fontSize:8,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginTop:3}}>{s.label}</div>
            </div>
          ))}
        </div>
        <button className="signout-btn" onClick={doLogout} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"12px 0",borderRadius:9,cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:13}}>
          Sign Out
        </button>
      </div>

      {/* System status */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:22,marginBottom:14}}>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:14}}>SYSTEM STATUS</div>
        {[
          {label:"AI Content Engine", status:"Operational", color:C.emerald, note:"Scripts, hooks & captions"},
          {label:"Payment System",    status:"Operational", color:C.emerald, note:"Stripe — secure checkout"},
          {label:"Video Engine",      status:"Connected", color:C.emerald, note:"Auto-renders cinematic listing videos"},
        ].map((s,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"11px 0",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
            <div>
              <div style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text}}>{s.label}</div>
              <div style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginTop:2}}>{s.note}</div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:s.color,boxShadow:`0 0 6px ${s.color}`}}/>
              <span style={{fontSize:11,color:s.color,fontFamily:C.F,fontWeight:600}}>{s.status}</span>
            </div>
          </div>
        ))}
      </div>



      {/* Support */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:22,marginBottom:14}}>
        <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:14}}>SUPPORT</div>
        {[
          {icon:"📧",label:"Email Support",    sub:"Get help from the SPARK team", href:"mailto:support@getspark.app"},
          {icon:"💳",label:"Manage Billing",   sub:"Update payment method or cancel", href:"https://billing.stripe.com"},
          {icon:"📖",label:"How to Use SPARK", sub:"Tips, guides and best practices", href:"https://getspark.app/guide"},
        ].map((s,i)=>(
          <a key={i} href={s.href} target="_blank" rel="noreferrer" style={{textDecoration:"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",borderBottom:i<2?`1px solid ${C.border}`:"none",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.opacity=".7"}
              onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <div style={{width:36,height:36,borderRadius:9,background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{s.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:C.F,fontSize:13,fontWeight:600,color:C.text}}>{s.label}</div>
                <div style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginTop:1}}>{s.sub}</div>
              </div>
              <span style={{color:C.textDim,fontSize:14}}>›</span>
            </div>
          </a>
        ))}
      </div>

      {/* App info */}
      <div style={{textAlign:"center",padding:"8px 0 4px"}}>
        <div style={{fontFamily:C.F,fontSize:11,color:C.textDim}}>SPARK Real Estate AI · v1.0</div>
        <div style={{fontFamily:C.F,fontSize:10,color:C.textFaint,marginTop:3}}>© 2026 SPARK AI · <a href="https://getspark.app/privacy" target="_blank" rel="noreferrer" style={{color:C.textDim,textDecoration:"none"}}>Privacy</a> · <a href="https://getspark.app/terms" target="_blank" rel="noreferrer" style={{color:C.textDim,textDecoration:"none"}}>Terms</a></div>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AFFILIATE PANEL
// ─────────────────────────────────────────────────────────────────────────────
function AffiliatePanel({ user, planKey }){
  const toast = useToast();

  // Derive a stable referral code from the user's email
  const refCode = "SPARK-" + (user.email||"").split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
  const refLink = `https://getspark.app/?ref=${refCode}`;

  // Simulated affiliate stats — replace with real DB values once Supabase is wired
  const [stats] = useState({
    clicks:       LS.get("aff_clicks",   0),
    signups:      LS.get("aff_signups",  0),
    conversions:  LS.get("aff_converts", 0),
    activeRefs:   LS.get("aff_active",   0),
    pendingPayout:LS.get("aff_pending",  0.00),
    totalEarned:  LS.get("aff_total",    0.00),
    tier:         "standard",
  });

  const COMMISSION_TIERS = [
    {name:"Standard",  min:0,   max:9,   pct:20, color:C.emerald,  desc:"Your current tier"},
    {name:"Silver",    min:10,  max:24,  pct:25, color:C.sky,      desc:"10+ active referrals"},
    {name:"Gold",      min:25,  max:49,  pct:30, color:C.amber,    desc:"25+ active referrals"},
    {name:"Platinum",  min:50,  max:999, pct:35, color:C.violet,   desc:"50+ active referrals"},
  ];
  const currentTier = COMMISSION_TIERS.find(t=>stats.activeRefs>=t.min&&stats.activeRefs<=t.max)||COMMISSION_TIERS[0];
  const nextTier    = COMMISSION_TIERS[COMMISSION_TIERS.indexOf(currentTier)+1]||null;

  const SOCIAL_SCRIPTS = [
    {
      platform:"TikTok / Reels",
      icon:"🎬",
      hook:"I found a tool that writes my TikTok listing scripts in 47 seconds.",
      caption:`I have been using this AI tool to create all my listing content — scripts, hooks, captions, and auto-generated listing videos. Takes about 60 seconds per property. If you want to try it, I have a referral link that gets you started: ${refLink} #realestate #realtorlife #realestatetiktok #listingvideo`,
    },
    {
      platform:"Instagram Bio",
      icon:"📲",
      bio:`Real estate agent | AI-powered listing content 🏠⚡ | I use SPARK to create all my listing videos — try it: ${refLink}`,
    },
    {
      platform:"Facebook Group Post",
      icon:"👥",
      hook:"Fellow agents — I have been testing an AI content tool for the last few weeks.",
      caption:`It writes my full TikTok listing scripts, generates hooks and captions, and auto-renders a cinematic listing video from my property photos. The whole thing takes under 60 seconds. I know we all struggle with content — this actually works. Here is my referral link if you want to try it: ${refLink}`,
    },
    {
      platform:"Instagram DM",
      icon:"💬",
      caption:`Hey [name] — I know you are working on your social media content. I have been using a tool called SPARK that writes my listing scripts and auto-generates the video from my photos. First 3 generations are free. Here is my link: ${refLink}`,
    },
    {
      platform:"Email to Sphere",
      icon:"📧",
      caption:`Subject: The AI tool I have been using for listing content\n\nHey [name],\n\nQuick heads up — I have been using an AI tool called SPARK to create all my real estate content and it has been a game changer. It writes my TikTok scripts, generates hooks and captions, and even renders a cinematic listing video from my photos automatically.\n\nI thought of you because I know you have been trying to be more consistent with your social media. The first 3 generations are completely free. Here is my referral link:\n\n${refLink}\n\nLet me know if you try it — happy to walk you through how I use it.`,
    },
  ];

  const [activeScript, setActiveScript] = useState(0);
  const [payoutEmail, setPayoutEmail]   = useState("");
  const [payoutSent, setPayoutSent]     = useState(false);

  function copyLink(){
    navigator.clipboard.writeText(refLink).then(()=>toast("Referral link copied ✓")).catch(()=>toast("Copy failed","error"));
  }
  function copyScript(){
    const s = SOCIAL_SCRIPTS[activeScript];
    const text = [s.hook,s.caption||s.bio].filter(Boolean).join("\n\n");
    navigator.clipboard.writeText(text).then(()=>toast(`${s.platform} script copied ✓`)).catch(()=>toast("Copy failed","error"));
  }
  function requestPayout(){
    if(!payoutEmail){ toast("Enter your PayPal or Venmo email","error"); return; }
    setPayoutSent(true);
    toast("Payout request submitted ✓ — processed within 5 business days");
  }

  // Monthly passive income projection
  function project(refs){ return (refs * 49 * currentTier.pct/100).toFixed(0); }

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* Hero stats row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:22}}>
        {[
          {label:"TOTAL EARNED",   value:`$${stats.totalEarned.toFixed(2)}`,  color:C.emerald, icon:"💰"},
          {label:"PENDING PAYOUT", value:`$${stats.pendingPayout.toFixed(2)}`,color:C.amber,   icon:"⏳"},
          {label:"ACTIVE REFS",    value:stats.activeRefs,                    color:C.indigo,  icon:"👥"},
          {label:"CONVERSIONS",    value:stats.conversions,                   color:C.cyan,    icon:"✓"},
        ].map((s,i)=>(
          <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"16px 14px",animation:`fadeUp .3s ease ${i*.06}s both`}}>
            <div style={{fontSize:18,marginBottom:6}}>{s.icon}</div>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:22,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginTop:4}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral link card */}
      <div style={{background:`linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06))`,border:`1px solid rgba(99,102,241,.22)`,borderRadius:14,padding:22,marginBottom:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:16,marginBottom:4}}>Your Referral Link</div>
            <div style={{fontFamily:C.F,fontSize:12,color:C.textMd}}>Share this link. Every subscriber you refer earns you <strong style={{color:C.emerald}}>{currentTier.pct}% recurring commission</strong> every month they stay subscribed. No cap.</div>
          </div>
          <Badge color={currentTier.color}>{currentTier.name.toUpperCase()} · {currentTier.pct}%</Badge>
        </div>
        <div style={{display:"flex",gap:9,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,background:"rgba(0,0,0,.3)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",fontFamily:"monospace",fontSize:13,color:C.indigoLt,wordBreak:"break-all",minWidth:0}}>
            {refLink}
          </div>
          <button className="btn-g" onClick={copyLink}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"10px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:C.F,flexShrink:0}}>
            Copy Link
          </button>
        </div>
        <div style={{display:"flex",gap:16,marginTop:12,flexWrap:"wrap"}}>
          {[["Clicks","→",stats.clicks],["Signups","→",stats.signups],["Paid Subscribers","→",stats.conversions]].map(([l,,v],i)=>(
            <div key={i} style={{fontSize:11,color:C.textDim,fontFamily:C.F}}>
              {l}: <strong style={{color:C.text}}>{v}</strong>
            </div>
          ))}
          <div style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginLeft:"auto"}}>
            Monthly recurring: <strong style={{color:C.emerald}}>${(stats.activeRefs*49*currentTier.pct/100).toFixed(2)}</strong>
          </div>
        </div>
      </div>

      {/* Commission tier ladder */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:18}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,marginBottom:4}}>Commission Tiers</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:16,fontFamily:C.F,lineHeight:1.6}}>Your rate increases automatically as you grow your referral base. No applications, no approval needed.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
          {COMMISSION_TIERS.map((t,i)=>{
            const active = t.name===currentTier.name;
            const locked = stats.activeRefs < t.min;
            return(
              <div key={i} style={{borderRadius:10,padding:"14px 12px",border:`1px solid ${active?t.color+"55":locked?C.border:t.color+"22"}`,background:active?t.color+"0d":locked?"transparent":t.color+"05",position:"relative",opacity:locked?.5:1}}>
                {active&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:t.color,color:"#fff",fontSize:7,fontWeight:800,padding:"2px 8px",borderRadius:8,fontFamily:C.F,whiteSpace:"nowrap",letterSpacing:.8}}>YOUR TIER</div>}
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:22,color:active?t.color:locked?C.textDim:t.color,lineHeight:1}}>{t.pct}%</div>
                <div style={{fontSize:11,fontWeight:700,color:active?t.color:locked?C.textDim:C.textMd,fontFamily:C.F,margin:"4px 0 2px"}}>{t.name}</div>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,marginBottom:8}}>{t.desc}</div>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>
                  {t.min===0?"Start earning":""+t.min+"+ refs needed"}
                </div>
              </div>
            );
          })}
        </div>
        {nextTier&&(
          <div style={{marginTop:14,padding:"9px 13px",background:"rgba(99,102,241,.06)",border:`1px solid ${nextTier.color}44`,borderRadius:8,fontSize:12,color:C.textMd,fontFamily:C.F}}>
            <strong style={{color:nextTier.color}}>{nextTier.min - stats.activeRefs} more active referrals</strong> to unlock {nextTier.name} at {nextTier.pct}% commission — that is an extra <strong style={{color:C.text}}>${((nextTier.pct-currentTier.pct)/100*stats.activeRefs*49).toFixed(0)}/mo</strong> on your current base.
          </div>
        )}
      </div>

      {/* Income projector */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:18}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,marginBottom:4}}>Income Projector</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:16,fontFamily:C.F}}>Based on {currentTier.pct}% of the $49 Pro plan. Agent/Team plans earn proportionally.</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
          {[5,10,25,50,100].map(refs=>(
            <div key={refs} style={{textAlign:"center",background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:9,padding:"12px 8px"}}>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:19,color:C.indigoLt}}>{refs}</div>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:1.2,fontFamily:C.F,marginBottom:6}}>REFS</div>
              <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,color:C.emerald}}>${project(refs)}</div>
              <div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>/ month</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:12,padding:"9px 13px",background:"rgba(16,185,129,.05)",border:"1px solid rgba(16,185,129,.15)",borderRadius:8,fontSize:12,color:C.textMd,fontFamily:C.F}}>
          50 active referrals = <strong style={{color:C.emerald}}>${project(50)}/month passive income</strong> at your current tier. That's {Math.round(50/1500000*100*10000)/100}% of US real estate agents — entirely achievable from a single viral TikTok.
        </div>
      </div>

      {/* Ready-made social scripts */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:18}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,marginBottom:4}}>Ready-Made Scripts</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:16,fontFamily:C.F}}>Copy and post directly. Your referral link is already embedded.</p>
        <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}}>
          {SOCIAL_SCRIPTS.map((s,i)=>(
            <button key={i} onClick={()=>setActiveScript(i)}
              style={{padding:"5px 12px",borderRadius:18,border:`1px solid ${activeScript===i?"rgba(99,102,241,.5)":C.border}`,background:activeScript===i?"rgba(99,102,241,.1)":"transparent",color:activeScript===i?C.indigoLt:C.textDim,cursor:"pointer",fontSize:11,fontFamily:C.F,fontWeight:activeScript===i?700:400,transition:"all .14s",display:"flex",alignItems:"center",gap:5}}>
              <span>{s.icon}</span>{s.platform}
            </button>
          ))}
        </div>
        {SOCIAL_SCRIPTS[activeScript].hook&&(
          <div style={{background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.15)",borderRadius:7,padding:"8px 12px",marginBottom:10}}>
            <div style={{fontSize:9,color:C.indigo,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:4}}>HOOK</div>
            <p style={{fontFamily:C.F,fontSize:13,fontWeight:700,color:C.text,margin:0}}>"{SOCIAL_SCRIPTS[activeScript].hook}"</p>
          </div>
        )}
        <div style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:14,marginBottom:12}}>
          <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:8}}>{SOCIAL_SCRIPTS[activeScript].bio?"BIO TEXT":"CAPTION / MESSAGE"}</div>
          <pre style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,whiteSpace:"pre-wrap",lineHeight:1.75}}>
            {SOCIAL_SCRIPTS[activeScript].caption||SOCIAL_SCRIPTS[activeScript].bio}
          </pre>
        </div>
        <div style={{display:"flex",gap:9}}>
          <button className="btn-g" onClick={copyScript}
            style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"10px 22px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12,fontFamily:C.F}}>
            Copy {SOCIAL_SCRIPTS[activeScript].platform} Script
          </button>
          <button className="btn-o" onClick={copyLink}
            style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"10px 16px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:C.F}}>
            Copy Link Only
          </button>
        </div>
      </div>

      {/* How it works */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:18}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,marginBottom:16}}>How It Works</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[
            {n:"01",icon:"🔗",title:"Share Your Link",body:"Post your referral link on TikTok, Instagram, in Facebook groups, or DM it directly to agents in your network."},
            {n:"02",icon:"👤",title:"Agent Signs Up",body:"When they click your link and subscribe to any paid plan, they're tracked to your account automatically."},
            {n:"03",icon:"💰",title:"You Get Paid",body:"You earn 20% of their monthly subscription every single month they stay subscribed. Forever, with no cap."},
          ].map((s,i)=>(
            <div key={i} style={{padding:"16px 14px",background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,borderRadius:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <div style={{width:22,height:22,borderRadius:6,background:"rgba(99,102,241,.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:C.indigoLt,fontFamily:C.F,fontWeight:800}}>{s.n}</div>
                <span style={{fontSize:18}}>{s.icon}</span>
              </div>
              <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,marginBottom:6}}>{s.title}</div>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.6}}>{s.body}</p>
            </div>
          ))}
        </div>
        <div style={{marginTop:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[
            ["20%","recurring commission on every referral, every month"],
            ["No cap","unlimited referrals, unlimited income"],
            ["Monthly payouts","via PayPal or Venmo, minimum $25"],
            ["Real-time tracking","clicks, signups, conversions in your dashboard"],
          ].map(([bold,rest],i)=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",fontSize:12,fontFamily:C.F}}>
              <span style={{color:C.emerald,flexShrink:0,marginTop:1}}>✓</span>
              <span style={{color:C.textMd}}><strong style={{color:C.text}}>{bold}</strong> {rest}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payout request */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,marginBottom:4}}>Request Payout</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:16,fontFamily:C.F,lineHeight:1.6}}>
          Minimum payout is $25. Processed within 5 business days via PayPal or Venmo.
          {stats.pendingPayout>0?<strong style={{color:C.amber}}> You have ${stats.pendingPayout.toFixed(2)} available.</strong>:" Payouts accumulate until you request them."}
        </p>
        {payoutSent?(
          <div style={{padding:"14px 16px",background:"rgba(16,185,129,.07)",border:"1px solid rgba(16,185,129,.2)",borderRadius:9,fontSize:13,color:C.emerald,fontFamily:C.F,fontWeight:600}}>
            ✓ Payout request received — you will receive ${stats.pendingPayout.toFixed(2)} within 5 business days.
          </div>
        ):(
          <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            <input className="ifield" type="email" value={payoutEmail} onChange={e=>setPayoutEmail(e.target.value)} placeholder="your@paypal.com or @venmo"
              style={{flex:1,minWidth:220,background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:C.F}}/>
            <button className="btn-g" onClick={requestPayout} disabled={stats.pendingPayout<25}
              style={{background:stats.pendingPayout>=25?"linear-gradient(135deg,#6366f1,#8b5cf6)":C.surface,border:stats.pendingPayout>=25?"none":`1px solid ${C.border}`,color:stats.pendingPayout>=25?"#fff":C.textDim,padding:"10px 22px",borderRadius:8,cursor:stats.pendingPayout>=25?"pointer":"not-allowed",fontWeight:700,fontSize:12,fontFamily:C.F,flexShrink:0}}>
              {stats.pendingPayout>=25?`Request $${stats.pendingPayout.toFixed(2)} Payout`:"Min. $25 Required"}
            </button>
          </div>
        )}
        <p style={{fontSize:10,color:C.textDim,fontFamily:C.F,marginTop:10}}>
          Referral tracking via URL parameter. Once Supabase is connected, all stats update in real time. Payout requests are reviewed manually — reach us at <span style={{color:C.indigo}}>support@getspark.app</span>
        </p>
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function MainApp({user,onLogout}){
  const [tab,setTab]        =useState("generate");
  const [planKey,setPlanKey]=useState(()=>LS.get("sp_plan",user.plan||"pro"));
  const [credits,setCredits]=useState(()=>LS.get("sp_credits",user.credits||63));
  const [voice,setVoice]    =useState(()=>LS.get("sp_voice",{saved:false,name:"",brokerage:"",market:"",specialty:"",tone:"",targetClient:"",cta:""}));
  const [apiKeys,setApiKeys]=useState(()=>LS.get("sp_keys",{anthropic:"",higgsfield:""}));
  const [showOnboard,setOnboard] =useState(()=>LS.get("sp_onboarded",false)===false);
  const [isMobile,setIsMobile]   =useState(()=>window.innerWidth<768);
  const toast=useToast();
  const plan=PLANS[planKey];

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",check);
    return ()=>window.removeEventListener("resize",check);
  },[]);

  useEffect(()=>{
    if(!PLANS[planKey].voiceMemory&&voice.saved){ const v={...voice,saved:false}; setVoice(v); LS.set("sp_voice",v); }
  },[planKey]);

  // Refresh credits and plan from Supabase when user returns to the tab
  // (e.g. after completing Stripe checkout)
  useEffect(()=>{
    async function syncFromDB(){
      const sb = window.__supabase;
      if(!sb||!user?.email) return;
      try{
        const {data} = await sb
          .from("users")
          .select("plan,credits")
          .eq("email", user.email.toLowerCase())
          .single();
        if(data){
          setPlanKey(data.plan); LS.set("sp_plan",data.plan);
          setCredits(data.credits); LS.set("sp_credits",data.credits);
        }
      }catch{}
    }
    const onVisible = ()=>{ if(document.visibilityState==="visible") syncFromDB(); };
    document.addEventListener("visibilitychange", onVisible);
    syncFromDB(); // also sync on mount
    return ()=>document.removeEventListener("visibilitychange", onVisible);
  },[user?.email]);

  function handleOnboardClose(){ setOnboard(false); LS.set("sp_onboarded",true); }

  function doLogout(){
    // Save current state before logout
    const accts = LS.get("sp_accounts",{});
    const k = (user?.email||"").toLowerCase();
    if(accts[k]){ accts[k].credits=credits; accts[k].plan=planKey; LS.set("sp_accounts",accts); }
    LS.del("sp_onboarded");
    setUser(null);
    setScreen("landing");
  }
  function handleGoUpgrade(){ setTab("billing"); toast("Choose your plan below","info"); }
  function handleGoSettings(){ setTab("settings"); }

  const NAV=[
    {id:"generate",  icon:"⚡",label:"Generate"},
    {id:"voice",     icon:"◎", label:"Voice"},
    {id:"billing",   icon:"◈", label:"Billing"},
    {id:"affiliate", icon:"🔗",label:"Affiliate"},
    {id:"settings",  icon:"⚙", label:"Settings"},
  ];

  const TITLES={
    generate:<>Generate <Shimmer>Content</Shimmer></>,
    voice:   <>Agent <Shimmer>Voice</Shimmer></>,
    billing: <>Billing & <Shimmer>Credits</Shimmer></>,
    affiliate:<>Affiliate <Shimmer>Program</Shimmer></>,
    settings:<Shimmer>Settings</Shimmer>,
  };
  const SUBTITLES={
    generate:  voice.saved&&plan.voiceMemory?`✓ ${voice.name||""} · ${voice.market||""}`:`${plan.name} · ${plan.contentTypes.length} types · ${plan.maxPhotos} photos`,
    voice:     plan.voiceMemory?"Saved once · every script sounds like you":"Requires Pro plan",
    billing:   `${plan.name} · $${plan.price}/mo · ${credits} credits`,
    affiliate: "20% recurring commission · no cap",
    settings:  "Account · Plan · Support",
  };

  // ── MOBILE BOTTOM NAV BAR ──────────────────────────────────────────────────
  const MobileNav = ()=>(
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,
      background:"rgba(13,15,23,.97)",
      borderTop:`1px solid ${C.border}`,
      backdropFilter:"blur(20px)",
      display:"flex",alignItems:"stretch",
      zIndex:200,
      paddingBottom:"env(safe-area-inset-bottom)",
    }}>
      {NAV.map(item=>{
        const active=tab===item.id;
        return(
          <button key={item.id} onClick={()=>setTab(item.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0",background:"transparent",border:"none",cursor:"pointer",position:"relative",minHeight:56}}>
            <span style={{fontSize:18,lineHeight:1,filter:active?"none":"grayscale(1) opacity(0.5)"}}>{item.icon}</span>
            <span style={{fontSize:9,fontFamily:C.F,fontWeight:active?700:500,color:active?C.indigoLt:C.textDim,letterSpacing:.4}}>{item.label}</span>
            {active&&<div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:28,height:2,borderRadius:1,background:`linear-gradient(90deg,${C.indigo},${C.violet})`}}/>}
            {item.id==="billing"&&credits<5&&<div style={{position:"absolute",top:6,right:"calc(50% - 16px)",width:6,height:6,borderRadius:"50%",background:C.rose,boxShadow:`0 0 5px ${C.rose}`}}/>}
            {item.id==="affiliate"&&<div style={{position:"absolute",top:6,right:"calc(50% - 16px)",width:6,height:6,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 5px ${C.emerald}`}}/>}
          </button>
        );
      })}
    </div>
  );

  // ── MOBILE HEADER ──────────────────────────────────────────────────────────
  const MobileHeader = ()=>(
    <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(5,5,7,.94)",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(20px)",padding:"10px 16px",paddingTop:"calc(10px + env(safe-area-inset-top))"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo small/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(255,255,255,.04)",border:`1px solid ${C.border}`,borderRadius:8,padding:"5px 10px"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:plan.accent,boxShadow:`0 0 5px ${plan.accent}`}}/>
            <span style={{fontSize:12,color:C.text,fontFamily:C.F,fontWeight:700}}>{credits}</span>
            <span style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>CR</span>
          </div>
          <button className="signout-btn" onClick={doLogout} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,cursor:"pointer",fontSize:11,fontFamily:C.F,fontWeight:500,padding:"5px 10px",borderRadius:7}}>Out</button>
        </div>
      </div>
    </div>
  );

  // ── CONTENT ────────────────────────────────────────────────────────────────
  const Content = ()=>(
    <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",
      padding:isMobile?"16px 14px 90px":"32px 36px",
      position:"relative",zIndex:1}}>
      <div style={{maxWidth:isMobile?"100%":840,margin:"0 auto"}}>
        <div style={{marginBottom:isMobile?16:26}}>
          <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:isMobile?22:26,margin:"0 0 4px",lineHeight:1.2}}>{TITLES[tab]}</h1>
          <p style={{fontSize:isMobile?11:10,color:C.textDim,margin:0,letterSpacing:.5,fontFamily:C.F,fontWeight:500}}>{SUBTITLES[tab]}</p>
        </div>

        {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings}/>}

        {tab==="voice"&&(
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:isMobile?16:26}}>
            {voice.saved&&plan.voiceMemory&&(
              <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7,marginBottom:18}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 6px ${C.emerald}`,flexShrink:0}}/>
                <span style={{fontSize:11,color:C.emerald,fontWeight:600,fontFamily:C.F}}>Agent voice active — update and save to refresh</span>
              </div>
            )}
            <VoicePanel planKey={planKey} voice={voice} setVoice={setVoice} onSave={()=>setTab("generate")} onGoUpgrade={handleGoUpgrade}/>
          </div>
        )}

        {tab==="billing"&&<BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email}/>}
        {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
        {tab==="settings"&&<SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/>}
      </div>
    </div>
  );

  // ── DESKTOP SIDEBAR ────────────────────────────────────────────────────────
  const DesktopSidebar = ()=>(
    <div style={{width:220,background:"rgba(13,15,23,.9)",borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,backdropFilter:"blur(20px)",position:"relative",zIndex:10}}>
      <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}><Logo small/></div>
      <div style={{flex:1,padding:"11px 9px"}}>
        {NAV.map((item,i)=>(
          <button key={item.id} className={`nav-item${tab===item.id?" active":""}`} onClick={()=>setTab(item.id)}
            style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,marginBottom:2,background:"transparent",border:"1px solid transparent",color:C.textDim,cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left"}}>
            <span style={{fontSize:13,width:17,textAlign:"center"}}>{item.icon}</span>
            {item.label}
            {item.id==="voice"&&plan.voiceMemory&&voice.saved&&<span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 6px ${C.emerald}`,flexShrink:0}}/>}
            {item.id==="voice"&&!plan.voiceMemory&&<span style={{marginLeft:"auto",fontSize:7,color:C.amber,fontFamily:C.F,fontWeight:700}}>PRO</span>}
            {item.id==="billing"&&credits<5&&<span style={{marginLeft:"auto",fontSize:7,color:C.rose,fontFamily:C.F,fontWeight:700}}>LOW</span>}
            {item.id==="affiliate"&&<span style={{marginLeft:"auto",fontSize:7,color:C.emerald,fontFamily:C.F,fontWeight:700}}>EARN</span>}
          </button>
        ))}
      </div>
      <div style={{padding:"13px 15px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
          <span style={{fontSize:8,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700}}>CREDITS</span>
          <span style={{fontSize:9,color:credits<5?C.rose:plan.accent,fontWeight:700}}>{credits} / {plan.credits}</span>
        </div>
        <div style={{height:3,background:"rgba(255,255,255,.04)",borderRadius:2,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.min(100,(credits/plan.credits)*100)}%`,background:`linear-gradient(90deg,${credits<5?C.rose:plan.accent},${C.indigoLt})`,borderRadius:2,transition:"width .5s ease"}}/>
        </div>
        <button className="btn-o" onClick={()=>setTab("billing")} style={{width:"100%",marginTop:7,background:"rgba(255,255,255,.025)",border:`1px solid ${C.border}`,color:C.textDim,borderRadius:6,padding:"5px 0",fontSize:8,cursor:"pointer",fontFamily:C.F,fontWeight:700,letterSpacing:2}}>+ BUY CREDITS</button>
      </div>
      <div style={{padding:"14px 12px",borderTop:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:9}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${plan.accent},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#fff",flexShrink:0}}>
              {(user?.email||"?")[0].toUpperCase()}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:10,color:C.text,fontFamily:C.F,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user?.email||""}</div>
              <div style={{marginTop:2}}><Badge color={plan.accent}>{plan.name.toUpperCase()}</Badge></div>
            </div>
          </div>
          <button className="signout-btn" onClick={doLogout} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,cursor:"pointer",fontSize:11,fontFamily:C.F,fontWeight:500,padding:"7px 0",borderRadius:7}}>Sign out</button>
        </div>
      </div>
    );

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",background:C.bg,color:C.text,fontFamily:C.F,overflow:"hidden"}}>
      <OrbBg/>
      <ToastContainer/>
      {showOnboard&&<OnboardingModal planKey={planKey} onClose={handleOnboardClose}/>}

      {isMobile?(
        // ── MOBILE LAYOUT ──
        <div style={{display:"flex",flexDirection:"column",height:"100%",overflow:"hidden"}}>
          <MobileHeader/>
          <div style={{flex:1,overflowY:"auto",WebkitOverflowScrolling:"touch",
            padding:"16px 14px 90px",position:"relative",zIndex:1}}>
            <div style={{maxWidth:"100%"}}>
              <div style={{marginBottom:16}}>
                <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:22,margin:"0 0 4px",lineHeight:1.2}}>{TITLES[tab]}</h1>
                <p style={{fontSize:11,color:C.textDim,margin:0,letterSpacing:.5,fontFamily:C.F}}>{SUBTITLES[tab]}</p>
              </div>

              {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings}/>}
              {tab==="voice"&&(
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:16}}>
                  {voice.saved&&plan.voiceMemory&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7,marginBottom:16}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:C.emerald,flexShrink:0}}/>
                      <span style={{fontSize:11,color:C.emerald,fontWeight:600,fontFamily:C.F}}>Agent voice active</span>
                    </div>
                  )}
                  <VoicePanel planKey={planKey} voice={voice} setVoice={setVoice} onSave={()=>setTab("generate")} onGoUpgrade={handleGoUpgrade}/>
                </div>
              )}
              {tab==="billing"&&<BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email}/>}
              {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
              {tab==="settings"&&<SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/>}
            </div>
          </div>
          <MobileNav/>
        </div>
      ):(
        // ── DESKTOP LAYOUT ──
        <div style={{display:"flex",flex:1,overflow:"hidden"}}>
          <DesktopSidebar/>
          <div style={{flex:1,overflowY:"auto",padding:"32px 36px",position:"relative",zIndex:1}}>
            <div style={{maxWidth:840,margin:"0 auto"}}>
              <div style={{marginBottom:26}}>
                <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:26,margin:"0 0 5px",lineHeight:1.2}}>{TITLES[tab]}</h1>
                <p style={{fontSize:10,color:C.textDim,margin:0,letterSpacing:1.2,fontFamily:C.F,fontWeight:600}}>{SUBTITLES[tab]}</p>
              </div>
              {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings}/>}
              {tab==="voice"&&(
                <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:26}}>
                  {voice.saved&&plan.voiceMemory&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7,marginBottom:18}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 6px ${C.emerald}`}}/>
                      <span style={{fontSize:11,color:C.emerald,fontWeight:600,fontFamily:C.F}}>Agent voice active — update any field and save to refresh</span>
                    </div>
                  )}
                  <VoicePanel planKey={planKey} voice={voice} setVoice={setVoice} onSave={()=>setTab("generate")} onGoUpgrade={handleGoUpgrade}/>
                </div>
              )}
              {tab==="billing"&&<BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email}/>}
              {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
              {tab==="settings"&&<SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({onStart}){
  const [ready,setReady]=useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setReady(true),60); return ()=>clearTimeout(t); },[]);

  const FEATURES=[
    ["Content types","Listing + Tips","All 4","All 4"],
    ["Listing photos","3 photos","8 photos","20 photos"],
    ["Auto video generation","720p","1080p","4K"],
    ["Platforms","TikTok + Reels","All 5","All 5"],
    ["Hook variants","3","7","10"],
    ["Agent voice memory","—","✓","✓"],
    ["Video quality","720p","1080p","4K"],
    ["Credits / month","20","60","180"],
  ];

  const anim = (delay=0) => ready?`fadeUp .5s ease ${delay}s both`:"none";

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.F,overflowX:"hidden"}}>
      <OrbBg/>
      <div style={{position:"relative",zIndex:1}}>

        {/* Nav */}
        <nav style={{padding:"0 24px",height:60,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(20px)",background:"rgba(5,5,7,.7)",position:"sticky",top:0,zIndex:100}}>
          <Logo/>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button className="btn-o" onClick={()=>onStart("login")} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"7px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:C.F}}>Sign in</button>
            <button className="btn-g" onClick={()=>onStart("signup")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"7px 18px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:C.F,boxShadow:"0 0 0 1px rgba(99,102,241,.4), 0 4px 16px rgba(99,102,241,.2)"}}>Start free</button>
          </div>
        </nav>

        {/* Hero */}
        <div style={{padding:"80px 24px 64px",maxWidth:760,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.15)",borderRadius:20,padding:"5px 14px",fontSize:10,color:C.indigoLt,letterSpacing:2,fontWeight:600,marginBottom:28,animation:anim()}}>
            ⚡ AI-POWERED REAL ESTATE CONTENT
          </div>

          <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(32px,6vw,60px)",lineHeight:1.08,margin:"0 0 20px",letterSpacing:"-0.02em",animation:anim(.08)}}>
            <Shimmer>Upload photos.</Shimmer><br/>
            <span style={{color:C.text}}>Get a viral listing video.</span>
          </h1>

          <p style={{fontSize:17,color:C.textMd,maxWidth:480,margin:"0 auto 36px",lineHeight:1.65,fontWeight:400,animation:anim(.16)}}>
            SPARK writes your TikTok script, hooks, captions — and auto-renders a cinematic listing video from your photos. Everything in 60 seconds.
          </p>

          <div style={{display:"flex",gap:10,justifyContent:"center",flexWrap:"wrap",marginBottom:16,animation:anim(.22)}}>
            <button className="btn-g" onClick={()=>onStart("signup")}
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"14px 28px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:15,fontFamily:C.F,boxShadow:"0 0 0 1px rgba(99,102,241,.4),0 8px 28px rgba(99,102,241,.24)"}}>
              Start free — 3 credits ⚡
            </button>
            <button className="btn-o" onClick={()=>onStart("login")}
              style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,color:C.textMd,padding:"14px 24px",borderRadius:10,cursor:"pointer",fontWeight:500,fontSize:15,fontFamily:C.F}}>
              Sign in
            </button>
          </div>
          <p style={{fontSize:11,color:C.textDim,fontFamily:C.F,letterSpacing:1,animation:anim(.3)}}>No credit card · cancel anytime</p>
        </div>

        {/* 3-step flow */}
        <div style={{padding:"0 24px 72px",maxWidth:700,margin:"0 auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:1,background:C.border,borderRadius:16,overflow:"hidden",border:`1px solid ${C.border}`}}>
            {[
              {n:"01",icon:"📸",title:"Upload photos",body:"Drop your listing photos. First one becomes the hero frame."},
              {n:"02",icon:"⚡",title:"AI generates everything",body:"Full script, hooks, MLS captions, hashtags — optimised for your platform."},
              {n:"03",icon:"🎬",title:"Download your video",body:"Cinematic listing video rendered automatically. Post in one tap."},
            ].map((s,i)=>(
              <div key={i} style={{background:C.surface,padding:"24px 18px",animation:anim(.1+i*.08)}}>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:2,marginBottom:12}}>{s.n}</div>
                <div style={{fontSize:22,marginBottom:10}}>{s.icon}</div>
                <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,marginBottom:6}}>{s.title}</div>
                <div style={{fontFamily:C.F,fontSize:12,color:C.textDim,lineHeight:1.55}}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"28px 24px",background:"rgba(255,255,255,.012)"}}>
          <div style={{maxWidth:600,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,textAlign:"center"}}>
            {[["60s","listing to video"],["7×","more listing inquiries"],["$49","pro plan / mo"],["3","free credits to start"]].map(([n,l],i)=>(
              <div key={i} style={{animation:`fadeUp .4s ease ${i*.06}s both`}}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:22,color:C.text,letterSpacing:"-0.02em"}}>{n}</div>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,marginTop:4,lineHeight:1.4}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature comparison */}
        <div style={{padding:"72px 24px 0",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.indigo,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>COMPARE PLANS</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,34px)",lineHeight:1.15,letterSpacing:"-0.02em"}}>
              Everything unlocked by plan.
            </h2>
          </div>
          <div style={{border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",marginBottom:72}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",background:C.surfaceHigh,borderBottom:`1px solid ${C.border}`,padding:"12px 20px"}}>
              {["","Agent","Pro","Team"].map((h,i)=>(
                <div key={i} style={{fontSize:i===0?0:11,fontWeight:700,color:i===0?"transparent":Object.values(PLANS)[i-1]?.accent,fontFamily:C.F,letterSpacing:.5,textAlign:i===0?"left":"center"}}>{h}</div>
              ))}
            </div>
            {FEATURES.map(([feat,...vals],i)=>(
              <div key={i} className="feature-row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"11px 20px",borderBottom:i<FEATURES.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{fontSize:13,color:C.textMd,fontFamily:C.F}}>{feat}</div>
                {vals.map((v,j)=>(
                  <div key={j} style={{fontSize:12,textAlign:"center",color:v==="—"?C.textDim:v==="✓"?C.emerald:C.text,fontFamily:C.F,fontWeight:v==="✓"||v==="—"?600:400}}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{padding:"0 24px 96px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.indigo,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>PRICING</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,34px)",lineHeight:1.15,letterSpacing:"-0.02em"}}>
              Simple pricing. No surprises.
            </h2>
          </div>
          <div style={{maxWidth:540,margin:"0 auto"}}>
            <PlanCarousel mode="landing" onStart={onStart}/>
          </div>
        </div>

        {/* Footer */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"28px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <Logo small/>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            {[["Privacy","https://getspark.app/privacy"],["Terms","https://getspark.app/terms"],["Support","mailto:support@getspark.app"]].map(([l,h])=>(
              <a key={l} href={h} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.textDim,fontFamily:C.F,textDecoration:"none"}}>{l}</a>
            ))}
          </div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:C.F}}>© 2026 SPARK AI</div>
        </div>

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AuthPage({mode,onAuth,onSwitch}){
  const [email,setEmail]   =useState("");
  const [pass,setPass]     =useState("");
  const [plan,setPlan]     =useState("pro");
  const [loading,setLoading]=useState(false);
  const [mounted,setMounted]=useState(false);
  const toast=useToast();

  useEffect(()=>{ setMounted(true); },[]);

  function submit(){
    if(!email||email.indexOf("@")<0){ toast("Enter a valid email address","error"); return; }
    if(!pass||pass.length<6){ toast("Password must be at least 6 characters","error"); return; }
    setLoading(true);

    const sb = window.__supabase;
    if(sb){
      (async()=>{
        try{
          if(mode==="signup"){
            // Sign up with Supabase Auth
            const {data,error} = await sb.auth.signUp({ email, password:pass });
            if(error) throw new Error(error.message);

            const startCredits = PLANS[plan].credits + 3;

            // Insert into users table using email as the key
            // (id is auto-generated by gen_random_uuid in our table)
            const {error:dbError} = await sb.from("users").insert({
              email: email.toLowerCase(),
              plan,
              credits: startCredits,
            });
            // Ignore duplicate error — row may already exist
            if(dbError && !dbError.message.includes("duplicate")) {
              console.warn("DB insert warning:", dbError.message);
            }

            // Save to localStorage as backup
            const accounts = LS.get("sp_accounts",{});
            accounts[email.toLowerCase()] = { plan, credits:startCredits, pass };
            LS.set("sp_accounts", accounts);

            onAuth({ email, plan, credits:startCredits });

          } else {
            // Sign in with Supabase Auth
            const {data,error} = await sb.auth.signInWithPassword({ email, password:pass });
            if(error) throw new Error(error.message);

            // Look up plan and credits by email
            const {data:userData} = await sb
              .from("users")
              .select("plan,credits")
              .eq("email", email.toLowerCase())
              .single();

            // Update localStorage backup too
            if(userData){
              const accounts = LS.get("sp_accounts",{});
              accounts[email.toLowerCase()] = {
                plan: userData.plan,
                credits: userData.credits,
                pass
              };
              LS.set("sp_accounts", accounts);
            }

            onAuth({
              email,
              plan: userData?.plan || "pro",
              credits: userData?.credits || 60,
            });
          }
        }catch(e){
          toast(e.message||"Something went wrong — try again","error");
          setLoading(false);
        }
      })();
      return;
    }

    // localStorage auth — fallback when Supabase not connected
    setTimeout(()=>{
      try{
        const accounts = LS.get("sp_accounts", {});
        const key = email.toLowerCase();
        if(mode==="signup"){
          if(accounts[key]){ toast("An account with this email already exists — sign in instead","error"); setLoading(false); return; }
          const startCredits = PLANS[plan].credits + 3;
          accounts[key] = { plan, credits:startCredits, pass };
          LS.set("sp_accounts", accounts);
          onAuth({ email, plan, credits:startCredits });
        } else {
          const account = accounts[key];
          if(!account){ toast("No account found — tap Start Free to create one","error"); setLoading(false); return; }
          if(account.pass !== pass){ toast("Incorrect password — try again","error"); setLoading(false); return; }
          onAuth({ email, plan:account.plan, credits:account.credits });
        }
      }catch(e){
        toast("Something went wrong — try again","error");
        setLoading(false);
      }
    },400);
  }

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.F}}>
      <OrbBg/>
      <ToastContainer/>
      <div style={{width:"100%",maxWidth:400,padding:"20px",position:"relative",zIndex:1,opacity:mounted?1:0,transition:"opacity .35s ease"}}>
        <div style={{textAlign:"center",marginBottom:32}}>
          <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo/></div>
          <p style={{color:C.textMd,fontSize:14,margin:0,fontFamily:C.F,fontWeight:400}}>{mode==="login"?"Welcome back":"Start generating viral listing content"}</p>
        </div>

        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px 24px",boxShadow:"0 40px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)"}}>

          <div style={{marginBottom:14}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.26)",letterSpacing:1.5,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,marginBottom:6}}>EMAIL</div>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="sarah@kw.com" autoComplete="email"
              style={{width:"100%",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"10px 13px",color:"rgba(255,255,255,.92)",fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",boxSizing:"border-box"}}
              onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.48)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.06)"}
            />
          </div>

          <div style={{marginBottom:mode==="signup"?14:22}}>
            <div style={{fontSize:10,color:"rgba(255,255,255,.26)",letterSpacing:1.5,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,marginBottom:6}}>PASSWORD</div>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
              placeholder="min 6 characters" autoComplete={mode==="login"?"current-password":"new-password"}
              style={{width:"100%",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"10px 13px",color:"rgba(255,255,255,.92)",fontSize:13,fontFamily:"'Plus Jakarta Sans',sans-serif",outline:"none",boxSizing:"border-box"}}
              onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.48)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.06)"}
            />
          </div>

          {mode==="signup"&&(
            <div style={{marginBottom:18}}>
              <div style={{fontSize:9,color:"rgba(255,255,255,.26)",letterSpacing:1.5,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:700,marginBottom:7}}>SELECT PLAN</div>
              <div style={{display:"flex",gap:7}}>
                {Object.entries(PLANS).map(([k,p])=>(
                  <button key={k} onClick={()=>setPlan(k)}
                    style={{flex:1,padding:"10px 4px",borderRadius:8,border:`1px solid ${plan===k?p.accent+"60":"rgba(255,255,255,.06)"}`,background:plan===k?p.accent+"14":"transparent",color:plan===k?p.accent:"rgba(255,255,255,.26)",cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:"'Plus Jakarta Sans',sans-serif",letterSpacing:.8,transition:"all .14s"}}>
                    {p.name}<br/><span style={{fontWeight:400,fontSize:9}}>${p.price}/mo</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={submit} disabled={loading}
            style={{width:"100%",background:loading?"rgba(99,102,241,.5)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:loading?"not-allowed":"pointer",fontWeight:700,fontSize:14,fontFamily:"'Plus Jakarta Sans',sans-serif",boxShadow:"0 4px 18px rgba(99,102,241,.24)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxSizing:"border-box"}}>
            {loading?(
              <><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/>{mode==="login"?"Signing in...":"Creating account..."}</>
            ):(
              mode==="login"?"Sign In ⚡":"Create Account ⚡"
            )}
          </button>

          {mode==="signup"&&(
            <p style={{textAlign:"center",fontSize:9,color:"rgba(255,255,255,.26)",marginTop:8,letterSpacing:1.2,fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
              +3 FREE CREDITS ON SIGNUP · NO CARD REQUIRED
            </p>
          )}

          <p style={{textAlign:"center",marginTop:14,fontSize:12,color:"rgba(255,255,255,.56)",fontFamily:"'Plus Jakarta Sans',sans-serif"}}>
            {mode==="login"?"No account? ":"Have an account? "}
            <span onClick={onSwitch} style={{color:"#6366f1",cursor:"pointer",fontWeight:700}}>
              {mode==="login"?"Start free":"Sign in"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App(){
  useStyles();
  const [screen,setScreen]   =useState("landing");
  const [authMode,setAuthMode]=useState("signup");
  const [user,setUser]       =useState(null);

  // Initialise Supabase once — stored on window so AuthPage can access it
  // without prop-drilling. Requires VITE_SUPABASE_URL and VITE_SUPABASE_KEY
  // to be set as Vercel environment variables.
  useEffect(()=>{
    if(window.__supabase) return; // already initialised
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_KEY;
    if(!url||!key) return; // env vars not set yet — auth falls back gracefully
    import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(({createClient})=>{
      window.__supabase = createClient(url, key);
    }).catch(()=>{});
  },[]);

  if(screen==="landing") return <LandingPage onStart={m=>{ setAuthMode(m); setScreen("auth"); }}/>;
  if(screen==="auth")    return <AuthPage mode={authMode} onAuth={u=>{ setUser(u); setScreen("app"); }} onSwitch={()=>setAuthMode(m=>m==="login"?"signup":"login")}/>;
  if(screen==="app"&&user) return <MainApp user={user} onLogout={()=>{ const accts=LS.get("sp_accounts",{}); const k=(user?.email||'').toLowerCase(); if(accts[k]){ accts[k].credits=credits; accts[k].plan=planKey; LS.set("sp_accounts",accts); } LS.del("sp_onboarded"); setUser(null); setScreen("landing"); }}/>;
  return <div style={{minHeight:"100vh",background:"#08090e"}}/>;
}