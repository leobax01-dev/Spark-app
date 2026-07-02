// src/features/ContentHistory.jsx
// Content History — saves every generation, searchable, filterable, reusable
// Exports: default ContentHistory component + saveGeneration + getHistory utilities

import { useState, useEffect, useMemo } from "react";

const LS_KEY      = "spark_content_history_v1";
const MAX_ENTRIES = 100;

const C = {
  bg:"#04040a", surface:"#08080f", surfaceUp:"#0d0d1a", surfaceHigh:"#111122",
  border:"rgba(255,255,255,0.06)", borderMd:"rgba(255,255,255,0.10)",
  indigo:"#6366f1", indigoLt:"#818cf8", violet:"#8b5cf6",
  cyan:"#22d3ee", emerald:"#10b981", amber:"#f59e0b", rose:"#f43f5e",
  text:"rgba(255,255,255,0.95)", textMd:"rgba(255,255,255,0.55)",
  textDim:"rgba(255,255,255,0.26)",
  F:"'Plus Jakarta Sans',sans-serif",
};

const TYPE_META = {
  listing:    { label:"Listing Video",     icon:"🎬", color:"#6366f1" },
  mls_desc:   { label:"MLS Description",   icon:"📝", color:"#f59e0b" },
  open_house: { label:"Open House",        icon:"🚪", color:"#10b981" },
  objection:  { label:"Objection Handler", icon:"🎯", color:"#8b5cf6" },
  scripts:    { label:"Scripts",           icon:"🗣️", color:"#22d3ee" },
  comms:      { label:"Client Comms",      icon:"💬", color:"#f43f5e" },
  education:  { label:"Education",         icon:"📚", color:"#f59e0b" },
  market:     { label:"Market Update",     icon:"📈", color:"#22d3ee" },
  lifestyle:  { label:"Lifestyle",         icon:"🌅", color:"#8b5cf6" },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
export function getHistory(){
  try{ const v=localStorage.getItem(LS_KEY); return v?JSON.parse(v):[]; }
  catch{ return []; }
}

export function saveGeneration({ type, inputs, platform, result, planKey }){
  try{
    const history = getHistory();
    const entry = {
      id:        `${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
      type, inputs:inputs||{}, platform:platform||null,
      result:result||{}, planKey:planKey||"trial",
      preview:   extractPreview(type, result),
      title:     extractTitle(type, inputs),
      starred:   false,
      createdAt: new Date().toISOString(),
    };
    const updated = [entry, ...history].slice(0, MAX_ENTRIES);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    return entry;
  }catch(e){ console.warn("ContentHistory save failed:", e); return null; }
}

function extractPreview(type, result){
  if(!result) return "";
  return (
    result.headline ||
    result.script?.slice(0,160) ||
    result.mls_description?.slice(0,160) ||
    result.social_post?.slice(0,160) ||
    result.responses?.[0]?.slice(0,160) ||
    result.email_body?.slice(0,160) ||
    result.caption?.slice(0,160) ||
    result.opening?.slice(0,160) || ""
  );
}

function extractTitle(type, inputs){
  const meta = TYPE_META[type];
  const label = meta?.label || type;
  const address  = inputs?.address || inputs?.propertyAddress || inputs?.location;
  const market   = inputs?.market || inputs?.neighborhood;
  const topic    = inputs?.objection || inputs?.topic || inputs?.script_type;
  if(address) return `${label} — ${address.split(",")[0]}`;
  if(market)  return `${label} — ${market}`;
  if(topic)   return `${label} — ${String(topic).slice(0,30)}`;
  return label;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function HCopyBtn({ text }){
  const [ok,setOk]=useState(false);
  return(
    <button onClick={e=>{ e.stopPropagation();
      navigator.clipboard.writeText(text||"").then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,
        color:ok?C.emerald:C.textDim,borderRadius:6,padding:"3px 9px",
        cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,
        letterSpacing:1,transition:"all .14s",flexShrink:0}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}

function TypeBadge({ type, small=false }){
  const meta = TYPE_META[type] || { label:type, icon:"⚡", color:C.indigo };
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,
      background:`${meta.color}14`,border:`1px solid ${meta.color}28`,
      color:meta.color,borderRadius:10,
      padding:small?"1px 7px":"2px 9px",
      fontSize:small?8:9,fontFamily:C.F,fontWeight:700,letterSpacing:.8,flexShrink:0}}>
      {meta.icon} {meta.label}
    </span>
  );
}

function ResultField({ label, value, color=C.indigo }){
  if(!value) return null;
  const text = Array.isArray(value) ? value.join("\n") : String(value);
  if(!text.trim()) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:9,padding:"11px 13px",marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:7}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>
          {label}
        </span>
        <HCopyBtn text={text}/>
      </div>
      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
        lineHeight:1.7,whiteSpace:"pre-wrap"}}>{text}</p>
    </div>
  );
}

function ResultList({ label, items, color=C.indigo }){
  if(!items?.length) return null;
  return(
    <div style={{background:"rgba(255,255,255,.02)",border:`1px solid ${C.border}`,
      borderRadius:9,padding:"11px 13px",marginBottom:9}}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:9}}>
        <span style={{fontSize:8,color,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>
          {label} ({items.length})
        </span>
        <HCopyBtn text={items.join("\n\n")}/>
      </div>
      {items.map((item,i)=>(
        <div key={i} style={{display:"flex",gap:8,padding:"6px 0",
          borderBottom:i<items.length-1?`1px solid ${C.border}`:"none"}}>
          <div style={{width:16,height:16,borderRadius:"50%",flexShrink:0,
            background:`${color}14`,border:`1px solid ${color}24`,
            display:"flex",alignItems:"center",justifyContent:"center",
            fontSize:8,color,fontWeight:700}}>{i+1}</div>
          <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
            lineHeight:1.5,alignSelf:"center"}}>{item}</p>
        </div>
      ))}
    </div>
  );
}

function FullResultView({ type, result }){
  if(!result) return null;
  const color = TYPE_META[type]?.color || C.indigo;
  return(
    <div>
      <ResultField label="HEADLINE"            value={result.headline}           color={color}/>
      <ResultField label="SCRIPT"              value={result.script}             color={color}/>
      <ResultField label="FULL SCRIPT"         value={result.full_script}        color={color}/>
      <ResultList  label="HOOKS"               items={result.hooks}              color={color}/>
      <ResultField label="CAPTION"             value={result.caption}            color={color}/>
      <ResultField label="MLS DESCRIPTION"     value={result.mls_description}    color={color}/>
      <ResultField label="PUBLIC REMARKS"      value={result.public_remarks}     color={color}/>
      <ResultList  label="FEATURE HIGHLIGHTS"  items={result.feature_highlights} color={color}/>
      <ResultField label="SOCIAL CAPTION"      value={result.social_caption}     color={color}/>
      <ResultField label="SOCIAL POST"         value={result.social_post}        color={color}/>
      <ResultField label="STORY COPY"          value={result.story_copy}         color={color}/>
      <ResultField label="EMAIL SUBJECT"       value={result.email_subject}      color={color}/>
      <ResultField label="EMAIL BODY"          value={result.email_body}         color={color}/>
      <ResultField label="SMS TEXT"            value={result.sms_text}           color={color}/>
      <ResultField label="INVITE SCRIPT"       value={result.invite_script}      color={color}/>
      <ResultList  label="OBJECTION RESPONSES" items={result.responses}          color={color}/>
      <ResultField label="FOLLOW-UP EMAIL"     value={result.followup}           color={color}/>
      <ResultField label="EMAIL VERSION"       value={result.email}              color={color}/>
      <ResultField label="PHONE SCRIPT"        value={result.phone}              color={color}/>
      <ResultField label="TEXT / SMS"          value={result.text}               color={color}/>
      <ResultField label="FULL SEQUENCE"       value={result.sequence}           color={color}/>
      <ResultList  label="QUESTIONS"           items={result.questions}          color={color}/>
      <ResultList  label="OBJECTIONS"          items={result.objections}         color={color}/>
      <ResultList  label="TIPS"                items={result.tips}               color={color}/>
      <ResultList  label="SHOT LIST"           items={result.shot_list}          color={color}/>
      <ResultField label="CTA"                 value={result.cta}                color={color}/>
      <ResultList  label="HASHTAGS"            items={result.hashtags}           color={color}/>
      <ResultField label="AGENT REMARKS"       value={result.agent_remarks}      color={color}/>
      <ResultField label="POSTING TIP"         value={result.posting_tip}        color={color}/>
      <ResultField label="THUMBNAIL CONCEPT"   value={result.thumbnail}          color={color}/>
      <ResultField label="OPENING"             value={result.opening}            color={color}/>
      <ResultField label="INSIGHT"             value={result.insight}            color={color}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DETAIL VIEW
// ─────────────────────────────────────────────────────────────────────────────
function DetailView({ entry, onBack, onReuse, onToggleStar, onDelete }){
  const date = new Date(entry.createdAt).toLocaleDateString("en-US",{
    month:"short",day:"numeric",year:"numeric",
    hour:"numeric",minute:"2-digit",
  });
  return(
    <div style={{animation:"fadeUp .25s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button onClick={onBack}
          style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.textMd,borderRadius:8,padding:"6px 12px",
            cursor:"pointer",fontSize:12,fontFamily:C.F,flexShrink:0}}>
          ← Back
        </button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.text,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {entry.title}
          </div>
          <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:2}}>
            {date}{entry.platform?` · ${entry.platform}`:""}
          </div>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        <button onClick={()=>onReuse(entry)}
          style={{flex:1,background:`linear-gradient(135deg,${C.indigo},${C.violet})`,
            border:"none",color:"#fff",borderRadius:9,padding:"10px 0",
            cursor:"pointer",fontFamily:C.F,fontWeight:700,fontSize:12,
            boxShadow:`0 4px 14px ${C.indigo}28`}}>
          ↺ Reuse & Regenerate
        </button>
        <button onClick={()=>onToggleStar(entry.id)}
          style={{background:"transparent",
            border:`1px solid ${entry.starred?C.amber+"55":C.border}`,
            color:entry.starred?C.amber:C.textDim,borderRadius:9,
            padding:"10px 14px",cursor:"pointer",fontSize:14,flexShrink:0}}>
          {entry.starred?"★":"☆"}
        </button>
        <button onClick={()=>{ if(window.confirm("Delete this entry?")) onDelete(entry.id); }}
          style={{background:"transparent",border:`1px solid ${C.border}`,
            color:C.rose,borderRadius:9,padding:"10px 12px",
            cursor:"pointer",fontSize:12,fontFamily:C.F,fontWeight:700,flexShrink:0}}>
          Delete
        </button>
      </div>

      {Object.keys(entry.inputs||{}).length>0&&(
        <div style={{background:`${C.indigo}06`,border:`1px solid ${C.indigo}18`,
          borderRadius:10,padding:"12px 14px",marginBottom:14}}>
          <div style={{fontSize:8,color:C.indigo,fontFamily:C.F,fontWeight:700,
            letterSpacing:2,marginBottom:8}}>GENERATION INPUTS</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
            {Object.entries(entry.inputs)
              .filter(([,v])=>v&&String(v).trim())
              .slice(0,8)
              .map(([k,v])=>(
              <div key={k} style={{background:"rgba(255,255,255,.03)",
                border:`1px solid ${C.border}`,borderRadius:6,padding:"3px 9px",maxWidth:200}}>
                <span style={{fontSize:8,color:C.textDim,fontFamily:C.F,
                  fontWeight:700,letterSpacing:1}}>
                  {k.replace(/_/g," ").toUpperCase()}:{" "}
                </span>
                <span style={{fontSize:10,color:C.textMd,fontFamily:C.F}}>
                  {String(v).slice(0,40)}{String(v).length>40?"...":""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <FullResultView type={entry.type} result={entry.result}/>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY CARD
// ─────────────────────────────────────────────────────────────────────────────
function HistoryCard({ entry, onSelect, onToggleStar, index }){
  const meta = TYPE_META[entry.type] || { color:C.indigo };
  const date = new Date(entry.createdAt).toLocaleDateString("en-US",{
    month:"short",day:"numeric",hour:"numeric",minute:"2-digit",
  });
  return(
    <div onClick={()=>onSelect(entry)}
      style={{background:C.surface,border:`1px solid ${C.border}`,
        borderRadius:12,padding:"14px 15px",cursor:"pointer",
        animation:`fadeUp .22s ease ${index*.04}s both`,
        transition:"border-color .16s,transform .16s",
        position:"relative",overflow:"hidden"}}
      onMouseEnter={e=>{
        e.currentTarget.style.borderColor=`${meta.color}44`;
        e.currentTarget.style.transform="translateY(-1px)";
      }}
      onMouseLeave={e=>{
        e.currentTarget.style.borderColor=C.border;
        e.currentTarget.style.transform="translateY(0)";
      }}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${meta.color}30,transparent)`}}/>

      <div style={{display:"flex",alignItems:"flex-start",
        justifyContent:"space-between",gap:8,marginBottom:8}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,
            overflow:"hidden",textOverflow:"ellipsis",
            whiteSpace:"nowrap",marginBottom:4}}>
            {entry.title}
          </div>
          <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            <TypeBadge type={entry.type} small/>
            {entry.platform&&(
              <span style={{fontSize:8,color:C.textDim,fontFamily:C.F,fontWeight:600}}>
                {entry.platform}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={e=>{ e.stopPropagation(); onToggleStar(entry.id); }}
          style={{background:"transparent",border:"none",
            color:entry.starred?C.amber:"rgba(255,255,255,.15)",
            cursor:"pointer",fontSize:15,lineHeight:1,padding:"2px",flexShrink:0}}>
          {entry.starred?"★":"☆"}
        </button>
      </div>

      {entry.preview&&(
        <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,
          margin:"0 0 8px",lineHeight:1.5,
          display:"-webkit-box",WebkitLineClamp:2,
          WebkitBoxOrient:"vertical",overflow:"hidden"}}>
          {entry.preview}
        </p>
      )}
      <div style={{fontSize:9,color:C.textDim,fontFamily:C.F}}>{date}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ContentHistory({ onReuse }){
  const [history,    setHistory]    = useState(()=>getHistory());
  const [search,     setSearch]     = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStar, setFilterStar] = useState(false);
  const [selected,   setSelected]   = useState(null);
  const [sortOrder,  setSortOrder]  = useState("newest");

  useEffect(()=>{ setHistory(getHistory()); }, []);

  function toggleStar(id){
    const updated = history.map(e=>e.id===id?{...e,starred:!e.starred}:e);
    setHistory(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    if(selected?.id===id) setSelected(p=>({...p,starred:!p.starred}));
  }

  function deleteEntry(id){
    const updated = history.filter(e=>e.id!==id);
    setHistory(updated);
    localStorage.setItem(LS_KEY, JSON.stringify(updated));
    setSelected(null);
  }

  function clearAll(){
    if(!window.confirm(`Delete all ${history.length} entries? This cannot be undone.`)) return;
    setHistory([]); localStorage.removeItem(LS_KEY); setSelected(null);
  }

  const filtered = useMemo(()=>{
    let entries = [...history];
    if(search.trim()){
      const q = search.toLowerCase();
      entries = entries.filter(e=>
        e.title?.toLowerCase().includes(q) ||
        e.preview?.toLowerCase().includes(q) ||
        e.type?.toLowerCase().includes(q) ||
        e.platform?.toLowerCase().includes(q) ||
        Object.values(e.inputs||{}).some(v=>String(v).toLowerCase().includes(q)) ||
        Object.values(e.result||{}).some(v=>String(v).toLowerCase().includes(q))
      );
    }
    if(filterType!=="all") entries = entries.filter(e=>e.type===filterType);
    if(filterStar)         entries = entries.filter(e=>e.starred);
    if(sortOrder==="oldest") entries = [...entries].reverse();
    return entries;
  }, [history, search, filterType, filterStar, sortOrder]);

  const usedTypes    = [...new Set(history.map(e=>e.type))];
  const starredCount = history.filter(e=>e.starred).length;

  if(selected){
    const live = history.find(e=>e.id===selected.id) || selected;
    return(
      <DetailView
        entry={live}
        onBack={()=>setSelected(null)}
        onReuse={entry=>{ onReuse(entry); setSelected(null); }}
        onToggleStar={toggleStar}
        onDelete={deleteEntry}
      />
    );
  }

  if(history.length===0){
    return(
      <div style={{textAlign:"center",padding:"48px 20px",animation:"fadeUp .3s ease"}}>
        <div style={{fontSize:40,marginBottom:14}}>📂</div>
        <div style={{fontFamily:C.F,fontWeight:700,fontSize:16,
          color:C.text,marginBottom:8}}>No history yet</div>
        <p style={{fontFamily:C.F,fontSize:13,color:C.textDim,
          margin:"0 0 20px",lineHeight:1.6,maxWidth:280,
          marginLeft:"auto",marginRight:"auto"}}>
          Every generation you create is automatically saved here. Switch to Generate to create your first piece of content.
        </p>
        <div style={{display:"inline-flex",gap:6,
          background:`${C.indigo}08`,border:`1px solid ${C.indigo}18`,
          borderRadius:8,padding:"8px 14px"}}>
          <span style={{fontSize:12,color:C.indigoLt,fontFamily:C.F}}>
            ⚡ Switch to Generate tab above
          </span>
        </div>
      </div>
    );
  }

  return(
    <div style={{animation:"fadeUp .28s ease"}}>

      {/* Search */}
      <div style={{position:"relative",marginBottom:12}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search generations, addresses, content..."
          style={{width:"100%",background:C.surfaceUp,
            border:`1px solid ${C.border}`,borderRadius:9,
            padding:"9px 36px 9px 13px",color:C.text,
            fontFamily:C.F,fontSize:13,boxSizing:"border-box",
            outline:"none",transition:"border-color .16s"}}
          onFocus={e=>e.target.style.borderColor="rgba(99,102,241,.45)"}
          onBlur={e=>e.target.style.borderColor=C.border}/>
        {search&&(
          <button onClick={()=>setSearch("")}
            style={{position:"absolute",right:10,top:"50%",
              transform:"translateY(-50%)",background:"transparent",
              border:"none",color:C.textDim,cursor:"pointer",fontSize:14}}>
            ✕
          </button>
        )}
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:6,marginBottom:12,
        overflowX:"auto",paddingBottom:4}}>
        {["all",...usedTypes].map(t=>{
          const meta = t==="all"?null:TYPE_META[t];
          const active = filterType===t;
          return(
            <button key={t} onClick={()=>setFilterType(t)}
              style={{padding:"4px 10px",borderRadius:14,flexShrink:0,
                border:`1px solid ${active?(meta?.color||C.indigo)+"50":C.border}`,
                background:active?`${meta?.color||C.indigo}10`:"transparent",
                color:active?(meta?.color||C.indigoLt):C.textDim,
                cursor:"pointer",fontSize:9,fontFamily:C.F,
                fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap"}}>
              {t==="all"?"All types":`${meta?.icon||""} ${meta?.label||t}`}
            </button>
          );
        })}
        {starredCount>0&&(
          <button onClick={()=>setFilterStar(!filterStar)}
            style={{padding:"4px 10px",borderRadius:14,flexShrink:0,
              border:`1px solid ${filterStar?C.amber+"50":C.border}`,
              background:filterStar?`${C.amber}10`:"transparent",
              color:filterStar?C.amber:C.textDim,cursor:"pointer",
              fontSize:9,fontFamily:C.F,fontWeight:700,whiteSpace:"nowrap"}}>
            ★ Starred ({starredCount})
          </button>
        )}
      </div>

      {/* Stats + sort */}
      <div style={{display:"flex",alignItems:"center",
        justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontFamily:C.F,fontSize:11,color:C.textDim}}>
          {filtered.length} of {history.length} generation{history.length!==1?"s":""}
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <select value={sortOrder} onChange={e=>setSortOrder(e.target.value)}
            style={{background:C.surfaceUp,border:`1px solid ${C.border}`,
              color:C.textDim,borderRadius:6,padding:"3px 8px",
              fontSize:10,fontFamily:C.F,cursor:"pointer",outline:"none"}}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
          <button onClick={clearAll}
            style={{background:"transparent",border:`1px solid ${C.border}`,
              color:C.rose,borderRadius:6,padding:"3px 9px",cursor:"pointer",
              fontSize:9,fontFamily:C.F,fontWeight:700,letterSpacing:.5}}>
            Clear all
          </button>
        </div>
      </div>

      {/* No results */}
      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"32px 20px",
          color:C.textDim,fontFamily:C.F}}>
          <div style={{fontSize:28,marginBottom:10}}>🔍</div>
          <div style={{fontSize:13,fontWeight:600}}>No results found</div>
          <div style={{fontSize:11,marginTop:6}}>Try a different search or filter</div>
        </div>
      )}

      {/* Entry cards */}
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {filtered.map((entry,i)=>(
          <HistoryCard key={entry.id} entry={entry} index={i}
            onSelect={setSelected} onToggleStar={toggleStar}/>
        ))}
      </div>

      {history.length>=MAX_ENTRIES&&(
        <p style={{fontFamily:C.F,fontSize:10,color:C.textDim,
          textAlign:"center",marginTop:16,lineHeight:1.5}}>
          Showing last {MAX_ENTRIES} generations. Oldest entries are automatically removed.
        </p>
      )}
    </div>
  );
}
