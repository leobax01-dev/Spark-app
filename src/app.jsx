import { useState, useEffect, useCallback, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap";

const C = {
  bg:"#08090e", surface:"#0d0f17", surfaceUp:"#12141f", surfaceHigh:"#181a28",
  border:"rgba(255,255,255,0.06)", borderMd:"rgba(255,255,255,0.11)", borderHi:"rgba(255,255,255,0.16)",
  indigo:"#6366f1", indigoLt:"#818cf8", indigoD:"#4f52c9",
  violet:"#8b5cf6", cyan:"#22d3ee", emerald:"#10b981",
  amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8",
  text:"rgba(255,255,255,0.92)", textMd:"rgba(255,255,255,0.56)",
  textDim:"rgba(255,255,255,0.26)", textFaint:"rgba(255,255,255,0.09)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const GLOBAL_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  ::-webkit-scrollbar{width:3px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.07);border-radius:2px}
  ::placeholder{color:rgba(255,255,255,0.17)!important}
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes scaleIn{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}
  @keyframes slideR{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:translateX(0)}}
  @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
  @keyframes orb1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(44px,-32px) scale(1.09)}66%{transform:translate(-22px,18px) scale(0.96)}}
  @keyframes orb2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-48px,28px) scale(1.06)}66%{transform:translate(28px,-18px) scale(1.1)}}
  @keyframes orb3{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(18px,36px) scale(0.92)}}
  @keyframes pulse{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:1;transform:scale(1.18)}}
  @keyframes toastIn{from{opacity:0;transform:translateY(12px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes toastOut{from{opacity:1}to{opacity:0;transform:translateY(4px)}}
  @keyframes spin{to{transform:rotate(360deg)}}
  .nav-item{transition:all .15s}
  .nav-item:hover{background:rgba(255,255,255,0.055)!important;color:rgba(255,255,255,.88)!important}
  .nav-item.active{background:rgba(99,102,241,.11)!important;color:#a5b4fc!important;border-color:rgba(99,102,241,.24)!important}
  .btn-g{transition:all .18s}
  .btn-g:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 8px 26px rgba(99,102,241,.32)!important}
  .btn-g:active:not(:disabled){transform:translateY(0)}
  .btn-g:disabled{opacity:.45;cursor:not-allowed!important}
  .btn-o{transition:all .15s}
  .btn-o:hover{border-color:rgba(255,255,255,.2)!important;color:rgba(255,255,255,.9)!important}
  .ifield:focus{border-color:rgba(99,102,241,.48)!important;box-shadow:0 0 0 3px rgba(99,102,241,.1)!important;outline:none}
  .tab-b{transition:all .14s}
  .tab-b:hover{color:rgba(255,255,255,.82)!important}
  .card-h{transition:all .2s}
  .card-h:hover{transform:translateY(-2px);border-color:rgba(255,255,255,.12)!important}
  .plan-c{transition:all .2s}
  .plan-c:hover{transform:translateY(-3px);box-shadow:0 20px 44px rgba(0,0,0,.32)!important}
  .cp-b{transition:all .18s}
  .cp-b:hover{border-color:rgba(99,102,241,.38)!important;transform:translateY(-2px)}
  .copy-b{transition:all .14s}
  .copy-b:hover{background:rgba(99,102,241,.11)!important;border-color:rgba(99,102,241,.34)!important;color:#a5b4fc!important}
  .up-tease{transition:all .18s;cursor:pointer}
  .up-tease:hover{border-color:rgba(245,158,11,.44)!important;background:rgba(245,158,11,.07)!important}
  .plat-b{transition:all .16s}
  .plat-b:hover:not([data-locked="true"]){transform:translateY(-1px)}
  @keyframes carouselSlide{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
  @keyframes carouselSlideL{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:translateX(0)}}
  .carousel-arrow{transition:all .18s;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;width:36px;height:36px;flex-shrink:0}
  .carousel-arrow:hover{background:rgba(99,102,241,.18)!important;border-color:rgba(99,102,241,.4)!important;color:#a5b4fc!important;transform:scale(1.08)}
  .carousel-dot{transition:all .22s;cursor:pointer;border-radius:50%;flex-shrink:0}
  .carousel-dot:hover{opacity:.8}
`;

// ─────────────────────────────────────────────────────────────────────────────
// PLAN DEFINITIONS — single source of truth
// ─────────────────────────────────────────────────────────────────────────────
const PLANS = {
  agent:{
    name:"Agent", price:29, credits:20, accent:C.emerald, badge:null,
    contentTypes:["listing","education"],
    platforms:["TikTok","Reels"],
    hooks:3, voiceMemory:false, videoQuality:"720p", teamSeats:1, apiAccess:false,
    perks:["20 credits / month","Listing videos + agent tips","TikTok & Reels only","3 hook variants","MLS-safe captions","Email support"],
    stripeLink:"https://buy.stripe.com/your-agent-link", // replace with real Stripe link
  },
  pro:{
    name:"Pro", price:49, credits:60, accent:C.indigo, badge:"Most Popular",
    contentTypes:["listing","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:7, voiceMemory:true, videoQuality:"1080p", teamSeats:1, apiAccess:false,
    perks:["60 credits / month","All 4 content types","All 5 platforms","7 hook variants","Agent voice memory","Neighborhood stories","Priority support"],
    stripeLink:"https://buy.stripe.com/your-pro-link",
  },
  team:{
    name:"Team", price:99, credits:180, accent:C.violet, badge:null,
    contentTypes:["listing","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:10, voiceMemory:true, videoQuality:"4K", teamSeats:5, apiAccess:true,
    perks:["180 credits / month","Full content suite","All 5 platforms","10 hook variants","5-seat workspace","Brokerage branding","API access","Dedicated support"],
    stripeLink:"https://buy.stripe.com/your-team-link",
  },
};

const CONTENT_TYPES = {
  listing:  {label:"Listing Video",      icon:"🏠",color:C.indigo, cost:2,desc:"Cinematic walkthrough scripts",   minPlan:"agent"},
  education:{label:"Agent Tip",          icon:"💡",color:C.amber,  cost:1,desc:"Authority-building daily tips",    minPlan:"agent"},
  market:   {label:"Market Update",      icon:"📈",color:C.cyan,   cost:2,desc:"Local stats → viral authority",    minPlan:"pro"},
  lifestyle:{label:"Neighborhood Story", icon:"🌆",color:C.emerald,cost:2,desc:"Lifestyle content for relocators", minPlan:"pro"},
};

const PLATFORMS = {
  TikTok:  {color:"#FF004F",spec:"9:16 · 30–90s",  minPlan:"agent"},
  Reels:   {color:"#E1306C",spec:"9:16 · 15–90s",  minPlan:"agent"},
  YouTube: {color:"#FF0000",spec:"Shorts · 15–60s",minPlan:"pro"},
  Facebook:{color:"#1877F2",spec:"16:9 · 60–180s", minPlan:"pro"},
  LinkedIn:{color:"#0A66C2",spec:"1:1 · pro tone",  minPlan:"pro"},
};

const CREDIT_PACKS = [
  {credits:10, price:8,  label:"Starter"},
  {credits:30, price:18, label:"Popular"},
  {credits:80, price:40, label:"Best Value", hot:true},
  {credits:200,price:85, label:"Broker Pack"},
];

const INPUT_META = {
  address:      ["Address",             "123 Ocean Drive, Miami Beach, FL 33139"],
  price:        ["List Price",          "$875,000"],
  beds:         ["Beds",                "4"],
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
const planRank   = p => PLAN_ORDER.indexOf(p);

// ─────────────────────────────────────────────────────────────────────────────
// LOCALSTORAGE HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const LS = {
  get:(k,def)=>{ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):def; }catch{ return def; } },
  set:(k,v)=>{ try{ localStorage.setItem(k,JSON.stringify(v)); }catch{} },
  del:(k)=>{ try{ localStorage.removeItem(k); }catch{} },
};

// ─────────────────────────────────────────────────────────────────────────────
// CLAUDE & HIGGSFIELD API
// ─────────────────────────────────────────────────────────────────────────────
async function callClaude({ type, inputs, platform, voice, planKey, apiKey }) {
  const plan    = PLANS[planKey];
  const hooks   = plan.hooks;
  const useVoice= plan.voiceMemory && voice?.saved;

  const voiceCtx = useVoice
    ? `Agent: ${voice.name||""}, ${voice.brokerage||""}, ${voice.market||""}. Specialty: ${voice.specialty||""}. Tone: ${voice.tone||"warm, professional"}. Target client: ${voice.targetClient||""}. Preferred CTA: ${voice.cta||""}.`
    : "Write as a warm, professional, knowledgeable real estate agent.";

  const typeCtx = {
    listing:  `Listing at ${inputs.address||"the property"}, ${inputs.price||""}, ${inputs.beds||"?"}bd/${inputs.baths||"?"}ba, ${inputs.sqft||"?"}sqft. Features: ${inputs.keyFeatures||"see details"}. Neighborhood: ${inputs.neighborhood||"local area"}. Sell the LIFESTYLE not just specs. Emotional storytelling.`,
    market:   `Market update: ${inputs.city||"local market"}. Avg price ${inputs.avgPrice||""}, ${inputs.daysOnMarket||""} DOM, inventory: ${inputs.inventory||""}, trend: ${inputs.trend||""}. Position agent as the go-to local authority.`,
    lifestyle:`Neighborhood story: ${inputs.neighborhood||""}, ${inputs.city||""}. Highlights: ${inputs.highlights||""}. Target buyer: ${inputs.targetBuyer||""}. Feel like an insider local tour for relocators searching on TikTok.`,
    education:`Agent tip about: "${inputs.topic||""}" for ${inputs.audience||"buyers and sellers"}. Key point: ${inputs.keyPoint||""}. Genuinely useful, specific, authoritative — not generic.`,
  };

  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({
      model:"claude-sonnet-4-20250514", max_tokens:2000,
      system:`You are SPARK, an elite real estate content strategist specializing in short-form video for ${platform} (${PLATFORMS[platform]?.spec||""}). Always write MLS-compliant content — no discriminatory language, no unsubstantiated absolute superlatives. Return ONLY valid JSON with no markdown fences, no explanation.`,
      messages:[{role:"user",content:
        `${voiceCtx}\n\n${typeCtx[type]}\n\nPlatform: ${platform}. Generate exactly ${hooks} hook variants.\n\n`+
        `Return ONLY this JSON (no markdown):\n{"headline":"single best hook line","hooks":["exactly ${hooks} distinct variants — test curiosity/pain/transformation/local-authority/social-proof angles"],"script":"full timed script [0:00] with (camera cues)","higgsfield_prompt":"detailed cinematic Higgsfield AI prompt: specific camera moves like slow dolly/orbit/aerial reveal, lighting mood, color grade, property hero shots, lifestyle b-roll — specific enough to render immediately","caption":"MLS-safe caption under 220 chars","hashtags":["15 hashtags: hyperlocal + niche + trending"],"cta":"platform-native CTA","shot_list":["5 specific shots or Higgsfield scene prompts"],"thumbnail":"exact thumbnail concept: composition + text overlay + color strategy","posting_tip":"one specific ${platform} posting optimization tip"}`
      }],
    }),
  });

  if(!r.ok){
    const e=await r.json().catch(()=>({}));
    throw new Error(e?.error?.message||`Anthropic API error ${r.status}`);
  }
  const d=await r.json();
  const raw=(d.content?.[0]?.text||"{}").replace(/```json\n?|```\n?/g,"").trim();
  try{ return JSON.parse(raw); }
  catch{ throw new Error("Failed to parse response — try again"); }
}

async function callHiggsfield(prompt, key){
  const r=await fetch("https://cloud.higgsfield.ai/api/v1/generate",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},
    body:JSON.stringify({prompt,model:"soul-v2",aspect_ratio:"9:16",duration:5}),
  });
  if(!r.ok) throw new Error(`Video generation error ${r.status}`);
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLE INJECTION (runs once, no duplicate font links)
// ─────────────────────────────────────────────────────────────────────────────
function useStyles(){
  useEffect(()=>{
    if(!document.getElementById("spark-css")){
      const s=document.createElement("style");
      s.id="spark-css"; s.textContent=GLOBAL_CSS;
      document.head.appendChild(s);
    }
    if(!document.getElementById("spark-font")){
      const l=document.createElement("link");
      l.id="spark-font"; l.rel="stylesheet"; l.href=FONTS_URL;
      document.head.appendChild(l);
    }
  },[]);
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const ToastCtx = { listeners:[] };
function useToast(){
  return useCallback((msg,type="success")=>{
    ToastCtx.listeners.forEach(fn=>fn({msg,type,id:Date.now()}));
  },[]);
}

function ToastContainer(){
  const [toasts,setToasts]=useState([]);
  useEffect(()=>{
    const fn=(t)=>{
      setToasts(p=>[...p,t]);
      setTimeout(()=>setToasts(p=>p.filter(x=>x.id!==t.id)),3200);
    };
    ToastCtx.listeners.push(fn);
    return ()=>{ ToastCtx.listeners=ToastCtx.listeners.filter(f=>f!==fn); };
  },[]);
  return (
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
      {toasts.map(t=>(
        <div key={t.id} style={{
          background:t.type==="error"?"rgba(244,63,94,0.12)":t.type==="info"?"rgba(99,102,241,0.12)":"rgba(16,185,129,0.12)",
          border:`1px solid ${t.type==="error"?C.rose:t.type==="info"?C.indigo:C.emerald}44`,
          color:t.type==="error"?C.rose:t.type==="info"?C.indigoLt:C.emerald,
          padding:"11px 16px",borderRadius:10,fontSize:13,fontFamily:C.F,fontWeight:600,
          boxShadow:"0 8px 24px rgba(0,0,0,0.4)",
          animation:"toastIn .25s ease both",
          backdropFilter:"blur(12px)",
          maxWidth:320,
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
    <div style={{position:"fixed",inset:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
      <div style={{position:"absolute",width:640,height:640,borderRadius:"50%",background:"radial-gradient(circle,rgba(99,102,241,.10) 0%,transparent 68%)",top:"-8%",left:"-4%",animation:"orb1 20s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:520,height:520,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,.07) 0%,transparent 68%)",bottom:"4%",right:"-4%",animation:"orb2 24s ease-in-out infinite"}}/>
      <div style={{position:"absolute",width:420,height:420,borderRadius:"50%",background:"radial-gradient(circle,rgba(34,211,238,.05) 0%,transparent 68%)",top:"36%",left:"46%",animation:"orb3 17s ease-in-out infinite"}}/>
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:.02}}>
        <filter id="sfn"><feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
        <rect width="100%" height="100%" filter="url(#sfn)"/>
      </svg>
    </div>
  );
}

function Logo({small}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:small?28:32,height:small?28:32,borderRadius:7,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:small?13:15,boxShadow:"0 0 18px rgba(99,102,241,.35)",flexShrink:0}}>⚡</div>
      <div>
        <div style={{fontFamily:C.F,fontWeight:800,fontSize:small?13:15,color:C.text,letterSpacing:.3}}>SPARK</div>
        <div style={{fontFamily:C.F,fontSize:8,color:C.textDim,letterSpacing:2,marginTop:-1}}>REAL ESTATE AI</div>
      </div>
    </div>
  );
}

function Shimmer({children,style={}}){
  return <span style={{background:"linear-gradient(90deg,#6366f1,#a5b4fc,#8b5cf6,#6366f1)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 3s linear infinite",...style}}>{children}</span>;
}

function Badge({color=C.indigo,children}){
  return <span style={{background:color+"18",border:`1px solid ${color}40`,color,fontSize:9,fontWeight:700,padding:"2px 8px",borderRadius:20,fontFamily:C.F,letterSpacing:1.5,whiteSpace:"nowrap"}}>{children}</span>;
}

function CopyBtn({text,label}){
  const [ok,setOk]=useState(false);
  const toast=useToast();
  return(
    <button className="copy-b" onClick={()=>{
      navigator.clipboard.writeText(text).then(()=>{
        setOk(true); toast(label||"Copied to clipboard");
        setTimeout(()=>setOk(false),2000);
      }).catch(()=>toast("Copy failed — try selecting text manually","error"));
    }} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,fontSize:10,padding:"4px 10px",borderRadius:6,cursor:"pointer",fontFamily:C.F,fontWeight:600,letterSpacing:1}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}

function Field({label,value,onChange,placeholder,area,rows=2,type="text"}){
  const s={width:"100%",background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:C.F,transition:"border-color .18s, box-shadow .18s",resize:"none",type};
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
        strokeDasharray={circ} strokeDashoffset={off}
        style={{transition:"stroke-dashoffset .35s ease",strokeLinecap:"round"}}/>
    </svg>
  );
}

function UpgradePrompt({feature,requiredPlan,onUpgrade}){
  const p=PLANS[requiredPlan];
  return(
    <div className="up-tease" onClick={onUpgrade} style={{background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.2)",borderRadius:12,padding:"22px 20px",textAlign:"center",animation:"scaleIn .25s ease"}}>
      <div style={{fontSize:22,marginBottom:8}}>🔒</div>
      <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.amber,marginBottom:6}}>{feature} requires {p.name} plan</div>
      <div style={{fontFamily:C.F,fontSize:12,color:C.textMd,marginBottom:14,lineHeight:1.55}}>Upgrade to {p.name} (${p.price}/mo) to unlock this feature.</div>
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
// ONBOARDING MODAL (shown once after signup)
// ─────────────────────────────────────────────────────────────────────────────
function OnboardingModal({planKey,onClose}){
  const [step,setStep]=useState(0);
  const steps=[
    {icon:"⚡",title:"Welcome to SPARK",body:"You're set up on the "+PLANS[planKey].name+" plan with "+PLANS[planKey].credits+" credits. Let's get your first listing video done in under 60 seconds."},
    {icon:"🔑",title:"Add Your API Keys",body:"Go to Settings → add your Anthropic API key (console.anthropic.com) to unlock content generation. Optionally add Higgsfield for auto-video."},
    {icon:"🏠",title:"Generate Your First Listing",body:'Head to Generate → select "Listing Video" → fill in your property details → hit Generate. Your full script, hooks, captions, and video prompt will appear instantly.'},
    {icon:"📤",title:"Post & Go Viral",body:"Copy your caption + hashtags, use SPARK's video prompt to render your cinematic clip, and post. Most agents see their first lead inquiry within 48 hours of posting."},
  ];
  const s=steps[step];
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(8,9,14,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}}>
      <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:18,padding:"36px 32px",maxWidth:440,width:"90%",boxShadow:"0 48px 96px rgba(0,0,0,.55)",animation:"scaleIn .25s ease"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:28}}>
          <Logo/>
          <div style={{display:"flex",gap:6}}>
            {steps.map((_,i)=><div key={i} style={{width:i===step?20:6,height:6,borderRadius:3,background:i===step?C.indigo:"rgba(255,255,255,.1)",transition:"all .2s"}}/>)}
          </div>
        </div>
        <div style={{fontSize:36,marginBottom:12}}>{s.icon}</div>
        <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:10,color:C.text}}>{s.title}</div>
        <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,lineHeight:1.7,marginBottom:28}}>{s.body}</p>
        <div style={{display:"flex",gap:10}}>
          {step>0&&<button className="btn-o" onClick={()=>setStep(s=>s-1)} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"11px 20px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F}}>← Back</button>}
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
function GeneratePanel({planKey,voice,credits,setCredits,apiKeys,onNeedKey,onGoUpgrade}){
  const plan=PLANS[planKey];
  const toast=useToast();

  // Persist last-used type/platform/inputs
  const [type,setType]     =useState(()=>LS.get("sp_type","listing"));
  const [platform,setPlatform]=useState(()=>{
    const saved=LS.get("sp_plat","TikTok");
    return plan.platforms.includes(saved)?saved:"TikTok";
  });
  const [inputs,setInputs] =useState(()=>LS.get("sp_inputs",{}));
  const [gen,setGen]       =useState(false);
  const [stage,setStage]   =useState("");
  const [pct,setPct]       =useState(0);
  const [result,setResult] =useState(null);
  const [vidStatus,setVid] =useState(null);
  const [tab,setTab]       =useState("script");
  const genRef             =useRef(false);

  // Persist selections
  useEffect(()=>LS.set("sp_type",type),[type]);
  useEffect(()=>LS.set("sp_plat",platform),[platform]);
  useEffect(()=>LS.set("sp_inputs",inputs),[inputs]);

  // Reset type/platform if plan no longer covers them
  useEffect(()=>{
    if(!plan.contentTypes.includes(type)) setType("listing");
    if(!plan.platforms.includes(platform)) setPlatform("TikTok");
  },[planKey]);

  // Clear results when type or platform changes
  useEffect(()=>{setResult(null);setVid(null);},[type,platform]);

  const typeLocked    = !plan.contentTypes.includes(type);
  const platformLocked= !plan.platforms.includes(platform);
  const cost          = CONTENT_TYPES[type]?.cost||2;
  const hasKey        = !!apiKeys.anthropic;
  const canGen        = hasKey && credits>=cost && !typeLocked && !platformLocked;

  const STAGES=[
    [8, "Analyzing your agent profile..."],
    [22,"SPARK is crafting your script..."],
    [44,"Writing hooks & captions..."],
    [62,`Optimizing for ${platform}...`],
    [78,"Rendering cinematic video sequence..."],
    [90,"Finalizing your package..."],
  ];

  async function generate(){
    if(genRef.current) return;
    if(!hasKey){ onNeedKey(); return; }
    if(credits<cost){ toast(`Need ${cost} credits — top up in Billing`,"error"); return; }
    if(typeLocked){ toast("Upgrade your plan to use this content type","error"); return; }
    if(platformLocked){ toast("Upgrade your plan to post to this platform","error"); return; }

    genRef.current=true;
    setGen(true); setResult(null); setVid(null);

    for(const [p,s] of STAGES){
      if(!genRef.current) break;
      setStage(s); setPct(p);
      await new Promise(r=>setTimeout(r,p<44?400:280));
    }

    try{
      const content=await callClaude({type,inputs,platform,voice,planKey,apiKey:apiKeys.anthropic});
      setPct(94);

      if(apiKeys.higgsfield){
        setStage("Generating your video...");
        try{
          const job=await callHiggsfield(content.higgsfield_prompt,apiKeys.higgsfield);
          setVid({status:"ready",url:job?.output?.media_url?.[0]||null});
        }catch{ setVid({status:"prompt"}); }
      }else{
        setVid({status:"prompt"});
      }

      setPct(100); setStage("Done!");
      await new Promise(r=>setTimeout(r,180));
      setResult(content);
      setCredits(c=>{
        const next=c-cost;
        LS.set("sp_credits",next);
        return next;
      });
      setTab("script");
      toast("Content package ready ✓");
    }catch(e){
      toast(e.message||"Generation failed — check your API key","error");
    }finally{
      genRef.current=false;
      setGen(false); setStage(""); setPct(0);
    }
  }

  const TABS=["script","hooks","caption","video","shots"];

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* No API key banner */}
      {!hasKey&&(
        <div className="up-tease" onClick={onNeedKey} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.2)",borderRadius:10,marginBottom:16,gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:18}}>🔑</span>
            <span style={{fontFamily:C.F,fontSize:13,color:C.indigoLt,fontWeight:600}}>Add your Anthropic API key to start generating content</span>
          </div>
          <div style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",color:"#fff",padding:"6px 14px",borderRadius:7,fontSize:11,fontWeight:700,fontFamily:C.F,whiteSpace:"nowrap"}}>Add Key →</div>
        </div>
      )}

      {/* Content type cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:18}}>
        {Object.entries(CONTENT_TYPES).map(([k,ct],i)=>{
          const locked=!plan.contentTypes.includes(k);
          const active=type===k;
          return(
            <div key={k} className="card-h"
              onClick={()=>locked?onGoUpgrade():setType(k)}
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
          {/* Input card */}
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:20,marginBottom:13}}>

            {/* Voice status row */}
            <div style={{marginBottom:16}}>
              {plan.voiceMemory?(
                voice?.saved?(
                  <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 11px",background:"rgba(16,185,129,.06)",border:"1px solid rgba(16,185,129,.15)",borderRadius:7}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 7px ${C.emerald}`}}/>
                    <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:600}}>Agent voice active — {voice.name||"your profile"} · {voice.market||""}</span>
                  </div>
                ):(
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",background:"rgba(99,102,241,.06)",border:"1px solid rgba(99,102,241,.15)",borderRadius:7}}>
                    <span style={{fontSize:11,color:C.indigoLt,fontFamily:C.F}}>Set up Agent Voice for personalised scripts</span>
                    <Badge color={C.indigo}>Available on your plan</Badge>
                  </div>
                )
              ):(
                <div className="up-tease" onClick={onGoUpgrade} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 11px",background:"rgba(245,158,11,.05)",border:"1px solid rgba(245,158,11,.18)",borderRadius:7}}>
                  <span style={{fontSize:11,color:C.amber,fontFamily:C.F}}>🔒 Agent voice memory requires Pro plan</span>
                  <Badge color={C.amber}>Upgrade →</Badge>
                </div>
              )}
            </div>

            {/* Dynamic inputs */}
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

            {/* Platform selector */}
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
              {platformLocked&&(
                <div style={{marginTop:8,fontSize:11,color:C.amber,fontFamily:C.F}}>
                  <span className="up-tease" onClick={onGoUpgrade} style={{textDecoration:"underline",cursor:"pointer"}}>Upgrade to Pro</span> to unlock YouTube, Facebook & LinkedIn.
                </div>
              )}
            </div>

            {/* Plan info row */}
            <div style={{marginTop:14,padding:"7px 11px",background:"rgba(255,255,255,.02)",borderRadius:7,display:"flex",gap:16,flexWrap:"wrap"}}>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Hooks: <strong style={{color:C.text}}>{plan.hooks}</strong></span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Quality: <strong style={{color:C.text}}>{plan.videoQuality}</strong></span>
              <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>Credits: <strong style={{color:credits<5?C.rose:C.text}}>{credits} left</strong></span>
              {planKey!=="team"&&<span className="up-tease" onClick={onGoUpgrade} style={{fontSize:10,color:C.indigo,fontFamily:C.F,cursor:"pointer",marginLeft:"auto"}}>Upgrade for more ↗</span>}
            </div>
          </div>

          {/* Generate button */}
          {!gen?(
            <button className="btn-g" onClick={generate} disabled={!canGen}
              style={{width:"100%",background:canGen?"linear-gradient(135deg,#6366f1,#8b5cf6)":C.surface,border:canGen?"none":`1px solid ${C.border}`,color:canGen?"#fff":C.textDim,padding:"14px 0",borderRadius:10,cursor:canGen?"pointer":"not-allowed",fontFamily:C.F,fontWeight:700,fontSize:14,letterSpacing:.2,boxShadow:canGen?"0 4px 18px rgba(99,102,241,.24)":"none"}}>
              {!hasKey?"🔑 Add API Key First":credits<cost?`⚠ Need ${cost} Credits (Have ${credits})`:`⚡ Generate ${CONTENT_TYPES[type].label} — ${cost} Credits`}
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
                <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:700,letterSpacing:.8}}>PACKAGE READY</span>
                <Badge color={PLATFORMS[platform].color}>{platform}</Badge>
                <Badge color={CONTENT_TYPES[type].color}>{CONTENT_TYPES[type].label}</Badge>
                <Badge color={C.textDim}>{plan.hooks} HOOKS</Badge>
              </div>

              {/* Tab bar */}
              <div style={{display:"flex",background:"rgba(255,255,255,.03)",borderRadius:9,padding:3,marginBottom:12,gap:2}}>
                {TABS.map(t=>(
                  <button key={t} className="tab-b" onClick={()=>setTab(t)} style={{flex:1,padding:"7px 4px",borderRadius:6,border:"none",background:tab===t?C.surfaceUp:"transparent",color:tab===t?C.text:C.textDim,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:C.F,letterSpacing:.8,boxShadow:tab===t?"0 1px 4px rgba(0,0,0,.28)":"none"}}>{t.toUpperCase()}</button>
                ))}
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
                <RBlock accent={C.violet} label={`HOOK VARIANTS (${(result.hooks||[]).length} — ${plan.name} PLAN)`}
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
                  {planKey!=="team"&&(
                    <div className="up-tease" onClick={onGoUpgrade} style={{marginTop:11,padding:"9px 13px",background:"rgba(245,158,11,.04)",border:"1px solid rgba(245,158,11,.14)",borderRadius:7,textAlign:"center"}}>
                      <span style={{fontSize:11,color:C.amber,fontFamily:C.F}}>Get {PLANS[planKey==="agent"?"pro":"team"].hooks} hooks on {PLANS[planKey==="agent"?"pro":"team"].name} plan →</span>
                    </div>
                  )}
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
                <RBlock accent={C.cyan} label={`HIGGSFIELD VIDEO — ${plan.videoQuality}`}>
                  {vidStatus?.status==="ready"&&vidStatus.url?(
                    <div>
                      <video src={vidStatus.url} controls style={{width:"100%",borderRadius:8,maxHeight:320}}/>
                      <a href={vidStatus.url} download style={{display:"block",textAlign:"center",marginTop:9,color:C.indigo,fontSize:12,fontFamily:C.F,textDecoration:"none"}}>⬇ Download Video</a>
                    </div>
                  ):(
                    <div>
                      <div style={{background:"rgba(34,211,238,.04)",border:"1px solid rgba(34,211,238,.12)",borderRadius:8,padding:13,fontSize:13,color:C.textMd,lineHeight:1.75,fontFamily:C.F,marginBottom:9}}>
                        {result.higgsfield_prompt}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:result.thumbnail?14:0}}>
                        <CopyBtn text={result.higgsfield_prompt||""} label="Higgsfield prompt copied"/>
                        <span style={{fontSize:11,color:C.textDim,fontFamily:C.F}}>or connect video generation in Settings to auto-render</span>
                      </div>
                      {result.thumbnail&&(
                        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:13}}>
                          <div style={{fontSize:9,color:C.cyan,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:5}}>THUMBNAIL CONCEPT</div>
                          <p style={{fontSize:12,color:C.textMd,margin:0,fontFamily:C.F,lineHeight:1.6}}>{result.thumbnail}</p>
                        </div>
                      )}
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
  const plan=PLANS[planKey];
  const toast=useToast();
  if(!plan.voiceMemory) return <UpgradePrompt feature="Agent Voice Memory" requiredPlan="pro" onUpgrade={onGoUpgrade}/>;

  const fields=[
    {k:"name",       l:"YOUR NAME",         p:"Sarah Johnson"},
    {k:"brokerage",  l:"BROKERAGE",         p:"Keller Williams Realty"},
    {k:"market",     l:"PRIMARY MARKET",    p:"Miami, FL"},
    {k:"specialty",  l:"SPECIALTY",         p:"Luxury waterfront, first-time buyers"},
    {k:"tone",       l:"CONTENT TONE",      p:"Warm and knowledgeable — like a trusted friend"},
    {k:"targetClient",l:"TARGET CLIENT",    p:"Families relocating from NYC, $600K–$1.2M"},
    {k:"cta",        l:"PREFERRED CTA",     p:"DM me HOME for a free market analysis"},
  ];

  function save(){
    if(!voice.name||!voice.market){ toast("Add your name and market first","error"); return; }
    const saved={...voice,saved:true};
    setVoice(saved);
    LS.set("sp_voice",saved);
    toast("Agent voice saved — all scripts will now sound like you ✓");
    onSave();
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
// PLAN CAROUSEL — reused in both BillingPanel and LandingPage
// Pro (index 1) always starts as the active/center card.
// ─────────────────────────────────────────────────────────────────────────────
function PlanCarousel({ currentPlanKey, onSelect, onStart, mode }) {
  // mode: "billing" (inside app) | "landing" (public page)
  const planEntries = Object.entries(PLANS); // [agent, pro, team]
  const POP_IDX = 1; // "pro" is index 1 — always start here

  const [idx, setIdx]     = useState(POP_IDX);
  const [dir, setDir]     = useState(null); // "l" | "r" | null
  const [animKey, setAnimKey] = useState(0);

  function go(next) {
    const clamped = Math.max(0, Math.min(planEntries.length - 1, next));
    if (clamped === idx) return;
    setDir(clamped > idx ? "r" : "l");
    setIdx(clamped);
    setAnimKey(k => k + 1);
  }

  const [k, p]  = planEntries[idx];
  const prevOk  = idx > 0;
  const nextOk  = idx < planEntries.length - 1;
  const isCur   = mode === "billing" && k === currentPlanKey;
  const isUp    = mode === "billing" && planRank(k) > planRank(currentPlanKey);
  const isDn    = mode === "billing" && planRank(k) < planRank(currentPlanKey);

  const slideAnim = dir === "r"
    ? `carouselSlide .28s ease both`
    : dir === "l"
    ? `carouselSlideL .28s ease both`
    : `scaleIn .28s ease both`;

  return (
    <div style={{ userSelect: "none" }}>
      {/* Peek row — shows all three plan names as tabs above */}
      <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 20 }}>
        {planEntries.map(([pk, pp], i) => {
          const active = i === idx;
          const isCurTab = mode === "billing" && pk === currentPlanKey;
          return (
            <button key={pk} onClick={() => go(i)} style={{
              padding: "5px 14px", borderRadius: 20, border: "none",
              background: active ? `linear-gradient(135deg,${pp.accent},${pp.accent}bb)` : "rgba(255,255,255,.05)",
              color: active ? "#fff" : C.textDim,
              cursor: "pointer", fontSize: 11, fontWeight: active ? 700 : 500,
              fontFamily: C.F, letterSpacing: .5, transition: "all .18s",
              boxShadow: active ? `0 2px 12px ${pp.accent}44` : "none",
              position: "relative",
            }}>
              {pp.name}
              {isCurTab && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: C.emerald, border: `2px solid ${C.bg}`, boxShadow: `0 0 6px ${C.emerald}` }} />}
              {pp.badge && !isCurTab && !active && <span style={{ position: "absolute", top: -8, right: -4, fontSize: 7, color: C.indigo, fontWeight: 800, fontFamily: C.F, letterSpacing: .5, whiteSpace: "nowrap" }}>★</span>}
            </button>
          );
        })}
      </div>

      {/* Main carousel row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Prev arrow */}
        <button className="carousel-arrow" onClick={() => go(idx - 1)} disabled={!prevOk}
          style={{ opacity: prevOk ? 1 : 0.2, pointerEvents: prevOk ? "auto" : "none" }}>
          ←
        </button>

        {/* Card */}
        <div key={animKey} style={{
          flex: 1, background: isCur ? C.surfaceUp : C.surface,
          border: `1px solid ${isCur ? p.accent + "55" : p.badge ? p.accent + "30" : C.border}`,
          borderRadius: 16, padding: "28px 24px", position: "relative",
          boxShadow: p.badge ? `0 0 40px ${p.accent}18, 0 8px 32px rgba(0,0,0,.3)` : isCur ? `0 0 28px ${p.accent}14` : "0 4px 20px rgba(0,0,0,.2)",
          animation: slideAnim,
        }}>
          {/* Badge row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
            <Badge color={p.accent}>{p.name.toUpperCase()}</Badge>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {p.badge && <span style={{ background: `linear-gradient(135deg,${C.indigo},${C.violet})`, color: "#fff", fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: 8, letterSpacing: 1, fontFamily: C.F }}>{p.badge}</span>}
              {isCur && <span style={{ background: p.accent, color: "#fff", fontSize: 8, fontWeight: 800, padding: "3px 10px", borderRadius: 8, letterSpacing: 1, fontFamily: C.F }}>CURRENT</span>}
            </div>
          </div>

          {/* Price */}
          <div style={{ fontFamily: C.F, fontWeight: 800, fontSize: 48, lineHeight: 1, marginBottom: 4 }}>
            ${p.price}
            <span style={{ fontSize: 14, color: C.textDim, fontWeight: 400 }}>/mo</span>
          </div>
          <div style={{ fontSize: 12, color: C.textDim, marginBottom: 22, fontFamily: C.F }}>
            {p.credits} credits · {p.videoQuality} video · {p.hooks} hooks
          </div>

          {/* Perks */}
          <div style={{ marginBottom: 22 }}>
            {p.perks.map((pk, j) => (
              <div key={j} style={{ fontSize: 13, color: C.textMd, marginBottom: 8, display: "flex", gap: 8, fontFamily: C.F, alignItems: "flex-start" }}>
                <span style={{ color: p.accent, flexShrink: 0, marginTop: 1 }}>✓</span>{pk}
              </div>
            ))}
          </div>

          {/* Key unlocks callout */}
          <div style={{ background: p.accent + "0c", border: `1px solid ${p.accent}22`, borderRadius: 8, padding: "10px 14px", marginBottom: 18 }}>
            <div style={{ fontSize: 9, color: p.accent, fontFamily: C.F, fontWeight: 700, letterSpacing: 1.5, marginBottom: 5 }}>PLATFORMS INCLUDED</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {p.platforms.map(pl => (
                <span key={pl} style={{ background: "rgba(255,255,255,.05)", border: `1px solid ${C.border}`, color: C.textMd, fontSize: 10, padding: "2px 8px", borderRadius: 10, fontFamily: C.F }}>{pl}</span>
              ))}
            </div>
          </div>

          {/* CTA button */}
          {mode === "landing" ? (
            <button className="btn-g" onClick={() => onStart("signup")} style={{
              width: "100%", background: `linear-gradient(135deg,${p.accent},${p.accent}bb)`,
              border: "none", color: "#fff", padding: "13px 0", borderRadius: 10,
              cursor: "pointer", fontWeight: 700, fontSize: 14, fontFamily: C.F,
              boxShadow: `0 4px 18px ${p.accent}33`, letterSpacing: .3,
            }}>
              Get Started with {p.name} ⚡
            </button>
          ) : (
            <button className="btn-g" onClick={() => onSelect(k)} disabled={isCur}
              style={{
                width: "100%",
                background: isCur ? "transparent" : isUp ? `linear-gradient(135deg,${p.accent},${p.accent}bb)` : "rgba(255,255,255,.06)",
                border: `1px solid ${isCur ? p.accent + "44" : isUp ? p.accent + "66" : C.border}`,
                color: isCur ? p.accent : isUp ? "#fff" : C.textMd,
                padding: "13px 0", borderRadius: 10,
                cursor: isCur ? "default" : "pointer",
                fontWeight: 700, fontSize: 14, fontFamily: C.F,
                boxShadow: isUp ? `0 4px 18px ${p.accent}30` : "none",
              }}>
              {isCur ? "Your Current Plan" : isUp ? `Upgrade to ${p.name} →` : isDn ? `Switch to ${p.name} ↓` : "Select Plan"}
            </button>
          )}
        </div>

        {/* Next arrow */}
        <button className="carousel-arrow" onClick={() => go(idx + 1)} disabled={!nextOk}
          style={{ opacity: nextOk ? 1 : 0.2, pointerEvents: nextOk ? "auto" : "none" }}>
          →
        </button>
      </div>

      {/* Dot indicators */}
      <div style={{ display: "flex", justifyContent: "center", gap: 7, marginTop: 18 }}>
        {planEntries.map(([pk, pp], i) => (
          <div key={pk} className="carousel-dot" onClick={() => go(i)} style={{
            width: i === idx ? 20 : 7, height: 7,
            background: i === idx ? planEntries[i][1].accent : "rgba(255,255,255,.15)",
            borderRadius: 4,
          }} />
        ))}
      </div>

      {/* Plan navigation hint */}
      <p style={{ textAlign: "center", fontSize: 10, color: C.textDim, fontFamily: C.F, marginTop: 10, letterSpacing: .8 }}>
        ← swipe or click arrows to compare plans →
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BILLING PANEL
// ─────────────────────────────────────────────────────────────────────────────
function BillingPanel({planKey,setPlanKey,credits,setCredits}){
  const plan=PLANS[planKey];
  const toast=useToast();
  const [confirmKey,setConfirmKey]=useState(null);

  function doUpgrade(k){
    if(k===planKey) return;
    if(planRank(k)<planRank(planKey)){
      // downgrade
      setPlanKey(k); LS.set("sp_plan",k);
      const nc=PLANS[k].credits; setCredits(nc); LS.set("sp_credits",nc);
      toast(`Switched to ${PLANS[k].name} plan`,"info");
    } else {
      setConfirmKey(k);
    }
  }

  function confirmUpgrade(){
    const np=PLANS[confirmKey];
    const delta=Math.max(0,np.credits-plan.credits);
    const nc=credits+delta;
    setPlanKey(confirmKey); LS.set("sp_plan",confirmKey);
    setCredits(nc); LS.set("sp_credits",nc);
    toast(`Upgraded to ${np.name} plan — ${nc} credits added ✓`);
    setConfirmKey(null);
  }

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* Upgrade confirm modal */}
      {confirmKey&&(
        <div style={{position:"fixed",inset:0,background:"rgba(8,9,14,.88)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,backdropFilter:"blur(8px)",animation:"fadeIn .2s ease"}}>
          <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:30,maxWidth:400,width:"90%",boxShadow:"0 40px 80px rgba(0,0,0,.5)",animation:"scaleIn .24s ease"}}>
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:8}}>Upgrade to {PLANS[confirmKey].name}?</div>
            <p style={{fontSize:13,color:C.textMd,marginBottom:6,fontFamily:C.F,lineHeight:1.6}}>
              Your plan becomes <strong style={{color:PLANS[confirmKey].accent}}>{PLANS[confirmKey].name}</strong> at ${PLANS[confirmKey].price}/month.
            </p>
            <p style={{fontSize:13,color:C.textMd,marginBottom:22,fontFamily:C.F,lineHeight:1.6}}>
              New unlocks:{" "}
              <strong style={{color:C.text}}>
                {PLANS[confirmKey].contentTypes.filter(t=>!PLANS[planKey].contentTypes.includes(t)).map(t=>CONTENT_TYPES[t].label).join(", ")||"all current features plus higher limits"}
              </strong>
            </p>
            <div style={{background:"rgba(245,158,11,.07)",border:"1px solid rgba(245,158,11,.2)",borderRadius:8,padding:"10px 13px",marginBottom:20,fontSize:12,color:C.amber,fontFamily:C.F}}>
              ⚠ In production this would redirect to Stripe. For this demo the plan updates immediately.
            </div>
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
            <div style={{fontSize:12,color:C.textMd,marginTop:2,fontFamily:C.F}}>${plan.price}/mo · {plan.videoQuality} video · {plan.hooks} hooks</div>
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

      {/* Plan carousel */}
      <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:18}}>PLANS</div>
      <div style={{marginBottom:30}}>
        <PlanCarousel currentPlanKey={planKey} onSelect={doUpgrade} mode="billing"/>
      </div>

      {/* Credit packs */}
      <div style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700,marginBottom:13}}>BUY EXTRA CREDITS</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:11}}>
        {CREDIT_PACKS.map((pk,i)=>(
          <button key={i} className="cp-b" onClick={()=>{
            const nc=credits+pk.credits;
            setCredits(nc); LS.set("sp_credits",nc);
            toast(`${pk.credits} credits added ✓`);
          }} style={{background:C.surface,border:`1px solid ${pk.hot?"rgba(99,102,241,.28)":C.border}`,borderRadius:10,padding:"16px 10px",textAlign:"center",cursor:"pointer",position:"relative",animation:`fadeUp .3s ease ${i*.06}s both`}}>
            {pk.hot&&<div style={{position:"absolute",top:-8,left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,color:"#fff",fontSize:7,fontWeight:800,padding:"2px 8px",borderRadius:8,letterSpacing:.8,whiteSpace:"nowrap",fontFamily:C.F}}>BEST VALUE</div>}
            <div style={{fontFamily:C.F,fontWeight:800,fontSize:26,color:C.indigo}}>{pk.credits}</div>
            <div style={{fontSize:8,color:C.textDim,letterSpacing:2,fontFamily:C.F,marginBottom:6}}>CREDITS</div>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:18}}>${pk.price}</div>
            <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:2}}>${(pk.price/pk.credits).toFixed(2)}/cr</div>
            <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,marginTop:3}}>{pk.label}</div>
          </button>
        ))}
      </div>
      <p style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginTop:12,textAlign:"center"}}>
        Credit packs persist in your browser. <span style={{color:C.indigo}}>Connect Stripe to charge real payments.</span>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPanel({apiKeys,setApiKeys,onSaved}){
  const [local,setLocal]=useState({...apiKeys});
  const toast=useToast();

  function save(){
    setApiKeys(local);
    LS.set("sp_keys",local);
    toast("API keys saved ✓");
    onSaved?.();
  }

  return(
    <div style={{animation:"fadeUp .38s ease"}}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:26,marginBottom:16}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:16,marginBottom:4}}>API Keys</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:22,fontFamily:C.F,lineHeight:1.6}}>Keys are saved in your browser's localStorage. They are never transmitted anywhere except directly to the respective APIs.</p>
        {[
          {k:"anthropic", l:"ANTHROPIC API KEY",  p:"sk-ant-api03-...", note:"Powers all content generation",    link:"console.anthropic.com", req:true},
          {k:"higgsfield",l:"HIGGSFIELD API KEY", p:"hf-...",           note:"Auto-generates listing videos",     link:"cloud.higgsfield.ai",   req:false},
        ].map((f,i)=>(
          <div key={f.k} style={{marginBottom:20,animation:`fadeUp .28s ease ${i*.1}s both`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700}}>{f.l}{f.req&&<span style={{color:C.rose}}> *</span>}</div>
              <a href={`https://${f.link}`} target="_blank" rel="noreferrer" style={{fontSize:10,color:C.indigo,fontFamily:C.F,textDecoration:"none"}}>{f.link} ↗</a>
            </div>
            <input className="ifield" type="password" value={local[f.k]||""} onChange={e=>setLocal(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p}
              style={{width:"100%",background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:C.F,transition:"all .18s"}}/>
            <div style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginTop:5}}>{f.note}</div>
          </div>
        ))}
        <button className="btn-g" onClick={save} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"12px 24px",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:C.F,boxShadow:"0 4px 16px rgba(99,102,241,.22)"}}>
          Save Keys
        </button>
      </div>

      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,padding:26}}>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:16,marginBottom:4}}>Connect Stripe</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:16,fontFamily:C.F,lineHeight:1.6}}>To charge real payments, replace the <code style={{background:"rgba(255,255,255,.06)",padding:"1px 5px",borderRadius:4,fontSize:11}}>stripeLink</code> values in the <code style={{background:"rgba(255,255,255,.06)",padding:"1px 5px",borderRadius:4,fontSize:11}}>PLANS</code> config with your real Stripe Payment Link URLs, then wire the plan card buttons to <code style={{background:"rgba(255,255,255,.06)",padding:"1px 5px",borderRadius:4,fontSize:11}}>window.location.href = plan.stripeLink</code>.</p>
        <a href="https://dashboard.stripe.com/payment-links" target="_blank" rel="noreferrer">
          <button className="btn-g" style={{background:"#635bff",border:"none",color:"#fff",padding:"11px 22px",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:C.F}}>Open Stripe Dashboard ↗</button>
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// API KEY MODAL
// ─────────────────────────────────────────────────────────────────────────────
function KeyModal({apiKeys,setApiKeys,onClose}){
  const [local,setLocal]=useState({...apiKeys});
  const toast=useToast();
  function save(){
    setApiKeys(local); LS.set("sp_keys",local);
    toast("API keys saved ✓"); onClose();
  }
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(8,9,14,.9)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1001,backdropFilter:"blur(9px)",animation:"fadeIn .2s ease"}}>
      <div style={{background:C.surface,border:`1px solid ${C.borderMd}`,borderRadius:16,padding:30,maxWidth:430,width:"90%",boxShadow:"0 48px 96px rgba(0,0,0,.55)",animation:"scaleIn .24s ease"}}>
        <div style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:6}}>Add API Keys</div>
        <p style={{fontSize:12,color:C.textMd,marginBottom:22,lineHeight:1.7,fontFamily:C.F}}>Keys are stored locally in your browser and only sent to the respective APIs — never to our servers.</p>
        {[
          {k:"anthropic", l:"ANTHROPIC API KEY *", p:"sk-ant-api03-...", link:"console.anthropic.com"},
          {k:"higgsfield",l:"HIGGSFIELD API KEY (optional)", p:"hf-...", link:"cloud.higgsfield.ai"},
        ].map(f=>(
          <div key={f.k} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700}}>{f.l}</div>
              <a href={`https://${f.link}`} target="_blank" rel="noreferrer" style={{fontSize:10,color:C.indigo,fontFamily:C.F,textDecoration:"none"}}>{f.link} ↗</a>
            </div>
            <input className="ifield" type="password" value={local[f.k]||""} onChange={e=>setLocal(p=>({...p,[f.k]:e.target.value}))} placeholder={f.p}
              style={{width:"100%",background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 13px",color:C.text,fontSize:13,fontFamily:C.F,transition:"all .18s"}}/>
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginTop:6}}>
          <button className="btn-g" onClick={save} style={{flex:1,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F}}>Save Keys ⚡</button>
          <button className="btn-o" onClick={onClose} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"13px 18px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function MainApp({user,onLogout}){
  const [tab,setTab]       =useState("generate");
  const [planKey,setPlanKey]=useState(()=>LS.get("sp_plan",user.plan||"pro"));
  const [credits,setCredits]=useState(()=>LS.get("sp_credits",user.credits||63));
  const [voice,setVoice]   =useState(()=>LS.get("sp_voice",{saved:false,name:"",brokerage:"",market:"",specialty:"",tone:"",targetClient:"",cta:""}));
  const [apiKeys,setApiKeys]=useState(()=>LS.get("sp_keys",{anthropic:"",higgsfield:""}));
  const [showKeyModal,setKeyModal]=useState(false);
  const [showOnboard,setOnboard]=useState(()=>LS.get("sp_onboarded",false)===false);
  const toast=useToast();

  const plan=PLANS[planKey];

  // Sync voice memory flag when plan downgraded
  useEffect(()=>{
    if(!PLANS[planKey].voiceMemory&&voice.saved){
      const v={...voice,saved:false};
      setVoice(v); LS.set("sp_voice",v);
    }
  },[planKey]);

  function handleOnboardClose(){
    setOnboard(false); LS.set("sp_onboarded",true);
    if(!apiKeys.anthropic) setKeyModal(true);
  }

  function handleGoUpgrade(){ setTab("billing"); toast("Choose your plan below","info"); }
  function handleNeedKey(){ setKeyModal(true); }

  const NAV=[
    {id:"generate",icon:"⚡",label:"Generate"},
    {id:"voice",   icon:"◎", label:"Agent Voice"},
    {id:"billing", icon:"◈", label:"Billing"},
    {id:"settings",icon:"⚙", label:"Settings"},
  ];

  const TITLES={
    generate:<>Generate <Shimmer>Content</Shimmer></>,
    voice:   <>Agent <Shimmer>Voice</Shimmer></>,
    billing: <>Billing & <Shimmer>Credits</Shimmer></>,
    settings:<Shimmer>Settings</Shimmer>,
  };

  const SUBTITLES={
    generate: voice.saved&&plan.voiceMemory?`✓ Agent voice active — ${voice.name||""} · ${voice.market||""}`:`${plan.name.toUpperCase()} PLAN · ${plan.contentTypes.length} CONTENT TYPES · ${plan.platforms.length} PLATFORMS`,
    voice:    plan.voiceMemory?"SAVED ONCE · EVERY SCRIPT SOUNDS LIKE YOU":"REQUIRES PRO PLAN OR ABOVE",
    billing:  `${plan.name.toUpperCase()} · $${plan.price}/MO · ${credits} CREDITS REMAINING`,
    settings: "API KEYS ARE STORED IN YOUR BROWSER ONLY",
  };

  return(
    <div style={{display:"flex",height:"100vh",background:C.bg,color:C.text,fontFamily:C.F,overflow:"hidden"}}>
      <OrbBg/>
      <ToastContainer/>

      {showOnboard&&<OnboardingModal planKey={planKey} onClose={handleOnboardClose}/>}
      {showKeyModal&&<KeyModal apiKeys={apiKeys} setApiKeys={setApiKeys} onClose={()=>setKeyModal(false)}/>}

      {/* Sidebar */}
      <div style={{width:216,background:"rgba(13,15,23,.9)",borderRight:`1px solid ${C.border}`,display:"flex",flexDirection:"column",flexShrink:0,backdropFilter:"blur(20px)",position:"relative",zIndex:10}}>
        <div style={{padding:"20px 18px 16px",borderBottom:`1px solid ${C.border}`}}><Logo small/></div>

        <div style={{flex:1,padding:"11px 9px"}}>
          {NAV.map((item,i)=>(
            <button key={item.id} className={`nav-item${tab===item.id?" active":""}`} onClick={()=>setTab(item.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 11px",borderRadius:8,marginBottom:2,background:"transparent",border:"1px solid transparent",color:C.textDim,cursor:"pointer",fontSize:13,fontWeight:500,textAlign:"left",animation:`slideR .28s ease ${i*.06}s both`}}>
              <span style={{fontSize:13,width:17,textAlign:"center"}}>{item.icon}</span>
              {item.label}
              {item.id==="voice"&&plan.voiceMemory&&voice.saved&&<span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 6px ${C.emerald}`,flexShrink:0}}/>}
              {item.id==="voice"&&!plan.voiceMemory&&<span style={{marginLeft:"auto",fontSize:7,color:C.amber,fontFamily:C.F,fontWeight:700}}>PRO</span>}
              {item.id==="billing"&&credits<5&&<span style={{marginLeft:"auto",fontSize:7,color:C.rose,fontFamily:C.F,fontWeight:700}}>LOW</span>}
            </button>
          ))}
        </div>

        {/* Credit meter */}
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

        <div style={{padding:"11px 15px",borderTop:`1px solid ${C.border}`}}>
          <div style={{fontSize:9,color:C.textDim,marginBottom:4,fontFamily:C.F,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email}</div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <Badge color={plan.accent}>{plan.name.toUpperCase()}</Badge>
            <button onClick={onLogout} style={{background:"none",border:"none",color:C.textDim,cursor:"pointer",fontSize:10,fontFamily:C.F,transition:"color .15s"}} onMouseEnter={e=>e.currentTarget.style.color=C.text} onMouseLeave={e=>e.currentTarget.style.color=C.textDim}>sign out</button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,overflowY:"auto",padding:"32px 36px",position:"relative",zIndex:1}}>
        <div style={{maxWidth:820,margin:"0 auto"}}>
          <div style={{marginBottom:26}}>
            <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:26,margin:"0 0 5px",lineHeight:1.2}}>{TITLES[tab]}</h1>
            <p style={{fontSize:10,color:C.textDim,margin:0,letterSpacing:1.2,fontFamily:C.F,fontWeight:600}}>{SUBTITLES[tab]}</p>
          </div>

          {tab==="generate"&&(
            <GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onNeedKey={handleNeedKey} onGoUpgrade={handleGoUpgrade}/>
          )}

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

          {tab==="billing"&&(
            <BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits}/>
          )}

          {tab==="settings"&&(
            <SettingsPanel apiKeys={apiKeys} setApiKeys={setApiKeys} onSaved={()=>setTab("generate")}/>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({onStart}){
  const [ready,setReady]=useState(false);
  useEffect(()=>setTimeout(()=>setReady(true),60),[]);

  const FEATURES=[
    ["Content types","Listing + Tips","All 4","All 4"],
    ["Platforms","TikTok + Reels","All 5","All 5"],
    ["Hook variants","3","7","10"],
    ["Agent voice memory","✗","✓","✓"],
    ["Video quality","720p","1080p","4K"],
    ["Credits / month","20","60","180"],
    ["Team seats","1","1","5"],
    ["API access","✗","✗","✓"],
  ];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.F,overflowX:"hidden"}}>
      <OrbBg/>
      <div style={{position:"relative",zIndex:1}}>

        {/* Sticky nav */}
        <nav style={{padding:"18px 48px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(14px)",background:"rgba(8,9,14,.65)",position:"sticky",top:0,zIndex:100}}>
          <Logo/>
          <div style={{display:"flex",gap:10}}>
            <button className="btn-o" onClick={()=>onStart("login")} style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"8px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:600,fontFamily:C.F}}>Sign In</button>
            <button className="btn-g" onClick={()=>onStart("signup")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:C.F,boxShadow:"0 4px 14px rgba(99,102,241,.26)"}}>Start Free ⚡</button>
          </div>
        </nav>

        {/* Hero */}
        <div style={{padding:"108px 48px 76px",maxWidth:960,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:7,background:"rgba(99,102,241,.08)",border:"1px solid rgba(99,102,241,.2)",borderRadius:18,padding:"4px 14px",fontSize:9,color:C.indigoLt,letterSpacing:2,fontWeight:700,marginBottom:26,animation:ready?"fadeUp .45s ease both":"none"}}>
            ⚡ BUILT FOR REAL ESTATE AGENTS
          </div>
          <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(36px,5.5vw,66px)",lineHeight:1.1,margin:"0 0 22px",animation:ready?"fadeUp .45s ease .1s both":"none"}}>
            Turn Any Listing Into<br/><Shimmer style={{fontSize:"inherit",fontWeight:"inherit"}}>Viral Video Content</Shimmer><br/>
            <span style={{color:C.textDim,fontSize:".58em",fontWeight:600}}>in under 60 seconds.</span>
          </h1>
          <p style={{fontSize:16,color:C.textMd,maxWidth:490,margin:"0 auto 38px",lineHeight:1.7,fontWeight:400,animation:ready?"fadeUp .45s ease .2s both":"none"}}>
            SPARK's proprietary AI engine writes your listing scripts, generates cinematic walkthrough videos, and produces MLS-safe captions — fully optimized for TikTok, Reels, and Shorts.
          </p>
          <div style={{display:"flex",gap:11,justifyContent:"center",marginBottom:13,animation:ready?"fadeUp .45s ease .3s both":"none"}}>
            <button className="btn-g" onClick={()=>onStart("signup")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 30px",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:"0 4px 22px rgba(99,102,241,.28)"}}>Get 3 Free Generations ⚡</button>
            <button className="btn-o" onClick={()=>onStart("login")} style={{background:"rgba(255,255,255,.03)",border:`1px solid ${C.border}`,color:C.textMd,padding:"13px 26px",borderRadius:10,cursor:"pointer",fontWeight:600,fontSize:14,fontFamily:C.F}}>Sign In →</button>
          </div>
          <p style={{fontSize:9,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:600,animation:ready?"fadeIn .5s ease .5s both":"none"}}>NO CREDIT CARD · 3 FREE CREDITS · CANCEL ANYTIME</p>
        </div>

        {/* Stats bar */}
        <div style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"22px 48px",background:"rgba(255,255,255,.008)"}}>
          <div style={{maxWidth:700,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,textAlign:"center"}}>
            {[["60s","idea to video"],["1.5M+","licensed US agents"],["$49","pro plan / mo"],["5×","platforms at once"]].map(([n,l],i)=>(
              <div key={i} style={{animation:`fadeUp .38s ease ${i*.07}s both`}}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:24,color:C.indigoLt}}>{n}</div>
                <div style={{fontSize:10,color:C.textDim,letterSpacing:.8,fontFamily:C.F,marginTop:3}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature comparison table */}
        <div style={{padding:"72px 48px 0",maxWidth:960,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:36}}>
            <div style={{fontSize:9,color:C.indigo,letterSpacing:4,fontFamily:C.F,fontWeight:700,marginBottom:10}}>WHAT YOU GET</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:30,lineHeight:1.2}}>Every tool an agent needs.<br/><Shimmer>Unlocked by plan.</Shimmer></h2>
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:13,overflow:"hidden",marginBottom:72}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",background:C.surfaceUp,borderBottom:`1px solid ${C.border}`,padding:"11px 18px"}}>
              {["Feature","Agent $29","Pro $49","Team $99"].map((h,i)=>(
                <div key={i} style={{fontSize:9,fontWeight:700,color:i===0?C.textMd:Object.values(PLANS)[i-1]?.accent,fontFamily:C.F,letterSpacing:1,textAlign:i===0?"left":"center"}}>{h}</div>
              ))}
            </div>
            {FEATURES.map(([feat,...vals],i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"10px 18px",borderBottom:i<FEATURES.length-1?`1px solid ${C.border}`:"none",background:i%2===0?"transparent":"rgba(255,255,255,.008)"}}>
                <div style={{fontSize:12,color:C.textMd,fontFamily:C.F}}>{feat}</div>
                {vals.map((v,j)=>(
                  <div key={j} style={{fontSize:12,textAlign:"center",color:v==="✗"?C.textDim:v==="✓"?C.emerald:C.text,fontFamily:C.F,fontWeight:v==="✓"||v==="✗"?700:400}}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div style={{padding:"0 48px 96px",maxWidth:960,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:38}}>
            <div style={{fontSize:9,color:C.indigo,letterSpacing:4,fontFamily:C.F,fontWeight:700,marginBottom:10}}>PRICING</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:30,lineHeight:1.2}}>Less than one open house flyer print run.<br/><Shimmer>Cancel anytime.</Shimmer></h2>
          </div>
          <div style={{maxWidth:520,margin:"0 auto"}}>
            <PlanCarousel mode="landing" onStart={onStart}/>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AuthPage({mode,onAuth,onSwitch}){
  const [email,setEmail]=useState("");
  const [pass,setPass]  =useState("");
  const [plan,setPlan]  =useState("pro");
  const [loading,setLoading]=useState(false);
  const toast=useToast();

  function submit(){
    if(!email){ toast("Enter your email address","error"); return; }
    if(pass.length<6){ toast("Password must be at least 6 characters","error"); return; }
    setLoading(true);
    // Simulate async auth — replace with Supabase/Clerk in production
    setTimeout(()=>{
      const credits=mode==="signup"?PLANS[plan].credits+3:LS.get("sp_credits",PLANS[plan].credits);
      const savedPlan=mode==="login"?LS.get("sp_plan",plan):plan;
      onAuth({email,plan:savedPlan,credits});
    },600);
  }

  return(
    <div style={{minHeight:"100vh",background:"#08090e",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.F,position:"relative"}}>
      <OrbBg/>
      <ToastContainer/>
      <div style={{width:"100%",maxWidth:420,padding:20,position:"relative",zIndex:1,animation:"scaleIn .28s ease"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <Logo/>
          <p style={{color:C.textMd,fontSize:13,marginTop:10,fontFamily:C.F}}>{mode==="login"?"Welcome back, agent":"Start closing more deals with AI content"}</p>
        </div>
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:15,padding:26,boxShadow:"0 40px 80px rgba(0,0,0,.3)"}}>
          <div style={{marginBottom:14}}>
            <Field label="EMAIL" value={email} onChange={e=>setEmail(e.target.value)} placeholder="sarah@kw.com" type="email"/>
          </div>
          <div style={{marginBottom:mode==="signup"?14:20}}>
            <Field label="PASSWORD" value={pass} onChange={e=>setPass(e.target.value)} placeholder="min 6 characters" type="password"/>
          </div>
          {mode==="signup"&&(
            <div style={{marginBottom:18}}>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:7}}>SELECT PLAN</div>
              <div style={{display:"flex",gap:7}}>
                {Object.entries(PLANS).map(([k,p])=>(
                  <button key={k} onClick={()=>setPlan(k)} style={{flex:1,padding:"10px 4px",borderRadius:8,border:`1px solid ${plan===k?p.accent+"60":C.border}`,background:plan===k?p.accent+"0e":"transparent",color:plan===k?p.accent:C.textDim,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:C.F,letterSpacing:.8,transition:"all .14s"}}>
                    {p.name}<br/><span style={{fontWeight:400,fontSize:9}}>${p.price}/mo</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className="btn-g" onClick={submit} disabled={loading}
            style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:"0 4px 18px rgba(99,102,241,.24)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
            {loading?<><Spinner size={16} color="#fff"/>{mode==="login"?"Signing in...":"Creating account..."}</>:mode==="login"?"Sign In ⚡":"Create Account ⚡"}
          </button>
          {mode==="signup"&&<p style={{textAlign:"center",fontSize:9,color:C.textDim,marginTop:8,letterSpacing:1.2,fontFamily:C.F}}>+3 FREE CREDITS ON SIGNUP · NO CARD REQUIRED</p>}
          <p style={{textAlign:"center",marginTop:14,fontSize:12,color:C.textMd,fontFamily:C.F}}>
            {mode==="login"?"No account? ":"Have an account? "}
            <span onClick={onSwitch} style={{color:C.indigo,cursor:"pointer",fontWeight:700}}>{mode==="login"?"Start free":"Sign in"}</span>
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
  const [screen,setScreen]     =useState("landing");
  const [authMode,setAuthMode] =useState("signup");
  const [user,setUser]         =useState(null);

  if(screen==="landing") return <LandingPage onStart={m=>{ setAuthMode(m); setScreen("auth"); }}/>;
  if(screen==="auth")    return <AuthPage mode={authMode} onAuth={u=>{ setUser(u); setScreen("app"); }} onSwitch={()=>setAuthMode(m=>m==="login"?"signup":"login")}/>;
  if(screen==="app"&&user) return <MainApp user={user} onLogout={()=>{ LS.del("sp_onboarded"); setUser(null); setScreen("landing"); }}/>;
  return <div style={{minHeight:"100vh",background:"#08090e"}}/>;
}