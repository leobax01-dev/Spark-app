import { useState, useEffect } from "react";
import { C, GLOBAL_CSS, LS } from './lib/constants.js';
import { initAnalytics } from './lib/analytics.js';
import { ToastContainer } from './components/ui/Toast.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import MainApp from './pages/MainApp.jsx';

const FONTS_URL = "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap";

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

export default function App(){
  useStyles();
  const [screen,setScreen]   =useState("landing");
  const [authMode,setAuthMode]=useState("signup");
  const [user,setUser]       =useState(null);

  useEffect(()=>{
    initAnalytics();
  },[]);

  useEffect(()=>{
    if(window.__supabase) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    const key = import.meta.env.VITE_SUPABASE_KEY;
    if(!url||!key) return;
    import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm").then(({createClient})=>{
      window.__supabase = createClient(url, key);
    }).catch(()=>{});
  },[]);

  return(
    <>
      <ToastContainer/>
      {screen==="landing" && <LandingPage onStart={m=>{ setAuthMode(m); setScreen("auth"); }}/>}
      {screen==="auth"    && <AuthPage mode={authMode} onAuth={u=>{ setUser(u); setScreen("app"); }} onSwitch={()=>setAuthMode(m=>m==="login"?"signup":"login")}/>}
      {screen==="app"&&user && <MainApp user={user} onLogout={()=>{ LS.del("sp_onboarded"); setUser(null); setScreen("landing"); }}/>}
      {screen!=="landing"&&screen!=="auth"&&(!user||screen!=="app") && <div style={{minHeight:"100vh",background:"#04040a"}}/>}
    </>
  );
}
