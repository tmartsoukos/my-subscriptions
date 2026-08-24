-- Ζωντανό χρώμα τόνου: αν είναι ενεργό, ο τόνος γέρνει προς πράσινο ή κεχριμπάρι
-- ανάλογα με το πώς πας στους στόχους σου.
alter table public.profile
  add column if not exists mood_accent boolean not null default true;
