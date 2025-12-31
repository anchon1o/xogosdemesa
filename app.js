let games=[];
let theme='dark';

fetch('data/games.json')
  .then(r=>r.json())
  .then(d=>{games=d;render();});

document.getElementById('btnTheme').onclick=()=>{
  theme = theme==='dark'?'light':'dark';
  document.body.style.background = theme==='dark'?'#0b1020':'#f7f9fc';
  document.body.style.color = theme==='dark'?'#eef2ff':'#0b1020';
};

document.getElementById('q').oninput=render;

function render(){
  const q=document.getElementById('q').value.toLowerCase();
  const grid=document.getElementById('grid');
  const meta=document.getElementById('meta');
  grid.innerHTML='';

  const filtered=games.filter(g=>g.title.toLowerCase().includes(q));
  meta.textContent = filtered.length+' xogos';

  filtered.forEach(g=>{
    const c=document.createElement('div');
    c.className='card';
    const img=document.createElement('img');
    loadCover(g).then(u=>img.src=u);
    c.appendChild(img);
    c.innerHTML+=`<div class="card__body">
      <div class="card__title">${g.title}</div>
      <div class="card__meta">${g.players?.[0]}–${g.players?.[1]} xog. · ${g.minutes||'—'} min</div>
      <button>Abrir ficha</button>
    </div>`;
    c.querySelector('button').onclick=()=>openDetail(g);
    grid.appendChild(c);
  });
}

function openDetail(g){
  document.getElementById('detail').hidden=false;
  document.getElementById('detailTitle').textContent=g.title;
  loadCover(g).then(u=>document.getElementById('detailCover').src=u);
  document.getElementById('detailContent').innerHTML=`<p>${g.notes||''}</p>`;
}

document.getElementById('detailBack').onclick=()=>{
  document.getElementById('detail').hidden=true;
};

async function loadCover(g){
  if(g.images?.cover) return g.images.cover;
  if(!g.bggId) return '';
  const key='bgg_'+g.bggId;
  const cached=localStorage.getItem(key);
  if(cached) return cached;
  const r=await fetch('https://boardgamegeek.com/xmlapi2/thing?id='+g.bggId);
  const t=await r.text();
  const img=new DOMParser().parseFromString(t,'text/xml').querySelector('image');
  if(img){
    localStorage.setItem(key,img.textContent);
    return img.textContent;
  }
  return '';
}
