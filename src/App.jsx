import { useState, useEffect, useCallback, useRef } from "react";
import posthog from "posthog-js";

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — PostHog
// ─────────────────────────────────────────────────────────────────────────────
let _phInitialized = false;
function initAnalytics(){
  if(_phInitialized) return;
  const key = import.meta.env.VITE_POSTHOG_KEY;
  const host = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";
  if(!key) return; // no key configured — analytics silently disabled
  posthog.init(key, { api_host: host, defaults: "2026-01-30", capture_pageview: true });
  _phInitialized = true;
}
function track(event, props={}){
  try{ if(_phInitialized) posthog.capture(event, props); }catch{}
}
function identifyUser(email, props={}){
  try{ if(_phInitialized) posthog.identify(email, props); }catch{}
}
function resetAnalytics(){
  try{ if(_phInitialized) posthog.reset(); }catch{}
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap";
const C = {
  bg:"#04040a", surface:"#08080f", surfaceUp:"#0d0d1a", surfaceHigh:"#111122",
  border:"rgba(255,255,255,0.06)", borderMd:"rgba(255,255,255,0.10)", borderHi:"rgba(255,255,255,0.18)",
  indigo:"#6366f1", indigoLt:"#818cf8", indigoD:"#4f52c9",
  violet:"#8b5cf6", cyan:"#22d3ee", emerald:"#10b981",
  amber:"#f59e0b", rose:"#f43f5e", sky:"#38bdf8",
  text:"rgba(255,255,255,0.95)", textMd:"rgba(255,255,255,0.55)",
  textDim:"rgba(255,255,255,0.26)", textFaint:"rgba(255,255,255,0.06)",
  F:"'Plus Jakarta Sans',sans-serif",
  glass:"rgba(255,255,255,0.025)",
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
  @keyframes gradientShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
  @keyframes glowPulse{0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0)}50%{box-shadow:0 0 20px 4px rgba(99,102,241,.15)}}
  @keyframes progressBar{from{width:0}to{width:100%}}
  .tab-b.active-tab{background:rgba(99,102,241,.1)!important;color:#a5b4fc!important;border-color:rgba(99,102,241,.25)!important}
  .mobile-nav-btn{transition:all .14s ease}
  .mobile-nav-btn:active{transform:scale(.88)}
  .rblock{transition:border-color .14s,box-shadow .14s}
  .rblock:hover{border-color:rgba(255,255,255,.1)!important;box-shadow:0 2px 12px rgba(0,0,0,.2)}
  .copy-b:active{transform:scale(.94)}
  .gen-btn-animated{background-size:200% 200%;animation:gradientShift 3s ease infinite}
  .card-h:hover:not([data-locked="true"]){transform:translateY(-2px)!important;box-shadow:0 8px 28px rgba(0,0,0,.28)!important}
  input:focus,textarea:focus{border-color:rgba(99,102,241,.45)!important;box-shadow:0 0 0 3px rgba(99,102,241,.09)!important;background:rgba(99,102,241,.02)!important}
  @keyframes floatUp{0%{opacity:0;transform:translateY(0) scale(1)}70%{opacity:1}100%{opacity:0;transform:translateY(-60px) scale(.7)}}
  @keyframes celebPop{0%{opacity:0;transform:scale(0.4) translateY(8px)}60%{opacity:1;transform:scale(1.08) translateY(-2px)}80%{transform:scale(.97)}100%{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes glowRing{0%{box-shadow:0 0 0 0 rgba(16,185,129,.6)}70%{box-shadow:0 0 0 14px rgba(16,185,129,0)}100%{box-shadow:0 0 0 0 rgba(16,185,129,0)}}
  @keyframes demoFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  @keyframes particle{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--px),var(--py)) scale(0)}}
  @keyframes badgePop{0%{opacity:0;transform:scale(.6) translateY(6px)}70%{transform:scale(1.12) translateY(-1px)}100%{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes resultSlide{0%{opacity:0;transform:translateX(-8px)}100%{opacity:1;transform:translateX(0)}}
  .demo-card{animation:demoFloat 4s ease-in-out infinite}
  .celebrate-badge{animation:celebPop .5s cubic-bezier(.34,1.56,.64,1) both,glowRing 1s ease .5s both}
  .result-ready .rblock:nth-child(1){animation:resultSlide .3s ease .05s both}
  .result-ready .rblock:nth-child(2){animation:resultSlide .3s ease .12s both}
  .result-ready .rblock:nth-child(3){animation:resultSlide .3s ease .19s both}
`;


// ─────────────────────────────────────────────────────────────────────────────
const PLANS = {
  trial:{
    name:"Trial", price:0, credits:3, accent:C.indigo, badge:null,
    contentTypes:["listing","mls_desc","open_house","objection","scripts","comms","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:7, voiceMemory:true, videoQuality:"1080p", maxPhotos:8, teamSeats:1, apiAccess:false,
    perks:["3 free credits — no card required","Full Pro-level feature access","All 4 content types","All 5 platforms","7 hook variants","Up to 8 listing photos","Agent voice memory","Auto listing video generation"],
    stripeLink:null,
  },
  agent:{
    name:"Agent", price:29, credits:20, accent:C.emerald, badge:null,
    contentTypes:["listing","mls_desc","open_house","objection","scripts","comms","education"],
    platforms:["TikTok","Reels"],
    hooks:3, voiceMemory:false, videoQuality:"720p", maxPhotos:3, teamSeats:1, apiAccess:false,
    perks:["20 credits / month","Listing videos + agent tips","TikTok & Reels only","3 hook variants","Up to 3 listing photos","MLS-safe captions","Email support"],
    stripeLink:"https://buy.stripe.com/00w28qa733TZ3Z3gqa0sU00",
  },
  pro:{
    name:"Pro", price:49, credits:60, accent:C.indigo, badge:"Most Popular",
    contentTypes:["listing","mls_desc","open_house","objection","scripts","comms","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:7, voiceMemory:true, videoQuality:"1080p", maxPhotos:8, teamSeats:1, apiAccess:false,
    perks:["60 credits / month","All 6 content types","All 5 platforms","7 hook variants","Up to 8 listing photos","Agent voice memory","Auto listing video generation","MLS descriptions","Open house packages","Priority support"],
    stripeLink:"https://buy.stripe.com/7sYcN4gvr4Y37bfddY0sU01",
  },
  team:{
    name:"Team", price:99, credits:180, accent:C.violet, badge:null,
    contentTypes:["listing","mls_desc","open_house","objection","scripts","comms","education","market","lifestyle"],
    platforms:["TikTok","Reels","YouTube","Facebook","LinkedIn"],
    hooks:10, voiceMemory:true, videoQuality:"4K", maxPhotos:20, teamSeats:5, apiAccess:true,
    perks:["180 credits / month","Full content suite","All 5 platforms","10 hook variants","Up to 20 listing photos","4K cinematic video","5-seat workspace","API access","MLS descriptions","Open house packages","Dedicated support"],
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
  listing:     {label:"Listing Video",         icon:"🏠",color:C.indigo, cost:2,desc:"Cinematic walkthrough + auto video",      minPlan:"agent"},
  mls_desc:    {label:"MLS Description",       icon:"📝",color:C.amber,  cost:1,desc:"AI-written MLS listing description",      minPlan:"agent"},
  open_house:  {label:"Open House Package",    icon:"🚪",color:C.emerald,cost:2,desc:"Full open house marketing kit",           minPlan:"agent"},
  objection:   {label:"Objection Handler",     icon:"🎯",color:C.violet, cost:1,desc:"AI responses to any client objection",    minPlan:"agent"},
  scripts:     {label:"Scripts & Dialogues",   icon:"🗣️",color:C.cyan,   cost:1,desc:"Listing appts, buyers, FSBO & more",     minPlan:"agent"},
  comms:       {label:"Client Communication",  icon:"💬",color:"#f43f5e", cost:1,desc:"Follow-ups, offers, nurture sequences",   minPlan:"agent"},
  education:   {label:"Agent Tip",             icon:"💡",color:C.amber,  cost:1,desc:"Authority-building daily tips",           minPlan:"agent"},
  market:      {label:"Market Update",         icon:"📈",color:C.cyan,   cost:2,desc:"Local stats → viral authority",           minPlan:"pro"},
  lifestyle:   {label:"Neighborhood Story",    icon:"🌆",color:C.emerald,cost:2,desc:"Lifestyle content for relocators",        minPlan:"pro"},
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
  openDate:       ["Open House Date",       "Saturday, June 28th"],
  openTime:       ["Open House Time",       "1:00 PM – 4:00 PM"],
  mlsStyle:       ["Description Style",    "Luxury / Standard / Concise"],
  objection:      ["Client Objection",     "The market is too uncertain right now, I want to wait"],
  clientType:     ["Client Type",          "Seller / Buyer / Both"],
  situation:      ["Situation",            "Listing appointment / Buyer consultation / Follow-up call"],
  scriptType:     ["Script Type",          "Listing Appointment / Buyer Consultation / FSBO Outreach / Expired Listing / Follow-Up Call"],
  agentExperience:["Agent Experience",     "5 years, luxury market specialist"],
  commsType:      ["Communication Type",   "Post-Showing Follow-Up / Offer Presentation / Post-Closing Nurture / Buyer Consultation Prep / Price Reduction Conversation"],
  clientName:     ["Client Name",          "Sarah & Mike"],
  propertyAddress:["Property Address",     "123 Ocean Drive, Miami Beach"],
  showingNotes:   ["Showing Notes / Context", "They loved the kitchen and backyard, concerned about price"],
  offerDetails:   ["Offer Details",        "$850,000 offer, conventional financing, 30-day close, clean terms"],
  closingDate:    ["Closing Date",         "June 15th"],
};

const TYPE_INPUTS = {
  listing:    ["address","price","beds","baths","sqft","keyFeatures","neighborhood"],
  mls_desc:   ["address","price","beds","baths","sqft","keyFeatures","neighborhood","mlsStyle"],
  open_house: ["address","price","beds","baths","sqft","keyFeatures","neighborhood","openDate","openTime"],
  objection:  ["objection","clientType","situation"],
  scripts:    ["scriptType","agentExperience","city"],
  comms:      ["commsType","clientName","propertyAddress","showingNotes"],
  lifestyle:  ["neighborhood","city","highlights","targetBuyer"],
  education:  ["topic","audience","keyPoint"],
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
    listing:    `Listing at ${inputs.address||"the property"}, ${inputs.price||""}, ${inputs.beds||"?"}bd/${inputs.baths||"?"}ba, ${inputs.sqft||"?"}sqft. Features: ${inputs.keyFeatures||""}. Neighborhood: ${inputs.neighborhood||""}. ${photoBase64s?.length?"Photos of the actual property have been provided — reference their visual details in the script.":""}`,
    mls_desc:   `Write an MLS listing description for: ${inputs.address||"the property"}, ${inputs.price||""}, ${inputs.beds||"?"}bd/${inputs.baths||"?"}ba, ${inputs.sqft||"?"}sqft. Features: ${inputs.keyFeatures||""}. Neighborhood: ${inputs.neighborhood||""}. Style: ${inputs.mlsStyle||"Standard"}.`,
    open_house: `Open house marketing for: ${inputs.address||"the property"}, ${inputs.price||""}, ${inputs.beds||"?"}bd/${inputs.baths||"?"}ba, ${inputs.sqft||"?"}sqft. Features: ${inputs.keyFeatures||""}. Neighborhood: ${inputs.neighborhood||""}. Date: ${inputs.openDate||""}. Time: ${inputs.openTime||""}.`,
    market:     `Market update: ${inputs.city||"local market"}. Avg price ${inputs.avgPrice||""}, ${inputs.daysOnMarket||""} DOM, inventory: ${inputs.inventory||""}, trend: ${inputs.trend||""}.`,
    lifestyle:  `Neighborhood story: ${inputs.neighborhood||""}, ${inputs.city||""}. Highlights: ${inputs.highlights||""}. Target buyer: ${inputs.targetBuyer||""}.`,
    objection:  `Real estate agent needs help responding to this client objection: "${inputs.objection||""}". Client type: ${inputs.clientType||"Buyer/Seller"}. Situation: ${inputs.situation||"consultation"}.`,
    scripts:    `Generate a professional real estate script for: ${inputs.scriptType||"Listing Appointment"}. Agent experience: ${inputs.agentExperience||"experienced agent"}. Market/city: ${inputs.city||"local market"}.`,
    comms:      `Generate client communication for: ${inputs.commsType||"Post-Showing Follow-Up"}. Client: ${inputs.clientName||"the client"}. Property: ${inputs.propertyAddress||"the property"}. Context/notes: ${inputs.showingNotes||""}.`,
  };

  // Build message content — include photos for listing type if provided
  const userContent = [];
  if(type==="listing" && photoBase64s?.length){
    photoBase64s.slice(0,4).forEach((b64,i)=>{
      userContent.push({ type:"image", source:{ type:"base64", media_type:"image/jpeg", data:b64 }});
    });
  }
  // Build JSON schema based on content type
  const jsonSchema = (()=>{
    if(type==="comms") return(
      `{"communication_type":"${inputs.commsType||"Post-Showing Follow-Up"}","subject_line":"email subject line — personal, specific, not salesy","email_body":"full email — warm, personal, professional, references specific details from the context, 3-4 short paragraphs","text_version":"SMS/text version under 160 chars — casual, personal, clear CTA","phone_script":"brief phone call script — opening line, 2-3 key points, natural close, under 60 seconds","follow_up_sequence":["3-touch follow-up sequence — Day 1, Day 3, Day 7 — one sentence each describing what to send"],"personal_touch":"one specific personalization tip based on the context provided","timing_tip":"best time and day to send this communication for highest response rate"}`
    );
    if(type==="objection") return(
      `{"objection_summary":"one-line summary of the core concern behind this objection","response_direct":"direct, confident response — acknowledge then reframe with data/logic, 3-4 sentences","response_empathetic":"empathetic response — lead with understanding, build trust, gentle redirect, 3-4 sentences","response_story":"story-based response — use a brief relevant client story or analogy, 3-4 sentences","follow_up_question":"one powerful follow-up question to ask after handling the objection","body_language_tip":"one tip for non-verbal delivery when handling this objection","email_version":"email/text version of the best response for a written follow-up","key_insight":"the core insight or mindset shift that makes this objection easier to handle"}`
    );
    if(type==="scripts") return(
      `{"script_title":"name of this script","opening":"strong opening statement — first 30 seconds, natural, confident","discovery_questions":["5-7 powerful discovery questions to ask"],"value_proposition":"core value prop statement tailored to this script type — 2-3 sentences","objection_preview":["3 common objections in this scenario with one-line responses"],"closing_statement":"natural closing statement or trial close — 2-3 sentences","follow_up_framework":"brief framework for following up after this conversation","pro_tip":"one pro tip for delivering this script effectively","full_script":"complete word-for-word script with stage directions in (parentheses) — conversational and natural, not robotic"}`
    );
    if(type==="mls_desc") return(
      `{"headline":"attention-grabbing property headline","mls_description":"MLS-compliant property description under 500 chars — compelling, specific, no superlatives","public_remarks":"extended public remarks up to 800 chars — paint a picture of the lifestyle","feature_highlights":["5-7 MLS feature bullets — concise, factual"],"agent_remarks":"brief agent-to-agent remarks about showing instructions or highlights","social_caption":"Instagram/Facebook caption version under 220 chars","hashtags":["10 relevant hashtags"],"posting_tip":"one tip for marketing this listing on social"}`
    );
    if(type==="open_house") return(
      `{"headline":"exciting open house headline","social_post":"Instagram/Facebook announcement post — engaging, specific date/time, creates urgency, under 300 chars","story_copy":"Instagram Story text — short punchy lines, 3-4 lines max","email_subject":"email blast subject line","email_body":"email blast body — 3 short paragraphs, personal, creates excitement","sms_text":"SMS text blast under 160 chars — date, time, address, CTA","invite_script":"30-second video invite script with camera cues for a quick phone selfie video","hashtags":["10 relevant hashtags"],"posting_tip":"one tip for maximizing open house attendance from social"}`
    );
    return(
      `{"headline":"best single hook","hooks":["exactly ${hooks} distinct hook variants"],"script":"full timed script [0:00] with (camera cues)","higgsfield_prompt":"detailed Higgsfield AI image-to-video prompt: cinematic camera moves (slow dolly in, aerial reveal, orbit), lighting mood, color grade, focus on hero shots from the uploaded photos — specific enough to render immediately","caption":"MLS-safe caption under 220 chars","hashtags":["15 hashtags"],"cta":"platform-native CTA","shot_list":["5 specific shot/scene descriptions"],"thumbnail":"thumbnail concept: composition + text overlay + color","posting_tip":"one specific ${platform} optimization tip"}`
    );
  })();

  const isNonSocial = ["mls_desc","open_house","objection","scripts","comms"].includes(type);
  const systemPrompt = isNonSocial
    ? `You are SPARK, an elite real estate AI assistant. You help agents communicate better, handle objections with confidence, and win more business. Write in a natural, conversational tone — not corporate or robotic. Return ONLY valid JSON, no markdown.`
    : `You are SPARK, an elite real estate content strategist for ${platform}. Always write MLS-compliant content. Return ONLY valid JSON, no markdown.`;

  userContent.push({ type:"text", text:
    `${voiceCtx}\n\n${typeCtx[type]}\n\n`+
    (!isNonSocial ? `Platform: ${platform} (${PLATFORMS[platform]?.spec||""}). Generate exactly ${hooks} hook variants.\n\n` : "")+
    `Return ONLY valid JSON (no markdown fences):\n${jsonSchema}`
  });

  const r = await fetch("/api/claude",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      system: systemPrompt,
      messages:[{role:"user", content:userContent}],
    }),
  });
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e?.error?.message||e?.error||`API error ${r.status}`); }
  const d=await r.json();
  const rawText = d.content?.[0]?.text || d.text || d.response || "";
  if(!rawText) throw new Error("Empty response from AI — please try again");

  // Strip markdown fences
  let cleaned = rawText.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();

  // Find JSON boundaries
  const firstBrace = cleaned.indexOf("{");
  const lastBrace  = cleaned.lastIndexOf("}");
  if(firstBrace === -1 || lastBrace === -1) throw new Error("Failed to parse AI response — please try again");
  const jsonStr = cleaned.slice(firstBrace, lastBrace+1);

  // Try direct parse first
  try{ return JSON.parse(jsonStr); } catch{}

  // Fallback: fix common issues Claude introduces
  // 1. Unescaped newlines inside string values
  // 2. Smart quotes
  // 3. Trailing commas
  try{
    const fixed = jsonStr
      .replace(/[\u2018\u2019]/g,"'")   // smart single quotes
      .replace(/[\u201C\u201D]/g,'"')   // smart double quotes
      .replace(/,\s*([}\]])/g,"$1")     // trailing commas
      .replace(/\n/g,"\\n")             // unescaped newlines
      .replace(/\r/g,"\\r")             // carriage returns
      .replace(/\t/g,"\\t");            // tabs
    return JSON.parse(fixed);
  }catch{}

  // Last resort: extract just the fields we need with regex
  try{
    const get = (key) => {
      const m = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*(?:\\\\.[^"]*)*)"`, "s"));
      return m ? m[1].replace(/\\n/g,"\n").replace(/\\"/g,'"') : "";
    };
    const getArr = (key) => {
      const m = jsonStr.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`, "s"));
      if(!m) return [];
      return m[1].match(/"([^"]*(?:\\\\.[^"]*)*)"/g)?.map(s=>s.slice(1,-1)) || [];
    };
    return {
      headline: get("headline"),
      hooks:    getArr("hooks"),
      script:   get("script"),
      higgsfield_prompt: get("higgsfield_prompt"),
      caption:  get("caption"),
      hashtags: getArr("hashtags"),
      cta:      get("cta"),
      shot_list:getArr("shot_list"),
      thumbnail:get("thumbnail"),
    };
  }catch(e){
    console.error("All parse attempts failed. Raw:", jsonStr.slice(0,300));
    throw new Error("Failed to parse AI response — please try again");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// API — HIGGSFIELD IMAGE-TO-VIDEO
// ─────────────────────────────────────────────────────────────────────────────
async function callHiggsfieldImg(imageBase64, prompt){
  const r = await fetch("/api/higgsfield",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ imageBase64, prompt }),
  });
  if(!r.ok){ const e=await r.json().catch(()=>({})); throw new Error(e?.error||`Video API error ${r.status}`); }
  return r.json();
}

async function callHiggsfieldTxt(prompt){
  const r = await fetch("/api/higgsfield",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ prompt }),
  });
  if(!r.ok) throw new Error(`Video generation error ${r.status}`);
  return r.json();
}

async function pollHiggsfield(jobId, onProgress, statusUrl){
  const MAX=90, INTERVAL=5000; // 90 × 5s = 7.5 min max
  for(let i=0;i<MAX;i++){
    await new Promise(r=>setTimeout(r,INTERVAL));
    const pct = Math.min(95, 10+(i/MAX)*85);
    onProgress(Math.round(pct));
    try{
      // Use status_url directly if available, otherwise construct it
      const pollUrl = statusUrl
        ? `/api/higgsfield-poll?statusUrl=${encodeURIComponent(statusUrl)}`
        : `/api/higgsfield-poll?jobId=${jobId}`;
      const r = await fetch(pollUrl);
      if(r.status===304) continue; // Not modified — still processing
      if(!r.ok) continue;
      const d = await r.json();

      const status = (d?.status||d?.state||"").toLowerCase();
      console.log(`Poll ${i+1}/${MAX} — status: ${status}`);

      if(status==="completed"||status==="complete"||status==="succeeded"||status==="success"||status==="done"){
        // Real Higgsfield response: { video: { url } } for image2video, { images: [{ url }] } for text2image/soul
        const videoUrl = d?.video?.url || null;
        const imageUrl = d?.images?.[0]?.url || null;
        const url = videoUrl || imageUrl || null;
        const kind = videoUrl ? "video" : (imageUrl ? "image" : null);
        console.log("Result found:", kind, url);
        return {done:true, url, kind};
      }
      if(status==="failed"||status==="error"||status==="cancelled"||status==="nsfw"){
        console.log("Video failed:", d?.error);
        return {done:true, url:null, failed:true};
      }
      // queued / processing — keep polling
    }catch(e){
      console.warn("Poll error:", e.message);
    }
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

function isIOS(){
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform==="MacIntel" && navigator.maxTouchPoints>1);
}

function DownloadButton({url, isImage}){
  const [state,setState]=useState("idle"); // idle | fetching | done | failed
  const toast=useToast();

  async function handleDownload(){
    setState("fetching");
    try{
      const resp = await fetch(url);
      if(!resp.ok) throw new Error("Fetch failed");
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const filename = isImage ? "spark-listing-image.jpg" : "spark-listing-video.mp4";

      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(blobUrl), 10000);

      setState("done");
      if(isIOS()){
        toast("Tap and hold the video above, then 'Save to Photos'","info");
      } else {
        toast(isImage?"Image downloaded":"Video downloaded");
      }
      setTimeout(()=>setState("idle"),2500);
    }catch(e){
      console.warn("Download failed:", e.message);
      setState("failed");
      toast("Download failed — tap and hold the media above to save it","error");
      setTimeout(()=>setState("idle"),2500);
    }
  }

  return(
    <button className="btn-g" onClick={handleDownload} disabled={state==="fetching"}
      style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"11px 0",borderRadius:9,cursor:state==="fetching"?"default":"pointer",fontWeight:700,fontSize:13,fontFamily:C.F,opacity:state==="fetching"?0.7:1}}>
      {state==="fetching" ? "Preparing download..." : state==="done" ? "✓ Downloaded" : `⬇ ${isImage?"Download Image":"Download Video"}`}
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
    <div className="rblock" style={{
      background:`linear-gradient(135deg,${C.surfaceUp},${C.surface})`,
      border:`1px solid ${C.border}`,
      borderRadius:13,padding:"18px 18px",marginBottom:11,
      animation:`scaleIn .26s ease ${delay}s both`,
      boxShadow:"0 2px 12px rgba(0,0,0,.2)",
      position:"relative",overflow:"hidden"}}>
      {/* Subtle accent line at top */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${accent}40,transparent)`}}/>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:13}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:3,height:14,
            background:`linear-gradient(180deg,${accent},${accent}60)`,
            borderRadius:2,boxShadow:`0 0 8px ${accent}80`}}/>
          <span style={{fontSize:9,color:accent,letterSpacing:2.2,
            fontFamily:C.F,fontWeight:700}}>{label}</span>
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
    const isImage = vidState.kind==="image";
    return(
      <div style={{animation:"scaleIn .28s ease"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:C.emerald,boxShadow:`0 0 8px ${C.emerald}`}}/>
          <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,fontWeight:700}}>
            {isImage ? `HERO IMAGE READY · ${videoQuality}` : `LISTING VIDEO READY · ${videoQuality}`}
          </span>
        </div>
        {isImage && (
          <div style={{background:"rgba(245,158,11,.06)",border:"1px solid rgba(245,158,11,.15)",borderRadius:8,padding:"9px 13px",marginBottom:12,fontSize:12,color:"#f59e0b",fontFamily:C.F}}>
            ⚠ Video render unavailable — showing the generated still image instead.
          </div>
        )}
        <div style={{borderRadius:12,overflow:"hidden",background:"#000",marginBottom:12,boxShadow:"0 12px 40px rgba(0,0,0,.5)"}}>
          {isImage
            ? <img src={vidState.url} alt="Generated listing visual" style={{width:"100%",maxHeight:420,display:"block",objectFit:"cover"}}/>
            : <video src={vidState.url} controls playsInline style={{width:"100%",maxHeight:420,display:"block"}}/>
          }
        </div>
        <DownloadButton url={vidState.url} isImage={isImage}/>
        <div style={{display:"flex",gap:8,marginTop:8}}>
          <CopyBtn text={vidState.url} label={isImage?"Image URL copied":"Video URL copied"}/>
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
// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI PARTICLES — celebration burst on generation complete
// ─────────────────────────────────────────────────────────────────────────────
function ConfettiParticles(){
  const COLORS=["#6366f1","#8b5cf6","#10b981","#22d3ee","#f59e0b","#f43f5e","#818cf8"];
  const particles=Array.from({length:22},(_,i)=>{
    const angle=Math.random()*360;
    const dist=60+Math.random()*80;
    const px=Math.cos(angle*Math.PI/180)*dist;
    const py=-(50+Math.random()*100);
    return {id:i,color:COLORS[i%COLORS.length],
      left:`${20+Math.random()*60}%`,
      size:4+Math.random()*5,
      delay:Math.random()*.4,
      dur:.8+Math.random()*.6,
      px,py};
  });
  return(
    <div style={{position:"absolute",top:0,left:0,right:0,height:0,
      pointerEvents:"none",zIndex:50,overflow:"visible"}}>
      {particles.map(p=>(
        <div key={p.id} style={{
          position:"absolute",top:0,left:p.left,
          width:p.size,height:p.size,
          borderRadius:p.size>6?"50%":"2px",
          background:p.color,
          "--px":`${p.px}px`,"--py":`${p.py}px`,
          animation:`particle ${p.dur}s ease ${p.delay}s both`,
          boxShadow:`0 0 4px ${p.color}88`}}/>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE CARD — shown before first generation, per content type
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_STATE_DEMOS={
  listing:{
    headline:"\"This $4.2M Miami Beach estate just hit the market\"",
    lines:["[0:00] Slow drone descent over rooftop terrace at golden hour...","[0:08] Ground-level dolly toward the glass entry facade...","[0:15] Interior reveal — floating staircase, ocean views..."],
    label:"SAMPLE SCRIPT PREVIEW",color:C.indigo,
    hint:"Upload listing photos and SPARK generates a cinematic video + full script",
  },
  mls_desc:{
    headline:"\"Architectural masterpiece meets coastal living\"",
    lines:["MLS Description: Perched above Biscayne Bay, this 5BR/7BA...","Public Remarks: Every detail curated for the discerning buyer...","Feature Highlights: Wolf appliances · 40ft rooftop pool · Smart home"],
    label:"SAMPLE MLS DESCRIPTION",color:C.amber,
    hint:"Enter listing details and SPARK writes MLS-compliant copy in seconds",
  },
  open_house:{
    headline:"\"Saturday 1-4PM — You need to see this in person\"",
    lines:["📱 Social: Come see this beauty before it's gone...","📧 Email: Dear [Name], I wanted to personally invite you...","💬 SMS: Open house this Saturday 1-4PM — 123 Ocean Dr. See you there?"],
    label:"SAMPLE OPEN HOUSE PACKAGE",color:C.emerald,
    hint:"Enter date and time and SPARK builds your full marketing kit instantly",
  },
  objection:{
    headline:"\"The market is too uncertain, I want to wait\"",
    lines:["Direct: I understand completely — here's what the data shows...","Empathetic: That concern makes total sense given what you're seeing...","Story: A client told me the exact same thing last spring, and here's what happened..."],
    label:"SAMPLE OBJECTION RESPONSES",color:C.violet,
    hint:"Enter any client objection and get 3 tailored responses instantly",
  },
  scripts:{
    headline:"Listing Appointment Script",
    lines:["Opening: \"Thank you so much for having me in your home today...\"","Discovery: \"What's most important to you in the agent you choose?\"","Close: \"I'd love the opportunity to earn your trust — can we move forward?\""],
    label:"SAMPLE LISTING APPOINTMENT SCRIPT",color:C.cyan,
    hint:"Select a script type and SPARK generates a full word-for-word dialogue",
  },
  comms:{
    headline:"Post-Showing Follow-Up",
    lines:["Subject: Great to show you 123 Ocean Drive today, [Name]","Body: It was wonderful walking through the property with you...","Text: Hey [Name]! Thanks for the tour today — any questions? 🏡"],
    label:"SAMPLE CLIENT COMMUNICATION",color:"#f43f5e",
    hint:"Enter context and SPARK writes personalized email, text, and phone scripts",
  },
  education:{
    headline:"\"3 things every buyer should know before making an offer\"",
    lines:["Hook: Most agents won't tell you this...","Script: The #1 mistake buyers make in a competitive market is...","CTA: Save this for your clients — they need to hear it"],
    label:"SAMPLE AGENT TIP",color:C.amber,
    hint:"Enter your topic and SPARK creates an authority-building tip for social",
  },
  market:{
    headline:"\"Miami Beach real estate just shifted — here's what it means\"",
    lines:["Avg days on market dropped 18% this month","New listings up 12% — buyers finally have options","Hook: The market just changed and most agents don't know it yet"],
    label:"SAMPLE MARKET UPDATE",color:C.cyan,
    hint:"Enter local market stats and SPARK turns them into viral social content",
  },
  lifestyle:{
    headline:"\"Why Brickell is the most underrated neighborhood in Miami\"",
    lines:["Hook: Nobody talks about this, but Brickell has secretly become...","Script: For the buyer who wants walkability, culture, and luxury...","CTA: DM me if you want to see what's available right now"],
    label:"SAMPLE NEIGHBORHOOD STORY",color:C.emerald,
    hint:"Enter neighborhood details and SPARK creates relocator-focused content",
  },
};

function EmptyStateCard({type, contentTypes}){
  const demo = EMPTY_STATE_DEMOS[type] || EMPTY_STATE_DEMOS.listing;
  const ct   = contentTypes[type];
  return(
    <div style={{marginTop:16,borderRadius:14,overflow:"hidden",
      border:`1px solid ${demo.color}22`,
      background:`linear-gradient(160deg,${demo.color}08,${demo.color}03,transparent)`,
      animation:"fadeUp .4s ease .1s both",position:"relative"}}>

      {/* Top label */}
      <div style={{padding:"11px 16px",borderBottom:`1px solid ${demo.color}18`,
        display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:3,height:12,borderRadius:2,
          background:`linear-gradient(180deg,${demo.color},${demo.color}60)`,
          boxShadow:`0 0 6px ${demo.color}80`}}/>
        <span style={{fontSize:8,color:demo.color,fontFamily:C.F,
          fontWeight:700,letterSpacing:2.5}}>{demo.label}</span>
        <span style={{marginLeft:"auto",fontSize:9,color:C.textDim,
          fontFamily:C.F,fontStyle:"italic"}}>example output</span>
      </div>

      {/* Demo content */}
      <div className="demo-card" style={{padding:"16px 16px 14px"}}>
        {/* Headline */}
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,
          color:C.text,marginBottom:12,lineHeight:1.4,
          opacity:.9}}>
          {demo.headline}
        </div>

        {/* Preview lines */}
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {demo.lines.map((line,i)=>(
            <div key={i} style={{
              display:"flex",alignItems:"flex-start",gap:8,
              animation:`fadeUp .35s ease ${.08+i*.1}s both`}}>
              <div style={{minWidth:3,height:3,borderRadius:"50%",
                background:demo.color,marginTop:7,flexShrink:0,opacity:.6}}/>
              <span style={{fontFamily:C.F,fontSize:11,color:C.textMd,
                lineHeight:1.55,opacity:.85}}>{line}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom hint */}
      <div style={{padding:"10px 16px",
        background:"rgba(255,255,255,.018)",
        borderTop:`1px solid ${C.border}`,
        display:"flex",alignItems:"center",gap:6}}>
        <span style={{fontSize:10,fontFamily:C.F,fontWeight:600,
          color:demo.color,opacity:.7}}>⚡</span>
        <span style={{fontSize:10,color:C.textDim,fontFamily:C.F,
          lineHeight:1.4}}>{demo.hint}</span>
      </div>

      {/* Blur overlay — makes it look like a teaser/preview */}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:60,
        background:`linear-gradient(transparent,${C.bg}cc)`,
        pointerEvents:"none"}}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function GeneratePanel({planKey,voice,credits,setCredits,apiKeys,onGoUpgrade,onGoSettings,user}){
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
  const [justCompleted,setJustCompleted]=useState(false);
  const genRef              =useRef(false);

  useEffect(()=>LS.set("sp_type",type),[type]);
  useEffect(()=>LS.set("sp_plat",platform),[platform]);
  useEffect(()=>LS.set("sp_inputs",inputs),[inputs]);
  useEffect(()=>{ if(!plan.contentTypes.includes(type)) setType("listing"); if(!plan.platforms.includes(platform)) setPlatform("TikTok"); },[planKey]);
  useEffect(()=>{ setResult(null); setVid(null); },[type,platform]);

  const typeLocked     = !plan.contentTypes.includes(type);
  const platformLocked = !plan.platforms.includes(platform);
  const cost           = CONTENT_TYPES[type]?.cost||2;
  const canGen         = credits>=cost && !typeLocked && !platformLocked;
  const showPhotoUpload = type==="listing";
  const showPlatform    = !["mls_desc","open_house","objection","scripts","comms"].includes(type);

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
    if(credits<cost){ track("credits_exhausted", { plan:planKey, credits, cost, content_type:type }); onGoUpgrade(); toast("Add credits to generate more content","info"); return; }
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
      track("generation_completed", { content_type:type, platform, plan:planKey, cost, photo_count:photos.length });
      // Fire celebration moment
      setJustCompleted(true);
      setTimeout(()=>setJustCompleted(false), 3000);

      // Deduct credits server-side (bypasses RLS, persists reliably)
      try{
        const resp = await fetch('/api/deduct-credits', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ email: user.email, cost })
        });
        const data = await resp.json();
        if(resp.ok && typeof data.credits === 'number'){
          setCredits(data.credits);
          LS.set("sp_credits", data.credits);
        } else {
          console.warn("Credit deduction failed:", data.error);
          // Fallback: optimistic local update so UI doesn't desync mid-session
          setCredits(c=>{ const n=c-cost; LS.set("sp_credits",n); return n; });
        }
      }catch(e){
        console.warn("Credit deduction request failed:", e.message);
        setCredits(c=>{ const n=c-cost; LS.set("sp_credits",n); return n; });
      }
      toast("Content package ready ✓");

      // Trigger Higgsfield video generation — multi-clip if multiple photos
      // Each photo generates one 5s clip in parallel; clips are stitched into one final video
      // A video error NEVER affects the content package
      if(type==="listing"){
        (async()=>{
          try{
            const photoList = photos.filter(p=>p?.b64);
            const basePrompt = content.higgsfield_prompt || `Cinematic listing video for ${inputs.address||"the property"}. Slow dolly-in reveal, warm golden hour lighting, luxury real estate aesthetic.`;

            // Scene-specific prompts per photo (use Claude's array if provided, else reuse base prompt)
            const scenePrompts = Array.isArray(content.higgsfield_prompts)
              ? content.higgsfield_prompts
              : photoList.map((_,i) => `${basePrompt} Scene ${i+1}: ${["slow aerial reveal","ground-level dolly forward","interior wide shot","pool edge dolly-in","detail close-up shot"][i] || "cinematic reveal"}.`);

            if(photoList.length <= 1){
              // Single photo — original single-clip flow (unchanged)
              setVid({status:"generating",pct:5});
              const heroB64 = photoList[0]?.b64 || null;
              const prompt = scenePrompts[0] || basePrompt;
              let job;
              if(heroB64){
                setStage("Rendering cinematic video...");
                job = await callHiggsfieldImg(heroB64, prompt);
              } else {
                job = await callHiggsfieldTxt(prompt);
              }
              const jobId = job?.request_id || job?.id || job?.job_id || job?.data?.id || job?.data?.request_id;
              const statusUrl = job?.status_url || null;
              console.log("Single clip job:", jobId);
              if(jobId){
                pollHiggsfield(jobId,(pct)=>{
                  setVid(v=>v?.status==="generating"?{status:"generating",pct}:v);
                }, statusUrl).then(res=>{
                  if(res?.url) setVid({status:"ready", url:res.url, kind:res.kind||"video"});
                  else setVid({status:"failed"});
                }).catch(()=>setVid({status:"prompt"}));
              } else {
                setVid({status:"prompt"});
              }
            } else {
              // Multi-photo — fire all clips in parallel, stitch when all complete
              const clipCount = Math.min(photoList.length, plan.maxPhotos, 6);
              setVid({status:"generating",pct:5});
              setStage(`Generating ${clipCount} cinematic clips...`);

              // Fire all generation jobs simultaneously
              const jobPromises = photoList.slice(0, clipCount).map((photo, i) =>
                callHiggsfieldImg(photo.b64, scenePrompts[i] || basePrompt)
                  .catch(e => { console.warn(`Clip ${i} job failed:`, e.message); return null; })
              );
              const jobs = await Promise.all(jobPromises);
              console.log(`Fired ${jobs.length} Higgsfield jobs`);

              // Extract job IDs and status URLs
              const jobMeta = jobs.map((job,i) => ({
                idx: i,
                jobId: job?.request_id || job?.id || job?.job_id || job?.data?.id || null,
                statusUrl: job?.status_url || null,
              })).filter(m => m.jobId);

              if(jobMeta.length === 0){
                setVid({status:"prompt"}); return;
              }

              setStage(`Rendering ${jobMeta.length} clips — this takes ~2 minutes...`);

              // Poll all jobs in parallel, collecting clip URLs as they complete
              const clipUrls = new Array(jobMeta.length).fill(null);
              let completed = 0;

              await Promise.all(jobMeta.map(({idx, jobId, statusUrl}) =>
                pollHiggsfield(jobId, (pct) => {
                  // Average progress across all clips
                  const avgPct = Math.round(10 + (pct * 0.8));
                  setVid(v => v?.status==="generating" ? {status:"generating", pct:avgPct} : v);
                }, statusUrl).then(res => {
                  if(res?.url){
                    clipUrls[idx] = res.url;
                    completed++;
                    console.log(`Clip ${idx} ready (${completed}/${jobMeta.length}): ${res.url}`);
                    setStage(`${completed} of ${jobMeta.length} clips ready — stitching soon...`);
                  }
                }).catch(e => console.warn(`Clip ${idx} poll failed:`, e.message))
              ));

              const readyUrls = clipUrls.filter(Boolean);
              console.log(`${readyUrls.length} clips ready for stitching`);

              if(readyUrls.length === 0){
                setVid({status:"failed"}); return;
              }

              if(readyUrls.length === 1){
                // Only one clip succeeded — use it directly, no stitch needed
                setVid({status:"ready", url:readyUrls[0], kind:"video"});
                return;
              }

              // Stitch all clips into one final video
              setStage("Stitching clips into final listing video...");
              setVid({status:"generating", pct:92});

              try{
                const stitchRes = await fetch("/api/stitch", {
                  method: "POST",
                  headers: {"Content-Type":"application/json"},
                  body: JSON.stringify({ clipUrls: readyUrls }),
                });
                const stitchData = await stitchRes.json();
                if(stitchRes.ok && stitchData.url){
                  console.log(`Final video (${stitchData.clips} clips):`, stitchData.url);
                  setVid({status:"ready", url:stitchData.url, kind:"video"});
                } else {
                  // Stitch failed — serve first clip as fallback
                  console.warn("Stitch failed, using first clip:", stitchData.error);
                  setVid({status:"ready", url:readyUrls[0], kind:"video"});
                }
              }catch(stitchErr){
                console.warn("Stitch request failed:", stitchErr.message);
                setVid({status:"ready", url:readyUrls[0], kind:"video"});
              }
            }
          }catch(e){
            console.warn("Video generation failed (non-critical):", e.message);
            setVid({status:"prompt"});
          }
        })();
      }

    }catch(e){
      toast(e.message||"Generation failed — please try again","error");
    }finally{
      genRef.current=false;
      setGen(false); setStage(""); setPct(0);
    }
  }

  const TABS = type==="mls_desc"
    ? ["description","remarks","features","social"]
    : type==="open_house"
    ? ["social","email","sms","invite"]
    : type==="objection"
    ? ["responses","followup","email","insight"]
    : type==="scripts"
    ? ["full_script","questions","objections","tips"]
    : type==="comms"
    ? ["email","text","phone","sequence"]
    : ["script","hooks","caption","video","shots"];

  return(
    <div style={{animation:"fadeUp .38s ease"}}>

      {/* Content type selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:20}}>
        {Object.entries(CONTENT_TYPES).map(([k,ct],i)=>{
          const locked=!plan.contentTypes.includes(k);
          const active=type===k;
          return(
            <div key={k} className="card-h" onClick={()=>locked?onGoUpgrade():setType(k)}
              data-locked={locked}
              style={{
                padding:"16px 13px",borderRadius:13,
                textAlign:"left",position:"relative",
                border:`1px solid ${active?ct.color+"55":locked?"rgba(255,255,255,.04)":C.border}`,
                background:active
                  ?`linear-gradient(135deg,${ct.color}10,${ct.color}04)`
                  :locked?"rgba(255,255,255,.01)":C.surface,
                opacity:locked?.5:1,cursor:"pointer",
                animation:`fadeUp .32s ease ${i*.05}s both`,
                boxShadow:active?`0 4px 16px ${ct.color}18,inset 0 0 0 1px ${ct.color}20`:"none",
                transition:"all .18s ease"}}>
              {locked&&(
                <div style={{position:"absolute",top:8,right:8,
                  background:"rgba(245,158,11,.1)",
                  border:"1px solid rgba(245,158,11,.24)",
                  borderRadius:5,padding:"1px 6px",
                  fontSize:7,color:C.amber,fontWeight:700,fontFamily:C.F,letterSpacing:.5}}>
                  {PLANS[ct.minPlan].name.toUpperCase()}+
                </div>
              )}
              {/* Icon with accent background */}
              <div style={{
                width:34,height:34,borderRadius:8,
                background:active?`${ct.color}18`:"rgba(255,255,255,.04)",
                border:`1px solid ${active?ct.color+"30":"rgba(255,255,255,.06)"}`,
                display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:16,marginBottom:10,transition:"all .18s"}}>
                {ct.icon}
              </div>
              <div style={{fontSize:11,fontWeight:700,
                color:active?ct.color:locked?C.textDim:C.text,
                fontFamily:C.F,marginBottom:3,letterSpacing:.2}}>
                {ct.label}
              </div>
              <div style={{fontSize:10,color:C.textDim,lineHeight:1.45,
                fontFamily:C.F,marginBottom:10}}>
                {ct.desc}
              </div>
              <Badge color={locked?C.amber:active?ct.color:"rgba(255,255,255,.2)"}>
                {locked?`${PLANS[ct.minPlan].name}+`:`${ct.cost} CR`}
              </Badge>
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

            {/* Platform — hidden for non-social types */}
            {showPlatform&&(
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
            )}

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
            <button className="btn-g gen-btn-animated" onClick={generate} disabled={!canGen}
              style={{
                width:"100%",
                background:canGen
                  ?"linear-gradient(135deg,#6366f1,#8b5cf6,#6366f1)"
                  :C.surface,
                backgroundSize:"200% 200%",
                border:canGen?"none":`1px solid ${C.border}`,
                color:canGen?"#fff":C.textDim,
                padding:"16px 0",borderRadius:12,
                cursor:canGen?"pointer":"not-allowed",
                fontFamily:C.F,fontWeight:800,fontSize:15,
                letterSpacing:.3,
                boxShadow:canGen?"0 6px 24px rgba(99,102,241,.3),0 0 0 1px rgba(99,102,241,.3)":"none",
                transition:"all .22s cubic-bezier(.34,1.56,.64,1)",
              }}>
              {credits<=0
                ? "⚡ Add Credits to Continue"
                : credits<cost
                ? `Need ${cost} credits — Add More`
                : `⚡ Generate ${CONTENT_TYPES[type].label} — ${cost} Credits`}
            </button>
          ):(
            <div style={{
              background:`linear-gradient(135deg,${C.surface},rgba(99,102,241,.04))`,
              border:`1px solid rgba(99,102,241,.18)`,
              borderRadius:14,padding:"28px 22px",
              textAlign:"center",animation:"fadeIn .2s ease",
              boxShadow:"0 8px 32px rgba(99,102,241,.08)"}}>
              <div style={{position:"relative",width:60,height:60,margin:"0 auto 16px"}}>
                <ProgressRing pct={pct}/>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:11,color:C.indigoLt,
                  fontFamily:C.F,fontWeight:800}}>{pct}%</div>
              </div>
              <p style={{color:C.text,fontSize:13,fontFamily:C.F,fontWeight:600,margin:"0 0 6px"}}>{stage||"Generating..."}</p>
              <p style={{color:C.textDim,fontSize:11,fontFamily:C.F,margin:"0 0 14px"}}>This may take up to 2 minutes for video</p>
              <div style={{display:"flex",justifyContent:"center",gap:6}}>
                {[0,1,2].map(i=>(
                  <div key={i} style={{width:6,height:6,borderRadius:"50%",
                    background:C.indigoLt,opacity:.7,
                    animation:`pulse 1.2s ease ${i*.22}s infinite`}}/>
                ))}
              </div>
            </div>
          )}

          {/* Empty state — shown before first generation */}
          {!result&&!gen&&(
            <EmptyStateCard type={type} contentTypes={CONTENT_TYPES}/>
          )}

          {/* Results */}
          {result&&(
            <div style={{marginTop:22,position:"relative"}}>

              {/* Confetti burst on completion */}
              {justCompleted&&<ConfettiParticles/>}

              {/* PACKAGE READY header */}
              <div style={{
                display:"flex",alignItems:"center",gap:9,
                marginBottom:14,flexWrap:"wrap",
                animation:justCompleted?"celebPop .5s cubic-bezier(.34,1.56,.64,1) both":"fadeUp .28s ease"}}>
                <div style={{
                  display:"flex",alignItems:"center",gap:7,
                  background:justCompleted
                    ?"linear-gradient(135deg,rgba(16,185,129,.15),rgba(16,185,129,.06))"
                    :"rgba(16,185,129,.06)",
                  border:`1px solid ${justCompleted?"rgba(16,185,129,.5)":"rgba(16,185,129,.2)"}`,
                  borderRadius:8,padding:"5px 11px",
                  boxShadow:justCompleted?"0 0 0 0 rgba(16,185,129,.6)":"none",
                  animation:justCompleted?"glowRing 1s ease .3s both":"none",
                  transition:"all .3s ease"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",
                    background:C.emerald,
                    boxShadow:`0 0 ${justCompleted?"10px":"6px"} ${C.emerald}`,
                    animation:justCompleted?"pulse .6s ease infinite":"none"}}/>
                  <span style={{fontSize:11,color:C.emerald,fontFamily:C.F,
                    fontWeight:800,letterSpacing:.5}}>
                    {justCompleted?"✦ PACKAGE READY":"PACKAGE READY"}
                  </span>
                </div>
                {showPlatform&&<Badge color={PLATFORMS[platform]?.color||C.indigo}>{platform}</Badge>}
                <Badge color={CONTENT_TYPES[type].color}>{CONTENT_TYPES[type].label}</Badge>
                {vidState?.status==="generating"&&<Badge color={C.cyan}>🎬 RENDERING…</Badge>}
                {vidState?.status==="ready"&&<Badge color={C.emerald}>🎬 VIDEO READY</Badge>}
              </div>

              {/* Tab bar — premium pill style */}
              <div style={{display:"flex",background:"rgba(255,255,255,.025)",
                border:`1px solid ${C.border}`,
                borderRadius:10,padding:3,marginBottom:14,gap:2}}>
                {TABS.map(t=>{
                  const active=tab===t;
                  const dot = t==="video"&&vidState?.status==="generating";
                  const done = t==="video"&&vidState?.status==="ready";
                  return(
                    <button key={t} className={`tab-b${active?" active-tab":""}`}
                      onClick={()=>setTab(t)}
                      style={{flex:1,padding:"8px 4px",borderRadius:7,
                        border:`1px solid ${active?"rgba(99,102,241,.28)":"transparent"}`,
                        background:active
                          ?"linear-gradient(135deg,rgba(99,102,241,.14),rgba(139,92,246,.08))"
                          :"transparent",
                        color:active?C.indigoLt:C.textDim,
                        cursor:"pointer",fontSize:9,fontWeight:700,
                        fontFamily:C.F,letterSpacing:.8,
                        boxShadow:active?"0 2px 8px rgba(99,102,241,.15)":"none",
                        position:"relative",
                        transition:"all .16s ease"}}>
                      {t.replace(/_/g," ").toUpperCase()}
                      {dot&&<span style={{position:"absolute",top:3,right:3,width:5,height:5,
                        borderRadius:"50%",background:C.cyan,
                        animation:"pulse 1.2s ease infinite"}}/>}
                      {done&&<span style={{position:"absolute",top:3,right:3,width:5,height:5,
                        borderRadius:"50%",background:C.emerald,
                        boxShadow:`0 0 5px ${C.emerald}`}}/>}
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
                    hasHiggsfieldKey={true}
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

              {/* ── MLS DESCRIPTION TABS ── */}
              {tab==="description"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.amber} label="HEADLINE" action={<CopyBtn text={result.headline||""} label="Headline copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:16,fontWeight:700,color:C.text,margin:0,lineHeight:1.5}}>"{result.headline}"</p>
                  </RBlock>
                  <RBlock accent={C.indigo} label="MLS DESCRIPTION" action={<CopyBtn text={result.mls_description||""} label="MLS description copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{result.mls_description}</p>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginTop:8}}>{(result.mls_description||"").length} / 500 chars</div>
                  </RBlock>
                </div>
              )}
              {tab==="remarks"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.cyan} label="PUBLIC REMARKS" action={<CopyBtn text={result.public_remarks||""} label="Remarks copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{result.public_remarks}</p>
                  </RBlock>
                  <RBlock accent={C.violet} label="AGENT REMARKS" action={<CopyBtn text={result.agent_remarks||""} label="Agent remarks copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7}}>{result.agent_remarks}</p>
                  </RBlock>
                </div>
              )}
              {tab==="features"&&(
                <RBlock accent={C.emerald} label="FEATURE HIGHLIGHTS">
                  {(result.feature_highlights||[]).map((f,i)=>(
                    <div key={i} style={{display:"flex",gap:11,padding:"10px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .2s ease ${i*.04}s both`}}>
                      <div style={{minWidth:6,height:6,borderRadius:"50%",background:C.emerald,marginTop:7,flexShrink:0}}/>
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5}}>{f}</p>
                      <CopyBtn text={f} label="Copied"/>
                    </div>
                  ))}
                </RBlock>
              )}
              {tab==="social"&&type==="mls_desc"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.indigo} label="SOCIAL CAPTION" action={<CopyBtn text={result.social_caption||""} label="Caption copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7}}>{result.social_caption}</p>
                  </RBlock>
                  <RBlock accent={C.cyan} label="HASHTAGS" action={<CopyBtn text={(result.hashtags||[]).join(" ")} label="Hashtags copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,margin:0,lineHeight:1.8}}>{(result.hashtags||[]).join(" ")}</p>
                  </RBlock>
                  {result.posting_tip&&<RBlock accent={C.amber} label="POSTING TIP"><p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6}}>{result.posting_tip}</p></RBlock>}
                </div>
              )}

              {/* ── OPEN HOUSE TABS ── */}
              {tab==="social"&&type==="open_house"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.indigo} label="HEADLINE" action={<CopyBtn text={result.headline||""} label="Headline copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:16,fontWeight:700,color:C.text,margin:0,lineHeight:1.5}}>"{result.headline}"</p>
                  </RBlock>
                  <RBlock accent={C.emerald} label="SOCIAL ANNOUNCEMENT POST" action={<CopyBtn text={result.social_post||""} label="Post copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{result.social_post}</p>
                  </RBlock>
                  <RBlock accent={C.violet} label="INSTAGRAM STORY COPY" action={<CopyBtn text={result.story_copy||""} label="Story copy copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{result.story_copy}</p>
                  </RBlock>
                  <RBlock accent={C.cyan} label="HASHTAGS" action={<CopyBtn text={(result.hashtags||[]).join(" ")} label="Hashtags copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,margin:0,lineHeight:1.8}}>{(result.hashtags||[]).join(" ")}</p>
                  </RBlock>
                </div>
              )}
              {tab==="email"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.amber} label="EMAIL SUBJECT" action={<CopyBtn text={result.email_subject||""} label="Subject copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,margin:0}}>{result.email_subject}</p>
                  </RBlock>
                  <RBlock accent={C.indigo} label="EMAIL BODY" action={<CopyBtn text={result.email_body||""} label="Email copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.email_body}</p>
                  </RBlock>
                </div>
              )}
              {tab==="sms"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.cyan} label="SMS TEXT BLAST" action={<CopyBtn text={result.sms_text||""} label="SMS copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,lineHeight:1.7,fontWeight:600}}>{result.sms_text}</p>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginTop:8}}>{(result.sms_text||"").length} / 160 chars</div>
                  </RBlock>
                  {result.posting_tip&&<RBlock accent={C.amber} label="POSTING TIP"><p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6}}>{result.posting_tip}</p></RBlock>}
                </div>
              )}
              {tab==="invite"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.violet} label="30-SECOND INVITE VIDEO SCRIPT" action={<CopyBtn text={result.invite_script||""} label="Script copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.invite_script}</p>
                  </RBlock>
                </div>
              )}

              {/* ── OBJECTION HANDLER TABS ── */}
              {tab==="responses"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.violet} label="CORE CONCERN" action={<CopyBtn text={result.objection_summary||""} label="Copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6,fontStyle:"italic"}}>"{result.objection_summary}"</p>
                  </RBlock>
                  <RBlock accent={C.indigo} label="DIRECT RESPONSE" action={<CopyBtn text={result.response_direct||""} label="Response copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.response_direct}</p>
                  </RBlock>
                  <RBlock accent={C.emerald} label="EMPATHETIC RESPONSE" action={<CopyBtn text={result.response_empathetic||""} label="Response copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.response_empathetic}</p>
                  </RBlock>
                  <RBlock accent={C.amber} label="STORY-BASED RESPONSE" action={<CopyBtn text={result.response_story||""} label="Response copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.response_story}</p>
                  </RBlock>
                </div>
              )}
              {tab==="followup"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.cyan} label="POWERFUL FOLLOW-UP QUESTION" action={<CopyBtn text={result.follow_up_question||""} label="Question copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:15,fontWeight:700,color:C.text,margin:0,lineHeight:1.6}}>"{result.follow_up_question}"</p>
                  </RBlock>
                  <RBlock accent={C.violet} label="BODY LANGUAGE TIP">
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7}}>{result.body_language_tip}</p>
                  </RBlock>
                </div>
              )}
              {tab==="email"&&type==="objection"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.indigo} label="EMAIL / TEXT VERSION" action={<CopyBtn text={result.email_version||""} label="Email version copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.email_version}</p>
                  </RBlock>
                </div>
              )}
              {tab==="insight"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.amber} label="KEY INSIGHT">
                    <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,lineHeight:1.8,fontWeight:600}}>{result.key_insight}</p>
                  </RBlock>
                </div>
              )}

              {/* ── SCRIPTS & DIALOGUES TABS ── */}
              {tab==="full_script"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.cyan} label={result.script_title||"FULL SCRIPT"} action={<CopyBtn text={result.full_script||""} label="Script copied"/>}>
                    <div style={{marginBottom:12}}>
                      <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1,marginBottom:6}}>OPENING</div>
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,borderLeft:`2px solid ${C.cyan}`,paddingLeft:12}}>{result.opening}</p>
                    </div>
                    <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1,marginBottom:6,marginTop:14}}>FULL SCRIPT</div>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{result.full_script}</p>
                  </RBlock>
                  <RBlock accent={C.emerald} label="CLOSING STATEMENT" action={<CopyBtn text={result.closing_statement||""} label="Closing copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8}}>{result.closing_statement}</p>
                  </RBlock>
                </div>
              )}
              {tab==="questions"&&(
                <RBlock accent={C.indigo} label="DISCOVERY QUESTIONS">
                  {(result.discovery_questions||[]).map((q,i)=>(
                    <div key={i} style={{display:"flex",gap:11,padding:"11px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .2s ease ${i*.04}s both`}}>
                      <div style={{minWidth:27,height:27,borderRadius:"50%",background:`rgba(99,102,241,.07)`,border:`1px solid rgba(99,102,241,.2)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:C.indigo,fontFamily:C.F,fontWeight:700,flexShrink:0}}>{i+1}</div>
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5,alignSelf:"center",fontStyle:"italic"}}>"{q}"</p>
                      <CopyBtn text={q} label="Copied"/>
                    </div>
                  ))}
                </RBlock>
              )}
              {tab==="objections"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.amber} label="COMMON OBJECTIONS IN THIS SCENARIO">
                    {(result.objection_preview||[]).map((o,i)=>(
                      <div key={i} style={{padding:"11px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .2s ease ${i*.06}s both`}}>
                        <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:"0 0 5px",fontWeight:600}}>{o}</p>
                      </div>
                    ))}
                  </RBlock>
                </div>
              )}
              {tab==="tips"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.violet} label="PRO TIP">
                    <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,lineHeight:1.8,fontWeight:600}}>{result.pro_tip}</p>
                  </RBlock>
                  <RBlock accent={C.cyan} label="FOLLOW-UP FRAMEWORK" action={<CopyBtn text={result.follow_up_framework||""} label="Framework copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{result.follow_up_framework}</p>
                  </RBlock>
                  <RBlock accent={C.emerald} label="VALUE PROPOSITION" action={<CopyBtn text={result.value_proposition||""} label="Value prop copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8}}>{result.value_proposition}</p>
                  </RBlock>
                </div>
              )}

              {/* ── CLIENT COMMUNICATION TABS ── */}
              {tab==="email"&&type==="comms"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={"#f43f5e"} label="SUBJECT LINE" action={<CopyBtn text={result.subject_line||""} label="Subject copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,margin:0}}>{result.subject_line}</p>
                  </RBlock>
                  <RBlock accent={C.indigo} label="EMAIL" action={<CopyBtn text={result.email_body||""} label="Email copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{result.email_body}</p>
                  </RBlock>
                  {result.timing_tip&&(
                    <RBlock accent={C.amber} label="TIMING TIP">
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6}}>{result.timing_tip}</p>
                    </RBlock>
                  )}
                </div>
              )}
              {tab==="text"&&type==="comms"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.emerald} label="TEXT / SMS" action={<CopyBtn text={result.text_version||""} label="Text copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:14,color:C.text,margin:0,lineHeight:1.8,fontWeight:600}}>{result.text_version}</p>
                    <div style={{fontSize:11,color:C.textDim,fontFamily:C.F,marginTop:8}}>{(result.text_version||"").length} / 160 chars</div>
                  </RBlock>
                  {result.personal_touch&&(
                    <RBlock accent={"#f43f5e"} label="PERSONALIZATION TIP">
                      <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6}}>{result.personal_touch}</p>
                    </RBlock>
                  )}
                </div>
              )}
              {tab==="phone"&&type==="comms"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.cyan} label="PHONE SCRIPT" action={<CopyBtn text={result.phone_script||""} label="Script copied"/>}>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.9,whiteSpace:"pre-wrap"}}>{result.phone_script}</p>
                  </RBlock>
                </div>
              )}
              {tab==="sequence"&&type==="comms"&&(
                <div style={{animation:"scaleIn .22s ease"}}>
                  <RBlock accent={C.violet} label="3-TOUCH FOLLOW-UP SEQUENCE">
                    {(result.follow_up_sequence||[]).map((touch,i)=>(
                      <div key={i} style={{display:"flex",gap:12,padding:"13px 0",borderBottom:`1px solid ${C.border}`,animation:`slideR .2s ease ${i*.06}s both`}}>
                        <div style={{minWidth:52,height:28,borderRadius:6,background:"rgba(139,92,246,.08)",border:"1px solid rgba(139,92,246,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.violet,fontFamily:C.F,fontWeight:700,flexShrink:0,letterSpacing:.5}}>
                          {["DAY 1","DAY 3","DAY 7"][i]||`DAY ${[1,3,7][i]}`}
                        </div>
                        <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5,alignSelf:"center"}}>{touch}</p>
                        <CopyBtn text={touch} label="Copied"/>
                      </div>
                    ))}
                  </RBlock>
                </div>
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
  const planEntries=Object.entries(PLANS).filter(([k])=>k!=="trial");
  const POP_IDX=1; // index 1 = Pro in [agent, pro, team]
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
function BillingPanel({planKey,setPlanKey,credits,setCredits,userEmail,user,intendedPlan}){
  const plan=PLANS[planKey];
  const toast=useToast();
  const [confirmKey,setConfirmKey]=useState(null);
  const isTrial = planKey==="trial";
  const trialExhausted = isTrial && credits<=0;

  function doUpgrade(k){
    if(k===planKey) return;
    if(isTrial){
      // Trial users have no real subscription yet — any plan selection goes to Stripe
      setConfirmKey(k);
      return;
    }
    if(planRank(k)<planRank(planKey)){
      const nc=PLANS[k].credits;
      setPlanKey(k); LS.set("sp_plan",k);
      setCredits(nc); LS.set("sp_credits",nc);
      // Persist downgrade server-side (bypasses RLS)
      fetch('/api/update-plan', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email: user?.email, plan: k, credits: nc })
      }).then(r=>r.json()).then(data=>{
        if(data.error) console.warn("Plan sync error:", data.error);
      }).catch(e=>console.warn("Plan sync request failed:", e.message));
      toast(`Switched to ${PLANS[k].name} plan`,"info");
    }
    else setConfirmKey(k);
  }
  function confirmUpgrade(){
    track("upgrade_clicked", { plan:confirmKey, source:"billing", credits_at_click:credits, current_plan:planKey });
    goStripe(PLANS[confirmKey].stripeLink, userEmail||"");
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

      {/* Trial paywall banner */}
      {trialExhausted&&(
        <div style={{background:`linear-gradient(135deg,${PLANS[intendedPlan].accent}1a,${C.violet}14)`,border:`1px solid ${PLANS[intendedPlan].accent}40`,borderRadius:13,padding:22,marginBottom:22,textAlign:"center"}}>
          <div style={{fontFamily:C.F,fontWeight:800,fontSize:18,marginBottom:6}}>Your free credits are used up</div>
          <p style={{fontSize:13,color:C.textMd,marginBottom:16,fontFamily:C.F,lineHeight:1.6}}>Subscribe to <strong style={{color:PLANS[intendedPlan].accent}}>{PLANS[intendedPlan].name}</strong> (${PLANS[intendedPlan].price}/mo) to keep generating content — {PLANS[intendedPlan].credits} credits every month.</p>
          <button className="btn-g" onClick={()=>{ track("upgrade_clicked", { plan:intendedPlan, source:"trial_paywall", credits_at_click:0, current_plan:"trial" }); goStripe(PLANS[intendedPlan].stripeLink, userEmail||""); }}
            style={{background:`linear-gradient(135deg,${PLANS[intendedPlan].accent},${C.violet})`,border:"none",color:"#fff",padding:"12px 28px",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F}}>
            Subscribe to {PLANS[intendedPlan].name} ⚡
          </button>
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
        <button className="signout-btn" onClick={onLogout} style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,padding:"12px 0",borderRadius:9,cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:13}}>
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
          {icon:"📖",label:"How to Use SPARK", sub:"Tips, guides and best practices", href:"https://usesparkai.app/guide"},
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
        <div style={{fontFamily:C.F,fontSize:10,color:C.textFaint,marginTop:3}}>© 2026 SPARK AI · usesparkai.app · <a href="https://usesparkai.app/privacy" target="_blank" rel="noreferrer" style={{color:C.textDim,textDecoration:"none"}}>Privacy</a> · <a href="https://usesparkai.app/terms" target="_blank" rel="noreferrer" style={{color:C.textDim,textDecoration:"none"}}>Terms</a></div>
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
  const refLink = `https://usesparkai.app/?ref=${refCode}`;

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
// COMMISSION CALCULATOR
// ─────────────────────────────────────────────────────────────────────────────
function CommissionCalculator({user, planKey}){
  const toast = useToast();
  const [mode, setMode] = useState("seller"); // seller | buyer
  const [inputs, setInputs] = useState({
    salePrice: "", commissionRate: "3", splitPercent: "70",
    brokerageFee: "0", eAndO: "0", taxRate: "25",
    loanAmount: "", interestRate: "7.25", loanTerm: "30",
    downPercent: "20", propertyTax: "1.2", insurance: "1800",
    hoa: "0",
  });
  const [calc, setCalc]     = useState(null);
  const [aiExplain, setAiExplain] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);

  function num(k){ return parseFloat((inputs[k]||"").toString().replace(/,/g,""))||0; }

  function calculate(){
    if(mode==="seller"){
      const price        = num("salePrice");
      if(!price){ toast("Enter a sale price","error"); return; }
      const grossComm    = price * (num("commissionRate")/100);
      const afterSplit   = grossComm * (num("splitPercent")/100);
      const brokerFee    = num("brokerageFee");
      const eAndO        = num("eAndO");
      const netBeforeTax = afterSplit - brokerFee - eAndO;
      const taxAmt       = netBeforeTax * (num("taxRate")/100);
      const netAfterTax  = netBeforeTax - taxAmt;
      setCalc({ mode:"seller", price, grossComm, afterSplit, brokerFee, eAndO, netBeforeTax, taxAmt, netAfterTax,
        commissionRate:num("commissionRate"), splitPercent:num("splitPercent"), taxRate:num("taxRate") });
    } else {
      const price        = num("salePrice");
      const down         = price * (num("downPercent")/100);
      const loan         = price - down;
      const monthlyRate  = (num("interestRate")/100)/12;
      const payments     = num("loanTerm")*12;
      const mortgagePayment = loan * (monthlyRate*Math.pow(1+monthlyRate,payments))/(Math.pow(1+monthlyRate,payments)-1);
      const monthlyTax   = (price*(num("propertyTax")/100))/12;
      const monthlyIns   = num("insurance")/12;
      const monthlyHoa   = num("hoa");
      const totalMonthly = mortgagePayment + monthlyTax + monthlyIns + monthlyHoa;
      const incomeNeeded = totalMonthly*12/0.28; // 28% rule
      setCalc({ mode:"buyer", price, down, loan, mortgagePayment, monthlyTax, monthlyIns, monthlyHoa, totalMonthly, incomeNeeded,
        interestRate:num("interestRate"), downPercent:num("downPercent"), loanTerm:num("loanTerm") });
    }
    setAiExplain(null);
  }

  async function generateAiExplainer(){
    if(!calc) return;
    setLoadingAi(true);
    try{
      const ctx = calc.mode==="seller"
        ? `Commission breakdown: Sale price $${calc.price.toLocaleString()}, ${calc.commissionRate}% commission = $${calc.grossComm.toLocaleString('en',{maximumFractionDigits:0})} gross, ${calc.splitPercent}% agent split = $${calc.afterSplit.toLocaleString('en',{maximumFractionDigits:0})}, minus brokerage fee $${calc.brokerFee}, E&O $${calc.eAndO}, net before tax $${calc.netBeforeTax.toLocaleString('en',{maximumFractionDigits:0})}, ${calc.taxRate}% tax = $${calc.taxAmt.toLocaleString('en',{maximumFractionDigits:0})}, final net $${calc.netAfterTax.toLocaleString('en',{maximumFractionDigits:0})}.`
        : `Buyer affordability: Purchase price $${calc.price.toLocaleString()}, ${calc.downPercent}% down = $${calc.down.toLocaleString('en',{maximumFractionDigits:0})}, loan $${calc.loan.toLocaleString('en',{maximumFractionDigits:0})} at ${calc.interestRate}% for ${calc.loanTerm} years, P&I $${calc.mortgagePayment.toLocaleString('en',{maximumFractionDigits:0})}/mo, taxes $${calc.monthlyTax.toLocaleString('en',{maximumFractionDigits:0})}/mo, insurance $${calc.monthlyIns.toLocaleString('en',{maximumFractionDigits:0})}/mo, HOA $${calc.monthlyHoa}/mo, total $${calc.totalMonthly.toLocaleString('en',{maximumFractionDigits:0})}/mo, income needed $${calc.incomeNeeded.toLocaleString('en',{maximumFractionDigits:0})}/yr.`;

      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, a real estate AI assistant. Explain financial calculations in plain English for clients — warm, clear, no jargon. Return ONLY valid JSON.",
          messages:[{role:"user",content:`${ctx}\n\nReturn ONLY valid JSON:\n{"client_summary":"2-3 sentence plain-English summary an agent can read directly to a client","key_takeaway":"the single most important number or insight","next_steps":["3 specific action items for the agent or client based on these numbers"],"talking_points":["3 conversational talking points the agent can use with their client"],"potential_concern":"one potential concern to address proactively","encouragement":"one positive, motivating statement about these numbers"}`}]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first = cleaned.indexOf("{"); const last = cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){ setAiExplain(JSON.parse(cleaned.slice(first,last+1))); }
    }catch(e){ toast("AI explainer failed — try again","error"); }
    finally{ setLoadingAi(false); }
  }

  const fmt = (n,dec=0) => isNaN(n)?"-":"$"+n.toLocaleString("en",{minimumFractionDigits:dec,maximumFractionDigits:dec});

  return(
    <div style={{paddingBottom:40}}>
      {/* Mode toggle */}
      <div style={{display:"flex",background:"rgba(255,255,255,.03)",borderRadius:9,padding:3,marginBottom:20,gap:3}}>
        {[["seller","🏷️ Net Commission"],["buyer","🏠 Buyer Affordability"]].map(([m,l])=>(
          <button key={m} onClick={()=>{setMode(m);setCalc(null);setAiExplain(null);}}
            style={{flex:1,padding:"9px 0",borderRadius:7,border:"none",background:mode===m?C.surfaceUp:"transparent",color:mode===m?C.text:C.textDim,cursor:"pointer",fontSize:12,fontWeight:700,fontFamily:C.F}}>
            {l}
          </button>
        ))}
      </div>

      {/* Inputs */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 18px",marginBottom:16}}>
        <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:14}}>
          {mode==="seller"?"LISTING DETAILS":"PURCHASE DETAILS"}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {mode==="seller"&&([
            ["salePrice","Sale Price ($)","875000"],
            ["commissionRate","Commission Rate (%)","3"],
            ["splitPercent","Agent Split (%)","70"],
            ["brokerageFee","Brokerage Fee ($)","500"],
            ["eAndO","E&O / Fees ($)","300"],
            ["taxRate","Tax Rate (%)","25"],
          ]).map(([k,label,ph])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1,marginBottom:4}}>{label}</div>
              <input value={inputs[k]} onChange={e=>setInputs(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontFamily:C.F,fontSize:13,boxSizing:"border-box"}}/>
            </div>
          ))}
          {mode==="buyer"&&([
            ["salePrice","Purchase Price ($)","500000"],
            ["downPercent","Down Payment (%)","20"],
            ["interestRate","Interest Rate (%)","7.25"],
            ["loanTerm","Loan Term (yrs)","30"],
            ["propertyTax","Property Tax Rate (%)","1.2"],
            ["insurance","Annual Insurance ($)","1800"],
            ["hoa","Monthly HOA ($)","0"],
          ]).map(([k,label,ph])=>(
            <div key={k}>
              <div style={{fontSize:9,color:C.textDim,fontFamily:C.F,fontWeight:700,letterSpacing:1,marginBottom:4}}>{label}</div>
              <input value={inputs[k]} onChange={e=>setInputs(p=>({...p,[k]:e.target.value}))} placeholder={ph}
                style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:7,padding:"8px 10px",color:C.text,fontFamily:C.F,fontSize:13,boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>
        <button onClick={calculate}
          style={{width:"100%",marginTop:16,background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:9,cursor:"pointer",fontWeight:700,fontSize:14,fontFamily:C.F}}>
          🧮 Calculate
        </button>
      </div>

      {/* Results */}
      {calc&&(
        <div style={{animation:"fadeIn .22s ease"}}>
          {calc.mode==="seller"&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 18px",marginBottom:16}}>
              <div style={{fontSize:10,color:C.emerald,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:16}}>NET COMMISSION BREAKDOWN</div>
              {[
                ["Sale Price",fmt(calc.price),C.textMd,false],
                [`Gross Commission (${calc.commissionRate}%)`,fmt(calc.grossComm),C.amber,false],
                [`Agent Split (${calc.splitPercent}%)`,fmt(calc.afterSplit),C.indigo,false],
                ["Brokerage Fee",`-${fmt(calc.brokerFee)}`,C.rose,false],
                ["E&O / Fees",`-${fmt(calc.eAndO)}`,C.rose,false],
                ["Net Before Tax",fmt(calc.netBeforeTax),C.cyan,true],
                [`Tax (${calc.taxRate}%)`,`-${fmt(calc.taxAmt)}`,C.rose,false],
                ["🏦 NET TAKE-HOME",fmt(calc.netAfterTax),"#10b981",true],
              ].map(([label,val,color,bold])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:C.F,fontSize:bold?14:13,color:bold?C.text:C.textMd,fontWeight:bold?700:400}}>{label}</span>
                  <span style={{fontFamily:C.F,fontSize:bold?15:13,color,fontWeight:700}}>{val}</span>
                </div>
              ))}
            </div>
          )}
          {calc.mode==="buyer"&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 18px",marginBottom:16}}>
              <div style={{fontSize:10,color:C.emerald,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:16}}>MONTHLY PAYMENT BREAKDOWN</div>
              {[
                ["Purchase Price",fmt(calc.price),C.textMd,false],
                [`Down Payment (${calc.downPercent}%)`,fmt(calc.down),C.amber,false],
                ["Loan Amount",fmt(calc.loan),C.indigo,false],
                [`P&I (${calc.interestRate}% / ${calc.loanTerm}yr)`,`${fmt(calc.mortgagePayment)}/mo`,C.cyan,false],
                ["Property Tax",`${fmt(calc.monthlyTax)}/mo`,C.textMd,false],
                ["Homeowners Insurance",`${fmt(calc.monthlyIns)}/mo`,C.textMd,false],
                ["HOA",`${fmt(calc.monthlyHoa)}/mo`,C.textMd,false],
                ["💰 TOTAL MONTHLY",`${fmt(calc.totalMonthly)}/mo`,"#10b981",true],
                ["Income Needed (28% rule)",`${fmt(calc.incomeNeeded)}/yr`,C.violet,true],
              ].map(([label,val,color,bold])=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                  <span style={{fontFamily:C.F,fontSize:bold?14:13,color:bold?C.text:C.textMd,fontWeight:bold?700:400}}>{label}</span>
                  <span style={{fontFamily:C.F,fontSize:bold?15:13,color,fontWeight:700}}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Explainer */}
          {!aiExplain&&(
            <button onClick={generateAiExplainer} disabled={loadingAi}
              style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"12px 0",borderRadius:9,cursor:loadingAi?"default":"pointer",fontWeight:700,fontSize:13,fontFamily:C.F,opacity:loadingAi?.7:1,marginBottom:16}}>
              {loadingAi?"✨ Generating AI Explainer...":"✨ Generate AI Client Explainer"}
            </button>
          )}

          {aiExplain&&(
            <div style={{animation:"fadeIn .22s ease"}}>
              <RBlock accent={C.emerald} label="CLIENT SUMMARY" action={<CopyBtn text={aiExplain.client_summary||""} label="Summary copied"/>}>
                <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.8}}>{aiExplain.client_summary}</p>
              </RBlock>
              <RBlock accent={C.amber} label="KEY TAKEAWAY">
                <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,margin:0,lineHeight:1.6}}>{aiExplain.key_takeaway}</p>
              </RBlock>
              <RBlock accent={C.indigo} label="TALKING POINTS">
                {(aiExplain.talking_points||[]).map((t,i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{minWidth:6,height:6,borderRadius:"50%",background:C.indigo,marginTop:6,flexShrink:0}}/>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5}}>{t}</p>
                    <CopyBtn text={t} label="Copied"/>
                  </div>
                ))}
              </RBlock>
              <RBlock accent={C.cyan} label="NEXT STEPS">
                {(aiExplain.next_steps||[]).map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:10,padding:"9px 0",borderBottom:`1px solid ${C.border}`}}>
                    <div style={{minWidth:22,height:22,borderRadius:"50%",background:"rgba(6,182,212,.07)",border:"1px solid rgba(6,182,212,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.cyan,fontFamily:C.F,fontWeight:700,flexShrink:0}}>{i+1}</div>
                    <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.5,alignSelf:"center"}}>{s}</p>
                  </div>
                ))}
              </RBlock>
              <RBlock accent={C.violet} label="POTENTIAL CONCERN">
                <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7}}>{aiExplain.potential_concern}</p>
              </RBlock>
              <RBlock accent={C.emerald} label="CLIENT ENCOURAGEMENT" action={<CopyBtn text={aiExplain.encouragement||""} label="Copied"/>}>
                <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.7,fontStyle:"italic"}}>"{aiExplain.encouragement}"</p>
              </RBlock>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
function MainApp({user,onLogout}){
  const [tab,setTab]        =useState("generate");
  const [planKey,setPlanKey]=useState(()=>LS.get("sp_plan",user.plan||"trial"));
  const [credits,setCredits]=useState(()=>LS.get("sp_credits",user.credits??3));
  const [intendedPlan]=useState(()=>{
    const ip = user.intendedPlan || LS.get("sp_intended_plan","pro");
    LS.set("sp_intended_plan", ip);
    return ip;
  });
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
          .select("plan,credits,intended_plan")
          .eq("email", user.email.toLowerCase())
          .single();
        if(data){
          const wasUpgrade = data.plan !== planKey && data.plan !== "trial" && planRank(data.plan) > planRank(planKey);
          if(wasUpgrade){
            track("upgrade_completed", { from_plan:planKey, to_plan:data.plan, credits:data.credits });
            identifyUser(user.email, { plan:data.plan, credits:data.credits });
          }
          setPlanKey(data.plan); LS.set("sp_plan",data.plan);
          setCredits(data.credits); LS.set("sp_credits",data.credits);
          if(data.intended_plan) LS.set("sp_intended_plan",data.intended_plan);
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
    // Also sign out of Supabase Auth session
    const sb = window.__supabase;
    if(sb) sb.auth.signOut().catch(()=>{});
    // Clear local plan/credits state so next login starts fresh from DB
    LS.del("sp_plan"); LS.del("sp_credits"); LS.del("sp_intended_plan");
    track("logout");
    resetAnalytics();
    onLogout();
  }
  function handleGoUpgrade(){ setTab("settings"); toast("Manage your plan below","info"); }
  function handleGoSettings(){ setTab("settings"); }

  const NAV=[
    {id:"generate",   icon:"⚡", label:"Generate"},
    {id:"calculator", icon:"🧮", label:"Calculator"},
    {id:"voice",      icon:"◎",  label:"Voice"},
    {id:"affiliate",  icon:"🔗", label:"Affiliate"},
    {id:"settings",   icon:"⚙",  label:"Settings"},
  ];

  const TITLES={
    generate:   <>Generate <Shimmer>Content</Shimmer></>,
    calculator: <>Commission <Shimmer>Calculator</Shimmer></>,
    voice:      <>Agent <Shimmer>Voice</Shimmer></>,
    affiliate:  <>Affiliate <Shimmer>Program</Shimmer></>,
    settings:   <Shimmer>Settings</Shimmer>,
  };
  const SUBTITLES={
    generate:   voice.saved&&plan.voiceMemory?`✓ ${voice.name||""} · ${voice.market||""}`:`${plan.name} · ${plan.contentTypes.length} types · ${plan.maxPhotos} photos`,
    calculator: "Net commission, split, taxes & buyer affordability — instant",
    voice:      plan.voiceMemory?"Saved once · every script sounds like you":"Requires Pro plan",
    affiliate:  "20% recurring commission · no cap",
    settings:   "Account · Plan · Billing · Support",
  };

  // ── MOBILE BOTTOM NAV BAR ──────────────────────────────────────────────────
  const NAV_ICONS = {
    generate: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    calculator: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="10" y2="10"/><line x1="14" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="10" y2="14"/><line x1="14" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="10" y2="18"/><line x1="14" y1="18" x2="16" y2="18"/></svg>,
    voice: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
    affiliate: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
    settings: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  };

  const MobileNav = ()=>(
    <div style={{
      position:"fixed",bottom:0,left:0,right:0,
      background:"rgba(4,4,10,.96)",
      borderTop:`1px solid ${C.border}`,
      backdropFilter:"blur(28px)",
      WebkitBackdropFilter:"blur(28px)",
      display:"flex",alignItems:"stretch",
      zIndex:200,
      paddingBottom:"env(safe-area-inset-bottom)",
    }}>
      {NAV.map(item=>{
        const active=tab===item.id;
        return(
          <button key={item.id} className="mobile-nav-btn" onClick={()=>setTab(item.id)}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",gap:4,padding:"10px 0 8px",
              background:"transparent",border:"none",cursor:"pointer",
              position:"relative",minHeight:58}}>
            {/* Active background pill */}
            {active&&<div style={{position:"absolute",inset:"6px 4px",borderRadius:10,
              background:`linear-gradient(135deg,${C.indigo}18,${C.violet}0e)`,
              border:`1px solid ${C.indigo}28`}}/>}
            <span style={{
              color:active?C.indigoLt:"rgba(255,255,255,.32)",
              transition:"all .16s ease",
              position:"relative",zIndex:1,
              filter:active?"none":"none"}}>
              {NAV_ICONS[item.id]||item.icon}
            </span>
            <span style={{fontSize:9,fontFamily:C.F,fontWeight:active?700:500,
              color:active?C.indigoLt:"rgba(255,255,255,.28)",
              letterSpacing:.3,position:"relative",zIndex:1}}>
              {item.label}
            </span>
            {/* Notification dots */}
            {item.id==="settings"&&credits<5&&(
              <div style={{position:"absolute",top:7,right:"calc(50% - 12px)",
                width:6,height:6,borderRadius:"50%",
                background:C.rose,boxShadow:`0 0 6px ${C.rose}`}}/>
            )}
            {item.id==="affiliate"&&(
              <div style={{position:"absolute",top:7,right:"calc(50% - 12px)",
                width:5,height:5,borderRadius:"50%",
                background:C.emerald,boxShadow:`0 0 5px ${C.emerald}`}}/>
            )}
          </button>
        );
      })}
    </div>
  );

  // ── MOBILE HEADER ──────────────────────────────────────────────────────────
  const MobileHeader = ()=>(
    <div style={{position:"sticky",top:0,zIndex:100,
      background:"rgba(4,4,10,.92)",
      borderBottom:`1px solid ${C.border}`,
      backdropFilter:"blur(28px)",
      WebkitBackdropFilter:"blur(28px)",
      padding:"10px 16px",
      paddingTop:"calc(10px + env(safe-area-inset-top))"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <Logo small/>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Credits pill — premium */}
          <div onClick={()=>setTab("settings")} style={{display:"flex",alignItems:"center",gap:6,
            background:`linear-gradient(135deg,${plan.accent}14,${C.violet}0a)`,
            border:`1px solid ${plan.accent}30`,
            borderRadius:10,padding:"6px 11px",cursor:"pointer",
            boxShadow:`0 0 12px ${plan.accent}18`}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:plan.accent,boxShadow:`0 0 6px ${plan.accent}`}}/>
            <span style={{fontSize:13,color:C.text,fontFamily:C.F,fontWeight:800,letterSpacing:-.3}}>{credits}</span>
            <span style={{fontSize:9,color:plan.accent,fontFamily:C.F,fontWeight:700,letterSpacing:.5}}>CR</span>
          </div>
          <button className="signout-btn" onClick={doLogout}
            style={{background:"transparent",border:`1px solid ${C.border}`,
              color:C.textDim,cursor:"pointer",fontSize:11,fontFamily:C.F,
              fontWeight:600,padding:"6px 11px",borderRadius:8,letterSpacing:.3}}>
            Sign out
          </button>
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

        {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings} user={user}/>}

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

        
        {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
        {tab==="settings"&&<><BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email} user={user} intendedPlan={intendedPlan}/><div style={{marginTop:28}}><SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/></div></>}
              {tab==="calculator"&&<CommissionCalculator user={user} planKey={planKey}/>}
      </div>
    </div>
  );

  // ── DESKTOP SIDEBAR ────────────────────────────────────────────────────────
  const DesktopSidebar = ()=>(
    <div style={{width:224,
      background:"rgba(4,4,10,.95)",
      borderRight:`1px solid ${C.border}`,
      display:"flex",flexDirection:"column",flexShrink:0,
      backdropFilter:"blur(28px)",
      WebkitBackdropFilter:"blur(28px)",
      position:"relative",zIndex:10}}>
      {/* Logo area */}
      <div style={{padding:"22px 18px 18px",borderBottom:`1px solid ${C.border}`}}>
        <Logo small/>
      </div>
      {/* Nav items */}
      <div style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {NAV.map((item)=>{
          const active=tab===item.id;
          return(
            <button key={item.id} className={`nav-item${active?" active":""}`}
              onClick={()=>setTab(item.id)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:10,
                padding:"9px 12px",borderRadius:9,marginBottom:2,
                background:"transparent",border:"1px solid transparent",
                color:active?C.indigoLt:C.textDim,cursor:"pointer",
                fontSize:13,fontWeight:active?600:500,textAlign:"left",
                fontFamily:C.F}}>
              <span style={{color:active?C.indigoLt:"rgba(255,255,255,.3)",flexShrink:0,display:"flex",alignItems:"center"}}>
                {NAV_ICONS[item.id]||item.icon}
              </span>
              {item.label}
              {item.id==="voice"&&plan.voiceMemory&&voice.saved&&(
                <span style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",
                  background:C.emerald,boxShadow:`0 0 6px ${C.emerald}`,flexShrink:0}}/>
              )}
              {item.id==="voice"&&!plan.voiceMemory&&(
                <span style={{marginLeft:"auto",fontSize:7,color:C.amber,
                  fontFamily:C.F,fontWeight:700,letterSpacing:.5}}>PRO</span>
              )}
              {item.id==="billing"&&credits<5&&(
                <span style={{marginLeft:"auto",fontSize:7,color:C.rose,
                  fontFamily:C.F,fontWeight:700,letterSpacing:.5}}>LOW</span>
              )}
              {item.id==="affiliate"&&(
                <span style={{marginLeft:"auto",fontSize:7,color:C.emerald,
                  fontFamily:C.F,fontWeight:700,letterSpacing:.5,
                  background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",
                  padding:"1px 5px",borderRadius:4}}>EARN</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Credits bar */}
      <div style={{padding:"13px 14px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,alignItems:"center"}}>
          <span style={{fontSize:8,color:C.textDim,letterSpacing:2,fontFamily:C.F,fontWeight:700}}>CREDITS</span>
          <span style={{fontSize:10,color:credits<5?C.rose:plan.accent,fontWeight:800,fontFamily:C.F}}>{credits} / {plan.credits}</span>
        </div>
        <div style={{height:4,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden",marginBottom:8}}>
          <div style={{height:"100%",
            width:`${Math.min(100,(credits/Math.max(plan.credits,1))*100)}%`,
            background:`linear-gradient(90deg,${credits<5?C.rose:plan.accent},${C.indigoLt})`,
            borderRadius:2,transition:"width .6s ease",
            boxShadow:`0 0 6px ${credits<5?C.rose:plan.accent}60`}}/>
        </div>
        <button className="btn-o" onClick={()=>setTab("settings")}
          style={{width:"100%",background:"rgba(99,102,241,.05)",
            border:`1px solid rgba(99,102,241,.18)`,
            color:C.indigoLt,borderRadius:7,padding:"6px 0",
            fontSize:9,cursor:"pointer",fontFamily:C.F,
            fontWeight:700,letterSpacing:1.5}}>
          + ADD CREDITS
        </button>
      </div>
      {/* User profile */}
      <div style={{padding:"14px 12px",borderTop:`1px solid ${C.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
          <div style={{width:30,height:30,borderRadius:"50%",
            background:`linear-gradient(135deg,${plan.accent},${C.violet})`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:12,fontWeight:800,color:"#fff",flexShrink:0,
            boxShadow:`0 2px 8px ${plan.accent}40`}}>
            {(user?.email||"?")[0].toUpperCase()}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:10,color:C.text,fontFamily:C.F,fontWeight:600,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {user?.email||""}
            </div>
            <div style={{marginTop:3}}>
              <Badge color={plan.accent}>{plan.name.toUpperCase()}</Badge>
            </div>
          </div>
        </div>
        <button className="signout-btn" onClick={doLogout}
          style={{width:"100%",background:"transparent",
            border:`1px solid ${C.border}`,color:C.textDim,
            cursor:"pointer",fontSize:11,fontFamily:C.F,
            fontWeight:500,padding:"7px 0",borderRadius:8}}>
          Sign out
        </button>
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
              <div style={{marginBottom:18}}>
                <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:22,
                  margin:"0 0 5px",lineHeight:1.2,letterSpacing:"-0.02em"}}>
                  {TITLES[tab]}
                </h1>
                <p style={{fontSize:11,color:C.textDim,margin:0,
                  letterSpacing:.3,fontFamily:C.F,fontWeight:500}}>
                  {SUBTITLES[tab]}
                </p>
              </div>

              {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings} user={user}/>}
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
              
              {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
              {tab==="settings"&&<><BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email} user={user} intendedPlan={intendedPlan}/><div style={{marginTop:28}}><SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/></div></>}
              {tab==="calculator"&&<CommissionCalculator user={user} planKey={planKey}/>}
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
              {tab==="generate"&&<GeneratePanel planKey={planKey} voice={voice} credits={credits} setCredits={setCredits} apiKeys={apiKeys} onGoUpgrade={handleGoUpgrade} onGoSettings={handleGoSettings} user={user}/>}
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
              
              {tab==="affiliate"&&<AffiliatePanel user={user} planKey={planKey}/>}
              {tab==="settings"&&<><BillingPanel planKey={planKey} setPlanKey={setPlanKey} credits={credits} setCredits={setCredits} userEmail={user.email} user={user} intendedPlan={intendedPlan}/><div style={{marginTop:28}}><SettingsPanel user={user} planKey={planKey} onLogout={doLogout} apiKeys={apiKeys} setApiKeys={setApiKeys}/></div></>}
              {tab==="calculator"&&<CommissionCalculator user={user} planKey={planKey}/>}
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
    ["Cinematic listing video","720p","1080p","4K"],
    ["Listing photos per video","3 photos","8 photos","20 photos"],
    ["MLS description generator","✓","✓","✓"],
    ["Open house package","✓","✓","✓"],
    ["Objection handler","✓","✓","✓"],
    ["Scripts & dialogues","✓","✓","✓"],
    ["Client communication suite","✓","✓","✓"],
    ["Commission calculator","✓","✓","✓"],
    ["Market update content","—","✓","✓"],
    ["Neighborhood story content","—","✓","✓"],
    ["Platforms","TikTok + Reels","All 5","All 5"],
    ["Hook variants","3","7","10"],
    ["Agent voice memory","—","✓","✓"],
    ["Credits / month","20","60","180"],
    ["Team seats","1","1","5"],
  ];

  const anim = (delay=0) => ready?`fadeUp .5s ease ${delay}s both`:"none";

  const TESTIMONIALS=[
    {name:"Marcus T.",role:"Luxury Agent · Miami Beach",quote:"I used to spend 3 hours on every listing. SPARK does it in 60 seconds. The videos alone are worth the subscription."},
    {name:"Ashley R.",role:"RE/MAX · Dallas, TX",quote:"My TikTok went from 200 to 4,800 followers in 6 weeks. Every video I post is generated by SPARK."},
    {name:"Daniel K.",role:"Team Lead · Compass",quote:"I rolled this out to my 8-agent team. We're winning more listings because our marketing looks better than anyone else in our market."},
  ];

  const PAIN_POINTS=[
    {pain:"Spending hours writing listing descriptions",fix:"MLS-compliant descriptions in 30 seconds — public remarks, feature highlights, social captions included."},
    {pain:"Paying $300-500 for a videographer",fix:"Cinematic AI listing videos from your photos. 15-30 seconds, 1080p, ready to post in minutes."},
    {pain:"Not knowing what to say to objections",fix:"3 ready-to-use responses — direct, empathetic, and story-based — for any client objection, instantly."},
    {pain:"Scrambling to create open house content",fix:"Full open house kit in one tap — social post, email, SMS blast, Story copy, and video invite script."},
  ];

  return(
    <div style={{background:C.bg,minHeight:"100vh",color:C.text,fontFamily:C.F,overflowX:"hidden"}}>
      <OrbBg/>
      <div style={{position:"relative",zIndex:1}}>

        {/* ── NAV ── */}
        <nav style={{padding:"0 24px",height:60,display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,backdropFilter:"blur(20px)",background:"rgba(5,5,7,.8)",position:"sticky",top:0,zIndex:100}}>
          <Logo/>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <button onClick={()=>onStart("login")} style={{background:"transparent",border:"none",color:C.textMd,padding:"7px 14px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:500,fontFamily:C.F}}>Sign in</button>
            <button onClick={()=>onStart("signup")} style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontSize:13,fontWeight:700,fontFamily:C.F,boxShadow:"0 0 0 1px rgba(99,102,241,.4),0 4px 16px rgba(99,102,241,.25)"}}>Start free ⚡</button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <div style={{padding:"88px 24px 72px",maxWidth:800,margin:"0 auto",textAlign:"center"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:6,background:"rgba(99,102,241,.07)",border:"1px solid rgba(99,102,241,.18)",borderRadius:20,padding:"5px 16px",fontSize:10,color:C.indigoLt,letterSpacing:2,fontWeight:700,marginBottom:24,animation:anim()}}>
            ⚡ THE COMPLETE AI PLATFORM FOR REAL ESTATE PROFESSIONALS
          </div>

          <h1 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(34px,6vw,64px)",lineHeight:1.06,margin:"0 0 22px",letterSpacing:"-0.03em",animation:anim(.06)}}>
            Your listings deserve<br/>
            <Shimmer>cinematic videos.</Shimmer>
          </h1>

          <p style={{fontSize:18,color:C.textMd,maxWidth:540,margin:"0 auto 12px",lineHeight:1.7,fontWeight:400,animation:anim(.12)}}>
            Upload your listing photos. SPARK generates a 15-30 second cinematic video, MLS description, TikTok scripts, open house package, and more — in under 60 seconds.
          </p>

          <p style={{fontSize:13,color:C.textDim,fontFamily:C.F,marginBottom:32,animation:anim(.16)}}>
            Used by agents at RE/MAX, Compass, Keller Williams, and independent brokerages nationwide.
          </p>

          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:14,animation:anim(.2)}}>
            <button onClick={()=>onStart("signup")}
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"15px 32px",borderRadius:11,cursor:"pointer",fontWeight:800,fontSize:16,fontFamily:C.F,boxShadow:"0 0 0 1px rgba(99,102,241,.4),0 8px 32px rgba(99,102,241,.28)",letterSpacing:.2}}>
              Generate my first listing video ⚡
            </button>
          </div>
          <p style={{fontSize:11,color:C.textDim,fontFamily:C.F,letterSpacing:1,animation:anim(.26)}}>3 free credits · no card required · cancel anytime</p>
        </div>

        {/* ── SOCIAL PROOF BAR ── */}
        <div style={{borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"22px 24px",background:"rgba(255,255,255,.015)"}}>
          <div style={{maxWidth:720,margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,textAlign:"center"}}>
            {[
              ["60s","from photos to listing video"],
              ["8+","AI tools in one platform"],
              ["$0","to get started, no card"],
              ["15-30s","cinematic video per listing"],
            ].map(([n,l],i)=>(
              <div key={i} style={{animation:`fadeUp .4s ease ${i*.07}s both`}}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:24,background:`linear-gradient(135deg,${C.indigoLt},${C.violet})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{n}</div>
                <div style={{fontSize:10,color:C.textDim,fontFamily:C.F,marginTop:5,lineHeight:1.4}}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── PAIN → FIX SECTION ── */}
        <div style={{padding:"80px 24px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:48}}>
            <div style={{fontSize:10,color:C.violet,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>WHY AGENTS SWITCH TO SPARK</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,36px)",lineHeight:1.15,letterSpacing:"-0.02em",margin:0}}>
              Stop doing this manually.
            </h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(320px,1fr))",gap:16}}>
            {PAIN_POINTS.map((pp,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"22px 20px",animation:anim(.08+i*.06)}}>
                <div style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:14}}>
                  <div style={{minWidth:20,height:20,borderRadius:"50%",background:"rgba(239,68,68,.1)",border:"1px solid rgba(239,68,68,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,flexShrink:0,marginTop:2}}>✕</div>
                  <p style={{fontFamily:C.F,fontSize:13,color:"rgba(239,68,68,.8)",margin:0,lineHeight:1.5,fontWeight:500,textDecoration:"line-through",opacity:.8}}>{pp.pain}</p>
                </div>
                <div style={{display:"flex",alignItems:"flex-start",gap:10}}>
                  <div style={{minWidth:20,height:20,borderRadius:"50%",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:C.emerald,flexShrink:0,marginTop:2}}>✓</div>
                  <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0,lineHeight:1.6}}>{pp.fix}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TOOL SHOWCASE ── */}
        <div style={{padding:"0 24px 80px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.indigo,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>EVERYTHING IN ONE PLATFORM</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,36px)",lineHeight:1.15,letterSpacing:"-0.02em",margin:0}}>
              8 AI tools. One subscription.
            </h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12}}>
            {[
              {icon:"🎬",title:"Cinematic Listing Video",body:"15-30 second AI video from your photos. 1080p on Pro, 4K on Team.",accent:C.indigo},
              {icon:"📝",title:"MLS Description",body:"MLS-compliant descriptions, public remarks, and feature highlights.",accent:C.amber},
              {icon:"🚪",title:"Open House Package",body:"Social post, email, SMS, Story copy, and video invite — all in one.",accent:C.emerald},
              {icon:"🎯",title:"Objection Handler",body:"3 tailored responses for any client objection — ready to use instantly.",accent:C.violet},
              {icon:"🗣️",title:"Scripts & Dialogues",body:"Listing appointments, buyer consultations, FSBO outreach, and more.",accent:C.cyan},
              {icon:"💬",title:"Client Communication",body:"Showing follow-ups, offer presentations, and post-closing nurture.",accent:"#f43f5e"},
              {icon:"🧮",title:"Commission Calculator",body:"Net commission, buyer affordability, and AI client explainer.",accent:C.emerald},
              {icon:"📈",title:"Market Updates",body:"Local market stats turned into viral social content. Pro and Team.",accent:C.cyan},
            ].map((s,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"20px 18px",transition:"border-color .2s",animation:anim(.06+i*.04)}}>
                <div style={{fontSize:26,marginBottom:10}}>{s.icon}</div>
                <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,marginBottom:6}}>{s.title}</div>
                <div style={{fontFamily:C.F,fontSize:12,color:C.textDim,lineHeight:1.6}}>{s.body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── TESTIMONIALS ── */}
        <div style={{padding:"0 24px 80px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.emerald,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>WHAT AGENTS ARE SAYING</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,36px)",lineHeight:1.15,letterSpacing:"-0.02em",margin:0}}>
              Real agents. Real results.
            </h2>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:14}}>
            {TESTIMONIALS.map((t,i)=>(
              <div key={i} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:"22px 20px",animation:anim(.08+i*.08)}}>
                <div style={{display:"flex",gap:3,marginBottom:14}}>
                  {[...Array(5)].map((_,j)=><span key={j} style={{color:C.amber,fontSize:13}}>★</span>)}
                </div>
                <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,lineHeight:1.7,margin:"0 0 18px",fontStyle:"italic"}}>"{t.quote}"</p>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:32,height:32,borderRadius:"50%",background:`linear-gradient(135deg,${C.indigo},${C.violet})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:"#fff",flexShrink:0}}>{t.name[0]}</div>
                  <div>
                    <div style={{fontFamily:C.F,fontSize:12,fontWeight:700,color:C.text}}>{t.name}</div>
                    <div style={{fontFamily:C.F,fontSize:10,color:C.textDim}}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── FEATURE COMPARISON TABLE ── */}
        <div style={{padding:"0 24px 80px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.indigo,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>COMPARE PLANS</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,36px)",lineHeight:1.15,letterSpacing:"-0.02em",margin:0}}>
              Pick the plan that fits your business.
            </h2>
          </div>
          <div style={{border:`1px solid ${C.border}`,borderRadius:16,overflow:"hidden",marginBottom:16}}>
            <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",background:C.surfaceHigh,borderBottom:`1px solid ${C.border}`,padding:"14px 20px"}}>
              {["","Agent","Pro","Team"].map((h,i)=>(
                <div key={i} style={{textAlign:i===0?"left":"center"}}>
                  {i>0&&(
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:i===2?C.indigo:Object.values(PLANS).filter(p=>p.price>0)[i-1]?.accent,fontFamily:C.F,letterSpacing:.5}}>{h}{i===2&&<span style={{marginLeft:4,fontSize:8,background:C.indigo,color:"#fff",padding:"1px 5px",borderRadius:4,fontWeight:800,letterSpacing:.5}}>BEST VALUE</span>}</div>
                      <div style={{fontSize:12,fontWeight:800,color:C.text,fontFamily:C.F,marginTop:2}}>${Object.values(PLANS).filter(p=>p.price>0)[i-1]?.price}/mo</div>
                    </>
                  )}
                </div>
              ))}
            </div>
            {FEATURES.map(([feat,...vals],i)=>(
              <div key={i} className="feature-row" style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",padding:"11px 20px",borderBottom:i<FEATURES.length-1?`1px solid ${C.border}`:"none",background:i===2||i===3?"rgba(99,102,241,.015)":i%2===0?"transparent":"rgba(255,255,255,.007)"}}>
                <div style={{fontSize:12,color:C.textMd,fontFamily:C.F}}>{feat}</div>
                {vals.map((v,j)=>(
                  <div key={j} style={{fontSize:12,textAlign:"center",color:v==="—"?C.textDim:v==="✓"?C.emerald:j===1?C.indigoLt:C.text,fontFamily:C.F,fontWeight:v==="✓"||v==="—"?600:j===1?700:400}}>{v}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── PRICING CAROUSEL ── */}
        <div style={{padding:"0 24px 80px",maxWidth:760,margin:"0 auto"}}>
          <div style={{textAlign:"center",marginBottom:40}}>
            <div style={{fontSize:10,color:C.indigo,letterSpacing:3,fontFamily:C.F,fontWeight:700,marginBottom:12}}>PRICING</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(22px,4vw,36px)",lineHeight:1.15,letterSpacing:"-0.02em",margin:"0 0 10px"}}>
              Simple pricing. No surprises.
            </h2>
            <p style={{fontSize:14,color:C.textMd,fontFamily:C.F,margin:0}}>Start with 3 free credits — no card required.</p>
          </div>
          <div style={{maxWidth:520,margin:"0 auto"}}>
            <PlanCarousel mode="landing" onStart={onStart}/>
          </div>
        </div>

        {/* ── FINAL CTA ── */}
        <div style={{padding:"0 24px 96px",maxWidth:600,margin:"0 auto",textAlign:"center"}}>
          <div style={{background:`linear-gradient(135deg,rgba(99,102,241,.08),rgba(139,92,246,.06))`,border:`1px solid rgba(99,102,241,.2)`,borderRadius:20,padding:"48px 32px"}}>
            <div style={{fontSize:32,marginBottom:16}}>🏡</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:"clamp(20px,4vw,30px)",lineHeight:1.2,letterSpacing:"-0.02em",margin:"0 0 14px"}}>
              Your next listing video<br/>is 60 seconds away.
            </h2>
            <p style={{fontSize:14,color:C.textMd,fontFamily:C.F,lineHeight:1.7,margin:"0 0 28px"}}>
              Join agents at top brokerages using SPARK AI to generate better content, win more listings, and grow faster.
            </p>
            <button onClick={()=>onStart("signup")}
              style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"15px 36px",borderRadius:11,cursor:"pointer",fontWeight:800,fontSize:15,fontFamily:C.F,boxShadow:"0 0 0 1px rgba(99,102,241,.4),0 8px 32px rgba(99,102,241,.28)",marginBottom:14}}>
              Start free — 3 credits ⚡
            </button>
            <p style={{fontSize:11,color:C.textDim,fontFamily:C.F,letterSpacing:1,margin:0}}>No credit card · cancel anytime</p>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{borderTop:`1px solid ${C.border}`,padding:"28px 24px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
          <Logo small/>
          <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
            {[["Privacy","https://usesparkai.app/privacy"],["Terms","https://usesparkai.app/terms"],["Support","mailto:support@usesparkai.app"]].map(([l,h])=>(
              <a key={l} href={h} target="_blank" rel="noreferrer" style={{fontSize:12,color:C.textDim,fontFamily:C.F,textDecoration:"none"}}>{l}</a>
            ))}
          </div>
          <div style={{fontSize:11,color:C.textDim,fontFamily:C.F}}>© 2026 SPARK AI · usesparkai.app</div>
        </div>

      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// AUTH PAGE — with forgot password flow
// ─────────────────────────────────────────────────────────────────────────────
function AuthPage({mode,onAuth,onSwitch}){
  const [email,setEmail]       =useState("");
  const [pass,setPass]         =useState("");
  const [plan,setPlan]         =useState("trial");
  const [loading,setLoading]   =useState(false);
  const [mounted,setMounted]   =useState(false);
  const [view,setView]         =useState("auth"); // "auth" | "forgot" | "forgot_sent"
  const [resetEmail,setResetEmail]=useState("");
  const [resetSending,setResetSending]=useState(false);
  const toast=useToast();

  useEffect(()=>{ setMounted(true); },[]);

  // ── Forgot password send ────────────────────────────────────────────────────
  async function sendReset(){
    if(!resetEmail||resetEmail.indexOf("@")<0){ toast("Enter a valid email address","error"); return; }
    setResetSending(true);
    const sb=window.__supabase;
    if(!sb){ toast("Auth service unavailable — please refresh","error"); setResetSending(false); return; }
    try{
      const {error}=await sb.auth.resetPasswordForEmail(resetEmail,{
        redirectTo: "https://usesparkai.app/?reset=1",
      });
      if(error) throw new Error(error.message);
      setView("forgot_sent");
    }catch(e){
      toast(e.message||"Could not send reset email — try again","error");
    }finally{
      setResetSending(false);
    }
  }

  // ── Main submit ─────────────────────────────────────────────────────────────
  function submit(){
    if(!email||email.indexOf("@")<0){ toast("Enter a valid email address","error"); return; }
    if(!pass||pass.length<6){ toast("Password must be at least 6 characters","error"); return; }
    setLoading(true);

    const sb=window.__supabase;
    if(sb){
      (async()=>{
        try{
          if(mode==="signup"){
            const {data,error}=await sb.auth.signUp({ email, password:pass });
            if(error) throw new Error(error.message);
            const isTrialChoice = plan==="trial";
            const startCredits = isTrialChoice ? 3 : 0;
            const startPlan = "trial"; // always created as trial pre-payment; webhook upgrades on payment success

            // Create user row server-side (bypasses RLS reliably)
            let finalPlan=startPlan, finalCredits=startCredits, finalIntended=plan;
            try{
              const resp=await fetch('/api/create-user',{
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({ email, plan:startPlan, credits:startCredits, intendedPlan:plan })
              });
              const cuData=await resp.json();
              if(resp.ok){
                finalPlan=cuData.plan; finalCredits=cuData.credits; finalIntended=cuData.intendedPlan||plan;
              } else {
                console.warn("create-user failed:", cuData.error);
              }
            }catch(e){ console.warn("create-user request failed:", e.message); }

            const accounts=LS.get("sp_accounts",{});
            accounts[email.toLowerCase()]={ plan:finalPlan, credits:finalCredits, intendedPlan:finalIntended };
            LS.set("sp_accounts",accounts);

            // If email confirmation is required, Supabase returns a user
            // but session is null — show the verify email screen
            if(data.session===null){
              setView("verify_email");
              setLoading(false);
              identifyUser(email, { selected_plan: plan });
              track("signup_completed", { selected_plan: plan, is_trial: isTrialChoice, email_confirmation_required: true });
            } else if(!isTrialChoice && PLANS[plan].stripeLink){
              identifyUser(email, { selected_plan: plan });
              track("signup_completed", { selected_plan: plan, is_trial: false });
              track("upgrade_clicked", { plan, source: "signup", credits_at_click: 0 });
              // User selected a paid tier — send straight to Stripe checkout, no trial credits.
              // If they complete payment, the webhook sets plan/credits before they return.
              // If they cancel, they remain on trial/0 credits until they subscribe.
              goStripe(PLANS[plan].stripeLink, email);
            } else {
              identifyUser(email, { selected_plan: plan });
              track("signup_completed", { selected_plan: plan, is_trial: true });
              onAuth({ email, plan:finalPlan, credits:finalCredits, intendedPlan:finalIntended });
            }
          } else {
            const {data,error}=await sb.auth.signInWithPassword({ email, password:pass });
            if(error) throw new Error(error.message);
            const {data:userData, error:dbError}=await sb.from("users").select("plan,credits,intended_plan").eq("email",email.toLowerCase()).single();

            let finalPlan, finalCredits, finalIntended;
            if(dbError||!userData){
              // No row found (e.g. pre-fix account) — self-heal by creating one
              console.warn("User row missing on login, self-healing:", dbError?.message);
              const startCredits=3;
              try{
                const resp=await fetch('/api/create-user',{
                  method:'POST',
                  headers:{'Content-Type':'application/json'},
                  body:JSON.stringify({ email, plan:"trial", credits:startCredits, intendedPlan:"pro" })
                });
                const cuData=await resp.json();
                finalPlan = resp.ok ? cuData.plan : "trial";
                finalCredits = resp.ok ? cuData.credits : startCredits;
                finalIntended = resp.ok ? (cuData.intendedPlan||"pro") : "pro";
              }catch(e){
                console.warn("self-heal create-user failed:", e.message);
                finalPlan="trial"; finalCredits=startCredits; finalIntended="pro";
              }
            } else {
              finalPlan=userData.plan; finalCredits=userData.credits; finalIntended=userData.intended_plan||"pro";
            }

            const accounts=LS.get("sp_accounts",{});
            accounts[email.toLowerCase()]={ plan:finalPlan, credits:finalCredits, intendedPlan:finalIntended };
            LS.set("sp_accounts",accounts);
            identifyUser(email, { plan:finalPlan, credits:finalCredits });
            track("login_completed", { plan:finalPlan, credits:finalCredits });
            onAuth({ email, plan:finalPlan, credits:finalCredits, intendedPlan:finalIntended });
          }
        }catch(e){
          // Give a more helpful message for unconfirmed email
          let msg = e.message||"Something went wrong — try again";
          if(msg.toLowerCase().includes("email not confirmed")||msg.toLowerCase().includes("not confirmed")){
            msg = "Please confirm your email first — check your inbox for the confirmation link";
          }
          if(msg.toLowerCase().includes("invalid login")){
            msg = "Incorrect email or password — try again";
          }
          toast(msg,"error");
          setLoading(false);
        }
      })();
      return;
    }

    // localStorage fallback
    setTimeout(()=>{
      try{
        const accounts=LS.get("sp_accounts",{});
        const key=email.toLowerCase();
        if(mode==="signup"){
          if(accounts[key]){ toast("Account already exists — sign in","error"); setLoading(false); return; }
          const isTrialChoice = plan==="trial";
          const startCredits = isTrialChoice ? 3 : 0;
          accounts[key]={ plan:"trial", credits:startCredits, intendedPlan:plan };
          LS.set("sp_accounts",accounts);
          if(!isTrialChoice && PLANS[plan].stripeLink){
            goStripe(PLANS[plan].stripeLink, email);
          } else {
            onAuth({ email, plan:"trial", credits:startCredits, intendedPlan:plan });
          }
        } else {
          const account=accounts[key];
          if(!account){ toast("No account found — tap Start Free","error"); setLoading(false); return; }
          if(account.pass!==pass){ toast("Incorrect password","error"); setLoading(false); return; }
          onAuth({ email, plan:account.plan, credits:account.credits, intendedPlan:account.intendedPlan||"pro" });
        }
      }catch(e){
        toast("Something went wrong — try again","error");
        setLoading(false);
      }
    },400);
  }

  const inputStyle={width:"100%",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"11px 14px",color:"rgba(255,255,255,.92)",fontSize:14,fontFamily:C.F,outline:"none",boxSizing:"border-box",transition:"border-color .18s"};

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:C.F}}>
      <OrbBg/>
      <ToastContainer/>
      <div style={{width:"100%",maxWidth:400,padding:"20px",position:"relative",zIndex:1,opacity:mounted?1:0,transition:"opacity .35s ease"}}>

        {/* ── VERIFY EMAIL SCREEN ── */}
        {view==="verify_email"&&(
          <div style={{textAlign:"center",animation:"scaleIn .3s ease"}}>
            <div style={{width:64,height:64,borderRadius:"50%",background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 20px"}}>✉️</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:22,marginBottom:10,color:C.text}}>Check your inbox</h2>
            <p style={{fontFamily:C.F,fontSize:14,color:C.textMd,lineHeight:1.65,marginBottom:6}}>
              We sent a confirmation link to<br/>
              <strong style={{color:C.text}}>{email}</strong>
            </p>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,lineHeight:1.55,marginBottom:28,maxWidth:300,margin:"0 auto 28px"}}>
              Click the link in the email to activate your account. Check your spam folder if you don't see it within a minute.
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10,maxWidth:280,margin:"0 auto"}}>
              <button onClick={async()=>{
                const sb=window.__supabase;
                if(!sb){ toast("Auth service unavailable","error"); return; }
                const {error}=await sb.auth.resend({ type:"signup", email });
                if(error) toast(error.message,"error");
                else toast("Confirmation email resent ✓");
              }} style={{background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.25)",color:C.indigoLt,padding:"11px 0",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F,fontWeight:600}}>
                Resend confirmation email
              </button>
              <button onClick={()=>{ setView("auth"); onSwitch(); }}
                style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,padding:"11px 0",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F}}>
                Back to sign in
              </button>
            </div>
          </div>
        )}

        {/* ── FORGOT PASSWORD SENT ── */}
        {view==="forgot_sent"&&(
          <div style={{textAlign:"center",animation:"scaleIn .3s ease"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(16,185,129,.1)",border:"1px solid rgba(16,185,129,.3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 20px"}}>✉</div>
            <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:22,marginBottom:10,color:C.text}}>Check your email</h2>
            <p style={{fontFamily:C.F,fontSize:14,color:C.textMd,lineHeight:1.6,marginBottom:8}}>
              We sent a password reset link to<br/>
              <strong style={{color:C.text}}>{resetEmail}</strong>
            </p>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,marginBottom:28,lineHeight:1.5}}>
              Click the link in the email to set a new password. Check your spam folder if you don't see it within a minute.
            </p>
            <button onClick={()=>{ setView("auth"); setResetEmail(""); }}
              style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.textMd,padding:"11px 24px",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:C.F,fontWeight:500}}>
              Back to sign in
            </button>
          </div>
        )}

        {/* ── FORGOT PASSWORD FORM ── */}
        {view==="forgot"&&(
          <div style={{animation:"scaleIn .3s ease"}}>
            <div style={{textAlign:"center",marginBottom:28}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo/></div>
              <h2 style={{fontFamily:C.F,fontWeight:800,fontSize:20,marginBottom:8,color:C.text}}>Reset your password</h2>
              <p style={{fontFamily:C.F,fontSize:13,color:C.textMd,margin:0}}>Enter your email and we will send a reset link.</p>
            </div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px 24px",boxShadow:"0 40px 80px rgba(0,0,0,.5)"}}>
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:6}}>EMAIL</div>
                <input type="email" value={resetEmail} onChange={e=>setResetEmail(e.target.value)}
                  placeholder="your@email.com" autoComplete="email" style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.5)"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.06)"}/>
              </div>
              <button onClick={sendReset} disabled={resetSending}
                style={{width:"100%",background:"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:resetSending?"not-allowed":"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,display:"flex",alignItems:"center",justifyContent:"center",gap:8,opacity:resetSending?.7:1}}>
                {resetSending?<><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/>Sending...</>:"Send Reset Link"}
              </button>
              <div style={{textAlign:"center",marginTop:16}}>
                <span onClick={()=>setView("auth")} style={{fontSize:12,color:C.indigo,cursor:"pointer",fontFamily:C.F,fontWeight:500}}>
                  ← Back to sign in
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── MAIN AUTH FORM ── */}
        {view==="auth"&&(
          <>
            <div style={{textAlign:"center",marginBottom:32}}>
              <div style={{display:"flex",justifyContent:"center",marginBottom:16}}><Logo/></div>
              <p style={{color:C.textMd,fontSize:14,margin:0,fontFamily:C.F,fontWeight:400}}>
                {mode==="login"?"Welcome back":"Start generating viral listing content"}
              </p>
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:16,padding:"28px 24px",boxShadow:"0 40px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.04)"}}>

              <div style={{marginBottom:14}}>
                <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:6}}>EMAIL</div>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="sarah@kw.com" autoComplete="email" style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.5)"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.06)"}/>
              </div>

              <div style={{marginBottom:mode==="signup"?14:8}}>
                <div style={{fontSize:10,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:6}}>PASSWORD</div>
                <input type="password" value={pass} onChange={e=>setPass(e.target.value)}
                  placeholder="min 6 characters" autoComplete={mode==="login"?"current-password":"new-password"} style={inputStyle}
                  onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.5)"}
                  onBlur={e=>e.target.style.borderColor="rgba(255,255,255,.06)"}/>
              </div>

              {/* Forgot password link — login only */}
              {mode==="login"&&(
                <div style={{textAlign:"right",marginBottom:18}}>
                  <span onClick={()=>{ setResetEmail(email); setView("forgot"); }}
                    style={{fontSize:12,color:C.indigo,cursor:"pointer",fontFamily:C.F,fontWeight:500,letterSpacing:.2}}>
                    Forgot password?
                  </span>
                </div>
              )}

              {mode==="signup"&&(
                <div style={{marginBottom:18}}>
                  <div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:8}}>SELECT PLAN</div>
                  <div style={{display:"flex",gap:7}}>
                    {Object.entries(PLANS).map(([k,p])=>(
                      <button key={k} onClick={()=>setPlan(k)}
                        style={{flex:1,padding:"10px 4px",borderRadius:8,border:`1px solid ${plan===k?p.accent+"60":C.border}`,background:plan===k?p.accent+"14":"transparent",color:plan===k?p.accent:C.textDim,cursor:"pointer",fontSize:10,fontWeight:700,fontFamily:C.F,letterSpacing:.8,transition:"all .14s"}}>
                        {k==="trial"?"Free Trial":p.name}<br/><span style={{fontWeight:400,fontSize:9}}>{k==="trial"?"3 credits":`$${p.price}/mo`}</span>
                      </button>
                    ))}
                  </div>
                  <div style={{marginTop:10,fontSize:11,color:C.textDim,fontFamily:C.F,lineHeight:1.5}}>
                    {plan==="trial"
                      ? "Start with 3 free credits — no card required."
                      : `You'll be taken to secure checkout to subscribe to ${PLANS[plan].name} ($${PLANS[plan].price}/mo).`}
                  </div>
                </div>
              )}

              <button onClick={submit} disabled={loading}
                style={{width:"100%",background:loading?"rgba(99,102,241,.5)":"linear-gradient(135deg,#6366f1,#8b5cf6)",border:"none",color:"#fff",padding:"13px 0",borderRadius:10,cursor:loading?"not-allowed":"pointer",fontWeight:700,fontSize:14,fontFamily:C.F,boxShadow:"0 4px 18px rgba(99,102,241,.24)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxSizing:"border-box"}}>
                {loading?(
                  <><div style={{width:16,height:16,borderRadius:"50%",border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",animation:"spin .7s linear infinite"}}/>{mode==="login"?"Signing in...":"Creating account..."}</>
                ):(
                  mode==="login"?"Sign In ⚡":"Create Account ⚡"
                )}
              </button>

              {mode==="signup"&&(
                <p style={{textAlign:"center",fontSize:9,color:C.textDim,marginTop:8,letterSpacing:1.2,fontFamily:C.F}}>
                  +3 FREE CREDITS ON SIGNUP · NO CARD REQUIRED
                </p>
              )}

              <p style={{textAlign:"center",marginTop:14,fontSize:12,color:C.textMd,fontFamily:C.F}}>
                {mode==="login"?"No account? ":"Have an account? "}
                <span onClick={onSwitch} style={{color:C.indigo,cursor:"pointer",fontWeight:700}}>
                  {mode==="login"?"Start free":"Sign in"}
                </span>
              </p>
            </div>
          </>
        )}

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

  // Initialise PostHog analytics once on mount
  useEffect(()=>{
    initAnalytics();
  },[]);

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
  if(screen==="app"&&user) return <MainApp user={user} onLogout={()=>{ LS.del("sp_onboarded"); setUser(null); setScreen("landing"); }}/>;
  return <div style={{minHeight:"100vh",background:"#08090e"}}/>;
}
