-- Ώρα που αρχίζει η μέρα (0 = μεσάνυχτα). Με 4, ό,τι καταχωρείται πριν τις 4 π.μ.
-- μετράει στη χθεσινή μέρα σε συγκεντρωτικά και φίλτρα.
alter table public.profile
  add column if not exists day_start_hour smallint not null default 0
  check (day_start_hour >= 0 and day_start_hour < 12);
