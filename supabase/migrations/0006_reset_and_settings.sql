-- ============================================================================
-- BETTER ME - Reset, account deletion, and settings that actually do something
--
-- Four things:
--
--   1. Reset This Month and Reset Everything, written so balances stay true.
--      Deleting a debt payment without adding the money back would leave a debt
--      reading 15,000 when nothing was ever paid. Every reset reverses first and
--      deletes second, inside one transaction.
--
--   2. Delete Account, which removes the login itself and not just the data.
--
--   3. An optional recovery email, and a motivation tone.
--
--   4. A record of reminders already delivered, so a scheduler that fires twice
--      cannot send the same reminder twice.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Profile: optional recovery email
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists recovery_email text;

comment on column public.profiles.recovery_email is
  'Optional, and deliberately separate from the internal auth alias. Stored so '
  'the account can be identified if the password is lost. Login still uses '
  'username and password only.';

-- ----------------------------------------------------------------------------
-- Preferences: tone, gym reminders, calendar start, text size, dashboard
-- ----------------------------------------------------------------------------
alter table public.user_preferences
  add column if not exists motivation_tone text not null default 'balanced'
    check (motivation_tone in ('encourage', 'balanced', 'roast', 'brutal')),
  add column if not exists text_size text not null default 'medium'
    check (text_size in ('small', 'medium', 'large')),
  add column if not exists week_starts_on smallint not null default 0
    check (week_starts_on in (0, 1)),
  -- Which optional home cards are hidden. Absent means the approved default.
  add column if not exists hidden_home_cards text[] not null default '{}';

alter table public.notification_preferences
  add column if not exists gym_reminders_enabled boolean not null default true,
  add column if not exists finance_reminders_enabled boolean not null default true;

-- ----------------------------------------------------------------------------
-- Reminders already delivered
--
-- The key is deliberately (user, kind, subject, date, slot) rather than a
-- timestamp: a scheduler that runs every five minutes must be able to ask "have
-- I already sent this one" and get a truthful answer, no matter how many times
-- it wakes up.
-- ----------------------------------------------------------------------------
create table if not exists public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('one_hour', 'noon_summary')),
  -- The habit occurrence for a one hour reminder; null for the daily summary.
  subject_id uuid,
  occurrence_date date not null,
  delivered_at timestamptz not null default now()
);

-- One send per user, per kind, per subject, per day. This unique index is the
-- actual guarantee; the code just reads it.
create unique index if not exists reminder_deliveries_once
  on public.reminder_deliveries (user_id, kind, coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid), occurrence_date);

create index if not exists reminder_deliveries_cleanup_idx
  on public.reminder_deliveries (delivered_at);

alter table public.reminder_deliveries enable row level security;

drop policy if exists "reminder_deliveries_owner_all" on public.reminder_deliveries;
create policy "reminder_deliveries_owner_all" on public.reminder_deliveries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, delete on public.reminder_deliveries to authenticated;
revoke all on public.reminder_deliveries from anon;

-- ----------------------------------------------------------------------------
-- Reset this month
--
-- Reverses before deleting. Runs as one statement block, so either the whole
-- month is undone or nothing is.
-- ----------------------------------------------------------------------------
create or replace function public.reset_this_month(
  p_month text,
  p_include_budget boolean default false
)
returns json
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_start date;
  v_end date;
  v_removed json;
  v_habits int;
  v_workouts int;
  v_income int;
  v_expenses int;
  v_transfers int;
  v_savings int;
  v_payments int;
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  if p_month !~ '^\d{4}-\d{2}$' then
    raise exception 'Month must look like 2026-08.' using errcode = '22023';
  end if;

  -- Real month boundaries. Never build the 31st of a month that has 30 days.
  v_start := to_date(p_month || '-01', 'YYYY-MM-DD');
  v_end := (v_start + interval '1 month - 1 day')::date;

  -- Habits: deleting the occurrence row is what clears the status, because a
  -- day with no row is "no status" by design.
  delete from public.habit_occurrences
   where user_id = v_user and occurrence_date between v_start and v_end;
  get diagnostics v_habits = row_count;

  delete from public.workouts
   where user_id = v_user and workout_date between v_start and v_end;
  get diagnostics v_workouts = row_count;

  delete from public.income_entries
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_income = row_count;

  delete from public.expense_entries
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_expenses = row_count;

  delete from public.transfers
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_transfers = row_count;

  -- Savings: put the money back before the history goes. A deposit added to the
  -- balance, so undoing it subtracts, and the reverse for a withdrawal.
  update public.savings_categories sc
     set balance_centavos = sc.balance_centavos - coalesce(delta.amount, 0)
    from (
      select st.category_id,
             sum(case when st.type = 'deposit' then st.amount_centavos else -st.amount_centavos end) as amount
        from public.savings_transactions st
       where st.user_id = v_user
         and st.created_at::date between v_start and v_end
       group by st.category_id
    ) delta
   where sc.id = delta.category_id and sc.user_id = v_user;

  delete from public.savings_transactions
   where user_id = v_user and created_at::date between v_start and v_end;
  get diagnostics v_savings = row_count;

  -- Debts: a payment reduced the balance, so undoing it adds the money back and
  -- the debt stops being paid off.
  update public.debts d
     set balance_centavos = d.balance_centavos + coalesce(paid.amount, 0),
         paid_off = (d.balance_centavos + coalesce(paid.amount, 0)) = 0
    from (
      select dp.debt_id, sum(dp.amount_centavos) as amount
        from public.debt_payments dp
       where dp.user_id = v_user
         and dp.entry_date between v_start and v_end
       group by dp.debt_id
    ) paid
   where d.id = paid.debt_id and d.user_id = v_user;

  delete from public.debt_payments
   where user_id = v_user and entry_date between v_start and v_end;
  get diagnostics v_payments = row_count;

  if p_include_budget then
    delete from public.budgets where user_id = v_user and month = p_month;
    delete from public.category_budgets where user_id = v_user and month = p_month;
  end if;

  -- Reminder records for the month go too, otherwise a re-created habit in the
  -- same month would be silently skipped as "already reminded".
  delete from public.reminder_deliveries
   where user_id = v_user and occurrence_date between v_start and v_end;

  v_removed := json_build_object(
    'habits', v_habits,
    'workouts', v_workouts,
    'income', v_income,
    'expenses', v_expenses,
    'transfers', v_transfers,
    'savings', v_savings,
    'debtPayments', v_payments
  );
  return v_removed;
end;
$$;

grant execute on function public.reset_this_month(text, boolean) to authenticated;

-- ----------------------------------------------------------------------------
-- Reset everything
--
-- Removes the person's Better Me data and leaves the login alone. Balances do
-- not need reversing here because the accounts holding them are going too.
-- ----------------------------------------------------------------------------
create or replace function public.reset_everything()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  -- Children first where there is no cascade to rely on.
  delete from public.habit_occurrences where user_id = v_user;
  delete from public.habit_schedules where habit_id in (select id from public.habits where user_id = v_user);
  delete from public.habits where user_id = v_user;

  delete from public.workouts where user_id = v_user;

  delete from public.transfers where user_id = v_user;
  delete from public.income_entries where user_id = v_user;
  delete from public.expense_entries where user_id = v_user;
  delete from public.category_budgets where user_id = v_user;
  delete from public.budgets where user_id = v_user;

  delete from public.savings_transactions where user_id = v_user;
  delete from public.savings_categories where user_id = v_user;

  delete from public.debt_payments where user_id = v_user;
  delete from public.debts where user_id = v_user;

  delete from public.finance_categories where user_id = v_user;
  delete from public.finance_accounts where user_id = v_user;

  delete from public.reminder_deliveries where user_id = v_user;

  -- Dashboard layout and tone go back to default. Theme, notification switches
  -- and the app lock are settings rather than data, so they stay.
  update public.user_preferences
     set hidden_home_cards = '{}', motivation_tone = 'balanced'
   where user_id = v_user;
end;
$$;

grant execute on function public.reset_everything() to authenticated;

-- ----------------------------------------------------------------------------
-- Delete account
--
-- Removing the row from auth.users cascades to every table, because every table
-- references it with on delete cascade. Needs to be security definer since a
-- signed-in user has no rights on the auth schema.
-- ----------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;

  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
