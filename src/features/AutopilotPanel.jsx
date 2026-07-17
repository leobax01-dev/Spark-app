// TEST VERSION - minimal to verify deployment pipeline
import { useState } from "react";

const apLsGet=(key,fb)=>{ try{ const v=localStorage.getItem(key); return v?JSON.parse(v):fb; }catch(e){ return fb; } };

export default function AutopilotPanel({ user, voice, planKey, onNavigate }){
  const [count, setCount] = useState(0);
  const stored = apLsGet("sp_plan","trial");
  return(
    <div style={{padding:32,color:"white",fontFamily:"sans-serif"}}>
      <h2>✅ Autopilot loaded successfully</h2>
      <p>Plan: {planKey}</p>
      <p>Stored plan: {stored}</p>
      <p>User: {user?.email}</p>
      <button onClick={()=>setCount(c=>c+1)} 
        style={{background:"#6366f1",border:"none",color:"white",
          padding:"8px 16px",borderRadius:8,cursor:"pointer",marginTop:16}}>
        Clicks: {count}
      </button>
    </div>
  );
}
