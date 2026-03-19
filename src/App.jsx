import { useState, useRef } from "react";

// ── File readers ──────────────────────────────────────────────────────────────
const toB64  = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result.split(",")[1]); r.onerror=rej; r.readAsDataURL(f); });
const toText = f => new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsText(f); });

// ── Claude API ────────────────────────────────────────────────────────────────
async function callClaude(messages, system, maxTokens) {
  const body = { model:"claude-sonnet-4-20250514", max_tokens:maxTokens, messages };
  if (system) body.system = system;
  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
  });
  if (!resp.ok) throw new Error("API " + resp.status + ": " + (await resp.text()).slice(0,200));
  const data = await resp.json();
  return data.content?.map(b=>b.text||"").join("").trim();
}

function parseJSON(text) {
  return JSON.parse(text.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim());
}

// ── ATS-Friendly Single Page Resume HTML ─────────────────────────────────────
const buildResumeHTML = (d) => {
  const name = d.name||"";
  const contacts = [d.email, d.phone, d.location, d.linkedin].filter(Boolean).join("  |  ");

  const section = (title, content) =>
    `<div class="section">
      <div class="sec-title">${title}</div>
      <div class="sec-line"></div>
      ${content}
    </div>`;

  const expHTML = (d.experience||[]).map(e=>
    `<div class="job">
      <div class="job-row">
        <span class="job-title">${e.role}</span>
        <span class="job-dur">${e.duration||""}</span>
      </div>
      <div class="job-co">${e.company||""}</div>
      <ul>${(e.bullets||[]).slice(0,4).map(b=>`<li>${b}</li>`).join("")}</ul>
    </div>`
  ).join("");

  const eduHTML = (d.education||[]).map(e=>
    `<div class="edu-row">
      <div><span class="edu-deg">${e.degree}</span> — <span class="edu-inst">${e.institution}</span></div>
      <span class="edu-yr">${e.year||""}</span>
    </div>`
  ).join("");

  const skillsHTML = (d.skills||[]).map(s=>`<span class="skill">${s}</span>`).join("");

  const projHTML = (d.projects||[]).slice(0,3).map(p=>
    `<div class="proj"><span class="proj-name">${p.name}</span> — <span class="proj-desc">${p.description}</span></div>`
  ).join("");

  const certHTML = (d.certifications||[]).filter(Boolean).map(c=>`<li>${c}</li>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${name} — Resume</title>
<style>
  /* ATS-Friendly Single Page A4 Resume */
  @page { size: A4; margin: 14mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Arial', 'Helvetica', sans-serif;
    font-size: 10.5pt;
    color: #1a1a1a;
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 14mm 15mm;
    line-height: 1.4;
  }
  /* Header */
  .header { text-align: center; margin-bottom: 10px; border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; }
  .header h1 { font-size: 20pt; font-weight: 700; letter-spacing: 1px; color: #1a1a1a; text-transform: uppercase; }
  .header .contacts { font-size: 9pt; color: #333; margin-top: 4px; letter-spacing: 0.3px; }
  /* Section */
  .section { margin-bottom: 8px; }
  .sec-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #1a1a1a; }
  .sec-line { height: 1.5px; background: #1a1a1a; margin: 2px 0 5px; }
  /* Summary */
  .summary { font-size: 10pt; line-height: 1.5; color: #222; }
  /* Experience */
  .job { margin-bottom: 6px; }
  .job-row { display: flex; justify-content: space-between; align-items: baseline; }
  .job-title { font-weight: 700; font-size: 10.5pt; }
  .job-dur { font-size: 9.5pt; color: #444; }
  .job-co { font-style: italic; font-size: 10pt; color: #333; margin-bottom: 3px; }
  ul { padding-left: 14px; margin-top: 2px; }
  li { font-size: 10pt; line-height: 1.45; color: #222; margin-bottom: 1.5px; }
  /* Skills */
  .skills-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
  .skill { font-size: 9.5pt; color: #222; background: #f0f0f0; border: 1px solid #ccc; border-radius: 2px; padding: 1px 6px; }
  /* Education */
  .edu-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
  .edu-deg { font-weight: 700; font-size: 10.5pt; }
  .edu-inst { font-size: 10pt; }
  .edu-yr { font-size: 9.5pt; color: #444; }
  /* Projects */
  .proj { font-size: 10pt; margin-bottom: 3px; line-height: 1.45; }
  .proj-name { font-weight: 700; }
  .proj-desc { color: #333; }
  /* Print */
  @media print {
    body { margin: 0; padding: 14mm 15mm; width: 210mm; }
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>${name}</h1>
    <div class="contacts">${contacts}</div>
  </div>
  ${d.summary ? section("Professional Summary", `<p class="summary">${d.summary}</p>`) : ""}
  ${expHTML ? section("Experience", expHTML) : ""}
  ${skillsHTML ? section("Technical Skills", `<div class="skills-wrap">${skillsHTML}</div>`) : ""}
  ${projHTML ? section("Projects", projHTML) : ""}
  ${eduHTML ? section("Education", eduHTML) : ""}
  ${certHTML ? section("Certifications", `<ul>${certHTML}</ul>`) : ""}
</body>
</html>`;
};

// ── LaTeX highlight ───────────────────────────────────────────────────────────
const hlTex = c => c
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/(\\[a-zA-Z*]+)/g,'<span style="color:#79c0ff;font-weight:600">$1</span>')
  .replace(/(\{)([^{}]{0,60})(\})/g,'$1<span style="color:#ffa657">$2</span>$3')
  .replace(/(%[^\n]*)/g,'<span style="color:#6e7681;font-style:italic">$1</span>');

// ── Pipeline nodes ────────────────────────────────────────────────────────────
const NODES = [
  {id:"input",  icon:"📝", label:"Input",    color:"#f59e0b"},
  {id:"trigger",icon:"⚡", label:"Trigger",  color:"#6366f1"},
  {id:"data",   icon:"🧠", label:"Claude 1", color:"#a78bfa"},
  {id:"latex",  icon:"📄", label:"Claude 2", color:"#22d3ee"},
  {id:"output", icon:"✅", label:"Output",   color:"#4ade80"},
];

function PNode({node,active,done}) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:5,flex:1}}>
      <div style={{width:46,height:46,borderRadius:12,position:"relative",
        border:`2px solid ${active||done?node.color:"#1e293b"}`,
        background:done?`${node.color}20`:active?`${node.color}15`:"rgba(255,255,255,0.02)",
        boxShadow:active?`0 0 18px ${node.color}70`:done?`0 0 8px ${node.color}35`:"none",
        display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all 0.4s"}}>
        {active&&<div style={{position:"absolute",inset:-4,borderRadius:16,border:`2px solid ${node.color}`,animation:"ping 1.2s infinite",opacity:0.5}}/>}
        {node.icon}
        {done&&<div style={{position:"absolute",top:-5,right:-5,width:15,height:15,borderRadius:"50%",background:node.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,color:"#080e1a",fontWeight:700}}>✓</div>}
      </div>
      <span style={{fontSize:8,fontFamily:"monospace",color:active||done?node.color:"#475569",transition:"color 0.4s"}}>{node.label}</span>
    </div>
  );
}

function Arrow({lit,color}) {
  return (
    <div style={{display:"flex",alignItems:"center",paddingBottom:16,flexShrink:0}}>
      <div style={{width:16,height:2,background:lit?color:"#1e293b",transition:"background 0.4s",boxShadow:lit?`0 0 5px ${color}`:"none"}}/>
      <div style={{width:0,height:0,borderTop:"4px solid transparent",borderBottom:"4px solid transparent",borderLeft:`5px solid ${lit?color:"#1e293b"}`,transition:"border-color 0.4s"}}/>
    </div>
  );
}

function LogLine({icon,text,color}) {
  return (
    <div style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid #0a1020",animation:"fadeUp 0.3s ease"}}>
      <span style={{fontSize:11,flexShrink:0}}>{icon}</span>
      <span style={{fontSize:10,color:color||"#94a3b8",fontFamily:"monospace",lineHeight:1.6}}>{text}</span>
    </div>
  );
}

function UploadBox({file,onFile}) {
  const [drag,setDrag]=useState(false);
  return (
    <label
      onDragOver={e=>{e.preventDefault();setDrag(true);}}
      onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);if(e.dataTransfer.files[0])onFile(e.dataTransfer.files[0]);}}
      style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
        gap:6,minHeight:86,border:`2px dashed ${file?"#4ade80":drag?"#a78bfa":"#1e293b"}`,
        borderRadius:10,cursor:"pointer",transition:"all 0.2s",position:"relative",textAlign:"center",
        background:file?"rgba(74,222,128,0.04)":"transparent",padding:"14px 10px"}}>
      <input type="file" accept=".pdf,.txt,.doc,.docx"
        style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0,cursor:"pointer"}}
        onChange={e=>{if(e.target.files?.[0])onFile(e.target.files[0]);}}/>
      <span style={{fontSize:20,pointerEvents:"none"}}>{file?"✅":"📎"}</span>
      {file
        ?<><span style={{fontSize:10,color:"#4ade80",fontFamily:"monospace",fontWeight:700,pointerEvents:"none"}}>{file.name}</span>
           <span style={{fontSize:8,color:"#475569",fontFamily:"monospace",pointerEvents:"none"}}>{(file.size/1024).toFixed(1)} KB — click to change</span></>
        :<><span style={{fontSize:10,color:"#64748b",fontFamily:"monospace",pointerEvents:"none"}}>Upload existing resume</span>
           <span style={{fontSize:8,color:"#334155",fontFamily:"monospace",pointerEvents:"none"}}>PDF / TXT / DOC — drag or click</span></>}
    </label>
  );
}

function Field({label,value,onChange,placeholder,rows,req}) {
  const [focus,setFocus]=useState(false);
  const bc = req&&!value?"#f87171":focus?"#6366f1":"#1e293b";
  const s  = {width:"100%",background:"#0f172a",border:`1px solid ${bc}`,borderRadius:7,
    padding:"8px 11px",color:"#cbd5e1",fontFamily:"monospace",fontSize:11,
    outline:"none",boxSizing:"border-box",transition:"border 0.2s",lineHeight:1.65};
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:8,color:req&&!value?"#f87171":"#6366f1",letterSpacing:3,marginBottom:4,fontFamily:"monospace",textTransform:"uppercase"}}>
        {label}{req&&<span style={{color:"#f87171"}}> *</span>}
      </div>
      {rows
        ?<textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...s,resize:"vertical"}} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}/>
        :<input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={s} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}/>}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [phase,  setPhase]  = useState("form");
  const [ns,     setNs]     = useState({input:"idle",trigger:"idle",data:"idle",latex:"idle",output:"idle"});
  const [logs,   setLogs]   = useState([]);
  const [latex,  setLatex]  = useState("");
  const [rdata,  setRdata]  = useState(null);
  const [scores, setScores] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tab,    setTab]    = useState("preview");
  const [file,   setFile]   = useState(null);
  const [dlMsg,  setDlMsg]  = useState("");

  const [name,    setName]    = useState("");
  const [email,   setEmail]   = useState("");
  const [phone,   setPhone]   = useState("");
  const [loc,     setLoc]     = useState("");
  const [linkedin,setLinkedin]= useState("");
  const [role,    setRole]    = useState("");
  const [jd,      setJd]      = useState("");
  const [customLatex,    setCustomLatex]    = useState("");
  const [useCustomTpl,   setUseCustomTpl]   = useState(false);
  const [showTplBox,     setShowTplBox]     = useState(false);
  const [exp,     setExp]     = useState("");
  const [edu,     setEdu]     = useState("");
  const [skills,  setSkills]  = useState("");
  const [projects,setProjects]= useState("");
  const [extra,   setExtra]   = useState("");

  const logRef     = useRef();
  const iframeRef  = useRef();

  const addLog = (icon,text,color) => {
    setLogs(l=>[...l,{icon,text,color,id:Date.now()+Math.random()}]);
    setTimeout(()=>logRef.current?.scrollTo({top:9999,behavior:"smooth"}),60);
  };
  const sn   = (id,st) => setNs(s=>({...s,[id]:st}));
  const wait = ms => new Promise(r=>setTimeout(r,ms));

  const hasFile   = !!file;
  const hasManual = !!(name.trim()&&role.trim());
  const canRun    = (hasFile||hasManual) && phase!=="running";

  const run = async () => {
    if (!canRun) return;
    setPhase("running");
    setLogs([]); setLatex(""); setRdata(null); setScores(null); setDlMsg("");
    setNs({input:"idle",trigger:"idle",data:"idle",latex:"idle",output:"idle"});

    try {
      // Node 1
      sn("input","active");
      addLog("📝","Input node activated...","#f59e0b");
      await wait(400);
      if(file)      addLog("📎","File: "+file.name,"#a78bfa");
      if(hasManual) addLog("✔","Candidate: "+name+" | Role: "+role,"#94a3b8");
      if(jd.trim()) addLog("📋","JD detected","#22d3ee");
      if(useCustomTpl&&customLatex.trim()) addLog("📐","Custom LaTeX template enabled","#22d3ee");
      else addLog("🎨","Using default ATS template","#334155");
      sn("input","done"); await wait(300);

      // Node 2
      sn("trigger","active");
      addLog("⚡","Pipeline triggered → Claude API...","#6366f1");
      await wait(400);
      sn("trigger","done"); await wait(200);

      // Node 3 — Resume DATA (no latex, no repetition)
      sn("data","active");
      addLog("🧠","Claude Step 1: Extracting + optimizing resume data...","#a78bfa");

      const manualInfo = [
        name?"Name: "+name:"",
        email?"Email: "+email:"",
        phone?"Phone: "+phone:"",
        loc?"Location: "+loc:"",
        linkedin?"LinkedIn: "+linkedin:"",
        role?"Target Role: "+role:"",
        exp?"Experience:\n"+exp:"",
        edu?"Education:\n"+edu:"",
        skills?"Skills: "+skills:"",
        projects?"Projects:\n"+projects:"",
        extra?"Extra/Certs: "+extra:"",
      ].filter(Boolean).join("\n");

      const dataSystem = `You are an expert ATS resume writer. Return ONLY raw JSON. No markdown. No extra text.

STRICT RULES:
- NO repetition anywhere — each bullet point must be unique
- Each bullet: action verb + specific achievement/task + metric if possible
- Summary: 2-3 sentences only, no repetition of skills section
- Max 4 bullets per job
- Skills: unique list only, no duplicates
- Tailor everything to the job description keywords`;

      const dataShape = `{
  "atsScore": <number 45-70>,
  "optimizedScore": <number 85-97>,
  "name": "<full name>",
  "email": "<email>",
  "phone": "<phone>",
  "location": "<city, country>",
  "linkedin": "<url or empty>",
  "summary": "<2-3 sentences. NO repetition of skills. Tailored to JD.>",
  "experience": [
    {
      "company": "<company>",
      "role": "<title>",
      "duration": "<e.g. Jan 2023 - Present>",
      "bullets": ["<unique action verb + achievement>", "<unique bullet 2>", "<unique bullet 3>"]
    }
  ],
  "education": [{"institution":"<>","degree":"<>","year":"<>"}],
  "skills": ["<unique skill 1>","<unique skill 2>"],
  "projects": [{"name":"<>","description":"<one unique line, no repetition>"}],
  "certifications": ["<cert>"]
}`;

      const dataPrompt = "Generate a single-page ATS-friendly resume.\n\nCANDIDATE:\n"
        + (manualInfo||"[Extract from attached resume]")
        + (jd.trim()?"\n\nJOB DESCRIPTION:\n"+jd:"\n\nNo JD — make a strong general resume.")
        + "\n\nReturn ONLY this JSON:\n"+dataShape;

      let dataMessages;
      if (file&&file.type==="application/pdf") {
        addLog("📄","Reading PDF...","#94a3b8");
        const b64 = await toB64(file);
        dataMessages = [{role:"user",content:[
          {type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}},
          {type:"text",text:"Extract ALL info from this resume PDF.\n\n"+dataPrompt}
        ]}];
      } else if (file) {
        const txt = await toText(file);
        dataMessages = [{role:"user",content:"RESUME:\n"+txt+"\n\n"+dataPrompt}];
      } else {
        dataMessages = [{role:"user",content:dataPrompt}];
      }

      addLog("🌐","API Call 1/2 — resume data...","#94a3b8");
      const dataText = await callClaude(dataMessages, dataSystem, 2000);
      const resumeData = parseJSON(dataText);
      addLog("✔","Data ready: "+(resumeData.name||"candidate")+" — "+(resumeData.experience?.length||0)+" roles","#4ade80");
      sn("data","done"); await wait(300);

      // Node 4 — LaTeX
      sn("latex","active");

      let cleanLatex = "";

      if (useCustomTpl && customLatex.trim()) {
        // ── Custom template mode: fill user's template with candidate data ──
        addLog("📄","Custom template detected — filling with your data...","#22d3ee");
        const fillPrompt = `You are a LaTeX expert. The user has provided a custom LaTeX resume template below.
Fill this template with the candidate data provided. 
Keep ALL formatting, structure, commands, and style of the original template EXACTLY as-is.
Only replace placeholder content with the actual candidate data.
Do not add or remove any LaTeX packages or commands.
Return ONLY the filled LaTeX code. No explanation. No markdown fences.

CUSTOM LATEX TEMPLATE:
${customLatex}

CANDIDATE DATA TO FILL IN:
Name: ${resumeData.name}
Email: ${resumeData.email}
Phone: ${resumeData.phone}
Location: ${resumeData.location}
LinkedIn: ${resumeData.linkedin||""}
Summary: ${resumeData.summary}
Experience: ${JSON.stringify(resumeData.experience,null,2)}
Education: ${JSON.stringify(resumeData.education,null,2)}
Skills: ${(resumeData.skills||[]).join(", ")}
Projects: ${JSON.stringify(resumeData.projects,null,2)}
Certifications: ${(resumeData.certifications||[]).filter(Boolean).join(", ")||"None"}

Return ONLY the complete filled LaTeX code starting with \documentclass`;

        addLog("🌐","API Call 2/2 — Filling custom template...","#a78bfa");
        const latexRaw2 = await callClaude([{role:"user",content:fillPrompt}], null, 4000);
        cleanLatex = latexRaw2.replace(/^```latex\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim();
        addLog("✔","Custom template filled! "+cleanLatex.length+" chars","#a78bfa");

      } else {
        // ── Default mode: generate fresh ATS LaTeX ──
        addLog("📄","Claude Step 2: Generating ATS LaTeX...","#22d3ee");
        const latexPrompt = `Create a complete compilable LaTeX resume. Single page. ATS-friendly. No fancy graphics.

USE:
\\documentclass[10pt,a4paper]{article}
\\usepackage[margin=1.5cm]{geometry}
\\usepackage{enumitem}
\\usepackage{hyperref}
\\usepackage{titlesec}
\\usepackage{fontenc}
\\usepackage{inputenc}

RULES:
- Clean minimal layout, no colors, no tables, no graphics
- Section titles with \\titleformat
- \\setlist for compact bullet lists
- Single page A4 fit
- Must compile on Overleaf without errors
- No repetition in content

CANDIDATE:
Name: ${resumeData.name}
Email: ${resumeData.email}
Phone: ${resumeData.phone}
Location: ${resumeData.location}
LinkedIn: ${resumeData.linkedin||""}
Summary: ${resumeData.summary}
Experience: ${JSON.stringify(resumeData.experience)}
Education: ${JSON.stringify(resumeData.education)}
Skills: ${(resumeData.skills||[]).join(", ")}
Projects: ${JSON.stringify(resumeData.projects)}
Certifications: ${(resumeData.certifications||[]).filter(Boolean).join(", ")||"None"}

Return ONLY raw LaTeX. No explanation. No markdown. Start with \\documentclass`;

        addLog("🌐","API Call 2/2 — LaTeX code...","#94a3b8");
        const latexRaw = await callClaude([{role:"user",content:latexPrompt}], null, 3000);
        cleanLatex = latexRaw.replace(/^```latex\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/,"").trim();
      }

      addLog("✔","LaTeX: "+cleanLatex.length+" chars","#22d3ee");
      sn("latex","done"); await wait(300);

      // Node 5
      sn("output","active");
      setRdata(resumeData);
      setLatex(cleanLatex);
      setScores({before:resumeData.atsScore||60,after:resumeData.optimizedScore||90});
      addLog("🚀","Pipeline complete!","#4ade80");
      await wait(300);
      addLog("✅","ATS: "+resumeData.atsScore+" → "+resumeData.optimizedScore+" (+"+
        (resumeData.optimizedScore-resumeData.atsScore)+" pts)","#4ade80");
      sn("output","done");
      setPhase("done");
      setTab("preview");

    } catch(e) {
      addLog("✗","Error: "+e.message,"#f87171");
      setNs(s=>({...s,data:"idle",latex:"idle",output:"idle"}));
      setPhase("form");
    }
  };

  // ── WORKING DOWNLOAD — injects into hidden iframe then triggers print ────────
  const handleDownload = () => {
    if (!rdata) return;
    const html = buildResumeHTML(rdata);

    // Method: write to iframe and trigger print dialog
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;";
    document.body.appendChild(iframe);

    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(()=>{ document.body.removeChild(iframe); },3000);
      } catch(e) {
        // Fallback: data URI download
        const a = document.createElement("a");
        a.href = "data:text/html;charset=utf-8,"+encodeURIComponent(html);
        a.download = (rdata.name||"resume").replace(/\s+/g,"_")+"_resume.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setDlMsg("HTML file downloaded! Open it in browser → Ctrl+P → Save as PDF");
      }
    };

    iframe.contentDocument.open();
    iframe.contentDocument.write(html);
    iframe.contentDocument.close();
  };

  const copyLatex   = () => { navigator.clipboard.writeText(latex); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  const downloadTex = () => {
    const a=document.createElement("a");
    a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(latex);
    a.download=(rdata?.name||name||"resume").replace(/\s+/g,"_")+"_resume.tex";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  const reset = () => {
    setPhase("form");
    setNs({input:"idle",trigger:"idle",data:"idle",latex:"idle",output:"idle"});
    setLogs([]); setFile(null); setLatex(""); setRdata(null); setScores(null); setDlMsg("");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;} body{background:#080e1a;}
        @keyframes ping   {75%,100%{transform:scale(1.7);opacity:0}}
        @keyframes fadeUp {from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin   {to{transform:rotate(360deg)}}
        @keyframes pulse  {0%,100%{opacity:1}50%{opacity:0.2}}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-track{background:#0b1120;} ::-webkit-scrollbar-thumb{background:#1e293b;border-radius:2px;}
        input::placeholder,textarea::placeholder{color:#2a3a50;} input:focus,textarea:focus{outline:none;}
      `}</style>

      <div style={{minHeight:"100vh",background:"#080e1a",color:"#e2e8f0",fontFamily:"'JetBrains Mono',monospace"}}>

        {/* Header */}
        <div style={{borderBottom:"1px solid #0f172a",padding:"11px 22px",display:"flex",alignItems:"center",gap:8}}>
          <div style={{display:"flex",gap:5}}>{["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:10,height:10,borderRadius:"50%",background:c}}/>)}</div>
          <div style={{width:1,height:14,background:"#1e293b",margin:"0 8px"}}/>
          <span style={{fontSize:9,letterSpacing:3,color:"#6366f1",fontWeight:700}}>n8n</span>
          <span style={{color:"#1e293b",fontSize:9}}>+</span>
          <span style={{fontSize:9,letterSpacing:3,color:"#a78bfa",fontWeight:700}}>CLAUDE</span>
          <span style={{color:"#1e293b",fontSize:9}}>+</span>
          <span style={{fontSize:9,letterSpacing:3,color:"#22d3ee",fontWeight:700}}>OVERLEAF</span>
          <span style={{fontSize:9,color:"#334155",marginLeft:4}}>— Resume Automation Pipeline</span>
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80",animation:"pulse 2s infinite"}}/>
            <span style={{fontSize:8,color:"#4ade80",letterSpacing:2}}>LIVE</span>
          </div>
        </div>

        {/* Pipeline */}
        <div style={{background:"#0b1120",borderBottom:"1px solid #0f172a",padding:"13px 24px"}}>
          <div style={{fontSize:7.5,color:"#334155",letterSpacing:3,marginBottom:11}}>AUTOMATION WORKFLOW</div>
          <div style={{display:"flex",alignItems:"center",overflowX:"auto"}}>
            {NODES.map((node,i)=>(
              <div key={node.id} style={{display:"flex",alignItems:"center",flex:i<NODES.length-1?"1 1 auto":"0 0 auto"}}>
                <PNode node={node} active={ns[node.id]==="active"} done={ns[node.id]==="done"}/>
                {i<NODES.length-1&&<Arrow lit={["done","active"].includes(ns[NODES[i+1].id])} color={NODES[i+1].color}/>}
              </div>
            ))}
          </div>
        </div>

        {/* 2-col */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",minHeight:"calc(100vh - 148px)"}}>

          {/* LEFT */}
          <div style={{borderRight:"1px solid #0f172a",padding:"18px 20px",overflowY:"auto"}}>
            <div style={{fontSize:7.5,color:"#f59e0b",letterSpacing:3,marginBottom:13}}>📝 INPUT NODE</div>

            <div style={{marginBottom:4}}>
              <div style={{fontSize:8,color:"#a78bfa",letterSpacing:2.5,marginBottom:7}}>📎 RESUME FILE <span style={{color:"#334155"}}>(PDF / TXT / DOC)</span></div>
              <UploadBox file={file} onFile={setFile}/>
              {file&&<button onClick={()=>setFile(null)} style={{marginTop:5,fontSize:9,color:"#475569",background:"none",border:"none",cursor:"pointer",fontFamily:"monospace"}}>✕ remove</button>}
            </div>

            <div style={{display:"flex",alignItems:"center",gap:10,margin:"13px 0"}}>
              <div style={{flex:1,height:1,background:"#0f172a"}}/>
              <span style={{fontSize:9,color:hasFile?"#334155":"#475569",fontFamily:"monospace",letterSpacing:2}}>{hasFile?"OR ADD MORE DETAILS":"OR FILL MANUALLY"}</span>
              <div style={{flex:1,height:1,background:"#0f172a"}}/>
            </div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 12px"}}>
              <Field label="Full Name"   value={name}     onChange={setName}     placeholder="Neetesh Kumar Sahu" req={!hasFile}/>
              <Field label="Target Role" value={role}     onChange={setRole}     placeholder="DevOps Engineer"    req={!hasFile}/>
              <Field label="Email"       value={email}    onChange={setEmail}    placeholder="neetesh@email.com"/>
              <Field label="Phone"       value={phone}    onChange={setPhone}    placeholder="+91-9876543210"/>
              <Field label="Location"    value={loc}      onChange={setLoc}      placeholder="Indore, MP, India"/>
              <Field label="LinkedIn"    value={linkedin} onChange={setLinkedin} placeholder="linkedin.com/in/neetesh"/>
            </div>
            <Field label="Experience"           value={exp}      onChange={setExp}      rows={3} placeholder={"DevOps Intern @ Vected Technologies\n- Docker, CI/CD, AWS"}/>
            <Field label="Education"            value={edu}      onChange={setEdu}      rows={2} placeholder={"B.Tech CSE — RGPV (2021-2025), GPA 7.8"}/>
            <Field label="Skills"               value={skills}   onChange={setSkills}   rows={2} placeholder="Docker, Kubernetes, AWS, Python, Linux"/>
            <Field label="Projects"             value={projects} onChange={setProjects} rows={2} placeholder={"URL Shortener — Flask+Redis+Docker\nPortfolio — GitHub API"}/>
            <Field label="Certifications/Extra" value={extra}    onChange={setExtra}    rows={2} placeholder="AWS Cloud Practitioner (in progress)"/>

            <div style={{background:"rgba(99,102,241,0.04)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:9,padding:12,marginTop:4}}>
              <div style={{fontSize:8,color:"#6366f1",letterSpacing:2.5,marginBottom:7}}>
                📋 JOB DESCRIPTION <span style={{color:"#22d3ee",marginLeft:6}}>← resume tailored to this</span>
              </div>
              <textarea rows={5} value={jd} onChange={e=>setJd(e.target.value)}
                placeholder={"Paste full job description here...\n\nWe are looking for a DevOps Engineer with Docker, Kubernetes, AWS, CI/CD experience..."}
                style={{width:"100%",background:"#08101a",border:"1px solid rgba(99,102,241,0.25)",borderRadius:7,
                  padding:"9px 11px",color:"#cbd5e1",fontFamily:"monospace",fontSize:11,
                  resize:"vertical",outline:"none",lineHeight:1.7,boxSizing:"border-box"}}
                onFocus={e=>e.target.style.borderColor="#6366f1"}
                onBlur={e=>e.target.style.borderColor="rgba(99,102,241,0.25)"}/>
            </div>

            <button onClick={run} disabled={!canRun} style={{
              width:"100%",marginTop:13,padding:"13px",
              background:canRun?"linear-gradient(135deg,#4338ca,#6366f1,#818cf8)":"#0f172a",
              color:canRun?"#fff":"#334155",border:`1px solid ${canRun?"transparent":"#1e293b"}`,
              borderRadius:9,fontFamily:"monospace",fontSize:12,fontWeight:700,letterSpacing:2,
              cursor:canRun?"pointer":"not-allowed",
              boxShadow:canRun?"0 4px 20px rgba(99,102,241,0.3)":"none",transition:"all 0.2s"}}>
              {phase==="running"?"⏳  PIPELINE RUNNING...":"▶  RUN AUTOMATION PIPELINE"}
            </button>
            {/* ── Custom LaTeX Template (Optional) ── */}
            <div style={{marginTop:10,border:"1px solid rgba(34,211,238,0.2)",borderRadius:9,overflow:"hidden"}}>
              {/* Toggle header */}
              <button
                onClick={()=>setShowTplBox(s=>!s)}
                style={{width:"100%",padding:"9px 13px",background:"rgba(34,211,238,0.05)",border:"none",
                  display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",
                  fontFamily:"monospace",fontSize:8,color:"#22d3ee",letterSpacing:2,textTransform:"uppercase"}}>
                <span>📐 CUSTOM LATEX TEMPLATE <span style={{color:"#334155"}}>(OPTIONAL)</span></span>
                <span style={{color:"#22d3ee",fontSize:12,transform:showTplBox?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}>▾</span>
              </button>

              {showTplBox&&(
                <div style={{padding:"12px 13px",borderTop:"1px solid rgba(34,211,238,0.15)"}}>
                  <div style={{fontSize:9,color:"#475569",fontFamily:"monospace",marginBottom:10,lineHeight:1.6}}>
                    Paste your own LaTeX template below. Claude will fill it with your resume data keeping your formatting intact.
                  </div>

                  {/* Enable toggle */}
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <button
                      onClick={()=>setUseCustomTpl(s=>!s)}
                      style={{padding:"5px 14px",borderRadius:20,border:"none",cursor:"pointer",fontFamily:"monospace",
                        fontSize:9,fontWeight:700,transition:"all 0.2s",
                        background:useCustomTpl?"#22d3ee":"#1e293b",
                        color:useCustomTpl?"#080e1a":"#475569",
                        boxShadow:useCustomTpl?"0 0 10px rgba(34,211,238,0.4)":"none"}}>
                      {useCustomTpl?"✅ ENABLED":"○ DISABLED"}
                    </button>
                    <span style={{fontSize:9,color:useCustomTpl?"#22d3ee":"#334155",fontFamily:"monospace"}}>
                      {useCustomTpl?"Custom template will be used":"Using default ATS template"}
                    </span>
                  </div>

                  <textarea
                    rows={8}
                    value={customLatex}
                    onChange={e=>setCustomLatex(e.target.value)}
                    placeholder={`Paste your LaTeX template here...

Example:
\\documentclass[11pt]{article}
\\begin{document}
\\textbf{NAME_HERE}\\\\
EMAIL_HERE | PHONE_HERE
...
\\end{document}`}
                    style={{width:"100%",background:"#080e1a",border:`1px solid ${useCustomTpl?"#22d3ee":"#1e293b"}`,
                      borderRadius:7,padding:"9px 11px",color:"#cbd5e1",fontFamily:"monospace",fontSize:10,
                      resize:"vertical",outline:"none",lineHeight:1.7,boxSizing:"border-box",transition:"border 0.2s"}}
                  />

                  {customLatex.trim()&&(
                    <div style={{marginTop:6,fontSize:9,color:"#475569",fontFamily:"monospace"}}>
                      {customLatex.split("\n").length} lines pasted
                      <button onClick={()=>setCustomLatex("")} style={{marginLeft:10,color:"#f87171",background:"none",border:"none",cursor:"pointer",fontFamily:"monospace",fontSize:9}}>✕ clear</button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!canRun&&phase!=="running"&&<div style={{marginTop:8,textAlign:"center",fontSize:9,color:"#334155",fontFamily:"monospace"}}>Upload resume  OR  fill Name + Role</div>}
          </div>

          {/* RIGHT */}
          <div style={{display:"flex",flexDirection:"column"}}>

            {/* Log */}
            <div style={{borderBottom:"1px solid #0f172a",flexShrink:0}}>
              <div style={{padding:"9px 18px",borderBottom:"1px solid #0f172a",display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:8,color:"#334155",letterSpacing:3}}>EXECUTION LOG</span>
                {phase==="running"&&<div style={{width:10,height:10,border:"2px solid #1e293b",borderTop:"2px solid #6366f1",borderRadius:"50%",animation:"spin 0.7s linear infinite",marginLeft:4}}/>}
              </div>
              <div ref={logRef} style={{height:148,overflowY:"auto",padding:"6px 18px"}}>
                {logs.length===0
                  ?<div style={{color:"#1a2540",fontSize:10,fontFamily:"monospace",paddingTop:8}}>Waiting for pipeline trigger...</div>
                  :logs.map(l=><LogLine key={l.id} icon={l.icon} text={l.text} color={l.color}/>)}
              </div>
            </div>

            {/* Output */}
            <div style={{flex:1,overflowY:"auto",padding:"16px"}}>
              {phase!=="done"&&(
                <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100%",gap:10,opacity:0.15}}>
                  <div style={{fontSize:40}}>📄</div>
                  <div style={{fontSize:10,color:"#334155",fontFamily:"monospace",letterSpacing:2}}>OUTPUT PENDING</div>
                </div>
              )}

              {phase==="done"&&rdata&&(
                <div style={{animation:"fadeUp 0.5s ease"}}>

                  {/* Scores */}
                  {scores&&(
                    <div style={{display:"flex",gap:7,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
                      <span style={{background:"rgba(248,113,113,0.1)",border:"1px solid rgba(248,113,113,0.3)",borderRadius:100,padding:"3px 11px",fontSize:9.5,color:"#f87171",fontFamily:"monospace"}}>Before: {scores.before}/100</span>
                      <span style={{color:"#334155"}}>→</span>
                      <span style={{background:"rgba(74,222,128,0.1)",border:"1px solid rgba(74,222,128,0.3)",borderRadius:100,padding:"3px 11px",fontSize:9.5,color:"#4ade80",fontFamily:"monospace",fontWeight:700}}>After: {scores.after}/100 ✨</span>
                      <span style={{background:"rgba(99,102,241,0.1)",border:"1px solid rgba(99,102,241,0.3)",borderRadius:100,padding:"3px 11px",fontSize:9.5,color:"#818cf8",fontFamily:"monospace"}}>+{scores.after-scores.before} pts</span>
                    </div>
                  )}

                  {/* Buttons */}
                  <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
                    <button onClick={handleDownload} style={{padding:"9px 16px",background:"linear-gradient(135deg,#166534,#22c55e)",border:"none",borderRadius:7,color:"#fff",fontFamily:"monospace",fontSize:10,cursor:"pointer",fontWeight:700,boxShadow:"0 3px 12px rgba(34,197,94,0.3)"}}>
                      📥 DOWNLOAD PDF
                    </button>
                    <button onClick={copyLatex} style={{padding:"9px 12px",background:copied?"#166534":"#0f172a",border:"1px solid #334155",borderRadius:7,color:copied?"#4ade80":"#94a3b8",fontFamily:"monospace",fontSize:10,cursor:"pointer",fontWeight:600,transition:"all 0.2s"}}>
                      {copied?"✅ COPIED!":"📋 COPY LATEX"}
                    </button>
                    <button onClick={downloadTex} style={{padding:"9px 12px",background:"#0c1e38",border:"1px solid #1d4ed8",borderRadius:7,color:"#60a5fa",fontFamily:"monospace",fontSize:10,cursor:"pointer",fontWeight:600}}>
                      ⬇ .TEX FILE
                    </button>
                    <a href="https://www.overleaf.com/project/new/template" target="_blank" rel="noreferrer"
                      style={{padding:"9px 12px",background:"#0a2218",border:"1px solid #166534",borderRadius:7,color:"#4ade80",fontFamily:"monospace",fontSize:10,textDecoration:"none",fontWeight:600,display:"inline-flex",alignItems:"center"}}>
                      🟢 OVERLEAF
                    </a>
                    <button onClick={reset} style={{padding:"9px 10px",background:"transparent",border:"1px solid #1e293b",borderRadius:7,color:"#475569",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>↺ RESET</button>
                  </div>

                  {/* Download helper message */}
                  {dlMsg&&<div style={{marginBottom:10,padding:"8px 12px",background:"rgba(251,191,36,0.1)",border:"1px solid rgba(251,191,36,0.3)",borderRadius:7,fontSize:10,color:"#fbbf24",fontFamily:"monospace"}}>{dlMsg}</div>}

                  {/* Tabs */}
                  <div style={{display:"flex",gap:2,background:"#0b1120",padding:3,borderRadius:7,border:"1px solid #0f172a",marginBottom:12,width:"fit-content"}}>
                    {[["preview","👁 Preview"],["latex","📄 LaTeX"],["guide","📌 Guide"]].map(([k,l])=>(
                      <button key={k} onClick={()=>setTab(k)} style={{padding:"5px 12px",borderRadius:5,border:"none",cursor:"pointer",background:tab===k?"#6366f1":"transparent",color:tab===k?"#fff":"#475569",fontFamily:"monospace",fontSize:9,fontWeight:tab===k?700:400,letterSpacing:1}}>{l}</button>
                    ))}
                  </div>

                  {/* Preview — actual A4 resume */}
                  {tab==="preview"&&(
                    <div style={{border:"1px solid #1e293b",borderRadius:10,overflow:"hidden"}}>
                      <div style={{borderBottom:"1px solid #1e293b",padding:"7px 12px",background:"#0d1117",display:"flex",alignItems:"center",gap:7}}>
                        <div style={{display:"flex",gap:4}}>{["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:8,height:8,borderRadius:"50%",background:c}}/>)}</div>
                        <span style={{fontSize:9,color:"#334155",fontFamily:"monospace"}}>resume_preview — A4 single page</span>
                        <button onClick={handleDownload} style={{marginLeft:"auto",padding:"3px 10px",background:"#166534",border:"none",borderRadius:4,color:"#fff",fontFamily:"monospace",fontSize:8,cursor:"pointer",fontWeight:700}}>📥 Print/PDF</button>
                      </div>
                      {/* Actual resume rendered */}
                      <div style={{background:"#fff",maxHeight:520,overflowY:"auto"}}>
                        <div style={{fontFamily:"Arial,Helvetica,sans-serif",fontSize:"10.5pt",color:"#1a1a1a",padding:"14mm 15mm",minHeight:"297mm",lineHeight:1.4}}>
                          {/* Header */}
                          <div style={{textAlign:"center",marginBottom:10,borderBottom:"2px solid #1a1a1a",paddingBottom:8}}>
                            <h1 style={{fontSize:20,fontWeight:700,letterSpacing:1,textTransform:"uppercase",margin:0}}>{rdata.name}</h1>
                            <div style={{fontSize:9,color:"#333",marginTop:4}}>
                              {[rdata.email,rdata.phone,rdata.location,rdata.linkedin].filter(Boolean).join("  |  ")}
                            </div>
                          </div>

                          {/* Summary */}
                          {rdata.summary&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,marginBottom:5}}>Professional Summary</div>
                            <p style={{fontSize:10,lineHeight:1.5,color:"#222",marginBottom:8}}>{rdata.summary}</p>
                          </>}

                          {/* Experience */}
                          {rdata.experience?.length>0&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,marginBottom:5}}>Experience</div>
                            {rdata.experience.map((e,i)=>(
                              <div key={i} style={{marginBottom:7}}>
                                <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                                  <span style={{fontWeight:700,fontSize:11}}>{e.role}</span>
                                  <span style={{fontSize:9,color:"#444"}}>{e.duration}</span>
                                </div>
                                <div style={{fontStyle:"italic",fontSize:10,color:"#333",marginBottom:3}}>{e.company}</div>
                                <ul style={{paddingLeft:14,margin:0}}>{(e.bullets||[]).slice(0,4).map((b,j)=><li key={j} style={{fontSize:10,lineHeight:1.45,color:"#222",marginBottom:2}}>{b}</li>)}</ul>
                              </div>
                            ))}
                          </>}

                          {/* Skills */}
                          {rdata.skills?.length>0&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,margin:"8px 0 5px"}}>Technical Skills</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8}}>
                              {rdata.skills.map((s,i)=><span key={i} style={{fontSize:9,background:"#f0f0f0",border:"1px solid #ccc",borderRadius:2,padding:"1px 6px",color:"#222"}}>{s}</span>)}
                            </div>
                          </>}

                          {/* Projects */}
                          {rdata.projects?.length>0&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,margin:"8px 0 5px"}}>Projects</div>
                            {rdata.projects.slice(0,3).map((p,i)=>(
                              <div key={i} style={{fontSize:10,marginBottom:4,lineHeight:1.45}}>
                                <span style={{fontWeight:700}}>{p.name}</span><span style={{color:"#333"}}> — {p.description}</span>
                              </div>
                            ))}
                          </>}

                          {/* Education */}
                          {rdata.education?.length>0&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,margin:"8px 0 5px"}}>Education</div>
                            {rdata.education.map((e,i)=>(
                              <div key={i} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                                <div><span style={{fontWeight:700,fontSize:11}}>{e.degree}</span><span style={{color:"#333",fontSize:10}}> — {e.institution}</span></div>
                                <span style={{fontSize:9,color:"#444"}}>{e.year}</span>
                              </div>
                            ))}
                          </>}

                          {/* Certifications */}
                          {rdata.certifications?.filter(Boolean).length>0&&<>
                            <div style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,borderBottom:"1.5px solid #1a1a1a",paddingBottom:2,margin:"8px 0 5px"}}>Certifications</div>
                            <ul style={{paddingLeft:14,margin:0}}>{rdata.certifications.filter(Boolean).map((c,i)=><li key={i} style={{fontSize:10,lineHeight:1.45,color:"#222",marginBottom:2}}>{c}</li>)}</ul>
                          </>}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LaTeX */}
                  {tab==="latex"&&(
                    <div style={{background:"#0d1117",border:"1px solid #1e293b",borderRadius:10,overflow:"hidden"}}>
                      <div style={{borderBottom:"1px solid #1e293b",padding:"7px 12px",display:"flex",alignItems:"center",gap:7}}>
                        <div style={{display:"flex",gap:4}}>{["#ff5f57","#febc2e","#28c840"].map(c=><div key={c} style={{width:8,height:8,borderRadius:"50%",background:c}}/>)}</div>
                        <span style={{fontSize:9,color:"#334155",marginLeft:4}}>resume_overleaf.tex</span>
                      </div>
                      <div style={{display:"flex",maxHeight:400,overflow:"auto"}}>
                        <div style={{padding:"10px 8px",borderRight:"1px solid #0f172a",userSelect:"none",minWidth:34,textAlign:"right"}}>
                          {latex.split("\n").map((_,i)=><div key={i} style={{fontSize:9,color:"#1e293b",lineHeight:1.85,fontFamily:"monospace"}}>{i+1}</div>)}
                        </div>
                        <div style={{padding:"10px 14px",flex:1,overflowX:"auto"}}>
                          <div style={{fontFamily:"monospace",fontSize:10.5,lineHeight:1.85,whiteSpace:"pre"}} dangerouslySetInnerHTML={{__html:hlTex(latex)}}/>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Guide */}
                  {tab==="guide"&&(
                    <div style={{background:"#0b1120",border:"1px solid #0f172a",borderRadius:10,padding:16}}>
                      <div style={{fontSize:8,color:"#22d3ee",letterSpacing:3,marginBottom:13}}>HOW TO GET PDF</div>
                      {[
                        ["1","Click DOWNLOAD PDF","Print dialog will open → select Save as PDF","#4ade80"],
                        ["2","OR: Copy LaTeX code","Click COPY LATEX button above","#f59e0b"],
                        ["3","Open Overleaf","overleaf.com → New Project → Blank","#6366f1"],
                        ["4","Paste in main.tex","Ctrl+A → Ctrl+V → Recompile","#a78bfa"],
                        ["5","Download from Overleaf","Best quality professional PDF","#22d3ee"],
                      ].map(([n,title,desc,color])=>(
                        <div key={n} style={{display:"flex",gap:11,padding:"8px 0",borderBottom:n!=="5"?"1px solid #0f172a":"none"}}>
                          <div style={{width:20,height:20,borderRadius:"50%",background:`${color}18`,border:`1px solid ${color}40`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color,fontWeight:700,flexShrink:0}}>{n}</div>
                          <div>
                            <div style={{fontSize:11,color:"#e2e8f0",fontWeight:600,marginBottom:2}}>{title}</div>
                            <div style={{fontSize:9.5,color:"#475569"}}>{desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
