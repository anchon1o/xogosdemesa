// ==============================
// Ludoteca (Supabase) — app.js
// - UI "móbil first"
// - Lista + filtros + ficha
// - Login (Supabase Auth)
// - Edición (UPDATE/INSERT) en Supabase
// - Portadas por URL (con trucos iOS / hotlink)
// ==============================

const $  = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

// Estado global da app
const state = {
  games: [],
  theme: localStorage.getItem("ludo_theme") || "dark",

  // filtros
  tag: null,
  q: "",
  players: "any",
  time: "any",
  sort: "name",

  // edición / auth
  editMode: false,
  session: null,
  client: null,
  current: null, // xogo na ficha
};

// Utilidade: escribir texto nun selector se existe
function setText(sel, text){
  const el = $(sel);
  if(el) el.textContent = text;
}

// Utilidade: engadir listener se existe
function on(sel, evt, fn){
  const el = $(sel);
  if(el) el.addEventListener(evt, fn);
}

// ------------------------------
// Tema claro/escuro
// ------------------------------
function applyTheme(){
  document.documentElement.setAttribute(
    "data-theme",
    state.theme === "light" ? "light" : "dark"
  );
  setText("#themeIcon", state.theme === "light" ? "☀️" : "🌙");
}

function toggleTheme(){
  state.theme = state.theme === "light" ? "dark" : "light";
  localStorage.setItem("ludo_theme", state.theme);
  applyTheme();
}

// ------------------------------
// Modal de login
// ------------------------------
function showAuth(hint){
  const m = $("#authModal");
  if(!m) return;
  m.hidden = false;
  setText("#authHint", hint || "");
  setTimeout(()=>{ $("#authEmail")?.focus(); }, 0);
}

function hideAuth(){
  const m = $("#authModal");
  if(!m) return;
  m.hidden = true;
  setText("#authHint", "");
}

function showMeta(text){
  setText("#meta", text);
}

// ------------------------------
// Supabase init + sesión
// ------------------------------
function initSupabase(){
  if(!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || String(window.SUPABASE_URL).includes("PASTE_")){
    showMeta("⚠️ Falta configurar Supabase en config.js");
    return false;
  }
  state.client = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
  return true;
}

// Actualiza state.session e habilita/deshabilita botóns
async function refreshSession(){
  const { data } = await state.client.auth.getSession();
  state.session = data?.session ?? null;

  setText("#authIcon", state.session ? "✅" : "👤");

  // só se pode editar/crear se estás logueado
  const editBtn = $("#btnEditMode");
  const newBtn  = $("#btnNew");
  if(editBtn) editBtn.disabled = !state.session;
  if(newBtn)  newBtn.disabled  = !state.session;

  // botón editar dentro da ficha
  const detailEdit = $("#detailEditBtn");
  if(detailEdit) detailEdit.hidden = !state.session;

  if(state.session) hideAuth();
}

// Normaliza unha fila de Supabase ao formato interno da app
function norm(r){
  return {
    id: r.id,
    title: r.title ?? "Sen título",
    subtitle: r.subtitle ?? "",
    bggId: r.bgg_id ?? null,

    players: [r.players_min ?? 1, r.players_max ?? 4],
    minutes: Number(r.minutes ?? 0),

    rating: Number(r.rating ?? 0),
    plays: Number(r.plays ?? 0),

    // IMPORTANTE: tags debe ser text[] en Supabase para que isto chegue como array
    tags: Array.isArray(r.tags) ? r.tags : [],

    cover: r.cover_url ?? "",

    // estes campos existen se tes as columnas:
    gallery: Array.isArray(r.gallery_urls) ? r.gallery_urls : [],
    video: r.how_to_play_url ?? "",
    setup: Array.isArray(r.setup_quick) ? r.setup_quick : [],
    notes: r.notes ?? ""
  };
}

// Carga xogos da táboa "games"
async function loadGames(){
  showMeta("Cargando…");

  // Mellor pedir columnas explícitas (evita sorpresas se cambia o esquema)
  const { data, error } = await state.client
    .from("games")
    .select("id,title,subtitle,bgg_id,players_min,players_max,minutes,rating,plays,tags,cover_url,gallery_urls,how_to_play_url,setup_quick,notes")
    .order("title", { ascending: true });

  if(error){
    console.error(error);
    showMeta("⚠️ Erro cargando datos (mira consola)");
    return;
  }

  state.games = (data || []).map(norm);
}

// ------------------------------
// Tags / chips (filtros de arriba)
// ------------------------------
function uniqueTags(){
  const set = new Set();
  state.games.forEach(g => (g.tags || []).forEach(t => set.add(t)));
  return [...set].sort((a,b)=>String(a).localeCompare(String(b),"gl"));
}

function renderChips(){
  const chips = $("#chips");
  if(!chips) return;
  chips.innerHTML = "";

  // crea un chip
  const mk = (label, value) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + ((state.tag === value || (!state.tag && value === null)) ? " chip--on" : "");
    b.innerHTML = `<span class="chip__dot"></span>${label}`;
    b.addEventListener("click", () => { state.tag = value; render(); });
    chips.appendChild(b);
  };

  mk("Todo", null);
  uniqueTags().forEach(t => mk(t, t));
}

// ------------------------------
// Filtros de duración/xogadores + búsqueda
// ------------------------------
function bucket(mins){
  if(mins <= 30) return "short";
  if(mins <= 90) return "medium";
  return "long";
}

function matchPlayers(g, p){
  if(p === "any") return true;
  if(p === "5+") return (g.players?.[1] ?? 0) >= 5;
  const n = Number(p);
  return n >= (g.players?.[0] ?? 1) && n <= (g.players?.[1] ?? 4);
}

function filtered(){
  const q = state.q.trim().toLowerCase();
  return state.games.filter(g => {
    const okQ = !q
      || g.title.toLowerCase().includes(q)
      || (g.subtitle||"").toLowerCase().includes(q)
      || (g.tags||[]).join(" ").toLowerCase().includes(q);

    const okT = !state.tag || (g.tags||[]).includes(state.tag);
    const okP = matchPlayers(g, state.players);
    const okM = state.time === "any" || bucket(g.minutes) === state.time;

    return okQ && okT && okP && okM;
  });
}

function sorted(list){
  const a = [...list];
  if(state.sort === "name")   a.sort((x,y)=>x.title.localeCompare(y.title,"gl"));
  if(state.sort === "rating") a.sort((x,y)=>(y.rating||0)-(x.rating||0));
  if(state.sort === "plays")  a.sort((x,y)=>(y.plays||0)-(x.plays||0));
  return a;
}

// ------------------------------
// Portadas por URL (robusto iOS / hotlink)
// ------------------------------
function placeholder(txt){
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23141a33'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23eef2ff' font-family='system-ui' font-size='36'%3E"
    + encodeURIComponent(txt)
    + "%3C/text%3E%3C/svg%3E";
}

// devolve a URL final da portada
async function loadCover(g){
  if(!g.cover) return placeholder("sen portada");

  // se non é http/https, evitamos cousas raras
  const u = String(g.cover).trim();
  if(!/^https?:\/\//i.test(u)) return placeholder("URL inválida");

  return u;
}

// pequenos “pills” de info (xogadores, tempo, tags...)
function pill(icon, text){
  return `<span class="pill">${icon} ${text}</span>`;
}

// ------------------------------
// Render da grella de xogos
// ------------------------------
async function render(){
  const list = sorted(filtered());
  setText("#meta", `${list.length} resultado(s)`);

  const grid  = $("#grid");
  const empty = $("#empty");
  if(!grid) return;

  if(!list.length){
    grid.innerHTML = "";
    if(empty) empty.hidden = false;
    return;
  }
  if(empty) empty.hidden = true;

  grid.innerHTML = list.map(g=>{
    const players = `${g.players?.[0] ?? 1}–${g.players?.[1] ?? 4}`;
    const minutes = g.minutes ? `${g.minutes} min` : "—";
    const rating  = g.rating ? Number(g.rating).toFixed(1) : "—";
    const plays   = g.plays ?? 0;

    const tagPills =
      (g.tags||[]).slice(0,2).map(t=>`<span class="pill">🏷️ ${t}</span>`).join("")
      + ((g.tags||[]).length>2 ? `<span class="pill">+${(g.tags||[]).length-2}</span>` : "");

    return `
      <article class="card ${state.editMode ? "card--edit":""}">
        <div class="cover">
          <img
            class="cover__img"
            data-cover="${g.id}"
            alt="Portada de ${g.title}"
            loading="lazy"
            decoding="async"
            referrerpolicy="no-referrer"
          >
          <div class="cover__badge">★ ${rating} · ▶ ${plays}</div>
        </div>

        <div class="card__body">
          <div>
            <div class="card__title">${g.title}</div>
            <div class="card__sub">${g.subtitle||""}</div>
          </div>

          <div class="meta">${pill("👥",players)} ${pill("⏱️",minutes)}</div>
          <div class="meta">${tagPills}</div>
        </div>

        <div class="card__footer">
          <button class="smallbtn" type="button" data-open="${g.id}">
            ${state.editMode && state.session ? "Editar" : "Abrir ficha"}
          </button>
          <button class="kebab" type="button" disabled>⋯</button>
        </div>
      </article>
    `;
  }).join("");

  // asignamos portadas + fallback en erro
  for(const g of list){
    const img = document.querySelector(`img[data-cover="${CSS.escape(g.id)}"]`);
    if(!img) continue;

    img.src = placeholder("cargando…");
    img.onerror = () => { img.src = placeholder("sen portada"); };

    img.src = await loadCover(g);
  }

  // abrir ficha / editor
  grid.querySelectorAll("[data-open]").forEach(b=>{
    b.addEventListener("click", ()=>{
      const id = b.getAttribute("data-open");
      const g  = state.games.find(x=>String(x.id)===String(id));
      if(!g) return;

      if(state.editMode && state.session) openEditor(g);
      else openDetail(g);
    });
  });
}

// ------------------------------
// Ficha: tabs
// ------------------------------
function setTab(tab){
  $$(".tab").forEach(t=>t.classList.toggle("tab--on", t.getAttribute("data-tab")===tab));
  ["resumo","setup","imaxes","links"].forEach(k=>{
    const p = $("#tab-"+k);
    if(p) p.hidden = (k!==tab);
  });
  const ed = $("#editor");
  if(ed) ed.hidden = true;
}

// Abre ficha en modo lectura
function openDetail(g){
  state.current = g;

  const d = $("#detail");
  if(!d) return;

  d.hidden = false;
  setText("#detailTitle", g.title);

  const cover = $("#detailCover");
  if(cover){
    cover.src = placeholder("cargando…");
    cover.onerror = () => { cover.src = placeholder("sen portada"); };
    loadCover(g).then(u=> cover.src = u);
  }

  const players = `${g.players?.[0] ?? 1}–${g.players?.[1] ?? 4}`;
  const minutes = g.minutes ? `${g.minutes} min` : "—";
  const rating  = g.rating ? Number(g.rating).toFixed(1) : "—";
  const plays   = g.plays ?? 0;

  const resumo = $("#tab-resumo");
  if(resumo){
    resumo.innerHTML = `
      <div style="font-weight:900;font-size:16px">${g.title}</div>
      ${g.subtitle?`<div style="margin-top:6px;color:var(--muted)">${g.subtitle}</div>`:""}
      <div class="kv">${pill("👥",players)} ${pill("⏱️",minutes)} ${pill("★",rating)} ${pill("▶",plays)}</div>
      ${(g.tags||[]).length?`<div class="kv">${(g.tags||[]).map(t=>`<span class="pill">🏷️ ${t}</span>`).join("")}</div>`:""}
      ${g.notes?`<div style="margin-top:12px;color:var(--muted)">${g.notes}</div>`:""}
    `;
  }

  const setup = $("#tab-setup");
  if(setup){
    setup.innerHTML = g.setup?.length
      ? `<ol class="list">${g.setup.map(s=>`<li>${s}</li>`).join("")}</ol>`
      : `<div style="color:var(--muted)">Sen setup aínda.</div>`;
  }

  const imgs = $("#tab-imaxes");
  if(imgs){
    imgs.innerHTML = g.gallery?.length
      ? `<div class="galleryRow">${g.gallery.map(u=>`<img referrerpolicy="no-referrer" loading="lazy" src="${u}">`).join("")}</div>
         <div style="margin-top:10px;color:var(--muted)">Imaxes externas (URLs).</div>`
      : `<div style="color:var(--muted)">Sen imaxes extra.</div>`;
  }

  const links = $("#tab-links");
  if(links){
    links.innerHTML =
      `${g.video ? `<a class="linkBtn" href="${g.video}" target="_blank" rel="noopener">▶ Vídeo: como xogar</a>` : `<div style="color:var(--muted)">Sen vídeo aínda.</div>`}`
      + `${g.bggId ? `<div style="margin-top:12px"><a href="https://boardgamegeek.com/boardgame/${g.bggId}" target="_blank" rel="noopener">Abrir en BGG</a></div>` : ""}`;
  }

  setTab("resumo");
  document.body.style.overflow = "hidden";
}

function closeDetail(){
  const d = $("#detail");
  if(d) d.hidden = true;
  document.body.style.overflow = "";
}

// ------------------------------
// Editor
// ------------------------------
function openEditor(g){
  if(!state.session) return showAuth("Para editar, entra primeiro.");

  openDetail(g);

  const ed = $("#editor");
  if(!ed) return;

  ed.hidden = false;

  // agochamos tabs e marcamos sen tab activa
  ["resumo","setup","imaxes","links"].forEach(k=>{
    const p = $("#tab-"+k);
    if(p) p.hidden = true;
  });
  $$(".tab").forEach(t=>t.classList.remove("tab--on"));

  $("#f_title").value   = g.title||"";
  $("#f_subtitle").value= g.subtitle||"";
  $("#f_bgg").value     = g.bggId ?? "";
  $("#f_pmin").value    = g.players?.[0] ?? 1;
  $("#f_pmax").value    = g.players?.[1] ?? 4;
  $("#f_minutes").value = g.minutes ?? 0;

  $("#f_tags").value    = (g.tags||[]).join(", ");
  $("#f_cover").value   = g.cover || "";
  $("#f_gallery").value = (g.gallery||[]).join("\n");
  $("#f_video").value   = g.video || "";
  $("#f_setup").value   = (g.setup||[]).join("\n");
  $("#f_notes").value   = g.notes || "";

  setText("#saveHint","");
}

// parse helpers
function parseTags(s){ return String(s||"").split(",").map(x=>x.trim()).filter(Boolean); }
function parseLines(s){ return String(s||"").split("\n").map(x=>x.trim()).filter(Boolean); }
function toInt(v){
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : null;
}

// Garda cambios en Supabase (AMOSA ERRO REAL)
async function doSave(){
  if(!state.session) return showAuth("Para gardar, entra primeiro.");

  const g = state.current;
  setText("#saveHint","Gardando…");

  const btn = $("#btnSave");
  if(btn) btn.disabled = true;

  const payload = {
    title: $("#f_title").value.trim(),
    subtitle: $("#f_subtitle").value.trim(),
    bgg_id: toInt($("#f_bgg").value),
    players_min: toInt($("#f_pmin").value) ?? 1,
    players_max: toInt($("#f_pmax").value) ?? 4,
    minutes: toInt($("#f_minutes").value) ?? 0,
    tags: parseTags($("#f_tags").value),
    cover_url: $("#f_cover").value.trim() || null,
    gallery_urls: parseLines($("#f_gallery").value),
    how_to_play_url: $("#f_video").value.trim() || null,
    setup_quick: parseLines($("#f_setup").value),
    notes: $("#f_notes").value.trim() || null,
  };

  try{
    let data, error;

    if(g && g.__new){
      ({ data, error } = await state.client.from("games").insert(payload).select("*").single());
    }else{
      ({ data, error } = await state.client.from("games").update(payload).eq("id", g.id).select("*").single());
    }

    if(error) throw error;

    setText("#saveHint","Gardado ✅");
    if(btn) btn.disabled = false;

    // recargamos e volvemos renderizar
    await loadGames();
    renderChips();
    await render();

    openDetail(norm(data));
  }catch(e){
    console.error(e);
    if(btn) btn.disabled = false;

    const msg = e?.message || String(e);
    alert("Erro ao gardar: " + msg);
    setText("#saveHint","Erro: " + msg);
  }
}

// Crea novo xogo
function createNew(){
  if(!state.session) return showAuth("Para crear xogos, entra primeiro.");
  const tmp = {
    id:"new",
    title:"Novo xogo",
    subtitle:"",
    bggId:null,
    players:[1,4],
    minutes:0,
    rating:0,
    plays:0,
    tags:[],
    cover:"",
    gallery:[],
    video:"",
    setup:[],
    notes:"",
    __new:true
  };
  openEditor(tmp);
}

// Login con email+password
async function signIn(){
  try{
    setText("#authHint","Entrando…");
    const email = $("#authEmail")?.value?.trim() || "";
    const pass  = $("#authPass")?.value || "";

    const { error } = await state.client.auth.signInWithPassword({ email, password: pass });
    if(error) throw error;

    hideAuth();
  }catch(e){
    setText("#authHint","Erro: "+(e?.message || e));
  }
}

// ------------------------------
// Listeners UI
// ------------------------------
function bind(){
  on("#btnTheme","click", toggleTheme);

  // botón usuario/login
  on("#btnAuth","click", async ()=>{
    if(!state.client){
      showMeta("⚠️ Supabase non está configurado (revisa config.js)");
      return;
    }
    if(!state.session) showAuth("");
    else await state.client.auth.signOut();
  });

  // pechar modal login
  on("#btnCloseAuth","click", hideAuth);
  on("#btnCancelAuth","click", hideAuth);
  on("#btnSignIn","click", signIn);

  // click fóra do modal = pecha
  const modal = $("#authModal");
  if(modal){
    modal.addEventListener("click", (e)=>{
      if(e.target === modal) hideAuth();
    });
  }

  // escape = pecha
  window.addEventListener("keydown",(e)=>{
    if(e.key === "Escape") hideAuth();
  });

  // modo edición (pin)
  on("#btnEditMode","click", async ()=>{
    state.editMode = !state.editMode;
    await render();
  });

  // crear
  on("#btnNew","click", createNew);

  // busca
  on("#q","input",(e)=>{
    state.q = e.target.value || "";
    const c = $("#btnClear");
    if(c) c.style.visibility = state.q ? "visible":"hidden";
    render();
  });

  on("#btnClear","click",()=>{
    state.q = "";
    const q = $("#q"); if(q) q.value = "";
    const c = $("#btnClear"); if(c) c.style.visibility = "hidden";
    render();
  });

  // selects de filtros
  on("#players","change",(e)=>{ state.players = e.target.value; render(); });
  on("#time","change",(e)=>{ state.time = e.target.value; render(); });
  on("#sort","change",(e)=>{ state.sort = e.target.value; render(); });

  // reset filtros
  on("#btnReset","click",()=>{
    state.q=""; state.tag=null; state.players="any"; state.time="any"; state.sort="name";
    const q = $("#q"); if(q) q.value="";
    const c = $("#btnClear"); if(c) c.style.visibility="hidden";
    renderChips(); render();
  });

  // ficha
  on("#detailBack","click", closeDetail);
  on("#detailEditBtn","click", ()=> openEditor(state.current));

  // gardar/cancelar
  on("#btnSave","click", doSave);
  on("#btnCancel","click", ()=> openDetail(state.current));

  // tabs
  $$(".tab").forEach(t=> t.addEventListener("click", ()=> setTab(t.getAttribute("data-tab")) ));
}

// ------------------------------
// Boot
// ------------------------------
async function boot(){
  applyTheme();
  bind();

  if(!initSupabase()) return;

  await refreshSession();

  // cando cambie a sesión, refresca UI
  state.client.auth.onAuthStateChange(async ()=>{
    await refreshSession();
    await render();
  });

  await loadGames();
  renderChips();

  const c = $("#btnClear");
  if(c) c.style.visibility="hidden";

  await render();
}

boot();