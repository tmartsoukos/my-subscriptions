-- Οι υπολογισμοί φεύγουν από το κινητό και πάνε στη βάση.
--
-- Μέχρι τώρα η σελίδα των Οικονομικών κατέβαζε ΟΛΟΚΛΗΡΟ τον πίνακα εγγραφών σε
-- κάθε άνοιγμα, για να βγάλει υπόλοιπα και ημερήσια σύνολα. Στις 100 εγγραφές
-- δεν φαίνεται· στις 5.000 φαίνεται πολύ. Τα αθροίσματα τα κάνει πλέον η Postgres
-- και το κινητό κατεβάζει μόνο τις κινήσεις της περιόδου που βλέπεις.
--
-- security_invoker: οι όψεις τρέχουν με τα δικαιώματα του χρήστη που ρωτάει,
-- άρα ισχύει κανονικά το RLS του finance_entries. Χωρίς αυτό θα έβλεπε ο ένας
-- τα δεδομένα του άλλου.

-- Τρέχον υπόλοιπο ανά λογαριασμό: αρχικό ποσό συν η ροή, με τις μεταφορές
-- να μετράνε αρνητικά στην αφετηρία και θετικά στον προορισμό.
drop view if exists public.account_balances;
create view public.account_balances
with (security_invoker = on) as
select
  a.user_id,
  a.id as account_id,
  a.start_balance + coalesce(f.delta, 0) as balance
from public.accounts a
left join lateral (
  select sum(
    case
      when e.kind = 'income'   and e.account_id    = a.id then  e.amount
      when e.kind = 'expense'  and e.account_id    = a.id then -e.amount
      when e.kind = 'transfer' and e.to_account_id = a.id then  e.amount
      when e.kind = 'transfer' and e.account_id    = a.id then -e.amount
      else 0
    end
  ) as delta
  from public.finance_entries e
  where e.account_id = a.id or e.to_account_id = a.id
) f on true;

-- Ημερήσια σύνολα. Μία γραμμή ανά μέρα αντί για μία ανά κίνηση: αρκεί για τον
-- χάρτη θερμότητας, το ραβδόγραμμα και τα ποσά πάνω στο ημερολόγιο.
drop view if exists public.finance_daily;
create view public.finance_daily
with (security_invoker = on) as
select
  user_id,
  entry_date,
  coalesce(sum(amount) filter (where kind = 'income'), 0)  as income,
  coalesce(sum(amount) filter (where kind = 'expense'), 0) as expense
from public.finance_entries
where kind <> 'transfer'
group by user_id, entry_date;

-- Πόσες κινήσεις δεν έχουν λογαριασμό, χωρίς να τις κατεβάσουμε για να τις μετρήσουμε.
drop view if exists public.finance_stats;
create view public.finance_stats
with (security_invoker = on) as
select
  user_id,
  count(*) filter (where account_id is null and kind <> 'transfer') as no_account,
  count(*) as entries,
  min(entry_date) as first_entry
from public.finance_entries
group by user_id;

-- Οι ερωτήσεις γίνονται πια ανά διάστημα ημερομηνιών
create index if not exists finance_user_date_range_idx
  on public.finance_entries(user_id, entry_date);
