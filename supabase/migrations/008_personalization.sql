-- Προφίλ χρήστη
create table if not exists public.profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  avatar_path text,
  accent text not null default 'blue',
  start_route text not null default 'dashboard',
  updated_at timestamptz not null default now()
);
alter table public.profile enable row level security;
create policy "own profile" on public.profile
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Δικές μου κατηγορίες (έξοδα, έσοδα ή συνδρομές)
create table if not exists public.custom_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scope text not null check (scope in ('expense','income','subscription')),
  key text not null,
  label text not null,
  color text not null default '#7b8fd6',
  created_at timestamptz not null default now(),
  unique (user_id, scope, key)
);
alter table public.custom_categories enable row level security;
create policy "own categories" on public.custom_categories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Γρήγορες ενέργειες (καταχώριση με ένα πάτημα)
create table if not exists public.quick_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense','income','todo')),
  label text not null,
  amount numeric(10,2),
  category text,
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);
alter table public.quick_actions enable row level security;
create policy "own quick actions" on public.quick_actions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Στόχοι στην επισκόπηση
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  metric text not null check (metric in ('subs_monthly','expense_monthly','save_monthly','tasks_weekly')),
  target numeric(10,2) not null check (target >= 0),
  label text,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
