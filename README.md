# Ludoteca (Supabase) — listo para subir a GitHub

## 1) Pega as claves
Edita `config.js` e pega:
- Project URL
- anon public key
en: Supabase Dashboard → Project Settings → API

## 2) Crea a táboa `games` + políticas
SQL Editor → executa:

```sql
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  bgg_id int,
  players_min int default 1,
  players_max int default 4,
  minutes int default 0,
  rating numeric default 0,
  plays int default 0,
  tags text[] default '{}',
  cover_url text,
  gallery_urls text[] default '{}',
  how_to_play_url text,
  setup_quick text[] default '{}',
  notes text,
  created_at timestamptz default now()
);

alter table public.games enable row level security;

create policy "public read" on public.games
for select using (true);

create policy "auth write" on public.games
for insert with check (auth.role() = 'authenticated');

create policy "auth update" on public.games
for update using (auth.role() = 'authenticated');

create policy "auth delete" on public.games
for delete using (auth.role() = 'authenticated');
```

## 3) Como editar
Na web:
- 👤 entra (email+password)
- 📌 activa modo edición
- ＋ crea xogos
- na ficha: botón ✎ para editar e “Gardar”

Imaxes:
- `cover_url` = portada
- `gallery_urls` = imaxes extra na ficha
Se `cover_url` está baleiro e hai `bgg_id`, a portada cárgase de BGG.


## Opción B: Portadas e imaxes por URL (sen BGG automático)
- En cada xogo, en **Editar**:
  - **Portada URL**: pega unha URL directa a unha imaxe
  - **Galería URLs**: unha URL por liña
- A app non fai chamadas a BGG para imaxes/etiquetas.
