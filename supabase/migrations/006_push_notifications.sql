-- Συνδρομές push ανά συσκευή
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  label text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Προτιμήσεις ειδοποιήσεων (μία γραμμή ανά χρήστη)
create table if not exists public.notify_prefs (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  daily_hour smallint not null default 8 check (daily_hour between 0 and 23),
  weekly_dow smallint default 0 check (weekly_dow between 0 and 6), -- 0 = Κυριακή
  lead_days smallint not null default 1 check (lead_days between 0 and 7),
  last_daily date,
  last_weekly date
);
alter table public.notify_prefs enable row level security;
create policy "own notify prefs" on public.notify_prefs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Μυστικά υπηρεσίας: μόνο ο service role (RLS ενεργό χωρίς policies)
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;

-- Τα κλειδιά VAPID και το cron_secret καταχωρούνται χειροκίνητα:
--   insert into public.app_config (key, value) values ('vapid_public', '...'), ('vapid_private_d', '...'),
--     ('vapid_subject', 'mailto:...'), ('cron_secret', encode(gen_random_bytes(24), 'hex'));

-- Ωριαίο cron που καλεί τη συνάρτηση notify
create extension if not exists pg_cron;
create extension if not exists pg_net;
