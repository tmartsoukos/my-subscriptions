-- Επιδόσεις: το RLS σταματά να ξαναρωτάει ποιος είσαι σε κάθε γραμμή.
--
-- Οι πολιτικές γράφτηκαν `auth.uid() = user_id`. Η Postgres δεν θεωρεί τη
-- συνάρτηση σταθερή μέσα στο ερώτημα, οπότε την καλεί ΜΙΑ ΦΟΡΑ ΑΝΑ ΓΡΑΜΜΗ.
-- Με `(select auth.uid())` υπολογίζεται μία φορά για όλο το ερώτημα.
-- Στις 100 εγγραφές δεν φαίνεται· στις 10.000 φαίνεται πολύ.
--
-- Όλες οι πολιτικές έχουν το ίδιο σχήμα (ALL, ίδιο qual και with_check),
-- οπότε τις ξαναχτίζουμε με βρόχο αντί για δεκαοκτώ σχεδόν ίδια μπλοκ.
do $$
declare
  t record;
begin
  for t in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and qual = '(auth.uid() = user_id)'
  loop
    execute format('drop policy %I on public.%I', t.policyname, t.tablename);
    execute format($f$
      create policy %I on public.%I
        for all
        using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id)
    $f$, t.policyname, t.tablename);
  end loop;
end $$;

-- Ξένα κλειδιά χωρίς ευρετήριο. Τα δύο πρώτα τα ρωτάει η όψη account_balances
-- σε κάθε άνοιγμα των Οικονομικών· τα υπόλοιπα τα χρησιμοποιεί η διαγραφή χρήστη
-- και τα φίλτρα ανά μάθημα.
create index if not exists finance_entries_account_idx    on public.finance_entries(account_id);
create index if not exists finance_entries_to_account_idx on public.finance_entries(to_account_id);
create index if not exists accounts_user_idx              on public.accounts(user_id);
create index if not exists goals_user_idx                 on public.goals(user_id);
create index if not exists quick_actions_user_idx         on public.quick_actions(user_id);
create index if not exists push_subscriptions_user_idx    on public.push_subscriptions(user_id);
create index if not exists events_course_idx              on public.events(course_id);
create index if not exists todos_course_idx               on public.todos(course_id);
