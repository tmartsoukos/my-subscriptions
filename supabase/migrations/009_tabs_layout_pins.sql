-- Δική μου κάτω μπάρα και διάταξη αρχικής
alter table public.profile add column if not exists tabs jsonb
  not null default '["dashboard","finance","todos","calendar","more"]'::jsonb;
alter table public.profile add column if not exists dash_layout jsonb;

-- Καρφιτσωμένα στην αρχική
create table if not exists public.pins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('subscription','note','course','todo','watchlist')),
  ref_id uuid not null,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, kind, ref_id)
);
alter table public.pins enable row level security;
create policy "own pins" on public.pins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
