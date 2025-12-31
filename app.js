/* Ludoteca — estética bonita + portada BGG + galería só na ficha */
const $ = (sel) => document.querySelector(sel);

const state = {
  theme: "dark",
  q: "",
  tag: null,
  players: "any",
  time: "any",
  sort: "name",
  games: [],
  current: null
};

// ---- Theme ----
function loadTheme(){
  const saved = localStorage.getItem("ludo_theme");
  if(saved) state.theme = saved;
  applyTheme();
}
function applyTheme(){
  document.documentElement.setAttribute("data-theme", state.theme === "light" ? "light" : "dark");
  $("#themeIcon").textContent = state.theme === "light" ? "☀️" : "🌙";
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute("content", state.theme === "light" ? "#f7f9fc" : "#0b1020");
}
function toggleTheme(){
  state.theme = (state.theme === "light") ? "dark" : "light";
  localStorage.setItem("ludo_theme", state.theme);
  applyTheme();
}

// ---- Data ----
async function loadGames(){
  const res = await fetch("data/games.json", { cache: "no-store" });
  const data = await res.json();

  // Normalizar campos mínimos
  state.games = data.map(g => ({
    id: g.id ?? (g.title || "").toLowerCase().replace(/\s+/g,"_"),
    bggId: g.bggId ?? null,
    title: g.title ?? "Sen título",
    subtitle: g.subtitle ?? "",
    players: Array.isArray(g.players) ? g.players : [1,4],
    minutes: Number(g.minutes ?? 0),
    rating: Number(g.rating ?? 0),
    plays: Number(g.plays ?? 0),
    tags: Array.isArray(g.tags) ? g.tags : [],
    howToPlayUrl: g.howToPlayUrl ?? "",
    setupQuick: Array.isArray(g.setupQuick) ? g.setupQuick : [],
    notes: g.notes ?? "",
    images: {
      cover: (g.images?.cover ?? g.cover ?? "") || "",
      gallery: Array.isArray(g.images?.gallery) ? g.images.gallery : []
    }
  }));
}

// ---- Chips ----
function uniqueTags(){
  const set = new Set();
  state.games.forEach(g => (g.tags||[]).forEach(t => set.add(t)));
  return [...set].sort((a,b) => String(a).localeCompare(String(b), "gl"));
}
function renderChips(){
  const chips = $("#chips");
  chips.innerHTML = "";

  const all = document.createElement("button");
  all.type = "button";
  all.className = "chip" + (state.tag ? "" : " chip--on");
  all.innerHTML = '<span class="chip__dot"></span>Todo';
  all.addEventListener("click", () => { state.tag = null; syncAndRender(); });
  chips.appendChild(all);

  uniqueTags().forEach(tag => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "chip" + (state.tag === tag ? " chip--on" : "");
    b.innerHTML = '<span class="chip__dot"></span>' + escapeHtml(tag);
    b.addEventListener("click", () => {
      state.tag = (state.tag === tag) ? null : tag;
      syncAndRender();
    });
    chips.appendChild(b);
  });
}

// ---- Filters ----
function parseMinutesBucket(mins){
  if(mins <= 30) return "short";
  if(mins <= 90) return "medium";
  return "long";
}
function matchesPlayers(game, p){
  if(p === "any") return true;
  if(p === "5+") return game.players?.[1] >= 5;
  const n = Number(p);
  return (n >= (game.players?.[0] ?? 1) && n <= (game.players?.[1] ?? 4));
}
function filterGames(){
  const q = state.q.trim().toLowerCase();
  return state.games.filter(g => {
    const inTag = !state.tag || (g.tags||[]).includes(state.tag);
    const inPlayers = matchesPlayers(g, state.players);
    const inTime = (state.time === "any") || (parseMinutesBucket(g.minutes) === state.time);

    const inQuery = !q || (
      String(g.title).toLowerCase().includes(q) ||
      String(g.subtitle).toLowerCase().includes(q) ||
      (g.tags||[]).join(" ").toLowerCase().includes(q)
    );
    return inTag && inPlayers && inTime && inQuery;
  });
}
function sortGames(list){
  const arr = [...list];
  if(state.sort === "name") arr.sort((a,b) => String(a.title).localeCompare(String(b.title), "gl"));
  else if(state.sort === "rating") arr.sort((a,b) => (b.rating||0) - (a.rating||0));
  else if(state.sort === "plays") arr.sort((a,b) => (b.plays||0) - (a.plays||0));
  return arr;
}

// ---- Render cards ----
function pill(icon, text){
  return `<span class="pill">${icon} ${escapeHtml(text)}</span>`;
}
function renderGrid(){
  const grid = $("#grid");
  const empty = $("#empty");

  const filtered = sortGames(filterGames());
  const activeCount = [state.tag?1:0, state.players!=="any"?1:0, state.time!=="any"?1:0, state.q?1:0].reduce((a,b)=>a+b,0);
  $("#resultsMeta").textContent = `${filtered.length} resultado(s) · filtros activos: ${activeCount}`;

  if(filtered.length === 0){
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  grid.innerHTML = filtered.map(g => {
    const players = `${g.players?.[0] ?? 1}–${g.players?.[1] ?? 4}`;
    const minutes = g.minutes ? `${g.minutes} min` : "—";
    const rating = g.rating ? `${Number(g.rating).toFixed(1)}` : "—";
    const plays = g.plays ?? 0;

    return `
      <article class="card" data-id="${escapeHtml(g.id)}">
        <div class="cover">
          <img class="cover__img" data-cover="${escapeHtml(g.id)}" alt="Portada de ${escapeHtml(g.title)}" />
          <div class="cover__badge" title="Nota e partidas">
            <span aria-hidden="true">★</span> ${rating} · <span aria-hidden="true">▶</span> ${plays}
          </div>
        </div>

        <div class="card__body">
          <div>
            <div class="card__title">${escapeHtml(g.title)}</div>
            <div class="card__sub">${escapeHtml(g.subtitle || "")}</div>
          </div>

          <div class="meta">
            ${pill("👥", players)}
            ${pill("⏱️", minutes)}
          </div>

          <div class="meta">
            ${(g.tags||[]).slice(0,2).map(t => `<span class="pill">🏷️ ${escapeHtml(t)}</span>`).join("")}
            ${(g.tags||[]).length > 2 ? `<span class="pill">+${(g.tags||[]).length-2}</span>` : ""}
          </div>
        </div>

        <div class="card__footer">
          <button class="smallbtn" type="button" data-action="open" data-id="${escapeHtml(g.id)}">Abrir ficha</button>
          <button class="kebab" type="button" aria-label="Menú (placeholder)" disabled>⋯</button>
        </div>
      </article>
    `;
  }).join("");

  // Load covers async
  filtered.forEach(async (g) => {
    const img = document.querySelector(`img[data-cover="${CSS.escape(g.id)}"]`);
    if(!img) return;
    img.src = placeholder("cargando…");
    img.src = await loadCover(g);
  });

  grid.querySelectorAll('[data-action="open"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const game = state.games.find(x => x.id === id);
      if(game) openDetail(game);
    });
  });
}

// ---- Detail ----
function setTab(tab){
  document.querySelectorAll(".tab").forEach(t => {
    const on = t.getAttribute("data-tab") === tab;
    t.classList.toggle("tab--on", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  ["resumo","setup","imaxes","links"].forEach(k => {
    $("#tab-"+k).hidden = (k !== tab);
  });
}
function openDetail(game){
  state.current = game;
  $("#detail").hidden = false;
  $("#detailTitle").textContent = game.title;

  // cover
  $("#detailCover").src = placeholder("cargando…");
  loadCover(game).then(url => $("#detailCover").src = url);

  // resumo
  const players = `${game.players?.[0] ?? 1}–${game.players?.[1] ?? 4}`;
  const minutes = game.minutes ? `${game.minutes} min` : "—";
  const rating = game.rating ? `${Number(game.rating).toFixed(1)}` : "—";
  const plays = game.plays ?? 0;

  $("#tab-resumo").innerHTML = `
    <div style="font-weight:900;font-size:16px">${escapeHtml(game.title)}</div>
    ${game.subtitle ? `<div style="margin-top:6px;color:var(--muted)">${escapeHtml(game.subtitle)}</div>` : ""}
    <div class="kv">
      ${pill("👥", players)}
      ${pill("⏱️", minutes)}
      ${pill("★", rating)}
      ${pill("▶", String(plays))}
    </div>
    ${(game.tags||[]).length ? `<div class="kv">${(game.tags||[]).map(t=>`<span class="pill">🏷️ ${escapeHtml(t)}</span>`).join("")}</div>` : ""}
    ${game.notes ? `<div style="margin-top:12px;color:var(--muted)">${escapeHtml(game.notes)}</div>` : ""}
  `;

  // setup
  $("#tab-setup").innerHTML = game.setupQuick?.length
    ? `<ol class="list">${game.setupQuick.map(s=>`<li>${escapeHtml(s)}</li>`).join("")}</ol>`
    : `<div style="color:var(--muted)">Aínda sen “setup rápido”. Engádeo no JSON como lista.</div>`;

  // imaxes (só na ficha)
  const gallery = (game.images?.gallery || []).filter(Boolean);
  $("#tab-imaxes").innerHTML = gallery.length
    ? `<div class="galleryRow">${gallery.map(u=>`<img src="${u}" alt="Imaxe extra">`).join("")}</div>
       <div style="margin-top:10px;color:var(--muted)">Imaxes externas (non ocupan espazo no repo).</div>`
    : `<div style="color:var(--muted)">Sen imaxes extra aínda. Engade URLs en <code>images.gallery</code>.</div>`;

  // links
  $("#tab-links").innerHTML = `
    ${game.howToPlayUrl ? `<a class="linkBtn" href="${game.howToPlayUrl}" target="_blank" rel="noopener">▶ Vídeo: como xogar</a>` : `<div style="color:var(--muted)">Sen vídeo aínda. Engade <code>howToPlayUrl</code>.</div>`}
    ${game.bggId ? `<div style="margin-top:12px"><a href="https://boardgamegeek.com/boardgame/${game.bggId}" target="_blank" rel="noopener">Abrir en BGG</a></div>` : ""}
  `;

  setTab("resumo");
  document.body.style.overflow = "hidden";
}
function closeDetail(){
  $("#detail").hidden = true;
  document.body.style.overflow = "";
}

// ---- Cover loader (BGG + override) ----
async function loadCover(game){
  if(game.images?.cover) return game.images.cover;
  if(!game.bggId) return placeholder("sen portada");

  const key = "bgg_cover_" + game.bggId;
  const cached = localStorage.getItem(key);
  if(cached) return cached;

  try{
    const res = await fetch(`https://boardgamegeek.com/xmlapi2/thing?id=${game.bggId}`);
    const text = await res.text();
    const img = new DOMParser().parseFromString(text, "text/xml").querySelector("image");
    const url = img?.textContent?.trim();
    if(url){
      localStorage.setItem(key, url);
      return url;
    }
  }catch(e){}

  return placeholder("sen portada");
}

function placeholder(txt){
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23141a33'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23eef2ff' font-family='system-ui' font-size='36'%3E"+encodeURIComponent(txt)+"%3C/text%3E%3C/svg%3E";
}
function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---- Wiring ----
function syncAndRender(){
  $("#players").value = state.players;
  $("#time").value = state.time;
  $("#sort").value = state.sort;
  renderChips();
  renderGrid();
}
function bindEvents(){
  $("#btnTheme").addEventListener("click", toggleTheme);
  $("#btnAbout").addEventListener("click", ()=> $("#about").hidden = false);
  $("#aboutClose").addEventListener("click", ()=> $("#about").hidden = true);

  $("#q").addEventListener("input", (e) => {
    state.q = e.target.value || "";
    $("#btnClear").style.visibility = state.q ? "visible" : "hidden";
    renderGrid();
  });
  $("#btnClear").addEventListener("click", () => {
    state.q = "";
    $("#q").value = "";
    $("#btnClear").style.visibility = "hidden";
    renderGrid();
  });

  $("#players").addEventListener("change", (e) => { state.players = e.target.value; renderGrid(); });
  $("#time").addEventListener("change", (e) => { state.time = e.target.value; renderGrid(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; renderGrid(); });

  $("#btnReset").addEventListener("click", () => {
    state.q = "";
    state.tag = null;
    state.players = "any";
    state.time = "any";
    state.sort = "name";
    $("#q").value = "";
    $("#btnClear").style.visibility = "hidden";
    syncAndRender();
  });

  $("#detailBack").addEventListener("click", closeDetail);
  $("#detail").addEventListener("click", (e) => {
    // click outside content closes
    if(e.target === $("#detail")) closeDetail();
  });

  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => setTab(t.getAttribute("data-tab")));
  });

  $("#btnClear").style.visibility = "hidden";
}

async function init(){
  loadTheme();
  bindEvents();
  await loadGames();
  syncAndRender();
}
init();
