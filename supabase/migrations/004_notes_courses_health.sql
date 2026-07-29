-- Σημειώσεις σε στυλ Apple Notes
alter table public.notes add column if not exists title text;
alter table public.notes add column if not exists pinned boolean not null default false;
alter table public.notes add column if not exists updated_at timestamptz not null default now();

-- Σπουδές
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  code text,
  semester smallint,
  ects numeric(4,1),
  grade numeric(4,2) check (grade >= 0 and grade <= 10),
  status text not null default 'active' check (status in ('active','passed','failed','planned')),
  color text not null default '#3b82f6',
  professor text,
  note text,
  created_at timestamptz not null default now()
);
alter table public.courses enable row level security;
create policy "own courses" on public.courses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists courses_user_idx on public.courses(user_id, status, semester);

alter table public.todos add column if not exists course_id uuid references public.courses(id) on delete set null;
alter table public.events add column if not exists course_id uuid references public.courses(id) on delete set null;

-- Υγεία
create table if not exists public.health_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'appointment'
    check (kind in ('appointment','exam','vaccine','medication','measurement')),
  title text not null,
  item_date date,
  item_time time,
  repeat_months smallint,
  provider text,
  result text,
  note text,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.health_items enable row level security;
create policy "own health" on public.health_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists health_user_idx on public.health_items(user_id, item_date);
