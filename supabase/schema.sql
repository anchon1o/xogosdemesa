-- Supabase SQL Editor → Run
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.games (
  id text primary key,
  title text not null,
  subtitle text,
  players_min int,
  players_max int,
  minutes int,
  bgg_id int,
  rating numeric,
  plays int,
  tags text[],
  cover_url text,
  gallery_urls text[],
  how_to_play_url text,
  setup_quick text[],
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_games_updated_at on public.games;
create trigger trg_games_updated_at before update on public.games
for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.games enable row level security;

drop policy if exists profiles_read_own on public.profiles;
create policy profiles_read_own on public.profiles for select
to authenticated using (id = auth.uid());

drop policy if exists games_public_read on public.games;
create policy games_public_read on public.games for select
to anon, authenticated using (true);

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles where id = uid), false);
$$;

drop policy if exists games_admin_insert on public.games;
create policy games_admin_insert on public.games for insert
to authenticated with check (public.is_admin(auth.uid()));

drop policy if exists games_admin_update on public.games;
create policy games_admin_update on public.games for update
to authenticated using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

drop policy if exists games_admin_delete on public.games;
create policy games_admin_delete on public.games for delete
to authenticated using (public.is_admin(auth.uid()));
