-- Λογαριασμοί χρημάτων, μεταφορές μεταξύ τους και υποκατηγορίες εξόδων

-- Πού βρίσκονται τα λεφτά: μετρητά, κάρτα, τράπεζα.
-- Το start_balance είναι το υπόλοιπο τη στιγμή που δημιουργείς τον λογαριασμό —
-- πάνω του προστίθεται η ροή των εγγραφών για να βγει το τρέχον υπόλοιπο.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'cash' check (kind in ('cash', 'card', 'bank', 'other')),
  start_balance numeric(12,2) not null default 0,
  color text not null default '#4c8dff',
  sort smallint not null default 0,
  created_at timestamptz not null default now()
);

alter table public.accounts enable row level security;
drop policy if exists "own accounts" on public.accounts;
create policy "own accounts" on public.accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Κάθε κίνηση ξέρει από πού ήρθαν ή πού πήγαν τα λεφτά.
-- Σε μεταφορά, account_id είναι η αφετηρία και to_account_id ο προορισμός.
alter table public.finance_entries
  add column if not exists account_id uuid references public.accounts(id) on delete set null;
alter table public.finance_entries
  add column if not exists to_account_id uuid references public.accounts(id) on delete set null;

-- Τρίτο είδος κίνησης: η μεταφορά δεν είναι ούτε έσοδο ούτε έξοδο
alter table public.finance_entries drop constraint if exists finance_entries_kind_check;
alter table public.finance_entries
  add constraint finance_entries_kind_check check (kind in ('income', 'expense', 'transfer'));

create index if not exists finance_account_idx on public.finance_entries(user_id, account_id);

-- Ιεραρχία κατηγοριών: το parent δείχνει στο key της γονικής κατηγορίας
alter table public.custom_categories add column if not exists parent text;
