-- Στοιχεία λογαριασμού ανά συνδρομή
alter table public.subscriptions add column if not exists cancel_url text;
alter table public.subscriptions add column if not exists payment_method text;
alter table public.subscriptions add column if not exists account_note text;
