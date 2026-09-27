(() => {
"use strict";
const V=JSON.parse(document.getElementById("catalog").textContent);
const G=["All","Static sunset","Svelte explorations","Effect experiments","V2 and Bento","Early concepts"];
const KEY="binrat-design-feedback-v1";
const ratingDefs=[["overall","Overall feeling"],["identity","Visual identity"],["composition","Layout / hierarchy"],["rat","Rat treatment / seam"],["clarity","Text readability"],["mobile","Phone composition"],["interaction","Scanner / interaction"],["density","Information density"]];
const facets=["Large expressive rat","Smaller restrained rat","Static pixel sunset","Dark intelligence terminal","Warm paper dossier","Illustrated product cards","Neon / vivid palette","Restrained palette","Crisp pixel art","Big hero headline","Visual breathing room","Dense data layout","Clear evidence labels","Rat/background seam","Scanning ritual","Investigation reveal","Playful rat voice","Mobile navigation","Moving hero effects"];
const byId=Object.fromEntries(V.map(x=>[x.id,x]));
const state={reviews:{},comparisons:[]};
let selected=null,storageOK=true,embedded=false;
const $=id=>document.getElementById(id);
const el=(tag,txt,cls)=>{const n=document.createElement(tag);if(txt!==undefined&&txt!==null)n.textContent=txt;if(cls)n.className=cls;return n};
const blank=()=>({ratings:{},likes:[],dislikes:[],device:"",area:"",keep:"",cut:"",why:"",dealbreaker:false});
const review=()=>state.reviews[selected]||blank();
const edited=()=>{if(!state.reviews[selected])state.reviews[selected]=blank();return state.reviews[selected]};
const current=()=>byId[selected];
try {
  const stored=JSON.parse(localStorage.getItem(KEY)||"{}");
  if(stored&&typeof stored==="object"){
    state.reviews=stored.reviews&&typeof stored.reviews==="object"?stored.reviews:{};
    state.comparisons=Array.isArray(stored.comparisons)?stored.comparisons:[];
  }
} catch(err){storageOK=false}
function persist(){
  try {localStorage.setItem(KEY,JSON.stringify(state));$("saveStatus").textContent="Saved on this device · "+new Date().toLocaleTimeString()}
  catch(err){storageOK=false;$("saveStatus").textContent="Browser storage unavailable. Export JSON before closing this tab."}
}
function reviewLink(id){const u=new URL(location.href);u.searchParams.set("v",id);u.hash="";return u.href}
function initialize(){
  G.forEach(group=>{const o=el("option",group);o.value=group;$("group").append(o)});
  V.forEach(v=>{const o=el("option",v.name);o.value=v.id;$("versus").append(o)});
  const ratingBox=$("ratings");
  ratingDefs.forEach(([key,label])=>{
    const wrap=el("div",undefined,"rating"),l=el("label",label);l.htmlFor="r-"+key;
    const s=el("select");s.id="r-"+key;s.dataset.rating=key;
    [["","Not rated"],["1","1 · Dislike"],["2","2 · Weak"],["3","3 · Mixed"],["4","4 · Like"],["5","5 · Love"]].forEach(([value,name])=>{
      const o=el("option",name);o.value=value;s.append(o)
    });
    s.addEventListener("change",updateForm);wrap.append(l,s);ratingBox.append(wrap)
  });
  ["likes","dislikes"].forEach(type=>{
    const wrap=$(type);
    facets.forEach(name=>{
      const b=el("button",name,"facet"+(type==="dislikes"?" bad":""));
      b.type="button";b.dataset.facet=name;b.dataset.type=type;b.setAttribute("aria-pressed","false");
      b.addEventListener("click",()=>toggleFacet(type,name));
      wrap.append(b)
    })
  });
  $("search").addEventListener("input",drawList);
  $("group").addEventListener("change",drawList);
  $("loadIframe").addEventListener("click",loadPreview);
  $("copyLink").addEventListener("click",()=>copy(reviewLink(selected)));
  $("save").addEventListener("click",updateForm);
  $("clear").addEventListener("click",()=>{
    if(!window.confirm("Delete this version's feedback?"))return;
    delete state.reviews[selected];persist();populate();drawList();drawSummary();updateIssue()
  });
  ["device","area","keep","cut","why","dealbreaker"].forEach(id=>{
    $(id).addEventListener(id==="dealbreaker"?"change":"input",updateForm)
  });
  $("copyDigest").addEventListener("click",()=>copy(makeDigest()));
  $("export").addEventListener("click",download);
  $("saveComparison").addEventListener("click",saveComparison);
  const queryId=new URL(location.href).searchParams.get("v");
  select(byId[queryId]?queryId:"g6a");
  if(!storageOK)$("saveStatus").textContent="Local storage unavailable. Export JSON before leaving."
}
function drawList(){
  const q=$("search").value.trim().toLowerCase(),group=$("group").value,list=$("versionList");
  list.replaceChildren();
  const matches=V.filter(v=>(group==="All"||group===v.group)&&(!q||(v.name+" "+v.description+" "+v.flags.join(" ")).toLowerCase().includes(q)));
  matches.forEach(v=>{
    const li=el("li"),btn=el("button");
    btn.type="button";btn.dataset.id=v.id;btn.setAttribute("aria-current",String(v.id===selected));
    btn.append(el("strong",v.name),el("small",v.group+" · PR #"+v.pr));
    if(state.reviews[v.id])btn.append(el("span","Saved","tag"));
    btn.addEventListener("click",()=>select(v.id));li.append(btn);list.append(li)
  });
  $("count").textContent="("+matches.length+"/"+V.length+")"
}
function showFacetState(){
  const r=review();
  document.querySelectorAll(".facet").forEach(b=>{
    b.setAttribute("aria-pressed",String((r[b.dataset.type]||[]).includes(b.dataset.facet)))
  })
}
function toggleFacet(type,name){
  const r=edited(),other=type==="likes"?"dislikes":"likes",already=(r[type]||[]).includes(name);
  r[type]=(r[type]||[]).filter(x=>x!==name);
  r[other]=(r[other]||[]).filter(x=>x!==name);
  if(!already)r[type].push(name);
  r.updatedAt=new Date().toISOString();persist();showFacetState();drawSummary();drawList();updateIssue()
}
function populate(){
  const r=review();
  document.querySelectorAll("[data-rating]").forEach(s=>s.value=r.ratings?.[s.dataset.rating]||"");
  ["device","area","keep","cut","why"].forEach(key=>$(key).value=r[key]||"");
  $("dealbreaker").checked=!!r.dealbreaker;
  showFacetState()
}
function updateForm(){
  const r=edited();
  document.querySelectorAll("[data-rating]").forEach(s=>{
    if(s.value)r.ratings[s.dataset.rating]=Number(s.value);
    else delete r.ratings[s.dataset.rating]
  });
  ["device","area","keep","cut","why"].forEach(key=>r[key]=$(key).value);
  r.dealbreaker=$("dealbreaker").checked;
  r.version=selected;r.preview=current().url;r.updatedAt=new Date().toISOString();
  persist();drawSummary();drawList();updateIssue()
}
function select(id){
  if(!byId[id])return;
  selected=id;const v=current();
  $("current-title").textContent=v.name;$("reviewVersion").textContent=v.name;
  $("current-group").textContent=v.group;$("description").textContent=v.description;
  $("flags").replaceChildren();
  v.flags.forEach(f=>$("flags").append(el("span",f,"tag")));
  $("openPreview").href=v.url;
  $("source").textContent="Immutable commit "+v.sha.slice(0,12)+" · PR #"+v.pr;
  $("previewBox").replaceChildren(el("p","Load the GitHack snapshot here, or open the original in a new tab. Some historical builds cannot run inside an embedded sandbox."));
  $("loadIframe").textContent="Show preview here";embedded=false;
  populate();drawList();drawSummary();updateIssue();
  const u=new URL(location.href);u.searchParams.set("v",id);history.replaceState(null,"",u);
  $("versus").value="";$("choice").value="";$("compareWhy").value=""
}
function loadPreview(){
  if(embedded){
    $("previewBox").replaceChildren(el("p","Embedded preview closed. Use the original GitHack link for a full viewport."));
    $("loadIframe").textContent="Show preview here";embedded=false;return
  }
  const frame=el("iframe");
  frame.title=current().name+" historical GitHack preview";
  frame.loading="lazy";frame.referrerPolicy="no-referrer";
  frame.setAttribute("sandbox","allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox");
  frame.src=current().url;
  $("previewBox").replaceChildren(frame);
  $("loadIframe").textContent="Close embedded preview";embedded=true
}
function countItems(lists){
  const map=new Map();
  lists.forEach(list=>(list||[]).forEach(item=>map.set(item,(map.get(item)||0)+1)));
  return Array.from(map).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).map(([k,n])=>k+" ("+n+")")
}
function hasFeedback(r){
  return !!(r&&(Object.keys(r.ratings||{}).length||(r.likes||[]).length||(r.dislikes||[]).length||r.keep||r.cut||r.why||r.dealbreaker))
}
function summaryText(){
  const entries=V.filter(v=>hasFeedback(state.reviews[v.id])).map(v=>state.reviews[v.id]);
  return "Reviewed: "+entries.length+"/"+V.length+" snapshots"+
    "\nExplicit likes: "+(countItems(entries.map(r=>r.likes)).join(", ")||"none yet")+
    "\nExplicit dislikes: "+(countItems(entries.map(r=>r.dislikes)).join(", ")||"none yet")+
    "\nPairwise comparisons: "+state.comparisons.length+
    "\n\nThese are counts of selected design elements. They do not imply that a highly rated prototype is production-ready or that an unselected feature was disliked."
}
function drawSummary(){$("summary").textContent=summaryText()}
function records(){
  return {
    schema:"binrat.design-feedback.v1",exportedAt:new Date().toISOString(),
    caution:"Only explicit feedback. Missing ratings are NOT neutral. Historical previews are not live product data.",
    reviews:V.filter(v=>hasFeedback(state.reviews[v.id])).map(v=>({
      version:{id:v.id,name:v.name,group:v.group,sha:v.sha,url:v.url,pr:v.pr},
      feedback:state.reviews[v.id]
    })),
    comparisons:state.comparisons.filter(c=>c&&byId[c.a]&&byId[c.b])
  }
}
function download(){
  const blob=new Blob([JSON.stringify(records(),null,2)],{type:"application/json"});
  const u=URL.createObjectURL(blob),a=el("a");
  a.href=u;a.download="BINRAT_design_feedback.json";document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),2000)
}
function issueBody(){
  const v=current(),r=review();
  return [
    "## BINRAT design feedback · "+v.name,"Version: "+v.id,
    "Immutable preview: "+v.url,"Snapshot: "+v.sha,"Original PR: #"+v.pr,
    "Viewed on: "+(r.device||"unspecified"),"Review area: "+(r.area||"unspecified"),
    "","### Ratings (1 dislike, 5 love; unrated omitted)","~~~json",JSON.stringify(r.ratings||{},null,2),"~~~",
    "### Explicit likes",(r.likes||[]).join("; ")||"not specified",
    "### Explicit dislikes",(r.dislikes||[]).join("; ")||"not specified",
    "### Preserve",r.keep||"not specified",
    "### Change",r.cut||"not specified",
    "### Why",r.why||"not specified",
    "Dealbreaker: "+(r.dealbreaker?"yes":"not marked"),
    "","This is subjective preference feedback on a historical frontend, not product deployment authorization."
  ].join("\n")
}
function updateIssue(){
  $("issue").href="https://github.com/CipherCuttle/binrat/issues/new?title="+
    encodeURIComponent("[design-feedback] "+current().name)+
    "&body="+encodeURIComponent(issueBody().slice(0,11500))
}
function makeDigest(){
  return "BINRAT DESIGN PREFERENCE HANDOFF — only explicit owner feedback; do not infer from blank scores."+
    "\n"+summaryText()+"\n\nSTRUCTURED EVIDENCE:\n"+JSON.stringify(records(),null,2)+
    "\n\nIdentify evidence-backed recurring preferences and contradictory likes/dislikes by design, surface and device. Do not treat ratings as immutable style rules. Keep canonical rat, live/demo truth boundary and isolated draft PRs intact."
}
async function copy(value){
  try {
    if(!navigator.clipboard?.writeText)throw Error("clipboard unavailable");
    await navigator.clipboard.writeText(value);$("saveStatus").textContent="Copied to clipboard"
  } catch(err){
    const box=el("textarea");box.value=value;box.setAttribute("aria-label","Copy fallback");
    box.style.cssText="width:100%;height:160px";
    $("summary").replaceWith(box);box.focus();box.select();
    $("saveStatus").textContent="Clipboard blocked. Selected text is ready to copy; reload to restore the summary."
  }
}
function saveComparison(){
  const b=$("versus").value,choice=$("choice").value,why=$("compareWhy").value.trim();
  if(!b||b===selected||!choice||!why){$("saveStatus").textContent="Choose a different version, a preference, and the exact reason.";return}
  state.comparisons.push({a:selected,b,preferred:choice,why,recordedAt:new Date().toISOString()});
  persist();drawSummary();$("choice").value="";$("compareWhy").value=""
}
initialize();
})();