-- Ημερήσια έσοδα και έξοδα
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(10,2) not null check (amount >= 0),
  category text not null default 'other',
  note text,
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.finance_entries enable row level security;
create policy "own finance" on public.finance_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists finance_user_date_idx on public.finance_entries(user_id, entry_date desc);
