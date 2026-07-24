-- Δωρεάν δοκιμαστική περίοδος: ημερομηνία λήξης (= πρώτη χρέωση)
alter table public.subscriptions add column if not exists trial_end date;

-- Μοιρασμένες συνδρομές: [{ "name": "Νίκος", "paid_for": "2026-08-10" | null }]
alter table public.subscriptions add column if not exists members jsonb not null default '[]'::jsonb;

do $$
begin
  alter table public.subscriptions add constraint members_is_array check (jsonb_typeof(members) = 'array');
exception when duplicate_object then null;
end $$;
