-- Αρχικό σχήμα: οι πίνακες που υπήρχαν πριν από το migration 002.
-- Καταγράφηκε από την ίδια τη βάση ώστε το project να ξαναστήνεται από το μηδέν.
-- Τα επόμενα migrations (002 και μετά) προσθέτουν στήλες πάνω σε αυτούς.
-- Είναι ασφαλές να ξανατρέξει: όλα είναι «if not exists» και οι πολιτικές ξαναγράφονται.

-- ---------- Συνδρομές ----------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  cycle text not null default 'monthly' check (cycle in ('weekly','monthly','yearly')),
  next_date date not null,
  color text not null default '#7c6cf6',
  category text not null default 'other'
    check (category in ('streaming','music','software','fitness','utilities','gaming','other')),
  created_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id, next_date);
alter table public.subscriptions enable row level security;
drop policy if exists "own subscriptions" on public.subscriptions;
create policy "own subscriptions" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Εργασίες ----------
create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  priority smallint not null default 2 check (priority >= 1 and priority <= 3),
  due_date date,
  created_at timestamptz not null default now()
);
create index if not exists todos_user_idx on public.todos (user_id, done, due_date);
alter table public.todos enable row level security;
drop policy if exists "own todos" on public.todos;
create policy "own todos" on public.todos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Υποχρεώσεις ημερολογίου ----------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  event_date date not null,
  event_time time,
  notes text,
  color text not null default '#58a6ff',
  created_at timestamptz not null default now()
);
create index if not exists events_user_idx on public.events (user_id, event_date);
alter table public.events enable row level security;
drop policy if exists "own events" on public.events;
create policy "own events" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Σημειώσεις ----------
-- Οι στήλες title, pinned και updated_at προστίθενται στο 004.
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  content text not null default '',
  color text not null default '#e3b341',
  created_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes (user_id, created_at);
alter table public.notes enable row level security;
drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Λίστα να δω / να διαβάσω ----------
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'movie' check (kind in ('movie','series','book','game','other')),
  status text not null default 'planned' check (status in ('planned','active','done')),
  rating smallint check (rating >= 1 and rating <= 5),
  service text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists watchlist_user_idx on public.watchlist (user_id, status, created_at desc);
alter table public.watchlist enable row level security;
drop policy if exists "own watchlist" on public.watchlist;
create policy "own watchlist" on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- Token ροής ημερολογίου ----------
-- Ένα ανά χρήστη· δίνει πρόσβαση στις edge functions χωρίς σύνδεση, γι' αυτό
-- αντιμετωπίζεται ως μυστικό και ανανεώνεται από τις Ρυθμίσεις αν διαρρεύσει.
create table if not exists public.ics_tokens (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.ics_tokens enable row level security;
drop policy if exists "own ics token" on public.ics_tokens;
create policy "own ics token" on public.ics_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
