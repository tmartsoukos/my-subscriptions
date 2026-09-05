-- Καταγραφή σφαλμάτων: ό,τι σκάει στο κινητό, να το μαθαίνεις.
-- Μέχρι τώρα 55 σημεία έπιαναν το σφάλμα και το κατάπιναν σιωπηλά.
create table if not exists public.error_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  message text not null,
  where_at text,
  stack text,
  route text,
  agent text,
  created_at timestamptz not null default now()
);

alter table public.error_log enable row level security;
drop policy if exists "own errors" on public.error_log;
create policy "own errors" on public.error_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists error_log_user_time_idx on public.error_log(user_id, created_at desc);
