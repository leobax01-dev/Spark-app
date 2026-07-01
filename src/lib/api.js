import { C, PLANS, CONTENT_TYPES, PLATFORMS, INPUT_META, TYPE_INPUTS, LS } from './constants';

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
export { callClaude, callHiggsfieldImg, callHiggsfieldTxt, pollHiggsfield };
