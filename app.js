let games=[];
let activeTag=null;

fetch('data/games.json')
 .then(r=>r.json())
 .then(d=>{games=d;renderChips();render();});

const search=document.getElementById('search');
search.oninput=render;

function renderChips(){
  const set=new Set();
  games.forEach(g=>(g.tags||[]).forEach(t=>set.add(t)));
  const chips=document.getElementById('chips');
  chips.innerHTML='<div class="chip on">Todo</div>';
  chips.firstChild.onclick=()=>{activeTag=null;render();setActive(null)};
  [...set].sort().forEach(t=>{
    const c=document.createElement('div');
    c.className='chip';
    c.textContent=t;
    c.onclick=()=>{activeTag=t;render();setActive(c)};
    chips.appendChild(c);
  });
}

function setActive(el){
  document.querySelectorAll('.chip').forEach(c=>c.classList.remove('on'));
  if(el) el.classList.add('on');
}

function render(){
  const q=search.value.toLowerCase();
  const grid=document.getElementById('grid');
  grid.innerHTML='';
  games.filter(g=>{
    const matchQ=g.title.toLowerCase().includes(q);
    const matchT=!activeTag||(g.tags||[]).includes(activeTag);
    return matchQ&&matchT;
  }).forEach(g=>{
    const c=document.createElement('div');
    c.className='card';
    const img=document.createElement('img');
    loadCover(g).then(u=>img.src=u);
    c.appendChild(img);
    c.innerHTML+=`<div class="card-body">
      <div class="card-title">${g.title}</div>
      <div class="card-meta">${g.players?.[0]}–${g.players?.[1]} xog · ${g.minutes||'—'} min</div>
    </div>`;
    c.onclick=()=>openDetail(g);
    grid.appendChild(c);
  });
}

function openDetail(g){
  document.getElementById('detail').hidden=false;
  loadCover(g).then(u=>document.getElementById('detailCover').src=u);
  document.getElementById('detailBody').innerHTML=`
    <h2>${g.title}</h2>
    <p>${g.notes||''}</p>
  `;
}

document.getElementById('close').onclick=()=>{
  document.getElementById('detail').hidden=true;
};

async function loadCover(g){
  if(g.images?.cover) return g.images.cover;
  if(!g.bggId) return '';
  const key='bgg_'+g.bggId;
  const c=localStorage.getItem(key);
  if(c) return c;
  const r=await fetch('https://boardgamegeek.com/xmlapi2/thing?id='+g.bggId);
  const t=await r.text();
  const img=new DOMParser().parseFromString(t,'text/xml').querySelector('image');
  if(img){
    localStorage.setItem(key,img.textContent);
    return img.textContent;
  }
  return '';
}
