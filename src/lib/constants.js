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
export { C, GLOBAL_CSS, PLANS, CREDIT_PACKS, CONTENT_TYPES, PLATFORMS, INPUT_META, TYPE_INPUTS, PLAN_ORDER, LS };
