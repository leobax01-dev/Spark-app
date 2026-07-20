// src/features/ClientPanel.jsx
// Client Intelligence Layer — Pipeline Manager, Deal Notes Summarizer, AI Daily Briefing
// Standalone feature file — imported into App.jsx

import { useState, useEffect, useRef } from "react";
import { lsGet, lsSet, cloudLoad, cloudSync } from "../utils/storage";

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

const LS_KEY = "spark_clients_v1";
const BRIEFING_KEY = "spark_briefing_v1";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
function CCard({children, accent=C.indigo, style={}}){
  return(
    <div style={{background:`linear-gradient(135deg,${C.surface},${C.surfaceUp})`,
      border:`1px solid ${C.border}`,borderRadius:14,padding:"18px 16px",
      marginBottom:12,position:"relative",overflow:"hidden",...style}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent,${accent}40,transparent)`}}/>
      {children}
    </div>
  );
}

function CLabel({children, color=C.indigo}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
      <div style={{width:3,height:13,borderRadius:2,
        background:`linear-gradient(180deg,${color},${color}60)`,
        boxShadow:`0 0 7px ${color}80`}}/>
      <span style={{fontSize:9,color,fontFamily:C.F,fontWeight:700,letterSpacing:2.2}}>{children}</span>
    </div>
  );
}

function CField({label, value, onChange, placeholder, area=false, rows=2}){
  return(
    <div style={{marginBottom:10}}>
      {label&&<div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:5}}>{label}</div>}
      {area
        ? <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:8,
              padding:"9px 11px",color:C.text,fontFamily:C.F,fontSize:12,resize:"vertical",
              boxSizing:"border-box",lineHeight:1.5}}/>
        : <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
            style={{width:"100%",background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:8,
              padding:"9px 11px",color:C.text,fontFamily:C.F,fontSize:12,boxSizing:"border-box"}}/>
      }
    </div>
  );
}

function CBtn({onClick, loading, children, color=C.indigo, small=false}){
  return(
    <button onClick={onClick} disabled={loading}
      style={{width:small?"auto":"100%",background:loading?"rgba(255,255,255,.06)":`linear-gradient(135deg,${color},${color}cc)`,
        border:"none",color:loading?C.textDim:"#fff",
        padding:small?"7px 14px":"12px 0",borderRadius:9,cursor:loading?"default":"pointer",
        fontFamily:C.F,fontWeight:700,fontSize:small?11:13,letterSpacing:.2,
        boxShadow:loading?"none":`0 4px 14px ${color}28`,
        transition:"all .18s",opacity:loading?.6:1}}>
      {loading?"Generating...":children}
    </button>
  );
}

function CCopyBtn({text}){
  const [ok,setOk]=useState(false);
  return(
    <button onClick={()=>{ navigator.clipboard.writeText(text||"").then(()=>{ setOk(true); setTimeout(()=>setOk(false),2000); }); }}
      style={{background:"transparent",border:`1px solid ${C.border}`,color:ok?C.emerald:C.textDim,
        borderRadius:6,padding:"3px 8px",cursor:"pointer",fontSize:9,fontFamily:C.F,fontWeight:700,letterSpacing:1}}>
      {ok?"✓ COPIED":"COPY"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE STAGES
// ─────────────────────────────────────────────────────────────────────────────
const STAGES = [
  { id:"prospect",   label:"Prospect",      color:C.textDim,  icon:"👤" },
  { id:"active",     label:"Active",        color:C.indigo,   icon:"🔥" },
  { id:"contract",   label:"Under Contract",color:C.amber,    icon:"📋" },
  { id:"closed",     label:"Closed",        color:C.emerald,  icon:"🏆" },
];

const BLANK_CLIENT = {
  id:"", name:"", phone:"", email:"", type:"buyer",
  stage:"prospect", property:"", budget:"", timeline:"",
  motivation:"", notes:"", lastContact:"", nextAction:"",
  aiAction:"", createdAt:"",
};

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 1 — CLIENT PIPELINE MANAGER
// ─────────────────────────────────────────────────────────────────────────────
function ClientPipeline({ user }){
  const [clients, setClients]   = useState(()=>lsGet(LS_KEY, []));
  const [view,    setView]      = useState("pipeline"); // pipeline | add | detail
  const [editing, setEditing]   = useState(null);
  const [loadingAi, setLoadingAi] = useState(null);
  const [filterStage, setFilterStage] = useState("all");
  const [syncStatus, setSyncStatus] = useState("idle"); // idle | syncing | synced | offline
  const hydrated = useRef(false);

  // On mount — pull from cloud (source of truth), reconcile with local cache
  useEffect(()=>{
    if(!user?.email){ hydrated.current=true; return; }
    (async ()=>{
      const cloud = await cloudLoad(user.email);
      if(cloud?.clients){
        // Cloud wins if it has data or is newer than what's cached; empty cloud + existing local = push local up
        if(cloud.clients.length > 0 || clients.length === 0){
          setClients(cloud.clients);
          lsSet(LS_KEY, cloud.clients);
        }
      }
      hydrated.current = true;
    })();
  },[]);

  useEffect(()=>{ lsSet(LS_KEY, clients); }, [clients]);

  // Debounced cloud sync on every change (skip the initial hydration write)
  useEffect(()=>{
    if(!hydrated.current || !user?.email) return;
    setSyncStatus("syncing");
    const timeout = setTimeout(async ()=>{
      const ok = await cloudSync(user.email, { clients });
      setSyncStatus(ok?"synced":"offline");
    }, 900);
    return ()=>clearTimeout(timeout);
  },[clients]);

  function saveClient(client){
    const isNew = !client.id;
    const record = { ...client, id: isNew ? Date.now().toString() : client.id,
      createdAt: isNew ? new Date().toISOString() : client.createdAt,
      lastContact: isNew ? new Date().toISOString().slice(0,10) : client.lastContact };
    setClients(prev => isNew ? [record,...prev] : prev.map(c=>c.id===record.id?record:c));
    setView("pipeline");
    setEditing(null);
  }

  function deleteClient(id){ setClients(prev=>prev.filter(c=>c.id!==id)); setView("pipeline"); }

  async function generateAiAction(client){
    setLoadingAi(client.id);
    try{
      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          system:"You are SPARK, an expert real estate AI coach. Give direct, specific, actionable advice. Return ONLY valid JSON.",
          messages:[{role:"user",content:
            `Real estate agent needs next best action for this client:
Name: ${client.name}, Type: ${client.type}, Stage: ${client.stage}
Property interest: ${client.property}, Budget: ${client.budget}
Timeline: ${client.timeline}, Motivation: ${client.motivation}
Last contact: ${client.lastContact}, Notes: ${client.notes}
Current next action: ${client.nextAction}

Return ONLY valid JSON:
{"next_action":"specific single most important action to take TODAY — concrete, no vague advice","message_to_send":"exact word-for-word message to send this client right now — text or email format, ready to copy and send","why":"one sentence explaining why this is the right move","urgency":"high/medium/low","follow_up_timing":"exactly when to follow up after taking this action"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first=cleaned.indexOf("{"); const last=cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){
        const ai = JSON.parse(cleaned.slice(first,last+1));
        setClients(prev=>prev.map(c=>c.id===client.id?{...c,aiAction:JSON.stringify(ai)}:c));
      }
    }catch(e){}
    setLoadingAi(null);
  }

  const filteredClients = filterStage==="all" ? clients : clients.filter(c=>c.stage===filterStage);
  const daysSince = (dateStr) => {
    if(!dateStr) return null;
    return Math.round((Date.now()-new Date(dateStr))/(1000*60*60*24));
  };

  // ── Add / Edit Form ──
  if(view==="add"||view==="edit"){
    const initial = view==="edit" ? editing : {...BLANK_CLIENT};
    return <ClientForm initial={initial} onSave={saveClient} onCancel={()=>setView("pipeline")} onDelete={view==="edit"?()=>deleteClient(editing.id):null}/>;
  }

  // ── Detail View ──
  if(view==="detail"&&editing){
    const client = clients.find(c=>c.id===editing.id)||editing;
    const stage  = STAGES.find(s=>s.id===client.stage);
    let aiData = null;
    try{ if(client.aiAction) aiData=JSON.parse(client.aiAction); }catch{}
    const days = daysSince(client.lastContact);

    return(
      <div style={{animation:"fadeUp .3s ease"}}>
        <button onClick={()=>setView("pipeline")}
          style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,
            borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:C.F,
            fontSize:12,marginBottom:16}}>← Pipeline</button>

        <CCard accent={stage.color}>
          <div style={{display:"flex",alignItems:"flex-start",gap:12,marginBottom:16}}>
            <div style={{width:44,height:44,borderRadius:"50%",flexShrink:0,
              background:`linear-gradient(135deg,${stage.color},${stage.color}88)`,
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>
              {stage.icon}
            </div>
            <div style={{flex:1}}>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:17,color:C.text}}>{client.name}</div>
              <div style={{display:"flex",gap:6,marginTop:5,flexWrap:"wrap"}}>
                <span style={{fontSize:9,background:`${stage.color}18`,border:`1px solid ${stage.color}30`,
                  color:stage.color,fontFamily:C.F,fontWeight:700,padding:"2px 8px",borderRadius:10,letterSpacing:1}}>
                  {stage.label.toUpperCase()}
                </span>
                <span style={{fontSize:9,background:"rgba(255,255,255,.04)",
                  color:C.textDim,fontFamily:C.F,padding:"2px 8px",borderRadius:10}}>
                  {client.type==="buyer"?"🏠 Buyer":"💰 Seller"}
                </span>
                {days!==null&&<span style={{fontSize:9,color:days>7?C.rose:C.textDim,
                  fontFamily:C.F,padding:"2px 8px",borderRadius:10,
                  background:days>7?"rgba(244,63,94,.08)":"rgba(255,255,255,.04)"}}>
                  Last contact: {days===0?"Today":`${days}d ago`}
                </span>}
              </div>
            </div>
            <button onClick={()=>{ setEditing(client); setView("edit"); }}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,
                borderRadius:7,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:C.F}}>
              Edit
            </button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:11,color:C.textMd,fontFamily:C.F}}>
            {[["💬",client.phone],["📧",client.email],["🏡",client.property],["💰",client.budget],["📅",client.timeline],["🎯",client.motivation]].filter(([,v])=>v).map(([icon,val],i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"flex-start"}}>
                <span>{icon}</span><span style={{lineHeight:1.4}}>{val}</span>
              </div>
            ))}
          </div>
          {client.notes&&<div style={{marginTop:12,padding:"10px 12px",background:"rgba(255,255,255,.02)",borderRadius:8,fontFamily:C.F,fontSize:11,color:C.textMd,lineHeight:1.6}}>{client.notes}</div>}
        </CCard>

        {/* AI Next Action */}
        <CCard accent={C.violet}>
          <CLabel color={C.violet}>AI NEXT ACTION</CLabel>
          {aiData ? (
            <div>
              <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                <span style={{fontSize:9,background:`${aiData.urgency==="high"?C.rose:aiData.urgency==="medium"?C.amber:C.emerald}18`,
                  border:`1px solid ${aiData.urgency==="high"?C.rose:aiData.urgency==="medium"?C.amber:C.emerald}30`,
                  color:aiData.urgency==="high"?C.rose:aiData.urgency==="medium"?C.amber:C.emerald,
                  fontFamily:C.F,fontWeight:700,padding:"2px 8px",borderRadius:10,letterSpacing:1}}>
                  {aiData.urgency?.toUpperCase()} PRIORITY
                </span>
                <span style={{fontSize:10,color:C.textDim,fontFamily:C.F}}>{aiData.follow_up_timing}</span>
              </div>
              <p style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text,margin:"0 0 8px"}}>{aiData.next_action}</p>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:"0 0 12px",lineHeight:1.5}}>{aiData.why}</p>
              <div style={{background:"rgba(139,92,246,.06)",border:"1px solid rgba(139,92,246,.18)",borderRadius:9,padding:"11px 13px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <span style={{fontSize:8,color:C.violet,fontFamily:C.F,fontWeight:700,letterSpacing:2}}>MESSAGE TO SEND</span>
                  <CCopyBtn text={aiData.message_to_send}/>
                </div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiData.message_to_send}</p>
              </div>
              <div style={{marginTop:10,display:"flex",justifyContent:"flex-end"}}>
                <CBtn small onClick={()=>generateAiAction(client)} loading={loadingAi===client.id} color={C.violet}>
                  ↻ Regenerate
                </CBtn>
              </div>
            </div>
          ):(
            <div>
              <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,margin:"0 0 12px",lineHeight:1.6}}>
                SPARK analyzes this client's stage, timeline, and notes to generate your exact next move — including the message to send.
              </p>
              <CBtn onClick={()=>generateAiAction(client)} loading={loadingAi===client.id} color={C.violet}>
                ✦ Generate AI Next Action
              </CBtn>
            </div>
          )}
        </CCard>
      </div>
    );
  }

  // ── Pipeline View ──
  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
        <div>
          <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.text}}>
            {clients.length} client{clients.length!==1?"s":""}
          </div>
          <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:2,display:"flex",alignItems:"center",gap:6}}>
            <span>{clients.filter(c=>c.stage==="active").length} active · {clients.filter(c=>c.stage==="contract").length} under contract</span>
            {user?.email&&(
              <span style={{display:"flex",alignItems:"center",gap:3}}>
                <div style={{width:5,height:5,borderRadius:"50%",
                  background:syncStatus==="synced"?C.emerald:syncStatus==="syncing"?C.amber:syncStatus==="offline"?C.rose:C.textDim,
                  boxShadow:syncStatus==="synced"?`0 0 5px ${C.emerald}`:"none"}}/>
                <span style={{fontSize:8,color:C.textDim}}>
                  {syncStatus==="synced"?"Synced":syncStatus==="syncing"?"Syncing...":syncStatus==="offline"?"Offline":""}
                </span>
              </span>
            )}
          </div>
        </div>
        <CBtn small onClick={()=>{ setEditing({...BLANK_CLIENT}); setView("add"); }} color={C.indigo}>
          + Add Client
        </CBtn>
      </div>

      {/* Stage filter */}
      <div style={{display:"flex",gap:6,marginBottom:16,overflowX:"auto",paddingBottom:4}}>
        {[{id:"all",label:"All",color:C.textMd},...STAGES].map(s=>(
          <button key={s.id} onClick={()=>setFilterStage(s.id)}
            style={{padding:"5px 12px",borderRadius:16,border:`1px solid ${filterStage===s.id?s.color+"55":C.border}`,
              background:filterStage===s.id?`${s.color}12`:"transparent",
              color:filterStage===s.id?s.color:C.textDim,cursor:"pointer",
              fontSize:10,fontFamily:C.F,fontWeight:600,whiteSpace:"nowrap",flexShrink:0}}>
            {s.label} {s.id!=="all"&&`(${clients.filter(c=>c.stage===s.id).length})`}
          </button>
        ))}
      </div>

      {/* Client cards */}
      {filteredClients.length===0?(
        <div style={{textAlign:"center",padding:"40px 20px",color:C.textDim,fontFamily:C.F}}>
          <div style={{fontSize:32,marginBottom:12}}>👤</div>
          <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>No clients yet</div>
          <div style={{fontSize:12}}>Add your first client to start tracking your pipeline</div>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {filteredClients.map((client,i)=>{
            const stage = STAGES.find(s=>s.id===client.stage);
            const days  = daysSince(client.lastContact);
            const overdue = days!==null && days>7;
            let aiData = null;
            try{ if(client.aiAction) aiData=JSON.parse(client.aiAction); }catch{}
            return(
              <div key={client.id} onClick={()=>{ setEditing(client); setView("detail"); }}
                style={{background:C.surface,border:`1px solid ${overdue?C.rose+"33":C.border}`,
                  borderRadius:12,padding:"13px 14px",cursor:"pointer",
                  animation:`slideR .22s ease ${i*.05}s both`,
                  transition:"all .16s ease"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=stage.color+"44"}
                onMouseLeave={e=>e.currentTarget.style.borderColor=overdue?C.rose+"33":C.border}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <div style={{width:34,height:34,borderRadius:"50%",flexShrink:0,
                      background:`${stage.color}18`,border:`1px solid ${stage.color}28`,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>
                      {stage.icon}
                    </div>
                    <div>
                      <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.text}}>{client.name}</div>
                      <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:1}}>
                        {client.type==="buyer"?"Buyer":"Seller"} · {client.property||"No property yet"}
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <span style={{fontSize:9,background:`${stage.color}18`,color:stage.color,
                      fontFamily:C.F,fontWeight:700,padding:"2px 8px",borderRadius:10}}>
                      {stage.label}
                    </span>
                    {days!==null&&<div style={{fontSize:9,color:overdue?C.rose:C.textDim,
                      fontFamily:C.F,marginTop:4}}>
                      {days===0?"Today":`${days}d ago`}
                    </div>}
                  </div>
                </div>
                {aiData?.next_action&&(
                  <div style={{marginTop:8,padding:"7px 10px",
                    background:"rgba(139,92,246,.06)",borderRadius:7,
                    fontFamily:C.F,fontSize:11,color:C.violet,lineHeight:1.4}}>
                    ✦ {aiData.next_action}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT FORM — add/edit
// ─────────────────────────────────────────────────────────────────────────────
function ClientForm({initial, onSave, onCancel, onDelete}){
  const [form, setForm] = useState({...BLANK_CLIENT, ...initial});
  function set(k){ return v=>setForm(p=>({...p,[k]:v})); }
  const isEdit = !!initial?.id;

  return(
    <div style={{animation:"fadeUp .3s ease"}}>
      <button onClick={onCancel}
        style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMd,
          borderRadius:8,padding:"7px 14px",cursor:"pointer",fontFamily:C.F,
          fontSize:12,marginBottom:16}}>← Back</button>

      <CCard accent={C.indigo}>
        <CLabel color={C.indigo}>{isEdit?"EDIT CLIENT":"NEW CLIENT"}</CLabel>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:4}}>
          {/* Type toggle */}
          <div style={{gridColumn:"1/-1",display:"flex",gap:8,marginBottom:4}}>
            {["buyer","seller"].map(t=>(
              <button key={t} onClick={()=>set("type")(t)}
                style={{flex:1,padding:"8px 0",borderRadius:8,
                  border:`1px solid ${form.type===t?C.indigo+"55":C.border}`,
                  background:form.type===t?`${C.indigo}10`:"transparent",
                  color:form.type===t?C.indigoLt:C.textDim,cursor:"pointer",
                  fontFamily:C.F,fontWeight:700,fontSize:12}}>
                {t==="buyer"?"🏠 Buyer":"💰 Seller"}
              </button>
            ))}
          </div>
        </div>

        <CField label="FULL NAME" value={form.name} onChange={set("name")} placeholder="Sarah & Mike Johnson"/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <CField label="PHONE" value={form.phone} onChange={set("phone")} placeholder="+1 305 555 0100"/>
          <CField label="EMAIL" value={form.email} onChange={set("email")} placeholder="sarah@email.com"/>
          <CField label="PROPERTY INTEREST" value={form.property} onChange={set("property")} placeholder="3bd/2ba in Coconut Grove"/>
          <CField label="BUDGET" value={form.budget} onChange={set("budget")} placeholder="$800k - $1.1M"/>
          <CField label="TIMELINE" value={form.timeline} onChange={set("timeline")} placeholder="60-90 days"/>
          <CField label="MOTIVATION" value={form.motivation} onChange={set("motivation")} placeholder="Relocating for work, must move"/>
        </div>

        {/* Stage selector */}
        <div style={{marginBottom:10}}>
          <div style={{fontSize:9,color:C.textDim,letterSpacing:1.5,fontFamily:C.F,fontWeight:700,marginBottom:7}}>PIPELINE STAGE</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {STAGES.map(s=>(
              <button key={s.id} onClick={()=>set("stage")(s.id)}
                style={{padding:"8px 4px",borderRadius:8,
                  border:`1px solid ${form.stage===s.id?s.color+"55":C.border}`,
                  background:form.stage===s.id?`${s.color}10`:"transparent",
                  color:form.stage===s.id?s.color:C.textDim,cursor:"pointer",
                  fontFamily:C.F,fontSize:10,fontWeight:700,textAlign:"center"}}>
                <div style={{fontSize:14,marginBottom:3}}>{s.icon}</div>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <CField label="LAST CONTACT DATE" value={form.lastContact} onChange={set("lastContact")} placeholder="2026-06-28"/>
        <CField label="NEXT ACTION" value={form.nextAction} onChange={set("nextAction")} placeholder="Schedule showing for Thursday..."/>
        <CField label="NOTES" value={form.notes} onChange={set("notes")} placeholder="Loves open floor plans, allergic to cats, husband works downtown..." area rows={3}/>
      </CCard>

      <div style={{display:"flex",gap:10}}>
        <CBtn onClick={()=>onSave(form)} color={C.indigo}>
          {isEdit?"✓ Save Changes":"+ Add to Pipeline"}
        </CBtn>
        {onDelete&&(
          <button onClick={()=>{ if(window.confirm("Delete this client?")) onDelete(); }}
            style={{background:"transparent",border:`1px solid ${C.rose}44`,color:C.rose,
              borderRadius:9,padding:"12px 18px",cursor:"pointer",fontFamily:C.F,
              fontWeight:700,fontSize:13,flexShrink:0}}>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 2 — DEAL NOTES & AI SUMMARIZER
// ─────────────────────────────────────────────────────────────────────────────
function DealNotes(){
  const [notes,  setNotes]  = useState("");
  const [context,setContext]= useState("");
  const [result, setResult] = useState(null);
  const [loading,setLoading]= useState(false);

  async function generate(){
    if(!notes.trim()){ alert("Paste your notes first"); return; }
    setLoading(true);
    try{
      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, a real estate AI. Extract structured client intelligence from raw agent notes. Return ONLY valid JSON.",
          messages:[{role:"user",content:
            `Extract intelligence from these raw real estate notes:
Notes: "${notes}"
${context?`Additional context: ${context}`:""}

Return ONLY valid JSON:
{"summary":"2-3 sentence plain English summary of where this client/deal stands","key_concerns":["top 3 concerns or objections the client expressed"],"buying_signals":["specific signals indicating readiness to move forward — or empty array if none"],"timeline_indicators":"what the notes suggest about their actual timeline","motivation_level":"high/medium/low with one sentence explanation","recommended_next_steps":["3 specific next actions ranked by priority"],"follow_up_message":"exact message to send this client based on what was discussed — ready to copy","red_flags":["any warning signs that could cause this deal to fall apart — or empty array if none"],"action_today":"the single most important thing to do TODAY"}`
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
      <CCard accent={C.cyan}>
        <CLabel color={C.cyan}>PASTE YOUR NOTES</CLabel>
        <p style={{fontFamily:C.F,fontSize:11,color:C.textDim,margin:"0 0 12px",lineHeight:1.6}}>
          Paste in rough notes from any client interaction — showing feedback, phone call notes, text thread, open house conversation. SPARK extracts the intelligence.
        </p>
        <CField label="RAW NOTES" value={notes} onChange={setNotes}
          placeholder="Sarah called today, said she loved the Brickell condo but thought the price was too high. Husband isn't fully on board yet. They're also looking at a place in Wynwood. Mentioned they need to be moved in before August. Kids starting school. She seemed excited but hesitant..."
          area rows={6}/>
        <CField label="ADDITIONAL CONTEXT (optional)" value={context} onChange={setContext}
          placeholder="This is their 4th showing, budget is $650k, been looking 3 months..."/>
        <CBtn onClick={generate} loading={loading} color={C.cyan}>
          🧠 Extract Client Intelligence
        </CBtn>
      </CCard>

      {result&&(
        <div style={{animation:"scaleIn .25s ease"}}>
          {/* Summary */}
          <CCard accent={C.cyan}>
            <CLabel color={C.cyan}>SITUATION SUMMARY</CLabel>
            <p style={{fontFamily:C.F,fontSize:13,color:C.text,margin:0,lineHeight:1.7,fontWeight:500}}>
              {result.summary}
            </p>
          </CCard>

          {/* Action today — prominent */}
          <CCard accent={C.emerald}>
            <CLabel color={C.emerald}>ACTION TODAY</CLabel>
            <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,margin:0,lineHeight:1.6}}>
              {result.action_today}
            </p>
          </CCard>

          {/* Follow-up message */}
          <CCard accent={C.violet}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
              <CLabel color={C.violet}>FOLLOW-UP MESSAGE</CLabel>
              <CCopyBtn text={result.follow_up_message}/>
            </div>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>
              {result.follow_up_message}
            </p>
          </CCard>

          {/* Intelligence grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <CCard accent={C.amber} style={{marginBottom:0}}>
              <CLabel color={C.amber}>MOTIVATION</CLabel>
              <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,
                color:result.motivation_level?.startsWith("high")?C.emerald:result.motivation_level?.startsWith("med")?C.amber:C.rose}}>
                {result.motivation_level?.split(" ")[0]?.toUpperCase()}
              </div>
              <div style={{fontFamily:C.F,fontSize:10,color:C.textDim,marginTop:3,lineHeight:1.4}}>
                {result.motivation_level?.slice(result.motivation_level.indexOf(" ")+1)}
              </div>
            </CCard>
            <CCard accent={C.indigo} style={{marginBottom:0}}>
              <CLabel color={C.indigo}>TIMELINE</CLabel>
              <p style={{fontFamily:C.F,fontSize:11,color:C.textMd,margin:0,lineHeight:1.5}}>
                {result.timeline_indicators}
              </p>
            </CCard>
          </div>

          {/* Concerns, signals, flags, next steps */}
          {[
            {label:"KEY CONCERNS", items:result.key_concerns, color:C.rose},
            {label:"BUYING SIGNALS", items:result.buying_signals, color:C.emerald},
            {label:"RED FLAGS", items:result.red_flags, color:C.amber},
            {label:"RECOMMENDED NEXT STEPS", items:result.recommended_next_steps, color:C.indigo},
          ].filter(s=>s.items?.length>0).map((s,i)=>(
            <CCard key={i} accent={s.color}>
              <CLabel color={s.color}>{s.label}</CLabel>
              {s.items.map((item,j)=>(
                <div key={j} style={{display:"flex",gap:8,padding:"6px 0",
                  borderBottom:j<s.items.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:s.color,
                    marginTop:6,flexShrink:0}}/>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.5}}>{item}</p>
                </div>
              ))}
            </CCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 3 — AI DAILY BRIEFING
// ─────────────────────────────────────────────────────────────────────────────
function DailyBriefing(){
  const [briefing, setBriefing] = useState(()=>lsGet(BRIEFING_KEY, null));
  const [loading,  setLoading]  = useState(false);
  const [goals,    setGoals]    = useState({ monthlyGci:"", closingsNeeded:"", focusArea:"" });

  const today = new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  const clients = lsGet(LS_KEY, []);

  async function generateBriefing(){
    setLoading(true);
    try{
      const activeClients   = clients.filter(c=>c.stage==="active");
      const contractClients = clients.filter(c=>c.stage==="contract");
      const prospects       = clients.filter(c=>c.stage==="prospect");

      const overdueClients = clients.filter(c=>{
        if(!c.lastContact) return false;
        const days = Math.round((Date.now()-new Date(c.lastContact))/(1000*60*60*24));
        return days > 7;
      });

      const clientSummary = clients.length > 0
        ? clients.map(c=>`${c.name} (${c.stage}, last contact: ${c.lastContact||"unknown"}, notes: ${c.notes?.slice(0,100)||"none"})`).join("; ")
        : "No clients in pipeline yet";

      const r = await fetch("/api/claude",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          system:"You are SPARK, an elite real estate AI coach. Generate a personalized, motivating, action-oriented daily briefing. Be direct and specific. Return ONLY valid JSON.",
          messages:[{role:"user",content:
            `Generate a daily briefing for a real estate agent.
Today: ${today}
Pipeline: ${activeClients.length} active, ${contractClients.length} under contract, ${prospects.length} prospects
Overdue follow-ups (7+ days): ${overdueClients.map(c=>c.name).join(", ")||"none"}
Client details: ${clientSummary}
Agent goals: Monthly GCI target: ${goals.monthlyGci||"not set"}, Focus area: ${goals.focusArea||"not set"}

Return ONLY valid JSON:
{"greeting":"personalized good morning message — motivating, specific to their situation, 1-2 sentences","todays_priority":"the single most important thing to accomplish today — specific and actionable","pipeline_health":"honest 1-2 sentence assessment of their pipeline status","top_3_actions":["3 most important actions for today — each specific, with client names where relevant"],"follow_up_alerts":["clients who need immediate contact — name + why + suggested message opener"],"market_insight":"one timely real estate insight or strategy tip relevant to their situation","motivation":"one powerful motivating statement to start the day","schedule_suggestion":"suggested time blocks for the day — morning/midday/afternoon focus areas"}`
          }]
        })
      });
      const d = await r.json();
      const raw = d.content?.[0]?.text||"";
      const cleaned = raw.replace(/```json\n?/g,"").replace(/```\n?/g,"").trim();
      const first=cleaned.indexOf("{"); const last=cleaned.lastIndexOf("}");
      if(first!==-1&&last!==-1){
        const result = JSON.parse(cleaned.slice(first,last+1));
        const briefingData = { ...result, generatedAt: new Date().toISOString(), date: today };
        setBriefing(briefingData);
        lsSet(BRIEFING_KEY, briefingData);
      }
    }catch(e){ alert("Generation failed — try again"); }
    setLoading(false);
  }

  const isToday = briefing?.date === today;

  return(
    <div style={{animation:"fadeUp .35s ease"}}>
      {/* Goals (quick setup) */}
      {!briefing&&(
        <CCard accent={C.amber}>
          <CLabel color={C.amber}>QUICK SETUP (optional)</CLabel>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <CField label="MONTHLY GCI TARGET" value={goals.monthlyGci} onChange={v=>setGoals(p=>({...p,monthlyGci:v}))} placeholder="$30,000"/>
            <CField label="FOCUS AREA" value={goals.focusArea} onChange={v=>setGoals(p=>({...p,focusArea:v}))} placeholder="Buyer leads, Brickell"/>
          </div>
        </CCard>
      )}

      {/* Generate button */}
      {(!briefing||!isToday)&&(
        <CBtn onClick={generateBriefing} loading={loading} color={C.indigo}>
          ☀️ Generate Today's Briefing
        </CBtn>
      )}

      {briefing&&(
        <div style={{animation:"scaleIn .25s ease"}}>
          {/* Header */}
          <div style={{
            background:`linear-gradient(135deg,${C.indigo}14,${C.violet}0a)`,
            border:`1px solid ${C.indigo}28`,borderRadius:14,
            padding:"20px 18px",marginBottom:14}}>
            <div style={{fontSize:9,color:C.indigoLt,letterSpacing:2.5,fontFamily:C.F,
              fontWeight:700,marginBottom:6}}>
              {isToday?"TODAY'S BRIEFING":"LAST BRIEFING"} · {briefing.date?.toUpperCase()}
            </div>
            <p style={{fontFamily:C.F,fontSize:15,fontWeight:600,color:C.text,
              margin:"0 0 4px",lineHeight:1.6}}>{briefing.greeting}</p>
          </div>

          {/* Today's priority */}
          <CCard accent={C.emerald}>
            <CLabel color={C.emerald}>TODAY'S #1 PRIORITY</CLabel>
            <p style={{fontFamily:C.F,fontSize:14,fontWeight:700,color:C.text,
              margin:0,lineHeight:1.6}}>{briefing.todays_priority}</p>
          </CCard>

          {/* Pipeline health */}
          <CCard accent={C.cyan}>
            <CLabel color={C.cyan}>PIPELINE HEALTH</CLabel>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.7}}>
              {briefing.pipeline_health}
            </p>
          </CCard>

          {/* Top 3 actions */}
          <CCard accent={C.indigo}>
            <CLabel color={C.indigo}>TOP 3 ACTIONS TODAY</CLabel>
            {(briefing.top_3_actions||[]).map((action,i)=>(
              <div key={i} style={{display:"flex",gap:10,padding:"9px 0",
                borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
                <div style={{width:22,height:22,borderRadius:"50%",flexShrink:0,
                  background:`${C.indigo}18`,border:`1px solid ${C.indigo}28`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:10,color:C.indigo,fontWeight:700}}>{i+1}</div>
                <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,
                  lineHeight:1.5,alignSelf:"center"}}>{action}</p>
              </div>
            ))}
          </CCard>

          {/* Follow-up alerts */}
          {briefing.follow_up_alerts?.length>0&&(
            <CCard accent={C.rose}>
              <CLabel color={C.rose}>FOLLOW-UP ALERTS</CLabel>
              {briefing.follow_up_alerts.map((alert,i)=>(
                <div key={i} style={{display:"flex",gap:8,padding:"8px 0",
                  borderBottom:i<briefing.follow_up_alerts.length-1?`1px solid ${C.border}`:"none"}}>
                  <div style={{width:6,height:6,borderRadius:"50%",background:C.rose,
                    marginTop:5,flexShrink:0,boxShadow:`0 0 5px ${C.rose}`}}/>
                  <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.5}}>{alert}</p>
                </div>
              ))}
            </CCard>
          )}

          {/* Schedule */}
          <CCard accent={C.violet}>
            <CLabel color={C.violet}>SUGGESTED SCHEDULE</CLabel>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:0,lineHeight:1.8,whiteSpace:"pre-wrap"}}>
              {briefing.schedule_suggestion}
            </p>
          </CCard>

          {/* Market insight + motivation */}
          <CCard accent={C.amber}>
            <CLabel color={C.amber}>MARKET INSIGHT</CLabel>
            <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 14px",lineHeight:1.7}}>
              {briefing.market_insight}
            </p>
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:12}}>
              <p style={{fontFamily:C.F,fontSize:13,fontWeight:700,color:C.amber,
                margin:0,lineHeight:1.6,fontStyle:"italic"}}>
                "{briefing.motivation}"
              </p>
            </div>
          </CCard>

          {/* Refresh */}
          <CBtn onClick={generateBriefing} loading={loading} color={C.indigo}>
            ↻ Refresh Briefing
          </CBtn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOOL 4 — CSV IMPORT — bring in your existing CRM's client list
// ─────────────────────────────────────────────────────────────────────────────

// Dependency-free CSV parser — handles quoted fields, embedded commas/newlines,
// and escaped quotes ("") so this works on real-world exports without adding
// a new npm dependency.
function parseCSV(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for(let i=0; i<text.length; i++){
    const ch = text[i], next = text[i+1];
    if(inQuotes){
      if(ch==='"' && next==='"'){ field+='"'; i++; }
      else if(ch==='"'){ inQuotes=false; }
      else field += ch;
    } else {
      if(ch==='"') inQuotes = true;
      else if(ch===','){ row.push(field); field=""; }
      else if(ch==='\n'||ch==='\r'){
        if(ch==='\r' && next==='\n') i++;
        row.push(field); field="";
        if(row.length>1||row[0]!=="") rows.push(row);
        row=[];
      } else field += ch;
    }
  }
  if(field!==""||row.length>0){ row.push(field); rows.push(row); }
  if(rows.length===0) return { headers:[], rows:[] };
  return { headers: rows[0].map(h=>h.trim()), rows: rows.slice(1).filter(r=>r.some(c=>c.trim()!=="")) };
}

// Fuzzy header matching — different CRMs name columns differently
// (Follow Up Boss: "First Name"/"Last Name", kvCORE: "Name", Google
// Contacts export: "Given Name" — this covers the common patterns).
const FIELD_PATTERNS = {
  name:      [/^full ?name$/i, /^name$/i, /^client ?name$/i, /^contact ?name$/i],
  firstName: [/^first ?name$/i, /^given ?name$/i, /^fname$/i],
  lastName:  [/^last ?name$/i, /^family ?name$/i, /^surname$/i, /^lname$/i],
  email:     [/^e-?mail/i, /^primary ?e-?mail/i, /^email ?1$/i],
  phone:     [/^phone/i, /^mobile/i, /^cell/i, /^phone ?1$/i, /^primary ?phone/i],
  type:      [/^type$/i, /^lead ?type$/i, /^client ?type$/i, /^role$/i],
  stage:     [/^stage$/i, /^status$/i, /^lead ?status$/i, /^pipeline ?stage$/i],
  property:  [/^property/i, /^address/i, /^listing/i],
  notes:     [/^notes?$/i, /^description$/i, /^comments?$/i, /^remarks?$/i],
  budget:    [/^budget$/i, /^price ?range$/i, /^value$/i],
  timeline:  [/^timeline$/i, /^timeframe$/i],
};

function autoDetectMapping(headers){
  const mapping = {};
  for(const [field, patterns] of Object.entries(FIELD_PATTERNS)){
    const match = headers.find(h=>patterns.some(p=>p.test(h.trim())));
    if(match) mapping[field] = match;
  }
  return mapping;
}

function normalizeStage(raw){
  const v = (raw||"").toLowerCase().trim();
  if(!v) return "prospect";
  if(/closed|sold|won/.test(v)) return "closed";
  if(/contract|pending|escrow/.test(v)) return "contract";
  if(/active|client|working|hot|warm/.test(v)) return "active";
  return "prospect";
}
function normalizeType(raw){
  const v = (raw||"").toLowerCase().trim();
  if(/sell/.test(v)) return "seller";
  return "buyer";
}

function ClientImport({ user, onImported }){
  const [file, setFile] = useState(null);
  const [parsed, setParsed] = useState(null);      // { headers, rows }
  const [mapping, setMapping] = useState({});
  const [step, setStep] = useState("upload");        // upload | map | preview | done
  const [importing, setImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const fileInputRef = useRef(null);

  function handleFile(f){
    if(!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = e=>{
      const result = parseCSV(e.target.result);
      setParsed(result);
      setMapping(autoDetectMapping(result.headers));
      setStep("map");
    };
    reader.readAsText(f);
  }

  function buildPreviewClients(){
    if(!parsed) return [];
    const existing = lsGet(LS_KEY, []);
    const existingContacts = new Set(existing.flatMap(c=>[c.email?.toLowerCase(), c.phone?.replace(/\D/g,"")].filter(Boolean)));

    return parsed.rows.map(row=>{
      const get = field=>{
        const header = mapping[field];
        if(!header) return "";
        const idx = parsed.headers.indexOf(header);
        return idx>=0 ? (row[idx]||"").trim() : "";
      };
      let name = get("name");
      if(!name){
        const first = get("firstName"), last = get("lastName");
        name = [first,last].filter(Boolean).join(" ");
      }
      const email = get("email");
      const phone = get("phone");
      const isDuplicate = (email && existingContacts.has(email.toLowerCase())) ||
                           (phone && existingContacts.has(phone.replace(/\D/g,"")));
      return {
        name: name || "(no name)",
        email, phone,
        type: normalizeType(get("type")),
        stage: normalizeStage(get("stage")),
        property: get("property"),
        budget: get("budget"),
        timeline: get("timeline"),
        notes: get("notes"),
        isDuplicate,
        hasName: !!name,
      };
    });
  }

  function handleImport(skipDuplicates){
    setImporting(true);
    const preview = buildPreviewClients();
    const toImport = preview.filter(c=>c.hasName && (!skipDuplicates || !c.isDuplicate));
    const existing = lsGet(LS_KEY, []);
    const now = new Date().toISOString();
    const newClients = toImport.map((c,i)=>({
      id: `import_${Date.now()}_${i}`,
      name:c.name, phone:c.phone, email:c.email, type:c.type, stage:c.stage,
      property:c.property, budget:c.budget, timeline:c.timeline,
      motivation:"", notes:c.notes, lastContact:now,
      nextAction:"Reach out to confirm details after import", aiAction:"",
      createdAt:now, source:"csv_import",
    }));
    const merged = [...existing, ...newClients];
    lsSet(LS_KEY, merged);
    if(user?.email) cloudSync(user.email, { clients: merged });

    setImportedCount(newClients.length);
    setSkippedCount(preview.length - newClients.length);
    setStep("done");
    setImporting(false);
    onImported?.(merged);
  }

  const preview = step==="preview" ? buildPreviewClients() : [];
  const validCount = preview.filter(c=>c.hasName).length;
  const dupCount = preview.filter(c=>c.hasName && c.isDuplicate).length;

  return(
    <CCard accent={C.emerald}>
      <div style={{fontFamily:C.F,fontWeight:700,fontSize:14,color:C.text,marginBottom:6}}>
        Import from your current CRM
      </div>
      <p style={{fontFamily:C.F,fontSize:12,color:C.textMd,margin:"0 0 18px",lineHeight:1.6}}>
        Export your contacts as a CSV from Follow Up Boss, kvCORE, Wise Agent, Google Contacts, or any spreadsheet — SPARK will read it and bring your whole book of business in, in one shot.
      </p>

      {step==="upload"&&(
        <div>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{display:"none"}}
            onChange={e=>handleFile(e.target.files?.[0])}/>
          <button onClick={()=>fileInputRef.current?.click()}
            style={{width:"100%",background:"rgba(16,185,129,.06)",border:`2px dashed ${C.emerald}40`,
              borderRadius:12,padding:"32px 20px",cursor:"pointer",textAlign:"center"}}>
            <div style={{fontSize:32,marginBottom:10}}>📁</div>
            <div style={{fontFamily:C.F,fontWeight:700,fontSize:13,color:C.emerald,marginBottom:4}}>
              Click to choose a CSV file
            </div>
            <div style={{fontFamily:C.F,fontSize:11,color:C.textDim}}>
              Or drag and drop it here
            </div>
          </button>
        </div>
      )}

      {step==="map"&&parsed&&(
        <div>
          <div style={{fontFamily:C.F,fontSize:11,color:C.textDim,marginBottom:14}}>
            Found {parsed.rows.length} rows in {file?.name}. Confirm the columns look right — SPARK auto-detected these:
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
            {Object.entries(FIELD_PATTERNS).filter(([f])=>["name","firstName","lastName","email","phone","type","stage"].includes(f)).map(([field])=>(
              <div key={field} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:90,fontFamily:C.F,fontSize:11,color:C.textMd,fontWeight:600,flexShrink:0,textTransform:"capitalize"}}>
                  {field.replace(/([A-Z])/g," $1")}
                </div>
                <select value={mapping[field]||""} onChange={e=>setMapping(m=>({...m,[field]:e.target.value||undefined}))}
                  style={{flex:1,background:C.surfaceUp,border:`1px solid ${C.border}`,borderRadius:7,
                    padding:"6px 10px",color:C.text,fontFamily:C.F,fontSize:11,outline:"none"}}>
                  <option value="">— not mapped —</option>
                  {parsed.headers.map(h=><option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>{ setStep("upload"); setParsed(null); }}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,
                borderRadius:8,padding:"9px 16px",cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:12}}>
              Start over
            </button>
            <button onClick={()=>setStep("preview")}
              style={{flex:1,background:`linear-gradient(135deg,${C.emerald},${C.cyan})`,border:"none",
                color:"#fff",borderRadius:8,padding:"9px 16px",cursor:"pointer",fontFamily:C.F,fontWeight:700,fontSize:12}}>
              Preview Import →
            </button>
          </div>
        </div>
      )}

      {step==="preview"&&(
        <div>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <div style={{flex:1,background:"rgba(16,185,129,.06)",border:`1px solid ${C.emerald}20`,borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
              <div style={{fontFamily:C.F,fontWeight:800,fontSize:18,color:C.emerald}}>{validCount}</div>
              <div style={{fontFamily:C.F,fontSize:9,color:C.textDim}}>ready to import</div>
            </div>
            {dupCount>0&&(
              <div style={{flex:1,background:"rgba(245,158,11,.06)",border:`1px solid ${C.amber}20`,borderRadius:9,padding:"10px 12px",textAlign:"center"}}>
                <div style={{fontFamily:C.F,fontWeight:800,fontSize:18,color:C.amber}}>{dupCount}</div>
                <div style={{fontFamily:C.F,fontSize:9,color:C.textDim}}>possible duplicates</div>
              </div>
            )}
          </div>

          <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:9,marginBottom:14}}>
            {preview.slice(0,50).map((c,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 11px",
                borderBottom:i<preview.length-1?`1px solid ${C.border}`:"none",
                opacity:c.hasName?1:.4}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontFamily:C.F,fontSize:11,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                    {c.name}
                  </div>
                  <div style={{fontFamily:C.F,fontSize:9,color:C.textDim}}>
                    {c.email||c.phone||"no contact info"} · {c.type} · {c.stage}
                  </div>
                </div>
                {c.isDuplicate&&(
                  <span style={{fontSize:8,color:C.amber,fontFamily:C.F,fontWeight:700,
                    background:`${C.amber}14`,border:`1px solid ${C.amber}28`,borderRadius:6,padding:"1px 6px"}}>
                    DUPLICATE?
                  </span>
                )}
              </div>
            ))}
            {preview.length>50&&(
              <div style={{padding:"8px 11px",textAlign:"center",fontFamily:C.F,fontSize:10,color:C.textDim}}>
                + {preview.length-50} more rows
              </div>
            )}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep("map")} disabled={importing}
              style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textDim,
                borderRadius:8,padding:"9px 16px",cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:12}}>
              Back
            </button>
            {dupCount>0&&(
              <button onClick={()=>handleImport(true)} disabled={importing}
                style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.textMd,
                  borderRadius:8,padding:"9px 14px",cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:11}}>
                Skip duplicates
              </button>
            )}
            <button onClick={()=>handleImport(false)} disabled={importing}
              style={{flex:1,background:importing?"rgba(255,255,255,.05)":`linear-gradient(135deg,${C.emerald},${C.cyan})`,
                border:"none",color:importing?C.textDim:"#fff",borderRadius:8,padding:"9px 16px",
                cursor:importing?"default":"pointer",fontFamily:C.F,fontWeight:700,fontSize:12}}>
              {importing?"Importing...":`Import ${validCount} Clients`}
            </button>
          </div>
        </div>
      )}

      {step==="done"&&(
        <div style={{textAlign:"center",padding:"20px 0"}}>
          <div style={{fontSize:40,marginBottom:14}}>✅</div>
          <div style={{fontFamily:C.F,fontWeight:700,fontSize:15,color:C.text,marginBottom:6}}>
            {importedCount} client{importedCount!==1?"s":""} imported
          </div>
          <p style={{fontFamily:C.F,fontSize:12,color:C.textDim,margin:"0 0 18px"}}>
            {skippedCount>0?`${skippedCount} skipped (missing name or excluded as duplicates). `:""}
            Head to your Pipeline to see them, or let Autopilot analyze your business now that it has real data.
          </p>
          <button onClick={()=>{ setStep("upload"); setFile(null); setParsed(null); setMapping({}); }}
            style={{background:"rgba(255,255,255,.05)",border:`1px solid ${C.border}`,color:C.textMd,
              borderRadius:8,padding:"9px 20px",cursor:"pointer",fontFamily:C.F,fontWeight:600,fontSize:12}}>
            Import another file
          </button>
        </div>
      )}
    </CCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLIENT PANEL
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientPanel({ user, planKey }){
  const [tool, setTool] = useState("briefing");

  const TOOLS=[
    {id:"briefing",  label:"Daily Briefing", icon:"☀️", color:C.indigo,  desc:"Your AI morning action plan"},
    {id:"pipeline",  label:"Pipeline",       icon:"📊", color:C.violet,  desc:"Track & manage all clients"},
    {id:"notes",     label:"Note Analyzer",  icon:"🧠", color:C.cyan,    desc:"Turn rough notes into intel"},
    {id:"import",    label:"Import CRM",     icon:"📥", color:C.emerald, desc:"Bring in your existing clients"},
  ];

  return(
    <div style={{paddingBottom:40}}>
      {/* Tool selector */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:20}}>
        {TOOLS.map(t=>(
          <div key={t.id} onClick={()=>setTool(t.id)}
            style={{padding:"13px 10px",borderRadius:12,cursor:"pointer",textAlign:"center",
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

      {tool==="briefing" && <DailyBriefing/>}
      {tool==="pipeline" && <ClientPipeline user={user}/>}
      {tool==="notes"    && <DealNotes/>}
      {tool==="import"   && <ClientImport user={user}/>}
    </div>
  );
}
