const $=(s)=>document.querySelector(s);
const state={theme:"dark",q:"",tag:null,players:"any",time:"any",sort:"name",games:[],current:null,editMode:false,isAdmin:false,session:null};
function getSupabase(){if(!window.SUPABASE_URL||!window.SUPABASE_ANON_KEY||String(window.SUPABASE_URL).includes("PASTE_"))return null;return window.supabase.createClient(window.SUPABASE_URL,window.SUPABASE_ANON_KEY);}
const sb=getSupabase();

function loadTheme(){const s=localStorage.getItem("ludo_theme");if(s)state.theme=s;applyTheme();}
function applyTheme(){document.documentElement.setAttribute("data-theme",state.theme==="light"?"light":"dark");$("#themeIcon").textContent=state.theme==="light"?"☀️":"🌙";document.querySelector('meta[name="theme-color"]')?.setAttribute("content",state.theme==="light"?"#f7f9fc":"#0b1020");}
function toggleTheme(){state.theme=state.theme==="light"?"dark":"light";localStorage.setItem("ludo_theme",state.theme);applyTheme();}

async function refreshSession(){if(!sb)return;const {data}=await sb.auth.getSession();state.session=data.session||null;await refreshAdminFlag();updateAccountUI();}
async function refreshAdminFlag(){state.isAdmin=false;if(!sb||!state.session?.user)return;const {data,error}=await sb.from("profiles").select("is_admin").eq("id",state.session.user.id).maybeSingle();if(!error&&data?.is_admin)state.isAdmin=true;}
function updateAccountUI(){const inS=!!state.session;$("#logoutBtn").hidden=!inS;$("#loginMsg").textContent=inS?`Logueado como: ${state.session.user.email}${state.isAdmin?" (admin)":""}`:"";if(state.editMode&&!state.isAdmin)setEditMode(false);}

function openAuth(){$("#auth").hidden=false;} function closeAuth(){$("#auth").hidden=true;}
async function signIn(email,password){if(!sb)return{ok:false,msg:"Falta configurar Supabase en config.js"};const {data,error}=await sb.auth.signInWithPassword({email,password});if(error)return{ok:false,msg:error.message};state.session=data.session;await refreshAdminFlag();updateAccountUI();return{ok:true,msg:"OK"};}
async function signOut(){if(!sb)return;await sb.auth.signOut();state.session=null;state.isAdmin=false;setEditMode(false);updateAccountUI();}

function normalizeGameFromDb(g){return{id:g.id,bggId:g.bgg_id,title:g.title||"Sen título",subtitle:g.subtitle||"",players:[g.players_min??1,g.players_max??4],minutes:Number(g.minutes??0),rating:Number(g.rating??0),plays:Number(g.plays??0),tags:Array.isArray(g.tags)?g.tags:[],howToPlayUrl:g.how_to_play_url||"",setupQuick:Array.isArray(g.setup_quick)?g.setup_quick:[],notes:g.notes||"",images:{cover:g.cover_url||"",gallery:Array.isArray(g.gallery_urls)?g.gallery_urls:[]}};}
async function loadGames(){if(!sb){$("#resultsMeta").textContent="1) Edita config.js co SUPABASE_URL e ANON_KEY. 2) Recarga.";state.games=[];renderChips();renderGrid();return;}const {data,error}=await sb.from("games").select("*").order("title",{ascending:true});if(error){$("#resultsMeta").textContent="Erro cargando xogos: "+error.message;state.games=[];}else{state.games=(data||[]).map(normalizeGameFromDb);}}

function dbPayloadFromForm(gameId,fd){const title=(fd.get("title")||"").trim();const subtitle=(fd.get("subtitle")||"").trim();const players_min=Number(fd.get("players_min")||1)||1;const players_max=Number(fd.get("players_max")||players_min)||players_min;const minutes=Number(fd.get("minutes")||0)||0;const bgg_id=Number(fd.get("bgg_id")||0)||null;const how_to_play_url=(fd.get("how_to_play_url")||"").trim()||null;const tagsRaw=(fd.get("tags")||"").trim();const tags=tagsRaw?tagsRaw.split(",").map(s=>s.trim()).filter(Boolean):[];const cover_url=(fd.get("cover_url")||"").trim()||null;const gallery_urls=(fd.get("gallery_urls")||"").split("\n").map(s=>s.trim()).filter(Boolean);const setup_quick=(fd.get("setup_quick")||"").split("\n").map(s=>s.trim()).filter(Boolean);const notes=(fd.get("notes")||"").trim()||null;return{id:gameId,title,subtitle,players_min,players_max,minutes,bgg_id,how_to_play_url,tags,cover_url,gallery_urls,setup_quick,notes};}
async function upsertGame(payload){const {error}=await sb.from("games").upsert(payload);if(error)throw error;}
async function deleteGame(id){const {error}=await sb.from("games").delete().eq("id",id);if(error)throw error;}

async function importGamesJson(list){
  const payloads=list.map(g=>({id:g.id||(g.title||"").toLowerCase().replace(/\s+/g,"_"),title:g.title||"Sen título",subtitle:g.subtitle||"",players_min:Array.isArray(g.players)?(g.players[0]??1):1,players_max:Array.isArray(g.players)?(g.players[1]??4):4,minutes:Number(g.minutes??0)||0,bgg_id:g.bggId??null,rating:Number(g.rating??0)||0,plays:Number(g.plays??0)||0,tags:Array.isArray(g.tags)?g.tags:[],cover_url:g.images?.cover||g.cover||null,gallery_urls:Array.isArray(g.images?.gallery)?g.images.gallery:[],how_to_play_url:g.howToPlayUrl||null,setup_quick:Array.isArray(g.setupQuick)?g.setupQuick:[],notes:g.notes||null}));
  const CHUNK=200;
  for(let i=0;i<payloads.length;i+=CHUNK){
    const chunk=payloads.slice(i,i+CHUNK);
    const {error}=await sb.from("games").upsert(chunk);
    if(error)throw error;
  }
}

function uniqueTags(){const set=new Set();state.games.forEach(g=>(g.tags||[]).forEach(t=>set.add(t)));return[...set].sort((a,b)=>String(a).localeCompare(String(b),"gl"));}
function renderChips(){
  const chips=$("#chips"); chips.innerHTML="";
  const all=document.createElement("button"); all.type="button"; all.className="chip"+(state.tag?"":" chip--on");
  all.innerHTML='<span class="chip__dot"></span>Todo'; all.onclick=()=>{state.tag=null;syncAndRender();}; chips.appendChild(all);
  uniqueTags().forEach(tag=>{
    const b=document.createElement("button"); b.type="button"; b.className="chip"+(state.tag===tag?" chip--on":"");
    b.innerHTML='<span class="chip__dot"></span>'+escapeHtml(tag);
    b.onclick=()=>{state.tag=(state.tag===tag)?null:tag;syncAndRender();};
    chips.appendChild(b);
  });
}

function parseMinutesBucket(m){if(m<=30)return"short";if(m<=90)return"medium";return"long";}
function matchesPlayers(game,p){if(p==="any")return true;if(p==="5+")return game.players?.[1]>=5;const n=Number(p);return n>=(game.players?.[0]??1)&&n<=(game.players?.[1]??4);}
function filterGames(){
  const q=state.q.trim().toLowerCase();
  return state.games.filter(g=>{
    const inTag=!state.tag||(g.tags||[]).includes(state.tag);
    const inPlayers=matchesPlayers(g,state.players);
    const inTime=(state.time==="any")||(parseMinutesBucket(g.minutes)===state.time);
    const inQuery=!q||(String(g.title).toLowerCase().includes(q)||String(g.subtitle).toLowerCase().includes(q)||(g.tags||[]).join(" ").toLowerCase().includes(q));
    return inTag&&inPlayers&&inTime&&inQuery;
  });
}
function sortGames(list){
  const arr=[...list];
  if(state.sort==="name")arr.sort((a,b)=>String(a.title).localeCompare(String(b.title),"gl"));
  else if(state.sort==="rating")arr.sort((a,b)=>(b.rating||0)-(a.rating||0));
  else if(state.sort==="plays")arr.sort((a,b)=>(b.plays||0)-(a.plays||0));
  return arr;
}
function pill(icon,text){return `<span class="pill">${icon} ${escapeHtml(text)}</span>`;}

function renderGrid(){
  const grid=$("#grid"), empty=$("#empty");
  const filtered=sortGames(filterGames());
  const active=[state.tag?1:0,state.players!=="any"?1:0,state.time!=="any"?1:0,state.q?1:0].reduce((a,b)=>a+b,0);
  $("#resultsMeta").textContent=`${filtered.length} resultado(s) · filtros activos: ${active}`;
  if(filtered.length===0){grid.innerHTML=""; empty.hidden=false; return;}
  empty.hidden=true;

  grid.innerHTML=filtered.map(g=>{
    const players=`${g.players?.[0]??1}–${g.players?.[1]??4}`;
    const minutes=g.minutes?`${g.minutes} min`:"—";
    const rating=g.rating?`${Number(g.rating).toFixed(1)}`:"—";
    const plays=g.plays??0;
    return `<article class="card">
      <div class="cover">
        <img class="cover__img" data-cover="${escapeHtml(g.id)}" alt="Portada de ${escapeHtml(g.title)}" />
        <div class="cover__badge">★ ${rating} · ▶ ${plays}</div>
      </div>
      <div class="card__body">
        <div>
          <div class="card__title">${escapeHtml(g.title)}</div>
          <div class="card__sub">${escapeHtml(g.subtitle||"")}</div>
        </div>
        <div class="meta">${pill("👥",players)}${pill("⏱️",minutes)}</div>
        <div class="meta">${(g.tags||[]).slice(0,2).map(t=>`<span class="pill">🏷️ ${escapeHtml(t)}</span>`).join("")}${(g.tags||[]).length>2?`<span class="pill">+${(g.tags||[]).length-2}</span>`:""}</div>
      </div>
      <div class="card__footer">
        <button class="smallbtn" data-open="${escapeHtml(g.id)}" type="button">Abrir ficha</button>
        ${state.editMode?`<button class="smallbtn" data-edit="${escapeHtml(g.id)}" type="button">Editar</button>`:`<button class="kebab" type="button" disabled>⋯</button>`}
      </div>
    </article>`;
  }).join("");

  filtered.forEach(async (g)=>{
    const img=document.querySelector(`img[data-cover="${CSS.escape(g.id)}"]`);
    if(!img) return;
    img.src=placeholder("cargando…");
    img.src=await loadCover(g);
  });

  grid.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-open");
    const game=state.games.find(x=>x.id===id);
    if(game) openDetail(game);
  });
  grid.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
    const id=b.getAttribute("data-edit");
    const game=state.games.find(x=>x.id===id);
    if(game) openDetail(game,{openEdit:true});
  });
}

function setTab(tab){
  document.querySelectorAll(".tab").forEach(t=>{
    const on=t.getAttribute("data-tab")===tab;
    t.classList.toggle("tab--on",on);
  });
  ["resumo","setup","imaxes","links"].forEach(k=>$("#tab-"+k).hidden=(k!==tab));
}

async function openDetail(game, opts={}){
  state.current=game;
  $("#detail").hidden=false;
  $("#detailTitle").textContent=game.title;
  $("#detailCover").src=placeholder("cargando…");
  loadCover(game).then(u=>$("#detailCover").src=u);

  const players=`${game.players?.[0]??1}–${game.players?.[1]??4}`;
  const minutes=game.minutes?`${game.minutes} min`:"—";
  const rating=game.rating?`${Number(game.rating).toFixed(1)}`:"—";
  const plays=game.plays??0;

  $("#tab-resumo").innerHTML=`
    <div style="font-weight:950;font-size:16px">${escapeHtml(game.title)}</div>
    ${game.subtitle?`<div style="margin-top:6px;color:var(--muted)">${escapeHtml(game.subtitle)}</div>`:""}
    <div class="kv">${pill("👥",players)}${pill("⏱️",minutes)}${pill("★",rating)}${pill("▶",String(plays))}</div>
    ${(game.tags||[]).length?`<div class="kv">${(game.tags||[]).map(t=>`<span class="pill">🏷️ ${escapeHtml(t)}</span>`).join("")}</div>`:""}
    ${game.notes?`<div style="margin-top:12px;color:var(--muted)">${escapeHtml(game.notes)}</div>`:""}
  `;

  $("#tab-setup").innerHTML=game.setupQuick?.length
    ? `<ol class="list">${game.setupQuick.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`
    : `<div style="color:var(--muted)">Aínda sen “setup rápido”.</div>`;

  const gallery=(game.images?.gallery||[]).filter(Boolean);
  $("#tab-imaxes").innerHTML=gallery.length
    ? `<div class="galleryRow">${gallery.map(u=>`<img src="${u}" alt="Imaxe extra">`).join("")}</div><div style="margin-top:10px;color:var(--muted)">Imaxes externas (URLs).</div>`
    : `<div style="color:var(--muted)">Sen imaxes extra aínda.</div>`;

  $("#tab-links").innerHTML=`
    ${game.howToPlayUrl?`<a class="linkBtn" href="${game.howToPlayUrl}" target="_blank" rel="noopener">▶ Vídeo: como xogar</a>`:`<div style="color:var(--muted)">Sen vídeo aínda.</div>`}
    ${game.bggId?`<div style="margin-top:12px"><a href="https://boardgamegeek.com/boardgame/${game.bggId}" target="_blank" rel="noopener">Abrir en BGG</a></div>`:""}
  `;

  const canEdit=state.editMode && state.isAdmin;
  $("#detailEdit").hidden=!canEdit;
  if(canEdit){ fillEditForm(game); if(opts.openEdit) $("#detailEdit").scrollIntoView({behavior:"smooth"}); }

  setTab("resumo");
  document.body.style.overflow="hidden";
}

function closeDetail(){ $("#detail").hidden=true; $("#detailEdit").hidden=true; document.body.style.overflow=""; }

function fillEditForm(game){
  const f=$("#editForm");
  f.title.value=game.title||"";
  f.subtitle.value=game.subtitle||"";
  f.players_min.value=game.players?.[0]??1;
  f.players_max.value=game.players?.[1]??4;
  f.minutes.value=game.minutes??0;
  f.bgg_id.value=game.bggId??"";
  f.how_to_play_url.value=game.howToPlayUrl??"";
  f.tags.value=(game.tags||[]).join(", ");
  f.cover_url.value=game.images?.cover??"";
  f.gallery_urls.value=(game.images?.gallery||[]).join("\n");
  f.setup_quick.value=(game.setupQuick||[]).join("\n");
  f.notes.value=game.notes??"";
  $("#editMsg").textContent="";
}

$("#editForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  if(!state.current) return;
  if(!state.isAdmin){ $("#editMsg").textContent="Non tes permisos (admin)."; return; }
  try{
    $("#editMsg").textContent="Gardando…";
    const payload=dbPayloadFromForm(state.current.id, new FormData(e.target));
    await upsertGame(payload);
    $("#editMsg").textContent="Gardar OK ✅";
    await loadGames(); syncAndRender();
    const refreshed=state.games.find(x=>x.id===state.current.id);
    if(refreshed) openDetail(refreshed);
  }catch(err){
    $("#editMsg").textContent="Erro: "+(err?.message||String(err));
  }
});

$("#btnDelete").addEventListener("click", async ()=>{
  if(!state.current||!state.isAdmin) return;
  if(!confirm("Eliminar este xogo?")) return;
  try{
    $("#editMsg").textContent="Eliminando…";
    await deleteGame(state.current.id);
    await loadGames(); syncAndRender();
    closeDetail();
  }catch(err){
    $("#editMsg").textContent="Erro: "+(err?.message||String(err));
  }
});

async function loadCover(game){
  if(game.images?.cover) return game.images.cover;
  if(!game.bggId) return placeholder("sen portada");
  const key="bgg_cover_"+game.bggId;
  const cached=localStorage.getItem(key);
  if(cached) return cached;
  try{
    const res=await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${game.bggId}`);
    const text=await res.text();
    const img=new DOMParser().parseFromString(text,"text/xml").querySelector("image");
    const url=img?.textContent?.trim();
    if(url){ localStorage.setItem(key,url); return url; }
  }catch(e){}
  return placeholder("sen portada");
}

function placeholder(txt){
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23141a33'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23eef2ff' font-family='system-ui' font-size='36'%3E"+encodeURIComponent(txt)+"%3C/text%3E%3C/svg%3E";
}
function escapeHtml(s){return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}

function setEditMode(on){
  state.editMode=!!on;
  $("#btnPin").classList.toggle("iconbtn--on", state.editMode);
  $("#editbar").hidden=!(state.editMode && state.isAdmin);
  renderGrid();
  if(!state.editMode) $("#detailEdit").hidden=true;
  else if(state.current && state.isAdmin){ $("#detailEdit").hidden=false; fillEditForm(state.current); }
}

function syncAndRender(){ renderChips(); renderGrid(); }

function bind(){
  $("#btnTheme").onclick=toggleTheme;
  $("#q").oninput=(e)=>{state.q=e.target.value||""; $("#btnClear").style.visibility=state.q?"visible":"hidden"; renderGrid();};
  $("#btnClear").onclick=()=>{state.q=""; $("#q").value=""; $("#btnClear").style.visibility="hidden"; renderGrid();};
  $("#players").onchange=(e)=>{state.players=e.target.value; renderGrid();};
  $("#time").onchange=(e)=>{state.time=e.target.value; renderGrid();};
  $("#sort").onchange=(e)=>{state.sort=e.target.value; renderGrid();};
  $("#btnReset").onclick=()=>{state.q=""; state.tag=null; state.players="any"; state.time="any"; state.sort="name"; $("#q").value=""; $("#btnClear").style.visibility="hidden"; syncAndRender();};
  $("#detailBack").onclick=closeDetail;
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>setTab(t.getAttribute("data-tab")));

  $("#btnAccount").onclick=async()=>{ await refreshSession(); openAuth(); };
  $("#loginCancel").onclick=closeAuth;
  $("#logoutBtn").onclick=async()=>{ await signOut(); closeAuth(); };

  $("#loginForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    const fd=new FormData(e.target);
    $("#loginMsg").textContent="Entrando…";
    const res=await signIn(fd.get("email"), fd.get("password"));
    if(!res.ok){ $("#loginMsg").textContent="Erro: "+res.msg; return; }
    $("#loginMsg").textContent="OK ✅"; closeAuth();
    await loadGames(); syncAndRender();
  });

  $("#btnPin").onclick=async()=>{
    await refreshSession();
    if(!state.session){ openAuth(); $("#loginMsg").textContent="Precisas entrar para usar o modo edición."; return; }
    if(!state.isAdmin){ openAuth(); $("#loginMsg").textContent="Estás logueado, pero non es admin."; return; }
    setEditMode(!state.editMode);
  };

  $("#btnNew").onclick=async()=>{
    if(!state.isAdmin){ openAuth(); return; }
    const id=prompt("ID do xogo (slug). Ex: terra_mistica");
    if(!id) return;
    const payload={id:id.trim(),title:"Novo xogo",subtitle:"",players_min:1,players_max:4,minutes:0,bgg_id:null,tags:[],cover_url:null,gallery_urls:[],how_to_play_url:null,setup_quick:[],notes:null};
    await upsertGame(payload);
    await loadGames(); syncAndRender();
    const g=state.games.find(x=>x.id===payload.id);
    if(g) openDetail(g,{openEdit:true});
  };

  $("#btnImport").onclick=()=>$("#fileImport").click();
  $("#fileImport").onchange=async(e)=>{
    if(!e.target.files?.[0]) return;
    if(!state.isAdmin){ alert("Precisas ser admin."); return; }
    try{
      const txt=await e.target.files[0].text();
      const list=JSON.parse(txt);
      if(!Array.isArray(list)) throw new Error("O JSON ten que ser unha lista");
      alert("Importando…");
      await importGamesJson(list);
      await loadGames(); syncAndRender();
      alert("Importación feita ✅");
    }catch(err){
      alert("Erro importando: "+(err?.message||String(err)));
    }finally{
      e.target.value="";
    }
  };

  $("#btnClear").style.visibility="hidden";
}

async function init(){
  loadTheme();
  bind();
  if(!sb){
    $("#resultsMeta").textContent="1) Edita config.js co SUPABASE_URL e ANON_KEY. 2) Recarga.";
    return;
  }
  sb.auth.onAuthStateChange(async(_e,session)=>{state.session=session; await refreshAdminFlag(); updateAccountUI();});
  await refreshSession();
  await loadGames();
  syncAndRender();
}
init();
